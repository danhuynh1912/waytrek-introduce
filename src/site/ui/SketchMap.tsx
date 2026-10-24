// Bản đồ vẽ tay cho khối "Nỗi lo trên núi": đường đồng mức quanh một đỉnh, lối
// mòn chẻ đôi ở một ngã ba không biển báo, vạch sóng tắt từ chân núi. Toàn bộ
// là nét — cùng chất liệu với các nét vẽ tay rải quanh trang.

import { Doodle } from './Doodle'

/** Vòng kín mềm quanh (cx, cy): bán kính lượn theo vài sóng sin cố định, nối Catmull-Rom → Bézier. */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, n = 10): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const k = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.3)
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const
  })
  const p = (i: number) => pts[(i + n) % n]
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1), [x1, y1] = p(i), [x2, y2] = p(i + 1), [x3, y3] = p(i + 2)
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6]
    const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  return `${d}Z`
}

const PEAK = { x: 340, y: 132 }
const FORK = { x: 214, y: 268 }

const CONTOURS = [
  blob(PEAK.x, PEAK.y + 6, 34, 24, 0.4),
  blob(PEAK.x - 6, PEAK.y + 14, 72, 52, 1.7),
  blob(PEAK.x - 14, PEAK.y + 26, 116, 84, 2.9),
  blob(PEAK.x - 26, PEAK.y + 40, 164, 120, 4.1),
  blob(PEAK.x - 38, PEAK.y + 56, 214, 158, 5.6),
]

export function SketchMap() {
  return (
    <svg className="st-sketch" viewBox="0 0 520 420" role="img" aria-label="Bản đồ vẽ tay: lối mòn chẻ đôi ở một ngã ba, mất sóng từ chân núi">
      <g className="st-sketch-contours">
        {CONTOURS.map((d, i) => (
          <path key={i} d={d} pathLength={1} style={{ transitionDelay: `${(CONTOURS.length - i) * 70}ms` }} />
        ))}
      </g>
      {/* Lối đúng lên đỉnh, và nhánh rẽ nhầm đi mất vào rừng. */}
      <path className="st-sketch-trail" d={`M40 404 C96 372 150 330 ${FORK.x} ${FORK.y} C250 236 286 210 300 186 C312 166 326 150 ${PEAK.x - 4} ${PEAK.y + 6}`} />
      <path className="st-sketch-trail is-wrong" d={`M${FORK.x} ${FORK.y} C262 286 318 300 372 304 C420 308 452 322 500 340`} />
      <g transform={`translate(${PEAK.x - 6} ${PEAK.y - 40})`}>
        <Doodle kind="flag" size={26} className="st-sketch-accent" />
      </g>
      <circle className="st-sketch-fork" cx={FORK.x} cy={FORK.y} r={17} />
      <text className="st-sketch-q" x={FORK.x} y={FORK.y + 8} textAnchor="middle">?</text>
      <text className="st-sketch-label" x={58} y={236}>rẽ lối nào đây?</text>
      <path className="st-sketch-pointer" d={`M150 244 C176 248 190 254 ${FORK.x - 20} ${FORK.y - 6}`} />
      <g transform="translate(34 46)">
        <Doodle kind="signalOff" size={40} />
      </g>
      <text className="st-sketch-label" x={84} y={74}>mất sóng từ đây</text>
      <g transform="translate(404 356)"><Doodle kind="pine" size={22} /></g>
      <g transform="translate(436 372)"><Doodle kind="pine" size={18} /></g>
      <g transform="translate(96 150)"><Doodle kind="pine" size={20} /></g>
      <g transform="translate(70 380)"><Doodle kind="tent" size={34} /></g>
    </svg>
  )
}
