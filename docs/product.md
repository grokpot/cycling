# Product

The repository is named `cycling`. No product name is fixed. This document describes the product; it does not brand it. Avoid hardcoding a name in the app, file formats, or copy.

Snapshot date: November 2026.

## Problem

Indoor riders who like structured workouts (Wahoo, TrainerRoad style) ride to music that ignores the workout. Rhythm-ride classes sync music to cadence, and they need an instructor on video. Nothing combines a structured workout with real music that is automatically cut, tempo-matched, and mixed to each interval.

## Who it is for

**Primary.** A self-coached indoor rider on a smart trainer who wants to pedal on the beat during structured intervals.

**Secondary, later.** Spin instructors building classes. Same engine, different output. Not the first release.

## Principles

- Intensity and cadence are separate layers. Effort comes from power, ERG, or resistance. Music follows the interval's target cadence, not the cadence the rider happens to be turning.
- The workout leads and the music follows. A song never shortens or bends a workout.
- Music sources: AI-generated songs are acceptable and solve licensing and adoption. Own files, or a licensed catalog, are options.
- No Spotify. Its developer policy forbids mixing and overlapping content.

## Requirements

### 1. Workout

The workout view is as clear as Wahoo: an interval graph, the current and next interval, time left, and targets.

Each interval has:

- duration
- an intensity target (`% FTP`, power, zone, or RPE)
- a cadence target (a single RPM, or a range)

**First release.** Import a local `.zwo`, a builder, and a `.fit` download of the completed ride. The builder can write steady intervals, repeats, warmups, cooldowns, and ramp slopes. Each steady interval has duration, watts or `% FTP`, and a cadence or a range. The rider enters FTP on this device. There is no account.

A per-ride intensity scale changes every watt target in 5% steps from 70% to 120%. The default is 100%. Cadence targets stay as written. Energy and drops use the scaled watts.

Absolute watt targets can start with no FTP stored. `% FTP` and zone workouts block start until the rider enters an FTP. When an FTP is stored, zones and RPE become watts through a local table the rider can edit. With no FTP, an RPE interval starts with no ERG target.

An imported interval with no cadence target stays empty in the pre-ride plan. One auto-fill action fills those segments, and the rider can edit any filled value before the ride. The working default, around a preferred 80 RPM, is 70 below 60% FTP, 80 from 60% through 87%, 90 from 88% through 104%, and 100 at 105% and above. The planner then picks songs for those tempos.

A warmup, cooldown, or ramp that changes cadence is split into pieces when the cadence target moves by more than about 5 RPM. Each piece is its own interval for the music. ERG still follows the power slope.

**Later.** Import `.fit`, `.erg`, and `.mrc`. Sync planned sessions from intervals.icu and TrainerDay. Upload rides to Strava and intervals.icu. A server is planned; keep FTP, the zone table, preferences, and ride history in a shape that can move there without a rewrite.

### 2. Trainer and sensors

The first release includes all three:

- Wahoo KICKR Core (FTMS / Wahoo protocol, ERG)
- Wahoo KICKR Headwind fan (speed follows heart rate or speed)
- any Bluetooth heart-rate strap or armband (for example Polar)

Bluetooth FTMS: control the smart trainer in ERG mode, and read power, cadence, and heart rate. Headwind uses a Wahoo-specific service. Confirm that service while building it. For each ride the rider picks whether the fan follows heart rate or trainer speed. Heart rate is the default. If the strap drops while the fan is following heart rate, the fan falls back to trainer speed.

Start requires the KICKR. Heart rate and Headwind are optional, and a missing one stays visible on screen.

Live cadence versus target is on screen. The ride screen also pulses on the target beat and marks when each pedal stroke lands on that beat, using crank revolutions from the trainer. The rider can skip the current interval. Extending an interval is not in the first release.

The first release records the ride and offers a `.fit` download. Upload to Strava and intervals.icu comes later.

### 3. Music engine

This is the core.

**Library.** The rider's own files (MP3, FLAC, AAC) and a small bundled AI starter library. A licensed fitness catalog that permits editing (a Set4Play-type catalog) is a possible later extra. It is not part of the first release. Terms would still need to be verified before any catalog work.

**Analysis on device.** BPM, beat grid, downbeats, phrases, energy curve, and key.

A phrase is 32 beats (8 bars in 4/4). A phrase boundary is the downbeat where one phrase ends and the next begins. At 120 BPM a phrase is 16 seconds. Section changes in this music are written to land there.

**Cadence lock.** A single RPM is the music tempo. A range locks to its midpoint, so 85–95 becomes 90. Mapping is 1:1 (one beat per pedal stroke) or 2:1 (two beats per pedal stroke). The smaller stretch wins. Variety steps in only when the two stretches are within 2 percentage points, including an exact tie: at 60 RPM, a 60 BPM song and a 120 BPM song are both used across the ride.

**Per interval, automatically:**

