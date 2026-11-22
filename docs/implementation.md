# Implementation plan

Technical plan for the first release. Product rules live in `docs/product.md`. No product name is fixed.

The ride screen follows the Wahoo workout player: six target tiles, an interval graph, a current-interval bar, and three bottom actions. Music is added inside that frame. It does not get its own screen during the ride.

## Stack

- Nuxt 5, Vue 3, TypeScript. The app already lives in `app/`.
- Nuxt UI v4 (`@nuxt/ui`) and Tailwind v4. Confirm the module installs against this Nuxt nightly before building screens. Components below are the v4 set (`UButton`, `UCard`, and the rest).
- Vitest for pure domain code.
- PWA via the Nuxt PWA module. Android Chrome is the reference browser.
- Supabase is not a dependency yet. The only future import of `@supabase/supabase-js` is `server/utils/supabase.ts`.

## Where code runs

The first release has no account. Analysis, mixing, the ride clock, and Bluetooth stay on the device because a ride has to work offline and those APIs exist only in the browser.

`shared/` holds pure TypeScript. Vue and Nitro both import it. No DOM, no Bluetooth, no Supabase.

`app/` is the interface and the device adapters: pages, Nuxt UI, Web Bluetooth, the file-system handle, the analysis worker, and the Web Audio mixer.

`server/` is the backend. The Vue app calls our own routes. It does not talk to Supabase, a CDN listing, or a future sync store directly.

| Work | Place |
| --- | --- |
| Workout math, `.zwo` parse, planner, `.fit` bytes | `shared/` |
| Screens, Bluetooth, folder access, analysis, live mix | `app/` |
| Starter-library manifest, later profile and ride sync | `server/api/` |
| Supabase client | `server/utils/supabase.ts` only |

Offline-critical work does not move to `server/` just to thin a component. A route that the ride needs after the network is gone is the wrong place for it.

## Repository shape

```
app/
  app.vue
  assets/css/main.css
  layouts/default.vue          dashboard shell
  layouts/ride.vue             fullscreen ride, no sidebar
  pages/index.vue              workout list
  pages/workouts/new.vue       builder
  pages/workouts/[id].vue      pre-ride plan
  pages/ride/[id].vue
  pages/library.vue
  pages/settings.vue
  components/ride/MetricCard.vue
  components/ride/IntervalGraph.vue
  components/ride/IntervalBar.vue
  components/ride/ControlDrawer.vue
  components/ride/DeviceSheet.vue
  composables/useRide.ts
  device/trainer.ts            TrainerPort + FTMS + simulator
  device/heart-rate.ts
  device/fan.ts
  audio/mixer.ts
  audio/analyze.worker.ts
  repositories/workout-store.ts
shared/
  types.ts
  targets.ts
  zwo.ts
  planner.ts
  fit.ts
server/
  api/catalog/starter.get.ts
  utils/supabase.ts
```

`useRide` owns the clock and calls the device and audio ports. Pages only render its state.

## Data, shaped for Supabase later

Local store is IndexedDB behind `workout-store.ts`. The record shapes are the future rows. When sync exists, the client posts and pulls these records through `server/api`. The server writes them with the Supabase client. Row level security lands with the first account. The browser never sees the service role.

`profiles`

- `id`, `ftp`, `preferred_cadence` (default 80)
- `zone_table` and `rpe_table` as JSON
- `genres` the rider allows

`workouts` and `intervals`

- Workout: `id`, `name`, `source` (`zwo` or `builder`), `created_at`
- Interval: `position`, `duration_s`, `power_kind` (`watts`, `ftp_percent`, `zone`, `rpe`), `power_value`, `cadence_low`, `cadence_high`, `shape` (`steady` or `ramp`), ramp end power and end cadence when `shape` is `ramp`

`songs`

- `id`, `source` (`folder` or `starter`), display name, duration
- Analysis: `bpm`, `beat_grid`, `downbeats`, `phrases`, `energy`, `key`, content hash
- `banned`
- Folder songs store a file key, not a copy of the bytes. Starter songs store a CDN URL.

`plans` and `cues`

- Plan: `workout_id`, `intensity_scale`, `drops_enabled`, `fan_mode` (`hr` or `speed`)
- Cue: interval piece, locked RPM, ratio `1:1` or `2:1`, `song_id` or silence, stretch, in-point, out-point, `drop` boolean

`rides`

- `id`, `workout_id`, `plan_id`, `started_at`, `ended_at`
- Samples: time, watts, cadence, heart rate, crank event time. Enough to write a `.fit` and to mark interval laps.

## Domain rules already decided

`shared/targets.ts` resolves one interval to watts and one RPM.

