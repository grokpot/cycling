import { describe, expect, it } from 'vitest'
import { planRide } from '../shared/planner'
import type { Profile, Song, Workout } from '../shared/types'

const profile: Profile = {
  id: 'p1',
  ftp: 200,
  preferredCadence: 80,
  zoneTable: { 1: 50, 2: 60, 3: 75, 4: 90, 5: 105, 6: 120, 7: 150 },
  rpeTable: { 1: 40, 2: 50, 3: 60, 4: 70, 5: 80, 6: 90, 7: 100, 8: 110, 9: 120, 10: 140 },
  genres: [],
}

function song(id: string, bpm: number, energy = 0.5): Song {
  return {
    id,
    name: id,
    source: 'folder',
    durationSeconds: 200,
    banned: false,
    genres: [],
    energy,
    analysis: {
      bpm,
      beatGrid: [],
      downbeats: [],
      phrases: [],
      energy,
      key: null,
    },
  }
}

describe('planRide', () => {
  it('keeps a song across two short pieces at same cadence', () => {
    const workout: Workout = {
      id: 'w1',
      name: 'Repeats',
      source: 'builder',
      createdAt: new Date().toISOString(),
      intervals: [
        {
          id: 'a',
          position: 0,
          durationSeconds: 25,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 90,
          cadenceHigh: 90,
          shape: 'steady',
        },
        {
          id: 'b',
          position: 1,
          durationSeconds: 25,
          powerKind: 'ftp_percent',
          powerValue: 70,
          cadenceLow: 90,
          cadenceHigh: 90,
          shape: 'steady',
        },
      ],
    }
    const songs = [song('s1', 89), song('s2', 130)]
    const { cues, gaps } = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: true,
    })
    expect(gaps.filter((g) => g.reason === 'no_song')).toHaveLength(0)
    expect(cues.length).toBe(2)
    expect(cues[0].songId).toBeTruthy()
    expect(cues[1].songId).toBe(cues[0].songId)
  })

  it('gaps when nothing matches within 8%', () => {
    const workout: Workout = {
      id: 'w2',
      name: 'Hard lock',
      source: 'builder',
      createdAt: new Date().toISOString(),
      intervals: [
        {
          id: 'c',
          position: 0,
          durationSeconds: 120,
          powerKind: 'watts',
          powerValue: 150,
          cadenceLow: 55,
          cadenceHigh: 55,
          shape: 'steady',
        },
      ],
    }
    const songs = [song('slow', 72), song('fast', 140)]
    const { gaps } = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: false,
    })
    expect(gaps.some((g) => g.reason === 'no_song')).toBe(true)
  })

  it('silence clears a gap even when cadence is already set', () => {
    const workout: Workout = {
      id: 'w3',
      name: 'Silent',
      source: 'builder',
      createdAt: new Date().toISOString(),
      intervals: [
        {
          id: 'c',
          position: 0,
          durationSeconds: 120,
          powerKind: 'watts',
          powerValue: 150,
          cadenceLow: 80,
          cadenceHigh: 80,
          shape: 'steady',
        },
      ],
    }
    const { cues, gaps } = planRide(workout, profile, [], {
      intensityScale: 100,
      dropsEnabled: true,
      resolutions: { 0: 'silence' },
    })
    expect(gaps).toHaveLength(0)
    expect(cues[0]?.silence).toBe(true)
  })
})