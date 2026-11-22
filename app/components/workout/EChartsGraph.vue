<!--
Professional ECharts-based workout graph with songs integrated.
Used on both pre-ride and ride pages.
-->
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, CustomChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components'
import type { Workout, Profile, Plan, Song } from '#shared/types'
import { ftpPercentForInterval } from '#shared/targets'
import { formatDuration } from '#shared/format'

use([
  CanvasRenderer,
  BarChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
])

const props = withDefaults(defineProps<{
  workout: Workout
  profile: Profile
  plan?: Plan
  songs?: Song[]
  elapsedMs?: number
  interactive?: boolean
  intensityScale?: number
}>(), {
  elapsedMs: 0,
  interactive: false,
  intensityScale: 100,
})

const emit = defineEmits<{
  seek: [elapsedMs: number]
}>()

const chartRef = ref<InstanceType<typeof VChart>>()

const totalSeconds = computed(() =>
  props.workout.intervals.reduce((sum, i) => sum + i.durationSeconds, 0)
)

const elapsedSeconds = computed(() => props.elapsedMs / 1000)

// Build bar data with zone colors
const barData = computed(() => {
  let accumulatedTime = 0
  return props.workout.intervals.map((interval) => {
    const ftpPct = (ftpPercentForInterval(interval, props.profile) ?? 70) * (props.intensityScale / 100)
    const start = accumulatedTime
    const end = accumulatedTime + interval.durationSeconds
    accumulatedTime = end

    // Zone colors
    let color = '#3b82f6' // blue - recovery
    if (ftpPct >= 95) color = '#ef4444' // red - VO2 max
    else if (ftpPct >= 85) color = '#f97316' // orange - threshold
    else if (ftpPct >= 75) color = '#eab308' // yellow - tempo
    else if (ftpPct >= 60) color = '#22c55e' // green - endurance

    const cadence = interval.cadenceLow ?? interval.cadenceHigh

    return {
      value: [start, end, ftpPct, cadence, interval.id],
      itemStyle: { color },
    }
  })
})

// Build song lane data
const songData = computed(() => {
  if (!props.plan?.cues || !props.songs) return []

  let accumulatedTime = 0
  return props.plan.cues.map((cue) => {
    const song = props.songs!.find(s => s.id === cue.songId)
    const start = accumulatedTime
    const end = accumulatedTime + cue.durationSeconds
    accumulatedTime = end

    const targetBpm = cue.ratio === '2:1' ? cue.lockedRpm * 2 : cue.lockedRpm

    return {
      name: song?.name ?? (cue.silence ? 'Silence' : ''),
      value: [start, end, targetBpm],
      itemStyle: {
        color: cue.silence ? '#94a3b8' : '#8b5cf6',
        opacity: 0.3,
      },
    }
  })
})

