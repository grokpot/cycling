# Cycling (indoor workout app)

Nuxt 5 web app for structured indoor rides with music planning, Web Bluetooth trainers, and local IndexedDB storage.

## Setup

```bash
bun install
bun run dev
```

## Demo data

Click "Load demo data" on the workout list to seed a sample 30-minute interval workout and 5 demo songs with tempo analysis. This demonstrates the full workflow without needing to build a workout or choose a music folder.

## Checks

```bash
bun test
bun run build
```

Product rules live in `docs/product.md`. Implementation notes live in `docs/implementation.md`.