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
const isFirstVisit = useState('first-visit', () => true)

async function load() {
  workouts.value = await store.listWorkouts()
  
  // Redirect to welcome if first visit and no workouts
  if (isFirstVisit.value && workouts.value.length === 0) {
    isFirstVisit.value = false
    await router.push('/welcome')
  }
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
  <div class="flex flex-col h-screen">
    <UDashboardNavbar title="Workouts" />
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 max-w-4xl mx-auto space-y-4">
        <div class="flex flex-wrap gap-2">
          <UButton
            to="/workouts/new"
            label="New Workout"
            icon="i-lucide-plus"
          />
          <UFileUpload
            accept=".zwo"
            label="Import .zwo"
            icon="i-lucide-upload"
            @update:model-value="onZwo"
          />
          <UButton
            v-if="workouts.length === 0"
            label="Load Demo"
            icon="i-lucide-lightbulb"
            variant="soft"
            @click="loadDemoData"
          />
        </div>
        <UEmpty
          v-if="workouts.length === 0"
          icon="i-lucide-bike"
          title="No workouts yet"
          description="Start with the demo, import a Zwift .zwo file, or build your first workout."
          :actions="[
            { label: 'Load Demo', onClick: loadDemoData, icon: 'i-lucide-lightbulb' },
            { label: 'Import .zwo', icon: 'i-lucide-upload' },
          ]"
        />
        <div v-else class="grid gap-3">
          <UCard
            v-for="w in workouts"
            :key="w.id"
            class="cursor-pointer hover:bg-accented/5 transition-colors"
            @click="router.push(`/workouts/${w.id}`)"
          >
            <div class="flex justify-between items-start gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="text-h3 font-semibold truncate">
                  {{ w.name }}
                </h3>
                <p class="text-caption text-muted mt-1">
                  {{ workoutMeta(w) }}
                </p>
              </div>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-play"
                aria-label="Start workout"
                size="lg"
              />
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>