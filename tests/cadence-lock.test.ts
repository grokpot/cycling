/** Test that target cadence stays constant for the duration of a song. */

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
]

describe('cadence lock per song', () => {
  test('cadence changes force new songs', () => {
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
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(2)
    expect(result.cues[0].songId).toBe('song-80')
    expect(result.cues[0].lockedRpm).toBe(80)
    expect(result.cues[1].songId).toBe('song-90')
    expect(result.cues[1].lockedRpm).toBe(90)
  })

  test('short pieces with same cadence reuse song', () => {
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
        },
        {
          id: 'i2',
          position: 1,
          durationSeconds: 20,
          powerKind: 'ftp_percent',
          powerValue: 95,
          cadenceLow: 80,
          cadenceHigh: 80,
          shape: 'steady',
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(2)
    expect(result.cues[0].songId).toBe('song-80')
    expect(result.cues[1].songId).toBe('song-80')
    expect(result.cues[0].lockedRpm).toBe(80)
    expect(result.cues[1].lockedRpm).toBe(80)
  })

  test('short pieces with different cadence get new song', () => {
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
        },
        {
          id: 'i2',
          position: 1,
          durationSeconds: 20,
          powerKind: 'ftp_percent',
          powerValue: 95,
          cadenceLow: 90,
          cadenceHigh: 90,
          shape: 'steady',
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(2)
    expect(result.cues[0].songId).toBe('song-80')
    expect(result.cues[0].lockedRpm).toBe(80)
    expect(result.cues[1].songId).toBe('song-90')
    expect(result.cues[1].lockedRpm).toBe(90)
  })

  test('missing cadence uses preferred cadence', () => {
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
          cadenceLow: null,
          cadenceHigh: null,
          shape: 'steady',
        },
      ],
    }

    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })

    expect(result.cues).toHaveLength(1)
    expect(result.cues[0].songId).toBe('song-80')
    expect(result.cues[0].lockedRpm).toBe(80)
  })
})
