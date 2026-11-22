<script setup lang="ts">
import { useWorkoutStore } from '~/repositories/workout-store'
import { createDemoWorkout, createDemoSongs } from '~/utils/demo-data'

definePageMeta({ layout: 'default' })

const router = useRouter()
const store = useWorkoutStore()
const loading = ref(false)

async function startDemo() {
  loading.value = true
  try {
    // Load demo data
    const workout = createDemoWorkout()
    await store.saveWorkout(workout)
    
    const songs = createDemoSongs()
    for (const song of songs) {
      await store.saveSong(song)
    }

    // Set a default FTP
    const profile = await store.getProfile()
    if (!profile.ftp) {
      profile.ftp = 200
      await store.saveProfile(profile)
    }

    // Navigate to the workout
    await router.push(`/workouts/${workout.id}`)
  } finally {
    loading.value = false
  }
}

async function skipToWorkouts() {
  await router.push('/')
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center p-4">
    <div class="max-w-2xl w-full space-y-8">
      <div class="text-center space-y-4">
        <UIcon name="i-lucide-bike" class="size-16 mx-auto text-primary" />
        <h1 class="text-h1">
          Welcome to Cycling
        </h1>
        <p class="text-body-lg text-muted max-w-xl mx-auto">
          Structured indoor workouts with music that follows your cadence. Each interval gets its own tempo-matched soundtrack.
        </p>
      </div>

      <UCard class="border-primary/20">
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle" class="size-5 text-success mt-0.5" />
            <div>
              <p class="font-medium">
                Try the demo ride
              </p>
              <p class="text-sm text-muted">
                30-minute interval workout with generated music at 70-180 BPM. Hear the tempo change with each interval.
              </p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle" class="size-5 text-success mt-0.5" />
            <div>
              <p class="font-medium">
                On-beat feedback
              </p>
              <p class="text-sm text-muted">
                The cadence card pulses on every beat. Match your pedal strokes to the music.
              </p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle" class="size-5 text-success mt-0.5" />
            <div>
              <p class="font-medium">
                Works offline
              </p>
              <p class="text-sm text-muted">
                All music planning and playback happens on your device. No server required.
              </p>
            </div>
          </div>
        </div>
      </UCard>

      <div class="flex flex-col gap-3">
        <UButton
          label="Start demo ride"
          size="xl"
          block
          icon="i-lucide-play"
          :loading="loading"
          @click="startDemo"
        />
        <UButton
          label="Skip to workouts"
          size="lg"
          block
          variant="ghost"
          color="neutral"
          @click="skipToWorkouts"
        />
      </div>

      <div class="text-center space-y-2">
        <p class="text-sm text-muted">
          Next steps after the demo:
        </p>
        <div class="flex flex-wrap justify-center gap-2 text-xs">
          <UBadge variant="subtle" color="neutral">
            Build your own workout
          </UBadge>
          <UBadge variant="subtle" color="neutral">
            Upload your music
          </UBadge>
          <UBadge variant="subtle" color="neutral">
            Connect a smart trainer
          </UBadge>
        </div>
      </div>
    </div>
  </div>
</template>
