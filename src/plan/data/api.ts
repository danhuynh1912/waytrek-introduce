// Mọi lần gọi máy chủ của trang lên kế hoạch. UI không biết tên RPC, tên cột
// hay mã HTTP — chỉ biết các hàm và kiểu trả về ở đây.

import type { ChecklistRow } from '../core/checklist'
import type { SaveOutcome } from '../core/save-queue'
import type { PeakCombo, Place, PlanDoc, PlanResult, PoiPin, RouteLine, StartTrailhead, SuggestOutcome, TrailPin } from '../core/types'
import { SUPABASE_ANON_KEY, TRIP_PLAN_URL } from '@/shared/config'
import { supabase } from '@/shared/supabase'

/** Lỗi đã hiểu được của `trip-plan` / PostgREST, để UI nói đúng chuyện. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly field: string | null

  constructor(status: number, code: string, field: string | null = null) {
    super(field ? `${code} (${field})` : code)
    this.status = status
    this.code = code
    this.field = field
  }
}

// Supabase KHÔNG có giờ chờ mặc định; mạng yếu thì request treo mãi.
const READ_TIMEOUT_MS = 15_000
// Lượt nguội của Edge Function + tải tile độ cao đo được ~4,5 giây.
const PLAN_TIMEOUT_MS = 25_000

function timeoutSignal(ms: number, outer?: AbortSignal): AbortSignal {
  const c = new AbortController()
  const timer = setTimeout(() => c.abort(new DOMException('Hết giờ chờ máy chủ', 'TimeoutError')), ms)
  const stop = () => clearTimeout(timer)
  c.signal.addEventListener('abort', stop)
  if (outer) {
    if (outer.aborted) c.abort(outer.reason)
    else outer.addEventListener('abort', () => c.abort(outer.reason), { once: true })
  }
  return c.signal
}

async function bearer(): Promise<string> {
  // getSession tự làm mới token đã hết hạn (tab ngủ lâu rồi mở lại).
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? SUPABASE_ANON_KEY
}

async function callTripPlan(body: unknown, signal?: AbortSignal): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(TRIP_PLAN_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${await bearer()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: timeoutSignal(PLAN_TIMEOUT_MS, signal),
  })
  let json: Record<string, unknown> = {}
  try {
    json = await res.json()
  } catch {
    // Cổng Supabase có thể trả thân không phải JSON (502…) — mã HTTP là đủ để nói.
  }
  return { status: res.status, json }
}

function errorOf(status: number, json: Record<string, unknown>): ApiError {
  const code = typeof json.error === 'string' ? json.error : status === 401 ? 'AUTH_REQUIRED' : `HTTP_${status}`
  return new ApiError(status, code, typeof json.field === 'string' ? json.field : null)
}

/** Tính kế hoạch, không lưu (không cần đăng nhập). */
export async function computePlan(doc: PlanDoc, signal?: AbortSignal): Promise<PlanResult> {
  const { status, json } = await callTripPlan({ action: 'compute', doc }, signal)
  if (status === 200 && json.result) return json.result as PlanResult
  throw errorOf(status, json)
}

/**
 * Gợi ý thứ tự leo nhanh nhất (không lưu, không đổi gì). Lượt đầu của máy chủ
 * phải tải tile độ cao cho nhiều chặng thử — đo được tới ~10 giây.
 */
export async function suggestPlan(doc: PlanDoc, signal?: AbortSignal): Promise<SuggestOutcome> {
  const { status, json } = await callTripPlan({ action: 'suggest', doc }, signal)
  if (status === 200 && json.outcome) return json.outcome as SuggestOutcome
  throw errorOf(status, json)
}

/**
 * Chân núi để xuất phát khi điểm đầu của `doc` là một đỉnh: chân lên đỉnh nhanh
 * nhất theo lộ trình WayTrek. null = đỉnh chưa có lộ trình nào.
 */
export async function fetchStartTrailhead(doc: PlanDoc, signal?: AbortSignal): Promise<StartTrailhead | null> {
  const { status, json } = await callTripPlan({ action: 'trailhead', doc }, signal)
  if (status === 200 && 'trailhead' in json) return (json.trailhead as StartTrailhead | null) ?? null
  throw errorOf(status, json)
}