- Pick songs whose BPM fits that lock within about ±8%, without changing pitch. Harder intervals get higher-energy songs. The rider picks genres.
- If nothing fits, the pre-ride plan stops on that interval. The rider chooses a larger stretch, a new cadence target, or silence for that interval. An allowed larger stretch stops at ±16%.
- A piece of 30 seconds or less keeps the current song when the cadence lock matches, including a 30/30. A longer piece gets a new song. Long segments in one ride do not reuse a song already used on a long segment. A short run may stay on one song for the whole run.
- Chain as many songs as a long interval needs. The crossfade length is chosen for that transition: shorter on a short piece, longer when the time and the seam allow. It is not a fixed beat count. The next song's downbeat hits the interval boundary even when that ends the outgoing song mid-phrase.
- When a new song starts a hard interval, place its drop on that boundary. Hard means a scaled target of 90% FTP or above. This is on by default, and the rider can turn it off for the ride. Short pieces that keep the current song do not cut in a new drop on every rep.

**Rider controls.** Before the ride, a full song timeline. Pin, swap, or ban a song and the plan rebuilds. A ban lasts until the rider removes it. During the ride, swap or skip the current song, and skip the current interval. Skipping a song starts the next planned song and leaves the interval clock running. Skipping an interval rebuilds the upcoming plan. There is no extend control. Genre preferences. Energy follows the scaled work. Musical key is stored and is not used for picks in the first release.

Any AI music or video generation happens before the workout, never live.

Song choice, stretch, cuts, and crossfades are planned before the ride. The browser mixes that plan live (time-stretch and crossfades at play time). There is no pre-rendered ride file. Skipping an interval rebuilds the upcoming plan. Cadence drifting off the target does not.

### 3a. Library and live mixing

Two sources in one library:

- a folder the app reads in place
- a bundled AI starter library: static files on a CDN, covering about 120–180 BPM across a few genres and energy levels

Verify that the AI music provider allows redistribution. Analysis is stored once per song inside the app, keyed to the file. The app does not write that analysis beside the original file.

Live mixing in the browser (Web Audio API): time-stretch without pitch change, beat-matched crossfades, and switching in real time. This is the playback path.

The plan is computed before the ride and played live, so mid-ride compute stays small. Watch audio timing on Android. If the rider skips an interval, upcoming transitions are replanned. Riding off the cadence target does not retime the music. The on-screen cadence readout still shows measured RPM against the target.

### 3b. Visuals

The first release shows the workout graph, the current and next interval, time left, and targets. No generated video.

Later, an optional AI-generated video background can sit behind that graph, synced to the music and the intervals. Any generation happens before the ride.

### 4. Platforms

The first client is a web app / PWA. The reference device is Android Chrome on a phone or tablet next to the trainer. Web Bluetooth is how the page talks to the trainer and sensors. A native Android app is not the first client.

The app reads the rider's folder in place, so a ride keeps working only while the browser can still read that folder. Analysis and the transition plan live in the app. Mixing still happens live in the browser. The AI starter library is static files (CDN, then cached on device). Verify that the provider allows redistribution.

Web Bluetooth works in Chrome and Edge on Android, Windows, and macOS. It does not work in iOS Safari. A Bluefy-type browser is the workaround there.

Heart rate uses the standard Bluetooth service. KICKR Core uses FTMS. KICKR Headwind uses a Wahoo-specific service; verify that service before relying on it.

### 5. Instructor mode

Not in the first release. The same engine can later build a class, export one MP3 plus a cue sheet or PDF, and show a live coach view with cues.

## Non-goals

- No Spotify, Apple Music, or TIDAL streaming integration.
- No real instructor video, and no Zwift-style virtual world. AI video ambience is in scope.
- No intensity derived from BPM.

## Architecture constraints

- The first release has no account and no server. Analysis and mixing run on the device. FTP, the zone and RPE table, preferences, bans, and ride history stay on the device.
- A server is planned. Keep that profile and those rides in a shape that can sync later. Analysis and mixing stay on the device.
- The core is open source. Paid hosted extras are optional (for example sync, or a curated catalog).
- A ride can be shared as a file: the workout plus song fingerprints. Someone else can rebuild it with their own music.

## Risks

- **Adoption.** "Bring your own music files" limits consumer reach. A licensed catalog fixes that, costs money, and needs a deal.
- **Licensing.** Verify that any catalog allows cutting and tempo change. Instructors need public-performance licensing (for example SUISA in Switzerland).
- **Audio quality.** A large cadence jump needs a different song, not a bigger stretch.
- **Beat detection.** Accuracy varies by genre.

## Products to beat (November 2026)

| Product | What it already does | Gap |
| --- | --- | --- |
| Beatpace | Per-interval BPM mixes | AI music only, no trainer control |
| MOWL + Set4Play | Licensed music, separate intensity and RPM | Mixing is manual |
| IntervalRadio | Trainer control, own music, drops on hard efforts | Tempo is not based on cadence |
| Profiles.fit / ICG Workout Builder | Separate cadence and intensity | No mixing |
| RideComposer | Real mixing | Intensity is derived from BPM, Windows only |

