import { useRef, useState } from 'react'
import { decodeStrategy, downloadJson, encodeStrategy } from '../lib/share'
import { useApp } from '../lib/store'
import type { PersistedData } from '../lib/types'

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const snapshot = (): PersistedData => {
    const s = useApp.getState()
    return { players: s.players, plans: s.plans, activePlanId: s.activePlanId, sessions: s.sessions, activeSessionId: s.activeSessionId, events: s.events }
  }

  const makeLink = async () => {
    const code = await encodeStrategy(snapshot())
    const url = `${location.origin}${location.pathname}#s=${code}`
    setLink(url)
    try {
      await navigator.clipboard.writeText(url)
      setMsg('Link copied! Send it to the team – opening it offers to load your lineups and positions.')
    } catch {
      setMsg('Copy the link below and send it to the team.')
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text()) as PersistedData
      if (!Array.isArray(data.players) || !Array.isArray(data.plans) || !Array.isArray(data.events)) throw new Error()
      if (confirm('Replace everything (roster, plans and stats) with the contents of this file?')) {
        useApp.getState().importAll(data)
        setMsg('Imported ✓')
      }
    } catch {
      setMsg('That file is not a Volley Board backup.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Share and backup">
        <div className="card-title">
          <span>Share &amp; backup</span>
          <button className="btn small ghost" onClick={onClose}>✕</button>
        </div>
        <p className="muted">Everything is saved automatically in this browser. Use these to move it between devices or share with the team.</p>

        <div className="modal-row">
          <div>
            <b>Share strategy link</b>
            <p className="muted">Roster, lineups, positions and notes (no stats) packed into a link.</p>
          </div>
          <button className="btn primary" onClick={makeLink}>Copy link</button>
        </div>
        {link && <textarea className="notes mono" readOnly rows={3} value={link} onFocus={(e) => e.currentTarget.select()} />}

        <div className="modal-row">
          <div>
            <b>Full backup</b>
            <p className="muted">Everything including all recorded stats as a .json file.</p>
          </div>
          <div className="row-gap">
            <button className="btn" onClick={() => downloadJson(`volley-board-${new Date().toISOString().slice(0, 10)}.json`, snapshot())}>Export</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Import</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>

        <div className="modal-row">
          <div>
            <b>Start over</b>
            <p className="muted">Wipes plans, notes and stats and restores the starting lineups.</p>
          </div>
          <button className="btn danger" onClick={() => confirm('Really delete everything and start over?') && (useApp.getState().resetAll(), setMsg('Reset.'))}>Reset all</button>
        </div>

        {msg && <p className="toast-inline">{msg}</p>}
      </div>
    </div>
  )
}

/** Handles `#s=...` links: offers to load the shared strategy. */
export async function importFromHash(): Promise<string | null> {
  const m = location.hash.match(/^#s=(.+)$/)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  try {
    const st = await decodeStrategy(m[1])
    if (confirm(`Load the shared strategy (${st.plans.length} plan${st.plans.length > 1 ? 's' : ''}, ${st.players.length} players)? This replaces your current roster and plans – your stats stay.`)) {
      useApp.getState().importStrategy(st)
      return 'Shared strategy loaded ✓'
    }
  } catch {
    return 'That share link could not be read.'
  }
  return null
}
