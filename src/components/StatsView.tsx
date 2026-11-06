import { useMemo, useState } from 'react'
import { ROLE_META, ROTATIONS, courtAt } from '../lib/formation'
import {
  ACTIONS,
  RATING_LABEL,
  SET_TARGETS,
  actionDef,
  aggregate,
  avg,
  describeEvent,
  emptyStats,
  hitPct,
  pct,
  pointValue,
  totalErrors,
  type PlayerStats,
} from '../lib/stats'
import { useActivePlan, useApp, useUi } from '../lib/store'
import type { StatAction } from '../lib/types'

type Panel = 'record' | 'summary' | 'rotations' | 'log'

export function StatsView() {
  const [panel, setPanel] = useState<Panel>('record')
  const [scope, setScope] = useState<'session' | 'all'>('session')
  const sessions = useApp((s) => s.sessions)
  const activeSessionId = useApp((s) => s.activeSessionId)
  const allEvents = useApp((s) => s.events)
  const { setActiveSession, addSession, renameSession, deleteSession } = useApp.getState()
  const session = sessions.find((s) => s.id === activeSessionId) ?? sessions[0]
  const events = useMemo(() => (scope === 'all' ? allEvents : allEvents.filter((e) => e.sessionId === session.id)), [allEvents, scope, session.id])

  return (
    <div className="page">
      <div className="stats-head">
        <div className="planbar">
          <label className="planbar-select">
            <span className="muted">Session / match</span>
            <select value={session.id} onChange={(e) => setActiveSession(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.date}
                </option>
              ))}
            </select>
          </label>
          <button className="btn small" onClick={() => { const n = prompt('Name of the new session (e.g. "Match vs. Vienna", "Practice 12.11."):'); if (n) addSession(n) }}>＋ New</button>
          <button className="btn small" onClick={() => { const n = prompt('Rename session:', session.name); if (n) renameSession(session.id, n) }}>✎</button>
          <button className="btn small danger" disabled={sessions.length <= 1} onClick={() => confirm(`Delete "${session.name}" and its ${allEvents.filter((e) => e.sessionId === session.id).length} recorded events?`) && deleteSession(session.id)}>🗑</button>
        </div>
        <div className="seg">
          {(['record', 'summary', 'rotations', 'log'] as Panel[]).map((p) => (
            <button key={p} className={panel === p ? 'active' : ''} onClick={() => setPanel(p)}>
              {p === 'record' ? '＋ Record' : p === 'summary' ? 'Players' : p === 'rotations' ? 'Rotations' : `Log (${events.length})`}
            </button>
          ))}
        </div>
        {panel !== 'record' && (
          <div className="seg small">
            <button className={scope === 'session' ? 'active' : ''} onClick={() => setScope('session')}>This session</button>
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All sessions</button>
          </div>
        )}
      </div>

      {panel === 'record' && <RecordPanel />}
      {panel === 'summary' && <SummaryPanel events={events} />}
      {panel === 'rotations' && <RotationPanel events={events} />}
      {panel === 'log' && <LogPanel events={events} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

function RecordPanel() {
  const players = useApp((s) => s.players)
  const events = useApp((s) => s.events)
  const sessionId = useApp((s) => s.activeSessionId)
  const plan = useActivePlan()
  const { rotation, setRotation } = useUi()
  const [action, setAction] = useState<StatAction>('attack')
  const [playerId, setPlayerId] = useState<string>('')
  const [target, setTarget] = useState<string>('')
  const [flash, setFlash] = useState<string>('')

  const onCourt = courtAt(plan, players, rotation, 'receive')
  const orderedSlots = [3, 2, 1, 4, 5, 0]
  const courtPlayers = orderedSlots.map((s) => onCourt[s].player)
  const benchPlayers = players.filter((p) => !courtPlayers.some((c) => c.id === p.id))
  const def = actionDef(action)
  const needsPlayer = action !== 'team'
  const recent = events.filter((e) => e.sessionId === sessionId).slice(-6).reverse()

  const log = (result: string, rating?: number) => {
    if (needsPlayer && !playerId) {
      setFlash('Pick a player first')
      return
    }
    const p = players.find((x) => x.id === playerId)
    useApp.getState().addEvent({
      playerId: needsPlayer ? playerId : undefined,
      rotation,
      action,
      result,
      rating,
      detail: action === 'set' && target ? target : undefined,
    })
    const label = rating !== undefined ? `${def.label} ${rating}` : def.results.find((r) => r.key === result)?.label
    setFlash(`✓ ${p?.name ?? 'Team'} · ${label}`)
  }

  return (
    <div className="record">
      <section className="card">
        <div className="card-title">
          <span>1 · Rotation</span>
          <small className="muted">who is on court is shown first</small>
        </div>
        <div className="rot-bar compact">
          {ROTATIONS.map((r) => (
            <button key={r} className={`rot-chip ${r === rotation ? 'active' : ''}`} onClick={() => setRotation(r)}>
              <b>R{r}</b>
            </button>
          ))}
        </div>

        <div className="card-title spaced">
          <span>2 · Player</span>
        </div>
        <div className="chips">
          {[...courtPlayers, ...benchPlayers].map((p, i) => (
            <button
              key={p.id}
              className={`chip pick ${playerId === p.id ? 'on' : ''} ${i >= courtPlayers.length ? 'dim' : ''}`}
              style={{ ['--role' as string]: ROLE_META[p.role].color }}
              onClick={() => setPlayerId(p.id)}
              disabled={!needsPlayer}
            >
              <i />
              {p.name}
              <small>{ROLE_META[p.role].short}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title"><span>3 · What happened?</span></div>
        <div className="action-tabs">
          {ACTIONS.map((a) => (
            <button key={a.id} className={action === a.id ? 'active' : ''} onClick={() => setAction(a.id)}>
              <span>{a.emoji}</span> {a.label}
            </button>
          ))}
        </div>

        {def.rated ? (
          <>
            {action === 'set' && (
              <div className="chips small-chips">
                <span className="muted">Set to:</span>
                {SET_TARGETS.map((t) => (
                  <button key={t.key} className={`chip pick ${target === t.key ? 'on' : ''}`} onClick={() => setTarget(target === t.key ? '' : t.key)}>{t.label}</button>
                ))}
              </div>
            )}
            <div className="rate-row big">
              {[3, 2, 1, 0].map((r) => (
                <button key={r} className={`rate r${r}`} onClick={() => log('rated', r)}>
                  <b>{r === 0 ? '✕' : r}</b>
                  <small>{RATING_LABEL[r]}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="result-grid big">
            {def.results.map((r) => (
              <button key={r.key} className={`res ${r.tone}`} onClick={() => log(r.key)} title={r.hint}>
                {r.label}
                {r.hint && <small>{r.hint}</small>}
              </button>
            ))}
          </div>
        )}

        <div className="flash-row">
          <span className={`flash ${flash.startsWith('✓') ? 'ok' : ''}`}>{flash || 'Tap a result to record it.'}</span>
          <button className="btn small" onClick={() => { useApp.getState().undoEvent(); setFlash('Undid last entry') }} disabled={!recent.length}>↶ Undo</button>
        </div>
      </section>

      <section className="card">
        <div className="card-title"><span>Latest</span></div>
        <ul className="recent">
          {recent.length === 0 && <li className="muted">Nothing recorded in this session yet.</li>}
          {recent.map((e) => {
            const p = players.find((x) => x.id === e.playerId)
            const pv = pointValue(e)
            return (
              <li key={e.id}>
                <b>{p?.name ?? 'Team'}</b> {describeEvent(e)} <small className="muted">R{e.rotation}</small>
                {pv !== 0 && <span className={`pill ${pv > 0 ? 'good' : 'bad'}`}>{pv > 0 ? '+1' : '−1'}</span>}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Summary tables                                                      */
/* ------------------------------------------------------------------ */

function DistBar({ dist }: { dist: [number, number, number, number] }) {
  const total = dist.reduce((a, b) => a + b, 0)
  if (!total) return <span className="muted">–</span>
  return (
    <div className="distbar" title={`0: ${dist[0]} · 1: ${dist[1]} · 2: ${dist[2]} · 3: ${dist[3]}`}>
      {[3, 2, 1, 0].map((r) => (dist[r] ? <i key={r} className={`r${r}`} style={{ flex: dist[r] }}>{dist[r]}</i> : null))}
    </div>
  )
}

const fmt = (v: number | null, suffix = '') => (v === null ? '–' : `${v}${suffix}`)

function SummaryPanel({ events }: { events: ReturnType<typeof useApp.getState>['events'] }) {
  const players = useApp((s) => s.players)
  const byPlayer = useMemo(() => aggregate(events, (e) => e.playerId), [events])
  const team = useMemo(() => {
    const m = aggregate(events, () => 'team')
    return m.get('team') ?? emptyStats()
  }, [events])

  if (!events.length) return <EmptyHint />

  const rows = players.map((p) => ({ p, s: byPlayer.get(p.id) })).filter((r) => r.s)

  const cols: { head: string; group: string; cell: (s: PlayerStats) => React.ReactNode }[] = [
    { group: 'Serve', head: 'Att', cell: (s) => s.serveTotal || '–' },
    { group: 'Serve', head: 'Ace', cell: (s) => s.aces || '–' },
    { group: 'Serve', head: 'Err', cell: (s) => s.serveErrors || '–' },
    { group: 'Serve', head: 'Ace%', cell: (s) => fmt(pct(s.aces, s.serveTotal), '%') },
    { group: 'Pass', head: 'Att', cell: (s) => s.passTotal || '–' },
    { group: 'Pass', head: 'Avg', cell: (s) => fmt(avg(s.passSum, s.passTotal)) },
    { group: 'Pass', head: 'Dist', cell: (s) => <DistBar dist={s.passDist} /> },
    { group: 'Set', head: 'Att', cell: (s) => s.setTotal || '–' },
    { group: 'Set', head: 'Avg', cell: (s) => fmt(avg(s.setSum, s.setTotal)) },
    { group: 'Attack', head: 'Att', cell: (s) => s.attackTotal || '–' },
    { group: 'Attack', head: 'K', cell: (s) => s.kills || '–' },
    { group: 'Attack', head: 'Err', cell: (s) => s.attackErrors || '–' },
    { group: 'Attack', head: 'Blk', cell: (s) => s.blocked || '–' },
    { group: 'Attack', head: 'K%', cell: (s) => fmt(pct(s.kills, s.attackTotal), '%') },
    { group: 'Attack', head: 'Eff', cell: (s) => fmt(hitPct(s), '%') },
    { group: 'Block', head: 'Stuff', cell: (s) => s.blockStuffs || '–' },
    { group: 'Block', head: 'Touch', cell: (s) => s.blockTouches || '–' },
    { group: 'Dig', head: 'Att', cell: (s) => s.digTotal || '–' },
    { group: 'Dig', head: 'Avg', cell: (s) => fmt(avg(s.digSum, s.digTotal)) },
    { group: 'Total', head: 'Errors', cell: (s) => totalErrors(s) || '–' },
    { group: 'Total', head: '+/−', cell: (s) => <span className={s.pointsWon - s.pointsLost >= 0 ? 'pos' : 'neg'}>{s.pointsWon - s.pointsLost > 0 ? '+' : ''}{s.pointsWon - s.pointsLost}</span> },
  ]
  const groups = cols.reduce<{ name: string; n: number }[]>((acc, c) => {
    const last = acc[acc.length - 1]
    if (last && last.name === c.group) last.n++
    else acc.push({ name: c.group, n: 1 })
    return acc
  }, [])

  const topKill = rows.filter((r) => r.s!.attackTotal >= 3).sort((a, b) => (hitPct(b.s!) ?? -99) - (hitPct(a.s!) ?? -99))[0]
  const topPass = rows.filter((r) => r.s!.passTotal >= 3).sort((a, b) => (avg(b.s!.passSum, b.s!.passTotal) ?? 0) - (avg(a.s!.passSum, a.s!.passTotal) ?? 0))[0]
  const topAce = rows.filter((r) => r.s!.aces > 0).sort((a, b) => b.s!.aces - a.s!.aces)[0]
  const topErr = rows.filter((r) => totalErrors(r.s!) > 0).sort((a, b) => totalErrors(b.s!) - totalErrors(a.s!))[0]

  return (
    <>
      <div className="highlights">
        <Highlight title="Best hitter" value={topKill ? `${topKill.p.name} · ${hitPct(topKill.s!)}% eff.` : '–'} sub="min. 3 attacks" />
        <Highlight title="Best passer" value={topPass ? `${topPass.p.name} · ${avg(topPass.s!.passSum, topPass.s!.passTotal)}` : '–'} sub="avg of 0–3, min. 3 passes" />
        <Highlight title="Most aces" value={topAce ? `${topAce.p.name} · ${topAce.s!.aces}` : '–'} />
        <Highlight title="Most errors" value={topErr ? `${topErr.p.name} · ${totalErrors(topErr.s!)}` : '–'} tone="bad" />
        <Highlight title="Point balance" value={`${team.pointsWon}–${team.pointsLost}`} sub="points won – lost from logged events" />
      </div>

      <div className="card table-wrap">
        <table className="table stats">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky">Player</th>
              {groups.map((g) => (
                <th key={g.name} colSpan={g.n} className="group">{g.name}</th>
              ))}
            </tr>
            <tr>
              {cols.map((c, i) => (
                <th key={i}>{c.head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, s }) => (
              <tr key={p.id}>
                <td className="sticky"><span className="dot" style={{ background: ROLE_META[p.role].color }} />{p.name}</td>
                {cols.map((c, i) => (
                  <td key={i}>{c.cell(s!)}</td>
                ))}
              </tr>
            ))}
            <tr className="total">
              <td className="sticky">Team</td>
              {cols.map((c, i) => (
                <td key={i}>{c.cell(team)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">Pass/set/dig: 3 = perfect, 2 = OK, 1 = poor, 0 = error. Attack efficiency = (kills − errors − blocked) ÷ attempts. Dist = share of 3 / 2 / 1 / 0 ratings.</p>
      <SetDistribution events={events} />
    </>
  )
}

function SetDistribution({ events }: { events: ReturnType<typeof useApp.getState>['events'] }) {
  const players = useApp((s) => s.players)
  const setters = useMemo(() => {
    const m = aggregate(events.filter((e) => e.action === 'set'), (e) => e.playerId)
    return [...m.entries()].map(([id, s]) => ({ player: players.find((p) => p.id === id), s })).filter((x) => x.player)
  }, [events, players])
  if (!setters.length) return null
  return (
    <div className="card">
      <div className="card-title"><span>Where do the sets go?</span></div>
      {setters.map(({ player, s }) => {
        const total = Object.values(s.setTargets).reduce((a, b) => a + b, 0)
        return (
          <div key={player!.id} className="setdist">
            <b>{player!.name}</b>
            <div className="distbar wide">
              {SET_TARGETS.map((t, i) => (s.setTargets[t.key] ? <i key={t.key} className={`c${i}`} style={{ flex: s.setTargets[t.key] }}>{t.label} {Math.round((s.setTargets[t.key] / total) * 100)}%</i> : null))}
              {!total && <span className="muted">no targets recorded – choose “Set to” when recording</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Highlight({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: 'bad' }) {
  return (
    <div className={`highlight ${tone ?? ''}`}>
      <small>{title}</small>
      <b>{value}</b>
      {sub && <small className="muted">{sub}</small>}
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="card empty">
      <h3>No stats yet</h3>
      <p className="muted">Use <b>＋ Record</b> during a match or practice – one tap per ball. You can also tick “Log to stats” in Play mode.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rotations                                                           */
/* ------------------------------------------------------------------ */

function RotationPanel({ events }: { events: ReturnType<typeof useApp.getState>['events'] }) {
  const byRot = useMemo(() => aggregate(events, (e) => String(e.rotation)), [events])
  if (!events.length) return <EmptyHint />
  const max = Math.max(1, ...ROTATIONS.map((r) => Math.max(byRot.get(String(r))?.pointsWon ?? 0, byRot.get(String(r))?.pointsLost ?? 0)))
  const worst = ROTATIONS.map((r) => ({ r, s: byRot.get(String(r)) ?? emptyStats() })).sort((a, b) => a.s.pointsWon - a.s.pointsLost - (b.s.pointsWon - b.s.pointsLost))[0]
  return (
    <>
      <div className="card">
        <div className="card-title"><span>Points by rotation</span><small className="muted">from logged events</small></div>
        <div className="rotstats">
          {ROTATIONS.map((r) => {
            const s = byRot.get(String(r)) ?? emptyStats()
            const bal = s.pointsWon - s.pointsLost
            return (
              <div key={r} className="rotstat">
                <b>R{r}</b>
                <div className="bars">
                  <div className="bar won" style={{ width: `${(s.pointsWon / max) * 100}%` }}>{s.pointsWon || ''}</div>
                  <div className="bar lost" style={{ width: `${(s.pointsLost / max) * 100}%` }}>{s.pointsLost || ''}</div>
                </div>
                <span className={`bal ${bal >= 0 ? 'pos' : 'neg'}`}>{bal > 0 ? '+' : ''}{bal}</span>
                <span className="muted small">pass {fmt(avg(s.passSum, s.passTotal))} · kill {fmt(pct(s.kills, s.attackTotal), '%')}</span>
              </div>
            )
          })}
        </div>
        {worst && worst.s.pointsWon - worst.s.pointsLost < 0 && <p className="hint">Toughest rotation so far: <b>R{worst.r}</b> – worth discussing positions on the Rotations tab.</p>}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Log                                                                 */
/* ------------------------------------------------------------------ */

function LogPanel({ events }: { events: ReturnType<typeof useApp.getState>['events'] }) {
  const players = useApp((s) => s.players)
  const { deleteEvent } = useApp.getState()
  if (!events.length) return <EmptyHint />
  return (
    <div className="card">
      <ul className="eventlog">
        {[...events].reverse().map((e) => {
          const p = players.find((x) => x.id === e.playerId)
          const pv = pointValue(e)
          return (
            <li key={e.id}>
              <span className="muted time">{new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="dot" style={{ background: p ? ROLE_META[p.role].color : '#888' }} />
              <b>{p?.name ?? 'Team'}</b>
              <span>{describeEvent(e)}</span>
              <small className="muted">R{e.rotation}</small>
              {pv !== 0 && <span className={`pill ${pv > 0 ? 'good' : 'bad'}`}>{pv > 0 ? '+1' : '−1'}</span>}
              <button className="btn small ghost" onClick={() => deleteEvent(e.id)} aria-label="Delete entry">✕</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
