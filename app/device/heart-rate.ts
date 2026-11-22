/** Heart rate strap port and simulator fallback. */

const HR_SERVICE = 0x180d
const HR_MEASUREMENT = 0x2a37

export interface HeartRatePort {
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribe(listener: (bpm: number) => void): () => void
  getLast(): number | null
}

export function createHeartRateSimulator(
  readTrainerHr: () => number,
): HeartRatePort {
  let strapBpm: number | null = null
  const listeners = new Set<(bpm: number) => void>()

  const emit = () => {
    const bpm = strapBpm ?? readTrainerHr()
    for (const l of listeners) {
      l(bpm)
    }
  }

  return {
    async connect() {},
    async disconnect() {},
    subscribe(listener) {
      listeners.add(listener)
      emit()
      const id = setInterval(emit, 1000)
      return () => {
        clearInterval(id)
        listeners.delete(listener)
      }
    },
    getLast() {
      return strapBpm ?? readTrainerHr()
    },
  }
}

export function createBleHeartRate(): HeartRatePort {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth is not available in this browser')
  }

  let device: BluetoothDevice | null = null
  let last: number | null = null
  const listeners = new Set<(bpm: number) => void>()

  return {
    async connect() {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
      })
      const server = await device.gatt?.connect()
      const service = await server?.getPrimaryService(HR_SERVICE)
      const char = await service?.getCharacteristic(HR_MEASUREMENT)
      await char?.startNotifications()
      char?.addEventListener('characteristicvaluechanged', (ev) => {
        const value = (ev.target as BluetoothRemoteGATTCharacteristic).value
        if (!value) {
          return
        }
        const flags = value.getUint8(0)
        if (flags & 0x01) {
          last = value.getUint16(1, true)
        } else {
          last = value.getUint8(1)
        }
        if (last !== null) {
          for (const l of listeners) {
            l(last)
          }
        }
      })
    },
    async disconnect() {
      await device?.gatt?.disconnect()
    },
    subscribe(listener) {
      listeners.add(listener)
      if (last !== null) {
        listener(last)
      }
      return () => listeners.delete(listener)
    },
    getLast() {
      return last
    },
  }
}