import { useLayoutEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Note } from '@/data/screens'
import { Rng, hashString } from '@/lib/rng'

/**
 * Chú thích viết tay quanh điện thoại — bắt chước SpeciesAnnotation trong app:
 * vòng khoanh đi ~1,2 vòng với bán kính trôi dần (hai đầu không gặp nhau),
 * mũi tên cong, chữ viết dần. Nét run TIỀN ĐỊNH theo seed, không rung giữa
 * các frame. Ba pha nối tiếp: khoanh → kéo mũi tên → viết chữ.
 */
type Rect = { left: number; top: number; width: number; height: number; stageWidth: number }

function ringPath(cx: number, cy: number, rx: number, ry: number, rng: Rng, arrowAngle: number): { d: string; edge: (a: number) => [number, number] } {
  const w1 = rng.range(0.012, 0.03), w2 = rng.range(0.006, 0.018)
  const ph1 = rng.range(0, Math.PI * 2), ph2 = rng.range(0, Math.PI * 2)
  const h1 = 2 + Math.floor(rng.next() * 2), h2 = 3 + Math.floor(rng.next() * 2)
  const rot = rng.range(-0.3, 0.3)
  const sx = rng.range(0.92, 1.12), sy = rng.range(0.92, 1.12)
  const dir = rng.next() < 0.5 ? -1 : 1
  const sweep = Math.PI * 2 * rng.range(1.14, 1.26) * dir
  const drift = rng.range(0.08, 0.15) * (rng.next() < 0.5 ? -1 : 1)
  const start = arrowAngle + Math.PI + rng.range(-0.9, 0.9)
  const N = 110
  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const k = i / N
    const a = start + sweep * k
    const wob = 1 + w1 * Math.sin(h1 * a + ph1) + w2 * Math.sin(h2 * a + ph2)
    const r = (1 + drift * k) * wob
    const x0 = Math.cos(a) * rx * sx * r, y0 = Math.sin(a) * ry * sy * r
    const x = cx + x0 * Math.cos(rot) - y0 * Math.sin(rot)
    const y = cy + x0 * Math.sin(rot) + y0 * Math.cos(rot)
    pts.push([x, y])
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) d += `L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`
  const edge = (a: number): [number, number] => {
    const ax = rx * sx, ay = ry * sy
    const aa = a - rot
    const ca = Math.cos(aa) * ay, sa = Math.sin(aa) * ax
    const rr = (ax * ay) / Math.sqrt(ca * ca + sa * sa)
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]
  }
  return { d, edge }
}

type Side = 'left' | 'right' | 'center'
type Built = { ring: string; arrow: string; head: string; labelX: number; labelY: number; side: Side; label: string; key: string; maxWidth: number }

function build(notes: Note[], rect: Rect, seedBase: string, compact: boolean): Built[] {
  return (compact ? notes.slice(0, 1) : notes).map((n, i) => {
    const rng = new Rng(hashString(seedBase + ':' + i))
    const [bx, by, bw, bh] = n.box
    const tx = rect.left + bx * rect.width, ty = rect.top + by * rect.height
    const tw = bw * rect.width, th = bh * rect.height
    const inflate = Math.min(tw, th) * 0.16 + 6
    const cx = tx + tw / 2, cy = ty + th / 2
    const rx = tw / 2 + inflate, ry = th / 2 + inflate

    // Điểm neo của chữ: ngoài mép điện thoại (desktop) — hoặc, ở màn hẹp,
    // NGAY TRONG khung màn hình phía còn nhiều chỗ, đúng như app làm.
    const gap = Math.max(44, rect.width * 0.16)
    // Chữ chỉ được chiếm khoảng giữa mép điện thoại và dải ghi chú lề (13vw + lề 3.2vw).
    const sideRoom = rect.stageWidth / 2 - rect.width / 2 - gap - rect.stageWidth * 0.165 - 24
    let side: Side = n.side
    let labelX: number, labelY: number, maxWidth: number
    if (compact) {
      // Đúng lối app: chữ nằm phía còn nhiều chỗ, mũi tên ngắn đâm vào vòng.
      const ringBottom = cy + ry, ringTop = cy - ry
      const roomBelow = rect.top + rect.height - ringBottom, roomAbove = ringTop - rect.top
      const below = roomBelow >= roomAbove
      const lead = Math.min(72, Math.max(40, (below ? roomBelow : roomAbove) * 0.35))
      labelY = below ? ringBottom + lead : ringTop - lead
      side = 'center'
      labelX = Math.min(rect.left + rect.width * 0.72, Math.max(rect.left + rect.width * 0.28, cx))
      maxWidth = rect.width * 0.6
    } else {
      labelX = side === 'right' ? rect.left + rect.width + gap : rect.left - gap
      labelY = cy + (n.dy ?? 0) * rect.height + rng.range(-6, 6)
      maxWidth = Math.max(150, Math.min(300, sideRoom))
    }

    const arrowAngle = Math.atan2(labelY - cy, labelX - cx) + rng.range(-0.12, 0.12)
    const { d, edge } = ringPath(cx, cy, rx, ry, rng, arrowAngle)
    // Mũi tên: từ cạnh chữ, cong nhẹ, chạm mép vòng cách 6px.
    const [ex, ey] = edge(arrowAngle)
    const tipX = ex + Math.cos(arrowAngle) * 7, tipY = ey + Math.sin(arrowAngle) * 7
    const sx0 = side === 'right' ? labelX - 10 : side === 'left' ? labelX + 10 : labelX
    const sy0 = side === 'center' ? (labelY > cy ? labelY - 14 : labelY + 14) : labelY + 8
    const mx = (sx0 + tipX) / 2, my = (sy0 + tipY) / 2
    const nx = -(tipY - sy0), ny = tipX - sx0
    const nl = Math.hypot(nx, ny) || 1
    const bend = rng.range(-0.22, 0.22) * Math.hypot(tipX - sx0, tipY - sy0)
    const cxp = mx + (nx / nl) * bend, cyp = my + (ny / nl) * bend
    const arrow = `M${sx0.toFixed(1)},${sy0.toFixed(1)}Q${cxp.toFixed(1)},${cyp.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`
    // Đầu mũi tên theo hướng tiếp tuyến ở đích.
    const ang = Math.atan2(tipY - cyp, tipX - cxp)
    const L = 13, spread = 0.46
    const h1x = tipX - Math.cos(ang - spread) * L, h1y = tipY - Math.sin(ang - spread) * L
    const h2x = tipX - Math.cos(ang + spread) * L, h2y = tipY - Math.sin(ang + spread) * L
    const head = `M${h1x.toFixed(1)},${h1y.toFixed(1)}L${tipX.toFixed(1)},${tipY.toFixed(1)}L${h2x.toFixed(1)},${h2y.toFixed(1)}`
    return { ring: d, arrow, head, labelX, labelY, side, label: n.label, key: `${seedBase}-${i}`, maxWidth }
  })
}

