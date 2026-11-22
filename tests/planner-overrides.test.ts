/** Test that planner honors song overrides set on intervals. */

import { describe, expect, test } from 'vitest'
import { planRide } from '../shared/planner'
import type { Profile, Song, Workout } from '../shared/types'

const profile: Profile = {
  id: 'test',
  ftp: 250,
  preferredCadence: 80,
  zoneTable: {},
  rpeTable: {},
  genres: [],
}

const songs: Song[] = [
  {
    id: 'song-80',
    name: '80 BPM',
    source: 'starter',
    durationSeconds: 300,
    banned: false,
    genres: [],
    energy: 0.5,
    analysis: {
      bpm: 80,
      beatGrid: [],
      downbeats: [],
      phrases: [],
      energy: 0.5,
      key: null,
    },
  },
  {
    id: 'song-90',
    name: '90 BPM',
    source: 'starter',
    durationSeconds: 300,
    banned: false,
    genres: [],
    energy: 0.5,
    analysis: {
      bpm: 90,
      beatGrid: [],
      downbeats: [],
      phrases: [],
      energy: 0.5,
      key: null,
    },
  },
  {
    id: 'song-100',
    name: '100 BPM',
    source: 'starter',
    durationSeconds: 300,
    banned: false,
    genres: [],
    energy: 0.5,
    analysis: {
      bpm: 100,
      beatGrid: [],
      downbeats: [],
      phrases: [],
      energy: 0.5,
      key: null,
    },
  },
]

describe('planner song overrides', () => {
  test('honors songOverride on interval', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test',
      source: 'builder',
      createdAt: '',
      intervals: [
        {
          id: 'i1',
          position: 0,
          durationSeconds: 180,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 80,
          cadenceHigh: 80,
          shape: 'steady',
          songOverride: 'song-100', // Override to song-100 instead of auto-picked song-80
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].songId).toBe('song-100')
    expect(result.cues[0].lockedRpm).toBe(80)
  })

  test('uses auto-picked song when no override', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test',
      source: 'builder',
      createdAt: '',
      intervals: [
        {
          id: 'i1',
          position: 0,
          durationSeconds: 180,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 80,
          cadenceHigh: 80,
          shape: 'steady',
          // No songOverride
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].songId).toBe('song-80') // Auto-picked closest BPM
    expect(result.cues[0].lockedRpm).toBe(80)
  })

  test('ignores override if song not in library', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test',
      source: 'builder',
      createdAt: '',
      intervals: [
        {
          id: 'i1',
          position: 0,
          durationSeconds: 180,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 80,
          cadenceHigh: 80,
          shape: 'steady',
          songOverride: 'nonexistent-song',
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].songId).toBe('song-80') // Falls back to auto-pick
  })

  test('ignores override if song BPM too far from target', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test',
      source: 'builder',
      createdAt: '',
      intervals: [
        {
          id: 'i1',
          position: 0,
          durationSeconds: 180,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 60,
          cadenceHigh: 60,
          shape: 'steady',
          songOverride: 'song-100', // 100 BPM is too far from 60 RPM
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(1)
    // Falls back to auto-pick or creates a gap
    if (result.cues[0].songId) {
      expect(result.cues[0].songId).not.toBe('song-100')
    }
  })

  test('overrides apply to multiple intervals independently', () => {
    const workout: Workout = {
      id: 'test',
      name: 'Test',
      source: 'builder',
      createdAt: '',
      intervals: [
        {
          id: 'i1',
          position: 0,
          durationSeconds: 180,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 80,
          cadenceHigh: 80,
          shape: 'steady',
          songOverride: 'song-100',
        },
        {
          id: 'i2',
          position: 1,
          durationSeconds: 180,
          powerKind: 'ftp_percent',
          powerValue: 80,
          cadenceLow: 90,
          cadenceHigh: 90,
          shape: 'steady',
          songOverride: 'song-80',
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(2)
    expect(result.cues[0].songId).toBe('song-100')
    expect(result.cues[1].songId).toBe('song-80')
  })
})
