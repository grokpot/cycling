<script setup lang="ts">
defineProps<{
  pieceRemaining: string
  line: string
  songTitle: string
}>()
</script>

<template>
  <div class="interval-bar">
    <div class="font-metric-label">
      Interval Remaining
    </div>
    <div class="interval-countdown font-metric metric-animate">
      {{ pieceRemaining }}
    </div>
    <p class="interval-details">
      {{ line }}
    </p>
    <p class="interval-song">
      {{ songTitle }}
    </p>
  </div>
</template>

<style scoped>
.interval-bar {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.interval-countdown {
  font-size: 3rem;
  line-height: 1;
  color: var(--text-primary);
  margin: 0.5rem 0;
}

.interval-details {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.75rem;
}

.interval-song {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .interval-countdown {
    font-size: 2rem;
  }
}
</style>