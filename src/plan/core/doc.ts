// Mọi thao tác sửa một kế hoạch. Thuần: nhận doc cũ, trả doc mới, không đụng
// tới bản cũ (hoàn tác giữ nguyên các bản trước).

import type { ArriveAt, AutoTime, PlanDoc, PlanResult, RestChoice, ResultStop, Transport, Waypoint, WaypointKind } from './types.ts'

/** Trần và khung toạ độ của máy chủ (`engine/validate.ts`) — chép để chặn
 *  trước khi gửi, thay vì để cả kế hoạch bị trả lỗi 400. */
export const MAX_WAYPOINTS = 40
const LAT_MIN = 6, LAT_MAX = 26, LON_MIN = 100, LON_MAX = 112
export const PACE_MIN = 0.4
export const PACE_MAX = 1.5
export const PACE_DEFAULT = 0.75
/** Nút nhanh "Đoàn đi chậm" (spec/43 §8). */
export const PACE_SLOW_GROUP = 0.6
/** Giờ đi mặc định 06:00 (spec/43 §3.5). */
export const DEPART_DEFAULT = 6 * 60

export function newDoc(startDate: string): PlanDoc {
  return {
    v: 1,
    title: 'Kế hoạch mới',
    startDate,
    departMin: DEPART_DEFAULT,
    autoShift: true,
    pace: PACE_DEFAULT,
    restMinPerHour: 10,
    sunsetMarginMin: 60,
    waypoints: [],
    dismissedRestPoiIds: [],
  }
}

export function inBounds(lat: number, lon: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX
}

export interface WaypointInput {
  id: string
  kind: WaypointKind
  ref?: string
  lat: number
  lon: number
  name: string
  rest?: boolean
  transport?: Transport
}

export function makeWaypoint(w: WaypointInput): Waypoint {
  const out: Waypoint = {
    id: w.id,
    kind: w.kind,
    latE6: Math.round(w.lat * 1e6),
    lonE6: Math.round(w.lon * 1e6),
    name: w.name.trim().slice(0, 120) || 'Điểm',
    rest: w.rest ?? false,
    // Điểm mới để máy chủ tự chọn đi bộ hay đi xe (theo lộ trình và khoảng cách).
    transport: w.transport ?? 'auto',
  }
  if (w.ref) out.ref = w.ref
  return out
}

export type EditResult =
  | { ok: true; doc: PlanDoc }
  | { ok: false; reason: 'full' | 'outside' | 'missing' | 'timesFull' }

function withWaypoints(doc: PlanDoc, waypoints: Waypoint[]): PlanDoc {
  return { ...doc, waypoints }
}

// ─── Ngày người dùng tự xếp (`nightsBefore`) ───────────────────────────────
//
// Hai loại đêm (chủ sản phẩm 26/10). Đêm "Nghỉ đêm ở đây" THUỘC VỀ một điểm:
// đổi chỗ điểm thì đêm đi theo, xoá điểm thì đêm mất theo. Mọi đêm khác thuộc
// về KHOẢNG giữa hai điểm liền nhau: máy tự chọn ngủ ở đâu trong khoảng đó.
// `nightsBefore` lưu TỔNG số đêm của khoảng (gồm đêm của điểm trước) vì máy chủ
// đếm như thế — các thao tác dưới đây tách hai phần, đổi, rồi ghép lại.
// Khoảng chưa xếp (undefined) thì máy tự chia như cũ.

/** Đêm "Nghỉ đêm ở đây" của điểm thứ k — điểm đầu, điểm cuối máy chủ bỏ ô đó. */
function ownNight(list: readonly Waypoint[], k: number): number {
  return k > 0 && k < list.length - 1 && list[k].rest ? 1 : 0
}

/** Số đêm của khoảng k (giữa điểm k−1 và k) không thuộc điểm nào; undefined = máy tự chia. */
function gapNights(list: readonly Waypoint[], k: number): number | undefined {
  const nb = k > 0 ? list[k]?.nightsBefore : undefined
  return nb === undefined ? undefined : Math.max(0, nb - ownNight(list, k - 1))
}

function gapsOf(list: readonly Waypoint[]): (number | undefined)[] {
  return list.map((_, k) => gapNights(list, k))
}

/** Ghép lại `nightsBefore` từ đêm của từng khoảng (theo VỊ TRÍ) và đêm của chính điểm trước. */
function withGaps(list: readonly Waypoint[], gaps: readonly (number | undefined)[]): Waypoint[] {
  return list.map((w, k) => {
    const g = k > 0 ? gaps[k] : undefined
    const nb = g === undefined ? undefined : g + ownNight(list, k - 1)
    if (nb === w.nightsBefore) return w
    const next = { ...w }
    if (nb === undefined) delete next.nightsBefore
    else next.nightsBefore = nb
    return next
  })
}

/** Ngày của điểm k theo các khoảng đã xếp; undefined khi có khoảng trước nó để máy tự chia. */
function dayAt(list: readonly Waypoint[], k: number): number | undefined {
  let d = 0
  for (let j = 1; j <= k; j++) {
    const nb = list[j].nightsBefore
    if (nb === undefined) return undefined
    // Máy chủ giữ đêm "Nghỉ đêm ở đây" kể cả khi số đã xếp ít hơn.
    d += Math.max(nb, ownNight(list, j - 1))
  }
  return d
}

/**
 * Bật / tắt đêm của chính điểm k. Bật mà khoảng sau nó đã xếp đêm máy đặt thì
 * đêm đó dời về đây (thay chỗ, không thêm ngày — "ngủ ở đây thay vì ở lán");
 * tắt thì đêm đó mất hẳn.
 */
function setOwnNight(list: readonly Waypoint[], k: number, on: boolean): Waypoint[] {
  const gaps = gapsOf(list)
  const after = gaps[k + 1]
  if (on && after !== undefined && after > 0) gaps[k + 1] = after - 1
  return withGaps(list.map((w, j) => (j === k ? { ...w, rest: on } : w)), gaps)
}

