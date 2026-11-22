/**
 * Pitch-preserving time stretch using SoundTouchJS.
 * Uses SimpleFilter for processing.
 */

import { SoundTouch, SimpleFilter, WebAudioBufferSource } from 'soundtouchjs'

export class SoundTouchStretcher {
  private ctx: AudioContext | OfflineAudioContext

  constructor(ctx: AudioContext | OfflineAudioContext) {
    this.ctx = ctx
  }

  /**
   * Stretch an audio buffer by the given tempo while preserving pitch.
   * 
   * @param input Source audio buffer
   * @param tempo Playback tempo (<1 = slower, 1 = normal, >1 = faster)
   */
  stretch(input: AudioBuffer, tempo: number): AudioBuffer {
    if (Math.abs(tempo - 1.0) < 0.001) {
      return input
    }

    try {
      const soundtouch = new SoundTouch()
      soundtouch.tempo = tempo
      soundtouch.pitch = 1.0

      const source = new WebAudioBufferSource(input)
      const filter = new SimpleFilter(source, soundtouch)

      const channels = input.numberOfChannels
      const sampleRate = input.sampleRate
      const expectedOutputFrames = Math.ceil(input.length / tempo) + 8192

      console.info(`SoundTouch: stretching ${input.length} frames at tempo ${tempo.toFixed(3)}`)

      const outputChunks: Float32Array[] = []
      let totalOutputFrames = 0
      const extractBuffer = new Float32Array(8192 * 2)
      let iterations = 0
      const maxIterations = Math.ceil(expectedOutputFrames / 4096) + 50

      while (iterations < maxIterations) {
        const framesExtracted = filter.extract(extractBuffer, 4096)
        
        if (framesExtracted === 0) {
          break
        }

        outputChunks.push(extractBuffer.slice(0, framesExtracted * 2))
        totalOutputFrames += framesExtracted
        iterations++
      }

      if (totalOutputFrames === 0 || iterations >= maxIterations) {
        console.warn(`SoundTouch produced no output (${totalOutputFrames} frames, ${iterations} iterations) - falling back`)
        return input
      }

      console.info(`SoundTouch: produced ${totalOutputFrames} frames in ${iterations} iterations`)

      const interleavedOutput = new Float32Array(totalOutputFrames * 2)
      let offset = 0
      for (const chunk of outputChunks) {
        interleavedOutput.set(chunk, offset)
        offset += chunk.length
      }

      let hasNaN = false
      for (let i = 0; i < Math.min(interleavedOutput.length, 1000); i++) {
        if (!Number.isFinite(interleavedOutput[i])) {
          hasNaN = true
          break
        }
      }

      if (hasNaN) {
        console.warn(`SoundTouch produced NaN samples - falling back to unstretched audio`)
        return input
      }

      const output = this.ctx.createBuffer(channels, totalOutputFrames, sampleRate)
      const leftOut = output.getChannelData(0)
      const rightOut = channels > 1 ? output.getChannelData(1) : leftOut

      for (let i = 0; i < totalOutputFrames; i++) {
        leftOut[i] = interleavedOutput[i * 2] ?? 0
        if (channels > 1) {
          rightOut[i] = interleavedOutput[i * 2 + 1] ?? 0
        }
      }

      return output
    } catch (error) {
      console.warn('SoundTouch stretching failed:', error, '- falling back to unstretched audio')
      return input
    }
  }

  /**
   * Stretch to a target duration in seconds.
   */
  stretchToDuration(input: AudioBuffer, targetSeconds: number): AudioBuffer {
    const currentSeconds = input.duration
    const rate = currentSeconds / targetSeconds
    return this.stretch(input, rate)
  }
}

