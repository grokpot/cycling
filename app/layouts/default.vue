<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items: NavigationMenuItem[] = [
  { label: 'Workouts', to: '/', icon: 'i-lucide-bike' },
  { label: 'Library', to: '/library', icon: 'i-lucide-music' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' },
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar>
      <template #header>
        <div class="flex items-center gap-2 px-2 py-1 text-muted">
          <UIcon name="i-lucide-bike" class="size-5" />
        </div>
      </template>
      <UNavigationMenu :items="items" orientation="vertical" />
    </UDashboardSidebar>
    <UDashboardPanel>
      <slot />
    </UDashboardPanel>
  </UDashboardGroup>
</template>