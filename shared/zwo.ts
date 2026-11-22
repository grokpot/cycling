/** Parse Zwift workout (.zwo) XML into a Workout. */

import type { PowerKind, Workout, WorkoutInterval } from './types'

function newId(): string {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parsePowerAttr(raw: string | undefined): { kind: PowerKind; value: number } {
  const n = raw ? Number.parseFloat(raw) : 0
  if (n <= 2) {
    return { kind: 'ftp_percent', value: Math.round(n * 100) }
  }
  return { kind: 'watts', value: Math.round(n) }
}

function attr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}="([^"]*)"`, 'i')
  const m = attrs.match(re)
  return m?.[1]
}

function attrNum(attrs: string, name: string): number | undefined {
  const v = attr(attrs, name)
  if (v === undefined) {
    return undefined
  }
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

interface TagNode {
  name: string
  attrs: string
  inner: string
  selfClosing: boolean
}

function parseTags(xml: string): TagNode[] {
  const nodes: TagNode[] = []
  const re = /<(\/?)([\w]+)([^>]*?)(\/?)>/g
  let match: RegExpExecArray | null
  const stack: { name: string; start: number }[] = []
  let lastIndex = 0

  while ((match = re.exec(xml)) !== null) {
    const [, slash, name, attrs, selfEnd] = match
  if (slash) {
      const top = stack.pop()
      if (top) {
        const inner = xml.slice(top.start, match.index)
        nodes.push({
          name: top.name,
          attrs: '',
          inner,
          selfClosing: false,
        })
      }
    } else if (selfEnd) {
      nodes.push({ name, attrs, inner: '', selfClosing: true })
    } else if (name.toLowerCase() !== 'textevent') {
      stack.push({ name, start: match.index + match[0].length })
    }
    lastIndex = match.index + match[0].length
  }
  void lastIndex
  return nodes
}

function flatElements(xml: string): Array<{ tag: string; attrs: string; full: string }> {
  const out: Array<{ tag: string; attrs: string; full: string }> = []
  const re = /<([\w]+)([^>]*?)(\/?)>([\s\S]*?)<\/\1>|<([\w]+)([^>]*?)\/>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    if (m[5]) {
      out.push({ tag: m[5], attrs: m[6], full: m[0] })
    } else {
      out.push({ tag: m[1], attrs: m[2], full: m[0] })
    }
  }
  return out
}

function cadenceFromAttrs(attrs: string): {
  low: number | null
  high: number | null
} {
  const c = attrNum(attrs, 'Cadence')
  if (c !== undefined) {
    return { low: c, high: c }
  }
  const lo = attrNum(attrs, 'CadenceLow')
  const hi = attrNum(attrs, 'CadenceHigh')
  return { low: lo ?? null, high: hi ?? null }
}

function textEventsIn(block: string): string[] {
  const texts: string[] = []
  const re = /<textevent[^>]*message="([^"]*)"[^>]*\/?>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    texts.push(m[1])
  }
  return texts
}

function steadyInterval(
  tag: string,
  attrs: string,
  block: string,
  position: number,
  shape: 'steady' | 'ramp',
): WorkoutInterval {
  const duration = attrNum(attrs, 'Duration') ?? 0
  const power = parsePowerAttr(attr(attrs, 'Power'))
  const cadence = cadenceFromAttrs(attrs)
  const texts = textEventsIn(block)

  const interval: WorkoutInterval = {
    id: newId(),
    position,
    durationSeconds: Math.round(duration),
    powerKind: power.kind,
    powerValue: power.value,
    cadenceLow: cadence.low,
    cadenceHigh: cadence.high,
    shape,
    cueText: texts[0],
  }

  if (shape === 'ramp') {
    const endPower = parsePowerAttr(attr(attrs, 'PowerHigh') ?? attr(attrs, 'Power'))
    const endCadence = cadenceFromAttrs(attrs.replace(/Cadence/g, 'X'))
    const hiCadence = attrNum(attrs, 'CadenceHigh') ?? attrNum(attrs, 'Cadence')
    const loCadence = attrNum(attrs, 'CadenceLow') ?? attrNum(attrs, 'Cadence')
    const rampEndPower = parsePowerAttr(
      attr(attrs, 'PowerHigh') ?? attr(attrs, 'Power'),
    )
    interval.rampEndPowerKind = rampEndPower.kind
    interval.rampEndPowerValue = rampEndPower.value
    interval.rampEndCadenceLow = hiCadence ?? loCadence ?? null
    interval.rampEndCadenceHigh = hiCadence ?? loCadence ?? null
    void endPower
    void endCadence
  }

  return interval
}

