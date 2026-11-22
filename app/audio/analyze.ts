/** Main-thread audio analysis (decode + BPM estimate). */

import type { SongAnalysis } from '#shared/types'
import type { AnalyzeResult } from './analyze.worker'

function downsampleEnergy(channel: Float32Array, buckets: number): number[] {
  const out: number[] = []
  const size = Math.floor(channel.length / buckets)
  for (let i = 0; i < buckets; i++) {
    let sum = 0
    const start = i * size
    for (let j = 0; j < size; j++) {
      const v = channel[start + j] ?? 0
      sum += v * v
    }
    out.push(Math.sqrt(sum / Math.max(1, size)))
  }
  const max = Math.max(...out, 0.0001)
  return out.map((e) => e / max)
}

function estimateBpm(channel: Float32Array, sampleRate: number): number {
  const minLag = Math.floor(sampleRate * (60 / 180))
  const maxLag = Math.floor(sampleRate * (60 / 70))
  let bestLag = minLag
  let bestCorr = -Infinity
  const step = Math.max(1, Math.floor((maxLag - minLag) / 400))
  for (let lag = minLag; lag <= maxLag; lag += step) {
    let corr = 0
    const limit = Math.min(channel.length - lag, 44100 * 30)
    for (let i = 0; i < limit; i += 4) {
      corr += channel[i] * channel[i + lag]
    }
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  const bpm = (60 * sampleRate) / bestLag
  return Math.round(Math.min(180, Math.max(70, bpm)))
}

function buildGrid(bpm: number, durationSeconds: number): AnalyzeResult {
  const beatSec = 60 / bpm
  const beatGrid: number[] = []
  const downbeats: number[] = []
  const phrases: number[] = []
  for (let t = 0; t < durationSeconds; t += beatSec) {
    const idx = beatGrid.length
    beatGrid.push(t)
    if (idx % 4 === 0) {
      downbeats.push(t)
    }
    if (idx % 32 === 0) {
      phrases.push(t)
    }
  }
  return {
    bpm,
    beatGrid,
    downbeats,
    phrases,
    energy: 0.5,
    key: null,
  }
}

export async function analyzeAudio(
  arrayBuffer: ArrayBuffer,
): Promise<SongAnalysis & { durationSeconds: number }> {
  const ctx = new AudioContext()
  const audio = await ctx.decodeAudioData(arrayBuffer.slice(0))
  await ctx.close()
  const channel = audio.getChannelData(0)
  const energyCurve = downsampleEnergy(channel, 120)
  const bpm = estimateBpm(channel, audio.sampleRate)
  const grid = buildGrid(bpm, audio.duration)
  const rms =
    Math.sqrt(
      channel.reduce((s, v) => s + v * v, 0) / Math.max(1, channel.length),
    ) || 0
  return {
    ...grid,
    energy: Math.min(1, rms * 8),
    durationSeconds: Math.round(audio.duration),
    ...({ energyCurve } as object),
  } as SongAnalysis & AnalyzeResult & { durationSeconds: number }
}