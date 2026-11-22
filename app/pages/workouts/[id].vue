<script setup lang="ts">
import { formatCadence, formatDuration, formatPower } from '#shared/format'
import { planRide } from '#shared/planner'
import { planWarnings } from '#shared/warnings'
import { autoFillRpm, ftpPercentForInterval } from '#shared/targets'
import type { Cue, Plan, PlanGap, Profile, Song, Workout } from '#shared/types'
import { createFtmsTrainer } from '~/device/trainer'
import { useWorkoutStore } from '~/repositories/workout-store'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const store = useWorkoutStore()

const workout = ref<Workout | null>(null)
const profile = ref<Profile | null>(null)
const songs = ref<Song[]>([])
const intensityScale = ref(100)
const fanMode = ref<'hr' | 'speed'>('hr')
const dropsEnabled = ref(true)
const simulatedTrainer = useState('use-simulator', () => true)
const trainerConnected = useState('trainer-connected', () => true)
const cues = ref<Cue[]>([])
const gaps = ref<PlanGap[]>([])
const resolutions = ref<Record<number, 'stretch16' | 'silence' | { cadence: number }>>({})
const planned = ref(false)

const needsFtp = computed(() =>
  workout.value?.intervals.some(
    (interval) => interval.powerKind === 'ftp_percent' || interval.powerKind === 'zone',
  ) ?? false,
)

const warnings = computed(() => {
  if (!workout.value || !profile.value) {
    return []
  }
  return planWarnings(workout.value, profile.value)
})

const startBlocker = computed(() => {
  if (!workout.value || !profile.value) {
    return ''
  }
  if (!trainerConnected.value) {
    return 'Connect a trainer, or turn the simulated trainer on.'
  }
  if (needsFtp.value && profile.value.ftp === null) {
    return 'This workout uses % FTP or zones. Set FTP in Settings before starting.'
  }
  if (gaps.value.length > 0) {
    return 'Resolve each music note before starting.'
  }
  if (!planned.value || cues.value.length === 0) {
    return 'The music plan is empty.'
  }
  return ''
})

const canStart = computed(() => startBlocker.value === '' && cues.value.length > 0)

const cueRows = computed(() =>
  cues.value.map((cue) => ({
    piece: cue.pieceIndex + 1,
    time: formatDuration(cue.durationSeconds),
    cadence: `${cue.lockedRpm} RPM`,
    song: songLabel(cue),
    stretch: cue.silence ? '—' : `${Math.round(cue.stretchPercent)}%`,
    drop: cue.drop ? 'On the boundary' : '—',
  })),
)

const cueColumns = [
  { accessorKey: 'piece', header: 'Piece' },
  { accessorKey: 'time', header: 'Time' },
  { accessorKey: 'cadence', header: 'Cadence' },
  { accessorKey: 'song', header: 'Song' },
  { accessorKey: 'stretch', header: 'Stretch' },
  { accessorKey: 'drop', header: 'Drop' },
]

function songLabel(cue: Cue): string {
  if (cue.silence) {
    return 'Silence'
  }
  if (!cue.songId) {
    return 'No song'
  }
  return songs.value.find((song) => song.id === cue.songId)?.name ?? 'Song'
}

function gapTitle(gap: PlanGap): string {
  if (gap.reason === 'missing_cadence') {
    return `Piece ${gap.pieceIndex + 1} has no cadence`
  }
  return gap.lockedRpm
    ? `No song fits ${gap.lockedRpm} RPM`
    : `No song fits piece ${gap.pieceIndex + 1}`
}

function gapDetail(gap: PlanGap): string {
  if (gap.reason === 'missing_cadence') {
    return 'Music locks to a target cadence. Fill one, type one, or ride this piece in silence.'
  }
  return 'Nothing in the library is within 8% of that tempo. Allow a wider stretch, change the cadence, or ride it in silence.'
}

