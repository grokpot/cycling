<script setup lang="ts">
/**
 * Test page for rendering audio offline.
 * Used by Playwright tests to verify audio quality.
 */

import { AudioMixer } from '~/audio/mixer'
import { generateDemoAudioBuffers } from '~/audio/procedural-audio'
import { createDemoWorkout, createDemoSongs } from '~/utils/demo-data'
import { planRide } from '#shared/planner'

definePageMeta({ layout: false })

// Expose rendering function to window for test access
onMounted(() => {
  (window as any).renderAudioOffline = async (durationSeconds: number) => {
    console.info(`Starting offline render for ${durationSeconds}s...`)
    
    // Create demo data
    const workout = createDemoWorkout()
    const songs = createDemoSongs()
    const profile = {
      id: 'test',
      ftp: 200,
      preferredCadence: 80,
      zoneTable: { 1: 55, 2: 75, 3: 85, 4: 95, 5: 105, 6: 120, 7: 150 },
      rpeTable: { 1: 50, 2: 60, 3: 70, 4: 80, 5: 90, 6: 100, 7: 110, 8: 120, 9: 130, 10: 140 },
      genres: []
    }
    
    // Plan ride
    const plan = planRide(workout, profile, songs, {
      intensityScale: 100,
      dropsEnabled: true
    })
    
    console.info(`Plan has ${plan.cues.length} cues, ${plan.gaps.length} gaps`)
    
    if (plan.gaps.length > 0) {
      throw new Error('Plan has gaps: ' + JSON.stringify(plan.gaps))
    }
    
    // Create offline context
    const sampleRate = 44100
    const totalDuration = Math.min(
      durationSeconds,
      plan.cues.reduce((s, c) => s + c.durationSeconds, 0)
    )
    const ctx = new OfflineAudioContext(1, totalDuration * sampleRate, sampleRate)
    console.info(`Created OfflineAudioContext: ${totalDuration}s at ${sampleRate} Hz`)
    
    // Generate buffers
    const demoBuffers = generateDemoAudioBuffers(ctx)
    console.info(`Generated ${demoBuffers.size} procedural audio buffers`)
    
    // Create mixer with the offline context
    const mixer = new AudioMixer(ctx)
    for (const [id, buffer] of demoBuffers) {
      mixer.loadBuffer(id, buffer)
    }
    
    mixer.scheduleCues(plan.cues, songs)
    console.info('Cues scheduled in mixer')
    
    // Schedule sources for offline rendering
    mixer.scheduleForOfflineRender()
    console.info('Sources scheduled for offline render')
    
    // Start rendering
    console.info('Starting offline rendering...')
    const renderedBuffer = await ctx.startRendering()
    console.info('Rendering complete!')
    
    // Extract samples
    const samples = renderedBuffer.getChannelData(0)
    
    return {
      samples: Array.from(samples),
      sampleRate,
      duration: totalDuration,
      cues: plan.cues.map(c => ({
        pieceIndex: c.pieceIndex,
        durationSeconds: c.durationSeconds,
        lockedRpm: c.lockedRpm,
        ratio: c.ratio,
        songId: c.songId,
      })),
      songs: songs.map(s => ({
        id: s.id,
        name: s.name,
        bpm: s.analysis?.bpm ?? 0
      }))
    }
  }
  
  console.info('Test page ready - window.renderAudioOffline() available')
})
</script>

<template>
  <div class="p-8">
    <h1 class="text-h1 mb-4">
      Audio Render Test Page
    </h1>
    <p class="text-body mb-2">
      This page exposes <code>window.renderAudioOffline(durationSeconds)</code> for Playwright tests.
    </p>
    <p class="text-body-sm text-muted">
      Open browser console and call <code>await window.renderAudioOffline(60)</code> to render 60 seconds of audio.
    </p>
  </div>
</template>
