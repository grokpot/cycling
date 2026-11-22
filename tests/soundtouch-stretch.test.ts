import { describe, it, expect } from 'vitest'
import { SoundTouchStretcher } from '../app/audio/soundtouch-stretch'

/** Create a synthetic sine wave AudioBuffer for testing */
function createSineBuffer(ctx: AudioContext, frequency: number, durationSeconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * durationSeconds)
  const buffer = ctx.createBuffer(2, length, sampleRate)
  
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const value = Math.sin(2 * Math.PI * frequency * t) * 0.5
    leftChannel[i] = value
    rightChannel[i] = value
  }
  
  return buffer
}

/** Calculate RMS (root mean square) energy */
function calculateRMS(samples: Float32Array): number {
  let sumSquares = 0
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i]
  }
  return Math.sqrt(sumSquares / samples.length)
}

/** Detect dominant frequency using simple peak finding */
function detectDominantFrequency(samples: Float32Array, sampleRate: number): number {
  // Count zero crossings to estimate frequency
  let crossings = 0
  for (let i = 1; i < Math.min(samples.length, sampleRate * 2); i++) {
    if ((samples[i - 1] < 0 && samples[i] >= 0) || (samples[i - 1] >= 0 && samples[i] < 0)) {
      crossings++
    }
  }
  const durationSec = Math.min(samples.length, sampleRate * 2) / sampleRate
  return crossings / (2 * durationSec)
}

describe('SoundTouchStretcher', () => {
  it('should stretch 440Hz sine wave by 1.05x without distortion', () => {
    const ctx = new OfflineAudioContext(2, 44100, 44100)
    const stretcher = new SoundTouchStretcher(ctx)
    
    // Create 1 second 440Hz sine wave
    const input = createSineBuffer(ctx, 440, 1.0)
    const inputLength = input.length
    const inputRMS = calculateRMS(input.getChannelData(0))
    
    console.log(`Input: ${inputLength} samples, RMS: ${inputRMS.toFixed(4)}`)
    
    // Stretch by 1.05x (slow down by 5%)
    const output = stretcher.stretch(input, 1.05)
    
    console.log(`Output: ${output.length} samples`)
    
    // Check output is valid
    expect(output.length).toBeGreaterThan(0)
    
    // Expected output length: input / tempo (stretch slower = more samples)
    const expectedLength = Math.floor(inputLength / 1.05)
    const lengthTolerance = expectedLength * 0.1 // 10% tolerance
    
    expect(output.length).toBeGreaterThan(expectedLength - lengthTolerance)
    expect(output.length).toBeLessThan(expectedLength + lengthTolerance)
    
    // Check for NaN samples
    const leftOut = output.getChannelData(0)
    const rightOut = output.getChannelData(1)
    
    for (let i = 0; i < output.length; i++) {
      expect(Number.isFinite(leftOut[i])).toBe(true)
      expect(Number.isFinite(rightOut[i])).toBe(true)
    }
    
    // Check RMS is preserved within 10%
    const outputRMS = calculateRMS(leftOut)
    console.log(`Output RMS: ${outputRMS.toFixed(4)}`)
    
    expect(outputRMS).toBeGreaterThan(inputRMS * 0.9)
    expect(outputRMS).toBeLessThan(inputRMS * 1.1)
    
    // Check dominant frequency is preserved (~440Hz)
    const outputFreq = detectDominantFrequency(leftOut, output.sampleRate)
    console.log(`Output frequency: ${outputFreq.toFixed(1)} Hz`)
    
    expect(outputFreq).toBeGreaterThan(420)
    expect(outputFreq).toBeLessThan(460)
  })
  
  it('should handle stretch by 0.95x (speed up)', () => {
    const ctx = new OfflineAudioContext(2, 44100, 44100)
    const stretcher = new SoundTouchStretcher(ctx)
    
    const input = createSineBuffer(ctx, 440, 1.0)
    const output = stretcher.stretch(input, 0.95)
    
    // Speeding up = fewer output samples
    const expectedLength = Math.floor(input.length / 0.95)
    expect(output.length).toBeGreaterThan(expectedLength * 0.9)
    expect(output.length).toBeLessThan(expectedLength * 1.1)
    
    // No NaN
    const samples = output.getChannelData(0)
    for (let i = 0; i < output.length; i++) {
      expect(Number.isFinite(samples[i])).toBe(true)
    }
  })
})
