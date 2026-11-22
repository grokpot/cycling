<script setup lang="ts">
import {
  formatCadence,
  formatDuration,
  formatPower,
  powerValueLabel,
} from '#shared/format'
import type { PowerKind, Workout, WorkoutInterval } from '#shared/types'
import { useWorkoutStore } from '~/repositories/workout-store'

definePageMeta({ layout: 'default' })

const route = useRoute()
const store = useWorkoutStore()
const router = useRouter()
const toast = useToast()

const name = ref('New workout')
const intervals = ref<WorkoutInterval[]>([])
const profile = ref<any>(null)
const workoutId = ref<string>('')

const demoProfile = {
  ftp: 250,
  zones: []
}

onMounted(async () => {
  const id = String(route.params.id)
  workoutId.value = id
  const workout = await store.getWorkout(id)
  if (workout) {
    name.value = workout.name
    intervals.value = workout.intervals.map(i => ({ ...i }))
  }
  profile.value = await store.getProfile() || demoProfile
})

const powerKinds = [
  { label: '% FTP', value: 'ftp_percent' },
  { label: 'Watts', value: 'watts' },
  { label: 'Zone', value: 'zone' },
  { label: 'RPE', value: 'rpe' },
]

function blankStep(
  shape: WorkoutInterval['shape'],
  powerValue: number,
  durationSeconds: number,
  rampEndPowerValue: number | null,
): WorkoutInterval {
  return {
    id: crypto.randomUUID(),
    position: intervals.value.length,
    durationSeconds,
    powerKind: 'ftp_percent',
    powerValue,
    cadenceLow: null,
    cadenceHigh: null,
    shape,
    rampEndPowerKind: 'ftp_percent',
    rampEndPowerValue: rampEndPowerValue ?? undefined,
    rampEndCadenceLow: null,
    rampEndCadenceHigh: null,
  }
}

function addSteady() {
  intervals.value.push(blankStep('steady', 70, 300, null))
}

function addRamp() {
  intervals.value.push(blankStep('ramp', 60, 300, 90))
}

function addWarmup() {
  intervals.value.push(blankStep('ramp', 50, 600, 75))
}

function addCooldown() {
  intervals.value.push(blankStep('ramp', 60, 300, 45))
}

function removeStep(index: number) {
  intervals.value.splice(index, 1)
}

function moveStep(index: number, direction: -1 | 1) {
  const next = index + direction
  const list = intervals.value
  const current = list[index]
  const swap = list[next]
  if (!current || !swap) {
    return
  }
  list[index] = swap
  list[next] = current
}

function setPowerKind(step: WorkoutInterval, kind: PowerKind) {
  step.powerKind = kind
  step.rampEndPowerKind = kind
}

function isRange(step: WorkoutInterval): boolean {
  return (
    step.cadenceLow !== null &&
    step.cadenceHigh !== null &&
    step.cadenceLow !== step.cadenceHigh
  )
}

function setCadence(step: WorkoutInterval, value: number | null) {
  step.cadenceLow = value
  if (!isRange(step)) {
    step.cadenceHigh = value
  }
}

function setCadenceHigh(step: WorkoutInterval, value: number | null) {
  step.cadenceHigh = value
}

function toggleRange(step: WorkoutInterval, on: boolean) {
  if (!on) {
    step.cadenceHigh = step.cadenceLow
    return
  }
  const low = step.cadenceLow ?? 80
  step.cadenceLow = low
  step.cadenceHigh = low + 10
}

function setRampCadence(step: WorkoutInterval, value: number | null) {
  step.rampEndCadenceLow = value
  step.rampEndCadenceHigh = value
}

function stepTitle(step: WorkoutInterval): string {
  const start = formatPower(step.powerKind, step.powerValue)
  const power =
    step.shape === 'ramp'
      ? `${start} → ${formatPower(step.rampEndPowerKind ?? step.powerKind, step.rampEndPowerValue ?? step.powerValue)}`
      : start
  return `${formatDuration(step.durationSeconds)} · ${power} · ${formatCadence(step.cadenceLow, step.cadenceHigh)}`
}

function shapeLabel(step: WorkoutInterval): string {
  return step.shape === 'ramp' ? 'Ramp' : 'Steady'
}

async function save() {
  const workout: Workout = {
    id: workoutId.value,
    name: name.value.trim() || 'Untitled workout',
    source: 'builder',
    createdAt: new Date().toISOString(),
    intervals: intervals.value.map((interval, index) => ({
      ...interval,
      position: index,
    })),
  }
  await store.saveWorkout(workout)
  toast.add({ title: 'Workout saved', color: 'success' })
  await router.push(`/workouts/${workout.id}`)
}
</script>

