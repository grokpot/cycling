/**
 * Pitch-preserving time stretch using SoundTouchJS core directly.
 * Uses SoundTouch, tempo, inputBuffer.putSamples, process, outputBuffer.receiveSamples.
 */

import { SoundTouch } from 'soundtouchjs'

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

      const channels = input.numberOfChannels
      const sampleRate = input.sampleRate

      console.info(`SoundTouch: stretching ${input.length} frames at tempo ${tempo.toFixed(3)}`)

      const leftIn = input.getChannelData(0)
      const rightIn = channels > 1 ? input.getChannelData(1) : leftIn

      const interleavedInput = new Float32Array(input.length * 2)
      for (let i = 0; i < input.length; i++) {
        interleavedInput[i * 2] = leftIn[i]
        interleavedInput[i * 2 + 1] = rightIn[i]
      }

      soundtouch.inputBuffer.putSamples(interleavedInput, 0, input.length)

      soundtouch.flush()

      const outputChunks: Float32Array[] = []
      let totalOutputSamples = 0
      const chunkSize = 4096

      while (true) {
        const chunk = new Float32Array(chunkSize * 2)
        const receivedSamples = soundtouch.outputBuffer.receiveSamples(chunk, chunkSize)
        
        if (receivedSamples === 0) {
          break
        }

        outputChunks.push(chunk.slice(0, receivedSamples * 2))
        totalOutputSamples += receivedSamples
      }

      if (totalOutputSamples === 0) {
        console.warn(`SoundTouch produced no output - falling back to unstretched audio`)
        return input
      }

      console.info(`SoundTouch: produced ${totalOutputSamples} frames`)

      const interleavedOutput = new Float32Array(totalOutputSamples * 2)
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

      const output = this.ctx.createBuffer(channels, totalOutputSamples, sampleRate)
      const leftOut = output.getChannelData(0)
      const rightOut = channels > 1 ? output.getChannelData(1) : leftOut

      for (let i = 0; i < totalOutputSamples; i++) {
        leftOut[i] = interleavedOutput[i * 2]
        if (channels > 1) {
          rightOut[i] = interleavedOutput[i * 2 + 1]
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

