/**
 * Pitch-preserving time stretch using SoundTouchJS library.
 * MIT licensed, proven quality.
 */

import { SoundTouch, SimpleFilter } from 'soundtouchjs'

export class SoundTouchStretcher {
  private ctx: AudioContext

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  /**
   * Stretch an audio buffer by the given rate while preserving pitch.
   * Uses SoundTouchJS for high-quality WSOLA+anti-aliasing.
   * 
   * @param input Source audio buffer
   * @param rate Playback rate (1.0 = normal, >1 = faster, <1 = slower)
   */
  stretch(input: AudioBuffer, rate: number): AudioBuffer {
    if (Math.abs(rate - 1.0) < 0.001) {
      return input
    }

    const soundtouch = new SoundTouch()
    // Set tempo: 1.0 = normal, >1 = faster, <1 = slower
    soundtouch.tempo = rate
    // Keep pitch unchanged
    soundtouch.pitch = 1.0

    const filter = new SimpleFilter(input, soundtouch)

    // Estimate output length
    const outputLength = Math.ceil(input.length / rate)
    
    // Extract samples
    const channels = input.numberOfChannels
    const outputData: Float32Array[] = []
    
    for (let ch = 0; ch < channels; ch++) {
      outputData[ch] = new Float32Array(outputLength)
    }

    // Process audio
    let samplesRead = 0
    const bufferSize = 4096
    
    while (samplesRead < outputLength) {
      const samples = filter.extract(bufferSize, samplesRead)
      if (samples.length === 0) {
        break
      }

      // Deinterleave samples to channels
      for (let i = 0; i < samples.length && samplesRead + i < outputLength; i++) {
        for (let ch = 0; ch < channels; ch++) {
          outputData[ch][samplesRead + i] = samples[i * channels + ch] ?? 0
        }
      }

      samplesRead += samples.length / channels
    }

    // Create output buffer with actual samples read
    const output = this.ctx.createBuffer(
      channels,
      samplesRead,
      input.sampleRate,
    )

    for (let ch = 0; ch < channels; ch++) {
      output.getChannelData(ch).set(outputData[ch].slice(0, samplesRead))
    }

    return output
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

