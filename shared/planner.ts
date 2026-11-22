/** Plan music cues for a workout from profile and song library. */

import type {
  Cue,
  PlanGap,
  PlanRideOptions,
  Profile,
  Song,
  Workout,
  WorkoutInterval,
} from './types'
import {
  cadenceLock,
  ftpPercentForInterval,
  isHard,
  resolveWatts,
  splitRamp,
} from './targets'

const STRETCH_GATE = 8
const STRETCH_WIDE = 16
const SHORT_PIECE_SEC = 30

interface Piece {
  pieceIndex: number
  intervalId: string
  durationSeconds: number
  lockedRpm: number | null
  scaledWatts: number | null
  ftpPercent: number | null
  interval: WorkoutInterval
}

function buildPieces(
  workout: Workout,
  profile: Profile,
  options: PlanRideOptions,
): { pieces: Piece[]; gaps: PlanGap[] } {
  const pieces: Piece[] = []
  const gaps: PlanGap[] = []
  let pieceIndex = 0

  const sorted = [...workout.intervals].sort(
    (a, b) => a.position - b.position,
  )

  for (const interval of sorted) {
    const rampParts = splitRamp(interval, profile, options.intensityScale)
    for (const part of rampParts) {
      const subInterval: WorkoutInterval = {
        ...interval,
        durationSeconds: part.durationSeconds,
        cadenceLow: part.cadenceLow,
        cadenceHigh: part.cadenceHigh,
        shape: 'steady',
      }
      let locked = cadenceLock(part.cadenceLow, part.cadenceHigh)
      const override = options.filledCadence?.[interval.id]
      if (locked === null && override !== undefined) {
        locked = override
      }
      const scaledWatts =
        part.wattsEnd !== null
          ? part.wattsEnd
          : resolveWatts(subInterval, profile, options.intensityScale)
      const ftpPercent = ftpPercentForInterval(subInterval, profile)

      if (locked === null) {
        gaps.push({
          pieceIndex,
          intervalId: interval.id,
          durationSeconds: part.durationSeconds,
          reason: 'missing_cadence',
        })
      }

      pieces.push({
        pieceIndex: pieceIndex++,
        intervalId: interval.id,
        durationSeconds: part.durationSeconds,
        lockedRpm: locked,
        scaledWatts,
        ftpPercent,
        interval: subInterval,
      })
    }
  }

  return { pieces, gaps }
}

interface SongPick {
  song: Song
  ratio: '1:1' | '2:1'
  stretchPercent: number
  targetBpm: number
}

function stretchForSong(songBpm: number, targetBpm: number): number {
  return (songBpm / targetBpm - 1) * 100
}

