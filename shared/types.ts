/** Shared domain types for workouts, music planning, and rides. */

export type PowerKind = 'watts' | 'ftp_percent' | 'zone' | 'rpe'
export type IntervalShape = 'steady' | 'ramp'

export interface WorkoutInterval {
  id: string
  position: number
  durationSeconds: number
  powerKind: PowerKind
  powerValue: number
  cadenceLow: number | null
  cadenceHigh: number | null
  shape: IntervalShape
  rampEndPowerKind?: PowerKind
  rampEndPowerValue?: number
  rampEndCadenceLow?: number | null
  rampEndCadenceHigh?: number | null
  cueText?: string
}

export interface Workout {
  id: string
  name: string
  source: 'zwo' | 'builder'
  createdAt: string
  intervals: WorkoutInterval[]
}

export interface ZoneTable {
  [zone: number]: number
}

export interface RpeTable {
  [rpe: number]: number
}

export interface Profile {
  id: string
  ftp: number | null
  preferredCadence: number
  zoneTable: ZoneTable
  rpeTable: RpeTable
  genres: string[]
}

export interface SongAnalysis {
  bpm: number
  beatGrid: number[]
  downbeats: number[]
  phrases: number[]
  energy: number
  key: string | null
  contentHash?: string
}

export interface Song {
  id: string
  name: string
  source: 'folder' | 'starter'
  durationSeconds: number
  banned: boolean
  genres: string[]
  energy: number
  analysis: SongAnalysis | null
  fileKey?: string
  cdnUrl?: string
}

export interface Cue {
  pieceIndex: number
  intervalId: string
  durationSeconds: number
  lockedRpm: number
  ratio: '1:1' | '2:1'
  songId: string | null
  stretchPercent: number
  inBeat: number
  outBeat: number
  crossfadeBeats: number
  drop: boolean
  silence: boolean
}

export interface PlanGap {
  pieceIndex: number
  intervalId: string
  durationSeconds: number
  reason: 'no_song' | 'missing_cadence'
  lockedRpm?: number
}

export interface Plan {
  id: string
  workoutId: string
  intensityScale: number
  dropsEnabled: boolean
  fanMode: 'hr' | 'speed'
  cues: Cue[]
  gaps: PlanGap[]
}

export interface RideSample {
  timeMs: number
  watts: number
  cadence: number
  heartRate: number
  crankRevs?: number
  crankEventMs?: number
}

export interface Ride {
  id: string
  workoutId: string
  planId: string
  startedAt: string
  endedAt: string | null
  samples: RideSample[]
}

export interface TrainerSample {
  watts: number
  cadence: number
  heartRate: number
  crankRevs: number
  crankEventMs: number
}

/** Musical piece after ramp split, used by the planner. */
export interface PlannerPiece {
  pieceIndex: number
  intervalId: string
  durationSeconds: number
  interval: WorkoutInterval
  cadenceLow: number | null
  cadenceHigh: number | null
  scaledWatts: number | null
  ftpPercent: number | null
}

export interface PlanRideOptions {
  intensityScale: number
  dropsEnabled: boolean
  bannedSongIds?: string[]
  filledCadence?: Record<string, number>
  resolutions?: Record<
    number,
    'stretch16' | 'silence' | { cadence: number }
  >
}