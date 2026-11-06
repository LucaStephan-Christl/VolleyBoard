import { forwardRef, type CSSProperties, type PointerEventHandler, type ReactNode } from 'react'
import { ROLE_META, SLOT_NAMES, type SlotInfo } from '../lib/formation'
import type { Pt } from '../lib/types'

export function viewFor(full: boolean) {
  return full ? { x0: -14, y0: -112, w: 128, h: 244 } : { x0: -14, y0: -10, w: 128, h: 142 }
}

/** Court coordinates → css left/top percentages inside the court box. */
export function toStyle(p: Pt, full: boolean): CSSProperties {
  const v = viewFor(full)
  return { left: `${((p.x - v.x0) / v.w) * 100}%`, top: `${((p.y - v.y0) / v.h) * 100}%` }
}

/** Pointer position → court coordinates. */
export function fromClient(clientX: number, clientY: number, el: HTMLElement, full: boolean): Pt {
  const r = el.getBoundingClientRect()
  const v = viewFor(full)
  return { x: v.x0 + ((clientX - r.left) / r.width) * v.w, y: v.y0 + ((clientY - r.top) / r.height) * v.h }
}

const ZONE_CENTERS: Pt[] = [
  { x: 82, y: 78 },
  { x: 82, y: 20 },
  { x: 50, y: 20 },
  { x: 18, y: 20 },
  { x: 18, y: 78 },
  { x: 50, y: 78 },
]

interface CourtProps {
  full?: boolean
  zones?: boolean
  mini?: boolean
  overlay?: ReactNode
  children?: ReactNode
  className?: string
}

export const Court = forwardRef<HTMLDivElement, CourtProps>(function Court(
  { full = false, zones = false, mini = false, overlay, children, className = '' },
  ref,
) {
  const v = viewFor(full)
  return (
    <div
      ref={ref}
      className={`court ${mini ? 'court-mini' : ''} ${className}`}
      style={{ aspectRatio: `${v.w} / ${v.h}` }}
    >
      <svg className="court-svg" viewBox={`${v.x0} ${v.y0} ${v.w} ${v.h}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.4" markerHeight="3.4" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
          <pattern id="netmesh" width="3" height="3" patternUnits="userSpaceOnUse">
            <path d="M0 0 L3 3 M3 0 L0 3" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.35" />
          </pattern>
        </defs>
        <rect x={v.x0} y={v.y0} width={v.w} height={v.h} className="court-free" />
        {full && <rect x="0" y="-100" width="100" height="100" className="court-floor court-floor-opp" />}
        <rect x="0" y="0" width="100" height="100" className="court-floor" />
        {/* lines */}
        <g className="court-lines">
          <rect x="0" y={full ? -100 : 0} width="100" height={full ? 200 : 100} fill="none" />
          <line x1="0" y1="33.33" x2="100" y2="33.33" />
          {full && <line x1="0" y1="-33.33" x2="100" y2="-33.33" />}
        </g>
        {/* net */}
        <rect x="-3" y="-2.2" width="106" height="4.4" fill="url(#netmesh)" className="court-net" />
        <line x1="-3" y1="0" x2="103" y2="0" className="court-net-line" />
        <circle cx="-3" cy="0" r="1.4" className="court-post" />
        <circle cx="103" cy="0" r="1.4" className="court-post" />
        {zones &&
          ZONE_CENTERS.map((c, i) => (
            <text key={i} x={c.x} y={c.y} className="court-zone-label" textAnchor="middle" dominantBaseline="middle">
              {SLOT_NAMES[i]}
            </text>
          ))}
        {overlay}
      </svg>
      {children}
    </div>
  )
})

interface TokenProps {
  info: SlotInfo
  pt: Pt
  full?: boolean
  mini?: boolean
  bad?: boolean
  selected?: boolean
  dragging?: boolean
  dropTarget?: boolean
  glow?: boolean
  showSlot?: boolean
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onClick?: () => void
  style?: CSSProperties
}

export function Token({ info, pt, full = false, mini = false, bad, selected, dragging, dropTarget, glow, showSlot = true, onPointerDown, onClick, style }: TokenProps) {
  const meta = ROLE_META[info.role]
  return (
    <div
      className={`token ${mini ? 'token-mini' : ''} ${dragging ? 'dragging' : ''} ${bad ? 'bad' : ''} ${selected ? 'selected' : ''} ${dropTarget ? 'drop' : ''} ${glow ? 'glow' : ''}`}
      style={{ ...toStyle(pt, full), ['--role' as string]: meta.color, ['--role-text' as string]: meta.text, ...style }}
      data-slot={info.slot}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={`${info.player.name} · ${meta.label}${info.liberoFor ? ` (for ${info.liberoFor.name})` : ''} · ${SLOT_NAMES[info.slot]}`}
    >
      <div className="token-disc">
        <span className="token-role">{info.player.number ? `#${info.player.number}` : meta.short}</span>
        {showSlot && !mini && <span className="token-slot">{SLOT_NAMES[info.slot]}</span>}
      </div>
      <div className="token-name">{info.player.name}</div>
    </div>
  )
}
