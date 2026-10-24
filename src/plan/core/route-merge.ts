// Gộp các lộ trình chồng nhau thành MỘT nét để vẽ — chủ sản phẩm 24/10: một
// lối mòn có chục người ghi thì bản đồ hiện chục nét song song lệch nhau vài
// chục mét, đọc thành chục con đường.
//
// Cách làm dựa trên bản đồ nhiệt: mỗi điểm (đã chèn dày ~STEP_M) được đếm số
// lộ trình KHÁC NHAU đi qua trong bán kính MERGE_M. Lộ trình nằm giữa hành lang
// nóng nhất được vẽ trước và làm đại diện; lộ trình sau chỉ góp phần CHƯA ai
// phủ (nhánh rẽ, đoạn lên đỉnh khác). Mỗi nét mang `heat` = số lộ trình chung
// hành lang, để nét đông người đi đậm hơn.
//
// Chỉ để VẼ. Máy chủ vẫn tính trên từng lộ trình gốc; mỗi nét giữ `routeId` của
// lộ trình nó lấy hình học, nên chấm điểm lên nét vẫn rơi đúng lộ trình đó.

import type { RouteLine } from './types'

/** Hai lộ trình cách nhau dưới mức này là cùng một lối. GPS dưới tán rừng lệch 30–50 m (đo 19 lộ trình Tà Chì Nhù 24/10: 30 m còn 61 mẩu rời, 50 m còn 47). */
export const MERGE_M = 50
/** Khoảng chèn điểm dọc lộ trình khi dựng bản đồ nhiệt. */
const STEP_M = 10
/** Mẩu chưa phủ ngắn hơn mức này là rìa lệch GPS, bỏ. */
export const MIN_RUN_M = 80

export interface MergedLine {
  routeId: string
  trailId: string
  trailName: string
  /** Số lộ trình đi chung hành lang này (trung vị dọc nét), ≥ 1. */
  heat: number
  /** [[lon, lat], …] độ thập phân. */
  coords: [number, number][]
}

interface Pt {
  lon: number
  lat: number
  /** Toạ độ phẳng (mét) quanh vĩ độ gốc, để băm lưới. */
  x: number
  y: number
}

const M_PER_DEG = 111_195

