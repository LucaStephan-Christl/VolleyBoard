import { ROLE_META } from './formation'
import { aggregate, avg, describeEvent, emptyStats, hitPct, pct, pointValue, totalErrors, actionDef, resultDef, type PlayerStats } from './stats'
import type { Player, Session, StatEvent } from './types'

export type Cell = string | number | null
export interface Table {
  title: string
  head: string[]
  rows: Cell[][]
}

const n = (v: number | null) => v

function statRow(s: PlayerStats): Cell[] {
  return [
    s.serveTotal,
    s.aces,
    s.serveErrors,
    n(pct(s.aces, s.serveTotal)),
    s.passTotal,
    n(avg(s.passSum, s.passTotal)),
    s.passDist[3],
    s.passDist[2],
    s.passDist[1],
    s.passDist[0],
    n(pct(s.passDist[3], s.passTotal)),
    s.setTotal,
    n(avg(s.setSum, s.setTotal)),
    s.attackTotal,
    s.kills,
    s.attackErrors,
    s.blocked,
    n(pct(s.kills, s.attackTotal)),
    n(hitPct(s)),
    s.blockStuffs,
    s.blockTouches,
    s.digTotal,
    n(avg(s.digSum, s.digTotal)),
    totalErrors(s),
    s.pointsWon,
    s.pointsLost,
    s.pointsWon - s.pointsLost,
  ]
}

const STAT_HEAD = [
  'Serves',
  'Aces',
  'Serve errors',
  'Ace %',
  'Passes',
  'Pass avg (0-3)',
  'Pass 3s',
  'Pass 2s',
  'Pass 1s',
  'Pass 0s',
  'Pass 3 %',
  'Sets',
  'Set avg (0-3)',
  'Attacks',
  'Kills',
  'Attack errors',
  'Blocked',
  'Kill %',
  'Hitting eff. %',
  'Block stuffs',
  'Block touches',
  'Digs',
  'Dig avg (0-3)',
  'Total errors',
  'Points won',
  'Points lost',
  '+/-',
]

export function summaryTable(players: Player[], events: StatEvent[], title = 'Player statistics'): Table {
  const byPlayer = aggregate(events, (e) => e.playerId)
  const team = aggregate(events, () => 'team').get('team') ?? emptyStats()
  const rows: Cell[][] = players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => [p.name, ROLE_META[p.role].label, ...statRow(byPlayer.get(p.id)!)])
  rows.push(['TEAM', '', ...statRow(team)])
  return { title, head: ['Player', 'Position', ...STAT_HEAD], rows }
}

export function rotationTable(events: StatEvent[], title = 'By rotation'): Table {
  const byRot = aggregate(events, (e) => String(e.rotation))
  const rows: Cell[][] = [1, 2, 3, 4, 5, 6].map((r) => {
    const s = byRot.get(String(r)) ?? emptyStats()
    return [
      `R${r}`,
      s.pointsWon,
      s.pointsLost,
      s.pointsWon - s.pointsLost,
      s.passTotal,
      n(avg(s.passSum, s.passTotal)),
      s.attackTotal,
      s.kills,
      n(pct(s.kills, s.attackTotal)),
      s.aces,
      s.serveErrors,
    ]
  })
  return {
    title,
    head: ['Rotation', 'Points won', 'Points lost', '+/-', 'Passes', 'Pass avg (0-3)', 'Attacks', 'Kills', 'Kill %', 'Aces', 'Serve errors'],
    rows,
  }
}

export function eventTable(players: Player[], sessions: Session[], events: StatEvent[], title = 'Event log'): Table {
  const rows: Cell[][] = events.map((e) => {
    const p = players.find((x) => x.id === e.playerId)
    const d = new Date(e.t)
    const pad = (v: number) => String(v).padStart(2, '0')
    const pv = pointValue(e)
    const def = actionDef(e.action)
    return [
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      sessions.find((s) => s.id === e.sessionId)?.name ?? '',
      `R${e.rotation}`,
      p?.name ?? (e.action === 'team' ? 'Team' : ''),
      p ? ROLE_META[p.role].label : '',
      def.label,
      def.rated ? '' : (resultDef(e)?.label ?? e.result),
      e.rating ?? null,
      e.detail ?? '',
      describeEvent(e),
      pv === 1 ? 'us' : pv === -1 ? 'them' : '',
    ]
  })
  return { title, head: ['Time', 'Session', 'Rotation', 'Player', 'Position', 'Action', 'Result', 'Rating (0-3)', 'Detail', 'Description', 'Point for'], rows }
}

/* ------------------------------------------------------------------ */

const esc = (c: Cell, guard = true) => {
  if (c === null || c === undefined) return ''
  const s = String(c)
  // guard against spreadsheet formula injection from free-text names
  const safe = guard && (/^[=+@]/.test(s) || (/^-/.test(s) && Number.isNaN(Number(s)))) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Semicolon separated (Swiss/German Excel default) with a BOM so umlauts survive. */
export function toCsv(tables: Table | Table[]): string {
  const list = Array.isArray(tables) ? tables : [tables]
  const body = list
    .map((t) => {
      const lines = [t.head.map((h) => esc(h, false)).join(';'), ...t.rows.map((r) => r.map((c) => esc(c)).join(';'))]
      return list.length > 1 ? [esc(t.title), ...lines].join('\r\n') : lines.join('\r\n')
    })
    .join('\r\n\r\n')
  return '﻿' + body + '\r\n'
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'stats'
