import type { PersistedData, Plan, Player, Session } from './types'

export const DEFAULT_PLAYERS: Player[] = [
  { id: 'alen', name: 'Alen', role: 'L' },
  { id: 'andi', name: 'Andi', role: 'OH' },
  { id: 'endri', name: 'Endri', role: 'OH' },
  { id: 'luca', name: 'Luca', role: 'OH' },
  { id: 'dani', name: 'Dani', role: 'MB' },
  { id: 'eldin', name: 'Eldin', role: 'OPP' },
  { id: 'maciek', name: 'Maciek', role: 'S' },
  { id: 'nilay', name: 'Nilay', role: 'MB' },
  { id: 'tizi', name: 'Tizi', role: 'OPP' },
  { id: 'tristan', name: 'Tristan', role: 'S' },
]

export function makeDefaultPlans(): Plan[] {
  return [
    {
      id: 'plan-maciek',
      name: '5-1 · Maciek',
      // P1..P6 in rotation 1: setter, OH, MB, Dia, OH, MB
      base: ['maciek', 'andi', 'dani', 'eldin', 'endri', 'nilay'],
      useLibero: true,
      overrides: {},
      notes: {},
    },
    {
      id: 'plan-tristan',
      name: '5-1 · Tristan',
      base: ['tristan', 'luca', 'nilay', 'tizi', 'endri', 'dani'],
      useLibero: true,
      overrides: {},
      notes: {},
    },
  ]
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export function makeDefaultSession(): Session {
  return { id: 'session-1', name: 'Practice', date: todayISO() }
}

export function makeDefaultData(): PersistedData {
  const plans = makeDefaultPlans()
  const session = makeDefaultSession()
  return {
    players: DEFAULT_PLAYERS.map((p) => ({ ...p })),
    plans,
    activePlanId: plans[0].id,
    sessions: [session],
    activeSessionId: session.id,
    events: [],
  }
}

export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