function intervalLine(interval: Workout['intervals'][number]): string {
  const power =
    interval.shape === 'ramp'
      ? `${formatPower(interval.powerKind, interval.powerValue)} → ${formatPower(interval.rampEndPowerKind ?? interval.powerKind, interval.rampEndPowerValue ?? interval.powerValue)}`
      : formatPower(interval.powerKind, interval.powerValue)
  return `${formatDuration(interval.durationSeconds)} · ${power} · ${formatCadence(interval.cadenceLow, interval.cadenceHigh)}`
}

async function load() {
  const id = String(route.params.id)
  workout.value = await store.getWorkout(id)
  profile.value = await store.getProfile()
  songs.value = await store.listSongs()
  replan()
}

onMounted(load)

function replan() {
  if (!workout.value || !profile.value) {
    return
  }
  const result = planRide(workout.value, profile.value, songs.value, {
    intensityScale: intensityScale.value,
    dropsEnabled: dropsEnabled.value,
    bannedSongIds: songs.value.filter((song) => song.banned).map((song) => song.id),
    resolutions: resolutions.value,
  })
  cues.value = result.cues
  gaps.value = result.gaps
  planned.value = true
}

function autoFillCadence() {
  if (!workout.value || !profile.value) {
    return
  }
  for (const interval of workout.value.intervals) {
    if (interval.cadenceLow !== null || interval.cadenceHigh !== null) {
      continue
    }
    const pct = ftpPercentForInterval(interval, profile.value) ?? 80
    const rpm = profile.value.ftp !== null ? autoFillRpm(pct) : 80
    interval.cadenceLow = rpm
    interval.cadenceHigh = rpm
  }
  replan()
}

function resolveGap(
  pieceIndex: number,
  action: 'stretch16' | 'silence' | number,
) {
  if (action === 'stretch16' || action === 'silence') {
    resolutions.value[pieceIndex] = action
  } else if (!Number.isFinite(action)) {
    return
  } else {
    const current = resolutions.value[pieceIndex]
    const gap = gaps.value.find((item) => item.pieceIndex === pieceIndex)
    const shown = gap?.lockedRpm ?? 80
    if (
      action === shown &&
      (current === 'silence' || current === 'stretch16')
    ) {
      return
    }
    if (typeof current === 'object' && current.cadence === action) {
      return
    }
    resolutions.value[pieceIndex] = { cadence: action }
  }
  replan()
}

watch([intensityScale, dropsEnabled], replan)

watch(simulatedTrainer, (on) => {
  trainerConnected.value = on
})

async function connectTrainer() {
  try {
    const port = createFtmsTrainer()
    await port.connect()
    trainerConnected.value = true
    simulatedTrainer.value = false
  } catch (error) {
    console.warn(error)
    trainerConnected.value = false
  }
}

async function startRide() {
  if (!workout.value || !canStart.value) {
    return
  }
  const plan: Plan = {
    id: crypto.randomUUID(),
    workoutId: workout.value.id,
    intensityScale: intensityScale.value,
    dropsEnabled: dropsEnabled.value,
    fanMode: fanMode.value,
    cues: cues.value,
    gaps: [],
  }
  await store.savePlan(plan)
  await router.push(`/ride/${workout.value.id}?plan=${plan.id}`)
}
</script>