function expandBlock(xml: string, positionStart: number): {
  intervals: WorkoutInterval[]
  nextPosition: number
} {
  const intervals: WorkoutInterval[] = []
  let position = positionStart
  const re =
    /<(Warmup|Cooldown|SteadyState|Ramp|IntervalsT)([^>]*?)(\/?)>([\s\S]*?)<\/\1>|<(Warmup|Cooldown|SteadyState|Ramp|IntervalsT)([^>]*?)\/>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const tag = (m[1] ?? m[5]).toLowerCase()
    const attrs = m[2] ?? m[6] ?? ''
    const inner = m[4] ?? ''

    if (tag === 'intervalst') {
      const repeat = attrNum(attrs, 'Repeat') ?? 1
      const onDur = attrNum(attrs, 'OnDuration') ?? 0
      const offDur = attrNum(attrs, 'OffDuration') ?? 0
      const onPower = parsePowerAttr(attr(attrs, 'OnPower'))
      const offPower = parsePowerAttr(attr(attrs, 'OffPower'))
      const onCadence = cadenceFromAttrs(attrs)
      for (let i = 0; i < repeat; i++) {
        intervals.push({
          id: newId(),
          position: position++,
          durationSeconds: Math.round(onDur),
          powerKind: onPower.kind,
          powerValue: onPower.value,
          cadenceLow: onCadence.low,
          cadenceHigh: onCadence.high,
          shape: 'steady',
        })
        if (offDur > 0) {
          intervals.push({
            id: newId(),
            position: position++,
            durationSeconds: Math.round(offDur),
            powerKind: offPower.kind,
            powerValue: offPower.value,
            cadenceLow: onCadence.low,
            cadenceHigh: onCadence.high,
            shape: 'steady',
          })
        }
      }
      continue
    }

    const shape = tag === 'ramp' || tag === 'warmup' || tag === 'cooldown' ? 'ramp' : 'steady'
    if (tag === 'warmup' || tag === 'cooldown' || tag === 'ramp') {
      const duration = attrNum(attrs, 'Duration') ?? 0
      const startPower = parsePowerAttr(attr(attrs, 'Power'))
      const endPower = parsePowerAttr(
        attr(attrs, 'PowerHigh') ?? attr(attrs, 'PowerLow') ?? attr(attrs, 'Power'),
      )
      const startCadence = cadenceFromAttrs(attrs)
      const endCadenceLow =
        attrNum(attrs, 'CadenceHigh') ??
        attrNum(attrs, 'Cadence') ??
        startCadence.low
      const endCadenceHigh =
        attrNum(attrs, 'CadenceHigh') ??
        attrNum(attrs, 'Cadence') ??
        startCadence.high

      intervals.push({
        id: newId(),
        position: position++,
        durationSeconds: Math.round(duration),
        powerKind: startPower.kind,
        powerValue: startPower.value,
        cadenceLow: startCadence.low,
        cadenceHigh: startCadence.high,
        shape: 'ramp',
        rampEndPowerKind: endPower.kind,
        rampEndPowerValue: endPower.value,
        rampEndCadenceLow: endCadenceLow,
        rampEndCadenceHigh: endCadenceHigh,
        cueText: textEventsIn(inner)[0],
      })
    } else {
      intervals.push(
        steadyInterval(tag, attrs, inner, position++, 'steady'),
      )
    }
  }
  return { intervals, nextPosition: position }
}

export function parseZwo(xml: string, workoutId?: string): Workout {
  const nameMatch = xml.match(/<name[^>]*>([^<]*)<\/name>/i)
  const name = nameMatch?.[1]?.trim() || 'Imported workout'
  const workoutMatch = xml.match(/<workout[^>]*>([\s\S]*)<\/workout>/i)
  const body = workoutMatch?.[1] ?? xml
  const { intervals } = expandBlock(body, 0)
  void flatElements
  void parseTags

  return {
    id: workoutId ?? newId(),
    name,
    source: 'zwo',
    createdAt: new Date().toISOString(),
    intervals,
  }
}