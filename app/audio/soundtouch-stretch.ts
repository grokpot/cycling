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
    soundtouch.tempo = rate
    soundtouch.pitch = 1.0

    // Use SimpleFilter with WebAudioBufferSource
    const source = new WebAudioBufferSource(input)
    const filter = new SimpleFilter(source, soundtouch)

    const channels = input.numberOfChannels
    const expectedOutputFrames = Math.ceil(input.length / rate) + 4096
    
    // Allocate oversized output buffers
    const leftOutput = new Float32Array(expectedOutputFrames)
    const rightOutput = new Float32Array(expectedOutputFrames)
    
    // Extract using SimpleFilter (handles interleaved stereo)
    let totalFramesExtracted = 0
    const extractBuffer = new Float32Array(4096 * 2)
    
    // Extract in chunks until exhausted
    for (let attempt = 0; attempt < 1000 && totalFramesExtracted < expectedOutputFrames; attempt++) {
      const framesExtracted = filter.extract(extractBuffer, 4096)
      if (framesExtracted === 0) break
      
      // Deinterleave: extractBuffer is [L0, R0, L1, R1, ...]
      for (let i = 0; i < framesExtracted; i++) {
        const interleavedIndex = i * 2
        leftOutput[totalFramesExtracted + i] = extractBuffer[interleavedIndex]
        rightOutput[totalFramesExtracted + i] = extractBuffer[interleavedIndex + 1]
      }
      
      totalFramesExtracted += framesExtracted
    }

    console.info(`SoundTouch: Processed ${input.length} → ${totalFramesExtracted} frames at tempo ${rate.toFixed(3)}`)

    if (totalFramesExtracted === 0) {
      console.warn('SoundTouch produced zero output frames - returning silence')
      return this.ctx.createBuffer(channels, 1, input.sampleRate)
    }

    // Create output AudioBuffer
    const output = this.ctx.createBuffer(
      channels,
      totalFramesExtracted,
      input.sampleRate
    )

    output.getChannelData(0).set(leftOutput.subarray(0, totalFramesExtracted))
    if (channels > 1) {
      output.getChannelData(1).set(rightOutput.subarray(0, totalFramesExtracted))
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