- Intensity scale is 70–120 in steps of 5, default 100. It scales watts only.
- `% FTP` and zone need a stored FTP or start is blocked. Absolute watts do not.
- RPE with an FTP uses `rpe_table`. RPE without an FTP produces no ERG target.
- A cadence range locks to its midpoint.
- Auto-fill, only when the rider runs it: 70 RPM below 60% FTP, 80 from 60% through 87%, 90 from 88% through 104%, 100 at 105% and above. Each filled value stays editable.
- A ramp whose cadence moves more than about 5 RPM splits into musical pieces. ERG still follows the power slope.

`shared/planner.ts` is a pure function from workout, profile, and song analyses to cues plus a list of gaps.

- Stretch gate is about ±8%. A rider-approved exception stops at ±16%.
- Smaller stretch wins. If the two ratios are within 2 percentage points, either may be used. 60 BPM and 120 BPM at 60 RPM both appear across a ride.
- Harder intervals get higher-energy songs. Genres come from the profile.
- A piece of 30 seconds or less keeps the current song when the cadence lock matches. A longer piece gets a new song. Long pieces in one ride do not reuse a song.
- A drop is placed when a new song starts at a scaled target of 90% FTP or more. A short run that keeps one song does not cut a drop on every rep.
- A gap is an unmatched piece. The pre-ride screen asks for a larger stretch, a new cadence, or silence.
- Key is stored and ignored by the picker.

`shared/zwo.ts` reads steady steps, warmups, cooldowns, ramps, and repeats. Text cues are kept and shown. Slope, video, and freeride blocks are ignored in this release.

`shared/fit.ts` writes the activity, one lap per interval, and the recorded streams. The page downloads the blob. Upload is a later `server/api` route.

## Device ports

`TrainerPort`, `HeartRatePort`, and `FanPort` are the only types the ride composable sees. Each has a simulator and a Bluetooth implementation.

- FTMS indoor-bike service for the KICKR Core: ERG target power, power, cadence, crank revolutions, and crank event time.
- Standard heart-rate service for the strap.
- Headwind sits entirely inside `device/fan.ts`. The service UUID is confirmed while that file is written. The rest of the app only sets a mode and a level. Mode is heart rate or trainer speed, chosen per ride, default heart rate. If the strap drops in heart-rate mode, the fan uses trainer speed.
- Start requires a trainer connection. Heart rate and fan are optional. Missing ones stay visible.
- The simulator feeds the same sample shape so the ride screen is buildable before a trainer is paired.

On-beat uses the music beat clock and crank event times. The cadence card pulses on the target beat and flashes when a stroke lands on it. Measured RPM never retimes the mix.

## Audio

`audio/analyze.worker.ts` runs in a worker. Input is file bytes. Output is the analysis record, stored once, keyed by content hash.

`audio/mixer.ts` holds the `AudioContext` and a time-stretch path that does not change pitch. The plan's cues are scheduled on the audio clock. Crossfade length is chosen per boundary: shorter when the piece is short, longer when the seam has room. The incoming downbeat is scheduled on the interval boundary. Skip interval rebuilds the upcoming cues and retargets ERG immediately. Skip song advances to the next cue and leaves the interval clock running. There is no extend control.

The mixer is not a Vue component. `useRide` sends it commands.

## Starter library

`server/api/catalog/starter.get.ts` returns id, title, genre, energy, BPM, duration, and the CDN URL. The client caches that index and the audio files. Redistribution rights are checked before any file is added to the manifest. The folder library never goes through this route. Folder permission uses the File System Access API, and the handle is stored in IndexedDB. Analysis stays in the app. If Android Chrome drops the permission, the library page asks for the folder again. The ride does not silently switch to a copied archive.

## Screens and Nuxt UI

`app.vue` renders `UApp`. Non-ride pages use `layouts/default.vue`: `UDashboardGroup`, `UDashboardSidebar`, `UDashboardPanel`, `UDashboardNavbar`. Sidebar links are Workouts, Library, and Settings. The ride uses `layouts/ride.vue` and drops the sidebar so the tiles can fill a phone next to the trainer.

Icons come from the icon set Nuxt UI already uses. Feedback uses `useToast`. Destructive confirms use `UModal`.

Custom drawing is limited to the interval graph, the on-beat flash, and the range marker on a tile when `UProgress` cannot show a target tick. Everything else is a Nuxt UI component.

### Workout list

`UPage` header, `UButton` for the builder, `UFileUpload` restricted to `.zwo`, `UEmpty` when there are no workouts, and a `UTable` or a stack of `UCard` rows once there are some. Row actions use `UDropdownMenu`.

### Builder

