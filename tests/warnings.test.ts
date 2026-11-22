import { describe, expect, it } from 'vitest'
import type { Profile, Workout, WorkoutInterval } from '../shared/types'
import { planWarnings } from '../shared/warnings'
import { formatCadence, formatDuration, formatPower } from '../shared/format'

const profile: Profile = {
  id: 'p',
  ftp: 250,
  preferredCadence: 80,
  zoneTable: { 2: 60, 4: 90 },
  rpeTable: { 5: 80 },
  genres: [],
}

function step(
  position: number,
  power: number,
  extra: Partial<WorkoutInterval> = {},
): WorkoutInterval {
  return {
    id: `i${position}`,
    position,
    durationSeconds: 300,
    powerKind: 'ftp_percent',
    powerValue: power,
    cadenceLow: 80,
    cadenceHigh: 80,
    shape: 'steady',
    ...extra,
  }
}

function workout(intervals: WorkoutInterval[]): Workout {
  return {
    id: 'w',
    name: 'Test',
    source: 'builder',
    createdAt: '2026-11-20T00:00:00.000Z',
    intervals,
  }
}

describe('planWarnings', () => {
  it('flags an instant drop from threshold to recovery', () => {
    const notes = planWarnings(
      workout([step(0, 100), step(1, 50, { durationSeconds: 45 })]),
      profile,
    )
    expect(notes.some((n) => n.tone === 'unrealistic')).toBe(true)
    expect(notes[0]?.detail).toContain('0:45')
  })

  it('stays quiet when a ramp bridges the same drop', () => {
    const notes = planWarnings(
      workout([
        step(0, 100),
        step(1, 100, {
          shape: 'ramp',
          rampEndPowerKind: 'ftp_percent',
          rampEndPowerValue: 50,
        }),
      ]),
      profile,
    )
    expect(notes.filter((n) => n.tone === 'unrealistic')).toHaveLength(0)
  })

  it('cautions when a steady step jumps straight into a hard effort', () => {
    const notes = planWarnings(workout([step(0, 60), step(1, 100)]), profile)
    expect(notes.map((n) => n.title)).toContain('This one gets hard all at once')
  })

  it('ignores a small cadence change and flags a large one', () => {
    const quiet = planWarnings(
      workout([
        step(0, 70, { cadenceLow: 80, cadenceHigh: 80 }),
        step(1, 75, { cadenceLow: 88, cadenceHigh: 88 }),
      ]),
      profile,
    )
    expect(quiet.filter((n) => n.title.startsWith('Cadence'))).toHaveLength(0)

    const loud = planWarnings(
      workout([
        step(0, 70, { cadenceLow: 70, cadenceHigh: 70 }),
        step(1, 75, { cadenceLow: 95, cadenceHigh: 95 }),
      ]),
      profile,
    )
    expect(loud.some((n) => n.title === 'Cadence jumps 25 RPM')).toBe(true)
  })
})

describe('format', () => {
  it('speaks in durations, power, and cadence', () => {
    expect(formatDuration(300)).toBe('5:00')
    expect(formatDuration(45)).toBe('0:45')
    expect(formatPower('ftp_percent', 70)).toBe('70% FTP')
    expect(formatPower('watts', 180)).toBe('180 W')
    expect(formatCadence(null, null)).toBe('No cadence')
    expect(formatCadence(85, 95)).toBe('85–95 RPM')
  })
})