const option = computed(() => {
  const maxFtp = Math.max(...barData.value.map(d => d.value[2]), 150)

  return {
    backgroundColor: 'transparent',
    grid: {
      left: 50,
      right: 20,
      top: 40,
      bottom: props.plan ? 80 : 40,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: totalSeconds.value,
      axisLabel: {
        formatter: (val: number) => formatDuration(val),
        color: '#a1a1a1',
      },
      axisLine: {
        lineStyle: {
          color: '#2a2a2a',
        },
      },
      splitLine: {
        lineStyle: {
          color: '#2a2a2a',
        },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: 'FTP %',
        min: 0,
        max: maxFtp,
        nameTextStyle: {
          color: '#a1a1a1',
        },
        axisLabel: {
          formatter: '{value}%',
          color: '#a1a1a1',
        },
        axisLine: {
          lineStyle: {
            color: '#2a2a2a',
          },
        },
        splitLine: {
          lineStyle: {
            color: '#2a2a2a',
          },
        },
      },
    ],
    series: [
      // Power bars
      {
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const start = api.value(0)
          const end = api.value(1)
          const ftpPct = api.value(2)
          const cadence = api.value(3)

          const startPx = api.coord([start, 0])
          const endPx = api.coord([end, ftpPct])
          const width = endPx[0] - startPx[0]
          const height = startPx[1] - endPx[1]

          const shape = {
            x: startPx[0],
            y: endPx[1],
            width,
            height,
          }

          // Cadence label above bar
          const cadenceLabel = cadence ? {
            type: 'text',
            style: {
              text: width > 30 ? `${cadence} RPM` : `${cadence}`,
              x: startPx[0] + width / 2,
              y: endPx[1] - 8,
              textAlign: 'center',
              fontSize: 11,
              fill: '#a1a1a1',
            },
          } : null

          // FTP % label on bar
          const ftpLabel = height > 20 ? {
            type: 'text',
            style: {
              text: `${Math.round(ftpPct)}%`,
              x: startPx[0] + width / 2,
              y: endPx[1] + height / 2,
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fontSize: 11,
              fontWeight: 600,
              fill: '#ffffff',
            },
          } : null

          return {
            type: 'group',
            children: [
              { type: 'rect', shape, style: api.style() },
              cadenceLabel,
              ftpLabel,
            ].filter(Boolean),
          }
        },
        data: barData.value,
        z: 2,
      },
      // Song lane
      ...(props.plan && songData.value.length > 0 ? [{
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const start = api.value(0)
          const end = api.value(1)
          const bpm = api.value(2)
          const name = params.data?.name ?? ''

          const startPx = api.coord([start, 0])
          const endPx = api.coord([end, 0])
          const width = endPx[0] - startPx[0]

          const shape = {
            x: startPx[0],
            y: startPx[1] + 10,
            width,
            height: 40,
          }

          const label = width > 50 ? {
            type: 'text',
            style: {
              text: width > 100 ? `${name} · ${bpm} BPM` : name,
              x: startPx[0] + width / 2,
              y: startPx[1] + 30,
              textAlign: 'center',
              textVerticalAlign: 'middle',
              fontSize: 10,
              fill: '#d1d5db',
              overflow: 'truncate',
              width,
            },
          } : null

          return {
            type: 'group',
            children: [
              { type: 'rect', shape, style: api.style() },
              label,
            ].filter(Boolean),
          }
        },
        data: songData.value,
        z: 1,
      }] : []),
    ],
    // Playhead
    ...(props.elapsedMs > 0 ? {
      graphic: [
        {
          type: 'line',
          z: 100,
          shape: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
          },
          style: {
            stroke: '#ffffff',
            lineWidth: 2,
          },
          onupdate: function(this: any) {
            const chart = chartRef.value?.chart
            if (!chart) return

            const point = chart.convertToPixel({ xAxisIndex: 0 }, elapsedSeconds.value)
            if (typeof point === 'number') {
              const grid = chart.getOption().grid[0]
              const top = grid.top
              const bottom = chart.getHeight() - grid.bottom
              
              this.shape.x1 = point
              this.shape.x2 = point
              this.shape.y1 = top
              this.shape.y2 = bottom
            }
          },
        },
      ],
    } : {}),
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      textStyle: {
        color: '#ffffff',
      },
      formatter: (params: any) => {
        if (params.seriesIndex === 0) {
          const [start, end, ftpPct, cadence] = params.value
          return `${Math.round(ftpPct)}% FTP<br/>${cadence ? cadence + ' RPM<br/>' : ''}${formatDuration(end - start)}`
        }
        return params.data?.name ?? ''
      },
    },
  }
})

function handleClick(event: any) {
  if (!props.interactive) return

  const chart = chartRef.value?.chart
  if (!chart) return

  const pointInGrid = [event.offsetX, event.offsetY]
  const timeValue = chart.convertFromPixel({ xAxisIndex: 0 }, pointInGrid)

  if (typeof timeValue === 'number' && timeValue >= 0 && timeValue <= totalSeconds.value) {
    emit('seek', timeValue * 1000)
  }
}

// Force chart update when elapsed changes
watch(() => props.elapsedMs, () => {
  nextTick(() => {
    chartRef.value?.chart?.resize()
  })
})
</script>

<template>
  <div :style="{ cursor: interactive ? 'pointer' : 'default' }">
    <VChart
      ref="chartRef"
      :option="option"
      :style="{ height: plan ? '350px' : '280px' }"
      autoresize
      @click="handleClick"
    />
  </div>
</template>