export function mergeRoutes(routes: RouteLine[]): MergedLine[] {
  if (routes.length === 0) return []
  const lat0 = mid(routes)
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)
  const toPt = (lon: number, lat: number): Pt => ({ lon, lat, x: lon * kx, y: lat * M_PER_DEG })

  // Điểm chèn dày của từng đoạn của từng lộ trình.
  const dense = routes.map((r) =>
    r.segments
      .filter((s) => s.length >= 2)
      .map((s) => densify(s.map(([lon, lat]) => toPt(lon / 1e6, lat / 1e6)))),
  )

  // Bản đồ nhiệt: ô lưới cạnh MERGE_M → tập lộ trình có điểm trong ô.
  const heatGrid = new Map<string, Set<number>>()
  dense.forEach((segs, ri) => {
    for (const seg of segs) for (const p of seg) cellOf(heatGrid, p).add(ri)
  })
  const heatAt = (p: Pt): number => {
    const seen = new Set<number>()
    forNear(p, (k) => {
      const s = heatGrid.get(k)
      if (s) for (const ri of s) seen.add(ri)
    })
    return seen.size
  }
  const heat = dense.map((segs) => segs.map((seg) => seg.map(heatAt)))

  // Lộ trình nóng nhất (trung bình nhiệt dọc tuyến) vẽ trước; hoà thì dài hơn.
  const order = routes
    .map((_, ri) => ({ ri, h: mean(heat[ri].flat()), n: heat[ri].flat().length }))
    .sort((a, b) => b.h - a.h || b.n - a.n || routes[a.ri].routeId.localeCompare(routes[b.ri].routeId))

  const drawn = new Map<string, Pt[]>()
  /** Điểm đã vẽ gần `p` nhất trong bán kính MERGE_M, kèm bình phương khoảng cách. */
  const nearestDrawn = (p: Pt): { q: Pt; d2: number } | null => {
    let best: { q: Pt; d2: number } | null = null
    forNear(p, (k) => {
      for (const q of drawn.get(k) ?? []) {
        const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
        if (d2 <= MERGE_M * MERGE_M && (best == null || d2 < best.d2)) best = { q, d2 }
      }
    })
    return best
  }
  /**
   * Đầu nhánh nối VÀO nét đã vẽ: lùi qua các điểm đã phủ chừng nào còn tiến
   * lại gần nét đó, rồi chốt bằng chính điểm gần nhất trên nét. Chỉ lấy một
   * điểm đã phủ là nhánh dừng ở mép vùng gộp, hở vài chục mét trước ngã ba
   * (Tà Chì Nhù, "Ngã ba - rẽ trái lên lán 2900", 24/10).
   */
  const reachBack = (seg: Pt[], from: number, step: 1 | -1): { idx: number; join: Pt | null } => {
    let idx = from
    let hit = nearestDrawn(seg[idx])
    if (!hit) return { idx, join: null }
    while (idx + step >= 0 && idx + step < seg.length) {
      const next = nearestDrawn(seg[idx + step])
      if (!next || next.d2 >= hit.d2) break
      idx += step
      hit = next
    }
    return { idx, join: hit.d2 > 1 ? hit.q : null }
  }

  const out: MergedLine[] = []
  for (const { ri } of order) {
    const r = routes[ri]
    const runs: { pts: Pt[]; heats: number[] }[] = []
    dense[ri].forEach((seg, si) => {
      const free = seg.map((p) => nearestDrawn(p) == null)
      let i = 0
      while (i < seg.length) {
        if (!free[i]) {
          i++
          continue
        }
        let j = i
        while (j + 1 < seg.length && free[j + 1]) j++
        const head = i > 0 ? reachBack(seg, i - 1, -1) : { idx: 0, join: null }
        const tail = j < seg.length - 1 ? reachBack(seg, j + 1, 1) : { idx: seg.length - 1, join: null }
        const a = head.idx
        const b = tail.idx
        const freePart = seg.slice(i, j + 1)
        if (lengthM(freePart) >= MIN_RUN_M || (i === 0 && j === seg.length - 1)) {
          const hs = heat[ri][si].slice(a, b + 1)
          const pts = seg.slice(a, b + 1)
          if (head.join) {
            pts.unshift(head.join)
            hs.unshift(hs[0])
          }
          if (tail.join) {
            pts.push(tail.join)
            hs.push(hs[hs.length - 1])
          }
          runs.push({ pts, heats: hs })
        }
        i = j + 1
      }
    })
    // Đánh dấu phủ SAU khi cắt xong cả lộ trình: một lộ trình không tự che mình
    // (đường vòng đi về cùng lối vẫn là một nét của chính nó).
    for (const run of runs) {
      for (const p of run.pts) {
        const k = key(p)
        const list = drawn.get(k)
        if (list) list.push(p)
        else drawn.set(k, [p])
      }
      out.push({
        routeId: r.routeId,
        trailId: r.trailId,
        trailName: r.trailName,
        heat: Math.max(1, median(run.heats)),
        coords: run.pts.map((p) => [p.lon, p.lat]),
      })
    }
  }
  return out
}

function key(p: Pt): string {
  return `${Math.floor(p.x / MERGE_M)}:${Math.floor(p.y / MERGE_M)}`
}

function cellOf(grid: Map<string, Set<number>>, p: Pt): Set<number> {
  const k = key(p)
  let s = grid.get(k)
  if (!s) grid.set(k, (s = new Set()))
  return s
}

/** Gọi `fn` với khoá của ô chứa `p` và tám ô quanh nó. */
function forNear(p: Pt, fn: (k: string) => void): void {
  const cx = Math.floor(p.x / MERGE_M)
  const cy = Math.floor(p.y / MERGE_M)
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) fn(`${cx + dx}:${cy + dy}`)
}

function densify(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.floor(d / STEP_M)
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1)
      out.push({ lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
    out.push(b)
  }
  return out
}

function lengthM(pts: Pt[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return s
}

function mid(routes: RouteLine[]): number {
  for (const r of routes) for (const s of r.segments) if (s.length) return s[0][1] / 1e6
  return 0
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function median(xs: number[]): number {
  if (!xs.length) return 1
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
