/** Two-buffer Web Audio mixer with tempo stretch (pitch follows playback rate). */

import type { Cue } from '#shared/types'

// Pitch-preserving stretch is the next audio step; playbackRate slightly shifts pitch.
export class AudioMixer {
  private ctx: AudioContext | null = null
  private gainA: GainNode | null = null
  private gainB: GainNode | null = null
  private sourceA: AudioBufferSourceNode | null = null
  private sourceB: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private targetBpm = 120
  private songBpm = 120
  private paused = false

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gainA = this.ctx.createGain()
      this.gainB = this.ctx.createGain()
      this.gainA.connect(this.ctx.destination)
      this.gainB.connect(this.ctx.destination)
    }
  }

  async load(cue: Cue, arrayBuffer: ArrayBuffer, songBpm: number) {
    this.ensureCtx()
    if (!this.ctx) {
      return
    }
    this.songBpm = songBpm
    this.targetBpm =
      cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0))
    this.scheduleCurrent(cue)
  }

  private scheduleCurrent(cue: Cue) {
    if (!this.ctx || !this.buffer || !this.gainA) {
      return
    }
    this.stopSources()
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer
    src.playbackRate.value = this.targetBpm / this.songBpm
    src.connect(this.gainA)
    this.gainA.gain.value = 1
    const when = this.ctx.currentTime + 0.05
    src.start(when)
    this.sourceA = src
    void cue.crossfadeBeats
  }

  skipSong() {
    this.stopSources()
  }

  stop() {
    this.stopSources()
    void this.ctx?.close()
    this.ctx = null
  }

  pause() {
    this.paused = true
    void this.ctx?.suspend()
  }

  resume() {
    this.paused = false
    void this.ctx?.resume()
  }

  private stopSources() {
    try {
      this.sourceA?.stop()
    } catch {
      // already stopped
    }
    try {
      this.sourceB?.stop()
    } catch {
      // already stopped
    }
    this.sourceA = null
    this.sourceB = null
  }
}