/**
 * Lối đi (đường / lối mòn OSM) gần nhất trong 500 m quanh một điểm chấm tay.
 * null = không có lối nào đủ gần — giữ nguyên chỗ chấm.
 */
export async function fetchSnap(at: { lat: number; lng: number }, signal?: AbortSignal): Promise<{ lat: number; lng: number; distM: number } | null> {
  const { status, json } = await callTripPlan({ action: 'snap', lat: at.lat, lon: at.lng }, signal)
  if (status !== 200) throw errorOf(status, json)
  const s = json.snap as { lat: number; lon: number; distM: number } | null
  return s ? { lat: s.lat, lng: s.lon, distM: s.distM } : null
}

/**
 * Tìm địa điểm trong Việt Nam theo chữ (ORS qua máy chủ — khoá không lộ ra web).
 * Hạn mức của ORS có trần theo ngày: chỗ gọi phải debounce.
 */
export async function geocodePlaces(text: string, focus: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<Place[]> {
  const { status, json } = await callTripPlan(
    { action: 'geocode', text, ...(focus ? { focus: { lat: focus.lat, lon: focus.lng } } : {}) },
    signal,
  )
  if (status === 200 && Array.isArray(json.places)) return json.places as Place[]
  throw errorOf(status, json)
}

/** Tính + lưu. Máy chủ tự xác thực người dùng từ phiên; không gửi user id. */
export async function savePlan(planId: string, doc: PlanDoc, baseVersion: number): Promise<SaveOutcome> {
  let r: { status: number; json: Record<string, unknown> }
  try {
    r = await callTripPlan({ action: 'save', planId, doc, baseVersion })
  } catch (e) {
    return { kind: 'failed', message: e instanceof Error ? e.message : String(e) }
  }
  const { status, json } = r
  if (status === 200 && json.status === 'saved') {
    return { kind: 'saved', version: Number(json.version), result: json.result as PlanResult }
  }
  if (status === 409 && json.status === 'conflict') {
    const server = json.server as { version: number; doc: PlanDoc; result: PlanResult | null }
    return { kind: 'conflict', version: server.version, doc: server.doc, result: server.result }
  }
  if (status === 410) return { kind: 'deleted' }
  if (status === 401) return { kind: 'auth' }
  const e = errorOf(status, json)
  return { kind: 'failed', message: e.message }
}

// ─── Dữ liệu bản đồ (công khai) ───────────────────────────────────────────

interface TrailRow {
  trail_id: string
  name: string
  region: string | null
  pin_lat: number
  pin_lng: number
  has_peak: boolean
  peak_ele_m: number | null
}

export async function fetchTrails(): Promise<TrailPin[]> {
  const { data, error } = await supabase.rpc('planner_trails').abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'READ_FAILED', `planner_trails: ${error.message}`)
  return (data as TrailRow[]).map((r) => ({
    trailId: r.trail_id,
    name: r.name,
    region: r.region,
    lat: r.pin_lat,
    lng: r.pin_lng,
    hasPeak: r.has_peak,
    peakEleM: r.peak_ele_m,
  }))
}

interface ComboRow {
  id: string
  name: string
  trail_ids: string[]
}

/** Combo đỉnh gợi ý (bảng planner_combos, admin quản lý). */
export async function fetchCombos(): Promise<PeakCombo[]> {
  const { data, error } = await supabase.rpc('planner_combos').abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'READ_FAILED', `planner_combos: ${error.message}`)
  return (data as ComboRow[]).map((r) => ({ id: r.id, name: r.name, trailIds: r.trail_ids ?? [] }))
}

interface PoiRow {
  poi_id: string
  trail_id: string
  name: string
  kind: string
  lat: number
  lng: number
}

export async function fetchPois(): Promise<PoiPin[]> {
  const { data, error } = await supabase.rpc('planner_pois').abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'READ_FAILED', `planner_pois: ${error.message}`)
  return (data as PoiRow[]).map((r) => ({
    poiId: r.poi_id,
    trailId: r.trail_id,
    name: r.name,
    kind: r.kind,
    lat: r.lat,
    lng: r.lng,
  }))
}

interface RouteRow {
  route_id: string
  trail_id: string
  trail_name: string
  route_name: string | null
  segments: [number, number][][]
}

export interface Bbox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

