export type Role = 'S' | 'OH' | 'MB' | 'OPP' | 'L'

export interface Player {
  id: string
  name: string
  role: Role
  number?: string
}

/** The three moments of a rally we plan positions for. */
export type Phase = 'receive' | 'attack' | 'serve'

/** 0-based slot index: 0 = P1 (right back / server) ... 5 = P6 (middle back). */
export type SlotIdx = 0 | 1 | 2 | 3 | 4 | 5

/** Court coordinates for our half: x 0..100 left→right, y 0 (net) .. 100 (end line). */
export interface Pt {
  x: number
  y: number
}

export interface Plan {
  id: string
  name: string
  /** Player ids standing in P1..P6 (index 0..5) in rotation 1. Other rotations are derived. */
  base: string[]
  useLibero: boolean
  /** Hand-placed positions. key = `${rotation}:${phase}:${slotIdx}` */
  overrides: Record<string, Pt>
  /** Discussion notes. key = `${rotation}:${phase}` */
  notes: Record<string, string>
}

export interface Session {
  id: string
  name: string
  date: string
}

export type StatAction = 'serve' | 'pass' | 'set' | 'attack' | 'block' | 'dig' | 'error' | 'team'

export interface StatEvent {
  id: string
  t: number
  sessionId: string
  playerId?: string
  rotation: number
  action: StatAction
  /** result key, see lib/stats.ts for the catalogue */
  result: string
  /** 0..3 quality rating for pass / set / dig */
  rating?: number
  /** extra info – set target, attack zone ... */
  detail?: string
}

export interface PersistedData {
  players: Player[]
  plans: Plan[]
  activePlanId: string
  sessions: Session[]
  activeSessionId: string
  events: StatEvent[]
}
