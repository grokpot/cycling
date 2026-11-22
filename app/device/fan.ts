/** Fan control port (Headwind placeholder until service UUID is confirmed). */

export const HEADWIND_SERVICE_UUID = 'UNKNOWN'

export type FanMode = 'hr' | 'speed'

export interface FanPort {
  connect(): Promise<void>
  setMode(mode: FanMode): void
  setLevel(level: number): void
}

export function createFanSimulator(): FanPort {
  let mode: FanMode = 'hr'
  let level = 0
  return {
    async connect() {},
    setMode(m) {
      mode = m
    },
    setLevel(l) {
      level = Math.min(100, Math.max(0, l))
    },
    ...({ getState: () => ({ mode, level }) } as object),
  }
}

export function createBluetoothFan(): FanPort {
  return {
    async connect() {
      throw new Error('Headwind service is not confirmed yet')
    },
    setMode() {},
    setLevel() {},
  }
}