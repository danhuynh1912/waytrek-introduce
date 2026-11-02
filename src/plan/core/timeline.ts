// Ghép kế hoạch ĐANG SỬA với kết quả của lần tính gần nhất.
//
// Kết quả luôn đi sau doc vài trăm mili giây (spec/43 §3.3), và có thể không về
// (mất mạng). Nên panel và bản đồ dựng từ doc hiện tại, rồi mượn phần kết quả
// còn đúng: một đoạn giữa hai điểm liên tiếp được dùng lại khi hai điểm đó và
// cách đi tới vẫn y như lúc tính. Đoạn đã đổi thì là "đang tính" — vẽ đường
// thẳng mờ, không bịa giờ.

import type { PlanDoc, PlanResult, ResultDay, ResultLeg, ResultStop, Waypoint, DrawPiece } from './types.ts'
import { lateSummitNote, legNotes } from './warnings.ts'
import type { Note } from './warnings.ts'

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
    /** Chặng nối tới / từ một chỗ nghỉ đang ẩn (`withoutRestSuggestions`): không vẽ đường dọc — nó không nối tới điểm nào. */
    detached?: boolean
  }

export interface Timeline {
  rows: Row[]
  /** Có đoạn nào đang chờ tính. */
  pending: boolean
}

/**
 * Chỗ nghỉ máy chủ tự gợi ý — lán tự chọn, vùng nên nghỉ. Nút "Ẩn gợi ý chỗ
 * nghỉ" (chủ sản phẩm 26/10) ẩn chúng trên bản đồ lẫn dòng thời gian. Điểm máy
 * chủ chèn chỉ để cho biết giờ (bắt đầu leo, lên xe) không phải chỗ nghỉ; chỗ ngủ
 * sau chuyến xe tối hôm trước là hệ quả của ô người dùng tự bật — cả hai luôn hiện.
 */
export function isRestSuggestion(stop: ResultStop): boolean {
  return stop.inserted && stop.rest && !stop.transfer
}

/**
 * Dòng thời gian khi tắt gợi ý chỗ nghỉ: bỏ dòng của chính chỗ nghỉ và dòng
 * "Xuất phát" từ chỗ đó ở đầu ngày sau. Tiêu đề ngày, chặng và mọi điểm người
 * dùng chọn giữ nguyên — đêm vẫn chia đúng chỗ, chỉ không nói ngủ ở đâu. Chặng
 * đi tới / đi từ chỗ đã ẩn giữ số liệu nhưng thôi vẽ đường dọc (`detached`).
 */
export function withoutRestSuggestions(rows: Row[]): Row[] {
  const hidden = new Set(rows.flatMap((r) => (r.type === 'auto' && isRestSuggestion(r.stop) ? [r.stop.id] : [])))
  if (hidden.size === 0) return rows
  return rows.flatMap((r): Row[] => {
    if (r.type === 'auto' && hidden.has(r.stop.id)) return []
    if (r.type === 'dayStart' && hidden.has(r.day.startStopId)) return []
    if (r.type === 'leg' && r.leg && (hidden.has(r.leg.from) || hidden.has(r.leg.to))) return [{ ...r, detached: true }]
    return [r]
  })
}

export interface FoldedTimeline {
  /** Dòng còn hiện sau khi thu các đoạn đang gập. */
  rows: Row[]
  /** Điểm có đoạn sau nó (theo id) → tên điểm cuối đoạn — nhãn của mũi tên thu / mở. */
  segments: Map<string, string>
}

/**
 * Đoạn giữa hai điểm liên tiếp — chép luật của app (`plan_timeline_view.dart`,
 * chủ sản phẩm 28/10; web 2/11): mọi chặng / điểm máy chèn sau một điểm, tới
 * điểm kế tiếp. Đoạn GẬP sẵn; mũi tên ở điểm đầu đoạn mở nó (`expanded`). Tiêu
 * đề ngày và dòng "Xuất phát" nằm giữa đoạn vẫn hiện: chúng chia ngày, không
 * phải chi tiết của đoạn.
 */
export function foldSegments(rows: Row[], expanded: ReadonlySet<string>): FoldedTimeline {
  const segments = new Map<string, string>()
  const owners = new Set<string>()
  const segOf: (string | null)[] = []
  let owner: string | null = null
  for (const r of rows) {
    let seg: string | null = null
    if (r.type === 'stop') {
      if (owner != null && owners.has(owner)) segments.set(owner, r.wp.name)
      owner = r.wp.id
    } else if ((r.type === 'leg' || r.type === 'auto') && owner != null) {
      seg = owner
      owners.add(owner)
    }
    segOf.push(seg)
  }
  const shown = rows.filter((_, i) => {
    const seg = segOf[i]
    return seg == null || expanded.has(seg)
  })
  return { rows: shown, segments }
}

/**
 * Cảnh báo, lưu ý của từng điểm và từng chặng, gom về ngày chứa chúng (khoá:
 * `ResultDay.index`). Dòng thời gian không mang chữ cảnh báo nữa — mọi thứ vào
 * khối gập của ngày (chủ sản phẩm 2/11), kèm tên chỗ nó nói tới.
 */
export function rowNotesByDay(rows: Row[]): Map<number, Note[]> {
  const names = new Map<string, string>()
  for (const r of rows) {
    if (r.type === 'stop') names.set(r.wp.id, r.wp.name)
    else if (r.type === 'auto') names.set(r.stop.id, r.stop.name)
  }
  const out = new Map<number, Note[]>()
  let day: number | null = null
  const add = (notes: Note[]) => {
    if (day != null && notes.length > 0) out.set(day, [...(out.get(day) ?? []), ...notes])
  }
  for (const r of rows) {
    if (r.type === 'day') day = r.day.index
    else if (r.type === 'stop' && r.info) {
      const late = lateSummitNote(r.info, r.wp.name)
      if (late) add([late])
    } else if (r.type === 'leg' && r.leg) {
      add(legNotes(r.leg, `${names.get(r.leg.from) ?? 'Điểm'} → ${names.get(r.leg.to) ?? 'Điểm'}`))
    }
  }
  return out
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
