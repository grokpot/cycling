/** Real audio mixer with pitch-preserving time stretch and crossfades. */

import type { Cue, Song } from '#shared/types'
import { SoundTouchStretcher } from './soundtouch-stretch'

interface ScheduledCue {
  cue: Cue
  buffer: AudioBuffer
  startTime: number
  duration: number
}

export class AudioMixer {
  private ctx: AudioContext | null = null
  private stretcher: SoundTouchStretcher | null = null
  private masterGain: GainNode | null = null
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private scheduledCues: ScheduledCue[] = []
  private activeSources: AudioBufferSourceNode[] = []
  private startTime = 0
  private paused = false

  constructor(ctx?: AudioContext | OfflineAudioContext) {
    if (ctx) {
      this.ctx = ctx
      this.stretcher = new SoundTouchStretcher(ctx)
      this.masterGain = ctx.createGain()
      this.masterGain.connect(ctx.destination)
      this.masterGain.gain.value = 0.8
      console.info(`AudioMixer initialized with external context: ${ctx.sampleRate} Hz`)
    }
  }

  private ensureCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
        console.info(`AudioContext created: sampleRate=${this.ctx.sampleRate}, state=${this.ctx.state}`)
        
        this.stretcher = new SoundTouchStretcher(this.ctx)
        this.masterGain = this.ctx.createGain()
        this.masterGain.connect(this.ctx.destination)
        this.masterGain.gain.value = 0.8
      } catch (error) {
        console.error('Failed to create AudioContext:', error)
        throw error
      }
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
      console.error('AudioMixer: Context not ready for scheduling')
      return
    }

    this.scheduledCues = []
    let currentTime = 0
    let processedCount = 0

    console.info(`AudioMixer: Scheduling ${cues.length} cues`)

    for (const cue of cues) {
      if (cue.silence || !cue.songId) {
        console.info(`Cue ${cue.pieceIndex}: Silence, skipping`)
        currentTime += cue.durationSeconds
        continue
      }

      const song = songs.find((s) => s.id === cue.songId)
      if (!song?.analysis) {
        console.warn(`Cue ${cue.pieceIndex}: Song ${cue.songId} not found or missing analysis`)
        currentTime += cue.durationSeconds
        continue
      }

      const originalBuffer = this.audioBuffers.get(cue.songId)
      if (!originalBuffer) {
        console.warn(`Cue ${cue.pieceIndex}: Audio buffer for ${cue.songId} not loaded`)
        currentTime += cue.durationSeconds
        continue
      }

      try {
        // Compute tempo (SoundTouch tempo: 1.0 = normal, <1 = slower, >1 = faster)
        const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
        // Tempo is targetBpm / songBpm (not songBpm / targetBpm!)
        // E.g. 90 BPM → 86 BPM: tempo = 86/90 = 0.956 (slower)
        const tempo = targetBpm / song.analysis.bpm

        console.info(`Cue ${cue.pieceIndex}: ${song.name} - ${song.analysis.bpm} BPM → ${targetBpm} BPM (tempo: ${tempo.toFixed(3)})`)

        // Extract segment BEFORE stretching (using original BPM)
        const originalBeatDuration = 60 / song.analysis.bpm
        const startSample = Math.floor(cue.inBeat * originalBeatDuration * this.ctx.sampleRate)
        const endSample = Math.floor(cue.outBeat * originalBeatDuration * this.ctx.sampleRate)
        const originalSegmentLength = Math.min(
          endSample - startSample,
          originalBuffer.length - startSample
        )

        const originalSegment = this.ctx.createBuffer(
          originalBuffer.numberOfChannels,
          originalSegmentLength,
          this.ctx.sampleRate,
        )

        for (let ch = 0; ch < originalBuffer.numberOfChannels; ch++) {
          const src = originalBuffer.getChannelData(ch)
          const dest = originalSegment.getChannelData(ch)
          for (let i = 0; i < originalSegmentLength; i++) {
            dest[i] = src[startSample + i] ?? 0
          }
        }

        // Now stretch the extracted segment
        const stretchedSegment = this.stretcher.stretch(originalSegment, tempo)

        // Use the stretched segment, truncate if needed
        const finalLength = Math.min(
          stretchedSegment.length,
          Math.floor(cue.durationSeconds * this.ctx.sampleRate)
        )

        const segmentBuffer = this.ctx.createBuffer(
          stretchedSegment.numberOfChannels,
          finalLength,
          this.ctx.sampleRate,
        )

        for (let ch = 0; ch < stretchedSegment.numberOfChannels; ch++) {
          const src = stretchedSegment.getChannelData(ch)
          const dest = segmentBuffer.getChannelData(ch)
          for (let i = 0; i < finalLength; i++) {
            dest[i] = src[i] ?? 0
          }
        }

        this.scheduledCues.push({
          cue,
          buffer: segmentBuffer,
          startTime: currentTime,
          duration: cue.durationSeconds,
        })

        processedCount++
      } catch (error) {
        console.error(`Cue ${cue.pieceIndex}: Failed to process`, error)
      }

      currentTime += cue.durationSeconds
    }

    console.info(`AudioMixer: Scheduled ${processedCount}/${cues.length} cues successfully`)
  }

  /**
   * Start playback from the beginning.
   */
  start() {
    this.ensureCtx()
    if (!this.ctx || !this.masterGain) {
      console.error('AudioMixer: Failed to initialize AudioContext')
      return
    }

    if (this.scheduledCues.length === 0) {
      console.warn('AudioMixer: No cues scheduled')
      return
    }

    this.stop()
    this.startTime = this.ctx.currentTime

    console.info(`AudioMixer: Starting playback with ${this.scheduledCues.length} cues at time ${this.startTime}`)

    for (let i = 0; i < this.scheduledCues.length; i++) {
      const scheduled = this.scheduledCues[i]
      const source = this.ctx.createBufferSource()
      source.buffer = scheduled.buffer

      // Create gain node for this source for crossfades
      const gain = this.ctx.createGain()
      source.connect(gain)
      gain.connect(this.masterGain)

      // Schedule start
      const when = this.startTime + scheduled.startTime
      
      // Determine if this cue should fade in (not the first cue)
      const prevIndex = i - 1
      const shouldFadeIn = prevIndex >= 0
      
      if (shouldFadeIn) {
        const prevScheduled = this.scheduledCues[prevIndex]
        const crossfadeBeats = prevScheduled.cue.crossfadeBeats || 4
        const beatDuration = 60 / prevScheduled.cue.lockedRpm
        const crossfadeDuration = crossfadeBeats * beatDuration
        
        // Start at 0 and fade in
        gain.gain.setValueAtTime(0, when)
        gain.gain.linearRampToValueAtTime(1, when + crossfadeDuration)
      } else {
        // First cue, start at full volume
        gain.gain.setValueAtTime(1, when)
      }

      // Schedule fade out if there's a next cue
      const nextIndex = i + 1
      if (nextIndex < this.scheduledCues.length) {
        const crossfadeBeats = scheduled.cue.crossfadeBeats || 4
        const beatDuration = 60 / scheduled.cue.lockedRpm
        const crossfadeDuration = crossfadeBeats * beatDuration

        // Fade out before the end
        const fadeOutStart = when + scheduled.duration - crossfadeDuration
        gain.gain.setValueAtTime(1, fadeOutStart)
        gain.gain.linearRampToValueAtTime(0, fadeOutStart + crossfadeDuration)
      }

      source.start(when)
      this.activeSources.push(source)
    }

    console.info('AudioMixer: All sources scheduled successfully')
  }

  /**
   * Schedule sources for offline rendering (call before ctx.startRendering()).
   */
  scheduleForOfflineRender() {
    if (!this.ctx || !this.masterGain) {
      console.error('AudioMixer: Context not ready for offline render')
      return
    }

    if (this.scheduledCues.length === 0) {
      console.warn('AudioMixer: No cues scheduled for offline render')
      return
    }

    console.info(`AudioMixer: Scheduling ${this.scheduledCues.length} sources for offline render`)

    for (let i = 0; i < this.scheduledCues.length; i++) {
      const scheduled = this.scheduledCues[i]
      const source = this.ctx.createBufferSource()
      source.buffer = scheduled.buffer

      // Create gain node for this source for crossfades
      const gain = this.ctx.createGain()
      source.connect(gain)
      gain.connect(this.masterGain)

      // Schedule start at absolute time (no offset for offline)
      const when = scheduled.startTime
      source.start(when)

      // Crossfade logic
      const prevIndex = i - 1
      const shouldFadeIn = prevIndex >= 0

      if (shouldFadeIn) {
        const prevScheduled = this.scheduledCues[prevIndex]
        const crossfadeBeats = prevScheduled.cue.crossfadeBeats || 4
        const beatDuration = 60 / prevScheduled.cue.lockedRpm
        const crossfadeDuration = crossfadeBeats * beatDuration

        // Start at 0 and fade in
        gain.gain.setValueAtTime(0, when)
        gain.gain.linearRampToValueAtTime(1, when + crossfadeDuration)
      } else {
        // First cue, start at full volume
        gain.gain.setValueAtTime(1, when)
      }

      // Schedule fade out if there's a next cue
      const nextIndex = i + 1
      if (nextIndex < this.scheduledCues.length) {
        const crossfadeBeats = scheduled.cue.crossfadeBeats || 4
        const beatDuration = 60 / scheduled.cue.lockedRpm
        const crossfadeDuration = crossfadeBeats * beatDuration

        // Fade out before the end
        const fadeOutStart = when + scheduled.duration - crossfadeDuration
        gain.gain.setValueAtTime(1, fadeOutStart)
        gain.gain.linearRampToValueAtTime(0, fadeOutStart + crossfadeDuration)
      }

      this.activeSources.push(source)
    }

    console.info('AudioMixer: Offline render sources scheduled')
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