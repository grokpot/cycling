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
    return 'This workout uses zones. Set FTP in Settings before starting.'
  }
  return ''
})

const canStart = computed(() => startBlocker.value === '')

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
  <div v-if="workout && profile" class="flex flex-col h-screen">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-hairline">
      <h1 class="text-lg font-semibold">{{ workout.name }}</h1>
      <UButton
        variant="soft"
        color="neutral"
        icon="i-lucide-pencil"
        label="Edit"
        size="sm"
        @click="router.push(`/workouts/${workout.id}/edit`)"
      />
    </div>
    
    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 max-w-4xl mx-auto space-y-6 pb-24">
        <!-- Workout visualization -->
        <WorkoutEChartsGraph :workout="workout" :profile="profile" :intensity-scale="intensityScale" :plan="plan?.cues?.length ? plan : undefined" :songs="songs" />

        <!-- Workout stats -->
        <UCard>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-caption text-muted">Duration</div>
              <div class="text-h3 font-semibold">
                {{ formatDuration(workout.intervals.reduce((sum, i) => sum + i.durationSeconds, 0)) }}
              </div>
            </div>
            <div>
              <div class="text-caption text-muted">Intervals</div>
              <div class="text-h3 font-semibold">
                {{ workout.intervals.length }}
              </div>
            </div>
            <div>
              <div class="text-caption text-muted">Music</div>
              <div class="text-h3 font-semibold">
                {{ cueRows.length > 0 ? '✓ Ready' : 'Setting up...' }}
              </div>
            </div>
          </div>
        </UCard>

        <!-- Suggestions (collapsed) -->
        <UAccordion
          v-if="warnings.length > 0 || gaps.length > 0"
          :items="[{
            label: `Suggestions (${warnings.length + gaps.length})`,
            icon: 'i-lucide-lightbulb',
            defaultOpen: false,
            slot: 'suggestions'
          }]"
        >
          <template #suggestions>
            <div class="space-y-3 pt-4">
              <!-- Warnings -->
              <UAlert
                v-for="(warning, index) in warnings"
                :key="`warning-${index}`"
                :color="warning.tone === 'unrealistic' ? 'warning' : 'info'"
                variant="soft"
                :title="warning.title"
                :description="warning.detail"
              />
              
              <!-- Music setup gaps -->
              <div v-for="gap in gaps" :key="`gap-${gap.pieceIndex}`">
                <UCard>
                  <div class="space-y-3">
                    <div>
                      <div class="font-medium">
                        Interval {{ gap.pieceIndex + 1 }}
                        <span v-if="gap.lockedRpm" class="text-muted"> · {{ gap.lockedRpm }} RPM target</span>
                      </div>
                      <p class="text-sm text-muted mt-1">
                        {{ gap.reason === 'missing_cadence' ? 'No target cadence set. Music syncs to your pedaling speed.' : 'No songs in your library match this pace.' }}
                      </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <UButton
                        v-if="gap.reason === 'missing_cadence'"
                        type="button"
                        size="sm"
                        variant="soft"
                        icon="i-lucide-wand-2"
                        label="Set target cadence"
                        @click="autoFillCadence"
                      />
                      <UButton
                        v-if="gap.reason === 'no_song'"
                        type="button"
                        size="sm"
                        variant="soft"
                        icon="i-lucide-library"
                        label="Add songs"
                        to="/library"
                      />
                      <UButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="i-lucide-volume-x"
                        label="Ride without music"
                        @click="resolveGap(gap.pieceIndex, 'silence')"
                      />
                    </div>
                  </div>
                </UCard>
              </div>
            </div>
          </template>
        </UAccordion>

        <!-- Advanced settings (collapsed by default) -->
        <UAccordion
          :items="[{
            label: 'Advanced Settings',
            icon: 'i-lucide-settings',
            defaultOpen: false,
            slot: 'advanced'
          }]"
        >
          <template #advanced>
            <div class="space-y-4 pt-4">
              <UFormField
                :label="`Intensity: ${intensityScale}%`"
                description="Scales power targets. Cadence stays as written."
              >
                <USlider v-model="intensityScale" :min="70" :max="120" :step="5" />
              </UFormField>
              
              <UFormField
                label="Beat drops on hard efforts"
                description="When a song starts at high intensity (≥90% FTP)."
              >
                <USwitch v-model="dropsEnabled" />
              </UFormField>
              
              <UFormField
                label="Fan speed follows"
                description="Heart rate is recommended. Speed works if your HRM disconnects."
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
                label="Demo mode (no trainer)"
                description="For testing without hardware. Turn off to connect a real trainer."
              >
                <USwitch v-model="simulatedTrainer" />
              </UFormField>
              
              <UButton
                v-if="!simulatedTrainer && !trainerConnected"
                type="button"
                label="Connect Bluetooth Trainer"
                icon="i-lucide-bluetooth"
                variant="soft"
                @click="connectTrainer"
              />
            </div>
          </template>
        </UAccordion>
      </div>
    </div>
    
    <!-- Fixed bottom action bar -->
    <div class="border-t border-hairline bg-background">
      <div class="p-4 max-w-4xl mx-auto flex flex-wrap items-center gap-3">
        <UButton
          type="button"
          label="Start Ride"
          size="xl"
          :disabled="!canStart"
          icon="i-lucide-play"
          @click="startRide"
        />
        <div v-if="startBlocker" class="text-sm text-muted">
          {{ startBlocker }}
        </div>
        <div v-else class="text-sm text-muted">
          {{ formatDuration(workout.intervals.reduce((sum, i) => sum + i.durationSeconds, 0)) }} · {{ cueRows.length }} songs
        </div>
      </div>
    </div>
  </div>
  
  <UEmpty v-else class="m-4" icon="i-lucide-search-x" title="Workout not found" />
</template>
