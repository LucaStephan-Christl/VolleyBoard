import type { Phase, Plan, Player, Pt, Role, SlotIdx } from './types'

export const PHASES: { id: Phase; label: string; short: string; blurb: string }[] = [
  { id: 'receive', label: 'Serve receive', short: 'Receive', blurb: 'Opponent serves – we must obey the overlap rules.' },
  { id: 'attack', label: 'After receive', short: 'Attack', blurb: 'Ball is passed – everyone releases to their attack / cover spot.' },
  { id: 'serve', label: 'Our serve', short: 'Serve', blurb: 'We serve – block & defence base. Swiss regional rules: free positioning, no overlap rules.' },
]

export const ROLE_META: Record<Role, { label: string; short: string; color: string; text: string }> = {
  S: { label: 'Setter', short: 'S', color: '#f5c542', text: '#241a00' },
  OH: { label: 'Outside', short: 'OH', color: '#4da3ff', text: '#04182e' },
  MB: { label: 'Middle', short: 'MB', color: '#34d399', text: '#02251a' },
  OPP: { label: 'Dia', short: 'DIA', color: '#ff6b7d', text: '#3a0710' },
  L: { label: 'Libero', short: 'L', color: '#c4a1ff', text: '#220a47' },
}

export const SLOT_NAMES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
export const SLOT_ZONE = ['Right back', 'Right front', 'Middle front', 'Left front', 'Left back', 'Middle back']
/** Slot → is back row. */
export const isBackRow = (i: number) => i === 0 || i === 4 || i === 5

export const ROTATIONS = [1, 2, 3, 4, 5, 6]

/** Player ids in slots P1..P6 after (rot-1) rotations. Players move P2→P1→P6→P5→P4→P3→P2. */
export function lineupAt(base: string[], rot: number): string[] {
  const k = (rot - 1) % 6
  return base.map((_, i) => base[(i + k) % 6])
}

/** Index in `base` of whoever stands in slot `slot` during rotation `rot`. */
export function baseIndexFor(slot: number, rot: number) {
  return (slot + (rot - 1)) % 6
}

export interface SlotInfo {
  slot: SlotIdx
  player: Player
  /** The libero came on for a middle in this slot. */
  liberoFor?: Player
  role: Role
}

/**
 * Who is actually on court for each slot, taking the libero into account.
 * The libero replaces the middle in the back row (but not while that middle is serving).
 */
export function courtAt(plan: Plan, players: Player[], rot: number, phase: Phase): SlotInfo[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const ids = lineupAt(plan.base, rot)
  const libero = players.find((p) => p.role === 'L')
  return ids.map((id, i) => {
    const player = byId.get(id) ?? players[0]
    const slot = i as SlotIdx
    if (plan.useLibero && libero && player.role === 'MB' && isBackRow(i) && !(i === 0 && phase === 'serve')) {
      return { slot, player: libero, liberoFor: player, role: 'L' as Role }
    }
    return { slot, player, role: player.role }
  })
}

/* ------------------------------------------------------------------ */
/* Default positions                                                   */
/* ------------------------------------------------------------------ */

const passers: Role[] = ['OH', 'L']
const isPasser = (r: Role) => passers.includes(r)

function receiveDefaults(roles: Role[]): Pt[] {
  const pts: Pt[] = new Array(6)
  // x per slot  [P1, P2, P3, P4, P5, P6]
  const frontX = { 1: 86, 2: 50, 3: 15 } as const
  roles.forEach((role, i) => {
    const back = isBackRow(i)
    const pass = isPasser(role)
    if (!back) {
      const x = i === 1 ? frontX[1] : i === 2 ? frontX[2] : frontX[3]
      if (role === 'S') {
        // setter hides at the net, target is right front
        pts[i] = { x: i === 1 ? 86 : i === 2 ? 66 : 32, y: 8 }
      } else if (pass) {
        pts[i] = { x: i === 1 ? 82 : i === 2 ? 48 : 18, y: 32 }
      } else {
        pts[i] = { x, y: role === 'OPP' ? 12 : 10 }
      }
    } else {
      if (pass) {
        pts[i] = { x: i === 0 ? 78 : i === 5 ? 48 : 20, y: i === 5 ? 70 : 64 }
      } else if (role === 'S') {
        pts[i] = i === 0 ? { x: 92, y: 48 } : i === 5 ? { x: 68, y: 44 } : { x: 38, y: 46 }
      } else if (role === 'OPP') {
        pts[i] = i === 0 ? { x: 92, y: 50 } : i === 5 ? { x: 64, y: 48 } : { x: 14, y: 48 }
      } else {
        pts[i] = i === 0 ? { x: 80, y: 66 } : i === 5 ? { x: 50, y: 72 } : { x: 20, y: 66 }
      }
    }
  })
  return pts
}

