<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { buildFit } from '#shared/fit'
import type { Plan, Profile, Song, Workout } from '#shared/types'
import { createFtmsTrainer } from '~/device/trainer'
import { createBleHeartRate } from '~/device/heart-rate'
import { createBluetoothFan } from '~/device/fan'
import { useRide } from '~/composables/useRide'
import { useWorkoutStore } from '~/repositories/workout-store'

definePageMeta({ layout: 'ride' })

const route = useRoute()
const router = useRouter()
const store = useWorkoutStore()

const workout = ref<Workout | null>(null)
const plan = ref<Plan | null>(null)
const profile = ref<Profile | null>(null)
const songs = ref<Song[]>([])

const controlOpen = ref(false)
const deviceOpen = ref(false)
const deviceError = ref<string | null>(null)

const ride = useRide(workout, plan, profile, songs)

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return
  }
  if (e.key === ' ' || e.key === 'k') {
    e.preventDefault()
    ride.pauseRide()
  } else if (e.key === 's') {
    e.preventDefault()
    ride.skipInterval()
  } else if (e.key === 'c') {
    e.preventDefault()
    controlOpen.value = !controlOpen.value
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

onMounted(async () => {
  const wid = String(route.params.id)
  workout.value = await store.getWorkout(wid)
  profile.value = await store.getProfile()
  songs.value = await store.listSongs()
  const planId = route.query.plan ? String(route.query.plan) : null
  plan.value =
    (planId && (await store.getPlan(planId))) ||
    (await store.getPlanForWorkout(wid))
})

const songTitle = computed(() => {
  const cue = ride.currentPiece()?.cue
  if (!cue?.songId) {
    return cue?.silence ? 'Silence' : 'No song'
  }
  const song = songs.value.find((s) => s.id === cue.songId)
  return song?.name ?? 'Song not found'
})

const musicBpm = computed(() => {
  const cue = ride.currentPiece()?.cue
  if (!cue?.songId) {
    return '—'
  }
  const song = songs.value.find((s) => s.id === cue.songId)
  if (!song?.analysis) {
    return '—'
  }
  const target = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
  return Math.round(song.analysis.bpm * (target / song.analysis.bpm))
})

const intervalLine = computed(() => {
  const rpm = ride.targetCadence()
  const watts = ride.targetWatts() ?? '—'
  const bpm = musicBpm.value
  
  // Hide RPE since it's not used in this implementation
  return `${rpm} RPM · ${bpm} BPM · ${watts} W`
})

const upcoming = computed(() => {
  return ride.pieces.value
    .slice(ride.pieceIndex.value + 1, ride.pieceIndex.value + 6)
    .map((p) => {
      const name = songs.value.find((s) => s.id === p.cue.songId)?.name
      return name ?? (p.cue.silence ? 'Silence' : 'TBD')
    })
})

const totalMs = computed(() => {
  if (!plan.value) {
    return 1
  }
  return plan.value.cues.reduce((s, c) => s + c.durationSeconds * 1000, 0)
})

const cadenceOver = computed(() => {
  return ride.sample.value.cadence > ride.targetCadence() + 3
})

async function connectTrainer() {
  deviceError.value = null
  try {
    await ride.connectFtms(createFtmsTrainer)
  } catch (e) {
    deviceError.value = e instanceof Error ? e.message : 'Trainer connect failed'
  }
}

async function connectHr() {
  deviceError.value = null
  try {
    await ride.connectHeartRate(createBleHeartRate)
  } catch (e) {
    deviceError.value = e instanceof Error ? e.message : 'HR connect failed'
  }
}

async function connectFan() {
  deviceError.value = null
  try {
  const fan = createBluetoothFan()
    await fan.connect()
  } catch (e) {
    deviceError.value = e instanceof Error ? e.message : 'Fan connect failed'
  }
}

function leaveRide() {
  void router.push(`/workouts/${route.params.id}`)
}

function downloadFit() {
  if (!workout.value) {
    return
  }
  const record = {
    id: crypto.randomUUID(),
    workoutId: workout.value.id,
    planId: plan.value?.id ?? '',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    samples: ride.rideSamples.value,
  }
  const bytes = buildFit(record, workout.value)
  const blob = new Blob([bytes], { type: 'application/vnd.ant.fit' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ride.fit'
  a.click()
  URL.revokeObjectURL(url)
}

watch(controlOpen, (open) => {
  if (open && plan.value) {
    // drawer reflects plan settings
  }
})
</script>

<template>
  <div v-if="workout && plan && profile" class="ride-screen">
    <header class="ride-header">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="sm"
        aria-label="Leave ride"
        @click="leaveRide"
      />
      <h1 class="ride-title">
        {{ workout.name }}
      </h1>
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-bluetooth"
          variant="ghost"
          size="sm"
          aria-label="Devices"
          @click="deviceOpen = true"
        />
        <UButton
          icon="i-lucide-settings"
          variant="ghost"
          size="sm"
          aria-label="Control"
          @click="controlOpen = true"
        />
      </div>
    </header>

    <div class="metrics-grid">
      <RideMetricCard
        title="Power"
        :value="`${ride.sample.value.watts} W`"
        :caption="`Target: ${ride.targetWatts() ?? '—'} W`"
      />
      <RideMetricCard
        title="Cadence"
        :value="`${ride.sample.value.cadence} RPM`"
        :caption="`Target: ${ride.targetCadence()} RPM`"
        :pulse="ride.beatPulse.value"
      />
      <RideMetricCard
        title="Heart Rate"
        :value="`${ride.sample.value.heartRate} BPM`"
        caption="Live"
      />
    </div>

    <div class="chart-container">
      <WorkoutEChartsGraph
        :workout="workout"
        :profile="profile"
        :plan="plan"
        :songs="songs"
        :elapsed-ms="ride.elapsedMs.value"
        :intensity-scale="plan.intensityScale"
        interactive
        @seek="ride.seekTo"
      />
    </div>

    <RideIntervalBar
      :piece-remaining="ride.formatMs(ride.remainingPieceMs())"
      :line="intervalLine"
      :song-title="songTitle"
    />
    
    <div class="controls">
      <UButton
        label="Skip"
        variant="soft"
        color="neutral"
        icon="i-lucide-skip-forward"
        @click="ride.skipInterval()"
      />
      <UButton
        :icon="ride.paused.value ? 'i-lucide-play' : 'i-lucide-pause'"
        size="xl"
        variant="soft"
        color="neutral"
        class="pause-button"
        :aria-label="ride.paused.value ? 'Resume' : 'Pause'"
        @click="ride.pauseRide()"
      />
      <UButton
        label="Control"
        variant="soft"
        color="neutral"
        icon="i-lucide-sliders-horizontal"
        @click="controlOpen = true"
      />
    </div>

    <footer class="ride-footer">
      <div class="flex items-center gap-2">
        <UBadge 
          v-if="ride.audioReady.value" 
          color="success" 
          variant="subtle"
          size="xs"
        >
          Audio ready
        </UBadge>
        <UBadge 
          v-else 
          color="neutral" 
          variant="subtle"
          size="xs"
        >
          Loading audio...
        </UBadge>
      </div>
      <UButton
        label="Download .fit"
        variant="ghost"
        size="xs"
        icon="i-lucide-download"
        @click="downloadFit"
      />
      <p class="keyboard-hints">
        Space: pause · S: skip · C: control
      </p>
    </footer>

    <RideControlDrawer
      v-model:open="controlOpen"
      :intensity-scale="plan.intensityScale"
      :fan-mode="plan.fanMode"
      :drops-enabled="plan.dropsEnabled"
      @skip-song="ride.skipSong()"
    />

    <RideDeviceSheet
      v-model:open="deviceOpen"
      :trainer-label="ride.trainerConnected.value ? 'Connected' : 'Disconnected'"
      hr-label="Optional"
      fan-label="Not confirmed"
      :error="deviceError"
      @connect-trainer="connectTrainer"
      @connect-hr="connectHr"
      @connect-fan="connectFan"
    />
  </div>
  <div v-else class="ride-screen">
    <div class="empty-state">
      <p>Ride not ready</p>
    </div>
  </div>
</template>

<style scoped>
.ride-screen {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
  overflow: hidden;
}

.ride-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
  margin-bottom: 1.5rem;
}

.ride-title {
  font-size: 1.125rem;
  font-weight: 600;
  text-align: center;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex-shrink: 0;
  margin-bottom: 1.5rem;
}

.chart-container {
  flex: 1;
  min-height: 0;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
  padding: 1rem 0;
}

.pause-button {
  min-width: 56px;
  min-height: 56px;
  border-radius: 9999px;
}

.ride-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.keyboard-hints {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .ride-screen {
    padding: 0.75rem;
  }
  
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  
  .metrics-grid > :nth-child(3) {
    grid-column: 1 / -1;
  }
}
</style>