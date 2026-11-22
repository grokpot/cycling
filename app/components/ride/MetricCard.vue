<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  caption?: string
}>()
</script>

<template>
  <UCard>
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