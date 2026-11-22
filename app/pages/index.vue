<script setup lang="ts">
import { formatDuration } from '#shared/format'
import { parseZwo } from '#shared/zwo'
import type { Workout } from '#shared/types'
import { useWorkoutStore } from '~/repositories/workout-store'
import { createDemoWorkout, createDemoSongs } from '~/utils/demo-data'

definePageMeta({ layout: 'default' })

const store = useWorkoutStore()
const router = useRouter()
const toast = useToast()
const workouts = ref<Workout[]>([])

async function load() {
  workouts.value = await store.listWorkouts()
}

onMounted(load)

function workoutMeta(workout: Workout): string {
  const seconds = workout.intervals.reduce(
    (total, interval) => total + interval.durationSeconds,
    0,
  )
  const count = workout.intervals.length
  const steps = count === 1 ? '1 step' : `${count} steps`
  const source = workout.source === 'zwo' ? 'Imported' : 'Built here'
  return `${formatDuration(seconds)} · ${steps} · ${source}`
}

async function onZwo(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files
  if (!file) {
    return
  }
  const text = await file.text()
  const workout = parseZwo(text)
  await store.saveWorkout(workout)
  await load()
}

async function loadDemoData() {
  const workout = createDemoWorkout()
  await store.saveWorkout(workout)
  const songs = createDemoSongs()
  for (const song of songs) {
    await store.saveSong(song)
  }
  toast.add({ 
    title: 'Demo data loaded', 
    description: 'Added demo workout and 5 demo songs',
    color: 'success' 
  })
  await load()
}
</script>

<template>
  <UDashboardNavbar title="Workouts" />
  <div class="p-4 space-y-4">
    <div class="flex flex-wrap gap-2">
      <UButton
        to="/workouts/new"
        label="New workout"
        icon="i-lucide-plus"
      />
      <UFileUpload
        accept=".zwo"
        label="Import .zwo"
        @update:model-value="onZwo"
      />
      <UButton
        label="Load demo data"
        icon="i-lucide-lightbulb"
        variant="soft"
        color="neutral"
        @click="loadDemoData"
      />
    </div>
    <UEmpty
      v-if="workouts.length === 0"
      title="No workouts yet"
      description="Import a .zwo file or build a workout."
      :actions="[
        { label: 'New workout', to: '/workouts/new' },
      ]"
    />
    <div v-else class="space-y-2">
      <UCard
        v-for="w in workouts"
        :key="w.id"
        class="cursor-pointer"
        @click="router.push(`/workouts/${w.id}`)"
      >
        <div class="flex justify-between items-center gap-2">
          <div>
            <p class="text-body font-medium">
              {{ w.name }}
            </p>
            <p class="text-caption text-muted">
              {{ workoutMeta(w) }}
            </p>
          </div>
          <UButton
            :to="`/workouts/${w.id}`"
            variant="ghost"
            color="neutral"
            icon="i-lucide-chevron-right"
            aria-label="Open workout"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>