import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PLAYERS, makeDefaultData, todayISO, uid } from './defaults'
import { baseIndexFor, noteKey, posKey } from './formation'
import type { PersistedData, Phase, Plan, Player, Pt, Session, StatEvent } from './types'
import type { SharedStrategy } from './share'

interface Actions {
  /* roster */
  updatePlayer: (id: string, patch: Partial<Player>) => void
  addPlayer: (p: Omit<Player, 'id'>) => void
  removePlayer: (id: string) => void
  resetRoster: () => void
  /* plans */
  setActivePlan: (id: string) => void
  addPlan: (name: string, copyFrom?: string) => void
  renamePlan: (id: string, name: string) => void
  deletePlan: (id: string) => void
  setLibero: (on: boolean) => void
  /** Put `playerId` into slot at the given rotation. If they already play, the two players trade places. */
  substitute: (rot: number, slot: number, playerId: string) => void
  setPosition: (rot: number, phase: Phase, slot: number, pt: Pt) => void
  resetPositions: (scope: { rot?: number; phase?: Phase }) => void
  copyPhase: (rot: number, from: Phase, to: Phase, pts: Pt[]) => void
  setNote: (rot: number, phase: Phase, text: string) => void
  /* stats */
  addEvent: (e: Omit<StatEvent, 'id' | 't' | 'sessionId'>) => void
  deleteEvent: (id: string) => void
  undoEvent: () => void
  addSession: (name: string) => void
  renameSession: (id: string, name: string) => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  /* data */
  importAll: (data: PersistedData) => void
  importStrategy: (s: SharedStrategy) => void
  resetAll: () => void
}

export type AppState = PersistedData & Actions

