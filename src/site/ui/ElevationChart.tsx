// Biểu đồ độ cao của một lộ trình — vùng tô MỘT màu phẳng (không gradient),
// mỗi đoạn của tuyến một vùng riêng: khe tạm dừng không bị nối thành dốc giả.
// Rê / chạm lên biểu đồ thì báo điểm tương ứng để bản đồ đặt chấm con trỏ.

import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { distance, meters } from '@/shared/format'
import { pointAtDistance } from '../core/geometry'
import type { Profile, ProfilePoint } from '../core/geometry'

const W = 600
const H = 150
const PAD_TOP = 10
const PAD_BOTTOM = 6

export function ElevationChart({ profile, onHover }: { profile: Profile; onHover(p: ProfilePoint | null): void }) {
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<ProfilePoint | null>(null)
  const span = Math.max(1, profile.maxEle - profile.minEle)
  const x = (d: number) => (d / profile.lengthM) * W
  const y = (e: number) => PAD_TOP + (1 - (e - profile.minEle) / span) * (H - PAD_TOP - PAD_BOTTOM)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = box.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    const d = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * profile.lengthM
    const p = pointAtDistance(profile, d)
    setAt(p)
    onHover(p)
  }
  const leave = () => {
    setAt(null)
    onHover(null)
  }

  return (
    <figure className="st-elev">
      <div className="st-elev-plot" ref={box} onPointerMove={move} onPointerDown={move} onPointerLeave={leave}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {profile.segments.map((s, i) => {
            const line = s.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.d).toFixed(1)} ${y(p.ele).toFixed(1)}`).join(' ')
            const area = `${line} L${x(s[s.length - 1].d).toFixed(1)} ${H} L${x(s[0].d).toFixed(1)} ${H} Z`
            return (
              <g key={i}>
                <path className="st-elev-area" d={area} />
                <path className="st-elev-line" d={line} vectorEffect="non-scaling-stroke" />
              </g>
            )
          })}
          {at && <line className="st-elev-cursor" x1={x(at.d)} x2={x(at.d)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />}
        </svg>
        {at && (
          <span className="st-elev-tip" style={{ left: `${(at.d / profile.lengthM) * 100}%` }}>
            {distance(at.d)} · {meters(Math.round(at.ele))}
          </span>
        )}
      </div>
      <figcaption className="st-elev-axis">
        <span>{meters(Math.round(profile.minEle))} – {meters(Math.round(profile.maxEle))}</span>
        <span>{distance(profile.lengthM)}</span>
      </figcaption>
    </figure>
  )
}
