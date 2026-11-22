import { describe, expect, it } from 'vitest'
import type { Profile, WorkoutInterval } from '../shared/types'
import {
  autoFillRpm,
  cadenceLock,
  isHard,
  resolveWatts,
  scaleWatts,
  splitRamp,
} from '../shared/targets'

const baseProfile: Profile = {
  id: 'p1',
  ftp: 200,
  preferredCadence: 80,
  zoneTable: { 4: 90 },
  rpeTable: { 8: 110 },
  genres: [],
}

describe('scaleWatts', () => {
  it('clamps scale and scales watts', () => {
    expect(scaleWatts(100, 100)).toBe(100)
    expect(scaleWatts(100, 70)).toBe(70)
    expect(scaleWatts(100, 130)).toBe(120)
    expect(scaleWatts(100, 75)).toBe(75)
  })
})

describe('resolveWatts', () => {
  const steady: WorkoutInterval = {
    id: 'i1',
    position: 0,
    durationSeconds: 60,
    powerKind: 'ftp_percent',
    powerValue: 90,
    cadenceLow: 90,
    cadenceHigh: 90,
    shape: 'steady',
  }

  it('returns null for ftp_percent without ftp', () => {
    const p = { ...baseProfile, ftp: null }
    expect(resolveWatts(steady, p)).toBeNull()
  })

  it('resolves ftp percent with scale', () => {
    expect(resolveWatts(steady, baseProfile, 100)).toBe(180)
    expect(resolveWatts(steady, baseProfile, 110)).toBe(198)
  })

  it('RPE without FTP returns null', () => {
    const rpe: WorkoutInterval = { ...steady, powerKind: 'rpe', powerValue: 8 }
    expect(resolveWatts(rpe, { ...baseProfile, ftp: null })).toBeNull()
  })
})

describe('autoFillRpm', () => {
  it('uses ftp bands', () => {
    expect(autoFillRpm(55)).toBe(70)
    expect(autoFillRpm(70)).toBe(80)
    expect(autoFillRpm(95)).toBe(90)
    expect(autoFillRpm(110)).toBe(100)
  })
})

describe('cadenceLock', () => {
  it('midpoints ranges', () => {
    expect(cadenceLock(85, 95)).toBe(90)
    expect(cadenceLock(80, null)).toBe(80)
    expect(cadenceLock(null, null)).toBeNull()
  })
})

describe('splitRamp', () => {
  it('splits when cadence moves more than 5 RPM', () => {
    const ramp: WorkoutInterval = {
      id: 'r1',
      position: 0,
      durationSeconds: 60,
      powerKind: 'ftp_percent',
      powerValue: 50,
      cadenceLow: 70,
      cadenceHigh: 70,
      shape: 'ramp',
      rampEndPowerKind: 'ftp_percent',
      rampEndPowerValue: 90,
      rampEndCadenceLow: 100,
      rampEndCadenceHigh: 100,
    }
    const parts = splitRamp(ramp, baseProfile)
    expect(parts.length).toBeGreaterThan(1)
  })
})

describe('isHard', () => {
  it('flags 90% ftp', () => {
    expect(isHard(180, 200)).toBe(true)
    expect(isHard(170, 200)).toBe(false)
    expect(isHard(180, null)).toBe(false)
  })
})