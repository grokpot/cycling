<!--
Song timeline under interval graph: segments for each cue with title, BPM, crossfades.
Clicking a segment seeks to that position.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Plan, Song } from '#shared/types'

const props = defineProps<{
  plan: Plan
  songs: Song[]
  elapsedMs: number
}>()

const emit = defineEmits<{
  seek: [elapsedMs: number]
}>()

interface Segment {
  cue: Plan['cues'][number]
  songName: string
  bpm: number
  startMs: number
  widthPercent: number
  color: string
  crossfadeStartPercent: number
  crossfadeEndPercent: number
}

const totalMs = computed(() => 
  props.plan.cues.reduce((s, c) => s + c.durationSeconds * 1000, 0)
)

const segments = computed((): Segment[] => {
  let currentMs = 0
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
  
  return props.plan.cues.map((cue, index) => {
    const song = props.songs.find(s => s.id === cue.songId)
    const durationMs = cue.durationSeconds * 1000
    const widthPercent = (durationMs / totalMs.value) * 100
    
    const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm
    const crossfadeBeats = cue.crossfadeBeats || 4
    const beatDurationMs = (60 / cue.lockedRpm) * 1000
    const crossfadeDurationMs = crossfadeBeats * beatDurationMs
    
    const crossfadeStartPercent = index > 0 ? (crossfadeDurationMs / durationMs) * 100 : 0
    const crossfadeEndPercent = index < props.plan.cues.length - 1 
      ? (crossfadeDurationMs / durationMs) * 100 
      : 0
    
    const segment = {
      cue,
      songName: song?.name ?? (cue.silence ? 'Silence' : 'No song'),
      bpm: Math.round(targetBpm),
      startMs: currentMs,
      widthPercent,
      color: colors[index % colors.length],
      crossfadeStartPercent,
      crossfadeEndPercent,
    }
    
    currentMs += durationMs
    return segment
  })
})

function handleSegmentClick(segment: Segment) {
  emit('seek', segment.startMs + 100)
}
</script>

<template>
  <div class="relative">
    <div class="text-xs text-muted mb-1 font-medium">Music Timeline</div>
    <div class="relative h-12 bg-background border border-hairline rounded-lg flex overflow-hidden">
      <div
        v-for="(segment, index) in segments"
        :key="index"
        class="relative group cursor-pointer transition-opacity hover:opacity-80"
        :style="{ width: `${segment.widthPercent}%` }"
        @click="handleSegmentClick(segment)"
      >
        <!-- Main segment -->
        <div 
          class="absolute inset-0 flex items-center justify-center"
          :style="{ backgroundColor: segment.color, opacity: 0.3 }"
        >
          <div class="text-xs font-medium text-center px-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {{ segment.widthPercent > 8 ? segment.songName : '' }}
            <span v-if="segment.widthPercent > 12" class="text-muted"> · {{ segment.bpm }} BPM</span>
          </div>
        </div>
        
        <!-- Crossfade in (from previous song) -->
        <div 
          v-if="segment.crossfadeStartPercent > 0"
          class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/20 to-transparent"
          :style="{ width: `${segment.crossfadeStartPercent}%` }"
        />
        
        <!-- Crossfade out (to next song) -->
        <div 
          v-if="segment.crossfadeEndPercent > 0"
          class="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black/20 to-transparent"
          :style="{ width: `${segment.crossfadeEndPercent}%` }"
        />
        
        <!-- Border between segments -->
        <div 
          v-if="index < segments.length - 1"
          class="absolute right-0 top-0 bottom-0 w-px bg-hairline"
        />
        
        <!-- Tooltip on hover -->
        <div class="absolute left-1/2 -translate-x-1/2 -top-14 bg-background border border-default rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
          <div class="font-medium">{{ segment.songName }}</div>
          <div class="text-muted">{{ segment.bpm }} BPM · {{ segment.cue.durationSeconds }}s</div>
          <div v-if="segment.cue.drop" class="text-xs text-warning">Drop on boundary</div>
        </div>
      </div>
      
      <!-- Playhead -->
      <div
        class="absolute top-0 bottom-0 w-0.5 bg-black pointer-events-none"
        :style="{ left: `${(elapsedMs / totalMs) * 100}%` }"
      />
    </div>
  </div>
</template>
