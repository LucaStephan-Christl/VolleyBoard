import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Court, Token, fromClient, toStyle } from './Court'
import { ROLE_META, ROTATIONS, SLOT_NAMES, courtAt, positionsFor } from '../lib/formation'
import { ACTIONS, RATING_LABEL } from '../lib/stats'
import { useActivePlan, useApp, useUi } from '../lib/store'
import type { Phase, Pt } from '../lib/types'

type Scenario = 'receive' | 'serve'
type Stage = 'ready' | 'flying' | 'await-pass' | 'await-set' | 'await-attack' | 'await-serve' | 'done'

interface Ctx {
  receiver?: number
  passRating?: number
  setter?: number
  landing?: Pt
  hitter?: number
  setRating?: number
  server?: number
}

interface Outcome {
  kind: 'us' | 'them' | 'live'
  text: string
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const weighted = <T,>(items: [T, number][]) => {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [v, w] of items) {
    r -= w
    if (r <= 0) return v
  }
  return items[0][0]
}
const zoneName = (p: Pt) => {
  const col = p.x < 33.3 ? 'left' : p.x < 66.6 ? 'middle' : 'right'
  const row = p.y < 33.3 ? 'front' : p.y < 66.6 ? 'mid' : 'deep'
  return `${row} ${col}`
}
const inCourt = (p: Pt) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100

const SET_TARGET_BY_ROLE = (role: string, back: boolean) => (role === 'OH' ? (back ? 'pipe' : 'oh') : role === 'MB' ? 'mb' : role === 'OPP' ? (back ? 'back' : 'opp') : 'dump')

