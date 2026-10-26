// Bấm gần một lộ trình (≤ 12 px — spec/43 §3.2) thì điểm rơi đúng lên lộ
// trình. Tính trên toạ độ MÀN HÌNH: ngưỡng là chuyện ngón tay / con chuột,
// không phải chuyện mét.

export interface ScreenPoint {
  x: number
  y: number
}

export interface SnapHit {
  /** Chỉ số đường trong danh sách đầu vào. */
  line: number
  /** Cạnh [i, i+1] của đường đó và vị trí t ∈ [0,1] trên cạnh. */
  edge: number
  t: number
  distPx: number
}

export const SNAP_PX = 12

export function nearestOnLines(
  p: ScreenPoint,
  lines: readonly (readonly ScreenPoint[])[],
  maxPx = SNAP_PX,
): SnapHit | null {
  let best: SnapHit | null = null
  lines.forEach((pts, li) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
      const d = Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y)
      if (d <= maxPx && (best == null || d < best.distPx)) best = { line: li, edge: i, t, distPx: d }
    }
  })
  return best
}

/**
 * Bấm bản đồ trúng cả đỉnh lẫn POI: ĐỈNH thắng (chủ sản phẩm 26/10 — chùa Đồng
 * nằm sát đỉnh Yên Tử, bấm vào đỉnh mà ra chùa). Cùng loại thì cái gần chỗ bấm
 * nhất. Mỗi phần tử là [thứ trúng, khoảng cách tới chỗ bấm (px)].
 */
export function pickTapHit<P, Q>(
  peaks: readonly (readonly [P, number])[],
  pois: readonly (readonly [Q, number])[],
): { peak: P; poi: null } | { peak: null; poi: Q } | null {
  const nearest = <T>(hits: readonly (readonly [T, number])[]) =>
    hits.reduce<readonly [T, number] | null>((best, h) => (best == null || h[1] < best[1] ? h : best), null)
  const p = nearest(peaks)
  if (p) return { peak: p[0], poi: null }
  const q = nearest(pois)
  if (q) return { peak: null, poi: q[0] }
  return null
}
