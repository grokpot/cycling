/** Test that workouts with library songs produce non-empty plans */
import { describe, test, expect } from 'vitest'
import { planRide } from '#shared/planner'
import type { Profile, Song, Workout } from '#shared/types'

describe('Music planning', () => {
  const profile: Profile = {
    id: 'test',
    ftp: 200,
    zones: []
  }

  const songs: Song[] = [
    {
      id: 'song-90bpm',
      name: 'Song 90 BPM',
      source: 'folder',
      durationSeconds: 240,
      banned: false,
      genres: [],
      energy: 0.6,
      analysis: {
        bpm: 90,
        durationSeconds: 240,
        energy: 0.6,
        pitch: 440
      }
    },
    {
      id: 'song-120bpm',
      name: 'Song 120 BPM',
      source: 'folder',
      durationSeconds: 240,
      banned: false,
      genres: [],
      energy: 0.8,
      analysis: {
        bpm: 120,
        durationSeconds: 240,
        energy: 0.8,
        pitch: 440
      }
    }
  ]

  const workout: Workout = {
    id: 'test-workout',
    name: 'Test',
    source: 'builder',
    createdAt: new Date().toISOString(),
    intervals: [
      {
        id: '1',
        position: 0,
        durationSeconds: 300,
        powerKind: 'ftp_percent',
        powerValue: 70,
        cadenceLow: 85,
        cadenceHigh: 85,
        shape: 'steady'
      },
      {
        id: '2',
        position: 1,
        durationSeconds: 300,
        powerKind: 'ftp_percent',
        powerValue: 90,
        cadenceLow: 90,
        cadenceHigh: 90,
        shape: 'steady'
      }
    ]
  }

  test('produces non-empty plan when songs are available', () => {
    const result = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: true,
      bannedSongIds: []
    })

    expect(result.cues.length).toBeGreaterThan(0)
    expect(result.cues.some(cue => cue.songId)).toBe(true)
  })

  test('filters out banned songs', () => {
    const bannedSongs: Song[] = songs.map(s => ({ ...s, banned: true }))

    const result = planRide(workout, profile, bannedSongs, {
      intensityScale: 100,
      dropsEnabled: true,
      bannedSongIds: bannedSongs.map(s => s.id)
    })

    // Should have cues but all silence/no matching songs
    expect(result.cues.length).toBeGreaterThan(0)
    expect(result.cues.every(cue => cue.silence || !cue.songId)).toBe(true)
  })
})
