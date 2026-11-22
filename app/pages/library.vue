<script setup lang="ts">
import { analyzeAudio } from '~/audio/analyze'
import { 
  getFolderHandle, 
  setFolderHandle, 
  useWorkoutStore, 
  saveAudioBlob,
  getAudioBlob 
} from '~/repositories/workout-store'
import type { Song } from '#shared/types'

definePageMeta({ layout: 'default' })

const store = useWorkoutStore()
const toast = useToast()
const songs = ref<Song[]>([])
const hasFolder = ref(false)
const analyzing = ref<string | null>(null)
const uploading = ref(false)
const pickerMissing = ref(false)

const FOLDER_KEY = 'main'

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
    
    <template v-if="songs.length > 0">
      <div class="flex items-center justify-between">
        <p class="text-sm text-muted">
          {{ songs.length }} {{ songs.length === 1 ? 'track' : 'tracks' }}.
          Analyze tracks from your folder before the planner can match them to a cadence.
        </p>
      </div>
      <UTable :columns="columns" :data="songs">
        <template #actions-cell="{ row }">
          <div class="flex gap-1 justify-end">
            <UButton
              size="xs"
              variant="soft"
              :loading="analyzing === row.original.id"
              label="Analyze"
              @click="analyzeSong(row.original as Song)"
            />
            <UButton
              size="xs"
              variant="soft"
              :color="row.original.banned ? 'warning' : 'neutral'"
              :label="row.original.banned ? 'Unban' : 'Ban'"
              @click="toggleBan(row.original as Song)"
            />
          </div>
        </template>
      </UTable>
    </template>
  </div>
</template>
