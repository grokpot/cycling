<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

defineProps<{
  intensityScale: number
  fanMode: 'hr' | 'speed'
  dropsEnabled: boolean
}>()

const emit = defineEmits<{
  'update:intensityScale': [number]
  'update:fanMode': ['hr' | 'speed']
  'update:dropsEnabled': [boolean]
  skipSong: []
}>()
</script>

<template>
  <UDrawer v-model:open="open" title="Control">
    <template #body>
      <div class="space-y-4 p-2">
        <UFormField label="Intensity scale">
          <USlider
            :model-value="intensityScale"
            :min="70"
            :max="120"
            :step="5"
            @update:model-value="emit('update:intensityScale', $event as number)"
          />
        </UFormField>
        <UFormField label="Fan mode">
          <URadioGroup
            :model-value="fanMode"
            :items="[
              { label: 'Heart rate', value: 'hr' },
              { label: 'Speed', value: 'speed' },
            ]"
            @update:model-value="emit('update:fanMode', $event as 'hr' | 'speed')"
          />
        </UFormField>
        <UFormField label="Drops on hard intervals">
          <USwitch
            :model-value="dropsEnabled"
            @update:model-value="emit('update:dropsEnabled', $event)"
          />
        </UFormField>
        <UButton
          label="Skip song"
          variant="soft"
          color="neutral"
          block
          @click="emit('skipSong')"
        />
      </div>
    </template>
  </UDrawer>
</template>