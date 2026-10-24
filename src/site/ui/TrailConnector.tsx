// Đường mòn nét đứt nối các khối của trang chủ (như đường nối trong bản mẫu
// "case study") — đi tới đâu vẽ tới đó theo cuộn, cuối đường là lá cờ.
//
// Điểm neo là phần tử mang `data-trail-anchor` trong khung; `data-ax` / `data-ay`
// (0..1) chọn điểm trên khung của nó. Màn hẹp không vẽ: các khối xếp một cột,
// đường nối chỉ còn là một vạch dọc vô nghĩa.

import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Doodle } from './Doodle'

const MIN_WIDTH = 1000

interface Geometry {
  d: string
  width: number
  height: number
  start: { x: number; y: number }
  end: { x: number; y: number }
}

function measure(root: HTMLElement): Geometry | null {
  if (root.clientWidth < MIN_WIDTH) return null
  const box = root.getBoundingClientRect()
  const pts = [...root.querySelectorAll<HTMLElement>('[data-trail-anchor]')].map((el) => {
    const r = el.getBoundingClientRect()
    const ax = Number(el.dataset.ax ?? 0.5)
    const ay = Number(el.dataset.ay ?? 0.5)
    return { x: r.left - box.left + r.width * ax, y: r.top - box.top + r.height * ay }
  })
  if (pts.length < 2) return null
  // Mỗi chặng là một chữ S: tiếp tuyến dọc ở hai đầu, nên đường luôn đi XUỐNG
  // như một lối mòn đổ dốc, không bao giờ vòng ngược lên.
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dy = (b.y - a.y) * 0.55
    d += ` C${a.x.toFixed(1)} ${(a.y + dy).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - dy).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
  }
  return { d, width: box.width, height: box.height, start: pts[0], end: pts[pts.length - 1] }
}

export function TrailConnector({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const [geo, setGeo] = useState<Geometry | null>(null)
  const maskRef = useRef<SVGPathElement>(null)
  const flagRef = useRef<HTMLDivElement>(null)

  // useEffect, không phải useLayoutEffect: layout effect của component con chạy
  // TRƯỚC khi ref của khung cha được gắn, nên lúc đó chưa có khung để đo.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let raf = 0
    const remeasure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setGeo(measure(root)))
    }
    remeasure()
    const ro = new ResizeObserver(remeasure)
    ro.observe(root)
    // Ảnh tải muộn làm khối cao lên: đo lại khi từng ảnh về.
    root.addEventListener('load', remeasure, true)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.removeEventListener('load', remeasure, true)
    }
  }, [rootRef])

  // Vẽ theo cuộn: phần đường nằm trên mép 70% khung nhìn thì đã hiện.
  useEffect(() => {
    const root = rootRef.current
    const mask = maskRef.current
    if (!root || !mask || !geo) return
    const len = mask.getTotalLength()
    mask.style.strokeDasharray = `${len}`
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    // Đường luôn đi xuống, nên phần đã vẽ ≈ tỉ lệ theo chiều dọc giữa hai đầu đường.
    const span = Math.max(1, geo.end.y - geo.start.y)
    const draw = () => {
      raf = 0
      const top = root.getBoundingClientRect().top
      const reach = reduced ? 1 : Math.min(1, Math.max(0, (window.innerHeight * 0.7 - top - geo.start.y) / span))
      mask.style.strokeDashoffset = `${len * (1 - reach)}`
      flagRef.current?.classList.toggle('is-in', reach > 0.985)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [geo, rootRef])

  if (!geo) return null
  return (
    <div className="st-connector" aria-hidden="true">
      <svg width={geo.width} height={geo.height} viewBox={`0 0 ${geo.width} ${geo.height}`}>
        <defs>
          <mask id="st-connector-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={geo.width} height={geo.height}>
            <path ref={maskRef} d={geo.d} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          </mask>
        </defs>
        <path className="st-connector-path" d={geo.d} mask="url(#st-connector-mask)" />
      </svg>
      <div ref={flagRef} className="st-connector-flag" style={{ left: geo.end.x - 9, top: geo.end.y - 40 }}>
        <Doodle kind="flag" size={30} />
      </div>
    </div>
  )
}
