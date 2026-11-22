<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

defineProps<{
  trainerLabel: string
  hrLabel: string
  fanLabel: string
  error: string | null
}>()

const emit = defineEmits<{
  connectTrainer: []
  connectHr: []
  connectFan: []
}>()
</script>

<template>
  <UDrawer v-model:open="open" title="Devices">
    <template #body>
      <div class="space-y-4 p-2">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
        />
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-body font-medium">Trainer</p>
            <UBadge variant="subtle" color="neutral">
              {{ trainerLabel }}
            </UBadge>
          </div>
          <UButton
            label="Connect trainer"
            size="sm"
            @click="emit('connectTrainer')"
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-body font-medium">Heart rate</p>
            <UBadge variant="subtle" color="neutral">
              {{ hrLabel }}
            </UBadge>
          </div>
          <UButton
            label="Connect heart rate"
            size="sm"
            variant="soft"
            @click="emit('connectHr')"
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-body font-medium">Fan</p>
            <UBadge variant="subtle" color="neutral">
              {{ fanLabel }}
            </UBadge>
          </div>
          <UButton
            label="Connect fan"
            size="sm"
            variant="soft"
            @click="emit('connectFan')"
          />
        </div>
      </div>
    </template>
  </UDrawer>
</template>