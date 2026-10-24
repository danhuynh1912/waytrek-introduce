// Mọi thao tác sửa một kế hoạch. Thuần: nhận doc cũ, trả doc mới, không đụng
// tới bản cũ (hoàn tác giữ nguyên các bản trước).

import type { ArriveAt, PlanDoc, ResultStop, Transport, Waypoint, WaypointKind } from './types.ts'

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
  | { ok: false; reason: 'full' | 'outside' | 'missing' }

function withWaypoints(doc: PlanDoc, waypoints: Waypoint[]): PlanDoc {
  return { ...doc, waypoints }
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

export function removeWaypoint(doc: PlanDoc, id: string): PlanDoc {
  return withWaypoints(doc, doc.waypoints.filter((w) => w.id !== id))
}

export function moveWaypoint(doc: PlanDoc, id: string, delta: -1 | 1): PlanDoc {
  const i = doc.waypoints.findIndex((w) => w.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= doc.waypoints.length) return doc
  const list = [...doc.waypoints]
  ;[list[i], list[j]] = [list[j], list[i]]
  return withWaypoints(doc, list)
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

/** Kéo một điểm sang chỗ khác: giữ id, tên, ô nghỉ đêm, cách đi tới, mốc giờ. */
export function relocateWaypoint(
  doc: PlanDoc,
  id: string,
  to: { lat: number; lon: number; kind: WaypointKind; ref?: string },
): EditResult {
  if (!inBounds(to.lat, to.lon)) return { ok: false, reason: 'outside' }
  const old = doc.waypoints.find((w) => w.id === id)
  if (!old) return { ok: false, reason: 'missing' }
  const moved = makeWaypoint({ ...old, ...to, lat: to.lat, lon: to.lon })
  if (!to.ref) delete moved.ref
  if (old.restOk) moved.restOk = true
  if (old.arriveAt !== undefined) moved.arriveAt = old.arriveAt
  return {
    ok: true,
    doc: withWaypoints(doc, doc.waypoints.map((w) => (w.id === id ? moved : w))),
  }
}

/** Tên điểm khi giữ một vùng nên nghỉ làm chỗ cắm trại. */
export const CAMP_NAME = 'Chỗ cắm trại'

/**
 * [Giữ] một lán tự chèn: nó thành điểm thật của kế hoạch, tick nghỉ đêm sẵn
 * (spec/43 §3.4). Vùng nên nghỉ thì thành một điểm tự chấm "Chỗ cắm trại" ở
 * đúng điểm nghỉ của vùng. `afterWaypointId` là điểm đứng ngay trước nó — tính
 * theo kế hoạch ĐÃ SINH ra kết quả, vì doc có thể đã đổi từ lúc đó.
 */
export function keepAutoStop(
  doc: PlanDoc,
  stop: ResultStop,
  afterWaypointId: string,
  newId: string,
): EditResult {
  const i = doc.waypoints.findIndex((w) => w.id === afterWaypointId)
  if (i < 0 || (!stop.poiId && !stop.zone)) return { ok: false, reason: 'missing' }
  const at = { lat: stop.latE6 / 1e6, lon: stop.lonE6 / 1e6, rest: true }
  return insertAt(
    doc,
    i + 1,
    stop.poiId
      ? makeWaypoint({ id: newId, kind: 'poi', ref: stop.poiId, name: stop.name, transport: 'walk', ...at })
      : makeWaypoint({ id: newId, kind: 'custom', name: CAMP_NAME, transport: 'walk', ...at }),
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
  return appendWaypoint(doc, {
    ...first,
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

export interface SettingsPatch {
  title?: string
  startDate?: string
  departMin?: number
  autoShift?: boolean
  earliestDepartMin?: number
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
