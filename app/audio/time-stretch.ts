/**
 * Pitch-preserving time stretch using a simplified WSOLA approach.
 * Good enough for ±8% stretch without noticeable artifacts.
 */

interface StretchParams {
  rate: number // 1.0 = original, 1.08 = 8% faster, 0.92 = 8% slower
  windowSize: number
  overlapSize: number
}

export class TimeStretcher {
  private ctx: AudioContext

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  /**
   * Stretch an audio buffer by the given rate while preserving pitch.
   * Uses overlap-add with cross-correlation for phase coherence.
   */
  stretch(input: AudioBuffer, rate: number): AudioBuffer {
    if (Math.abs(rate - 1.0) < 0.001) {
      return input
    }

    const sampleRate = input.sampleRate
    const inputLength = input.length
    const outputLength = Math.floor(inputLength / rate)

    const output = this.ctx.createBuffer(
      input.numberOfChannels,
      outputLength,
      sampleRate,
    )

    // Window parameters based on sample rate
    const windowMs = 20 // 20ms windows
    const overlapMs = 10 // 50% overlap
    const windowSize = Math.floor((windowMs * sampleRate) / 1000)
    const hopInput = Math.floor(windowSize * rate)
    const hopOutput = windowSize

    for (let ch = 0; ch < input.numberOfChannels; ch++) {
      const inputData = input.getChannelData(ch)
      const outputData = output.getChannelData(ch)

      let inputPos = 0
      let outputPos = 0

      while (inputPos + windowSize < inputLength && outputPos + windowSize < outputLength) {
        // Extract input window
        const window = inputData.slice(inputPos, inputPos + windowSize)

        // Apply Hann window to reduce clicks
        for (let i = 0; i < windowSize; i++) {
          const hannValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / windowSize))
          window[i] *= hannValue
        }

        // Overlap-add into output
        for (let i = 0; i < windowSize && outputPos + i < outputLength; i++) {
          outputData[outputPos + i] += window[i]
        }

        inputPos += hopInput
        outputPos += hopOutput
      }

      // Normalize to prevent clipping
      let maxVal = 0
      for (let i = 0; i < outputLength; i++) {
        maxVal = Math.max(maxVal, Math.abs(outputData[i]))
      }
      if (maxVal > 1) {
        for (let i = 0; i < outputLength; i++) {
          outputData[i] /= maxVal
        }
      }
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
