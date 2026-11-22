# Agent Instructions

## Communication Style

- Direct, concise, small words. Lead with the answer.
- One idea per sentence. Explain terms on first use.
- Write full sentences, not fragments with arrows (→) or slashes.
- Name files, components, and concepts explicitly (not "it", "the thing above")
- No em dashes (—) in user-facing copy. Use periods, commas, or rephrase.
- No assistant artifacts: no sign-offs, disclaimers, or AI references.
- Keep end-of-task summaries very short.

## Package Manager

- Use `bun` instead of npm/yarn
- Commands: `bun install`, `bun test`, `bun run dev`, `bun run build`
- Don't assume package versions — install and accept the latest
- Document non-obvious dependencies in comments when needed

## Git

- Work on feature branches off `main`, push, and open PRs
- Commit messages: clear, present tense, one logical change per commit
- Don't amend or force-push unless on a PR branch you own
- Always work on the current branch — do not use git worktrees

## Code Style

- **Vue**: Composition API, `<script setup lang="ts">` → `<template>` → `<style>` (style rare)
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Console**: Use `console.info`, `console.warn`, `console.error` (never `console.log`)
- **Imports**: Explicit at top of file
- **Comments**: Only for complex code. No history comments ("Removed X"). Delete old code, don't comment it out.
- **New files**: Short JSDoc comment at top (`/** Description */`)

## Components

- Pages minimal, call feature components
- Path-based naming: `components/task/List.vue` → `<TaskList>`
- Components organized by feature

## State

- Prefer composables with reactive state over Pinia
- One data load per screen: `onMounted` or `watch(..., { immediate: true })`, not both

## UI/CSS

- Use utility classes in templates, avoid `<style>` blocks
- Typography from semantic classes when available
- Avoid ad-hoc sizing/color classes

## Testing

- **Unit**: `bun test` runs vitest. Keep tests fast, no dev server needed.
- **Don't run dev/build in user's environment**: User runs `bun run dev` locally. Agent can run build for verification on cloud VM.
- **CI**: Tests must pass before merge.

## Documentation

- **README.md**: Setup, checks (use `bun` commands)
- **No separate TODOs**: Track work in docs or code comments, not standalone TODO files

## Anti-Patterns

- ❌ Em dashes (—) in user-facing copy
- ❌ `console.log` (use info/warn/error)
- ❌ npm commands (use bun)
- ❌ Running `bun run dev` or `build` on user's behalf (prompt user to verify)
- ❌ nextTick as a timing band-aid

---

# This Project

Indoor cycling workout app with music that automatically syncs to each interval's target cadence.

## Core Principle

The workout leads, music follows. Intensity and cadence are separate. Music tempo locks to target RPM (1:1 or 2:1 ratio), not measured cadence.

## Stack

- **Framework**: Nuxt 5, Vue 3 Composition API
- **UI**: @nuxt/ui v4, Tailwind CSS v4
- **Audio**: SoundTouchJS (MIT, pitch-preserving time stretch), Web Audio API, procedural generation
- **Devices**: Web Bluetooth (FTMS for trainer, standard HR, Wahoo Headwind)
- **Storage**: IndexedDB (workouts, songs, plans, profile - no server)
- **Tests**: vitest (unit), Playwright (browser/audio)

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

## Project-Specific Patterns

### Audio
- **SoundTouchJS**: Pitch-preserving stretch. Import from `soundtouchjs`, added to `vite.optimizeDeps` and `build.transpile` in `nuxt.config.ts`
- **Mixer**: `app/audio/mixer.ts` schedules cues, applies stretch, handles crossfades
- **Procedural**: `app/audio/procedural-audio.ts` generates drum+bass loops for demo
- **Client-only**: Audio code never imports server-side. Web Audio API is browser-only.

### Device Ports
- `app/device/trainer.ts`: FTMS Bluetooth + simulator
- `app/device/heart-rate.ts`: Standard BLE HR
- `app/device/fan.ts`: Wahoo Headwind specific service
- Simulator mode for testing without hardware

### Storage
- IndexedDB via `app/repositories/workout-store.ts`
- Stores: workouts, songs (with analysis), plans, profile (FTP, zones)
- No server, no account. Data stays on device.

### UI Patterns
- **Interval Graph**: Wahoo-style bars for intensity (color-coded by zone), cadence labels
- **Pre-Ride Flow**: Graph → stats cards → music setup → advanced accordion → fixed "Start Ride" button
- **Scrolling**: Pages use `flex flex-col h-screen` with `overflow-y-auto` on content
- **Plain language**: "Easy/Steady/Hard" not "FTP%/Zone" in default view

### Music Planning
- `shared/planner.ts`: matches songs to intervals within ±8% stretch
- Gaps when no songs fit: offer ±16%, change cadence, or silence
- Output: `Plan` with `Cue[]` (songId, inBeat, outBeat, lockedRpm, ratio, stretchPercent)

### Testing
- **Audio verification**: Playwright with `--autoplay-policy=no-user-gesture-required`
- Render with OfflineAudioContext, assert RMS/tempo/clicks/pitch
- Save WAV as gitignored artifact

## Project-Specific Anti-Patterns

- ❌ Jargon without explanation ("FTP", "Zone 4" in default views)
- ❌ Committing WAV files, test artifacts, screenshots
- ❌ Importing audio/device code server-side
