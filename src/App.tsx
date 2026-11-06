import { useEffect, useState } from 'react'
import { BoardView } from './components/BoardView'
import { PlayView } from './components/PlayView'
import { RosterView } from './components/RosterView'
import { ShareDialog, importFromHash } from './components/ShareDialog'
import { StatsView } from './components/StatsView'
import { useApp, useUi, type Tab } from './lib/store'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'board', label: 'Rotations', icon: '◫' },
  { id: 'play', label: 'Play', icon: '▶' },
  { id: 'stats', label: 'Stats', icon: '▤' },
  { id: 'roster', label: 'Team', icon: '☺' },
]

export default function App() {
  const { tab, setTab } = useUi()
  const [share, setShare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const eventCount = useApp((s) => s.events.length)

  useEffect(() => {
    importFromHash().then((m) => m && setToast(m))
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-ball" aria-hidden>🏐</span>
          <span>Volley<b>Board</b></span>
        </div>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="tab-icon" aria-hidden>{t.icon}</span>
              <span className="tab-label">{t.label}</span>
              {t.id === 'stats' && eventCount > 0 && <span className="badge">{eventCount}</span>}
            </button>
          ))}
        </nav>
        <button className="btn ghost share-btn" onClick={() => setShare(true)}>⇪ <span className="hide-sm">Share / Backup</span></button>
      </header>

      <main className="content">
        {tab === 'board' && <BoardView />}
        {tab === 'play' && <PlayView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'roster' && <RosterView />}
      </main>

      {share && <ShareDialog onClose={() => setShare(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
