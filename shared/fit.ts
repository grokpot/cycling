/** Build a minimal Garmin FIT activity file from ride samples. */

import type { Ride, Workout } from './types'

const CRC_TABLE = (() => {
  const table = new Uint16Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x8005 : crc << 1
    }
    table[i] = crc & 0xffff
  }
  return table
})()

function crc16(data: Uint8Array, initial = 0): number {
  let crc = initial
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]
    crc = ((crc << 8) & 0xffff) ^ CRC_TABLE[((crc >> 8) ^ byte) & 0xff]
  }
  return crc & 0xffff
}

class FitWriter {
  private chunks: Uint8Array[] = []

  writeUInt8(v: number) {
    this.chunks.push(Uint8Array.of(v & 0xff))
  }

  writeUInt16LE(v: number) {
    const buf = new Uint8Array(2)
    buf[0] = v & 0xff
    buf[1] = (v >> 8) & 0xff
    this.chunks.push(buf)
  }

  writeUInt32LE(v: number) {
    const buf = new Uint8Array(4)
    buf[0] = v & 0xff
    buf[1] = (v >> 8) & 0xff
    buf[2] = (v >> 16) & 0xff
    buf[3] = (v >> 24) & 0xff
    this.chunks.push(buf)
  }

  writeBytes(bytes: Uint8Array) {
    this.chunks.push(bytes)
  }

  toUint8Array(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const c of this.chunks) {
      out.set(c, offset)
      offset += c.length
    }
    return out
  }
}

const MSG_FILE_ID = 0
const MSG_SESSION = 18
const MSG_LAP = 19
const MSG_RECORD = 20

function writeDefinition(
  w: FitWriter,
  localMsg: number,
  globalMsg: number,
  fields: Array<{ num: number; size: number; type: number }>,
) {
  w.writeUInt8(0x40 | localMsg)
  w.writeUInt8(0)
  w.writeUInt8(0)
  w.writeUInt8(globalMsg)
  w.writeUInt8(fields.length)
  for (const f of fields) {
    w.writeUInt8(f.num)
    w.writeUInt8(f.size)
    w.writeUInt8(f.type)
  }
}

function writeRecordMessage(
  w: FitWriter,
  localMsg: number,
  timestamp: number,
  power: number,
  cadence: number,
  heartRate: number,
) {
  w.writeUInt8(localMsg)
  w.writeUInt32LE(timestamp)
  w.writeUInt16LE(power)
  w.writeUInt8(cadence)
  w.writeUInt8(heartRate)
}

export function buildFit(ride: Ride, workout?: Workout): Uint8Array {
  const body = new FitWriter()
  const startUnix = Math.floor(new Date(ride.startedAt).getTime() / 1000)
  const fitEpoch = 631065600
  const startFit = startUnix - fitEpoch

  writeDefinition(body, 0, MSG_FILE_ID, [
    { num: 0, size: 1, type: 0 },
    { num: 1, size: 2, type: 132 },
    { num: 2, size: 2, type: 132 },
    { num: 3, size: 2, type: 132 },
  ])
  body.writeUInt8(0)
  body.writeUInt8(4)
  body.writeUInt16LE(1)
  body.writeUInt16LE(0)
  body.writeUInt16LE(0)

  writeDefinition(body, 1, MSG_SESSION, [
    { num: 7, size: 4, type: 134 },
    { num: 253, size: 4, type: 134 },
    { num: 0, size: 1, type: 0 },
    { num: 5, size: 4, type: 134 },
  ])
  body.writeUInt8(1)
  body.writeUInt32LE(startFit)
  body.writeUInt32LE(startFit)
  body.writeUInt8(0)
  body.writeUInt32LE(ride.samples.length)

  const lapCount = workout?.intervals.length ?? 1
  writeDefinition(body, 2, MSG_LAP, [
    { num: 253, size: 4, type: 134 },
    { num: 7, size: 4, type: 134 },
    { num: 0, size: 1, type: 0 },
  ])
  for (let i = 0; i < lapCount; i++) {
    body.writeUInt8(2)
    body.writeUInt32LE(startFit + i * 60)
    body.writeUInt32LE(startFit + (i + 1) * 60)
    body.writeUInt8(i)
  }

  writeDefinition(body, 3, MSG_RECORD, [
    { num: 253, size: 4, type: 134 },
    { num: 7, size: 2, type: 132 },
    { num: 4, size: 1, type: 2 },
    { num: 3, size: 1, type: 2 },
  ])

  for (const sample of ride.samples) {
    const ts = startFit + Math.floor(sample.timeMs / 1000)
    writeRecordMessage(
      body,
      3,
      ts,
      Math.round(sample.watts),
      Math.round(sample.cadence),
      Math.round(sample.heartRate),
    )
  }

  const bodyBytes = body.toUint8Array()
  const header = new Uint8Array(14)
  header[0] = 14
  header[1] = 0x20
  header[2] = bodyBytes.length & 0xff
  header[3] = (bodyBytes.length >> 8) & 0xff
  header[4] = (bodyBytes.length >> 16) & 0xff
  header[5] = (bodyBytes.length >> 24) & 0xff
  header[6] = 46 // .
  header[7] = 70 // F
  header[8] = 73 // I
  header[9] = 84 // T
  const headerCrc = crc16(header.slice(0, 12))
  header[12] = headerCrc & 0xff
  header[13] = (headerCrc >> 8) & 0xff

  const fileCrc = crc16(bodyBytes)
  const crcTail = new Uint8Array(2)
  crcTail[0] = fileCrc & 0xff
  crcTail[1] = (fileCrc >> 8) & 0xff

  const out = new Uint8Array(
    header.length + bodyBytes.length + crcTail.length,
  )
  out.set(header, 0)
  out.set(bodyBytes, header.length)
  out.set(crcTail, header.length + bodyBytes.length)
  return out
}