`UForm` with schema validation. Each step is duration (`UInputNumber`), target kind (`USelect`: watts, % FTP, zone, RPE), target value, cadence low and high, and shape. Ramp steps add end power and end cadence. A repeat wraps a block with `UInputNumber`. `UButton` adds, reorders, and deletes steps.

### Pre-ride

`USlider` for the intensity scale, min 70, max 120, step 5. `URadioGroup` for fan mode. `USwitch` for drops. Device status is a `UAlert` when the KICKR is missing, and `UBadge` rows when it is present. Auto-fill and "replan" are `UButton`s. The cue list is a `UTable`: interval, cadence lock, song, stretch, drop. Pin, swap, and ban are row actions. A gap row uses `UAlert` inside the cell and a `USelectMenu` of the three fixes (larger stretch, edit cadence, silence). Genre filter is `UCheckboxGroup` on the profile, edited here or in Settings. Start is a primary `UButton`, disabled until the KICKR is connected and every gap is resolved. `% FTP` and zone workouts also stay disabled until FTP is set.

### Settings

`UForm` for FTP, preferred cadence, and the zone and RPE tables (`UInputNumber` per row). Folder reconnect is a `UButton`. Bans are a `UTable` with an unban action.

### Library

`UTable` of songs: name, BPM, energy, genre, source. `UTabs` for folder and starter. `UEmpty` explains a missing folder permission. Ban is a row action. Analysis state is a `UBadge`.

### Ride screen

This is the Wahoo layout.

Header: a `UButton` to leave (pause first), the workout name, a Bluetooth `UButton` that opens `DeviceSheet` (`UDrawer`), and a gear `UButton` that opens the same drawer as Control.

Tile grid, two columns, six `UCard`s through `MetricCard`:

| Tile | Large figure | Caption | Extra |
| --- | --- | --- | --- |
| Target power | Measured watts | `Target: N` | |
| Target cadence | Measured RPM | `Target: N` or the range | `UProgress`. Neutral at or under the target, `error` when over. Tick at the target. Pulses on the beat. |
| Target heart rate | Measured BPM | `Target: low-high`, or `No target` | `UProgress` in `success` inside the range |
| Target RPE | `n/10` | | Hidden as a target tile when the interval has no RPE. The grid stays six tiles: RPE shows the step value or an em dash. |
| Workout remaining | `mm:ss` | | |
| Effort remaining | `mm:ss` | | Current piece |

Labels are small and uppercase. Figures use tabular numbers and a large type size. Cards use the default `UCard` surface so the light Wahoo look stays inside the theme.

`IntervalGraph` is one SVG. Y axis is watts. Blocks are the intervals after the intensity scale. Color follows hardness: primary under 90% FTP, warning at 90% and above. Elapsed time is a neutral wash. The playhead is a vertical line. A horizontal line marks the current target. A `UButton` with a list icon on the graph opens a `UPopover` with the upcoming cues, which is the music equivalent of that menu button. The graph does not become a second page.

`IntervalBar` is a full-width strip in the primary color, under the graph. First line is the current piece remaining, large. Second line is the current targets, dot-separated: cadence, RPE, music BPM, watts. Third line is the song title, one line, truncated. That is where music shows up. The six tiles stay about the workout.

Bottom actions, pause in the center and larger:

- Skip interval. `UButton`, soft, neutral. Writes the interval boundary and loads the next piece. ERG changes immediately. The planner rebuilds the cues that follow.
- Pause. `UButton`, soft, neutral, extra large, round. Holds the clock, ERG target, fan, and audio context.
- Control. `UButton`, soft, neutral. Opens `ControlDrawer`.

`ControlDrawer` is a `UDrawer` from the bottom. Contents: intensity `USlider`, fan `URadioGroup`, drops `USwitch`, skip song, swap song (`USelectMenu` of songs that fit the lock). No extend control.

`DeviceSheet` lists trainer, heart rate, and fan with `UBadge` connected state and a `UButton` to pair. Pairing uses a user gesture, which Web Bluetooth requires.

The ride layout is light and high contrast, matching that player. `UColorMode` can still theme the dashboard pages. The ride layout forces a light surface so the tiles stay readable next to the trainer.

## Build order

Each step is usable on its own. Later steps sit on the ports from earlier ones.