/** Khoá giờ của điểm máy chèn nằm giữa hai điểm (`trailhead:a>b`, `zone:a>b#2`) có nhắc tới điểm `id`. */
function timeKeyMentions(key: string, id: string): boolean {
  const pair = key.slice(key.indexOf(':') + 1).replace(/#\d+$/, '')
  return pair.startsWith(`${id}>`) || pair.endsWith(`>${id}`)
}

/** Bỏ giờ đặt ở các điểm máy chèn cạnh một điểm vừa bị xoá — cặp điểm đó không còn nữa. */
function pruneTimesOf(doc: PlanDoc, id: string): PlanDoc {
  if (!doc.autoTimes) return doc
  const keys = Object.keys(doc.autoTimes).filter((k) => !timeKeyMentions(k, id))
  if (keys.length === Object.keys(doc.autoTimes).length) return doc
  const next = { ...doc }
  if (keys.length === 0) delete next.autoTimes
  else next.autoTimes = Object.fromEntries(keys.map((k) => [k, doc.autoTimes![k]]))
  return next
}

/** Chọn TƯỜNG MINH một lán (bấm trên bản đồ, [Giữ]) thắng lần "Bỏ" trước đó. */
function undismiss(doc: PlanDoc, wp: Waypoint): PlanDoc {
  if (wp.kind !== 'poi' || !wp.ref || !doc.dismissedRestPoiIds.includes(wp.ref)) return doc
  return { ...doc, dismissedRestPoiIds: doc.dismissedRestPoiIds.filter((id) => id !== wp.ref) }
}

function insertAt(doc: PlanDoc, index: number, wp: Waypoint): EditResult {
  if (doc.waypoints.length >= MAX_WAYPOINTS) return { ok: false, reason: 'full' }
  if (!inBounds(wp.latE6 / 1e6, wp.lonE6 / 1e6)) return { ok: false, reason: 'outside' }
  const list = [...doc.waypoints]
  list.splice(index, 0, wp)
  return { ok: true, doc: undismiss(withWaypoints(doc, list), wp) }
}

/**
 * Chân núi máy chủ chọn cho đỉnh đang đứng đầu: chèn lên TRƯỚC đỉnh, làm điểm
 * xuất phát. Bản làng dưới chân núi — nghỉ đêm được nếu ngày cần cắt.
 */
export function prependStart(
  doc: PlanDoc,
  id: string,
  t: { latE6: number; lonE6: number; name: string; trailId?: string },
): EditResult {
  const wp = makeWaypoint({
    id,
    kind: 'route',
    ref: t.trailId,
    lat: t.latE6 / 1e6,
    lon: t.lonE6 / 1e6,
    name: t.name,
  })
  return insertAt(doc, 0, { ...wp, restOk: true })
}

/** Điểm mới nối vào CUỐI (thứ tự đi — spec/43 §3.2). */
export function appendWaypoint(doc: PlanDoc, wp: Waypoint): EditResult {
  return insertAt(doc, doc.waypoints.length, wp)
}

/**
 * Xoá một điểm. Khoảng đã xếp ngày hai bên nó gộp làm một, giữ đủ số đêm máy
 * đặt; đêm "Nghỉ đêm ở đây" của chính nó mất theo nó.
 */
export function removeWaypoint(doc: PlanDoc, id: string): PlanDoc {
  const old = doc.waypoints
  const p = old.findIndex((w) => w.id === id)
  if (p < 0) return doc
  const gaps = gapsOf(old)
  const a = gaps[p]
  const b = gaps[p + 1]
  const list = old.filter((_, k) => k !== p)
  const next = gaps.filter((_, k) => k !== p)
  if (p < list.length) next[p] = p > 0 && a !== undefined && b !== undefined ? a + b : undefined
  return pruneTimesOf(withWaypoints(doc, withGaps(list, next)), id)
}

/**
 * Đổi chỗ với điểm ngay trước / sau. Ngày đã xếp đứng yên theo VỊ TRÍ: hai dòng
 * đổi chỗ cho nhau, tiêu đề ngày giữ nguyên chỗ (điểm "Nghỉ đêm ở đây" rơi vào
 * giữa một ngày thì máy chủ vẫn cho ngủ ở đó, điểm sau nó sang ngày kế).
 */
export function moveWaypoint(doc: PlanDoc, id: string, delta: -1 | 1): PlanDoc {
  const i = doc.waypoints.findIndex((w) => w.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= doc.waypoints.length) return doc
  const list = [...doc.waypoints]
  ;[list[i], list[j]] = [list[j], list[i]]
  return withWaypoints(doc, withNightsAt(list, doc.waypoints.map((w) => w.nightsBefore)))
}

/** Gắn `nightsBefore` theo vị trí (điểm đầu không bao giờ có). */
function withNightsAt(list: readonly Waypoint[], nights: readonly (number | undefined)[]): Waypoint[] {
  return list.map((w, k) => {
    const nb = k > 0 ? nights[k] : undefined
    if (nb === w.nightsBefore) return w
    const next = { ...w }
    if (nb === undefined) delete next.nightsBefore
    else next.nightsBefore = nb
    return next
  })
}

/** Chỗ thả khi kéo một điểm trên dòng thời gian (`days.ts`). */
export interface DaySlot {
  /** Chèn trước điểm thứ `index` của doc.waypoints (= số điểm đứng trước chỗ thả). */
  index: number
  /** Ngày của chỗ thả (`ResultDay.index`). */
  day: number
}

/**
 * Kéo điểm `id` tới chỗ thả `slot` — có thể sang ngày khác (chủ sản phẩm 26/10).
 * Từ lúc này người dùng tự xếp ngày: điểm kéo nằm ĐÚNG ngày của chỗ thả, mọi
 * điểm khác giữ đúng ngày đang thấy (`dayOf`, theo dòng thời gian); máy chủ vẫn
 * tự chọn ngủ ở đâu giữa hai ngày. Điểm kéo có "Nghỉ đêm ở đây" thì đêm đó vẫn
 * ở nó — điểm đứng sau nó trong cùng ngày sang ngày kế. Thả đúng chỗ cũ: trả
 * lại chính `doc` (không lặng lẽ chốt ngày cho cả kế hoạch).
 */
export function moveToDay(doc: PlanDoc, dayOf: ReadonlyMap<string, number>, id: string, slot: DaySlot): PlanDoc {
  const old = doc.waypoints
  const n = old.length
  const p = old.findIndex((w) => w.id === id)
  if (p < 0 || n < 2 || slot.index < 0 || slot.index > n) return doc
  // Ngày đang thấy, kẹp cho đơn điệu (dòng thời gian luôn vậy).
  const days: number[] = []
  old.forEach((w, k) => {
    const prev = k > 0 ? days[k - 1] : 0
    days.push(Math.max(prev, dayOf.get(w.id) ?? prev))
  })
  const s = slot.index > p ? slot.index - 1 : slot.index
  const rest = old.filter((_, k) => k !== p)
  const restDays = days.filter((_, k) => k !== p)
  const out = [...rest.slice(0, s), old[p], ...rest.slice(s)]
  const outDays = [...restDays.slice(0, s), s === 0 ? 0 : slot.day, ...restDays.slice(s)]
  for (let k = 1; k < outDays.length; k++) outDays[k] = Math.max(outDays[k], outDays[k - 1])
  if (out.every((w, k) => w === old[k]) && outDays.every((d, k) => d === days[k])) return doc
  return withWaypoints(doc, withNightsAt(out, outDays.map((d, k) => (k === 0 ? undefined : d - outDays[k - 1]))))
}

/**
 * "Dời sang ngày sau" của hộp hỏi giờ có mặt muộn (chủ sản phẩm 26/10): ngủ
 * trước điểm `id` một đêm (máy chủ chọn ngủ ở đâu), điểm đó tới vào ngày hôm
 * sau — và bỏ giờ có mặt muộn vừa đặt, vì giữ nó thì hôm sau vẫn tới muộn y vậy.
 */
export function pushToNextDay(doc: PlanDoc, dayOf: ReadonlyMap<string, number>, id: string): PlanDoc {
  const p = doc.waypoints.findIndex((w) => w.id === id)
  if (p < 0) return doc
  const moved = moveToDay(doc, dayOf, id, { index: p, day: (dayOf.get(id) ?? 0) + 1 })
  return setArriveAt(moved, id, null)
}

/**
 * Cùng việc đó cho một điểm MÁY chèn (điểm bắt đầu leo…): thêm một đêm vào
 * khoảng chứa nó — điểm người dùng kế sau nó sang ngày hôm sau — và bỏ giờ có
 * mặt đã đặt ở nó (`key`).
 */
export function pushAutoToNextDay(
  doc: PlanDoc,
  dayOf: ReadonlyMap<string, number>,
  nextWaypointId: string,
  key: string,
  live: ReadonlySet<string>,
): PlanDoc {
  const k = doc.waypoints.findIndex((w) => w.id === nextWaypointId)
  if (k < 0) return doc
  const moved = moveToDay(doc, dayOf, nextWaypointId, { index: k, day: (dayOf.get(nextWaypointId) ?? 0) + 1 })
  const r = setAutoTime(moved, key, { arriveAt: null }, live)
  return r.ok ? r.doc : moved
}

/**
 * Áp thứ tự mới của tab Waypoints (kéo thả, xoá — chủ sản phẩm 26/10): `ids` là
 * các điểm còn giữ, theo thứ tự mới; điểm không có trong `ids` bị xoá. Tab đó
 * không hiện ngày, nên số đêm đã xếp của một khoảng chỉ giữ khi khoảng ấy còn
 * nguyên hai đầu (bỏ điểm giữa thì gộp như khi xoá); khoảng mới để máy tự chia.
 */
export function reorderWaypoints(doc: PlanDoc, ids: readonly string[]): PlanDoc {
  let cur = doc
  for (const w of doc.waypoints) if (!ids.includes(w.id)) cur = removeWaypoint(cur, w.id)
  const byId = new Map(cur.waypoints.map((w) => [w.id, w]))
  const list = ids.flatMap((id) => byId.get(id) ?? [])
  if (list.length !== cur.waypoints.length) return doc
  if (list.every((w, k) => w === cur.waypoints[k])) return cur
  const pair = (a: string, b: string) => `${a}\u0000${b}`
  const known = new Map<string, number>()
  cur.waypoints.forEach((w, k) => {
    const g = gapNights(cur.waypoints, k)
    if (g !== undefined) known.set(pair(cur.waypoints[k - 1].id, w.id), g)
  })
  const gaps = list.map((w, k) => (k === 0 ? undefined : known.get(pair(list[k - 1].id, w.id))))
  return withWaypoints(cur, withGaps(list, gaps))
}

export function updateWaypoint(
  doc: PlanDoc,
  id: string,
  patch: Partial<Pick<Waypoint, 'name' | 'rest' | 'transport'>>,
): PlanDoc {
  const next = { ...patch }
  if (next.name !== undefined) {
    const name = next.name.trim().slice(0, 120)
    if (!name) delete next.name
    else next.name = name
  }
  return withWaypoints(
    doc,
    doc.waypoints.map((w) => (w.id === id ? { ...w, ...next } : w)),
  )
}

/** Chỗ mới của một điểm (kéo trên bản đồ, "Thay thế bằng…"). */
export type PointTarget = { lat: number; lon: number; kind: WaypointKind; ref?: string; name?: string }

/**
 * Kéo một điểm sang chỗ khác: giữ id, ô nghỉ đêm, cách đi tới, mốc giờ. Tên đi
 * theo CHỖ THẢ (chủ sản phẩm 26/10): thả lên một đỉnh / POI (`to.name`) thì mang
 * tên của nó; điểm vốn là đỉnh / POI mà thả ra chỗ khác thì tên đó không còn
 * đúng chỗ — về tên mặc định theo số thứ tự ("Điểm 3"). Điểm tự chấm / trên lộ
 * trình giữ tên: có thể là tên người dùng tự đặt.
 */
export function relocateWaypoint(doc: PlanDoc, id: string, to: PointTarget): EditResult {
  if (!inBounds(to.lat, to.lon)) return { ok: false, reason: 'outside' }
  const old = doc.waypoints.find((w) => w.id === id)
  if (!old) return { ok: false, reason: 'missing' }
  const featureKind = (k: WaypointKind) => k === 'peak' || k === 'poi'
  const name = to.name?.trim()
    ? to.name
    : featureKind(old.kind) && !featureKind(to.kind) ? pointNameAt(doc, id) : old.name
  const moved = makeWaypoint({ ...old, ...to, name, lat: to.lat, lon: to.lon })
  if (!to.ref) delete moved.ref
  if (old.restOk) moved.restOk = true
  if (old.arriveAt !== undefined) moved.arriveAt = old.arriveAt
  if (old.departAt !== undefined) moved.departAt = old.departAt
  if (old.nightsBefore !== undefined) moved.nightsBefore = old.nightsBefore
  return {
    ok: true,
    doc: withWaypoints(doc, doc.waypoints.map((w) => (w.id === id ? moved : w))),
  }
}

/**
 * Áp bản đang soạn của tab Waypoints trong MỘT bước sửa (hoàn tác một lần):
 * thay các điểm đã chọn "Thay thế bằng…" rồi xếp theo `ids` (chủ sản phẩm 26/10
 * — thay thế cũng chờ bấm Áp dụng, như kéo đổi thứ tự và xoá).
 */
export function applyPointsDraft(
  doc: PlanDoc,
  ids: readonly string[],
  swaps: ReadonlyMap<string, PointTarget>,
): EditResult {
  let next = doc
  for (const [id, to] of swaps) {
    const r = relocateWaypoint(next, id, to)
    if (!r.ok) return r
    next = r.doc
  }
  return { ok: true, doc: reorderWaypoints(next, ids) }
}

/** Tên điểm khi giữ một vùng nên nghỉ làm chỗ cắm trại. */
export const CAMP_NAME = 'Chỗ cắm trại'

/**
 * [Giữ] một lán tự chèn: nó thành điểm thật của kế hoạch, tick nghỉ đêm sẵn
 * (spec/43 §3.4). Vùng nên nghỉ thì thành một điểm tự chấm "Chỗ cắm trại" ở
 * đúng điểm nghỉ của vùng. `afterWaypointId` là điểm đứng ngay trước nó — tính
 * theo kế hoạch ĐÃ SINH ra kết quả, vì doc có thể đã đổi từ lúc đó.
 */
/**
 * Chèn một điểm nghỉ vào giữa chặng tới điểm thứ `i`: chặng đó bị chia đôi.
 * Nửa đầu mang cách đi của chặng cũ (từ Hà Nội thì vẫn đi xe — gắn cứng "đi
 * bộ" là bắt đi bộ cả trăm km); nửa sau chặng cũ ép đi xe thì trả về "tự
 * chọn", vì từ lán đi tiếp gần như luôn là đi bộ.
 */
function insertRestPoint(doc: PlanDoc, i: number, wp: Waypoint, night: { day: number; consumed: 0 | 1 }): EditResult {
  const next = doc.waypoints[i]
  const placed = { ...wp, transport: next?.transport ?? 'auto' }
  const base = next?.transport === 'vehicle'
    ? withWaypoints(doc, doc.waypoints.map((x, k) => (k === i ? { ...x, transport: 'auto' as Transport } : x)))
    : doc
  const r = insertAt(base, i, placed)
  // Khoảng đã xếp ngày: chia số đêm máy đặt của khoảng làm hai quanh điểm mới —
  // các đêm trước ngày kết thúc ở điểm mới (`night.day`) nằm trước nó. `consumed`:
  // chính đêm đó vốn là đêm máy đặt (Giữ một lán tự chọn), giờ thành đêm của điểm.
  const total = gapNights(base.waypoints, i)
  if (!r.ok || total === undefined) return r
  const left = Math.max(0, total - night.consumed)
  const from = dayAt(base.waypoints, i - 1)
  const before = from === undefined
    ? 0
    : Math.max(0, Math.min(left, night.day - from - ownNight(base.waypoints, i - 1)))
  const gaps = gapsOf(r.doc.waypoints)
  gaps[i] = before
  gaps[i + 1] = left - before
  return { ok: true, doc: withWaypoints(r.doc, withGaps(r.doc.waypoints, gaps)) }
}

export function keepAutoStop(
  doc: PlanDoc,
  stop: ResultStop,
  afterWaypointId: string,
  newId: string,
): EditResult {
  const i = doc.waypoints.findIndex((w) => w.id === afterWaypointId)
  if (i < 0 || (!stop.poiId && !stop.zone)) return { ok: false, reason: 'missing' }
  const at = { lat: stop.latE6 / 1e6, lon: stop.lonE6 / 1e6, rest: true }
  return insertRestPoint(
    doc,
    i + 1,
    stop.poiId
      ? makeWaypoint({ id: newId, kind: 'poi', ref: stop.poiId, name: stop.name, ...at })
      : makeWaypoint({ id: newId, kind: 'custom', name: CAMP_NAME, ...at }),
    { day: stop.day, consumed: 1 },
  )
}

/** [Bỏ] lán tự chèn: lán đó không tự chèn lại nữa — cảnh báo của ngày quay về. */
export function dismissAutoStop(doc: PlanDoc, poiId: string): PlanDoc {
  if (doc.dismissedRestPoiIds.includes(poiId)) return doc
  return {
    ...doc,
    dismissedRestPoiIds: [...doc.dismissedRestPoiIds, poiId].sort(),
  }
}

/** Mốc giờ ở một điểm (lên đỉnh đón bình minh…); null = bỏ mốc. */
export function setArriveAt(doc: PlanDoc, id: string, at: ArriveAt | null): PlanDoc {
  if (at !== null && at !== 'sunrise' && !(Number.isInteger(at) && at >= 0 && at < 24 * 60)) return doc
  return withWaypoints(
    doc,
    doc.waypoints.map((w) => {
      if (w.id !== id) return w
      const next = { ...w }
      if (at === null) delete next.arriveAt
      else next.arriveAt = at
      return next
    }),
  )
}

/**
 * Engine đầu tiên hiểu giờ xuất phát ở điểm giữa (`departAt`). Bản cũ hơn bỏ
 * trường đó lúc kiểm doc (kể cả bản lưu), nên ô sửa chỉ hiện khi kết quả đang
 * vẽ đến từ engine này trở lên — đặt giờ rồi mất im lặng là thứ tệ nhất.
 */
export const DEPART_AT_ENGINE = 7

export function departAtSupported(result: { engine: number } | null): boolean {
  return result != null && result.engine >= DEPART_AT_ENGINE
}

/**
 * Kéo điểm sang ngày khác (`nightsBefore`) và đặt giờ ở điểm máy chèn
 * (`autoTimes`) ra cùng bản engine với giờ xuất phát — bản cũ hơn bỏ hai trường
 * đó lúc kiểm doc, kéo xong điểm sẽ lặng lẽ nhảy về chỗ cũ.
 */
export function dayEditSupported(result: { engine: number } | null): boolean {
  return departAtSupported(result)
}

/** Trần số điểm máy chèn đặt được giờ — chép từ `MAX_AUTO_TIMES` của engine/validate.ts. */
export const MAX_AUTO_TIMES = 60

/**
 * Giờ có mặt / giờ xuất phát ở một điểm MÁY chèn (`stop.timeKey` — chủ sản phẩm
 * 26/10). Điểm vẫn là của máy: lần tính sau máy chủ còn dựng điểm đó thì giờ
 * còn tác dụng, không thì thôi. null = bỏ giờ đó. Chạm trần thì dọn giờ của
 * những điểm không còn trong kết quả (`live`) trước khi từ chối.
 */
export function setAutoTime(
  doc: PlanDoc,
  key: string,
  patch: { arriveAt?: ArriveAt | null; departAt?: number | null },
  live: ReadonlySet<string>,
): EditResult {
  const minute = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 24 * 60
  if (patch.arriveAt != null && patch.arriveAt !== 'sunrise' && !minute(patch.arriveAt)) return { ok: true, doc }
  if (patch.departAt != null && !minute(patch.departAt)) return { ok: true, doc }
  const times: Record<string, AutoTime> = { ...(doc.autoTimes ?? {}) }
  const t: AutoTime = { ...(times[key] ?? {}) }
  if (patch.arriveAt === null) delete t.arriveAt
  else if (patch.arriveAt !== undefined) t.arriveAt = patch.arriveAt
  if (patch.departAt === null) delete t.departAt
  else if (patch.departAt !== undefined) t.departAt = patch.departAt
  if (t.arriveAt === undefined && t.departAt === undefined) delete times[key]
  else times[key] = t
  if (times[key] && !doc.autoTimes?.[key] && Object.keys(times).length > MAX_AUTO_TIMES) {
    for (const k of Object.keys(times)) if (k !== key && !live.has(k)) delete times[k]
    if (Object.keys(times).length > MAX_AUTO_TIMES) return { ok: false, reason: 'timesFull' }
  }
  const next = { ...doc }
  if (Object.keys(times).length === 0) delete next.autoTimes
  else next.autoTimes = times
  return { ok: true, doc: next }
}

/**
 * Giờ xuất phát người dùng đặt ở một điểm; null = bỏ, để máy chủ tự tính.
 *
 * Ở điểm có nghỉ đêm, giờ đó là giờ đi SÁNG HÔM SAU; ở điểm không nghỉ là giờ
 * đi tiếp trong ngày. `nightHere`: máy chủ đang cho ngủ ở đây (lán nó tự chọn)
 * — đặt giờ thì ghim luôn đêm đó vào điểm này, nếu không lần tính sau máy chủ
 * chọn ngủ chỗ khác và giờ vừa đặt lặng lẽ đổi nghĩa thành giờ đi trong ngày
 * (review 26/10).
 */
export function setDepartAt(doc: PlanDoc, id: string, minute: number | null, nightHere = false): PlanDoc {
  if (minute !== null && !(Number.isInteger(minute) && minute >= 0 && minute < 24 * 60)) return doc
  const k = doc.waypoints.findIndex((w) => w.id === id)
  if (k < 0) return doc
  let list = doc.waypoints.map((w, j) => {
    if (j !== k) return w
    const next = { ...w }
    if (minute === null) delete next.departAt
    else next.departAt = minute
    return next
  })
  // Đêm máy chủ đang cho ngủ ở đây thành đêm của chính điểm (thay chỗ, không thêm ngày).
  if (minute !== null && nightHere && !list[k].rest) list = setOwnNight(list, k, true)
  return withWaypoints(doc, list)
}

/** Giờ xuất phát vừa sửa ở đâu: điểm đầu (`departMin`), một điểm, hay một điểm máy chèn. */
export type DepartFrom = { kind: 'first' } | { kind: 'wp'; id: string } | { kind: 'auto'; key: string }

/**
 * Sửa giờ xuất phát thì giờ có mặt phía sau luôn tính lại theo nó (chủ sản phẩm
 * 26/10): bỏ giờ có mặt đã đặt ở các điểm mà giờ xuất phát đó quyết — các điểm
 * SAU `from`, tới hết điểm kế tiếp có giờ xuất phát riêng hoặc chỗ ngủ kế tiếp
 * (gồm cả điểm đó: giờ TỚI của nó vẫn do giờ xuất phát này quyết). Giữ lại thì
 * máy chủ tính ngược giờ đi từ giờ có mặt, và giờ xuất phát vừa sửa bị bỏ qua:
 * Điểm 1 sửa thành 04:00 mà ngày vẫn đi 11:30 vì điểm cuối ngày còn giờ 23:35.
 * Thứ tự điểm (kể cả điểm máy chèn) và chỗ ngủ đọc từ `result`; chưa có kết quả
 * thì giữ nguyên doc.
 */
export function clearArrivalsAfter(doc: PlanDoc, result: PlanResult | null, from: DepartFrom): PlanDoc {
  if (!result) return doc
  const stops = result.stops
  // Giờ đi của điểm đầu quyết ngày leo đầu tiên — có chuyến xe tối hôm trước thì
  // ngày đó bắt đầu ở chỗ ngủ sau chuyến xe.
  const start = from.kind === 'first'
    ? Math.max(0, stops.findIndex((s) => s.transfer))
    : stops.findIndex((s) => (from.kind === 'wp' ? !s.timeKey && s.id === from.id : s.timeKey === from.key))
  if (start < 0) return doc
  const byId = new Map(doc.waypoints.map((w) => [w.id, w]))
  const ids = new Set<string>()
  const keys = new Set<string>()
  for (let k = start + 1; k < stops.length; k++) {
    const s = stops[k]
    if (s.timeKey) keys.add(s.timeKey)
    else ids.add(s.id)
    const ownDepart = s.timeKey ? doc.autoTimes?.[s.timeKey]?.departAt !== undefined : byId.get(s.id)?.departAt !== undefined
    if (s.rest || ownDepart) break
  }
  let changed = false
  const waypoints = doc.waypoints.map((w) => {
    if (!ids.has(w.id) || w.arriveAt === undefined) return w
    changed = true
    const { arriveAt: _drop, ...rest } = w
    return rest
  })
  const times: Record<string, AutoTime> = {}
  for (const [k, t] of Object.entries(doc.autoTimes ?? {})) {
    if (!keys.has(k) || t.arriveAt === undefined) {
      times[k] = t
      continue
    }
    changed = true
    if (t.departAt !== undefined) times[k] = { departAt: t.departAt }
  }
  if (!changed) return doc
  const next = withWaypoints(doc, waypoints)
  if (Object.keys(times).length === 0) delete next.autoTimes
  else next.autoTimes = times
  return next
}

/**
 * Giờ xuất phát đặt sẵn ở giữa ngày mà nay tới nơi đã muộn hơn — thường vì một
 * điểm trước đó vừa dời muộn (chủ sản phẩm 26/10): bỏ giờ đó, giờ đi ở đây thành
 * dự tính ("Hệ thống tự tính"), không cảnh báo. Giữ lại thì ô sửa vẫn ghi 09:15 trong khi
 * kế hoạch đi 10:16. Đọc giờ rời THẬT của từng điểm trong `result` (máy chủ
 * tính). Chỗ ngủ đêm thì giờ đặt là giờ đi sáng hôm sau — luôn giữ. Không có gì
 * để bỏ thì trả lại đúng `doc`.
 */
export function dropLateDepartures(doc: PlanDoc, result: PlanResult): PlanDoc {
  const byId = new Map(doc.waypoints.map((w) => [w.id, w]))
  let next = doc
  for (const s of result.stops) {
    if (s.rest || s.departMin == null) continue
    if (s.timeKey) {
      const at = next.autoTimes?.[s.timeKey]?.departAt
      if (at === undefined || s.departMin <= at) continue
      const r = setAutoTime(next, s.timeKey, { departAt: null }, new Set())
      if (r.ok) next = r.doc
    } else {
      const at = byId.get(s.id)?.departAt
      if (at !== undefined && s.departMin > at) next = setDepartAt(next, s.id, null)
    }
  }
  return next
}

/**
 * Bật / tắt "Nghỉ đêm ở đây". Giờ xuất phát đã đặt ở điểm đó bỏ luôn: nó được
 * đặt cho một nghĩa (đi sáng hôm sau, hay đi tiếp trong ngày) mà ô vừa đổi.
 */
export function toggleRest(doc: PlanDoc, id: string): PlanDoc {
  const k = doc.waypoints.findIndex((w) => w.id === id)
  if (k < 0) return doc
  const list = setOwnNight(doc.waypoints, k, !doc.waypoints[k].rest)
  const { departAt: _drop, ...w } = list[k]
  return withWaypoints(doc, list.map((x, j) => (j === k ? w : x)))
}

/**
 * Nút gợi ý thứ tự leo có ý nghĩa chưa: từ hai đỉnh trở lên VÀ điểm đầu là chỗ
 * xuất phát chứ không phải một đỉnh (chủ sản phẩm 24/10 — thứ tự nhanh nhất
 * tính từ chỗ bắt đầu). Máy chủ kiểm lại đủ luật; đây chỉ để biết hiện gì.
 */
export function suggestReadiness(doc: PlanDoc): 'ready' | 'needStart' | null {
  const peaks = new Set(doc.waypoints.filter((w) => w.kind === 'peak' && w.ref).map((w) => w.ref))
  if (peaks.size < 2) return null
  return doc.waypoints[0].kind === 'peak' ? 'needStart' : 'ready'
}

/** Chuyến đi–về: thêm điểm cuối trùng điểm xuất phát. */
export function returnToStart(doc: PlanDoc, newId: string): EditResult {
  const first = doc.waypoints[0]
  if (!first || doc.waypoints.length < 2) return { ok: false, reason: 'missing' }
  const { nightsBefore: _n, ...copy } = first
  return appendWaypoint(doc, {
    ...copy,
    id: newId,
    name: `Về ${first.name}`.slice(0, 120),
    rest: false,
    transport: 'auto',
  })
}

export function endsAtStart(doc: PlanDoc): boolean {
  const n = doc.waypoints.length
  if (n < 2) return false
  const a = doc.waypoints[0]
  const b = doc.waypoints[n - 1]
  return Math.abs(a.latE6 - b.latE6) < 200 && Math.abs(a.lonE6 - b.lonE6) < 200
}

/** Giờ sớm nhất mặc định (04:30) — chép từ DEFAULTS.earliestDepartMin của engine. */
export const DEFAULT_EARLIEST_DEPART_MIN = 4 * 60 + 30
/** Giờ xe đón mặc định khi bật đi tối hôm trước — chép từ DEFAULTS.nightTransferMin của engine. */
export const DEFAULT_NIGHT_TRANSFER_MIN = 19 * 60 + 30
/** Chỉ mời "đi tối hôm trước" khi chặng xe đầu dài hơn mức này (chủ sản phẩm 24/10). */
export const NIGHT_TRANSFER_MIN_M = 100_000

/**
 * Có hiện ô "Đi từ tối hôm trước" ở chặng xe đầu không: xe đi xa (> 100 km), hoặc
 * đang bật sẵn (để còn tắt được dù đường đã ngắn lại).
 */
export function nightTransferOffered(vehicleM: number | null, current: number | null): boolean {
  return current != null || (vehicleM != null && vehicleM > NIGHT_TRANSFER_MIN_M)
}
/** Nghỉ trưa mặc định — chép từ DEFAULTS.lunchMin của engine. */
export const DEFAULT_LUNCH_MIN = 30
/** Thời gian ở trên đỉnh mặc định — chép từ DEFAULTS.summitMin của engine. */
export const DEFAULT_SUMMIT_MIN = 30

/**
 * Có cho đánh dấu "Nghỉ đêm ở đây" không: điểm giữa kế hoạch, và KHÔNG phải đỉnh
 * — không ai ngủ trên đỉnh núi (chủ sản phẩm 24/10). Đỉnh đã lỡ đánh dấu từ
 * trước thì vẫn cho bỏ đánh dấu.
 */
export function restToggleAllowed(wp: Waypoint, index: number, count: number): boolean {
  const middle = index > 0 && index < count - 1
  // Lán (POI): chỗ ngủ do engine chọn, đổi lán bằng ô "Ngủ ở" (restChoices) —
  // ô tick ở đây vô nghĩa (chủ sản phẩm 24/10). Lỡ đánh dấu từ trước thì vẫn bỏ được.
  // Đỉnh từng được đánh dấu nghỉ (dữ liệu cũ) thì vẫn bỏ được.
  return middle && (wp.kind === 'custom' || wp.kind === 'route' || (wp.kind === 'peak' && wp.rest))
}

/**
 * Đổi chỗ ngủ của một đêm sang lán `choice`: bỏ chỗ ngủ hiện tại (điểm của
 * người dùng thì bỏ đánh dấu nghỉ; lán engine tự chèn thì không chèn lại nữa),
 * rồi ép ngủ ở lán mới — đánh dấu nghỉ nếu lán đã là một điểm, không thì chèn
 * lán đó thành điểm nghỉ đúng chỗ trên lộ trình.
 */
export function chooseRest(doc: PlanDoc, current: ResultStop, choice: RestChoice, newId: string): EditResult {
  if (choice.current) return { ok: true, doc }
  let next = doc
  let list = doc.waypoints
  // Giờ đi sáng hôm sau của đêm đó đi theo đêm sang chỗ ngủ mới — để lại ở
  // điểm cũ là nó thành giờ đi tiếp trong ngày (review 26/10).
  let departAt: number | undefined
  // Khoảng đã xếp ngày: đêm rời chỗ cũ (một đêm của điểm, hoặc một đêm máy đặt
  // của khoảng) rồi tới chỗ mới — tổng số đêm không đổi.
  const takeGapNight = (k: number) => {
    const gaps = gapsOf(list)
    const g = gaps[k]
    if (g === undefined || g === 0) return
    gaps[k] = g - 1
    list = withGaps(list, gaps)
  }
  if (current.waypointIndex >= 0) {
    const m = current.waypointIndex
    if (list[m]) {
      departAt = list[m].departAt
      if (list[m].rest) list = setOwnNight(list, m, false)
      else takeGapNight(m + 1)
      if (departAt !== undefined) {
        const { departAt: _d, ...y } = list[m]
        list = list.map((x, k) => (k === m ? y : x))
      }
    }
  } else if (current.poiId) {
    next = dismissAutoStop(next, current.poiId)
    takeGapNight(current.afterWaypointIndex + 1)
  }
  next = withWaypoints(next, list)
  const withDepart = (w: Waypoint): Waypoint => (departAt === undefined ? w : { ...w, departAt })
  const c = choice.waypointIndex
  if (c >= 0 && next.waypoints[c]) {
    // Đêm của chính điểm đó — thêm vào khoảng sau nó, không thay đêm nào.
    const gaps = gapsOf(next.waypoints)
    const marked = next.waypoints.map((x, k) => (k === c ? withDepart({ ...x, rest: true }) : x))
    return { ok: true, doc: withWaypoints(next, withGaps(marked, gaps)) }
  }
  return insertRestPoint(
    next,
    choice.afterWaypointIndex + 1,
    withDepart(makeWaypoint({
      id: newId,
      kind: 'poi',
      ref: choice.poiId,
      name: choice.name,
      lat: choice.latE6 / 1e6,
      lon: choice.lonE6 / 1e6,
      rest: true,
    })),
    { day: current.day, consumed: 0 },
  )
}

export interface SettingsPatch {
  title?: string
  startDate?: string
  departMin?: number
  autoShift?: boolean
  earliestDepartMin?: number
  /** Giờ xe đón tối hôm trước; null = tắt. */
  nightTransferMin?: number | null
  lunchMin?: number
  summitMin?: number
  pace?: number
  restMinPerHour?: number
  sunsetMarginMin?: number
  /** Đoàn có mang lều (được cắm trại khi không có lán). */
  camp?: boolean
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d && y >= 2020 && y <= 2100
}

/** Cài đặt chung; giá trị ngoài khoảng máy chủ nhận thì kẹp lại, không gửi đi rồi mới hỏng. */
export function patchSettings(doc: PlanDoc, p: SettingsPatch): PlanDoc {
  const next = { ...doc }
  if (p.title !== undefined) next.title = p.title.trim().slice(0, 120) || doc.title
  if (p.startDate !== undefined && isIsoDate(p.startDate)) next.startDate = p.startDate
  if (p.departMin !== undefined && Number.isFinite(p.departMin)) {
    next.departMin = clamp(Math.round(p.departMin), 0, 24 * 60 - 1)
  }
  if (p.autoShift !== undefined) next.autoShift = p.autoShift
  // Chỉ ghi khi khác mặc định — cùng luật với máy chủ, giữ băm doc cũ.
  if (p.lunchMin !== undefined && Number.isFinite(p.lunchMin)) {
    const v = clamp(Math.round(p.lunchMin), 0, 180)
    if (v === DEFAULT_LUNCH_MIN) delete next.lunchMin
    else next.lunchMin = v
  }
  if (p.summitMin !== undefined && Number.isFinite(p.summitMin)) {
    const v = clamp(Math.round(p.summitMin), 0, 180)
    if (v === DEFAULT_SUMMIT_MIN) delete next.summitMin
    else next.summitMin = v
  }
  if (p.nightTransferMin === null) delete next.nightTransferMin
  else if (p.nightTransferMin !== undefined && Number.isFinite(p.nightTransferMin)) {
    next.nightTransferMin = clamp(Math.round(p.nightTransferMin), 0, 24 * 60 - 1)
  }
  // Chỉ ghi khi khác mặc định — cùng luật với máy chủ (validate.ts), giữ băm.
  if (p.earliestDepartMin !== undefined && Number.isFinite(p.earliestDepartMin)) {
    const v = clamp(Math.round(p.earliestDepartMin), 0, 12 * 60)
    if (v === DEFAULT_EARLIEST_DEPART_MIN) delete next.earliestDepartMin
    else next.earliestDepartMin = v
  }
  if (p.pace !== undefined && Number.isFinite(p.pace)) {
    next.pace = Math.round(clamp(p.pace, PACE_MIN, PACE_MAX) * 100) / 100
  }
  if (p.restMinPerHour !== undefined && Number.isFinite(p.restMinPerHour)) {
    next.restMinPerHour = clamp(Math.round(p.restMinPerHour), 0, 30)
  }
  if (p.sunsetMarginMin !== undefined && Number.isFinite(p.sunsetMarginMin)) {
    next.sunsetMarginMin = clamp(Math.round(p.sunsetMarginMin), 30, 120)
  }
  // Chỉ ghi khi tắt: kế hoạch không đụng tới cắm trại giữ nguyên băm.
  if (p.camp === true) delete next.noCamp
  if (p.camp === false) next.noCamp = true
  return next
}

/** Id ngắn, không trùng trong doc. `rand` tiêm vào để test được. */
export function freshWaypointId(doc: PlanDoc, rand: () => string): string {
  const taken = new Set(doc.waypoints.map((w) => w.id))
  for (let i = 0; i < 20; i++) {
    const id = `w${rand()}`
    if (!taken.has(id)) return id
  }
  throw new Error('Không sinh được id điểm không trùng')
}

/**
 * Tên mặc định của điểm `id` theo số thứ tự của nó ("Điểm 3" — đúng số trên
 * chấm bản đồ); điểm khác đã mang tên đó thì lấy "Điểm N" kế tiếp chưa ai dùng.
 */
function pointNameAt(doc: PlanDoc, id: string): string {
  const own = `Điểm ${doc.waypoints.findIndex((w) => w.id === id) + 1}`
  return doc.waypoints.some((w) => w.id !== id && w.name === own) ? nextPointName(doc) : own
}

/** Tên mặc định cho điểm tự chấm: "Điểm N" với N chưa ai dùng. */
export function nextPointName(doc: PlanDoc): string {
  const used = new Set(doc.waypoints.map((w) => w.name))
  for (let n = doc.waypoints.length + 1; ; n++) {
    const name = `Điểm ${n}`
    if (!used.has(name)) return name
  }
}

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`
}

/**
 * Hai bản kế hoạch có giống nhau không, bỏ qua thứ tự khoá — doc đọc về từ
 * cột jsonb đã bị Postgres xếp lại khoá, so chuỗi thô là báo khác oan.
 */
export function sameDoc(a: PlanDoc, b: PlanDoc): boolean {
  return canonical(a) === canonical(b)
}

/**
 * `doc` chỉ là `resultDoc` bớt đi một hay vài điểm ở CUỐI, mọi thứ khác y
 * nguyên (chủ sản phẩm 26/10): đường và giờ của các điểm còn lại vẫn là của
 * lần tính trước, nên panel giữ nguyên, không mờ đi chờ tính lại — chỉ số tổng
 * còn chờ máy chủ. Dời hay bỏ điểm GIỮA thì không phải.
 *
 * Trừ hai ca mà giờ của các điểm còn lại ĐỔI theo: điểm bị bỏ có hẹn giờ có
 * mặt (nó có thể là mốc quyết định giờ đi của cả ngày), và điểm cuối mới có
 * giờ xuất phát (trước là điểm giữa nên giờ đó có tính; giờ là điểm cuối nên
 * máy chủ bỏ qua).
 */
export function isTailTrim(resultDoc: PlanDoc, doc: PlanDoc): boolean {
  const n = doc.waypoints.length
  if (n === 0 || n >= resultDoc.waypoints.length) return false
  if (resultDoc.waypoints.slice(n).some((w) => w.arriveAt !== undefined)) return false
  if (doc.waypoints[n - 1].departAt !== undefined) return false
  return sameDoc({ ...doc, title: '' }, { ...resultDoc, title: '', waypoints: resultDoc.waypoints.slice(0, n) })
}
