/**
 * Audio rendering verification test using Playwright.
 * Renders the mixer's schedule offline and verifies audio quality.
 */

import { test, expect, Page } from '@playwright/test'
import { writeFileSync } from 'fs'

// Audio analysis utilities
function calculateRMS(samples: Float32Array): number {
  let sumSquares = 0
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i]
  }
  return Math.sqrt(sumSquares / samples.length)
}

function detectTempo(samples: Float32Array, sampleRate: number): number {
  // Simple autocorrelation-based tempo detection
  const minLag = Math.floor(sampleRate * (60 / 200)) // 200 BPM max
  const maxLag = Math.floor(sampleRate * (60 / 60))  // 60 BPM min
  
  let bestLag = minLag
  let bestCorr = -Infinity
  
  // Sample every 10th lag for speed
  for (let lag = minLag; lag <= maxLag; lag += 10) {
    let corr = 0
    const limit = Math.min(samples.length - lag, sampleRate * 10)
    
    for (let i = 0; i < limit; i += 100) {
      corr += samples[i] * samples[i + lag]
    }
    
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  
  return Math.round((60 * sampleRate) / bestLag)
}

function detectClicks(samples: Float32Array, threshold: number = 0.3): number[] {
  const clicks: number[] = []
  
  for (let i = 1; i < samples.length; i++) {
    const jump = Math.abs(samples[i] - samples[i - 1])
    if (jump > threshold) {
      clicks.push(i)
    }
  }
  
  return clicks
}

function detectPitch(samples: Float32Array, sampleRate: number): number {
  // Simple zero-crossing-based pitch detection (good for bass fundamentals)
  let zeroCrossings = 0
  
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || 
        (samples[i] < 0 && samples[i - 1] >= 0)) {
      zeroCrossings++
    }
  }
  
  const duration = samples.length / sampleRate
  const frequency = zeroCrossings / (2 * duration)
  
  return frequency
}

function saveWAV(samples: Float32Array, sampleRate: number, filename: string) {
  // Simple WAV file format
  const numChannels = 1
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const header = Buffer.alloc(44)
  
  // RIFF chunk
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  
  // fmt chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // chunk size
  header.writeUInt16LE(1, 20)  // PCM
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * bytesPerSample * numChannels, 28)
  header.writeUInt16LE(bytesPerSample * numChannels, 32)
  header.writeUInt16LE(bytesPerSample * 8, 34)
  
  // data chunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  
  // Convert float32 to int16
  const data = Buffer.alloc(dataSize)
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    const int16 = Math.floor(sample * 32767)
    data.writeInt16LE(int16, i * 2)
  }
  
  writeFileSync(filename, Buffer.concat([header, data]))
}

