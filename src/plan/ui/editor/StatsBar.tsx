import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { distance, duration, meters, pace as fmtPace } from '../../core/format'
import { eleAt, profileGeometry, stopOffsets } from '../../core/profile'
import type { PlanResult } from '../../core/types'

interface Props {
  result: PlanResult | null
  pace: number
  fresh: boolean
  onPace(): void
  /** Tỉ lệ 0–1 dọc kế hoạch đang rê chuột (null: rời biểu đồ). */
  onHover(frac: number | null): void
}

const H = 64

export function StatsBar({ result, pace, fresh, onPace, onHover }: Props) {
  const t = result?.totals
  const has = !!t && result!.stops.length >= 2
  return (
    <div className={`pl-stats${fresh ? '' : ' is-stale'}${has ? '' : ' is-empty'}`}>
      <dl className="pl-stats-grid">
        <Stat label="Quãng đường" value={has ? distance(t!.distanceM) : '—'} />
        <Stat label="Thời gian" value={has ? duration(t!.elapsedMin) : '—'} sub={has ? `đi bộ ${duration(t!.walkMin)}` : undefined} />
        <Stat label="Leo" value={has ? `↑ ${meters(t!.ascentM)}` : '—'} />
        <Stat label="Xuống" value={has ? `↓ ${meters(t!.descentM)}` : '—'} />
        <Stat label="Số ngày" value={has ? String(t!.dayCount) : '—'} />
        <Stat label="Đường đã biết" value={has ? `${t!.knownPct}%` : '—'} />
        <div className="pl-stat">
          <dt>Tốc độ</dt>
          <dd>
            <button type="button" className="pl-text-btn" onClick={onPace} title="Đổi tốc độ đi">
              {fmtPace(pace)}
            </button>
          </dd>
        </div>
      </dl>
      {has && <Profile result={result!} onHover={onHover} />}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="pl-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {sub && <small>{sub}</small>}
    </div>
  )
}

function Profile({ result, onHover }: { result: PlanResult; onHover: Props['onHover'] }) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [hx, setHx] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const g = useMemo(() => (w > 0 ? profileGeometry(result, w, H) : null), [result, w])
  const offsets = useMemo(() => stopOffsets(result), [result])
  if (!g) return <div ref={box} className="pl-profile is-empty"><span className="pl-muted">Chưa có độ cao</span></div>

  const xOf = (m: number) => (m / g.totalM) * w
  const nights = result.stops
    .map((s, i) => ({ s, m: offsets[i] }))
    .filter(({ s }, i) => s.rest && i > 0 && i < result.stops.length - 1)
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(w, e.clientX - r.left))
    setHx(x)
    onHover(x / w)
  }
  const leave = () => {
    setHx(null)
    onHover(null)
  }
  const hm = hx == null ? null : (hx / w) * g.totalM
  const he = hm == null ? null : eleAt(result, hm)
  return (
    <div ref={box} className="pl-profile">
      <svg width={w} height={H} onPointerMove={move} onPointerLeave={leave} role="img" aria-label={`Độ cao từ ${meters(g.minEle)} tới ${meters(g.maxEle)}`}>
        <path d={g.area} className="pl-prof-area" />
        <path d={g.line} className="pl-prof-line" />
        {nights.map(({ s, m }) => (
          <g key={s.id}>
            <line x1={xOf(m)} x2={xOf(m)} y1={0} y2={H} className="pl-prof-night" />
          </g>
        ))}
        {hx != null && <line x1={hx} x2={hx} y1={0} y2={H} className="pl-prof-cursor" />}
      </svg>
      <span className="pl-prof-max">{meters(g.maxEle)}</span>
      <span className="pl-prof-min">{meters(g.minEle)}</span>
      {hm != null && (
        <span className="pl-prof-tip" style={{ left: Math.min(Math.max(hx! - 50, 0), w - 100) }}>
          {distance(hm)}{he != null && ` · ${meters(he)}`}
        </span>
      )}
    </div>
  )
}
