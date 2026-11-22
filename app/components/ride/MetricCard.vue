<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
  caption?: string
  pulse?: boolean
}>()
</script>

<template>
  <div 
    :class="{ 'pulse-card': pulse }" 
    class="metric-card"
  >
    <div class="font-metric-label">
      {{ title }}
    </div>
    <div class="metric-value font-metric metric-animate">
      {{ value }}
    </div>
    <div v-if="caption" class="metric-caption">
      {{ caption }}
    </div>
    <slot />
  </div>
</template>

<style scoped>
.metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-value {
  font-size: 4rem;
  line-height: 1;
  color: var(--text-primary);
}

.metric-caption {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pulse-card {
  animation: pulse-beat 150ms ease-out;
}

@keyframes pulse-beat {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  }
  100% {
    transform: scale(1);
  }
}

@media (max-width: 768px) {
  .metric-value {
    font-size: 2.5rem;
  }
}
</style>