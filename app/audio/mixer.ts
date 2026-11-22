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
  private activeSources: Array<{ source: AudioBufferSourceNode; gain: GainNode; cueIndex: number }> = []
  private startTime = 0
  private currentCueIndex = 0
  private paused = false
  private elapsedAtPause = 0

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
    this.currentCueIndex = 0
    this.elapsedAtPause = 0

    console.info(`AudioMixer: Starting playback from cue 0`)
    this.playCue(0, 0)
  }

  /**
   * Play a specific cue starting at a given offset within that cue.
   */
  private playCue(cueIndex: number, offsetSeconds: number) {
    if (!this.ctx || !this.masterGain) return
    if (cueIndex >= this.scheduledCues.length) return

    const scheduled = this.scheduledCues[cueIndex]
    const source = this.ctx.createBufferSource()
    source.buffer = scheduled.buffer

    const gain = this.ctx.createGain()
    source.connect(gain)
    gain.connect(this.masterGain)

    const when = this.ctx.currentTime
    const duration = scheduled.duration - offsetSeconds

    // Fade in if not the first cue and starting from beginning of cue
    if (cueIndex > 0 && offsetSeconds === 0) {
      const crossfadeDuration = Math.min(1, duration)
      gain.gain.setValueAtTime(0, when)
      gain.gain.linearRampToValueAtTime(1, when + crossfadeDuration)
    } else {
      gain.gain.setValueAtTime(1, when)
    }

    // Schedule next cue before this one ends
    const nextCueIndex = cueIndex + 1
    if (nextCueIndex < this.scheduledCues.length) {
      const timeUntilNext = duration * 1000
      setTimeout(() => {
        this.currentCueIndex = nextCueIndex
        this.playCue(nextCueIndex, 0)
      }, timeUntilNext)
    }

    source.start(when, offsetSeconds, duration)
    
    this.activeSources.push({ source, gain, cueIndex })
    this.currentCueIndex = cueIndex

    console.info(`AudioMixer: Playing cue ${cueIndex} from offset ${offsetSeconds.toFixed(2)}s`)
  }

  /**
   * Seek to a specific time in the ride.
   */
  seekTo(elapsedSeconds: number) {
    if (!this.ctx || this.scheduledCues.length === 0) return

    // Find which cue this time falls into
    let accumulatedTime = 0
    let targetCueIndex = 0
    let offsetInCue = 0

    for (let i = 0; i < this.scheduledCues.length; i++) {
      const cue = this.scheduledCues[i]
      if (accumulatedTime + cue.duration > elapsedSeconds) {
        targetCueIndex = i
        offsetInCue = elapsedSeconds - accumulatedTime
        break
      }
      accumulatedTime += cue.duration
    }

    console.info(`AudioMixer: Seeking to ${elapsedSeconds.toFixed(2)}s (cue ${targetCueIndex}, offset ${offsetInCue.toFixed(2)}s)`)

    // Stop current sources
    this.stopActiveSources()

    // Start from target cue
    this.playCue(targetCueIndex, offsetInCue)
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

  private stopActiveSources() {
    for (const { source } of this.activeSources) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
    }
    this.activeSources = []
  }

  stop() {
    this.stopActiveSources()
  }

  pause() {
    if (this.ctx && !this.paused) {
      this.elapsedAtPause = this.ctx.currentTime - this.startTime
      void this.ctx.suspend()
      this.paused = true
    }
  }

  resume() {
    if (this.ctx && this.paused) {
      void this.ctx.resume()
      this.paused = false
      // Adjust start time to account for pause
      this.startTime = this.ctx.currentTime - this.elapsedAtPause
    }
  }

  close() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
  }
}