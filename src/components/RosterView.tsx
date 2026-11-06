import { useState } from 'react'
import { ROLE_META } from '../lib/formation'
import { useApp } from '../lib/store'
import type { Role } from '../lib/types'

const ROLES: Role[] = ['S', 'OH', 'MB', 'OPP', 'L']

export function RosterView() {
  const players = useApp((s) => s.players)
  const plans = useApp((s) => s.plans)
  const { updatePlayer, addPlayer, removePlayer, resetRoster } = useApp.getState()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('OH')

  const starters = new Set(plans.flatMap((p) => p.base))

  return (
    <div className="page narrow">
      <h2>Team roster</h2>
      <p className="muted">Roles decide where the default positions put each player (setter hides at the net, outsides pass, middles block, the libero replaces the back-row middle).</p>

      <div className="card">
        <table className="table roster">
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>#</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="dot" style={{ background: ROLE_META[p.role].color }} />
                  <input value={p.name} onChange={(e) => updatePlayer(p.id, { name: e.target.value })} aria-label="Name" />
                </td>
                <td>
                  <select value={p.role} onChange={(e) => updatePlayer(p.id, { role: e.target.value as Role })} aria-label="Position">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label} ({ROLE_META[r].short})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="num" value={p.number ?? ''} maxLength={2} placeholder="–" onChange={(e) => updatePlayer(p.id, { number: e.target.value || undefined })} aria-label="Jersey number" />
                </td>
                <td>
                  <button className="btn small danger" disabled={players.length <= 6} title={starters.has(p.id) ? 'Starter – will be replaced by a bench player' : 'Remove'} onClick={() => confirm(`Remove ${p.name}?`) && removePlayer(p.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form
          className="add-player"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            addPlayer({ name: name.trim(), role })
            setName('')
          }}
        >
          <input placeholder="New player name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>
          <button className="btn primary" type="submit">Add player</button>
        </form>
      </div>

      <div className="legend">
        {ROLES.map((r) => (
          <span key={r} className="legend-item">
            <span className="dot" style={{ background: ROLE_META[r].color }} /> {ROLE_META[r].label}
          </span>
        ))}
      </div>

      <button className="btn" onClick={() => confirm('Reset roster to Alen, Andi, Endri, Luca, Dani, Eldin, Maciek, Nilay, Tizi, Tristan?') && resetRoster()}>
        Restore original roster
      </button>
    </div>
  )
}
