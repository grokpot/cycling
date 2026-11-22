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
  return songs.value.find((s) => s.id === cue.songId)?.name ?? cue.songId
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
  <div v-if="workout && plan && profile" class="h-dvh flex flex-col p-3 max-w-2xl mx-auto overflow-hidden">
    <header class="flex items-center justify-between gap-2 flex-shrink-0">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        aria-label="Leave ride"
        @click="leaveRide"
      />
      <h1 class="text-body font-medium truncate flex-1 text-center">
        {{ workout.name }}
      </h1>
      <div class="flex gap-1">
        <UButton
          icon="i-lucide-bluetooth"
          variant="soft"
          aria-label="Devices"
          @click="deviceOpen = true"
        />
        <UButton
          icon="i-lucide-settings"
          variant="soft"
          aria-label="Control"
          @click="controlOpen = true"
        />
      </div>
    </header>

    <div class="grid grid-cols-2 gap-2 flex-shrink-0 mt-3">
      <RideMetricCard
        title="Power"
        :value="ride.sample.value.watts"
        :caption="`Target: ${ride.targetWatts() ?? '—'} W`"
      />
      <RideMetricCard
        title="Cadence"
        :value="ride.sample.value.cadence"
        :caption="`Target: ${ride.targetCadence()} RPM`"
        :pulse="ride.beatPulse.value"
      >
        <UProgress
          :model-value="ride.sample.value.cadence"
          :max="ride.targetCadence() + 20"
          :color="cadenceOver ? 'error' : 'neutral'"
          class="mt-2"
        />
      </RideMetricCard>
      <RideMetricCard
        title="Heart rate"
        :value="ride.sample.value.heartRate"
        caption="Live BPM"
      />
      <RideMetricCard 
        title="Interval" 
        :value="ride.formatMs(ride.remainingPieceMs())"
        caption="Remaining"
      />
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-3 mt-3">
      <WorkoutIntervalGraph
        :workout="workout"
        :profile="profile"
        :elapsed-ms="ride.elapsedMs.value"
        :intensity-scale="plan.intensityScale"
        interactive
        @seek="ride.seekTo"
      />

      <RideSongLane
        :plan="plan"
        :songs="songs"
        :elapsed-ms="ride.elapsedMs.value"
        @seek="ride.seekTo"
      />

      <RideIntervalBar
        :piece-remaining="ride.formatMs(ride.remainingPieceMs())"
        :line="intervalLine"
        :song-title="songTitle"
      />
    </div>
    
    <div class="flex items-center justify-between gap-2 pt-3 flex-shrink-0 border-t border-hairline">
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
        class="rounded-full"
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

    <footer class="flex flex-col items-center gap-2 pt-3 flex-shrink-0 border-t border-hairline">
      <div class="flex items-center gap-2">
        <UBadge 
          v-if="ride.audioReady.value" 
          color="success" 
          variant="subtle"
        >
          Audio ready
        </UBadge>
        <UBadge 
          v-else 
          color="neutral" 
          variant="subtle"
        >
          Loading audio...
        </UBadge>
      </div>
      <UButton
        label="Download .fit"
        variant="ghost"
        size="sm"
        icon="i-lucide-download"
        @click="downloadFit"
      />
      <p class="text-xs text-muted">
        Space: pause · S: skip interval · C: control
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
  <UEmpty v-else title="Ride not ready" class="p-8" />
</template>