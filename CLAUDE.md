# Agent Instructions: Cycling App

## About the Product

Indoor cycling workout app with music that automatically syncs to each interval's target cadence. Structured workouts with Web Bluetooth trainer control and pitch-preserving time stretch.

**Core principle:** The workout leads, music follows. Intensity and cadence are separate. Music tempo locks to target RPM (1:1 or 2:1 ratio), not measured cadence.

## Communication Style

- Direct, concise, small words. Lead with the answer.
- One idea per sentence. Explain terms on first use.
- Write full sentences, not fragments with arrows (→) or slashes.
- Name files, components, and concepts explicitly (not "it", "the thing above")
- No em dashes (—) in user-facing copy. Use periods, commas, or rephrase.
- No assistant artifacts: no sign-offs, disclaimers, or AI references.
- Keep end-of-task summaries very short.

## Stack

- **Framework**: Nuxt 5, Vue 3 Composition API
- **UI**: @nuxt/ui v4, Tailwind CSS v4
- **Audio**: SoundTouchJS (MIT, pitch-preserving time stretch), Web Audio API, procedural generation
- **Devices**: Web Bluetooth (FTMS for trainer, standard HR, Wahoo Headwind)
- **Storage**: IndexedDB (workouts, songs, plans, profile - no server)
- **Tests**: vitest (unit), Playwright (browser/audio)
- **Package Manager**: bun (not npm/yarn)

## Repository Layout

```
shared/           Pure domain logic, types, formatters, planning
  ├─ types.ts     Workout, Song, Plan, Cue, Profile
  ├─ planner.ts   Music planning (cadence lock, song matching)
  ├─ zwo.ts       .zwo import
  └─ format.ts    Duration, power, cadence formatters

app/              Nuxt UI layer
  ├─ pages/       Routes (index, workouts/[id], ride/[id], library, welcome)
  ├─ components/  Feature-organized Vue components
  ├─ composables/ useRide, useBreakpoints
  ├─ audio/       mixer.ts (scheduler + crossfades), soundtouch-stretch.ts, 
  │               procedural-audio.ts, analyze.ts
  ├─ device/      trainer.ts (FTMS), heart-rate.ts, fan.ts (simulators + real)
  └─ repositories/ workout-store.ts (IndexedDB wrapper)

tests/            vitest unit tests, Playwright browser tests
docs/             product.md (product rules), implementation.md (dev notes)
```

## Product Rules (from docs/product.md)

1. **Intensity ≠ cadence**: Power/ERG sets effort. Music follows interval's target RPM.
2. **Workout leads**: Song never shortens or bends a workout interval.
3. **Cadence lock**: Music tempo = target RPM (1:1 or 2:1). Measured RPM drifts don't retime music.
4. **Stretch limits**: Songs fit within ±8%, up to ±16% if rider allows. Pitch stays unchanged.
5. **Interval boundary**: Next song's downbeat hits the boundary, even if outgoing song cuts mid-phrase.
6. **Drops**: New song at hard interval (≥90% FTP scaled) starts with its drop, unless rider disables.
7. **No Spotify/streaming**: Own files + AI-generated procedural starter library.
8. **No central server**: IndexedDB for workouts, songs, plans, profile. Mixing live in browser.
9. **AI generation before ride**: Any AI music/video generation happens pre-ride, not live.
10. **Web Bluetooth**: KICKR (FTMS), heart rate strap, Headwind fan. Chrome/Edge on Android/Windows/macOS.

## Rules

### Package Manager

- Use `bun` instead of npm/yarn
- Commands: `bun install`, `bun test`, `bun run dev`, `bun run build`
- Document non-obvious dependencies in comments when needed

### Git

- Work on feature branches off `main`, push, and open PRs
- Commit messages: clear, present tense, one logical change per commit
- Don't amend or force-push unless on a PR branch you own

### Code Style

- **Vue**: Composition API, `<script setup lang="ts">` → `<template>` → `<style>` (style rare)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Console**: Use `console.info`, `console.warn`, `console.error` (never `console.log`)
- **Imports**: Explicit at top of file. `#shared/` for shared types/utils, `~/` for app code
- **Comments**: Only for complex code. No history comments ("Removed X"). Delete old code, don't comment it out.
- **New files**: Short JSDoc comment at top (`/** Audio mixer with time stretch and crossfades */`)

### Components

- Pages minimal, call feature components (e.g. `components/workout/IntervalGraph.vue`)
- Path-based naming: `components/workout/IntervalGraph.vue` → `<WorkoutIntervalGraph>`
- Components organized by feature under `components/`