1. ✅ Nuxt UI, `UApp`, both layouts, empty routes, theme.
2. ✅ `shared/types.ts`, `targets.ts`, and `zwo.ts`, with Vitest covering scale, FTP gating, RPE without FTP, range midpoint, auto-fill, and ramp splits.
3. ✅ IndexedDB repository and the workout list, builder, and `.zwo` import.
4. ✅ Ride layout and the six tiles, graph, interval bar, and drawers, driven by `TrainerPort`'s simulator.
5. ⚠️ FTMS trainer and heart-rate strap on those same ports. ERG follows the resolved watts. Headwind behind `FanPort` once its service is confirmed. (Code exists, needs real device testing)
6. ⚠️ Folder library, analysis worker, and `server/api/catalog/starter.get.ts`. (Code exists, folder picker has Android Chrome permission issues. Demo songs added for testing.)
7. ✅ Planner, pre-ride table, gaps, pin, swap, ban.
8. ⚠️ Mixer on the audio clock, including skip song, skip interval, and pause. (Mixer exists but needs integration with real audio files and pitch-preserving stretch)
9. ✅ Ride samples and `.fit` download.
10. ❌ PWA shell cache, catalog cache, and analysis cache. The music folder stays outside the cache.

**Current status (Nov 2026):** Steps 1-4, 7, 9 complete. Device ports (5) exist but untested with real hardware. Audio (6, 8) has analysis and mixer shells but needs real files and pitch-preserving stretch. PWA caching (10) not yet implemented.

**Demo data:** A sample 30-minute interval workout and 5 demo songs with tempo analysis can be loaded from the workout list. This demonstrates the full workflow without needing hardware or a music folder.

Sync routes are not part of this sequence. `server/utils/supabase.ts` exports a function that refuses to run until the URL and service key exist, so a later route has one place to construct the client.

## Later server routes

These stay out of the first release. The types above are already the payloads.

- `POST /api/sync/profile`
- `POST /api/sync/rides`
- `GET /api/workouts` for planned sessions from intervals.icu and TrainerDay
- `POST /api/rides/strava` and `POST /api/rides/intervals`
- Instructor export: one MP3 plus a cue sheet, rendered on the server from the same `shared/planner.ts` cues

Analysis and the live mix stay on the device after those routes exist.

## Audio verification

The audio core loop uses **SoundTouchJS** (MIT license) for pitch-preserving time stretch and procedurally generated drum + bass loops for demo songs.

### Quick verification

1. Start dev server: `npm run dev`
2. Open Chrome/Edge at `http://localhost:3000`
3. Click "Start demo ride" on welcome screen
4. Click "Start" on pre-ride plan
5. Audio should begin playing immediately

### Expected behavior

Demo workout exercises real stretching (3-7% on most intervals):

- **Interval 1 (Warmup)**: 70 RPM = 70 BPM, no stretch
- **Interval 2**: 86 RPM from 90 BPM song (~4.7% stretch)
- **Interval 3**: 76 RPM from 80 BPM song (~5.3% stretch)
- **Interval 4**: 92 RPM from 95 BPM song (~3.3% stretch)
- **Interval 5**: 84 RPM from 90 BPM song (~7.1% stretch)
- **Interval 6**: 88 RPM from 90 BPM song (~2.3% stretch)
- **Interval 7 (Cooldown)**: 70 RPM = 70 BPM, no stretch

Tempo changes should be audible between intervals. Crossfades should be smooth and on-beat.

### Console logs

Expected output during audio load and playback:

```
useRide: Loading audio...
useRide: Generating procedural audio
AudioMixer: Scheduling 7 cues
Cue 0: Demo Track - 70 BPM → 70 BPM (stretch: 1.000)
Cue 1: Demo Track - 90 BPM → 86 BPM (stretch: 1.047)
Cue 2: Demo Track - 80 BPM → 76 BPM (stretch: 1.053)
...
AudioMixer: Scheduled 7/7 cues successfully
AudioMixer: Starting playback with 7 cues
```

### Verifying quality

**Audio not silent**: Check browser console for RMS energy logs, or open DevTools Audio panel and verify waveforms.

**BPM accuracy**: Each interval's tempo should match its target cadence within ~1%. Listen for the beat and count RPM: 60 beats in 60 seconds = 60 BPM.

**No clicks**: Crossfades use 4-8 beat linear ramps. Listen for smooth transitions between intervals, no pops or clicks.

**On-beat pulse**: The cadence card pulses on each beat. Visual timing should match audio kicks.

### Common issues

**No audio**: Check AudioContext state in console. Browser may require user gesture before audio plays. Verify `AudioContext.state === 'running'`.

**Timing off**: Check stretch rate logs. SoundTouchJS tempo = songBPM / targetBPM. Values should match expected.

**Glitches**: Check for "Failed to process" errors. May indicate buffer underrun or processing error.

### Manual testing checklist

- ✅ Audio plays immediately on ride start
- ✅ Tempo changes are audible and correct
- ✅ Crossfades are smooth (no clicks)
- ✅ On-beat pulse syncs with audio
- ✅ Pause/resume works (Space key)
- ✅ Skip interval transitions cleanly (S key)
- ✅ Full 30-minute ride plays through
- ✅ Console shows no errors
