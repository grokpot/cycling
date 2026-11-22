<script setup lang="ts">
import { computed } from 'vue'
import type { Profile, Workout, Plan } from '#shared/types'
import { ftpPercentForInterval, resolveWatts } from '#shared/targets'

const props = defineProps<{
  workout: Workout
  plan: Plan
  profile: Profile
  elapsedMs: number
  totalMs: number
  targetWatts: number | null
  upcomingLabels: string[]
}>()

const width = 360
const height = 140
const padding = 8

const blocks = computed(() => {
  let x = padding
  const total = props.workout.intervals.reduce((s, i) => s + i.durationSeconds, 0)
  const inner = width - padding * 2
  return props.workout.intervals.map((interval) => {
    const w = (interval.durationSeconds / total) * inner
    const watts = resolveWatts(interval, props.profile, props.plan.intensityScale)
    const ftpPct = ftpPercentForInterval(interval, props.profile)
    const hard = props.profile.ftp && watts ? watts >= props.profile.ftp * 0.9 : ftpPct !== null && ftpPct >= 90
    const rect = { x, w, hard, watts: watts ?? 0 }
    x += w
    return rect
  })
})

const maxWatts = computed(() => Math.max(...blocks.value.map((b) => b.watts), props.profile.ftp ?? 200, 1))

const playheadX = computed(() => {
  if (props.totalMs <= 0) {
    return padding
  }
  return padding + ((width - padding * 2) * props.elapsedMs) / props.totalMs
})

const targetY = computed(() => {
  if (props.targetWatts === null) {
    return height / 2
  }
  return height - padding - (props.targetWatts / maxWatts.value) * (height - padding * 2)
})
</script>

<template>
  <div class="relative w-full">
    <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto rounded-lg border border-default">
      <rect
        v-for="(b, idx) in blocks"
        :key="idx"
        :x="b.x"
        :y="height - padding - (b.watts / maxWatts) * (height - padding * 2)"
        :width="b.w"
        :height="(b.watts / maxWatts) * (height - padding * 2)"
        :fill="b.hard ? '#f59e0b' : '#3b82f6'"
        opacity="0.85"
      />
      <rect
        :x="padding"
        :y="padding"
        :width="playheadX - padding"
        :height="height - padding * 2"
        fill="#94a3b8"
        opacity="0.2"
      />
      <line
        :x1="playheadX"
        :x2="playheadX"
        :y1="padding"
        :y2="height - padding"
        stroke="#0f172a"
        stroke-width="2"
      />
      <line
        :x1="padding"
        :x2="width - padding"
        :y1="targetY"
        :y2="targetY"
        stroke="#0f172a"
        stroke-dasharray="4 4"
        stroke-width="1"
      />
    </svg>
    <div class="absolute top-2 right-2">
      <UPopover>
        <UButton
          icon="i-lucide-list-music"
          variant="subtle"
          color="neutral"
          size="sm"
        />
        <template #content>
          <ul class="p-3 text-body-sm max-w-xs space-y-1">
            <li v-for="(label, i) in upcomingLabels" :key="i">
              {{ label }}
            </li>
            <li v-if="upcomingLabels.length === 0" class="text-muted">
              No upcoming cues
            </li>
          </ul>
        </template>
      </UPopover>
    </div>
  </div>
</template>