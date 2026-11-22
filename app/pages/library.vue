<script setup lang="ts">
import { analyzeAudio } from '~/audio/analyze'
import { formatDuration } from '#shared/format'
import { 
  getFolderHandle, 
  setFolderHandle, 
  useWorkoutStore, 
  saveAudioBlob,
  getAudioBlob 
} from '~/repositories/workout-store'
import type { Song } from '#shared/types'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

definePageMeta({ layout: 'default' })

const store = useWorkoutStore()
const toast = useToast()
const songs = ref<Song[]>([])
const hasFolder = ref(false)
const analyzing = ref<string | null>(null)
const uploading = ref(false)
const pickerMissing = ref(false)

const FOLDER_KEY = 'main'

const player = useAudioPlayer()

function togglePlay(song: Song) {
  if (player.currentSong.value?.id === song.id && player.isPlaying.value) {
    player.pause()
  } else {
    player.play(song)
  }
}

function handleSeek(song: Song, event: Event) {
  const input = event.target as HTMLInputElement
  const time = parseFloat(input.value)
  player.seek(time)
}

async function refresh() {
  songs.value = await store.listSongs()
  hasFolder.value = Boolean(getFolderHandle(FOLDER_KEY))
}

onMounted(refresh)

async function pickFolder() {
  if (!('showDirectoryPicker' in window)) {
    pickerMissing.value = true
    return
  }
  try {
    const handle = await window.showDirectoryPicker()
    setFolderHandle(FOLDER_KEY, handle)
    hasFolder.value = true
    for await (const entry of handle.values()) {
      if (entry.kind !== 'file') {
        continue
      }
      const file = await entry.getFile()
      if (!/\.(mp3|flac|aac|m4a|wav)$/i.test(file.name)) {
        continue
      }
      const song: Song = {
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        source: 'folder',
        durationSeconds: 0,
        banned: false,
        genres: [],
        energy: 0.5,
        analysis: null,
        fileKey: file.name,
      }
      await store.saveSong(song)
    }
    await refresh()
  } catch {
    // The rider dismissed the folder picker.
  }
}

async function analyzeSong(song: Song) {
  const handle = getFolderHandle(FOLDER_KEY)
  if (!handle || !song.fileKey) {
    return
  }
  analyzing.value = song.id
  try {
    const fileHandle = await handle.getFileHandle(song.fileKey)
    const file = await fileHandle.getFile()
    const buf = await file.arrayBuffer()
    const analysis = await analyzeAudio(buf)
    song.analysis = analysis
    song.durationSeconds = analysis.durationSeconds
    song.energy = analysis.energy
    await store.saveSong(song)
    await refresh()
  } finally {
    analyzing.value = null
  }
}

async function toggleBan(song: Song) {
  song.banned = !song.banned
  await store.saveSong(song)
  await refresh()
}

async function deleteSong(id: string) {
  await store.deleteSong(id)
  await refresh()
}

async function uploadFiles(files: File[] | File | null) {
  const fileList = Array.isArray(files) ? files : files ? [files] : []
  if (fileList.length === 0) {
    return
  }

  uploading.value = true
  let count = 0

  try {
    for (const file of fileList) {
      if (!/\.(mp3|flac|aac|m4a|wav)$/i.test(file.name)) {
        continue
      }

      const songId = `upload-${file.name}-${Date.now()}-${count++}`
      const arrayBuffer = await file.arrayBuffer()

      // Analyze
      const analysis = await analyzeAudio(arrayBuffer)

      // Store blob
      await saveAudioBlob(songId, file)

      // Save song
      const song: Song = {
        id: songId,
        name: file.name,
        source: 'folder',
        durationSeconds: analysis.durationSeconds,
        banned: false,
        genres: [],
        energy: analysis.energy,
        analysis,
      }
      await store.saveSong(song)
    }

    toast.add({
      title: 'Files uploaded',
      description: `Analyzed ${count} ${count === 1 ? 'track' : 'tracks'}`,
      color: 'success',
    })

    await refresh()
  } finally {
    uploading.value = false
  }
}

