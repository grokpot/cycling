/** Smart trainer port: simulator and FTMS Bluetooth. */

import type { TrainerSample } from '#shared/types'

export interface TrainerPort {
  connect(): Promise<void>
  disconnect(): Promise<void>
  setTargetPower(watts: number | null): void
  setCadenceHint(rpm: number): void
  start(): void
  stop(): void
  subscribe(listener: (sample: TrainerSample) => void): () => void
}

export function createSimulator(): TrainerPort {
  let target: number | null = 100
  let hint = 90
  let timer: ReturnType<typeof setInterval> | null = null
  let heartRate = 120
  let crankRevs = 0
  let crankEventMs = Date.now()
  const listeners = new Set<(s: TrainerSample) => void>()

  const tick = () => {
    const base = target ?? 0
    const watts = base + Math.round((Math.random() - 0.5) * 8)
    const cadence = hint + Math.round((Math.random() - 0.5) * 2)
    heartRate += Math.round((Math.random() - 0.5) * 2)
    heartRate = Math.min(140, Math.max(110, heartRate))
    crankRevs += cadence / 60
    crankEventMs = Date.now()
    const sample: TrainerSample = {
      watts,
      cadence,
      heartRate,
      crankRevs,
      crankEventMs,
    }
    for (const l of listeners) {
      l(sample)
    }
  }

  return {
    async connect() {},
    async disconnect() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
    setTargetPower(watts) {
      target = watts
    },
    setCadenceHint(rpm) {
      hint = rpm
    },
    start() {
      if (!timer) {
        timer = setInterval(tick, 1000)
      }
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const FTMS_SERVICE = 0x1826
const INDOOR_BIKE_DATA = 0x2ad2
const FITNESS_MACHINE_CONTROL = 0x2ad9

export function createFtmsTrainer(): TrainerPort {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth is not available in this browser')
  }

  let device: BluetoothDevice | null = null
  let controlChar: BluetoothRemoteGATTCharacteristic | null = null
  let dataChar: BluetoothRemoteGATTCharacteristic | null = null
  let target: number | null = 100
  let hint = 90
  let lastSample: TrainerSample = {
    watts: 0,
    cadence: 0,
    heartRate: 120,
    crankRevs: 0,
    crankEventMs: Date.now(),
  }
  const listeners = new Set<(s: TrainerSample) => void>()
  let errorMessage: string | null = null

  const notify = () => {
    for (const l of listeners) {
      l(lastSample)
    }
  }

  const parseIndoorBikeData = (value: DataView) => {
    try {
      const flags = value.getUint16(0, true)
      let offset = 2
      if (flags & 0x01) {
        // more flags — skip
      }
      if (flags & 0x04) {
        lastSample.cadence = value.getUint16(offset, true) / 2
        offset += 2
      }
      if (flags & 0x20) {
        lastSample.watts = value.getInt16(offset, true)
        offset += 2
      }
      notify()
    } catch {
      errorMessage = 'Could not parse indoor bike data'
    }
  }

  const writeControl = async (bytes: Uint8Array) => {
    if (!controlChar) {
      return
    }
    await controlChar.writeValue(bytes)
  }

  return {
    async connect() {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [FTMS_SERVICE] }],
        optionalServices: [FTMS_SERVICE],
      })
      const server = await device.gatt?.connect()
      const service = await server?.getPrimaryService(FTMS_SERVICE)
      controlChar = (await service?.getCharacteristic(
        FITNESS_MACHINE_CONTROL,
      )) ?? null
      dataChar =
        (await service?.getCharacteristic(INDOOR_BIKE_DATA)) ?? null
      await writeControl(new Uint8Array([0x00]))
      if (dataChar) {
        await dataChar.startNotifications()
        dataChar.addEventListener('characteristicvaluechanged', (ev) => {
          const targetEv = ev.target as BluetoothRemoteGATTCharacteristic
          if (targetEv.value) {
            parseIndoorBikeData(targetEv.value)
          }
        })
      }
      if (errorMessage) {
        throw new Error(errorMessage)
      }
    },
    async disconnect() {
      await device?.gatt?.disconnect()
      device = null
    },
    setTargetPower(watts) {
      target = watts
      if (controlChar && watts !== null) {
        const buf = new Uint8Array(3)
        buf[0] = 0x05
        buf[1] = watts & 0xff
        buf[2] = (watts >> 8) & 0xff
        void writeControl(buf)
      }
    },
    setCadenceHint(rpm) {
      hint = rpm
      lastSample.cadence = hint
    },
    start() {},
    stop() {},
    subscribe(listener) {
      listeners.add(listener)
      listener(lastSample)
      return () => listeners.delete(listener)
    },
  }
}