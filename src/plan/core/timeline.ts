// Ghép kế hoạch ĐANG SỬA với kết quả của lần tính gần nhất.
//
// Kết quả luôn đi sau doc vài trăm mili giây (spec/43 §3.3), và có thể không về
// (mất mạng). Nên panel và bản đồ dựng từ doc hiện tại, rồi mượn phần kết quả
// còn đúng: một đoạn giữa hai điểm liên tiếp được dùng lại khi hai điểm đó và
// cách đi tới vẫn y như lúc tính. Đoạn đã đổi thì là "đang tính" — vẽ đường
// thẳng mờ, không bịa giờ.

import type { PlanDoc, PlanResult, ResultDay, ResultLeg, ResultStop, Waypoint, DrawPiece } from './types.ts'

export interface Segment {
  /** Lán tự chèn nằm giữa hai điểm, theo thứ tự đi. */
  autos: ResultStop[]
  /** autos.length + 1 chặng. */
  legs: ResultLeg[]
}

export function segmentKey(a: Waypoint, b: Waypoint): string {
  return `${a.id}@${a.latE6},${a.lonE6}>${b.id}@${b.latE6},${b.lonE6}/${b.transport}`
}

/** Cắt kết quả thành từng đoạn giữa hai điểm liên tiếp của doc đã sinh ra nó. */
export function resultSegments(resultDoc: PlanDoc, result: PlanResult): Map<string, Segment> {
  const out = new Map<string, Segment>()
  const anchors: number[] = []
  result.stops.forEach((s, i) => {
    if (s.waypointIndex >= 0) anchors.push(i)
  })
  const wps = resultDoc.waypoints
  // Kết quả không khớp doc (khác số điểm / khác id) thì không mượn gì cả.
  if (anchors.length !== wps.length) return out
  if (anchors.some((si, k) => result.stops[si].id !== wps[k].id)) return out
  if (result.legs.length !== Math.max(0, result.stops.length - 1)) return out
  for (let k = 0; k + 1 < anchors.length; k++) {
    const p = anchors[k]
    const q = anchors[k + 1]
    out.set(segmentKey(wps[k], wps[k + 1]), {
      autos: result.stops.slice(p + 1, q),
      legs: result.legs.slice(p, q),
    })
  }
  return out
}

export type Row =
  | { type: 'day'; day: ResultDay }
  /** Đầu mỗi ngày từ ngày thứ hai: chỗ ngủ đêm trước, kèm giờ xuất phát của ngày. */
  | { type: 'dayStart'; day: ResultDay }
  | {
    type: 'stop'
    wp: Waypoint
    index: number
    /** Số liệu của điểm trong lần tính gần nhất (null: điểm mới, chưa tính). */
    info: ResultStop | null
  }
  | { type: 'auto'; stop: ResultStop; afterWaypointId: string }
  | {
    type: 'leg'
    leg: ResultLeg | null
    /** Điểm cuối đoạn — nơi giữ ô "đi bộ / đi xe" của đoạn. Chỉ có ở chặng đầu của đoạn. */
    toggleFor: Waypoint | null
    /** Mọi chặng của đoạn (chỉ có ở chặng đầu, cùng `toggleFor`) — để quyết có hiện nút đi bộ / đi xe. */
    pairLegs?: ResultLeg[]
  }

export interface Timeline {
  rows: Row[]
  /** Có đoạn nào đang chờ tính. */
  pending: boolean
}