### State

- Prefer composables with reactive state over Pinia
- One data load per screen: `onMounted` or `watch(..., { immediate: true })`, not both

### UI/CSS

- **Nuxt UI v4** components globally available (`UButton`, `UCard`, etc.)
- **Tailwind v4**: utility classes in templates, avoid `<style>` blocks
- **Typography**: Use `text-h1`…`text-h5`, `text-body`, `text-caption` from `app/assets/css/main.css`
- **Colors**: `neutral`, `primary`, `success`, `warning`, `error` (not `grey`)
- **Icons**: Lucide icons via `i-lucide-*` (e.g. `i-lucide-play`)
- **Scrolling**: Pages use `flex flex-col h-screen` with `overflow-y-auto` on content area
- **No jargon**: Plain language for first-time users. "Easy/Steady/Hard" not "FTP%/Zone" in default view.

### Audio

- **SoundTouchJS**: Pitch-preserving stretch. Import from `soundtouchjs`, added to `vite.optimizeDeps` and `build.transpile` in `nuxt.config.ts`
- **Mixer**: `app/audio/mixer.ts` schedules cues, applies stretch, handles crossfades
- **Procedural**: `app/audio/procedural-audio.ts` generates drum+bass loops for demo
- **Client-only**: Audio code never imports server-side. Web Audio API is browser-only.

### Testing

- **Unit**: `bun test` runs vitest. Keep tests fast, no dev server needed.
- **Browser**: Playwright for UI and audio verification. Gitignore WAV artifacts and `test-results/`
- **Don't run dev/build in user's environment**: User runs `bun run dev` locally. Agent can run build for verification on cloud VM.
- **CI**: Tests must pass before merge.

### Documentation

- **README.md**: Setup, demo data, checks (use `bun` commands)
- **docs/product.md**: Product rules, non-goals, architecture constraints
- **docs/implementation.md**: Dev notes, audio verification, testing instructions
- **No separate TODOs**: Track work in docs or code comments, not standalone TODO files

### Device Ports

- `app/device/trainer.ts`: FTMS Bluetooth + simulator
- `app/device/heart-rate.ts`: Standard BLE HR
- `app/device/fan.ts`: Wahoo Headwind specific service
- Simulator mode for testing without hardware

### Storage

- IndexedDB via `app/repositories/workout-store.ts`
- Stores: workouts, songs (with analysis), plans, profile (FTP, zones)
- No server, no account. Data stays on device.

## Common Patterns

### Audio Rendering Test
- Use Playwright with `--autoplay-policy=no-user-gesture-required`
- Render with OfflineAudioContext, assert RMS/tempo/clicks/pitch
- Save WAV as gitignored artifact

### Interval Graph
- Wahoo-style: bars for intensity (color-coded by zone), cadence labels
- Height = intensity (% FTP scaled to 150% max), color = zone
- Show target cadence as label on each bar

### Pre-Ride Flow
1. Show interval graph
2. Stats cards (duration, interval count, music status)
3. Music setup (handle gaps: no songs, missing cadence)
4. Advanced settings in accordion (intensity, drops, fan, trainer)
5. Fixed bottom bar with "Start Ride" button

### Music Planning
- `shared/planner.ts`: matches songs to intervals within ±8% stretch
- Gaps when no songs fit: offer ±16%, change cadence, or silence
- Output: `Plan` with `Cue[]` (songId, inBeat, outBeat, lockedRpm, ratio, stretchPercent)

## Anti-Patterns

- ❌ Em dashes (—) in user-facing copy
- ❌ `console.log` (use info/warn/error)
- ❌ npm commands (use bun)
- ❌ Jargon without explanation ("FTP", "Zone 4" vs "Hard")
- ❌ Committing WAV files, test artifacts, screenshots
- ❌ Running `bun run dev` or `build` on user's behalf (prompt user to verify)
- ❌ Importing audio/device code server-side
- ❌ nextTick as a timing band-aid

## PR Checklist

Before merging:
- [ ] `bun test` passes (all unit tests)
- [ ] `bun run build` succeeds
- [ ] No compile errors (check SSR + client builds)
- [ ] Plain language in UI (no unexplained jargon)
- [ ] Em dashes removed from user copy
- [ ] WAV files and test artifacts gitignored
- [ ] README/docs use `bun` not `npm`
- [ ] Audio code not imported server-side
- [ ] New files have JSDoc comments
