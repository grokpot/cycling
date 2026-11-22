<script setup lang="ts">
import type { Profile } from '#shared/types'
import { useWorkoutStore } from '~/repositories/workout-store'

definePageMeta({ layout: 'default' })

const store = useWorkoutStore()
const toast = useToast()
const profile = ref<Profile | null>(null)

const zoneNames: Record<number, string> = {
  1: 'Recovery',
  2: 'Endurance',
  3: 'Tempo',
  4: 'Threshold',
  5: 'VO2',
  6: 'Anaerobic',
  7: 'Neuromuscular',
}

const zoneRows = computed(() => {
  if (!profile.value) {
    return []
  }
  return Object.entries(profile.value.zoneTable)
    .map(([zone, pct]) => ({ zone: Number(zone), pct }))
    .sort((a, b) => a.zone - b.zone)
})

const rpeRows = computed(() => {
  if (!profile.value) {
    return []
  }
  return Object.entries(profile.value.rpeTable)
    .map(([rpe, pct]) => ({ rpe: Number(rpe), pct }))
    .sort((a, b) => a.rpe - b.rpe)
})

onMounted(async () => {
  profile.value = await store.getProfile()
})

async function save() {
  if (!profile.value) {
    return
  }
  await store.saveProfile(profile.value)
  toast.add({ title: 'Saved on this device', color: 'success' })
}

function updateZone(zone: number, pct: number) {
  if (!profile.value) {
    return
  }
  profile.value.zoneTable[zone] = pct
}

function updateRpe(rpe: number, pct: number) {
  if (!profile.value) {
    return
  }
  profile.value.rpeTable[rpe] = pct
}
</script>

<template>
  <UDashboardNavbar title="Settings" />
  <div v-if="profile" class="p-4 max-w-xl space-y-6">
    <p class="text-sm text-muted">
      Stored on this device. Nothing here is uploaded.
    </p>
    <UForm class="space-y-6" :state="profile" @submit="save">
      <section class="space-y-4">
        <h2 class="text-xs uppercase tracking-wide text-muted">
          Rider
        </h2>
        <UFormField
          label="FTP (W)"
          description="% FTP and zone workouts need this. A workout written in watts can start without it."
        >
          <UInputNumber
            :model-value="profile.ftp ?? undefined"
            :min="1"
            placeholder="Not set"
            @update:model-value="profile.ftp = $event ?? null"
          />
        </UFormField>
        <UFormField
          label="Preferred cadence"
          description="Used when a step has no cadence yet. Filling empty cadences still uses 70, 80, 90, or 100 RPM from the effort."
        >
          <UInputNumber v-model="profile.preferredCadence" :min="40" :max="130" />
        </UFormField>
      </section>

      <section class="space-y-3">
        <div>
          <h2 class="text-xs uppercase tracking-wide text-muted">
            Zones
          </h2>
          <p class="text-sm text-muted mt-1">
            Each zone is a percent of FTP. Workouts that say “zone 4” use the number here.
          </p>
        </div>
        <div class="grid sm:grid-cols-2 gap-2">
          <div
            v-for="row in zoneRows"
            :key="row.zone"
            class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2"
          >
            <div>
              <p class="text-sm font-medium">
                Zone {{ row.zone }}
              </p>
              <p class="text-xs text-muted">
                {{ zoneNames[row.zone] ?? 'Custom' }}
              </p>
            </div>
            <UInputNumber
              :model-value="row.pct"
              class="w-28"
              :min="1"
              :max="300"
              @update:model-value="updateZone(row.zone, $event as number)"
            />
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div>
          <h2 class="text-xs uppercase tracking-wide text-muted">
            RPE
          </h2>
          <p class="text-sm text-muted mt-1">
            With an FTP stored, an RPE step becomes this percent of FTP. Without FTP, that step sends no power target.
          </p>
        </div>
        <div class="grid sm:grid-cols-2 gap-2">
          <div
            v-for="row in rpeRows"
            :key="row.rpe"
            class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2"
          >
            <p class="text-sm font-medium">
              RPE {{ row.rpe }}
            </p>
            <UInputNumber
              :model-value="row.pct"
              class="w-28"
              :min="1"
              :max="300"
              @update:model-value="updateRpe(row.rpe, $event as number)"
            />
          </div>
        </div>
      </section>

      <UButton type="submit" label="Save" />
    </UForm>
  </div>
</template>