<template>
  <UDashboardNavbar :title="workout?.name ?? 'Pre-ride'" />
  <div v-if="workout && profile" class="p-4 max-w-3xl space-y-6">
    <section class="space-y-2">
      <h2 class="text-xs uppercase tracking-wide text-muted">
        Workout
      </h2>
      <UCard>
        <ul class="space-y-1 text-sm">
          <li v-for="interval in workout.intervals" :key="interval.id">
            {{ intervalLine(interval) }}
          </li>
        </ul>
      </UCard>
    </section>

    <section v-if="warnings.length" class="space-y-2">
      <h2 class="text-xs uppercase tracking-wide text-muted">
        Worth a look
      </h2>
      <UAlert
        v-for="(warning, index) in warnings"
        :key="index"
        :color="warning.tone === 'unrealistic' ? 'warning' : 'info'"
        variant="soft"
        :title="warning.title"
        :description="warning.detail"
      />
      <p class="text-sm text-muted">
        These notes do not block the ride.
      </p>
    </section>

    <section class="grid md:grid-cols-2 gap-4">
      <UCard>
        <h2 class="text-xs uppercase tracking-wide text-muted mb-3">
          This ride
        </h2>
        <div class="space-y-4">
          <UFormField
            :label="`Intensity ${intensityScale}%`"
            description="Scales watts only. Cadence stays as written."
          >
            <USlider v-model="intensityScale" :min="70" :max="120" :step="5" />
          </UFormField>
          <UFormField
            label="Drops on hard efforts"
            description="When a new song starts at 90% FTP or above."
          >
            <USwitch v-model="dropsEnabled" />
          </UFormField>
        </div>
      </UCard>
      <UCard>
        <h2 class="text-xs uppercase tracking-wide text-muted mb-3">
          Devices
        </h2>
        <div class="space-y-4">
          <UFormField
            label="Fan follows"
            description="If the strap drops, the fan uses trainer speed."
          >
            <URadioGroup
              v-model="fanMode"
              :items="[
                { label: 'Heart rate', value: 'hr' },
                { label: 'Speed', value: 'speed' },
              ]"
            />
          </UFormField>
          <UFormField
            label="Simulated trainer"
            description="Ride without a KICKR. Turn this off to require the trainer."
          >
            <USwitch v-model="simulatedTrainer" />
          </UFormField>
          <UButton
            v-if="!simulatedTrainer"
            type="button"
            label="Connect trainer"
            variant="soft"
            @click="connectTrainer"
          />
        </div>
      </UCard>
    </section>

    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xs uppercase tracking-wide text-muted">
          Music plan
        </h2>
        <UButton
          v-if="workout.intervals.some(i => i.cadenceLow === null)"
          type="button"
          label="Fill empty cadences"
          icon="i-lucide-wand-2"
          variant="soft"
          @click="autoFillCadence"
        />
      </div>

      <UAlert
        v-if="gaps.length === 0 && cueRows.length > 0"
        color="success"
        variant="soft"
        title="Music ready"
        description="All intervals have songs matched to their cadence targets."
      />

      <div v-for="gap in gaps" :key="gap.pieceIndex" class="space-y-2">
        <UAlert
          color="warning"
          variant="soft"
          :title="gapTitle(gap)"
          :description="gapDetail(gap)"
        />
        <div class="flex flex-wrap items-end gap-2">
          <UButton
            v-if="gap.reason === 'no_song'"
            type="button"
            size="sm"
            variant="soft"
            icon="i-lucide-stretch-horizontal"
            label="Allow 16% stretch"
            @click="resolveGap(gap.pieceIndex, 'stretch16')"
          />
          <UFormField v-if="gap.reason === 'no_song'" label="New RPM">
            <UInputNumber
              :model-value="gap.lockedRpm ?? 80"
              class="w-28"
              :min="40"
              :max="140"
              @update:model-value="resolveGap(gap.pieceIndex, Number($event))"
            />
          </UFormField>
          <UButton
            type="button"
            size="sm"
            variant="soft"
            icon="i-lucide-volume-x"
            label="Ride in silence"
            @click="resolveGap(gap.pieceIndex, 'silence')"
          />
        </div>
      </div>

      <UTable v-if="cueRows.length" :columns="cueColumns" :data="cueRows" />
      <UEmpty 
        v-else-if="gaps.length === 0" 
        icon="i-lucide-music"
        title="No songs planned yet" 
        description="Fill empty cadences or add tracks in the library to build a music plan."
      />
    </section>

    <div class="flex flex-wrap items-center gap-3 pt-2">
      <UButton
        type="button"
        label="Start"
        size="lg"
        :disabled="!canStart"
        @click="startRide"
      />
      <p v-if="startBlocker" class="text-sm text-muted">
        {{ startBlocker }}
      </p>
    </div>
  </div>
  <UEmpty v-else class="m-4" title="Workout not found" />
</template>