<template>
  <div class="flex flex-col h-screen">
    <UDashboardNavbar title="Edit workout" />
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 max-w-4xl mx-auto space-y-6 pb-24">
    <!-- Live chart preview -->
    <WorkoutEChartsGraph
      v-if="intervals.length > 0 && profile"
      :workout="{ id: 'preview', name: name, source: 'builder', createdAt: '', intervals }"
      :profile="profile"
    />
    
    <UAlert
      color="info"
      variant="soft"
      title="Edit your workout"
      description="Each step has duration, effort (% FTP, watts, zone, or RPE), and optional cadence. Leave cadence empty to auto-fill on the pre-ride plan based on intensity."
    />
    <UForm class="space-y-4" @submit.prevent="save">
      <UFormField label="Name">
        <UInput v-model="name" />
      </UFormField>
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-wide text-muted">
          Add intervals
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton type="button" label="Steady" icon="i-lucide-minus" variant="soft" @click="addSteady" />
          <UButton type="button" label="Ramp" icon="i-lucide-trending-up" variant="soft" @click="addRamp" />
          <UButton type="button" label="Warmup" icon="i-lucide-sunrise" variant="soft" @click="addWarmup" />
          <UButton type="button" label="Cooldown" icon="i-lucide-sunset" variant="soft" @click="addCooldown" />
        </div>
      </div>

      <UEmpty
        v-if="intervals.length === 0"
        icon="i-lucide-list-plus"
        title="No steps yet"
        description="Add a steady interval, a ramp, a warmup, or a cooldown."
      />

      <UCard v-for="(step, idx) in intervals" :key="step.id">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted">
              Step {{ idx + 1 }} · {{ shapeLabel(step) }}
            </p>
            <p class="font-medium">
              {{ stepTitle(step) }}
            </p>
          </div>
          <div class="flex gap-1">
            <UButton
              type="button"
              icon="i-lucide-chevron-up"
              variant="ghost"
              color="neutral"
              aria-label="Move step up"
              :disabled="idx === 0"
              @click="moveStep(idx, -1)"
            />
            <UButton
              type="button"
              icon="i-lucide-chevron-down"
              variant="ghost"
              color="neutral"
              aria-label="Move step down"
              :disabled="idx === intervals.length - 1"
              @click="moveStep(idx, 1)"
            />
            <UButton
              type="button"
              icon="i-lucide-trash-2"
              variant="ghost"
              color="neutral"
              aria-label="Remove step"
              @click="removeStep(idx)"
            />
          </div>
        </div>

        <div class="space-y-3">
          <UFormField label="Duration (seconds)" :description="formatDuration(step.durationSeconds)">
            <UInputNumber v-model="step.durationSeconds" class="w-36" :min="1" :step="30" />
          </UFormField>

          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Effort" class="w-36">
              <USelect
                :model-value="step.powerKind"
                :items="powerKinds"
                @update:model-value="setPowerKind(step, $event as PowerKind)"
              />
            </UFormField>
            <UFormField :label="powerValueLabel(step.powerKind)" class="w-32">
              <UInputNumber v-model="step.powerValue" :min="0" />
            </UFormField>
          </div>

          <UFormField
            v-if="step.shape === 'ramp'"
            :label="`Ends at · ${powerValueLabel(step.rampEndPowerKind ?? step.powerKind)}`"
          >
            <UInputNumber v-model="step.rampEndPowerValue" class="max-w-40" :min="0" />
          </UFormField>

          <div class="flex flex-wrap items-end gap-3">
            <UFormField class="w-36" label="Cadence">
              <UInputNumber
                :model-value="step.cadenceLow ?? undefined"
                :min="40"
                :max="140"
                placeholder="Not set"
                @update:model-value="setCadence(step, $event ?? null)"
              />
            </UFormField>
            <UFormField v-if="isRange(step)" class="w-28" label="High">
              <UInputNumber
                :model-value="step.cadenceHigh ?? undefined"
                :min="40"
                :max="140"
                @update:model-value="setCadenceHigh(step, $event ?? null)"
              />
            </UFormField>
            <UFormField label="Range">
              <USwitch
                :model-value="isRange(step)"
                @update:model-value="toggleRange(step, $event)"
              />
            </UFormField>
          </div>
          <p class="text-xs text-muted -mt-1">
            One number locks the music. A range uses the midpoint.
          </p>

          <UFormField
            v-if="step.shape === 'ramp'"
            label="Cadence at the end"
            description="Leave empty to keep the starting cadence."
          >
            <UInputNumber
              class="max-w-40"
              :model-value="step.rampEndCadenceLow ?? undefined"
              :min="40"
              :max="140"
              placeholder="Same"
              @update:model-value="setRampCadence(step, $event ?? null)"
            />
          </UFormField>
        </div>
      </UCard>

      <div class="space-y-2">
        <UButton 
          type="submit" 
          label="Save workout" 
          icon="i-lucide-save"
          :disabled="intervals.length === 0" 
        />
        <UAlert
          v-if="intervals.length === 0"
          color="warning"
          variant="soft"
          title="Add at least one interval"
          description="A workout needs at least one step. Click Warmup, Steady, Ramp, or Cooldown above."
        />
        <p v-else class="text-sm text-muted">
          Total duration: {{ formatDuration(intervals.reduce((s, i) => s + i.durationSeconds, 0)) }}
        </p>
      </div>
    </UForm>
      </div>
    </div>
  </div>
</template>
