# Design Direction

Indoor cycling app with music that syncs to workout intervals. The design should feel like a pro cycling tool, not a generic web app.

## References

- **Wahoo SYSTM**: Dark UI, high-contrast metrics, zone-based colors, intense and focused
- **Zwift**: Playful but polished, clear hierarchy, big readable numbers
- **TrainerRoad**: Minimal chrome, data-first, clean power zones
- **Apple Fitness**: Smooth animations, bold typography, premium feel

## Principles

1. **Dark-first**: Cycling happens in dim rooms. Dark mode is not optional, it's the default.
2. **Readable from 2m**: You're on a bike. Metrics must be huge, bold, and high-contrast.
3. **Zone colors are sacred**: Power zones use a consistent, vibrant palette. Never muted.
4. **Minimal chrome**: No decorative UI. Every element serves the workout.
5. **Numbers are heroes**: Big, bold, condensed numerics. Metric values dominate their labels.

## Color System

### Dark Mode Foundation
```
Background: #0a0a0a (near black)
Surface: #1a1a1a (cards, elevated)
Surface Hover: #252525
Border: #2a2a2a (subtle)
Text Primary: #ffffff
Text Secondary: #a1a1a1
Text Muted: #666666
```

### Power Zone Palette (High Contrast)
```
Recovery (Z1):    #3b82f6 (blue-500)
Endurance (Z2):   #22c55e (green-500)
Tempo (Z3):       #eab308 (yellow-500)
Threshold (Z4):   #f97316 (orange-500)
VO2 Max (Z5):     #ef4444 (red-500)
Anaerobic (Z6):   #dc2626 (red-600)
Neuromuscular:    #991b1b (red-800)
```

Zones at full saturation, no opacity. Must pop against dark background.

### Accent
```
Primary: #3b82f6 (blue-500)
Success: #22c55e (green-500)
Warning: #f97316 (orange-500)
Error: #ef4444 (red-500)
```

## Typography

### Numeric Font: JetBrains Mono (self-hosted)
- **Why**: Monospace, tabular, excellent at large sizes, free and self-hostable
- **Use for**: Power (W), cadence (RPM), heart rate (BPM), time, FTP %
- **Weights**: 700 (Bold) for live metrics, 600 (SemiBold) for labels

### UI Font: Inter (system or self-hosted)
- **Why**: Clean, readable, standard
- **Use for**: Labels, buttons, body text, headers
- **Weights**: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)

### Scale
```
Metric value (ride screen): 4rem (64px) - JetBrains Mono Bold
Metric label: 0.75rem (12px) - Inter Medium, uppercase, tracking-wide
Interval time remaining: 3rem (48px) - JetBrains Mono Bold
Page title: 1.5rem (24px) - Inter SemiBold
Body: 0.875rem (14px) - Inter Regular
Caption: 0.75rem (12px) - Inter Regular
```

## Spacing

```
Padding:
  - Screen edges: 1.5rem (24px) desktop, 1rem (16px) mobile
  - Card padding: 1.5rem (24px)
  - Metric cards: 1.5rem (24px)
  - Between metrics: 1rem (16px)
  - Stacked sections: 1.5rem (24px)

Grid gaps:
  - Metric grid: 1rem (16px)
  - Control buttons: 1rem (16px)
```

## Motion

### Subtle, purposeful animation
- **Number tweening**: Live metrics ease into new values (200ms ease-out)
- **Interval change pulse**: Brief scale pulse on interval cards (150ms)
- **Zone transitions**: Smooth color shifts on power bars (300ms)
- **Button feedback**: Scale down slightly on press (100ms)

### No gratuitous animation
- No page transitions
- No loading spinners unless necessary
- No bouncing or sliding panels

## Ride Screen (Hero)

The ride screen is the centerpiece. Everything else supports it.

### Layout
```
┌─────────────────────────────────────┐
│ [←]      Workout Name        [⚙][B] │  Header (minimal)
├─────────────────────────────────────┤
│  POWER          CADENCE        HR   │  
│  245 W          92 RPM      165 BPM │  Huge metrics (64px)
│  Target: 250    Target: 90    Z4    │
├─────────────────────────────────────┤
│                                     │
│        [Chart: ECharts]             │  Chart (centerpiece)
│        Zone bars + songs            │
│                                     │
├─────────────────────────────────────┤
│  INTERVAL REMAINING                 │
│  02:34                              │  Countdown (48px)
│  90 RPM · 180 BPM · 250 W          │
│  Song Title                         │
├─────────────────────────────────────┤
│  [Skip]    [Pause]      [Control]  │  Controls
└─────────────────────────────────────┘
```

### Metric Cards
- **Background**: #1a1a1a (surface)
- **Border**: 1px #2a2a2a
- **Number**: 64px JetBrains Mono Bold, white
- **Label**: 12px Inter Medium, uppercase, #a1a1a1
- **Padding**: 24px

### Chart
- Dark background (#0a0a0a)
- Zone bars full saturation
- White playhead line (2px)
- Song lane integrated, muted colors (#8b5cf6 at 30% opacity)

### Controls
- Large touch targets (48px min)
- Pause button: 56px round
- Muted buttons (soft variant)

## Other Screens

### Welcome
- Dark hero section
- One bold CTA: "Start Demo Ride"
- Minimal copy

### Workouts List
- Dark cards
- Zone preview bars
- Clear hierarchy

### Pre-Ride
- Same chart as ride (without playhead)
- Intensity slider with zone indicators
- "Start Ride" button: large, primary

### Library
- Dark cards for songs
- BPM and energy visible
- Clean list/grid

## Implementation

### Nuxt UI Theming
Use `app.config.ts` to override Nuxt UI colors:
```typescript
ui: {
  colors: {
    primary: 'blue',
    gray: { ... }, // Custom dark grays
  }
}
```

### CSS Variables
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-surface: #1a1a1a;
  --bg-surface-hover: #252525;
  --border: #2a2a2a;
  --text-primary: #ffffff;
  --text-secondary: #a1a1a1;
  --text-muted: #666666;
}
```

### Font Loading
Self-host JetBrains Mono in `public/fonts/` and load via `@font-face` in `app/assets/css/main.css`.

## Copy

Plain language. No jargon unless necessary.
- "Power" not "FTP"
- "Target" not "Prescribed"
- "Skip" not "Advance"
- "Hard" not "Threshold"

Times in MM:SS, never MM:SS:MS.
Power in W, cadence in RPM, HR in BPM.

---

**Goal**: Make it look like Wahoo built a web app, not like a developer used Nuxt UI out of the box.
