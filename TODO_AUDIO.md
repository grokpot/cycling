# Audio Test TODO

## Current Status
- ✅ Playwright test framework set up
- ✅ Offline rendering working
- ✅ First cue (no stretch, tempo=1.0) plays correctly with RMS=0.081
- ❌ Cues 1-4 (tempo != 1.0) are silent (RMS=NaN)
- ❌ Tempo detection shows 183 BPM vs 70 BPM target (finding harmonics)

## Issues to Fix
1. **SoundTouch stretching returns empty buffers** - Cues with tempo != 1.0 go through SoundTouch but come back silent. Need to debug the SimpleFilter.extract() loop.
2. **Tempo detection algorithm** - Autocorrelation is finding wrong peaks. May need:
   - Better peak detection (find strongest peak in expected range)
   - Filtering/preprocessing
   - Different window size
3. **Pitch detection** - Zero-crossing method returns NaN, needs debugging

## Next Steps
1. Run test with debug logging to see SoundTouch extract behavior
2. Fix buffer extraction from SimpleFilter
3. Improve tempo detection to find correct peak
4. Run full test suite and get measured values
5. Document actual RMS, tempo, clicks, pitch per cue in PR description