/** Lộ trình các cung trong khung nhìn — máy chủ chỉ trả khi khung ≤ 3°, tối đa 40. */
export async function fetchRoutesInBbox(b: Bbox, signal?: AbortSignal): Promise<RouteLine[]> {
  const { data, error } = await supabase
    .rpc('planner_routes_in_bbox', {
      p_min_lng: b.minLng,
      p_min_lat: b.minLat,
      p_max_lng: b.maxLng,
      p_max_lat: b.maxLat,
    })
    .abortSignal(timeoutSignal(READ_TIMEOUT_MS, signal))
  if (error) throw new ApiError(0, 'READ_FAILED', `planner_routes_in_bbox: ${error.message}`)
  return (data as RouteRow[]).map((r) => ({
    routeId: r.route_id,
    trailId: r.trail_id,
    trailName: r.trail_name,
    routeName: r.route_name,
    segments: r.segments ?? [],
  }))
}

// ─── Kế hoạch của tôi (cần đăng nhập) ─────────────────────────────────────

export interface PlanSummary {
  id: string
  title: string
  startDate: string
  dayCount: number
  distanceM: number
  ascentM: number
  version: number
  updatedAt: string
}

interface ListRow {
  id: string
  title: string
  start_date: string
  day_count: number
  distance_m: number
  ascent_m: number
  version: number
  updated_at: string
}

export async function listPlans(): Promise<PlanSummary[]> {
  const { data, error } = await supabase.rpc('list_my_trip_plans').abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'READ_FAILED', `list_my_trip_plans: ${error.message}`)
  return (data as ListRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    dayCount: r.day_count,
    distanceM: r.distance_m,
    ascentM: r.ascent_m,
    version: r.version,
    updatedAt: r.updated_at,
  }))
}

export interface StoredPlan {
  id: string
  version: number
  doc: PlanDoc
  result: PlanResult | null
}

/** Một kế hoạch của chính mình (RLS chỉ cho đọc của mình). null = không có / không phải của mình. */
export async function loadPlan(id: string): Promise<StoredPlan | null> {
  const { data, error } = await supabase
    .from('trip_plans')
    .select('id, version, doc, result')
    .eq('id', id)
    .abortSignal(timeoutSignal(READ_TIMEOUT_MS))
    .maybeSingle()
  if (error) throw new ApiError(0, 'READ_FAILED', `trip_plans: ${error.message}`)
  if (!data) return null
  return { id: data.id, version: data.version, doc: data.doc as PlanDoc, result: (data.result ?? null) as PlanResult | null }
}

export async function deletePlan(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('delete_trip_plan', { p_plan_id: id })
    .abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'WRITE_FAILED', `delete_trip_plan: ${error.message}`)
  return data === true
}

interface ChecklistDbRow {
  item_id: string
  kind: 'builtin' | 'custom'
  label: string | null
  done: boolean
  removed: boolean
  updated_at: string
}

const toRow = (r: ChecklistDbRow): ChecklistRow => ({
  itemId: r.item_id,
  kind: r.kind,
  label: r.label,
  done: r.done,
  removed: r.removed,
  updatedAt: r.updated_at,
})

export async function loadChecklist(planId: string): Promise<ChecklistRow[]> {
  const { data, error } = await supabase
    .from('trip_plan_checklist')
    .select('item_id, kind, label, done, removed, updated_at')
    .eq('plan_id', planId)
    .abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'READ_FAILED', `trip_plan_checklist: ${error.message}`)
  return (data as ChecklistDbRow[]).map(toRow)
}

/** Ghi một mục; máy chủ chỉ nhận khi bản này mới hơn bản đang có, và trả bản đang thắng. */
export async function saveChecklistItem(planId: string, row: ChecklistRow): Promise<ChecklistRow> {
  const { data, error } = await supabase
    .rpc('set_plan_checklist_item', {
      p_plan_id: planId,
      p_item_id: row.itemId,
      p_kind: row.kind,
      p_label: row.label,
      p_done: row.done,
      p_removed: row.removed,
      p_updated_at: row.updatedAt,
    })
    .abortSignal(timeoutSignal(READ_TIMEOUT_MS))
  if (error) throw new ApiError(0, 'WRITE_FAILED', `set_plan_checklist_item: ${error.message}`)
  return toRow(data as ChecklistDbRow)
}
