/** Rider-facing labels. Internal kinds stay out of the UI. */

import type { PowerKind } from './types'

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '--:--'
  }
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const remain = total % 60
  return `${minutes}:${remain.toString().padStart(2, '0')}`
}

export function formatPower(kind: PowerKind, value: number): string {
  if (kind === 'ftp_percent') {
    return `${value}% FTP`
  }
  if (kind === 'watts') {
    return `${value} W`
  }
  if (kind === 'zone') {
    return `Zone ${value}`
  }
  return `RPE ${value}`
}

export function formatCadence(
  low: number | null,
  high: number | null,
): string {
  if (low === null && high === null) {
    return 'No cadence'
  }
  if (low !== null && high !== null && low !== high) {
    const start = Math.min(low, high)
    const end = Math.max(low, high)
    return `${start}–${end} RPM`
  }
  return `${low ?? high} RPM`
}

export function powerValueLabel(kind: PowerKind): string {
  if (kind === 'ftp_percent') {
    return '% FTP'
  }
  if (kind === 'watts') {
    return 'Watts'
  }
  if (kind === 'zone') {
    return 'Zone'
  }
  return 'RPE'
}