function attackDefaults(roles: Role[]): Pt[] {
  return roles.map((role, i) => {
    const back = isBackRow(i)
    switch (role) {
      case 'S':
        return { x: 72, y: 9 }
      case 'OPP':
        return back ? { x: 88, y: 48 } : { x: 93, y: 18 }
      case 'OH':
        return back ? { x: 46, y: 46 } : { x: 10, y: 16 }
      case 'MB':
        return back ? (i === 0 ? { x: 80, y: 66 } : i === 5 ? { x: 50, y: 70 } : { x: 20, y: 66 }) : { x: 50, y: 14 }
      case 'L':
        return i === 0 ? { x: 80, y: 66 } : i === 5 ? { x: 50, y: 70 } : { x: 20, y: 66 }
    }
  })
}

function serveDefaults(): Pt[] {
  return [
    { x: 92, y: 112 }, // P1 server
    { x: 84, y: 9 }, // P2 right blocker
    { x: 50, y: 9 }, // P3 middle blocker
    { x: 16, y: 9 }, // P4 left blocker
    { x: 18, y: 64 }, // P5 left back
    { x: 50, y: 74 }, // P6 deep middle
  ]
}

export function defaultPositions(phase: Phase, roles: Role[]): Pt[] {
  if (phase === 'receive') return receiveDefaults(roles)
  if (phase === 'attack') return attackDefaults(roles)
  return serveDefaults()
}

export const posKey = (rot: number, phase: Phase, slot: number) => `${rot}:${phase}:${slot}`
export const noteKey = (rot: number, phase: Phase) => `${rot}:${phase}`

/** Positions for the 6 slots (index = slot) – hand-placed overrides win over defaults. */
export function positionsFor(plan: Plan, players: Player[], rot: number, phase: Phase): Pt[] {
  const court = courtAt(plan, players, rot, phase)
  const defaults = defaultPositions(phase, court.map((c) => c.role))
  return defaults.map((d, i) => plan.overrides[posKey(rot, phase, i)] ?? d)
}

/* ------------------------------------------------------------------ */
/* Overlap rules                                                       */
/* ------------------------------------------------------------------ */

export interface Violation {
  /** slots involved */
  slots: number[]
  message: string
}

/**
 * Phases in which the overlap rules are enforced. Under the current Swiss regional rules the
 * serving team may position freely, so only serve receive is checked.
 */
export const overlapApplies = (phase: Phase) => phase === 'receive'

/**
 * FIVB overlap rules at the moment of service:
 *  – each back-row player must be further from the net than the front-row player they stand behind
 *    (P1 behind P2, P6 behind P3, P5 behind P4)
 *  – front-row players must be ordered left → right P4, P3, P2; back row P5, P6, P1.
 */
export function checkOverlap(pts: Pt[]): Violation[] {
  const out: Violation[] = []
  const depth: [number, number][] = [
    [0, 1],
    [5, 2],
    [4, 3],
  ]
  for (const [b, f] of depth) {
    if (pts[b].y <= pts[f].y) {
      out.push({ slots: [b, f], message: `${SLOT_NAMES[b]} must be behind ${SLOT_NAMES[f]}` })
    }
  }
  const lateral: [number, number][] = [
    [3, 2],
    [2, 1],
    [4, 5],
    [5, 0],
  ] // left, right
  for (const [l, r] of lateral) {
    if (pts[l].x >= pts[r].x) {
      out.push({ slots: [l, r], message: `${SLOT_NAMES[l]} must be left of ${SLOT_NAMES[r]}` })
    }
  }
  return out
}

export const clampPt = (p: Pt): Pt => ({
  x: Math.round(Math.min(106, Math.max(-6, p.x)) * 10) / 10,
  y: Math.round(Math.min(120, Math.max(1, p.y)) * 10) / 10,
})
