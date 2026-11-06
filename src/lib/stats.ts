import type { StatAction, StatEvent } from './types'

export interface ResultDef {
  key: string
  label: string
  hint?: string
  /** tone drives colour of the button */
  tone: 'good' | 'ok' | 'bad' | 'neutral'
  /** does this result win (+1) or lose (-1) the rally for us? */
  point?: 1 | -1
}

export interface ActionDef {
  id: StatAction
  label: string
  emoji: string
  /** rated actions are logged with a 0..3 rating */
  rated?: boolean
  results: ResultDef[]
}

export const RATING_LABEL: Record<number, string> = {
  0: 'Error / ace against',
  1: 'Poor – out of system',
  2: 'OK – limited options',
  3: 'Perfect – all options',
}

export const SET_TARGETS = [
  { key: 'oh', label: 'Outside' },
  { key: 'mb', label: 'Middle' },
  { key: 'opp', label: 'Dia' },
  { key: 'pipe', label: 'Pipe' },
  { key: 'back', label: 'Back set' },
  { key: 'dump', label: 'Dump' },
]

export const ACTIONS: ActionDef[] = [
  {
    id: 'serve',
    label: 'Serve',
    emoji: '🎯',
    results: [
      { key: 'ace', label: 'Ace', tone: 'good', point: 1, hint: 'Direct point' },
      { key: 'good', label: 'In play', tone: 'ok' },
      { key: 'tough', label: 'Tough serve', tone: 'good', hint: 'Out of system for them' },
      { key: 'error', label: 'Error', tone: 'bad', point: -1, hint: 'Net / out' },
    ],
  },
  {
    id: 'pass',
    label: 'Pass',
    emoji: '🤲',
    rated: true,
    results: [],
  },
  {
    id: 'set',
    label: 'Set',
    emoji: '🙌',
    rated: true,
    results: [],
  },
  {
    id: 'attack',
    label: 'Attack',
    emoji: '💥',
    results: [
      { key: 'kill', label: 'Kill', tone: 'good', point: 1, hint: 'Hard swing, point' },
      { key: 'blockout', label: 'Block-out', tone: 'good', point: 1, hint: 'Off the block and out' },
      { key: 'feint', label: 'Feint / tip', tone: 'good', point: 1, hint: 'Soft touch, point' },
      { key: 'roll', label: 'Roll shot', tone: 'good', point: 1 },
      { key: 'tool', label: 'Tooled block', tone: 'good', point: 1, hint: 'Used the block' },
      { key: 'dug', label: 'Dug', tone: 'neutral', hint: 'Defended – rally goes on' },
      { key: 'blocked', label: 'Blocked', tone: 'bad', point: -1, hint: 'Stuffed' },
      { key: 'error', label: 'Error', tone: 'bad', point: -1, hint: 'Out / net' },
    ],
  },
  {
    id: 'block',
    label: 'Block',
    emoji: '🧱',
    results: [
      { key: 'stuff', label: 'Stuff', tone: 'good', point: 1, hint: 'Solo / assisted point' },
      { key: 'touch', label: 'Touch', tone: 'ok', hint: 'Slowed it down' },
      { key: 'soft', label: 'Soft block', tone: 'ok', hint: 'Block went up, we kept it' },
      { key: 'error', label: 'Error', tone: 'bad', point: -1, hint: 'Net / out' },
    ],
  },
  {
    id: 'dig',
    label: 'Dig',
    emoji: '🛡️',
    rated: true,
    results: [],
  },
  {
    id: 'error',
    label: 'Other error',
    emoji: '⚠️',
    results: [
      { key: 'net', label: 'Net touch', tone: 'bad', point: -1 },
      { key: 'foot', label: 'Foot fault', tone: 'bad', point: -1 },
      { key: 'double', label: 'Double hit', tone: 'bad', point: -1 },
      { key: 'lift', label: 'Lift / carry', tone: 'bad', point: -1 },
      { key: 'rotation', label: 'Rotation fault', tone: 'bad', point: -1 },
      { key: 'other', label: 'Other', tone: 'bad', point: -1 },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    emoji: '📋',
    results: [
      { key: 'opp_error', label: 'Opp. error', tone: 'good', point: 1, hint: 'Free point' },
      { key: 'opp_point', label: 'Opp. point', tone: 'bad', point: -1, hint: 'Their point, no individual fault' },
    ],
  },
]

export const actionDef = (a: StatAction) => ACTIONS.find((x) => x.id === a)!

export function resultDef(e: StatEvent): ResultDef | undefined {
  return actionDef(e.action).results.find((r) => r.key === e.result)
}

/** +1 point for us, -1 point for them, 0 neutral. */
export function pointValue(e: StatEvent): 1 | -1 | 0 {
  if (e.action === 'pass' && e.rating === 0) return -1
  if (e.action === 'set' && e.rating === 0) return -1
  if (e.action === 'dig' && e.rating === 0) return -1
  return resultDef(e)?.point ?? 0
}

export function describeEvent(e: StatEvent): string {
  const def = actionDef(e.action)
  if (def.rated) {
    const base = `${def.label} ${e.rating}`
    return e.detail ? `${base} → ${SET_TARGETS.find((t) => t.key === e.detail)?.label ?? e.detail}` : base
  }
  return `${def.label}: ${resultDef(e)?.label ?? e.result}`
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface PlayerStats {
  serveTotal: number
  aces: number
  serveErrors: number
  toughServes: number
  passTotal: number
  passSum: number
  passDist: [number, number, number, number]
  setTotal: number
  setSum: number
  setDist: [number, number, number, number]
  setTargets: Record<string, number>
  attackTotal: number
  kills: number
  attackErrors: number
  blocked: number
  dug: number
  killTypes: Record<string, number>
  blockStuffs: number
  blockTouches: number
  blockErrors: number
  digTotal: number
  digSum: number
  digDist: [number, number, number, number]
  otherErrors: number
  pointsWon: number
  pointsLost: number
}

export const emptyStats = (): PlayerStats => ({
  serveTotal: 0,
  aces: 0,
  serveErrors: 0,
  toughServes: 0,
  passTotal: 0,
  passSum: 0,
  passDist: [0, 0, 0, 0],
  setTotal: 0,
  setSum: 0,
  setDist: [0, 0, 0, 0],
  setTargets: {},
  attackTotal: 0,
  kills: 0,
  attackErrors: 0,
  blocked: 0,
  dug: 0,
  killTypes: {},
  blockStuffs: 0,
  blockTouches: 0,
  blockErrors: 0,
  digTotal: 0,
  digSum: 0,
  digDist: [0, 0, 0, 0],
  otherErrors: 0,
  pointsWon: 0,
  pointsLost: 0,
})

const isKill = (r: string) => ['kill', 'blockout', 'feint', 'roll', 'tool'].includes(r)

export function addEvent(s: PlayerStats, e: StatEvent) {
  const pv = pointValue(e)
  if (pv === 1) s.pointsWon++
  if (pv === -1) s.pointsLost++
  const r = e.rating ?? 0
  switch (e.action) {
    case 'serve':
      s.serveTotal++
      if (e.result === 'ace') s.aces++
      if (e.result === 'error') s.serveErrors++
      if (e.result === 'tough') s.toughServes++
      break
    case 'pass':
      s.passTotal++
      s.passSum += r
      s.passDist[r]++
      break
    case 'set':
      s.setTotal++
      s.setSum += r
      s.setDist[r]++
      if (e.detail) s.setTargets[e.detail] = (s.setTargets[e.detail] ?? 0) + 1
      break
    case 'attack':
      s.attackTotal++
      if (isKill(e.result)) {
        s.kills++
        s.killTypes[e.result] = (s.killTypes[e.result] ?? 0) + 1
      }
      if (e.result === 'error') s.attackErrors++
      if (e.result === 'blocked') s.blocked++
      if (e.result === 'dug') s.dug++
      break
    case 'block':
      if (e.result === 'stuff') s.blockStuffs++
      if (e.result === 'touch' || e.result === 'soft') s.blockTouches++
      if (e.result === 'error') s.blockErrors++
      break
    case 'dig':
      s.digTotal++
      s.digSum += r
      s.digDist[r]++
      break
    case 'error':
      s.otherErrors++
      break
  }
}

export function aggregate(events: StatEvent[], key: (e: StatEvent) => string | undefined) {
  const map = new Map<string, PlayerStats>()
  for (const e of events) {
    const k = key(e)
    if (k === undefined) continue
    if (!map.has(k)) map.set(k, emptyStats())
    addEvent(map.get(k)!, e)
  }
  return map
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null)
export const avg = (sum: number, n: number) => (n ? Math.round((sum / n) * 100) / 100 : null)
/** Hitting efficiency: (kills − errors − blocked) / attempts */
export const hitPct = (s: PlayerStats) => (s.attackTotal ? Math.round(((s.kills - s.attackErrors - s.blocked) / s.attackTotal) * 1000) / 10 : null)
/** Total errors of all kinds. */
export const totalErrors = (s: PlayerStats) => s.serveErrors + s.attackErrors + s.blockErrors + s.otherErrors + s.passDist[0] + s.setDist[0] + s.digDist[0]
