/** Create test WAV audio files for Playwright tests */
const fs = require('fs')
const path = require('path')

function createWav(bpm, duration, filename) {
  const sampleRate = 44100
  const samples = sampleRate * duration
  const channels = 1
  const bytesPerSample = 2
  const dataSize = samples * channels * bytesPerSample

  const buffer = Buffer.alloc(44 + dataSize)
  
  // WAV header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // fmt chunk size
  buffer.writeUInt16LE(1, 20) // audio format (PCM)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28) // byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32) // block align
  buffer.writeUInt16LE(bytesPerSample * 8, 34) // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Simple sine wave at BPM frequency
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    const freq = bpm / 60
    const value = Math.sin(2 * Math.PI * freq * t) * 16000
    buffer.writeInt16LE(value, 44 + i * bytesPerSample)
  }

  fs.writeFileSync(path.join(__dirname, filename), buffer)
  console.log(`Created ${filename} (${bpm} BPM, ${duration}s)`)
}

// Create test songs
createWav(80, 15, 'song-80bpm.wav')
createWav(90, 15, 'song-90bpm.wav')
createWav(100, 15, 'song-100bpm.wav')
