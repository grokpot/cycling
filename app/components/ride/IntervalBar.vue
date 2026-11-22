<script setup lang="ts">
defineProps<{
  pieceRemaining: string
  line: string
  songTitle: string
}>()
</script>

<template>
  <div class="w-full rounded-lg bg-primary text-inverted px-4 py-3 space-y-1">
    <p class="text-h2 tabular-nums">
      {{ pieceRemaining }}
    </p>
    <p class="text-body-sm truncate">
      {{ line }}
    </p>
    <p class="text-body truncate opacity-90">
      {{ songTitle }}
    </p>
  </div>
</template>