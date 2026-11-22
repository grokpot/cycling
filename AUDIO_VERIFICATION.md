# Audio Verification Guide

## Quick Browser Test

1. **Start the dev server**
   ```bash
   npm run dev
   ```

2. **Open Chrome/Edge**
   Navigate to `http://localhost:3000`

3. **Follow the demo flow**
   - Click "Start demo ride" on welcome screen
   - Should auto-load workout and navigate to pre-ride plan
   - Click "Start" button
   - **Audio should begin playing immediately**

## What to Listen For

### Expected Audio Behavior

**Interval 1 (Warmup, 5 min)**
- 70 RPM = 70 BPM
- Low energy drum + bass loop
- Should sound slow and steady

**Interval 2 (Threshold, 4 min)**
- 90 RPM = 90 BPM  
- **Tempo should noticeably increase** when transitioning from warmup
- More energetic sound
- **Crossfade should be smooth, on-beat**

**Interval 3 (Recovery, 3 min)**
- 80 RPM = 80 BPM
- **Tempo should drop slightly**
- Crossfade should happen seamlessly

**Interval 4 (Threshold, 4 min)**
- 95 RPM = 95 BPM
- **Tempo increases again**
- Highest energy in the demo

**Interval 5 (Recovery, 3 min)**
- 80 RPM = 80 BPM
- Tempo drops back down

**Interval 6 (Threshold, 4 min)**
- 92 RPM = 92 BPM
- Moderate increase in tempo

**Interval 7 (Cooldown, 5 min)**
- 70 RPM = 70 BPM
- **Back to slow tempo**
- Should end smoothly

### Crossfade Quality Checks

- **Timing**: Transitions should happen exactly on interval boundaries
- **Smoothness**: No clicks, pops, or abrupt volume changes
- **Beat alignment**: New tempo should feel like it's on the beat
- **Volume**: Fade in and fade out should be equal duration and shape

### On-Beat Pulse Checks

- **Cadence card pulses** should sync with audio beats
- Pulse timing should match the drum kicks (every beat at 1:1 ratio)
- If off-sync, check browser console for timing logs

## Debugging in Browser Console

Open DevTools (F12) and look for console logs:

```
useRide: Loading audio...
useRide: Generating procedural audio  
useRide: Loaded procedural buffer for demo-song-70bpm
useRide: Loaded procedural buffer for demo-song-80bpm
useRide: Loaded procedural buffer for demo-song-90bpm
useRide: Loaded procedural buffer for demo-song-95bpm
useRide: Loaded procedural buffer for demo-song-180bpm
useRide: Scheduling 7 cues
AudioMixer: Scheduling 7 cues
Cue 0: Demo Track - 70 BPM (Warmup) - 70 BPM → 70 BPM (stretch: 1.000)
Cue 1: Demo Track - 90 BPM (Mid Energy) - 90 BPM → 90 BPM (stretch: 1.000)
Cue 2: Demo Track - 80 BPM (Low Energy) - 80 BPM → 80 BPM (stretch: 1.000)
Cue 3: Demo Track - 95 BPM (High Energy) - 95 BPM → 95 BPM (stretch: 1.000)
Cue 4: Demo Track - 80 BPM (Low Energy) - 80 BPM → 80 BPM (stretch: 1.000)
Cue 5: Demo Track - 90 BPM (Mid Energy) - 90 BPM → 92 BPM (stretch: 0.978)
Cue 6: Demo Track - 70 BPM (Warmup) - 70 BPM → 70 BPM (stretch: 1.000)
AudioMixer: Scheduled 7/7 cues successfully
useRide: Audio ready!
AudioMixer: Starting playback with 7 cues at time [timestamp]
AudioMixer: All sources scheduled successfully
```

### Common Issues

**No audio at all**
- Check AudioContext state in console
- Look for "AudioContext created: sampleRate=..." message
- If missing, check browser audio permissions

**Audio glitches or clicks**
- Look for "Failed to process" errors in console
- Check stretch rate values (should be close to 1.0 for demo)
- Verify crossfade durations are reasonable

**Timing off-beat**
- Check that beat pulse is visually syncing with audio
- Verify BPM values in console logs match expected
- Look at stretch rates (should be 1.000 for most demo intervals)

**Audio stops after first interval**
- Check for source scheduling errors
- Verify all 7 cues were scheduled
- Look for stop() or pause() calls in console

## Interactive Testing

### Keyboard Shortcuts
- **Space or K**: Pause/resume (audio should suspend/resume)
- **S**: Skip to next interval (should jump to next tempo immediately)
- **C**: Open control drawer

### Expected Interactions
- **Pause**: Audio should suspend cleanly, resume from same point
- **Skip interval**: Should stop current audio and start next cue
- **Volume**: Master gain at 0.8 (80%)

## Technical Verification

### Stretch Quality
The demo should mostly use **1:1 ratio with no stretch** (stretch rate = 1.000). One exception:
- Interval 6: 90 BPM song stretched to 92 BPM (stretch rate ~0.978 = 2.2% slower playback)

This is well within the ±8% stretch gate, so quality should be good.

### Crossfade Math
- 8-beat crossfades at 90 RPM = 5.33 seconds
- 8-beat crossfades at 70 RPM = 6.86 seconds
- Intervals are long enough that crossfades don't overlap

### Buffer Sizes
Each procedural buffer:
- 70 BPM: 300s (5 min)
- 80 BPM: 240s (4 min)  
- 90 BPM: 240s (4 min)
- 95 BPM: 240s (4 min)
- 180 BPM: 240s (4 min) - not used in demo workout

## Success Criteria

✅ **Audio plays immediately on ride start**
✅ **Tempo changes are audible and correct**
✅ **Crossfades are smooth and on-beat**
✅ **No clicks, pops, or glitches**
✅ **Cadence pulse syncs with audio beats**
✅ **Pause/resume works correctly**
✅ **Skip interval transitions cleanly**
✅ **Full 30-minute ride plays through**
✅ **Console shows no errors**

## Known Limitations

- **Procedural audio is basic**: Simple drum + bass patterns, may sound repetitive
- **No real time-stretch library yet**: WSOLA implementation is basic, may have artifacts at larger stretch rates (not tested in demo)
- **No skip song yet**: Skip interval works, but skip to next song within same interval not implemented
- **AudioContext timing**: May have slight delay on first play (browser needs user gesture)

## Next Steps After Verification

If audio works:
1. Consider upgrading to SoundTouchJS or Rubber Band for better stretch quality
2. Add more variety to procedural generation
3. Test with real uploaded MP3s at various stretches
4. Implement skip song functionality
5. Add visual waveform/beat markers

If audio doesn't work:
1. Check console logs for specific errors
2. Verify AudioContext.state is 'running'
3. Test in incognito mode (no extensions)
4. Try different browser (Chrome vs Edge)
5. Check OS audio settings/permissions
