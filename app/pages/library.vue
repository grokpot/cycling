<script setup lang="ts">
import { analyzeAudio } from '~/audio/analyze'
import { getFolderHandle, setFolderHandle, useWorkoutStore } from '~/repositories/workout-store'
import type { Song } from '#shared/types'

definePageMeta({ layout: 'default' })

const store = useWorkoutStore()
const songs = ref<Song[]>([])
const hasFolder = ref(false)
const analyzing = ref<string | null>(null)
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

const columns = [
  { accessorKey: 'name', header: 'Track' },
  { accessorKey: 'analysis.bpm', header: 'BPM' },
  { accessorKey: 'energy', header: 'Energy' },
  { id: 'actions', header: '' },
]
</script>

<template>
  <UDashboardNavbar title="Library" />
  <div class="p-4 max-w-3xl space-y-4">
    <UAlert
      color="info"
      variant="soft"
      title="Demo songs loaded"
      description="The app includes 5 demo songs with tempo analysis. Test the full workflow with the demo workout on the main page. Add your own tracks by choosing a music folder below."
    />
    
    <div class="space-y-2">
      <p class="text-sm text-muted">
        Tracks stay in the folder you pick. Tempo analysis is saved in the app, not beside the files.
      </p>
      <UButton
        label="Choose a music folder"
        icon="i-lucide-folder-open"
        @click="pickFolder"
      />
      <UAlert
        v-if="pickerMissing"
        color="warning"
        variant="soft"
        title="This browser cannot link a folder"
        description="Folder access needs Chrome or Edge. The reference device is Android Chrome. Demo songs work without folder access."
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
