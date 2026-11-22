<!--
Wahoo-style workout visualization: bars for intensity, cadence line/labels.
Core product vision: music locks to cadence targets.
-->
<script setup lang="ts">
import type { Workout, Profile } from '#shared/types'
import { ftpPercentForInterval } from '#shared/targets'
import { formatDuration } from '#shared/format'

const props = defineProps<{
  workout: Workout
  profile: Profile
}>()

interface Bar {
  id: string
  position: number
  widthPercent: number
  heightPercent: number
  endHeightPercent?: number
  isRamp: boolean
  color: string
  cadence: number | null
  powerLabel: string
  timeLabel: string
}

const bars = computed((): Bar[] => {
  const totalDuration = props.workout.intervals.reduce((sum, i) => sum + i.durationSeconds, 0)
  if (totalDuration === 0) return []

  let currentPosition = 0
  return props.workout.intervals.map((interval) => {
    const ftpPct = ftpPercentForInterval(interval, props.profile) ?? 70
    const widthPercent = (interval.durationSeconds / totalDuration) * 100
    const heightPercent = Math.min(100, (ftpPct / 150) * 100)
    
    let endHeightPercent: number | undefined
    let color: string
    
    if (interval.shape === 'ramp' && interval.rampEndPowerValue !== undefined) {
      const endFtpPct = ftpPercentForInterval(
        { ...interval, powerValue: interval.rampEndPowerValue, powerKind: interval.rampEndPowerKind ?? interval.powerKind },
        props.profile
      ) ?? ftpPct
      endHeightPercent = Math.min(100, (endFtpPct / 150) * 100)
    }
    
    // Color by intensity
    if (ftpPct >= 95) color = 'rgb(239 68 68)' // red-500
    else if (ftpPct >= 85) color = 'rgb(249 115 22)' // orange-500
    else if (ftpPct >= 75) color = 'rgb(234 179 8)' // yellow-500
    else if (ftpPct >= 60) color = 'rgb(34 197 94)' // green-500
    else color = 'rgb(59 130 246)' // blue-500
    
    const powerLabel = ftpPct >= 100 ? `${Math.round(ftpPct)}%` : `${Math.round(ftpPct)}%`
    const timeLabel = formatDuration(interval.durationSeconds)
    const cadence = interval.cadenceLow ?? interval.cadenceHigh
    
    const bar = {
      id: interval.id,
      position: (currentPosition / totalDuration) * 100,
      widthPercent,
      heightPercent,
      endHeightPercent,
      isRamp: interval.shape === 'ramp',
      color,
      cadence,
      powerLabel,
      timeLabel,
    }
    
    currentPosition += interval.durationSeconds
    return bar
  })
})

const maxHeight = 200

const usedZones = computed(() => {
  const zones = new Set<string>()
  for (const bar of bars.value) {
    const ftpPct = ftpPercentForInterval(
      props.workout.intervals.find(i => i.id === bar.id)!,
      props.profile
    ) ?? 70
    if (ftpPct >= 95) zones.add('vo2max')
    else if (ftpPct >= 85) zones.add('threshold')
    else if (ftpPct >= 75) zones.add('tempo')
    else if (ftpPct >= 60) zones.add('endurance')
    else zones.add('recovery')
  }
  return zones
})
</script>

<template>
  <div class="space-y-2">
    <div 
      class="relative bg-background border border-hairline rounded-lg p-4" 
      :style="{ height: `${maxHeight + 60}px` }"
    >
      <!-- Y-axis labels -->
      <div class="absolute left-0 top-4 bottom-10 w-8 flex flex-col justify-between text-xs text-muted">
        <span>150%</span>
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      
      <!-- Graph area -->
      <div class="ml-10 h-full relative">
        <!-- Baseline grid lines -->
        <div class="absolute inset-x-0 bottom-10 h-px bg-hairline" />
        <div class="absolute inset-x-0 bottom-1/3 h-px bg-hairline opacity-30" />
        <div class="absolute inset-x-0 bottom-2/3 h-px bg-hairline opacity-30" />
        
        <!-- Bars container -->
        <div class="absolute inset-x-0 bottom-10 flex" :style="{ height: `${maxHeight}px` }">
          <div
            v-for="bar in bars"
            :key="bar.id"
            class="relative group"
            :style="{ 
              width: `${bar.widthPercent}%`,
              marginLeft: bar.position > 0 ? '1px' : '0'
            }"
          >
            <!-- Bar (rectangle or trapezoid for ramps) -->
            <div 
              class="absolute bottom-0 left-0 right-0 transition-opacity hover:opacity-80 rounded-t"
              :style="{ 
                background: bar.color,
                height: `${bar.heightPercent}%`,
                clipPath: bar.isRamp && bar.endHeightPercent 
                  ? `polygon(0 ${100 - bar.heightPercent}%, 100% ${100 - (bar.endHeightPercent ?? bar.heightPercent)}%, 100% 100%, 0 100%)`
                  : undefined
              }"
            />
            
            <!-- Cadence label above bar -->
            <div 
              v-if="bar.cadence"
              class="absolute left-1/2 -translate-x-1/2 -top-5 font-medium whitespace-nowrap text-gray-700 dark:text-gray-200"
              :style="{ 
                fontSize: bar.widthPercent < 8 ? '10px' : '12px'
              }"
            >
              {{ bar.widthPercent < 8 ? bar.cadence : `${bar.cadence} RPM` }}
            </div>
            
            <!-- Power label on bar (only show if height > 20%) -->
            <div 
              v-if="bar.heightPercent > 20"
              class="absolute left-1/2 -translate-x-1/2 bottom-2 text-xs font-medium text-white opacity-70"
            >
              {{ bar.powerLabel }}
            </div>
            
            <!-- Time label below -->
            <div class="absolute left-1/2 -translate-x-1/2 -bottom-6 text-xs text-muted whitespace-nowrap">
              {{ bar.timeLabel }}
            </div>
            
            <!-- Tooltip on hover -->
            <div class="absolute left-1/2 -translate-x-1/2 -top-12 bg-background border border-default rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              <div class="font-medium">{{ bar.powerLabel }}</div>
              <div v-if="bar.cadence" class="text-muted">{{ bar.cadence }} RPM</div>
              <div class="text-muted">{{ bar.timeLabel }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Legend (only show zones present in workout) -->
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted justify-center">
      <div v-if="usedZones.has('recovery')" class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded bg-blue-500" />
        <span>Recovery</span>
      </div>
      <div v-if="usedZones.has('endurance')" class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded bg-green-500" />
        <span>Endurance</span>
      </div>
      <div v-if="usedZones.has('tempo')" class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded bg-yellow-500" />
        <span>Tempo</span>
      </div>
      <div v-if="usedZones.has('threshold')" class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded bg-orange-500" />
        <span>Threshold</span>
      </div>
      <div v-if="usedZones.has('vo2max')" class="flex items-center gap-1.5">
        <div class="w-3 h-3 rounded bg-red-500" />
        <span>VO2 Max</span>
      </div>
    </div>
  </div>
</template>