const columns = [
  { accessorKey: 'name', header: 'Track' },
  { accessorKey: 'source', header: 'Source' },
  { accessorKey: 'analysis.bpm', header: 'BPM' },
  { accessorKey: 'energy', header: 'Energy' },
  { id: 'actions', header: '' },
]
</script>

<template>
  <div class="flex flex-col h-screen">
    <UDashboardNavbar title="Library" />
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 max-w-4xl mx-auto space-y-4">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Choose Music Folder"
              icon="i-lucide-folder-open"
              @click="pickFolder"
            />
            <UFileUpload
              accept=".mp3,.flac,.aac,.m4a,.wav"
              multiple
              label="Upload Files"
              icon="i-lucide-upload"
              :loading="uploading"
              @update:model-value="uploadFiles"
            />
          </div>
          <UAlert
            v-if="songs.length === 0"
            color="info"
            variant="soft"
            title="Add your music"
            description="Choose a folder to scan audio files, or upload individual tracks. The app analyzes tempo automatically."
          />
          <UAlert
            v-if="pickerMissing"
            color="warning"
            variant="soft"
            title="Folder picker unavailable"
            description="This browser doesn't support folder access. Use Upload Files instead."
          />
        </div>
        
        <div v-if="songs.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-caption text-muted">
              {{ songs.length }} {{ songs.length === 1 ? 'song' : 'songs' }}
            </div>
          </div>
          
          <UCard 
            v-for="song in songs" 
            :key="song.id"
            class="hover:bg-accented/5 transition-colors"
          >
            <div class="space-y-3">
              <div class="flex justify-between items-start gap-4">
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">
                    {{ song.name }}
                  </div>
                  <div class="text-sm text-muted mt-0.5">
                    <template v-if="song.analysis">
                      {{ song.analysis.bpm }} BPM · {{ formatDuration(song.analysis.durationSeconds) }}
                    </template>
                    <template v-else>
                      Not analyzed yet
                    </template>
                  </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <UButton
                    v-if="!song.analysis && song.fileKey"
                    variant="soft"
                    size="sm"
                    label="Analyze"
                    :loading="analyzing === song.id"
                    @click="analyzeSong(song)"
                  />
                  <UFormField v-if="song.analysis" label="Active" class="text-xs">
                    <USwitch
                      :model-value="!song.banned"
                      @update:model-value="toggleBan(song)"
                    />
                  </UFormField>
                  <UButton
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash-2"
                    size="sm"
                    aria-label="Delete song"
                    @click="deleteSong(song.id)"
                  />
                </div>
              </div>
              
              <!-- Audio player -->
              <div v-if="song.analysis" class="flex items-center gap-3">
                <UButton
                  :icon="player.currentSong?.id === song.id && player.isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
                  size="sm"
                  variant="soft"
                  :aria-label="player.currentSong?.id === song.id && player.isPlaying ? 'Pause' : 'Play'"
                  @click="togglePlay(song)"
                />
                <div class="flex-1 flex items-center gap-2">
                  <span class="text-xs text-muted tabular-nums min-w-[2.5rem]">
                    {{ player.currentSong?.id === song.id ? formatDuration(player.currentTime) : '0:00' }}
                  </span>
                  <input
                    type="range"
                    :min="0"
                    :max="song.analysis.durationSeconds"
                    :step="0.1"
                    :value="player.currentSong?.id === song.id ? player.currentTime : 0"
                    :disabled="player.currentSong?.id !== song.id"
                    class="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                    @input="handleSeek(song, $event)"
                  />
                  <span class="text-xs text-muted tabular-nums min-w-[2.5rem]">
                    {{ formatDuration(song.analysis.durationSeconds) }}
                  </span>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
