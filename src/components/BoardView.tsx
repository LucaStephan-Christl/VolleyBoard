import { useEffect, useMemo, useRef, useState } from 'react'
import { Court, Token, fromClient, toStyle } from './Court'
import { PlanBar } from './PlanBar'
import {
  PHASES,
  ROLE_META,
  ROTATIONS,
  SLOT_NAMES,
  SLOT_ZONE,
  checkOverlap,
  overlapApplies,
  clampPt,
  courtAt,
  lineupAt,
  noteKey,
  positionsFor,
} from '../lib/formation'
import { useActivePlan, useApp, useUi } from '../lib/store'
import type { Phase, Pt } from '../lib/types'

const snapPt = (p: Pt, on: boolean): Pt => (on ? { x: Math.round(p.x / 2.5) * 2.5, y: Math.round(p.y / 2.5) * 2.5 } : p)

export function BoardView() {
  const players = useApp((s) => s.players)
  const plan = useActivePlan()
  const { setPosition, resetPositions, substitute, setNote, setLibero, copyPhase } = useApp.getState()
  const { rotation, phase, setRotation, setPhase } = useUi()

  const [overview, setOverview] = useState(false)
  const [showMoves, setShowMoves] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [snap, setSnap] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ slot: number; pt: Pt } | null>(null)
  const [benchDrag, setBenchDrag] = useState<{ id: string; x: number; y: number; over: number | null } | null>(null)
  const courtRef = useRef<HTMLDivElement>(null)

  const court = useMemo(() => courtAt(plan, players, rotation, phase), [plan, players, rotation, phase])
  const stored = useMemo(() => positionsFor(plan, players, rotation, phase), [plan, players, rotation, phase])
  const pts = stored.map((p, i) => (drag && drag.slot === i ? drag.pt : p))
  const violations = overlapApplies(phase) ? checkOverlap(pts) : []
  const badSlots = new Set(violations.flatMap((v) => v.slots))
  const customCount = Object.keys(plan.overrides).filter((k) => k.startsWith(`${rotation}:${phase}:`)).length

  // keyboard: arrows nudge selected token, [ ] switch rotation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT') return
      if (e.key === '[') setRotation(rotation - 1)
      if (e.key === ']') setRotation(rotation + 1)
      if (selected !== null && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const d = e.shiftKey ? 5 : 1
        const p = { ...stored[selected] }
        if (e.key === 'ArrowLeft') p.x -= d
        if (e.key === 'ArrowRight') p.x += d
        if (e.key === 'ArrowUp') p.y -= d
        if (e.key === 'ArrowDown') p.y += d
        setPosition(rotation, phase, selected, clampPt(p))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rotation, phase, selected, stored, setPosition, setRotation])

  const startTokenDrag = (slot: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const el = courtRef.current
    if (!el) return
    e.preventDefault()
    setSelected(slot)
    const start = fromClient(e.clientX, e.clientY, el, false)
    const origin = stored[slot]
    const off = { x: origin.x - start.x, y: origin.y - start.y }
    let last = origin
    setDrag({ slot, pt: origin })
    const move = (ev: PointerEvent) => {
      const p = fromClient(ev.clientX, ev.clientY, el, false)
      last = clampPt(snapPt({ x: p.x + off.x, y: p.y + off.y }, snap))
      setDrag({ slot, pt: last })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (last.x !== origin.x || last.y !== origin.y) setPosition(rotation, phase, slot, last)
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const startBenchDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    const slotAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest('[data-slot]') as HTMLElement | null
      return el && courtRef.current?.contains(el) ? Number(el.dataset.slot) : null
    }
    setBenchDrag({ id, x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY) })
    const move = (ev: PointerEvent) => setBenchDrag({ id, x: ev.clientX, y: ev.clientY, over: slotAt(ev.clientX, ev.clientY) })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const s = slotAt(ev.clientX, ev.clientY)
      if (s !== null) substitute(rotation, s, id)
      setBenchDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /* movement arrows between receive ⇄ attack */
  const otherPhase: Phase | null = phase === 'receive' ? 'attack' : phase === 'attack' ? 'receive' : phase === 'defense' ? 'attack' : null
  const otherPts = useMemo(() => (otherPhase ? positionsFor(plan, players, rotation, otherPhase) : null), [plan, players, rotation, otherPhase])
  const arrows =
    showMoves && otherPts ? (
      <g>
        {court.map((c, i) => {
          const from = phase === 'receive' ? pts[i] : otherPts[i]
          const to = phase === 'receive' ? otherPts[i] : pts[i]
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="move-arrow"
              style={{ color: ROLE_META[c.role].color }}
              markerEnd="url(#arrowhead)"
            />
          )
        })}
      </g>
    ) : null

  const ghosts =
    showMoves && otherPts
      ? court.map((c, i) => (
          <div key={`g${i}`} className="tghost" style={{ ...toStyle(otherPts[i], false), ['--role' as string]: ROLE_META[c.role].color }}>
            {c.player.name.slice(0, 2)}
          </div>
        ))
      : null

  const byId = new Map(players.map((p) => [p.id, p]))
  const onCourtIds = new Set(plan.base)
  const bench = players.filter((p) => !onCourtIds.has(p.id))
  const lineup = lineupAt(plan.base, rotation)
  const note = plan.notes[noteKey(rotation, phase)] ?? ''
  const phaseInfo = PHASES.find((p) => p.id === phase)!

  const setterSlotAt = (r: number) => lineupAt(plan.base, r).findIndex((id) => byId.get(id)?.role === 'S')

  return (
    <div className="board">
      <div className="board-main">
        <PlanBar />

        <div className="rot-bar" role="tablist" aria-label="Rotation">
          {ROTATIONS.map((r) => {
            const s = setterSlotAt(r)
            return (
              <button key={r} className={`rot-chip ${r === rotation ? 'active' : ''}`} onClick={() => setRotation(r)} role="tab" aria-selected={r === rotation}>
                <b>R{r}</b>
                <small>{s >= 0 ? `S in ${SLOT_NAMES[s]}` : 'no setter'}</small>
              </button>
            )
          })}
          <button className={`btn ghost ${overview ? 'on' : ''}`} onClick={() => setOverview((o) => !o)} title="See all six rotations side by side">
            ▦ Overview
          </button>
        </div>

        <div className="phase-bar" role="tablist" aria-label="Phase">
          {PHASES.map((p) => (
            <button key={p.id} className={`phase-chip ${p.id === phase ? 'active' : ''}`} onClick={() => setPhase(p.id)} role="tab" aria-selected={p.id === phase}>
              {p.label}
            </button>
          ))}
        </div>

        {overview ? (
          <div className="overview">
            {ROTATIONS.map((r) => {
              const c = courtAt(plan, players, r, phase)
              const p = positionsFor(plan, players, r, phase)
              const v = overlapApplies(phase) ? checkOverlap(p) : []
              return (
                <button key={r} className={`overview-cell ${r === rotation ? 'active' : ''}`} onClick={() => { setRotation(r); setOverview(false) }}>
                  <div className="overview-title">
                    Rotation {r} {v.length > 0 && <span className="pill bad">illegal</span>}
                  </div>
                  <Court mini zones>
                    {c.map((info, i) => (
                      <Token key={i} info={info} pt={p[i]} mini showSlot={false} />
                    ))}
                  </Court>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className="court-wrap">
              <Court ref={courtRef} zones={showZones} overlay={arrows}>
                {ghosts}
                {court.map((info, i) => (
                  <Token
                    key={i}
                    info={info}
                    pt={pts[i]}
                    bad={badSlots.has(i)}
                    selected={selected === i}
                    dragging={drag?.slot === i}
                    dropTarget={benchDrag?.over === i}
                    onPointerDown={startTokenDrag(i)}
                  />
                ))}
                <div className="court-caption top">NET</div>
                <div className="court-caption bottom">{phase === 'serve' ? 'P1 serves from behind the end line' : 'End line'}</div>
              </Court>
            </div>

            <div className="toolbar">
              <label className="toggle"><input type="checkbox" checked={showMoves} onChange={(e) => setShowMoves(e.target.checked)} disabled={!otherPts} /> Movement arrows</label>
              <label className="toggle"><input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> Zone labels</label>
              <label className="toggle"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap to grid</label>
              <span className="spacer" />
              <button className="btn" disabled={!customCount} onClick={() => resetPositions({ rot: rotation, phase })}>Reset this view</button>
              <button className="btn" onClick={() => { if (confirm(`Reset all phases of rotation ${rotation} to the defaults?`)) resetPositions({ rot: rotation }) }}>Reset rotation</button>
            </div>
          </>
        )}
      </div>

      <aside className="board-side">
        <section className="card">
          <div className="card-title">
            <span>{phaseInfo.label} · Rotation {rotation}</span>
            {overlapApplies(phase) && (
              <span className={`pill ${violations.length ? 'bad' : 'good'}`}>{violations.length ? `${violations.length} overlap` : 'Legal'}</span>
            )}
          </div>
          <p className="muted">{phaseInfo.blurb}</p>
          {violations.length > 0 && (
            <ul className="violations">
              {violations.map((v, i) => (
                <li key={i}>⚠ {v.message}</li>
              ))}
            </ul>
          )}
          {phase === 'attack' && <p className="muted">No overlap rules once the ball is served, so go wherever the play needs you.</p>}
          {phase === 'serve' && <p className="muted">Swiss regional rules: the serving team may position freely on its side – no overlap check here.</p>}
          {phase === 'attack' && (
            <button className="btn small" onClick={() => copyPhase(rotation, 'receive', 'attack', positionsFor(plan, players, rotation, 'receive'))} title="Start from the receive formation">
              Copy receive spots here
            </button>
          )}
          <p className="hint">Drag players to place them · arrow keys nudge the selected player (Shift = bigger steps) · [ ] change rotation</p>
        </section>

        <section className="card">
          <div className="card-title">
            <span>Lineup · rotation {rotation}</span>
            <label className="toggle small"><input type="checkbox" checked={plan.useLibero} onChange={(e) => setLibero(e.target.checked)} /> Libero</label>
          </div>
          <div className="lineup-grid">
            {[3, 2, 1, 4, 5, 0].map((slot) => {
              const info = court[slot]
              const underlying = byId.get(lineup[slot])!
              return (
                <label key={slot} className={`lineup-cell ${selected === slot ? 'sel' : ''}`} onClick={() => setSelected(slot)}>
                  <span className="lineup-label">
                    {SLOT_NAMES[slot]} <small>{SLOT_ZONE[slot]}</small>
                  </span>
                  <select
                    value={underlying.id}
                    onChange={(e) => substitute(rotation, slot, e.target.value)}
                    style={{ borderColor: ROLE_META[underlying.role].color }}
                  >
                    {players
                      .filter((p) => p.role !== 'L')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({ROLE_META[p.role].short})
                        </option>
                      ))}
                  </select>
                  {info.liberoFor && <small className="lib-note">{info.player.name} (L) is in for {info.liberoFor.name}</small>}
                </label>
              )
            })}
          </div>
          <p className="hint">Changing a player here keeps the spots you drew for that position – the new player just takes them over.</p>
        </section>

        <section className="card">
          <div className="card-title">
            <span>Bench</span>
            <small className="muted">drag onto the court to substitute</small>
          </div>
          <div className="bench">
            {bench.length === 0 && <span className="muted">Everyone is on court.</span>}
            {bench.map((p) => (
              <div key={p.id} className="chip" style={{ ['--role' as string]: ROLE_META[p.role].color }} onPointerDown={startBenchDrag(p.id)}>
                <i />
                {p.name}
                <small>{ROLE_META[p.role].short}{p.role === 'L' && plan.useLibero ? ' · auto' : ''}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-title">
            <span>Notes</span>
            <small className="muted">R{rotation} · {phaseInfo.short}</small>
          </div>
          <textarea
            className="notes"
            placeholder="Who covers the tip? Where does the setter run? Write the agreement here…"
            value={note}
            onChange={(e) => setNote(rotation, phase, e.target.value)}
            rows={4}
          />
        </section>
      </aside>

      {benchDrag && (
        <div className="drag-ghost" style={{ left: benchDrag.x, top: benchDrag.y, ['--role' as string]: ROLE_META[byId.get(benchDrag.id)!.role].color }}>
          {byId.get(benchDrag.id)!.name}
        </div>
      )}
    </div>
  )
}