export function PlayView() {
  const players = useApp((s) => s.players)
  const plan = useActivePlan()
  const { rotation, setRotation } = useUi()

  const [scenario, setScenario] = useState<Scenario>('receive')
  const [stage, setStage] = useState<Stage>('ready')
  const [formation, setFormation] = useState<Phase>('receive')
  const [overrides, setOverrides] = useState<Record<number, Pt>>({})
  const [ball, setBall] = useState<{ x: number; y: number; z: number } | null>(null)
  const [marker, setMarker] = useState<{ pt: Pt; kind: 'in' | 'out' | 'block' } | null>(null)
  const [ctx, setCtxState] = useState<Ctx>({})
  const [log, setLog] = useState<string[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [record, setRecord] = useState(false)
  const [auto, setAuto] = useState(false)
  const [speed, setSpeed] = useState(1)

  const courtRef = useRef<HTMLDivElement>(null)
  const runRef = useRef(0)
  const rafRef = useRef(0)
  const ctxRef = useRef<Ctx>({})
  const patchCtx = (p: Partial<Ctx>) => {
    ctxRef.current = { ...ctxRef.current, ...p }
    setCtxState(ctxRef.current)
  }
  const say = (m: string) => setLog((l) => [...l, m])

  const phaseForScenario: Phase = scenario === 'receive' ? 'receive' : 'serve'
  const receiveCourt = useMemo(() => courtAt(plan, players, rotation, 'receive'), [plan, players, rotation])
  const serveCourt = useMemo(() => courtAt(plan, players, rotation, 'serve'), [plan, players, rotation])
  const receivePts = useMemo(() => positionsFor(plan, players, rotation, 'receive'), [plan, players, rotation])
  const attackPts = useMemo(() => positionsFor(plan, players, rotation, 'attack'), [plan, players, rotation])
  const servePts = useMemo(() => positionsFor(plan, players, rotation, 'serve'), [plan, players, rotation])

  const court = scenario === 'receive' ? receiveCourt : serveCourt
  const basePts = formation === 'receive' ? receivePts : formation === 'attack' ? attackPts : servePts
  const shown = basePts.map((p, i) => overrides[i] ?? p)
  const setterSlot = court.findIndex((c) => c.role === 'S')

  const reset = useCallback(
    (sc: Scenario = scenario) => {
      runRef.current++
      cancelAnimationFrame(rafRef.current)
      setStage('ready')
      setFormation(sc === 'receive' ? 'receive' : 'serve')
      setOverrides({})
      setBall(null)
      setMarker(null)
      ctxRef.current = {}
      setCtxState({})
      setLog([])
      setOutcome(null)
    },
    [scenario],
  )

  // restart whenever the setup changes
  useEffect(() => {
    reset(scenario)
  }, [scenario, rotation, plan, players, reset])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  /** animate the ball along a parabola; resolves when done (or immediately if the run was cancelled). */
  const fly = (from: Pt, to: Pt, ms: number, arc: number) =>
    new Promise<void>((resolve) => {
      const my = runRef.current
      const t0 = performance.now()
      const dur = ms / speed
      const step = (t: number) => {
        if (my !== runRef.current) return resolve()
        const k = Math.min(1, (t - t0) / dur)
        setBall({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: 4 * arc * k * (1 - k) })
        if (k < 1) rafRef.current = requestAnimationFrame(step)
        else resolve()
      }
      rafRef.current = requestAnimationFrame(step)
    })
  const alive = (my: number) => my === runRef.current

  const log$ = (kind: 'pass' | 'set' | 'attack' | 'serve', playerSlot: number | undefined, result: string, rating?: number, detail?: string) => {
    if (!record || playerSlot === undefined) return
    const c = kind === 'serve' ? serveCourt : receiveCourt
    const player = c[playerSlot]?.player
    useApp.getState().addEvent({ playerId: player?.id, rotation, action: kind, result, rating, detail })
  }

  /* ---------------------------- receive scenario ---------------------------- */

  const serveIn = async (target: Pt) => {
    if (stage !== 'ready' || scenario !== 'receive') return
    const my = runRef.current
    setStage('flying')
    const start: Pt = { x: rnd(25, 75), y: -108 }
    if (!inCourt(target)) {
      say('Opponent serve is long/wide… out!')
      await fly(start, target, 1000, 30)
      if (!alive(my)) return
      setMarker({ pt: target, kind: 'out' })
      setOutcome({ kind: 'us', text: 'Serve error – point for us' })
      setStage('done')
      return
    }
    let best = 0
    let bd = Infinity
    shown.forEach((p, i) => {
      const role = court[i].role
      let d = dist(p, target)
      if (role === 'S') d *= 1.6
      if (role === 'MB') d *= 1.3
      if (role === 'OPP') d *= 1.15
      if (d < bd) {
        bd = d
        best = i
      }
    })
    patchCtx({ receiver: best })
    setOverrides({ [best]: target })
    say(`Serve to ${zoneName(target)} – ${court[best].player.name} (${SLOT_NAMES[best]}) receives.`)
    await fly(start, target, 1000, 32)
    if (!alive(my)) return
    setMarker({ pt: target, kind: 'in' })
    setStage('await-pass')
  }

  const passRate = async (rating: number) => {
    if (stage !== 'await-pass') return
    const my = runRef.current
    const rec = ctxRef.current.receiver!
    const from = shown[rec]
    log$('pass', rec, 'rated', rating)
    patchCtx({ passRating: rating })
    setMarker(null)
    if (rating === 0) {
      setStage('flying')
      say(`${court[rec].player.name} shanks it – ace against.`)
      await fly(from, { x: from.x + rnd(-40, 40) > 50 ? 108 : -8, y: rnd(30, 90) }, 700, 20)
      if (!alive(my)) return
      setOutcome({ kind: 'them', text: 'Ace against – point for them' })
      setStage('done')
      return
    }
    setStage('flying')
    const sSlot = setterSlot >= 0 ? setterSlot : 1
    const sPos = attackPts[sSlot]
    const off = rating === 3 ? { x: 4, y: 4 } : rating === 2 ? { x: -10, y: 11 } : { x: -22, y: 26 }
    const landing: Pt = { x: Math.min(98, Math.max(2, sPos.x + off.x + rnd(-2, 2))), y: Math.max(5, sPos.y + off.y + rnd(-2, 2)) }
    patchCtx({ setter: sSlot, landing })
    setFormation('attack')
    setOverrides({ [sSlot]: landing })
    say(
      rating === 3
        ? `Perfect pass (3) – the setter has every option.`
        : rating === 2
          ? `Decent pass (2) – a bit off the net.`
          : `Poor pass (1) – off the net, no quick middle.`,
    )
    await fly(from, landing, 800, 34)
    if (!alive(my)) return
    setStage('await-set')
  }

  const setTo = async (slot: number) => {
    if (stage !== 'await-set') return
    const c = ctxRef.current
    if (court[slot].role === 'L') return
    if (court[slot].role === 'MB' && c.passRating === 1) {
      say(`${court[slot].player.name} can't hit a quick set from that pass – choose someone else.`)
      return
    }
    const my = runRef.current
    setStage('flying')
    patchCtx({ hitter: slot })
    const hp = shown[slot] ?? attackPts[slot]
    const dest: Pt = slot === c.setter ? { x: c.landing!.x - 2, y: Math.max(2, c.landing!.y - 6) } : { x: hp.x, y: Math.max(3, hp.y - 2) }
    say(`${court[c.setter!].player.name} sets ${court[slot].player.name}.`)
    await fly(c.landing!, dest, 700, 20)
    if (!alive(my)) return
    setStage('await-attack')
  }

  const attackResult = async (key: string) => {
    if (stage !== 'await-attack') return
    const my = runRef.current
    const c = ctxRef.current
    const hitter = c.hitter!
    const hp = shown[hitter]
    const from: Pt = { x: hp.x, y: Math.max(2, hp.y - 4) }
    setStage('flying')
    const role = court[hitter].role
    const back = hp.y > 36
    // the set is only logged when the user rated it
    if (c.setRating !== undefined) log$('set', c.setter, 'rated', c.setRating, SET_TARGET_BY_ROLE(role, back))
    log$('attack', hitter, key)
    let dest: Pt
    let kind: 'in' | 'out' | 'block' = 'in'
    let out: Outcome
    const hx = Math.min(95, Math.max(5, hp.x))
    switch (key) {
      case 'kill':
        dest = { x: rnd(15, 85), y: -rnd(55, 92) }
        out = { kind: 'us', text: `Kill! ${court[hitter].player.name} scores.` }
        break
      case 'blockout':
        dest = { x: hx < 50 ? -7 : 107, y: -rnd(15, 40) }
        kind = 'out'
        out = { kind: 'us', text: `Off the block and out – point for us (block-out).` }
        break
      case 'feint':
        dest = { x: Math.min(90, Math.max(10, hx + rnd(-15, 15))), y: -rnd(6, 16) }
        out = { kind: 'us', text: `Soft touch – feint falls in. Point for us.` }
        break
      case 'roll':
        dest = { x: rnd(20, 80), y: -rnd(72, 90) }
        out = { kind: 'us', text: `Roll shot drops behind the block.` }
        break
      case 'tool':
        dest = { x: hx < 50 ? 112 : -12, y: -rnd(5, 25) }
        kind = 'out'
        out = { kind: 'us', text: `${court[hitter].player.name} tooled the block. Point for us.` }
        break
      case 'dug':
        dest = { x: rnd(20, 80), y: -rnd(40, 70) }
        out = { kind: 'live', text: `Dug by the opponent – ball is still live, get into transition!` }
        break
      case 'blocked':
        dest = { x: hx + rnd(-8, 8), y: rnd(6, 18) }
        kind = 'block'
        out = { kind: 'them', text: `Stuffed! Point for them.` }
        break
      default:
        dest = pick<Pt>([{ x: rnd(10, 90), y: -112 }, { x: rnd(-14, -4), y: -rnd(20, 60) }, { x: hx, y: -0.5 }])
        kind = 'out'
        out = { kind: 'them', text: `Hitting error – point for them.` }
    }
    say(`${ACTIONS.find((a) => a.id === 'attack')!.results.find((r) => r.key === key)!.label}.`)
    await fly(from, dest, key === 'roll' || key === 'feint' ? 800 : 600, key === 'roll' ? 38 : key === 'feint' ? 12 : 10)
    if (!alive(my)) return
    setMarker({ pt: dest, kind })
    setOutcome(out)
    if (key === 'dug') {
      // they dig it and counter-attack: we drop into our block & defense formation
      setFormation('defense')
      setOverrides({})
      say('Block & defense formation – block up, everyone around the block.')
    }
    setStage('done')
  }

  /* ----------------------------- serve scenario ----------------------------- */

  const serveOut = async (target: Pt) => {
    if (stage !== 'ready' || scenario !== 'serve') return
    const my = runRef.current
    setStage('flying')
    patchCtx({ server: 0 })
    const start = shown[0]
    say(`${serveCourt[0].player.name} serves toward ${zoneName({ x: target.x, y: -target.y })}.`)
    await fly({ x: start.x, y: start.y - 2 }, target, 1100, 36)
    if (!alive(my)) return
    const out = target.x < 0 || target.x > 100 || target.y < -100 || target.y > 0
    setMarker({ pt: target, kind: out ? 'out' : 'in' })
    if (out) {
      log$('serve', 0, 'error')
      setOutcome({ kind: 'them', text: 'Serve error – point for them.' })
      setStage('done')
    } else setStage('await-serve')
  }

  const serveResult = (key: string) => {
    if (stage !== 'await-serve') return
    log$('serve', 0, key)
    const t: Record<string, Outcome> = {
      ace: { kind: 'us', text: 'ACE! Point for us.' },
      good: { kind: 'live', text: 'In play – now get in your block / defence base.' },
      tough: { kind: 'live', text: 'Tough serve – they are out of system.' },
      error: { kind: 'them', text: 'Serve error – point for them.' },
    }
    setOutcome(t[key])
    setStage('done')
  }

  /* ----------------------------- court click ----------------------------- */

  const onCourtClick = (e: React.MouseEvent) => {
    const el = courtRef.current
    if (!el || stage !== 'ready') return
    const p = fromClient(e.clientX, e.clientY, el, true)
    if (scenario === 'receive' && p.y > -2) void serveIn({ x: p.x, y: Math.max(1, p.y) })
    if (scenario === 'serve' && p.y < 0) void serveOut(p)
  }

  const randomServe = () => {
    if (scenario === 'receive') void serveIn({ x: rnd(8, 92), y: rnd(14, 94) })
    else void serveOut({ x: rnd(8, 92), y: -rnd(10, 92) })
  }

  /* ----------------------------- auto play ----------------------------- */

  const actions = useRef({ randomServe, passRate, setTo, attackResult, serveResult })
  actions.current = { randomServe, passRate, setTo, attackResult, serveResult }
  const rotateTo = (n: number) => setRotation(n)

  useEffect(() => {
    if (!auto) return
    const wait = 650 / speed
    const t = setTimeout(() => {
      const a = actions.current
      if (stage === 'ready') a.randomServe()
      else if (stage === 'await-pass') a.passRate(weighted<number>([[0, 5], [1, 20], [2, 40], [3, 35]]))
      else if (stage === 'await-set') {
        const options = court.map((c, i) => ({ c, i })).filter(({ c, i }) => c.role !== 'L' && !(c.role === 'MB' && ctxRef.current.passRating === 1) && i !== ctxRef.current.setter)
        const choice = weighted(options.map(({ c, i }) => [i, c.role === 'OH' ? 4 : c.role === 'OPP' ? 3 : c.role === 'MB' ? 2 : 0.5] as [number, number]))
        void a.setTo(choice)
      } else if (stage === 'await-attack') {
        patchCtx({ setRating: Math.max(1, Math.min(3, (ctxRef.current.passRating ?? 2) + weighted<number>([[-1, 1], [0, 3], [1, 1]]))) })
        void a.attackResult(weighted<string>([['kill', 34], ['blockout', 6], ['feint', 6], ['roll', 4], ['tool', 4], ['dug', 22], ['blocked', 12], ['error', 12]]))
      } else if (stage === 'await-serve') a.serveResult(weighted<string>([['ace', 10], ['good', 55], ['tough', 20], ['error', 15]]))
      else if (stage === 'done') {
        if (outcome?.kind === 'us' && scenario === 'receive') {
          // side-out: rotate and serve
          setScenario('serve')
          rotateTo(rotation + 1)
        } else if (scenario === 'serve') {
          if (outcome?.kind === 'us') reset(scenario)
          else {
            setScenario('receive')
            reset('receive')
          }
        } else reset(scenario)
      }
    }, stage === 'done' ? 1700 / speed : wait)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, stage, scenario, rotation, outcome])

  /* ----------------------------- render ----------------------------- */

  const allowedSetTargets = new Set(
    stage === 'await-set' ? court.map((c, i) => ({ c, i })).filter(({ c }) => c.role !== 'L' && !(c.role === 'MB' && ctx.passRating === 1)).map(({ i }) => i) : [],
  )

  const prompt = (() => {
    switch (stage) {
      case 'ready':
        return scenario === 'receive' ? 'Click anywhere on YOUR court to tell the opponent where to serve – or press “Random serve”.' : 'Click on the OPPONENT’S court to place the serve – or press “Random serve”.'
      case 'flying':
        return 'Ball in the air…'
      case 'await-pass':
        return `How good was ${court[ctx.receiver ?? 0]?.player.name}'s pass?`
      case 'await-set':
        return ctx.passRating === 1 ? 'Out-of-system pass. Who gets the set? (no quick middle)' : 'Click the hitter who should get the set.'
      case 'await-attack':
        return `${court[ctx.hitter ?? 0]?.player.name} swings – what happened? (optionally rate the set first)`
      case 'await-serve':
        return 'How did the serve go?'
      case 'done':
        return outcome?.text ?? ''
    }
  })()

  const attackDefs = ACTIONS.find((a) => a.id === 'attack')!.results
  const serveDefs = ACTIONS.find((a) => a.id === 'serve')!.results

  const opp: Pt[] = [
    { x: 18, y: -10 },
    { x: 50, y: -10 },
    { x: 82, y: -10 },
    { x: 15, y: -62 },
    { x: 50, y: -78 },
    { x: 85, y: -62 },
  ]

  return (
    <div className="board play">
      <div className="board-main">
        <div className="court-wrap tall">
          <div className="court-click" onClick={onCourtClick} style={{ cursor: stage === 'ready' ? 'crosshair' : 'default' }}>
            <Court ref={courtRef} full>
              {opp.map((p, i) => (
                <div key={i} className="opp" style={toStyle(p, true)}>
                  {i < 3 ? 'B' : ''}
                </div>
              ))}
              {scenario === 'receive' && <div className="opp server" style={toStyle({ x: 72, y: -107 }, true)}>S</div>}
              {court.map((info, i) => (
                <Token
                  key={`${info.player.id}-${i}`}
                  info={info}
                  pt={shown[i]}
                  full
                  glow={allowedSetTargets.has(i) && i !== ctx.setter}
                  selected={ctx.hitter === i || (stage === 'await-pass' && ctx.receiver === i)}
                  onClick={() => stage === 'await-set' && void setTo(i)}
                  style={{ cursor: allowedSetTargets.has(i) ? 'pointer' : undefined, zIndex: ctx.setter === i || ctx.receiver === i ? 5 : undefined }}
                />
              ))}
              {marker && (
                <div className={`marker ${marker.kind}`} style={toStyle(marker.pt, true)}>
                  {marker.kind === 'out' ? '✕' : marker.kind === 'block' ? '✋' : '●'}
                </div>
              )}
              {ball && (
                <>
                  <div className="ball-shadow" style={toStyle({ x: ball.x, y: ball.y }, true)} />
                  <div className="ball" style={toStyle({ x: ball.x, y: ball.y - ball.z }, true)}>🏐</div>
                </>
              )}
              <div className="court-caption top">OPPONENT</div>
              <div className="court-caption bottom">OUR SIDE</div>
            </Court>
          </div>
        </div>
      </div>

      <aside className="board-side">
        <section className="card">
          <div className="seg">
            <button className={scenario === 'receive' ? 'active' : ''} onClick={() => setScenario('receive')}>Receive &amp; attack</button>
            <button className={scenario === 'serve' ? 'active' : ''} onClick={() => setScenario('serve')}>Our serve</button>
          </div>
          <div className="rot-bar compact">
            {ROTATIONS.map((r) => (
              <button key={r} className={`rot-chip ${r === rotation ? 'active' : ''}`} onClick={() => setRotation(r)}>
                <b>R{r}</b>
              </button>
            ))}
          </div>
          <p className="muted small">Players start in your <b>{PHASE_LABEL[phaseForScenario]}</b> positions from the Rotations tab{scenario === 'receive' ? ' and release to your “After receive” spots once the ball is passed' : ''}.</p>
        </section>

        <section className={`card prompt ${outcome ? outcome.kind : ''}`}>
          <div className="prompt-text">{prompt}</div>

          {stage === 'ready' && (
            <button className="btn primary" onClick={randomServe}>🎲 Random serve</button>
          )}

          {stage === 'await-pass' && (
            <div className="rate-row">
              {[3, 2, 1, 0].map((r) => (
                <button key={r} className={`rate r${r}`} onClick={() => void passRate(r)} title={RATING_LABEL[r]}>
                  <b>{r === 0 ? '✕' : r}</b>
                  <small>{r === 0 ? 'Shank / ace' : r === 3 ? 'Perfect' : r === 2 ? 'OK' : 'Poor'}</small>
                </button>
              ))}
            </div>
          )}

          {stage === 'await-attack' && (
            <>
              <div className="sub-title">Set quality <small className="muted">(optional – logged for {court[ctx.setter ?? 0]?.player.name})</small></div>
              <div className="rate-row">
                {[3, 2, 1].map((r) => (
                  <button key={r} className={`rate r${r} ${ctx.setRating === r ? 'on' : ''}`} onClick={() => patchCtx({ setRating: ctx.setRating === r ? undefined : r })}>
                    <b>{r}</b>
                  </button>
                ))}
              </div>
              <div className="sub-title">Attack result</div>
              <div className="result-grid">
                {attackDefs.map((r) => (
                  <button key={r.key} className={`res ${r.tone}`} onClick={() => void attackResult(r.key)} title={r.hint}>
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {stage === 'await-serve' && (
            <div className="result-grid">
              {serveDefs.map((r) => (
                <button key={r.key} className={`res ${r.tone}`} onClick={() => serveResult(r.key)} title={r.hint}>
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {stage === 'done' && (
            <div className="row-gap wrap">
              {outcome?.kind === 'us' && scenario === 'receive' ? (
                <button className="btn primary" onClick={() => { setScenario('serve'); rotateTo(rotation + 1) }}>Side-out → rotate &amp; serve ⟳</button>
              ) : (
                <button className="btn primary" onClick={() => reset(scenario)}>Next rally ↻</button>
              )}
              <button className="btn" onClick={() => reset(scenario)}>Replay</button>
              <button className="btn" onClick={() => rotateTo(rotation + 1)}>Next rotation ›</button>
            </div>
          )}
        </section>

        <section className="card">
          <div className="row-gap wrap">
            <label className="toggle"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-play rallies</label>
            <label className="toggle"><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /> Log to stats</label>
          </div>
          <label className="toggle speed">
            Speed
            <input type="range" min={0.5} max={2.5} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            <span>{speed}×</span>
          </label>
          <button className="btn small" onClick={() => reset(scenario)}>Reset rally</button>
        </section>

        <section className="card">
          <div className="card-title"><span>Rally log</span></div>
          <ol className="log">
            {log.length === 0 && <li className="muted">Nothing yet.</li>}
            {log.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
            {outcome && <li className={`out ${outcome.kind}`}>{outcome.text}</li>}
          </ol>
          <div className="legend small">
            {(['S', 'OH', 'MB', 'OPP', 'L'] as const).map((r) => (
              <span key={r} className="legend-item"><span className="dot" style={{ background: ROLE_META[r].color }} />{ROLE_META[r].label}</span>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

const PHASE_LABEL: Record<Phase, string> = { receive: 'serve-receive', attack: 'after-receive', defense: 'block & defense', serve: 'our-serve' }
