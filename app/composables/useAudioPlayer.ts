/** Simple audio player for library preview. */

import { ref, watch } from 'vue'
import type { Song } from '#shared/types'
import { getAudioBlob } from '~/repositories/workout-store'
import { generateDemoAudioBuffers } from '~/audio/procedural-audio'

export function useAudioPlayer() {
  const ctx = ref<AudioContext | null>(null)
  const currentSong = ref<Song | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const sourceNode = ref<AudioBufferSourceNode | null>(null)
  const startedAt = ref(0)
  const pausedAt = ref(0)
  
  let animationFrame: number | null = null

  function ensureContext() {
    if (!ctx.value) {
      ctx.value = new AudioContext()
    }
    if (ctx.value.state === 'suspended') {
      ctx.value.resume()
    }
  }

  function updateTime() {
    if (isPlaying.value && ctx.value && startedAt.value > 0) {
      currentTime.value = pausedAt.value + (ctx.value.currentTime - startedAt.value)
      if (currentTime.value >= duration.value) {
        stop()
      } else {
        animationFrame = requestAnimationFrame(updateTime)
      }
    }
  }

  async function play(song: Song) {
    ensureContext()
    if (!ctx.value) return

    if (currentSong.value?.id === song.id && pausedAt.value > 0) {
      // Resume from paused position
      const buffer = await loadBuffer(song)
      if (!buffer) return

      const source = ctx.value.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.value.destination)
      source.start(0, pausedAt.value)
      
      sourceNode.value = source
      startedAt.value = ctx.value.currentTime
      isPlaying.value = true
      animationFrame = requestAnimationFrame(updateTime)

      source.onended = () => {
        if (isPlaying.value) {
          stop()
        }
      }
    } else {
      // Start new song
      stop()
      
      const buffer = await loadBuffer(song)
      if (!buffer) return

      const source = ctx.value.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.value.destination)
      source.start(0)
      
      currentSong.value = song
      sourceNode.value = source
      duration.value = buffer.duration
      currentTime.value = 0
      pausedAt.value = 0
      startedAt.value = ctx.value.currentTime
      isPlaying.value = true
      animationFrame = requestAnimationFrame(updateTime)

      source.onended = () => {
        if (isPlaying.value) {
          stop()
        }
      }
    }
  }

  function pause() {
    if (sourceNode.value) {
      sourceNode.value.stop()
      sourceNode.value = null
    }
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
    pausedAt.value = currentTime.value
    isPlaying.value = false
  }

  function stop() {
    if (sourceNode.value) {
      sourceNode.value.stop()
      sourceNode.value = null
    }
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
    currentTime.value = 0
    pausedAt.value = 0
    startedAt.value = 0
    isPlaying.value = false
    currentSong.value = null
  }

  function seek(time: number) {
    const wasPlaying = isPlaying.value
    pause()
    pausedAt.value = Math.max(0, Math.min(time, duration.value))
    currentTime.value = pausedAt.value
    if (wasPlaying && currentSong.value) {
      play(currentSong.value)
    }
  }

  async function loadBuffer(song: Song): Promise<AudioBuffer | null> {
    if (!ctx.value) return null

    // Demo/procedural tracks
    if (song.source === 'starter' && song.id.startsWith('demo-song-')) {
      const bpm = song.analysis?.bpm ?? 90
      const durationSec = song.analysis?.durationSeconds ?? song.durationSeconds
      const buffers = generateDemoAudioBuffers(ctx.value, [
        { bpm, duration: durationSec }
      ])
      return buffers.get(0) ?? null
    }

    // Uploaded files
    try {
      const blob = await getAudioBlob(song.id)
      if (!blob) return null
      
      const arrayBuffer = await blob.arrayBuffer()
      return await ctx.value.decodeAudioData(arrayBuffer)
    } catch (error) {
      console.error('Failed to load audio:', error)
      return null
    }
  }

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
    seek,
  }
}
