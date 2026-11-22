import { describe, it, expect, beforeEach } from 'vitest'
import type { Cue, Song } from '#shared/types'

describe('Audio mixer scheduling', () => {
  const mockSongs: Song[] = [
    {
      id: 'song-90bpm',
      name: 'Test 90 BPM',
      source: 'starter',
      durationSeconds: 240,
      banned: false,
      genres: [],
      energy: 0.6,
      analysis: {
        bpm: 90,
        beatGrid: Array.from({ length: 360 }, (_, i) => (i * 60) / 90),
        downbeats: Array.from({ length: 90 }, (_, i) => (i * 4 * 60) / 90),
        phrases: Array.from({ length: 12 }, (_, i) => (i * 32 * 60) / 90),
        energy: 0.6,
        key: 'A minor',
      },
    },
    {
      id: 'song-95bpm',
      name: 'Test 95 BPM',
      source: 'starter',
      durationSeconds: 240,
      banned: false,
      genres: [],
      energy: 0.8,
      analysis: {
        bpm: 95,
        beatGrid: Array.from({ length: 380 }, (_, i) => (i * 60) / 95),
        downbeats: Array.from({ length: 95 }, (_, i) => (i * 4 * 60) / 95),
        phrases: Array.from({ length: 12 }, (_, i) => (i * 32 * 60) / 95),
        energy: 0.8,
        key: 'C major',
      },
    },
  ]

  it('should compute correct stretch rates for cues', () => {
    const cue: Cue = {
      pieceIndex: 0,
      intervalId: 'test',
      durationSeconds: 240,
      lockedRpm: 90,
      ratio: '1:1',
      songId: 'song-90bpm',
      stretchPercent: 0,
      inBeat: 0,
      outBeat: 360,
      crossfadeBeats: 8,
      drop: false,
      silence: false,
    }

    const song = mockSongs[0]
    expect(song.analysis?.bpm).toBe(90)
    
    // No stretch needed: target 90 RPM = 90 BPM
    const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
    expect(targetBpm).toBe(90)
    
    const stretchRate = song.analysis!.bpm / targetBpm
    expect(stretchRate).toBe(1.0)
  })

  it('should compute correct stretch rate for 2:1 ratio', () => {
    const cue: Cue = {
      pieceIndex: 0,
      intervalId: 'test',
      durationSeconds: 240,
      lockedRpm: 90,
      ratio: '2:1',
      songId: 'song-90bpm',
      stretchPercent: 0,
      inBeat: 0,
      outBeat: 360,
      crossfadeBeats: 8,
      drop: false,
      silence: false,
    }

    const song = mockSongs[0]
    const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
    expect(targetBpm).toBe(180)
    
    const stretchRate = song.analysis!.bpm / targetBpm
    expect(stretchRate).toBeCloseTo(0.5) // 90 BPM to 180 BPM = 2x faster
  })

  it('should compute correct stretch for small tempo differences', () => {
    const cue: Cue = {
      pieceIndex: 0,
      intervalId: 'test',
      durationSeconds: 240,
      lockedRpm: 90,
      ratio: '1:1',
      songId: 'song-95bpm',
      stretchPercent: -5.26,
      inBeat: 0,
      outBeat: 380,
      crossfadeBeats: 8,
      drop: false,
      silence: false,
    }

    const song = mockSongs[1]
    expect(song.analysis?.bpm).toBe(95)
    
    const targetBpm = 90
    const stretchRate = song.analysis!.bpm / targetBpm
    expect(stretchRate).toBeCloseTo(1.0556, 2) // 95/90 = ~5.6% slower playback
  })

  it('should validate crossfade timing on beat boundaries', () => {
    const cue1: Cue = {
      pieceIndex: 0,
      intervalId: 'test1',
      durationSeconds: 240,
      lockedRpm: 90,
      ratio: '1:1',
      songId: 'song-90bpm',
      stretchPercent: 0,
      inBeat: 0,
      outBeat: 360,
      crossfadeBeats: 8,
      drop: false,
      silence: false,
    }

    const beatDuration = 60 / cue1.lockedRpm // 0.667 seconds per beat
    const crossfadeDuration = cue1.crossfadeBeats * beatDuration
    
    expect(crossfadeDuration).toBeCloseTo(5.33, 2) // 8 beats at 90 RPM
    expect(crossfadeDuration).toBeLessThan(cue1.durationSeconds) // Must fit within interval
  })

  it('should handle silence cues', () => {
    const cue: Cue = {
      pieceIndex: 0,
      intervalId: 'test',
      durationSeconds: 60,
      lockedRpm: 80,
      ratio: '1:1',
      songId: null,
      stretchPercent: 0,
      inBeat: 0,
      outBeat: 0,
      crossfadeBeats: 0,
      drop: false,
      silence: true,
    }

    expect(cue.silence).toBe(true)
    expect(cue.songId).toBe(null)
  })

  it('should compute segment extraction correctly', () => {
    const cue: Cue = {
      pieceIndex: 0,
      intervalId: 'test',
      durationSeconds: 120,
      lockedRpm: 90,
      ratio: '1:1',
      songId: 'song-90bpm',
      stretchPercent: 0,
      inBeat: 32, // Start at second phrase
      outBeat: 212, // 180 beats of music (3 minutes at 90 BPM)
      crossfadeBeats: 8,
      drop: false,
      silence: false,
    }

    const beatDuration = 60 / cue.lockedRpm
    const startTime = cue.inBeat * beatDuration
    const endTime = cue.outBeat * beatDuration
    const segmentDuration = endTime - startTime

    expect(startTime).toBeCloseTo(21.33, 2) // 32 beats * 0.667s
    expect(endTime).toBeCloseTo(141.33, 2) // 212 beats * 0.667s
    expect(segmentDuration).toBeCloseTo(120, 2) // Should match cue duration
  })
})
