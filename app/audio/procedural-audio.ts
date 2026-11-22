/** Procedurally generate musical loops for demo (drum + bass). */

export function generateLoop(bpm: number, durationSeconds: number, ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const buffer = ctx.createBuffer(2, durationSeconds * sampleRate, sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  const beatDuration = (60 / bpm) * sampleRate
  const barDuration = beatDuration * 4

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate
    const beatPhase = (i % beatDuration) / beatDuration
    const barPhase = (i % barDuration) / barDuration
    const beatIndex = Math.floor(i / beatDuration) % 4

    // Kick drum on beats 1 and 3
    let kick = 0
    if ((beatIndex === 0 || beatIndex === 2) && beatPhase < 0.1) {
      const env = Math.exp(-beatPhase * 40)
      kick = Math.sin(2 * Math.PI * (60 + 40 * beatPhase) * t) * env * 0.6
    }

    // Snare on beats 2 and 4
    let snare = 0
    if ((beatIndex === 1 || beatIndex === 3) && beatPhase < 0.08) {
      const env = Math.exp(-beatPhase * 50)
      const noise = (Math.random() * 2 - 1) * env * 0.3
      snare = noise
    }

    // Hi-hat on eighth notes
    let hihat = 0
    const eighthPhase = (i % (beatDuration / 2)) / (beatDuration / 2)
    if (eighthPhase < 0.05) {
      const env = Math.exp(-eighthPhase * 60)
      const noise = (Math.random() * 2 - 1) * env * 0.15
      hihat = noise
    }

    // Bass line (simple root-fifth pattern)
    let bass = 0
    const baseFreq = 55 // A1
    const freq = barPhase < 0.5 ? baseFreq : baseFreq * 1.5 // root to fifth
    bass = Math.sin(2 * Math.PI * freq * t) * 0.2

    // Fade in/out at edges
    let fadeMult = 1
    const fadeSeconds = 0.05
    if (t < fadeSeconds) {
      fadeMult = t / fadeSeconds
    } else if (t > durationSeconds - fadeSeconds) {
      fadeMult = (durationSeconds - t) / fadeSeconds
    }

    const sample = (kick + snare + hihat + bass) * fadeMult * 0.7
    leftChannel[i] = sample
    rightChannel[i] = sample
  }

  return buffer
}

export function generateDemoAudioBuffers(ctx: AudioContext): Map<string, AudioBuffer> {
  const buffers = new Map<string, AudioBuffer>()
  
  // Generate loops for demo songs
  const configs = [
    { id: 'demo-song-70bpm', bpm: 70, duration: 300 },
    { id: 'demo-song-80bpm', bpm: 80, duration: 240 },
    { id: 'demo-song-90bpm', bpm: 90, duration: 240 },
    { id: 'demo-song-95bpm', bpm: 95, duration: 240 },
    { id: 'demo-song-180bpm', bpm: 180, duration: 240 },
  ]

  for (const config of configs) {
    buffers.set(config.id, generateLoop(config.bpm, config.duration, ctx))
  }

  return buffers
}
