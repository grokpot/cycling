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

    // Wrap input buffer in WebAudioBufferSource (expected by SimpleFilter)
    const source = new WebAudioBufferSource(input)
    const filter = new SimpleFilter(source, soundtouch)

    const channels = input.numberOfChannels
    const expectedOutputFrames = Math.ceil(input.length / rate)
    
    // Allocate output arrays for each channel
    const outputData: Float32Array[] = [
      new Float32Array(expectedOutputFrames),
      new Float32Array(expectedOutputFrames)
    ]
    
    // Extract processed samples using SimpleFilter
    let totalFramesExtracted = 0
    const extractBuffer = new Float32Array(4096 * 2) // Interleaved stereo
    
    while (totalFramesExtracted < expectedOutputFrames) {
      const framesToExtract = Math.min(4096, expectedOutputFrames - totalFramesExtracted)
      const framesExtracted = filter.extract(extractBuffer, framesToExtract)
      
      if (framesExtracted === 0) break
      
      // Deinterleave stereo to separate channels
      for (let i = 0; i < framesExtracted; i++) {
        outputData[0][totalFramesExtracted + i] = extractBuffer[i * 2]      // Left
        outputData[1][totalFramesExtracted + i] = extractBuffer[i * 2 + 1]  // Right
      }
      
      totalFramesExtracted += framesExtracted
    }

    console.info(`SoundTouch: Processed ${input.length} → ${totalFramesExtracted} frames at tempo ${rate.toFixed(3)}`)

    // Create output AudioBuffer
    const output = this.ctx.createBuffer(
      channels,
      totalFramesExtracted,
      input.sampleRate
    )

    output.getChannelData(0).set(outputData[0].slice(0, totalFramesExtracted))
    if (channels > 1) {
      output.getChannelData(1).set(outputData[1].slice(0, totalFramesExtracted))
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