const RING = 0.9, ARROW = 0.5, LABEL = 0.75
const EASE_IN = [0.42, 0, 1, 1] as const

export function Annotations({ notes, screenRect, seed, reducedMotion }: { notes: Note[]; screenRect: Rect | null; seed: string; reducedMotion: boolean }) {
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const f = () => setCompact(mq.matches)
    f(); mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const built = useMemo(() => (screenRect ? build(notes, screenRect, seed, compact) : []), [notes, screenRect, seed, compact])
  if (!screenRect) return null

  return (
    <div className="notes-layer" aria-hidden="true">
      <AnimatePresence mode="sync">
        {built.map((b, i) => {
          const delay = 0.55 + i * 0.85
          const dur = reducedMotion ? 0.01 : 1
          return (
            <motion.div key={b.key} initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }} style={{ position: 'absolute', inset: 0 }}>
              <svg className="notes-svg" width="100%" height="100%">
                {/* bóng để nét đọc được trên mây sáng */}
                <motion.path d={b.ring} className="ink-shadow" strokeWidth={5} pathLength={1} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: RING * dur, ease: EASE_IN }} />
                <motion.path d={b.ring} className="ink" strokeWidth={2.6} pathLength={1} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay, duration: RING * dur, ease: EASE_IN }} />
                <motion.path d={b.arrow} className="ink-shadow" strokeWidth={4.6} pathLength={1} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: delay + RING * dur * 0.85, duration: ARROW * dur, ease: EASE_IN }} />
                <motion.path d={b.arrow} className="ink" strokeWidth={2.4} pathLength={1} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: delay + RING * dur * 0.85, duration: ARROW * dur, ease: EASE_IN }} />
                <motion.path d={b.head} className="ink" strokeWidth={2.4} pathLength={1} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: delay + (RING * 0.85 + ARROW * 0.9) * dur, duration: 0.18 * dur }} />
              </svg>
              <motion.div
                className="note-label"
                style={{
                  left: b.side === 'left' ? undefined : b.labelX,
                  right: b.side === 'left' ? `calc(100% - ${b.labelX}px)` : undefined,
                  top: b.side === 'center' ? (b.labelY > 0 ? b.labelY - 14 : b.labelY) : b.labelY - 16,
                  textAlign: b.side === 'left' ? 'right' : b.side === 'center' ? 'center' : 'left',
                  maxWidth: b.maxWidth,
                  width: b.side === 'center' ? b.maxWidth : undefined,
                  transform: `${b.side === 'center' ? 'translateX(-50%) ' : ''}rotate(${(hashString(b.key) % 5) - 2}deg)`,
                }}
                initial={{ clipPath: b.side === 'left' ? 'inset(-20% 0 -20% 100%)' : 'inset(-20% 100% -20% 0)' }}
                animate={{ clipPath: 'inset(-20% 0% -20% 0%)' }}
                transition={{ delay: delay + (RING * 0.85 + ARROW * 0.6) * dur, duration: LABEL * dur, ease: 'linear' }}
              >
                {b.label}
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
