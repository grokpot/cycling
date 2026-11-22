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

    // Check input buffer validity
    const inputChannel = input.getChannelData(0)
    let inputRMS = 0
    for (let i = 0; i < Math.min(inputChannel.length, 1000); i++) {
      inputRMS += inputChannel[i] * inputChannel[i]
    }
    inputRMS = Math.sqrt(inputRMS / Math.min(inputChannel.length, 1000))
    console.info(`SoundTouch input: ${input.length} frames, first 1000 samples RMS: ${inputRMS.toFixed(4)}`)
    console.info(`Input first 10 samples:`, Array.from(inputChannel.slice(0, 10).map(v => v.toFixed(4))))

    try {
      const soundtouch = new SoundTouch()
      
      // Set sample rate if available
      if ('setParameters' in soundtouch && typeof (soundtouch as any).setParameters === 'function') {
        (soundtouch as any).setParameters(input.sampleRate)
      }
      
      soundtouch.tempo = rate
      soundtouch.pitch = 1.0

      console.info(`SoundTouch configured: tempo=${rate}, pitch=1.0, sampleRate=${input.sampleRate}`)

      // Use SimpleFilter with WebAudioBufferSource
      const source = new WebAudioBufferSource(input)
      const filter = new SimpleFilter(source, soundtouch)

      const channels = input.numberOfChannels
      const expectedOutputFrames = Math.ceil(input.length / rate) + 8192
      
      // Allocate oversized output buffers
      const outputBuffers: Float32Array[] = []
      let totalFramesExtracted = 0
      const extractBuffer = new Float32Array(4096 * 2)
      
      // Extract in chunks until filter is exhausted
      let iterations = 0
      const maxIterations = Math.ceil(expectedOutputFrames / 4096) + 100
      
      while (iterations < maxIterations) {
        const framesExtracted = filter.extract(extractBuffer, 4096)
        if (framesExtracted === 0) break
        
        // Store this chunk
        const chunkLeft = new Float32Array(framesExtracted)
        const chunkRight = new Float32Array(framesExtracted)
        
        // Deinterleave: extractBuffer is [L0, R0, L1, R1, ...]
        for (let i = 0; i < framesExtracted; i++) {
          chunkLeft[i] = extractBuffer[i * 2]
          chunkRight[i] = extractBuffer[i * 2 + 1]
        }
        
        outputBuffers.push(chunkLeft, chunkRight)
        totalFramesExtracted += framesExtracted
        iterations++
      }

      console.info(`SoundTouch: Processed ${input.length} → ${totalFramesExtracted} frames at tempo ${rate.toFixed(3)} in ${iterations} iterations`)

      if (totalFramesExtracted === 0 || iterations >= maxIterations) {
        console.warn(`SoundTouch failed: ${totalFramesExtracted} frames in ${iterations} iterations - falling back to unstretched audio`)
        return input
      }

      // Check for NaN in output
      let hasNaN = false
      let firstNaNIndex = -1
      for (let i = 0; i < outputBuffers.length; i += 2) {
        const chunk = outputBuffers[i]
        for (let j = 0; j < chunk.length; j++) {
          if (!Number.isFinite(chunk[j])) {
            hasNaN = true
            firstNaNIndex = i / 2
            console.warn(`Found NaN at chunk ${firstNaNIndex}, sample ${j}/${chunk.length}`)
            console.warn(`First 10 samples of chunk:`, Array.from(chunk.slice(0, 10)))
            break
          }
        }
        if (hasNaN) break
      }

      if (hasNaN) {
        console.warn(`SoundTouch produced NaN samples (first at chunk ${firstNaNIndex}) - falling back to unstretched audio`)
        return input
      }
      
      // Log first few samples of output for debugging
      if (outputBuffers.length > 0) {
        const firstChunk = outputBuffers[0]
        console.info(`First 10 output samples:`, Array.from(firstChunk.slice(0, 10).map(v => v.toFixed(4))))
      }

      // Create output AudioBuffer
      const output = this.ctx.createBuffer(
        channels,
        totalFramesExtracted,
        input.sampleRate
      )

      // Copy chunks to output
      const leftOut = output.getChannelData(0)
      const rightOut = channels > 1 ? output.getChannelData(1) : leftOut
      
      let offset = 0
      for (let i = 0; i < outputBuffers.length; i += 2) {
        const chunkLeft = outputBuffers[i]
        const chunkRight = outputBuffers[i + 1]
        leftOut.set(chunkLeft, offset)
        if (channels > 1) {
          rightOut.set(chunkRight, offset)
        }
        offset += chunkLeft.length
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

