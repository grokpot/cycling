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
    soundtouch.sampleRate = input.sampleRate
    soundtouch.tempo = rate
    soundtouch.pitch = 1.0

    const channels = input.numberOfChannels
    const isMono = channels === 1
    
    // Get input samples and interleave
    const leftChannel = input.getChannelData(0)
    const rightChannel = channels > 1 ? input.getChannelData(1) : leftChannel
    const interleavedInput = new Float32Array(input.length * 2)
    
    for (let i = 0; i < input.length; i++) {
      interleavedInput[i * 2] = leftChannel[i]
      interleavedInput[i * 2 + 1] = rightChannel[i]
    }

    // Feed all input samples to SoundTouch
    soundtouch.inputBuffer.putSamples(interleavedInput, 0, input.length)
    soundtouch.flush()

    // Calculate expected output length
    const expectedOutputFrames = Math.ceil(input.length / rate)
    const outputData: Float32Array[] = [
      new Float32Array(expectedOutputFrames),
      new Float32Array(expectedOutputFrames)
    ]
    
    // Extract all processed samples
    let totalFramesExtracted = 0
    const extractBuffer = new Float32Array(8192 * 2) // Interleaved stereo buffer
    
    while (true) {
      const framesExtracted = soundtouch.outputBuffer.receiveSamples(extractBuffer, 4096)
      if (framesExtracted === 0) break
      
      // Deinterleave
      for (let i = 0; i < framesExtracted; i++) {
        if (totalFramesExtracted + i < expectedOutputFrames) {
          outputData[0][totalFramesExtracted + i] = extractBuffer[i * 2]
          outputData[1][totalFramesExtracted + i] = extractBuffer[i * 2 + 1]
        }
      }
      
      totalFramesExtracted += framesExtracted
    }

    console.info(`SoundTouch: Processed ${input.length} → ${totalFramesExtracted} frames at rate ${rate.toFixed(3)}`)

    // Create output buffer
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

