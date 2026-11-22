import { computed, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import type { Cue, Plan, Profile, RideSample, Song, TrainerSample, Workout } from '#shared/types'
import { resolveWatts } from '#shared/targets'
import type { TrainerPort } from '~/device/trainer'
import { createSimulator } from '~/device/trainer'
import { createHeartRateSimulator, type HeartRatePort } from '~/device/heart-rate'
import { createFanSimulator } from '~/device/fan'
import type { FanMode } from '~/device/fan'
import { AudioMixer } from '~/audio/mixer'
import { generateDemoAudioBuffers } from '~/audio/procedural-audio'

export interface RidePiece {
  cue: Cue
  wattsStart: number | null
  wattsEnd: number | null
  durationSeconds: number
}

export function useRide(
  workout: Ref<Workout | null>,
  plan: Ref<Plan | null>,
  profile: Ref<Profile | null>,
  songs: Ref<Song[]>,
) {
  const trainer = shallowRef<TrainerPort>(createSimulator())
  const trainerConnected = useState('trainer-connected', () => true)
  const useSimulator = useState('use-simulator', () => true)
  const mixer = shallowRef(new AudioMixer())
  const audioReady = ref(false)

  const sample = ref<TrainerSample>({
    watts: 0,
    cadence: 0,
    heartRate: 120,
    crankRevs: 0,
    crankEventMs: Date.now(),
  })

  const elapsedMs = ref(0)
  const paused = ref(false)
  const pieceIndex = ref(0)
  const rideSamples = ref<RideSample[]>([])
  const beatPulse = ref(false)

  let rafId = 0
  let lastTick = 0
  let started = false
  let strapHr: number | null = null
  let unsubTrainer: (() => void) | null = null
  let unsubHr: (() => void) | null = null

  const heartRatePort = createHeartRateSimulator(() => sample.value.heartRate)

  const pieces = computed(() => {
    const w = workout.value
    const p = plan.value
    const prof = profile.value
    if (!w || !p || !prof) {
      return []
    }
    return p.cues.map((cue) => {
      const interval = w.intervals.find((i) => i.id === cue.intervalId)
      const watts = interval !== undefined
        ? resolveWatts(interval, prof, p.intensityScale)
        : null
      return {
        cue,
        wattsStart: watts,
        wattsEnd: watts,
        durationSeconds: cue.durationSeconds,
      }
    })
  })

  function currentPiece() {
    return pieces.value[pieceIndex.value] ?? null
  }

  function pieceElapsedMs() {
    let offset = 0
    for (let i = 0; i < pieceIndex.value; i++) {
      offset += pieces.value[i].durationSeconds * 1000
    }
    return elapsedMs.value - offset
  }

  function remainingWorkoutMs() {
    const total = pieces.value.reduce((s, p) => s + p.durationSeconds * 1000, 0)
    return Math.max(0, total - elapsedMs.value)
  }

  function remainingPieceMs() {
    const cur = currentPiece()
    if (!cur) {
      return 0
    }
    return Math.max(0, cur.durationSeconds * 1000 - pieceElapsedMs())
  }

  function targetWatts() {
    return currentPiece()?.wattsStart ?? null
  }

  function targetCadence() {
    return currentPiece()?.cue.lockedRpm ?? profile.value?.preferredCadence ?? 80
  }

  function tick(now: number) {
    if (!paused.value) {
      if (lastTick) {
        const delta = now - lastTick
        elapsedMs.value += delta
        const cur = currentPiece()
        if (cur && pieceElapsedMs() >= cur.durationSeconds * 1000) {
          advancePiece()
        }
        
        // Beat pulse: flash on every beat based on target cadence
        const rpm = targetCadence()
        const beatMs = (60 * 1000) / rpm
        const beatPhase = (elapsedMs.value % beatMs) / beatMs
        const wasPulsing = beatPulse.value
        beatPulse.value = beatPhase < 0.1
        
        // Trigger animation on beat transition
        if (beatPulse.value && !wasPulsing) {
          setTimeout(() => { beatPulse.value = false }, 150)
        }
      }
      lastTick = now
    } else {
      lastTick = now
    }
    rafId = requestAnimationFrame(tick)
  }

  function advancePiece() {
    if (pieceIndex.value < pieces.value.length - 1) {
      pieceIndex.value++
      applyTrainerTarget()
    }
  }

  function applyTrainerTarget() {
    trainer.value.setTargetPower(targetWatts())
    trainer.value.setCadenceHint(targetCadence())
  }

  function subscribeTrainer() {
    unsubTrainer?.()
    unsubTrainer = trainer.value.subscribe((s) => {
      sample.value = {
        ...s,
        heartRate: strapHr ?? s.heartRate,
      }
      if (!paused.value) {
        rideSamples.value.push({
          timeMs: elapsedMs.value,
          watts: s.watts,
          cadence: s.cadence,
          heartRate: strapHr ?? s.heartRate,
          crankRevs: s.crankRevs,
          crankEventMs: s.crankEventMs,
        })
      }
    })
  }

  async function loadAudio() {
    if (!plan.value || audioReady.value) {
      return
    }

    try {
      console.info('useRide: Loading audio...')
      const ctx = new AudioContext()
      
      // Generate procedural audio for demo songs
      console.info('useRide: Generating procedural audio')
      const demoBuffers = generateDemoAudioBuffers(ctx)
      for (const [id, buffer] of demoBuffers) {
        mixer.value.loadBuffer(id, buffer)
        console.info(`useRide: Loaded procedural buffer for ${id}`)
      }

      // Load uploaded audio blobs
      const { getAudioBlob } = await import('~/repositories/workout-store')
      for (const song of songs.value) {
        if (song.source === 'folder' && song.id.startsWith('upload-')) {
          console.info(`useRide: Loading uploaded file ${song.name}`)
          const blob = await getAudioBlob(song.id)
          if (blob) {
            const arrayBuffer = await blob.arrayBuffer()
            const buffer = await ctx.decodeAudioData(arrayBuffer)
            mixer.value.loadBuffer(song.id, buffer)
            console.info(`useRide: Decoded audio for ${song.name}`)
          } else {
            console.warn(`useRide: No blob found for ${song.id}`)
          }
        }
      }

      // Schedule all cues
      console.info(`useRide: Scheduling ${plan.value.cues.length} cues`)
      mixer.value.scheduleCues(plan.value.cues, songs.value)
      
      audioReady.value = true
      console.info('useRide: Audio ready!')
    } catch (error) {
      console.error('useRide: Failed to load audio', error)
      audioReady.value = false
    }
  }

  function startRide() {
    if (started || !trainerConnected.value || pieces.value.length === 0) {
      return
    }
    started = true
    applyTrainerTarget()
    trainer.value.start()
    lastTick = 0
    rafId = requestAnimationFrame(tick)
    subscribeTrainer()
    unsubHr = heartRatePort.subscribe(() => {})
    
    // Start audio
    if (audioReady.value) {
      mixer.value.start()
    }
  }

  function pauseRide() {
    paused.value = !paused.value
    if (paused.value) {
      mixer.value.pause()
    } else {
      mixer.value.resume()
    }
  }

  function skipInterval() {
    advancePiece()
    elapsedMs.value = pieces.value
      .slice(0, pieceIndex.value)
      .reduce((s, p) => s + p.durationSeconds * 1000, 0)
  }

  function skipSong() {
    mixer.value.skipSong()
  }

  function stopRide() {
    cancelAnimationFrame(rafId)
    rafId = 0
    trainer.value.stop()
    mixer.value.stop()
    unsubTrainer?.()
    unsubHr?.()
    started = false
  }

  function formatMs(ms: number) {
    const sec = Math.floor(ms / 1000)
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  async function connectSimulator() {
    trainer.value.stop()
    unsubTrainer?.()
    trainer.value = createSimulator()
    await trainer.value.connect()
    trainerConnected.value = true
    if (started) {
      applyTrainerTarget()
      trainer.value.start()
      subscribeTrainer()
    }
  }

  async function connectFtms(create: () => TrainerPort) {
    const port = create()
    await port.connect()
    trainer.value.stop()
    unsubTrainer?.()
    trainer.value = port
    trainerConnected.value = true
    if (started) {
      applyTrainerTarget()
      trainer.value.start()
      subscribeTrainer()
    }
  }

  async function connectHeartRate(create: () => HeartRatePort) {
    const port = create()
    await port.connect()
    unsubHr?.()
    unsubHr = port.subscribe((bpm) => {
      strapHr = bpm
      sample.value = { ...sample.value, heartRate: bpm }
    })
  }

  const fan = createFanSimulator()
  function setFanMode(mode: FanMode) {
    fan.setMode(mode)
  }

  watch(
    () => [workout.value, plan.value, profile.value, songs.value] as const,
    async () => {
      if (workout.value && plan.value && profile.value && songs.value.length > 0) {
        await loadAudio()
        startRide()
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stopRide()
    void trainer.value.disconnect()
    mixer.value.close()
  })

  return {
    sample,
    elapsedMs,
    paused,
    pieceIndex,
    pieces,
    currentPiece,
    targetWatts,
    targetCadence,
    remainingWorkoutMs,
    remainingPieceMs,
    formatMs,
    startRide,
    pauseRide,
    skipInterval,
    skipSong,
    stopRide,
    trainerConnected,
    useSimulator,
    connectSimulator,
    connectFtms,
    connectHeartRate,
    trainer,
    mixer,
    heartRatePort,
    fan,
    setFanMode,
    rideSamples,
    beatPulse,
    audioReady,
  }
}
