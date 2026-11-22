/** Pure functions for seeking within a workout and music plan. */

import type { Workout, Plan, Cue } from './types'

export interface SeekResult {
  elapsedMs: number
  intervalIndex: number
  intervalId: string
  pieceIndex: number
  cue: Cue | null
  cueOffsetMs: number
}

/**
 * Find the interval and piece at a given elapsed time.
 */
export function seekToTime(
  elapsedMs: number,
  workout: Workout,
  plan: Plan,
): SeekResult | null {
  if (elapsedMs < 0) {
    return null
  }

  let accumulatedMs = 0
  
  for (let intervalIndex = 0; intervalIndex < workout.intervals.length; intervalIndex++) {
    const interval = workout.intervals[intervalIndex]
    const intervalDurationMs = interval.durationSeconds * 1000

    if (accumulatedMs + intervalDurationMs > elapsedMs) {
      const offsetInIntervalMs = elapsedMs - accumulatedMs
      
      let pieceAccumulatedMs = 0
      for (const cue of plan.cues) {
        const cueDurationMs = cue.durationSeconds * 1000
        
        if (cue.intervalId === interval.id) {
          if (pieceAccumulatedMs + cueDurationMs > offsetInIntervalMs) {
            const cueOffsetMs = offsetInIntervalMs - pieceAccumulatedMs
            
            return {
              elapsedMs,
              intervalIndex,
              intervalId: interval.id,
              pieceIndex: cue.pieceIndex,
              cue,
              cueOffsetMs,
            }
          }
          pieceAccumulatedMs += cueDurationMs
        }
      }
      
      const fallbackCue = plan.cues.find(c => c.intervalId === interval.id) ?? null
      return {
        elapsedMs,
        intervalIndex,
        intervalId: interval.id,
        pieceIndex: fallbackCue?.pieceIndex ?? 0,
        cue: fallbackCue,
        cueOffsetMs: 0,
      }
    }

    accumulatedMs += intervalDurationMs
  }

  return null
}

/**
 * Convert an SVG click position to elapsed time.
 * 
 * @param clickX X coordinate relative to SVG viewBox
 * @param svgWidth Total viewBox width
 * @param padding Left and right padding in viewBox units
 * @param totalMs Total workout duration in milliseconds
 */
export function clickPositionToTime(
  clickX: number,
  svgWidth: number,
  padding: number,
  totalMs: number,
): number {
  const innerWidth = svgWidth - padding * 2
  const relativeX = Math.max(0, Math.min(innerWidth, clickX - padding))
  return (relativeX / innerWidth) * totalMs
}

/**
 * Format elapsed time as MM:SS for tooltip display.
 */
export function formatSeekTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
