import { describe, expect, it } from 'vitest'
import { buildFit } from '../shared/fit'
import type { Ride } from '../shared/types'

describe('buildFit', () => {
  it('writes header with .FIT and minimum length', () => {
    const ride: Ride = {
      id: 'r1',
      workoutId: 'w1',
      planId: 'pl1',
      startedAt: new Date().toISOString(),
      endedAt: null,
      samples: [
        { timeMs: 0, watts: 100, cadence: 90, heartRate: 120 },
        { timeMs: 1000, watts: 110, cadence: 91, heartRate: 121 },
      ],
    }
    const bytes = buildFit(ride)
    expect(bytes.length).toBeGreaterThanOrEqual(14)
    const sig = String.fromCharCode(bytes[6], bytes[7], bytes[8], bytes[9])
    expect(sig).toBe('.FIT')
  })
})