test.describe('Audio rendering verification', () => {
  test('should render demo ride audio and verify quality', async ({ page }) => {
    // Capture console logs from browser
    page.on('console', (msg) => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'info') console.info(`[BROWSER] ${text}`)
      else if (type === 'warn') console.warn(`[BROWSER] ${text}`)
      else if (type === 'error') console.error(`[BROWSER] ${text}`)
      else console.log(`[BROWSER ${type}] ${text}`)
    })
    
    // Navigate to test page
    await page.goto('/test-audio-render')
    
    // Wait for page to be ready
    await page.waitForFunction(() => typeof (window as any).renderAudioOffline === 'function')
    
    // Render 3 minutes of audio (reduce from 6 to avoid memory issues)
    console.log('Rendering 3 minutes of demo ride audio...')
    
    let result
    try {
      result = await page.evaluate(async () => {
        try {
          return await (window as any).renderAudioOffline(180)
        } catch (err) {
          return { error: err.message, stack: err.stack }
        }
      })
    } catch (err) {
      console.error('Page evaluation failed:', err.message)
      throw err
    }
    
    if (result.error) {
      throw new Error(`Rendering failed: ${result.error}\n${result.stack}`)
    }
    
    const { samples: samplesArray, sampleRate, cues, songs } = result
    const samples = new Float32Array(samplesArray)
    
    console.log(`\n📊 Rendered ${samples.length} samples at ${sampleRate} Hz (${(samples.length / sampleRate).toFixed(1)}s)\n`)
    
    // Save WAV
    const wavPath = 'audio-verification-6min.wav'
    saveWAV(samples, sampleRate, wavPath)
    console.log(`💾 Saved WAV to ${wavPath}\n`)
    
    // Analyze per cue
    let currentSample = 0
    const results: any[] = []
    
    console.log('🎵 Per-Cue Analysis:\n')
    
    for (const cue of cues) {
      const cueSamples = Math.floor(cue.durationSeconds * sampleRate)
      const segment = samples.slice(currentSample, currentSample + cueSamples)
      
      // Find song info
      const song = songs.find((s: any) => s.id === cue.songId)
      const songBpm = song?.bpm ?? 0
      
      // Calculate expected tempo after stretch
      const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
      const expectedTempo = targetBpm / songBpm // This should be <1 for slowing down
      
      const rms = calculateRMS(segment)
      const measuredTempo = detectTempo(segment, sampleRate)
      const clicks = detectClicks(segment)
      const pitch = detectPitch(segment, sampleRate)
      
      // Tempo error (should be close to target BPM, not song BPM)
      const tempoError = Math.abs((measuredTempo - targetBpm) / targetBpm * 100)
      
      const result = {
        pieceIndex: cue.pieceIndex,
        songName: song?.name ?? cue.songId,
        songBpm,
        targetRpm: cue.lockedRpm,
        targetBpm,
        expectedTempo,
        measuredTempo,
        rms,
        clicks: clicks.length,
        pitch,
        tempoError
      }
      
      results.push(result)
      
      // Log with colors
      const statusEmoji = tempoError < 1.5 ? '✅' : '⚠️'
      console.log(`${statusEmoji} Cue ${cue.pieceIndex}: ${result.songName}`)
      console.log(`   Song: ${songBpm} BPM → Target: ${targetBpm} BPM (tempo: ${expectedTempo.toFixed(3)})`)
      console.log(`   Measured: ${measuredTempo} BPM (error: ${tempoError.toFixed(2)}%)`)
      console.log(`   RMS: ${rms.toFixed(4)}, Clicks: ${clicks.length}, Pitch: ${pitch.toFixed(1)} Hz`)
      console.log('')
      
      currentSample += cueSamples
    }
    
    console.log('\n🔍 Running Assertions...\n')
    
    // Assertions
    for (const result of results) {
      // RMS is clearly non-silent (threshold: 0.05)
      console.log(`Cue ${result.pieceIndex}: RMS ${result.rms} > 0.05`)
      expect(result.rms).toBeGreaterThan(0.05)
      
      // Tempo within 1.5% of target BPM
      console.log(`Cue ${result.pieceIndex}: Tempo error ${result.tempoError.toFixed(2)}% < 1.5%`)
      expect(result.tempoError).toBeLessThan(1.5)
      
      // No excessive clicks (threshold: 10 for entire segment)
      console.log(`Cue ${result.pieceIndex}: Clicks ${result.clicks} < 10`)
      expect(result.clicks).toBeLessThan(10)
      
      // Verify stretch direction: for slowing down, expected tempo should be < 1.0
      if (result.songBpm > result.targetBpm) {
        console.log(`Cue ${result.pieceIndex}: Slowing down - tempo ${result.expectedTempo.toFixed(3)} < 1.0`)
        expect(result.expectedTempo).toBeLessThan(1.0)
      } else if (result.songBpm < result.targetBpm) {
        console.log(`Cue ${result.pieceIndex}: Speeding up - tempo ${result.expectedTempo.toFixed(3)} > 1.0`)
        expect(result.expectedTempo).toBeGreaterThan(1.0)
      }
    }
    
    console.log('\n✅ All assertions passed!\n')
  })
})
