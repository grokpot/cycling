/** Advisory checks for a workout. These never block the start of a ride. */

import type { Profile, Workout, WorkoutInterval } from './types'
import { formatDuration } from './format'
import { cadenceLock, resolveWatts } from './targets'

export type WarningTone = 'unrealistic' | 'caution'

export interface PlanWarning {
  tone: WarningTone
  title: string
  detail: string
}

const DROP_POINTS = 30
const RISE_POINTS = 25
const HARD_PERCENT = 90
const CADENCE_JUMP = 15
const SHORT_RECOVERY_SEC = 90

function effortPercent(
  interval: WorkoutInterval,
  profile: Profile,
  atEnd: boolean,
): number | null {
  const ramp = atEnd && interval.shape === 'ramp'
  const kind = ramp
    ? (interval.rampEndPowerKind ?? interval.powerKind)
    : interval.powerKind
  const value = ramp
    ? (interval.rampEndPowerValue ?? interval.powerValue)
    : interval.powerValue

  if (kind === 'ftp_percent') {
    return value
  }
  if (kind === 'zone') {
    const pct = profile.zoneTable[value]
    return pct === undefined ? null : pct
  }
  if (kind === 'rpe') {
    if (profile.ftp === null) {
      return null
    }
    const pct = profile.rpeTable[value]
    return pct === undefined ? null : pct
  }

  const watts = resolveWatts(interval, profile, 100, atEnd)
  if (watts === null || profile.ftp === null || profile.ftp === 0) {
    return null
  }
  return (watts / profile.ftp) * 100
}

function boundaryCadence(
  interval: WorkoutInterval,
  atEnd: boolean,
): number | null {
  if (atEnd && interval.shape === 'ramp') {
    return cadenceLock(
      interval.rampEndCadenceLow ?? interval.cadenceLow,
      interval.rampEndCadenceHigh ?? interval.cadenceHigh,
    )
  }
  return cadenceLock(interval.cadenceLow, interval.cadenceHigh)
}

function round(value: number): number {
  return Math.round(value)
}

export function planWarnings(
  workout: Workout,
  profile: Profile,
): PlanWarning[] {
  const steps = [...workout.intervals].sort((a, b) => a.position - b.position)
  const warnings: PlanWarning[] = []

  for (let i = 0; i < steps.length - 1; i++) {
    const prev = steps[i]!
    const next = steps[i + 1]!
    const from = effortPercent(prev, profile, true)
    const to = effortPercent(next, profile, false)
    const fromRpm = boundaryCadence(prev, true)
    const toRpm = boundaryCadence(next, false)

    if (from !== null && to !== null && from - to >= DROP_POINTS) {
      const settle =
        next.durationSeconds < SHORT_RECOVERY_SEC
          ? ` The next piece is only ${formatDuration(next.durationSeconds)}, which is shorter than heart rate needs to come down.`
          : ' Heart rate will still be up.'
      warnings.push({
        tone: 'unrealistic',
        title: 'This recovery is instant',
        detail: `Effort drops sharply from hard to easy in one step.${settle} A ramp down over a minute or two is easier to settle into.`,
      })
    } else if (from === null || to === null) {
      const wFrom = resolveWatts(prev, profile, 100, true)
      const wTo = resolveWatts(next, profile, 100, false)
      if (
        wFrom !== null &&
        wTo !== null &&
        wFrom - wTo >= 40 &&
        (wFrom - wTo) / wFrom >= 0.35
      ) {
        warnings.push({
          tone: 'unrealistic',
          title: 'This recovery is instant',
          detail: `Power drops sharply in one step. Heart rate will not fall that fast. A short ramp down is easier to hit.`,
        })
      }
    }

    if (
      from !== null &&
      to !== null &&
      to - from >= RISE_POINTS &&
      to >= HARD_PERCENT
    ) {
      warnings.push({
        tone: 'caution',
        title: 'This one gets hard all at once',
        detail: `Effort jumps from steady to hard in one step. A short ramp gives the trainer and your legs time to meet the target.`,
      })
    }

    if (
      fromRpm !== null &&
      toRpm !== null &&
      Math.abs(toRpm - fromRpm) > CADENCE_JUMP
    ) {
      const delta = Math.abs(toRpm - fromRpm)
      warnings.push({
        tone: 'caution',
        title: `Cadence jumps ${delta} RPM`,
        detail: `Step ${i + 2} asks for ${toRpm} RPM right after ${fromRpm} RPM. The song changes with it. A ramp keeps the beat change gradual.`,
      })
    }
  }

  return warnings
}
