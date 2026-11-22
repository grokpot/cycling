import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const sharedDir = join(rootDir, 'shared')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  srcDir: 'app',
  alias: {
    '#shared': sharedDir,
  },
  vite: {
    optimizeDeps: {
      include: ['soundtouchjs'],
    },
  },
  build: {
    transpile: ['soundtouchjs'],
  },
  nitro: {
    alias: {
      '#shared': sharedDir,
    },
  },
})