function pickSong(
  songs: Song[],
  profile: Profile,
  lockedRpm: number,
  gate: number,
  banned: Set<string>,
  ftpPercent: number | null,
  preferHighEnergy: boolean,
  ratioBias: '1:1' | '2:1' | 'alternate',
  pieceIndex: number,
): SongPick | null {
  const candidates: SongPick[] = []

  for (const song of songs) {
    if (banned.has(song.id) || song.banned) {
      continue
    }
    if (!song.analysis?.bpm) {
      continue
    }
    if (
      profile.genres.length > 0 &&
      song.genres.length > 0 &&
      !song.genres.some((g) => profile.genres.includes(g))
    ) {
      continue
    }

    const targets: Array<{ ratio: '1:1' | '2:1'; bpm: number }> = [
      { ratio: '1:1', bpm: lockedRpm },
      { ratio: '2:1', bpm: lockedRpm * 2 },
    ]

    for (const t of targets) {
      const stretch = stretchForSong(song.analysis.bpm, t.bpm)
      if (Math.abs(stretch) <= gate) {
        candidates.push({
          song,
          ratio: t.ratio,
          stretchPercent: stretch,
          targetBpm: t.bpm,
        })
      }
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => {
    const sa = Math.abs(a.stretchPercent)
    const sb = Math.abs(b.stretchPercent)
    if (sa !== sb) {
      return sa - sb
    }
    if (preferHighEnergy && a.song.energy !== b.song.energy) {
      return b.song.energy - a.song.energy
    }
    return 0
  })

  const bestStretch = Math.abs(candidates[0].stretchPercent)
  const close = candidates.filter(
    (c) => Math.abs(Math.abs(c.stretchPercent) - bestStretch) <= 2,
  )

  if (close.length > 1) {
    if (ratioBias === 'alternate') {
      const prefer21 = pieceIndex % 2 === 1
      const hit = close.find((c) => c.ratio === (prefer21 ? '2:1' : '1:1'))
      if (hit) {
        return hit
      }
    }
    return close[0]
  }

  return candidates[0]
}

function crossfadeBeatsForPiece(durationSeconds: number): number {
  if (durationSeconds < 60) {
    return 4
  }
  if (durationSeconds < 180) {
    return 8
  }
  return 16
}

export function planRide(
  workout: Workout,
  profile: Profile,
  songs: Song[],
  options: PlanRideOptions,
): { cues: Cue[]; gaps: PlanGap[] } {
  const { pieces, gaps: cadenceGaps } = buildPieces(workout, profile, options)
  const gaps: PlanGap[] = [...cadenceGaps]
  const cues: Cue[] = []
  const banned = new Set(options.bannedSongIds ?? [])

  let lastSongId: string | null = null
  let lastLockedRpm: number | null = null
  const usedOnLongPieces = new Set<string>()
  let ratioAlternate = 0

  for (const piece of pieces) {
    const resolution = options.resolutions?.[piece.pieceIndex]

    if (resolution === 'silence') {
      cues.push({
        pieceIndex: piece.pieceIndex,
        intervalId: piece.intervalId,
        durationSeconds: piece.durationSeconds,
        lockedRpm: piece.lockedRpm ?? 80,
        ratio: '1:1',
        songId: null,
        stretchPercent: 0,
        inBeat: 0,
        outBeat: 0,
        crossfadeBeats: 0,
        drop: false,
        silence: true,
      })
      continue
    }

    if (piece.lockedRpm === null) {
      continue
    }

    if (typeof resolution === 'object' && 'cadence' in resolution) {
      piece.lockedRpm = resolution.cadence
    }

    const lockedRpm = piece.lockedRpm!
    let gate = STRETCH_GATE
    if (resolution === 'stretch16') {
      gate = STRETCH_WIDE
    }

    const preferHighEnergy =
      piece.ftpPercent !== null ? piece.ftpPercent >= 85 : false

    let pick: SongPick | null = null
    const keepSong =
      piece.durationSeconds <= SHORT_PIECE_SEC &&
      lastSongId !== null &&
      lastLockedRpm === lockedRpm

    if (keepSong) {
      const prev = songs.find((s) => s.id === lastSongId)
      if (prev?.analysis) {
        const stretch = stretchForSong(prev.analysis.bpm, lockedRpm)
        pick = {
          song: prev,
          ratio: '1:1',
          stretchPercent: stretch,
          targetBpm: lockedRpm,
        }
      }
    }

    if (!pick) {
      const needNew =
        piece.durationSeconds > SHORT_PIECE_SEC ||
        lastSongId === null ||
        lastLockedRpm !== lockedRpm

      if (needNew && piece.durationSeconds > SHORT_PIECE_SEC) {
        songs = songs.filter((s) => !usedOnLongPieces.has(s.id))
      }

      pick = pickSong(
        songs,
        profile,
        lockedRpm,
        gate,
        banned,
        piece.ftpPercent,
        preferHighEnergy,
        'alternate',
        ratioAlternate++,
      )
    }

    if (!pick) {
      gaps.push({
        pieceIndex: piece.pieceIndex,
        intervalId: piece.intervalId,
        durationSeconds: piece.durationSeconds,
        reason: 'no_song',
        lockedRpm,
      })
      continue
    }

  const isNewSong = pick.song.id !== lastSongId
    const drop =
      options.dropsEnabled &&
      isNewSong &&
      piece.scaledWatts !== null &&
      isHard(piece.scaledWatts, profile.ftp)

    const songDur = pick.song.durationSeconds || 180
    const beatsNeeded = Math.ceil(
      (piece.durationSeconds / 60) * pick.targetBpm,
    )
    const inBeat = 0
    let outBeat = Math.min(beatsNeeded, Math.floor((songDur * pick.song.analysis!.bpm) / 60))

    cues.push({
      pieceIndex: piece.pieceIndex,
      intervalId: piece.intervalId,
      durationSeconds: piece.durationSeconds,
      lockedRpm,
      ratio: pick.ratio,
      songId: pick.song.id,
      stretchPercent: pick.stretchPercent,
      inBeat,
      outBeat,
      crossfadeBeats: crossfadeBeatsForPiece(piece.durationSeconds),
      drop,
      silence: false,
    })

    lastSongId = pick.song.id
    lastLockedRpm = lockedRpm
    if (piece.durationSeconds > SHORT_PIECE_SEC) {
      usedOnLongPieces.add(pick.song.id)
    }
  }

  return { cues, gaps }
}