const updateActivePlan = (s: AppState, fn: (p: Plan) => Plan): Partial<AppState> => ({
  plans: s.plans.map((p) => (p.id === s.activePlanId ? fn(p) : p)),
})

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...makeDefaultData(),

      updatePlayer: (id, patch) => set((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      addPlayer: (p) => set((s) => ({ players: [...s.players, { ...p, id: uid('p') }] })),
      removePlayer: (id) =>
        set((s) => {
          if (s.players.length <= 6) return s
          const rest = s.players.filter((p) => p.id !== id)
          // anyone removed from a lineup is replaced by the first available non-starter
          const plans = s.plans.map((pl) => {
            if (!pl.base.includes(id)) return pl
            const free = rest.find((p) => !pl.base.includes(p.id))
            return { ...pl, base: pl.base.map((b) => (b === id ? (free ?? rest[0]).id : b)) }
          })
          return { players: rest, plans, events: s.events.map((e) => (e.playerId === id ? { ...e, playerId: undefined } : e)) }
        }),
      resetRoster: () => set({ players: DEFAULT_PLAYERS.map((p) => ({ ...p })) }),

      setActivePlan: (id) => set({ activePlanId: id }),
      addPlan: (name, copyFrom) =>
        set((s) => {
          const src = s.plans.find((p) => p.id === (copyFrom ?? s.activePlanId)) ?? s.plans[0]
          const plan: Plan = copyFrom
            ? { ...structuredClone(src), id: uid('plan'), name }
            : { ...structuredClone(src), id: uid('plan'), name, overrides: {}, notes: {} }
          return { plans: [...s.plans, plan], activePlanId: plan.id }
        }),
      renamePlan: (id, name) => set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, name } : p)) })),
      deletePlan: (id) =>
        set((s) => {
          if (s.plans.length <= 1) return s
          const plans = s.plans.filter((p) => p.id !== id)
          return { plans, activePlanId: s.activePlanId === id ? plans[0].id : s.activePlanId }
        }),
      setLibero: (on) => set((s) => updateActivePlan(s, (p) => ({ ...p, useLibero: on }))),

      substitute: (rot, slot, playerId) =>
        set((s) =>
          updateActivePlan(s, (p) => {
            const base = [...p.base]
            const bi = baseIndexFor(slot, rot)
            const j = base.indexOf(playerId)
            if (j === bi) return p
            if (j >= 0) [base[bi], base[j]] = [base[j], base[bi]]
            else base[bi] = playerId
            return { ...p, base }
          }),
        ),

      setPosition: (rot, phase, slot, pt) =>
        set((s) => updateActivePlan(s, (p) => ({ ...p, overrides: { ...p.overrides, [posKey(rot, phase, slot)]: pt } }))),
      resetPositions: ({ rot, phase }) =>
        set((s) =>
          updateActivePlan(s, (p) => {
            const overrides: Record<string, Pt> = {}
            for (const [k, v] of Object.entries(p.overrides)) {
              const [r, ph] = k.split(':')
              const hit = (rot === undefined || Number(r) === rot) && (phase === undefined || ph === phase)
              if (!hit) overrides[k] = v
            }
            return { ...p, overrides }
          }),
        ),
      copyPhase: (rot, _from, to, pts) =>
        set((s) =>
          updateActivePlan(s, (p) => {
            const overrides = { ...p.overrides }
            pts.forEach((pt, i) => (overrides[posKey(rot, to, i)] = pt))
            return { ...p, overrides }
          }),
        ),
      setNote: (rot, phase, text) =>
        set((s) =>
          updateActivePlan(s, (p) => {
            const notes = { ...p.notes }
            if (text) notes[noteKey(rot, phase)] = text
            else delete notes[noteKey(rot, phase)]
            return { ...p, notes }
          }),
        ),

      addEvent: (e) =>
        set((s) => ({ events: [...s.events, { ...e, id: uid('e'), t: Date.now(), sessionId: s.activeSessionId }] })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      undoEvent: () =>
        set((s) => {
          for (let i = s.events.length - 1; i >= 0; i--) {
            if (s.events[i].sessionId === s.activeSessionId) return { events: s.events.filter((_, j) => j !== i) }
          }
          return s
        }),
      addSession: (name) =>
        set((s) => {
          const session: Session = { id: uid('session'), name, date: todayISO() }
          return { sessions: [...s.sessions, session], activeSessionId: session.id }
        }),
      renameSession: (id, name) => set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, name } : x)) })),
      deleteSession: (id) =>
        set((s) => {
          if (s.sessions.length <= 1) return s
          const sessions = s.sessions.filter((x) => x.id !== id)
          return {
            sessions,
            events: s.events.filter((e) => e.sessionId !== id),
            activeSessionId: s.activeSessionId === id ? sessions[0].id : s.activeSessionId,
          }
        }),
      setActiveSession: (id) => set({ activeSessionId: id }),

      importAll: (data) => set({ ...data }),
      importStrategy: (st) =>
        set((s) => ({ players: st.players, plans: st.plans, activePlanId: st.plans.some((p) => p.id === st.activePlanId) ? st.activePlanId : st.plans[0].id, events: s.events })),
      resetAll: () => set({ ...makeDefaultData() }),
    }),
    {
      name: 'volley-board-v1',
      version: 1,
      partialize: (s): PersistedData => ({
        players: s.players,
        plans: s.plans,
        activePlanId: s.activePlanId,
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        events: s.events,
      }),
    },
  ),
)

export const useActivePlan = () => {
  const plans = useApp((s) => s.plans)
  const id = useApp((s) => s.activePlanId)
  return plans.find((p) => p.id === id) ?? plans[0]
}

/* ---------- ephemeral UI state (not persisted) ---------- */

export type Tab = 'board' | 'play' | 'stats' | 'roster'

interface UiState {
  tab: Tab
  rotation: number
  phase: Phase
  setTab: (t: Tab) => void
  setRotation: (r: number) => void
  setPhase: (p: Phase) => void
}

export const useUi = create<UiState>((set) => ({
  tab: 'board',
  rotation: 1,
  phase: 'receive',
  setTab: (tab) => set({ tab }),
  setRotation: (rotation) => set({ rotation: ((rotation - 1 + 6) % 6) + 1 }),
  setPhase: (phase) => set({ phase }),
}))
