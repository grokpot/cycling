/** Real audio mixer with pitch-preserving time stretch and crossfades. */

import type { Cue, Song } from '#shared/types'
import { TimeStretcher } from './time-stretch'

interface ScheduledCue {
  cue: Cue
  buffer: AudioBuffer
  startTime: number
  duration: number
}

export class AudioMixer {
  private ctx: AudioContext | null = null
  private stretcher: TimeStretcher | null = null
  private masterGain: GainNode | null = null
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private scheduledCues: ScheduledCue[] = []
  private activeSources: AudioBufferSourceNode[] = []
  private startTime = 0
  private paused = false

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.stretcher = new TimeStretcher(this.ctx)
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
      this.masterGain.gain.value = 0.8
    }
  }

  /**
   * Load an audio buffer for a song ID.
   */
  loadBuffer(songId: string, buffer: AudioBuffer) {
    this.audioBuffers.set(songId, buffer)
  }

  /**
   * Schedule all cues for the ride, computing stretched buffers and crossfade times.
   */
  scheduleCues(cues: Cue[], songs: Song[]) {
    this.ensureCtx()
    if (!this.ctx || !this.stretcher) {
      return
    }

    this.scheduledCues = []
    let currentTime = 0

    for (const cue of cues) {
      if (cue.silence || !cue.songId) {
        currentTime += cue.durationSeconds
        continue
      }

      const song = songs.find((s) => s.id === cue.songId)
      if (!song?.analysis) {
        currentTime += cue.durationSeconds
        continue
      }

      const originalBuffer = this.audioBuffers.get(cue.songId)
      if (!originalBuffer) {
        currentTime += cue.durationSeconds
        continue
      }

      // Compute stretch rate
      const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
      const stretchRate = song.analysis.bpm / targetBpm

      // Stretch the buffer
      const stretchedBuffer = this.stretcher.stretch(originalBuffer, stretchRate)

      // Extract segment from inBeat to outBeat
      const beatDuration = 60 / targetBpm
      const startSample = Math.floor(cue.inBeat * beatDuration * this.ctx.sampleRate)
      const endSample = Math.floor(cue.outBeat * beatDuration * this.ctx.sampleRate)
      const segmentLength = Math.min(
        endSample - startSample,
        stretchedBuffer.length - startSample,
        Math.floor(cue.durationSeconds * this.ctx.sampleRate),
      )

      const segmentBuffer = this.ctx.createBuffer(
        stretchedBuffer.numberOfChannels,
        segmentLength,
        this.ctx.sampleRate,
      )

      for (let ch = 0; ch < stretchedBuffer.numberOfChannels; ch++) {
        const src = stretchedBuffer.getChannelData(ch)
        const dest = segmentBuffer.getChannelData(ch)
        for (let i = 0; i < segmentLength; i++) {
          dest[i] = src[startSample + i] ?? 0
        }
      }

      this.scheduledCues.push({
        cue,
        buffer: segmentBuffer,
        startTime: currentTime,
        duration: cue.durationSeconds,
      })

      currentTime += cue.durationSeconds
    }
  }

  /**
   * Start playback from the beginning.
   */
  start() {
    this.ensureCtx()
    if (!this.ctx || !this.masterGain) {
      return
    }

    this.stop()
    this.startTime = this.ctx.currentTime

    for (const scheduled of this.scheduledCues) {
      const source = this.ctx.createBufferSource()
      source.buffer = scheduled.buffer

      // Create gain node for this source for crossfades
      const gain = this.ctx.createGain()
      source.connect(gain)
      gain.connect(this.masterGain)

      // Schedule start
      const when = this.startTime + scheduled.startTime
      source.start(when)

      // Schedule crossfade if there's a next cue
      const nextIndex = this.scheduledCues.indexOf(scheduled) + 1
      if (nextIndex < this.scheduledCues.length) {
        const crossfadeBeats = scheduled.cue.crossfadeBeats || 4
        const beatDuration = 60 / scheduled.cue.lockedRpm
        const crossfadeDuration = crossfadeBeats * beatDuration

        // Fade out this source
        const fadeOutStart = when + scheduled.duration - crossfadeDuration
        gain.gain.setValueAtTime(1, fadeOutStart)
        gain.gain.linearRampToValueAtTime(0, fadeOutStart + crossfadeDuration)

        // Next source will fade in automatically (we'll set that when we process it)
      } else {
        // Last cue, no fade out
        gain.gain.value = 1
      }

      this.activeSources.push(source)
    }
  }

  /**
   * Skip to the next scheduled cue.
   */
  skipSong() {
    // Not implemented yet - would need to track current position and restart from next cue
  }

  stop() {
    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
    }
    this.activeSources = []
  }

  pause() {
    if (this.ctx && !this.paused) {
      void this.ctx.suspend()
      this.paused = true
    }
  }

  resume() {
    if (this.ctx && this.paused) {
      void this.ctx.resume()
      this.paused = false
    }
  }

  close() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
  }
}