## Decisions

1. **Music clock.** Music locks to the interval's target cadence (1:1 or 2:1). Measured cadence is shown against that target. Drifting RPM does not retime the mix. Skipping an interval does. Extending an interval is not in the first release.
2. **Playback.** Plan the transitions before the ride. Mix them live in the browser. Do not render one audio file for the ride.
3. **Library.** First release: device files plus a small bundled AI starter library. No licensed catalog yet.
4. **Client.** Web app / PWA with Web Bluetooth. Android Chrome is the reference device.
5. **First user.** The self-coached rider on a smart trainer. Instructor export comes later, on the same engine.
6. **Unmatched interval.** If no song fits within about ±8%, the pre-ride plan asks the rider to allow a larger stretch, change the cadence target, or leave that interval silent. An allowed larger stretch stops at ±16%.
7. **Cut.** The next song's downbeat hits the interval boundary, even when the outgoing song ends mid-phrase. The workout clock does not move.
8. **Cadence range.** Music locks to the midpoint of the range.
9. **Ratio.** The smaller stretch wins. Variety applies only when the stretches are within 2 percentage points. An exact tie, such as 60 BPM and 120 BPM at 60 RPM, uses both across the ride.
10. **Long interval.** Chain as many songs as the interval needs. The last cut lands on the interval boundary.
11. **Hardware.** KICKR Core in ERG, a standard heart-rate strap, and Headwind are all in the first release.
12. **Workout files.** Local `.zwo` import, a simple builder, and a `.fit` download. intervals.icu, TrainerDay, and Strava come later.
13. **Visuals.** Workout graph and targets only. Generated video comes later.
14. **Profile.** No account yet. FTP and an editable zone/RPE table live on the device. Shape that data so a later server can take it.
15. **Plan editing.** A full song timeline before the ride. During the ride, swap or skip the current song, and skip the current interval. There is no extend control.
16. **Missing cadence.** Those intervals stay empty until the rider clicks auto-fill. The working default is 70 / 80 / 90 / 100 RPM across recovery, endurance and tempo, threshold, and VO2. The rider can edit the filled values.
17. **Ramps.** Split a ramp when its cadence target moves by more than about 5 RPM. Each piece is its own musical interval. ERG keeps following the power slope.
18. **Energy.** Harder intervals get higher-energy songs. The rider picks genres.
19. **Headwind.** Per ride, the fan follows heart rate or trainer speed. Heart rate is the default.
20. **Library files.** The app reads a folder in place. Analysis lives in the app, keyed to each file.
21. **Builder.** Steady intervals, repeats, warmups, cooldowns, and ramp slopes.
22. **Drops.** On by default when a new song starts an interval at 90% FTP or above, after the intensity scale. The rider can turn that off for the ride. A short run that keeps one song does not cut a new drop on every rep.
23. **On the beat.** The ride screen pulses on the target beat and marks when each pedal stroke lands on it.
24. **Short pieces.** A piece of 30 seconds or less keeps the current song when the cadence matches. A 30/30 can stay on one song. A longer piece gets a new song.
25. **Repetition.** Long segments in one ride do not reuse a song. Short runs may repeat one song on purpose.
26. **Crossfade.** The length is chosen for that transition. It is not a fixed beat count. The next downbeat still hits the interval boundary.
27. **Start.** The KICKR is required. Heart rate and Headwind are optional, and a missing one stays visible.
28. **FTP.** `% FTP` and zone workouts block start until an FTP is stored. RPE with no FTP runs with no ERG target. Absolute watts can start with no FTP.
29. **Intensity scale.** Per ride, 5% steps from 70% to 120%, default 100%. Cadence targets stay as written.
30. **Ban and key.** A ban lasts until the rider removes it. Key is stored and unused for picks in the first release.
31. **FTP and heart rate stay separate.** FTP is the power anchor. A heart-rate goal does not rewrite it, and FTP does not invent a heart-rate target. Heart rate is a live reading and a fan input. It lags power, so the trainer cannot hold it the way it holds watts. A later estimate of FTP, if one exists, is a number the rider confirms. It is not a silent edit.
32. **Plan warnings.** The pre-ride plan warns when a step drops effort faster than heart rate can fall, when a hard effort starts in one jump, or when cadence jumps enough to change the song immediately. A ramp that bridges the same change stays quiet. Warnings do not block start.

## Still to check

These are checks, not open product choices.

- Reading a folder in place depends on the browser keeping permission to that folder. Android Chrome is weak at this. Analysis still lives in the app.
- Headwind's Wahoo service still has to be confirmed. It is in the first release.
- The AI starter library needs a provider that allows redistribution.
- iOS Safari has no Web Bluetooth. A Bluefy-type browser is only a workaround, not a target.
