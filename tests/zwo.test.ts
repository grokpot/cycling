import { describe, expect, it } from 'vitest'
import { parseZwo } from '../shared/zwo'

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <name>Test workout</name>
  <workout>
    <Warmup Duration="300" PowerLow="0.5" PowerHigh="0.7" CadenceLow="80" CadenceHigh="95" />
    <SteadyState Duration="120" Power="0.85" Cadence="90" />
    <IntervalsT Repeat="2" OnDuration="60" OffDuration="30" OnPower="1.0" OffPower="0.6" Cadence="100" />
    <Ramp Duration="180" Power="0.6" PowerHigh="0.9" Cadence="85" CadenceHigh="105" />
    <Cooldown Duration="300" PowerHigh="0.5" PowerLow="0.3" />
  </workout>
</workout_file>`

describe('parseZwo', () => {
  it('parses warmup, steady, repeats, and ramp', () => {
    const w = parseZwo(FIXTURE)
    expect(w.name).toBe('Test workout')
    expect(w.source).toBe('zwo')
    const kinds = w.intervals.map((i) => i.shape)
    expect(kinds).toContain('ramp')
    expect(kinds).toContain('steady')
    const repeats = w.intervals.filter((i) => i.durationSeconds === 60)
    expect(repeats.length).toBeGreaterThanOrEqual(2)
    const steady = w.intervals.find(
      (i) => i.shape === 'steady' && i.powerValue === 85,
    )
    expect(steady).toBeDefined()
  })
})