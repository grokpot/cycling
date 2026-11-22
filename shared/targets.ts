/** Resolve interval power, cadence, and ramp pieces. */

import type { Profile, WorkoutInterval } from './types'

export const DEFAULT_ZONE_TABLE: Record<number, number> = {
  1: 50,
  2: 60,
  3: 75,
  4: 90,
  5: 105,
  6: 120,
  7: 150,
}

export const DEFAULT_RPE_TABLE: Record<number, number> = {
  1: 40,
  2: 50,
  3: 60,
  4: 70,
  5: 80,
  6: 90,
  7: 100,
  8: 110,
  9: 120,
  10: 140,
}

export interface RampPiece {
  durationSeconds: number
  wattsStart: number | null
  wattsEnd: number | null
  cadenceLow: number | null
  cadenceHigh: number | null
}

export function clampScale(scalePercent: number): number {
  if (scalePercent < 70) {
    return 70
  }
  if (scalePercent > 120) {
    return 120
  }
  const step = Math.round(scalePercent / 5) * 5
  return step
}

export function scaleWatts(watts: number, scalePercent = 100): number {
  const scale = clampScale(scalePercent)
  return Math.round((watts * scale) / 100)
}

function resolveBaseWatts(
  interval: WorkoutInterval,
  profile: Profile,
  useEndRamp = false,
): number | null {
  let kind = interval.powerKind
  let value = interval.powerValue
  if (useEndRamp && interval.shape === 'ramp') {
    kind = interval.rampEndPowerKind ?? interval.powerKind
    value = interval.rampEndPowerValue ?? interval.powerValue
  }

  if (kind === 'watts') {
    return value
  }
  if (profile.ftp === null) {
    if (kind === 'ftp_percent' || kind === 'zone') {
      return null
    }
    if (kind === 'rpe') {
      return null
    }
  }
  const ftp = profile.ftp!
  if (kind === 'ftp_percent') {
    return Math.round((ftp * value) / 100)
  }
  if (kind === 'zone') {
    const pct = profile.zoneTable[value] ?? DEFAULT_ZONE_TABLE[value]
    if (pct === undefined) {
      return null
    }
    return Math.round((ftp * pct) / 100)
  }
  if (kind === 'rpe') {
    const pct = profile.rpeTable[value] ?? DEFAULT_RPE_TABLE[value]
    if (pct === undefined) {
      return null
    }
    return Math.round((ftp * pct) / 100)
  }
  return null
}

export function resolveWatts(
  interval: WorkoutInterval,
  profile: Profile,
  scalePercent = 100,
  useEndRamp = false,
): number | null {
  const base = resolveBaseWatts(interval, profile, useEndRamp)
  if (base === null) {
    return null
  }
  if (interval.powerKind === 'watts' && !useEndRamp) {
    return scaleWatts(base, scalePercent)
  }
  if (useEndRamp && (interval.rampEndPowerKind === 'watts' || (!interval.rampEndPowerKind && interval.powerKind === 'watts'))) {
    return scaleWatts(base, scalePercent)
  }
  return scaleWatts(base, scalePercent)
}

export function ftpPercentForInterval(
  interval: WorkoutInterval,
  profile: Profile,
): number | null {
  const watts = resolveWatts(interval, profile, 100, false)
  if (watts === null || profile.ftp === null || profile.ftp === 0) {
    if (interval.powerKind === 'ftp_percent') {
      return interval.powerValue
    }
    if (interval.powerKind === 'zone') {
      return profile.zoneTable[interval.powerValue] ?? DEFAULT_ZONE_TABLE[interval.powerValue] ?? null
    }
    if (interval.powerKind === 'rpe' && profile.ftp !== null) {
      return profile.rpeTable[interval.powerValue] ?? DEFAULT_RPE_TABLE[interval.powerValue] ?? null
    }
    return null
  }
  return (watts / profile.ftp) * 100
}

export function cadenceLock(
  low: number | null,
  high: number | null,
): number | null {
  if (low !== null && high !== null) {
    return Math.round((low + high) / 2)
  }
  if (low !== null) {
    return low
  }
  if (high !== null) {
    return high
  }
  return null
}

