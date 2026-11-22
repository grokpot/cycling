/**
 * Pitch-preserving time stretch using SoundTouchJS library.
 * MIT licensed, proven quality.
 */

import { SoundTouch, SimpleFilter, WebAudioBufferSource } from 'soundtouchjs'

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

    // Wrap AudioBuffer in WebAudioBufferSource for SimpleFilter
    const source = new WebAudioBufferSource(input)
    const filter = new SimpleFilter(source, soundtouch)

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
    const extractBuffer = new Float32Array(bufferSize * channels)
    
    console.info(`SoundTouch: Processing ${input.length} samples at rate ${rate}, expecting ~${outputLength} output samples`)
    
    while (samplesRead < outputLength) {
      // Extract interleaved samples
      const framesExtracted = filter.extract(extractBuffer, bufferSize)
      if (framesExtracted === 0) {
        console.info(`SoundTouch: Extract returned 0 frames at position ${samplesRead}/${outputLength}`)
        break
      }

      // Deinterleave samples to channels
      for (let i = 0; i < framesExtracted && samplesRead + i < outputLength; i++) {
        for (let ch = 0; ch < channels; ch++) {
          outputData[ch][samplesRead + i] = extractBuffer[i * channels + ch] ?? 0
        }
      }

      samplesRead += framesExtracted
    }

    console.info(`SoundTouch: Extracted ${samplesRead} samples total`)

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

