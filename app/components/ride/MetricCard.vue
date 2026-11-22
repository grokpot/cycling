<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  caption?: string
  pulse?: boolean
}>()
</script>

<template>
  <UCard :class="{ 'pulse-card': pulse }">
    <p class="text-caption uppercase text-muted tracking-wide">
      {{ title }}
    </p>
    <p class="text-h2 tabular-nums mt-1">
      {{ value }}
    </p>
    <p v-if="caption" class="text-caption text-muted mt-1">
      {{ caption }}
    </p>
    <slot />
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