export function autoFillRpm(ftpPercent: number): number {
  if (ftpPercent < 60) {
    return 70
  }
  if (ftpPercent <= 87) {
    return 80
  }
  if (ftpPercent <= 104) {
    return 90
  }
  return 100
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateCadence(
  interval: WorkoutInterval,
  t: number,
): { low: number | null; high: number | null } {
  const startLow = interval.cadenceLow
  const startHigh = interval.cadenceHigh
  if (interval.shape !== 'ramp') {
    return { low: startLow, high: startHigh }
  }
  const endLow = interval.rampEndCadenceLow ?? startLow
  const endHigh = interval.rampEndCadenceHigh ?? startHigh
  const lockStart = cadenceLock(startLow, startHigh)
  const lockEnd = cadenceLock(endLow, endHigh)
  if (lockStart === null && lockEnd === null) {
    return { low: null, high: null }
  }
  if (lockStart !== null && lockEnd !== null) {
    const mid = Math.round(lerp(lockStart, lockEnd, t))
    return { low: mid, high: mid }
  }
  const single = lockStart ?? lockEnd
  return { low: single, high: single }
}

function cadenceAtTime(interval: WorkoutInterval, t: number): number | null {
  const { low, high } = interpolateCadence(interval, t)
  return cadenceLock(low, high)
}

export function splitRamp(
  interval: WorkoutInterval,
  profile: Profile,
  scalePercent = 100,
): RampPiece[] {
  const wStart = resolveWatts(interval, profile, scalePercent, false)
  const wEnd = resolveWatts(interval, profile, scalePercent, true)

  if (interval.shape !== 'ramp') {
    const w = wStart
    return [
      {
        durationSeconds: interval.durationSeconds,
        wattsStart: w,
        wattsEnd: w,
        cadenceLow: interval.cadenceLow,
        cadenceHigh: interval.cadenceHigh,
      },
    ]
  }

  const lockStart = cadenceAtTime(interval, 0)
  const lockEnd = cadenceAtTime(interval, 1)
  const cadenceSpan =
    lockStart !== null && lockEnd !== null
      ? Math.abs(lockEnd - lockStart)
      : 0

  if (cadenceSpan <= 5) {
    return [
      {
        durationSeconds: interval.durationSeconds,
        wattsStart: wStart,
        wattsEnd: wEnd,
        cadenceLow: interval.cadenceLow,
        cadenceHigh: interval.cadenceHigh,
      },
    ]
  }

  const total = interval.durationSeconds
  const pieces: RampPiece[] = []
  let pieceStartSec = 0
  let anchorCadence = lockStart ?? lockEnd ?? 80

  const pushPiece = (endSec: number) => {
    const duration = Math.max(1, endSec - pieceStartSec)
    const t0 = pieceStartSec / total
    const t1 = endSec / total
    pieces.push({
      durationSeconds: duration,
      wattsStart:
        wStart !== null && wEnd !== null
          ? Math.round(lerp(wStart, wEnd, t0))
          : wStart,
      wattsEnd:
        wStart !== null && wEnd !== null
          ? Math.round(lerp(wStart, wEnd, t1))
          : wEnd,
      cadenceLow: anchorCadence,
      cadenceHigh: anchorCadence,
    })
  }

  for (let sec = 1; sec <= total; sec++) {
    const t = sec / total
    const lock = cadenceAtTime(interval, t) ?? anchorCadence
    if (Math.abs(lock - anchorCadence) >= 5) {
      pushPiece(sec)
      pieceStartSec = sec
      anchorCadence = lock
    }
  }

  if (pieceStartSec < total) {
    pushPiece(total)
  }

  return pieces.length > 0
    ? pieces
    : [
        {
          durationSeconds: interval.durationSeconds,
          wattsStart: wStart,
          wattsEnd: wEnd,
          cadenceLow: interval.cadenceLow,
          cadenceHigh: interval.cadenceHigh,
        },
      ]
}

export function isHard(scaledWatts: number, ftp: number | null): boolean {
  if (ftp === null || ftp === 0) {
    return false
  }
  return scaledWatts >= 0.9 * ftp
}