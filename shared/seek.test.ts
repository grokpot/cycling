/** Tests for seek utilities */

import { describe, it, expect } from 'vitest'
import { seekToTime, clickPositionToTime, formatSeekTime } from './seek'
import type { Workout, Plan } from './types'

describe('formatSeekTime', () => {
  it('formats zero', () => {
    expect(formatSeekTime(0)).toBe('0:00')
  })

  it('formats seconds', () => {
    expect(formatSeekTime(45000)).toBe('0:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatSeekTime(876000)).toBe('14:36')
  })

  it('formats hours', () => {
    expect(formatSeekTime(3661000)).toBe('61:01')
  })
})

describe('clickPositionToTime', () => {
  it('converts start position', () => {
    const ms = clickPositionToTime(8, 360, 8, 1800000)
    expect(ms).toBe(0)
  })

  it('converts middle position', () => {
    const ms = clickPositionToTime(184, 360, 8, 1800000)
    expect(ms).toBeCloseTo(920930, -2)
  })

  it('converts end position', () => {
    const ms = clickPositionToTime(352, 360, 8, 1800000)
    expect(ms).toBeCloseTo(1800000, -2)
  })

  it('clamps before padding', () => {
    const ms = clickPositionToTime(0, 360, 8, 1800000)
    expect(ms).toBe(0)
  })

  it('clamps after padding', () => {
    const ms = clickPositionToTime(400, 360, 8, 1800000)
    expect(ms).toBe(1800000)
  })
})

describe('seekToTime', () => {
  const workout: Workout = {
    id: 'test',
    name: 'Test',
    source: 'builder',
    createdAt: '2026-01-01',
    intervals: [
      {
        id: 'warmup',
        position: 0,
        durationSeconds: 300,
        powerKind: 'watts',
        powerValue: 100,
        cadenceLow: 70,
        cadenceHigh: 70,
        shape: 'steady',
      },
      {
        id: 'work',
        position: 1,
        durationSeconds: 600,
        powerKind: 'watts',
        powerValue: 200,
        cadenceLow: 90,
        cadenceHigh: 90,
        shape: 'steady',
      },
      {
        id: 'cooldown',
        position: 2,
        durationSeconds: 300,
        powerKind: 'watts',
        powerValue: 80,
        cadenceLow: 70,
        cadenceHigh: 70,
        shape: 'steady',
      },
    ],
  }

  const plan: Plan = {
    id: 'plan',
    workoutId: 'test',
    intensityScale: 100,
    dropsEnabled: true,
    fanMode: 'hr',
    cues: [
      {
        pieceIndex: 0,
        intervalId: 'warmup',
        durationSeconds: 300,
        lockedRpm: 70,
        ratio: '1:1',
        songId: 'song1',
        stretchPercent: 100,
        inBeat: 0,
        outBeat: 350,
        crossfadeBeats: 4,
        drop: false,
        silence: false,
      },
      {
        pieceIndex: 1,
        intervalId: 'work',
        durationSeconds: 600,
        lockedRpm: 90,
        ratio: '1:1',
        songId: 'song2',
        stretchPercent: 100,
        inBeat: 0,
        outBeat: 540,
        crossfadeBeats: 4,
        drop: true,
        silence: false,
      },
      {
        pieceIndex: 2,
        intervalId: 'cooldown',
        durationSeconds: 300,
        lockedRpm: 70,
        ratio: '1:1',
        songId: 'song1',
        stretchPercent: 100,
        inBeat: 0,
        outBeat: 350,
        crossfadeBeats: 4,
        drop: false,
        silence: false,
      },
    ],
    gaps: [],
  }

  it('seeks to start', () => {
    const result = seekToTime(0, workout, plan)
    expect(result).toMatchObject({
      elapsedMs: 0,
      intervalIndex: 0,
      intervalId: 'warmup',
      pieceIndex: 0,
      cueOffsetMs: 0,
    })
    expect(result?.cue?.songId).toBe('song1')
  })

  it('seeks to middle of first interval', () => {
    const result = seekToTime(150000, workout, plan)
    expect(result).toMatchObject({
      elapsedMs: 150000,
      intervalIndex: 0,
      intervalId: 'warmup',
      pieceIndex: 0,
    })
    expect(result?.cueOffsetMs).toBe(150000)
  })

  it('seeks to second interval', () => {
    const result = seekToTime(300000, workout, plan)
    expect(result).toMatchObject({
      elapsedMs: 300000,
      intervalIndex: 1,
      intervalId: 'work',
      pieceIndex: 1,
    })
    expect(result?.cue?.songId).toBe('song2')
  })

  it('seeks to middle of second interval', () => {
    const result = seekToTime(600000, workout, plan)
    expect(result).toMatchObject({
      elapsedMs: 600000,
      intervalIndex: 1,
      intervalId: 'work',
      pieceIndex: 1,
    })
    expect(result?.cueOffsetMs).toBe(300000)
  })

  it('seeks to cooldown', () => {
    const result = seekToTime(900000, workout, plan)
    expect(result).toMatchObject({
      elapsedMs: 900000,
      intervalIndex: 2,
      intervalId: 'cooldown',
      pieceIndex: 2,
    })
  })

  it('returns null for negative time', () => {
    const result = seekToTime(-1000, workout, plan)
    expect(result).toBeNull()
  })

  it('returns null for time beyond workout', () => {
    const result = seekToTime(2000000, workout, plan)
    expect(result).toBeNull()
  })
})
