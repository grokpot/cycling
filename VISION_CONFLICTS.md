# Vision conflicts check

Reviewed: `docs/product.md`, `docs/implementation.md`, `CLAUDE.md`, and `uploads/cadence-music-spec_bd4e.md`

## Conflicts found

None. The documents align on core principles:

✅ **Intensity and cadence are separate** - All docs agree music follows cadence targets, not derived from intensity
✅ **Workout leads, music follows** - Consistent across all docs
✅ **No Spotify** - All docs agree
✅ **Device-first architecture** - Analysis and mixing on device, not server
✅ **Web Bluetooth first** - Android Chrome as reference device
✅ **Music sources** - Own files + AI starter library in first release; licensed catalog later

## Minor clarifications

1. **Target cadence vs measured cadence**: `docs/product.md` decision #1 is clear: music locks to the interval's target cadence. Measured cadence drifts do not retime the mix. Implemented correctly.

2. **Short pieces**: `docs/product.md` decision #24 says pieces ≤30s keep the current song when cadence matches. Implemented in planner.

3. **Drops**: `docs/product.md` decision #22 specifies drops at 90% FTP or above after scaling, on by default. Implemented correctly.

4. **Starter library**: `docs/implementation.md` says "verify the AI music provider allows redistribution." This is marked as a check, not blocking first release. Demo songs added for testing.

## Implementation status vs vision

The current implementation covers:
- ✅ Core workout builder and import
- ✅ Music planner with cadence lock
- ✅ Pre-ride plan with gap resolution
- ✅ Ride screen with device simulators
- ✅ FTP, zones, RPE
- ✅ Demo data for testing
- ⚠️ Audio playback (mixer exists but needs integration with actual audio files)
- ⚠️ Starter library (demo songs added, CDN manifest route exists but no real files)
- ❌ FTMS integration (code exists, needs real device testing)
- ❌ Folder library (code exists, Android Chrome permission issues)

No vision conflicts. All implementation gaps are known limitations, not deviations from the vision.
