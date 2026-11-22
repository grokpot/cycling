<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  caption?: string
  pulse?: boolean
}>()
</script>

<template>
  <UCard :class="{ 'pulse-card': pulse }" class="p-4">
    <div class="flex flex-col gap-1">
      <div class="text-xs text-muted uppercase tracking-wide font-medium">
        {{ title }}
      </div>
      <div class="text-4xl font-bold tabular-nums">
        {{ value }}
      </div>
      <div v-if="caption" class="text-sm text-muted">
        {{ caption }}
      </div>
      <slot />
    </div>
  </UCard>
</template>

<style scoped>
.pulse-card {
  animation: pulse-beat 0.15s ease-out;
}

@keyframes pulse-beat {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
  100% {
    transform: scale(1);
  }
}
</style>