export function buildTimeline(
  doc: PlanDoc,
  result: PlanResult | null,
  resultDoc: PlanDoc | null,
): Timeline {
  const segs = result && resultDoc ? resultSegments(resultDoc, result) : new Map<string, Segment>()
  const info = new Map<string, ResultStop>()
  for (const s of result?.stops ?? []) if (s.waypointIndex >= 0) info.set(s.id, s)
  const days = result?.days ?? []
  const dayAfter = new Map<string, ResultDay>()
  days.forEach((d, k) => {
    if (k + 1 < days.length) dayAfter.set(d.endStopId, days[k + 1])
  })

  const rows: Row[] = []
  let pending = false
  const wps = doc.waypoints
  const firstInfo = wps[0] ? info.get(wps[0].id) : undefined
  if (days.length > 0 && firstInfo) rows.push({ type: 'day', day: days[0] })
  const pushDayAfter = (stopId: string) => {
    const next = dayAfter.get(stopId)
    if (next) rows.push({ type: 'day', day: next }, { type: 'dayStart', day: next })
  }

  for (let i = 0; i < wps.length; i++) {
    const wp = wps[i]
    rows.push({ type: 'stop', wp, index: i, info: info.get(wp.id) ?? null })
    if (i + 1 >= wps.length) break
    // Điểm cuối kế hoạch không mở ngày mới; điểm giữa thì có thể.
    pushDayAfter(wp.id)
    const seg = segs.get(segmentKey(wp, wps[i + 1]))
    if (!seg) {
      pending = true
      rows.push({ type: 'leg', leg: null, toggleFor: wps[i + 1] })
      continue
    }
    seg.legs.forEach((leg, j) => {
      rows.push({
        type: 'leg',
        leg,
        toggleFor: j === 0 ? wps[i + 1] : null,
        ...(j === 0 ? { pairLegs: seg.legs } : {}),
      })
      const auto = seg.autos[j]
      if (auto) {
        rows.push({ type: 'auto', stop: auto, afterWaypointId: wp.id })
        pushDayAfter(auto.id)
      }
    })
  }
  return { rows, pending }
}

export type DrawKind = DrawPiece['kind'] | 'pending'

export interface DrawLine {
  kind: DrawKind
  /** Polyline mã hoá (kind khác 'pending'), hoặc hai đầu mút [lon, lat]. */
  encoded: string | null
  ends: [[number, number], [number, number]] | null
  /** Đoạn xe ôm theo lộ trình WayTrek — bản đồ ghi nhãn "Xe ôm". */
  moto?: true
}

/** Nét vẽ trên bản đồ theo cùng luật mượn đoạn với panel. */
export function drawLines(
  doc: PlanDoc,
  result: PlanResult | null,
  resultDoc: PlanDoc | null,
): { lines: DrawLine[]; autos: { stop: ResultStop; afterWaypointId: string }[] } {
  const segs = result && resultDoc ? resultSegments(resultDoc, result) : new Map<string, Segment>()
  const lines: DrawLine[] = []
  const autos: { stop: ResultStop; afterWaypointId: string }[] = []
  const wps = doc.waypoints
  for (let i = 0; i + 1 < wps.length; i++) {
    const a = wps[i]
    const b = wps[i + 1]
    const seg = segs.get(segmentKey(a, b))
    if (!seg) {
      lines.push({
        kind: 'pending',
        encoded: null,
        ends: [[a.lonE6 / 1e6, a.latE6 / 1e6], [b.lonE6 / 1e6, b.latE6 / 1e6]],
      })
      continue
    }
    for (const leg of seg.legs) {
      for (const piece of leg.draw) {
        lines.push({ kind: piece.kind, encoded: piece.line, ends: null, ...(piece.moto ? { moto: true as const } : {}) })
      }
    }
    for (const stop of seg.autos) autos.push({ stop, afterWaypointId: a.id })
  }
  return { lines, autos }
}

/**
 * Có hiện nút "Đi bộ / Đi xe" cho đoạn giữa hai điểm không (chủ sản phẩm 24/10):
 * ẩn khi cả đoạn là đi bộ trên lộ trình WayTrek đã biết (leo lên lán, lên đỉnh)
 * — trên lối mòn không có xe. Đoạn xe dài thì VẪN hiện: đi bộ hàng trăm km xuyên
 * tuyến là chuyện có thật. Người dùng tự chọn đi xe thì hiện để còn đổi lại.
 */
export function transportChoiceShown(transport: Waypoint['transport'], legs: readonly ResultLeg[] | null): boolean {
  if (transport === 'vehicle' || !legs || legs.length === 0) return true
  return !legs.every((l) => l.transport === 'walk' && l.knownPct >= 90)
}
