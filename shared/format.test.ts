import { describe, it, expect } from 'vitest'
import { formatDuration, formatPower, formatCadence } from './format'

describe('formatDuration', () => {
  it('formats valid durations correctly', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(180)).toBe('3:00')
    expect(formatDuration(240)).toBe('4:00')
    expect(formatDuration(300)).toBe('5:00')
    expect(formatDuration(3661)).toBe('61:01')
  })

  it('handles invalid inputs gracefully', () => {
    expect(formatDuration(NaN)).toBe('--:--')
    expect(formatDuration(null)).toBe('--:--')
    expect(formatDuration(undefined)).toBe('--:--')
    expect(formatDuration(Infinity)).toBe('--:--')
    expect(formatDuration(-Infinity)).toBe('--:--')
  })

  it('handles negative values as zero', () => {
    expect(formatDuration(-10)).toBe('0:00')
  })
})

describe('formatPower', () => {
  it('formats FTP percent', () => {
    expect(formatPower('ftp_percent', 85)).toBe('85% FTP')
  })

  it('formats watts', () => {
    expect(formatPower('watts', 200)).toBe('200 W')
  })

  it('formats zone', () => {
    expect(formatPower('zone', 3)).toBe('Zone 3')
  })

  it('formats RPE', () => {
    expect(formatPower('rpe', 7)).toBe('RPE 7')
  })
})

describe('formatCadence', () => {
  it('formats single cadence', () => {
    expect(formatCadence(80, 80)).toBe('80 RPM')
    expect(formatCadence(90, null)).toBe('90 RPM')
    expect(formatCadence(null, 95)).toBe('95 RPM')
  })

  it('formats cadence range', () => {
    expect(formatCadence(70, 90)).toBe('70–90 RPM')
    expect(formatCadence(90, 70)).toBe('70–90 RPM')
  })

  it('handles no cadence', () => {
    expect(formatCadence(null, null)).toBe('No cadence')
  })
})
