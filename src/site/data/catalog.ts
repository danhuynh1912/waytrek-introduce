// Mọi lần đọc dữ liệu catalog của waytrek.site (khoá anon, RLS công khai của
// schema `waytrek`). UI không biết tên bảng hay cột — chỉ biết hàm + kiểu ở đây.
// supabase-js tải LƯỜI: trang chủ vẽ xong rồi mới kéo thư viện về.

import { boardFromRows } from '../core/difficulty'
import type { DifficultyBoard } from '../core/difficulty'
import type { TravelSpan } from '../core/geometry'
import { trailFromRow } from '../core/trails'
import type { TrailSummary } from '../core/trails'

// Supabase KHÔNG có giờ chờ mặc định; mạng yếu thì request treo mãi (luật repo:
// xoay vô hạn là một LỖI). Trần này áp cho mọi lần đọc ở đây.
const READ_TIMEOUT_MS = 15_000

const client = () => import('@/shared/supabase').then((m) => m.supabase)

const LIST_COLUMNS =
  'id, name, region, difficulty, difficulty_title, distance_m, elevation_gain_m, effective_elevation_gain_m, ' +
  'peak_elevation_m, gpx_max_elevation_m, image_url, conquest_count, peak_lat, peak_lng, center_lat, center_lng, description'

let catalogP: Promise<TrailSummary[]> | null = null

/** Toàn bộ cung công khai (vài chục dòng, KHÔNG kèm hình học). Nhớ trong phiên; hỏng thì lần sau tải lại. */
export function fetchCatalog(): Promise<TrailSummary[]> {
  catalogP ??= (async () => {
    const sb = await client()
    const { data, error } = await sb
      .from('trails_with_default_route')
      .select(LIST_COLUMNS)
      .eq('is_public', true)
      .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
    if (error) throw new Error(error.message)
    return (data as unknown as Record<string, unknown>[]).map(trailFromRow).filter((t): t is TrailSummary => t != null)
  })().catch((e) => {
    catalogP = null
    throw e
  })
  return catalogP
}

let boardP: Promise<DifficultyBoard> | null = null

/** Bảng điểm độ khó do cộng đồng xếp — cùng RPC app đọc. Nhớ trong phiên; hỏng thì lần sau hỏi lại. */
export function fetchDifficultyBoard(): Promise<DifficultyBoard> {
  boardP ??= (async () => {
    const sb = await client()
    const { data, error } = await sb.rpc('get_difficulty_board').abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
    if (error) throw new Error(error.message)
    return boardFromRows((data ?? []) as Record<string, unknown>[])
  })().catch((e) => {
    boardP = null
    throw e
  })
  return boardP
}

export interface CatalogCounts {
  routes: number
  pois: number
  /** Lượt ghi danh CÓ MẶT TRÊN BẢNG VÀNG (mọi mùa): `auto`/`manual` và thuộc một mùa. */
  boardConquests: number
}

/**
 * Số lộ trình, số điểm đánh dấu và số lượt ghi danh trên Bảng Vàng — chỉ đếm
 * (HEAD), không kéo dòng nào. Lượt ghi danh lọc đúng hai vế mà Bảng Vàng dùng
 * (`_leaderboard_ranked`: `verify_status in (auto, manual)` + có `season_id`),
 * nên tự khai / đóng góp GPX không được cộng vào con số khoe ở trang chủ.
 */
export async function fetchCatalogCounts(): Promise<CatalogCounts> {
  const sb = await client()
  const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
  const [routes, pois, board] = await Promise.all([
    sb.from('trail_routes').select('id, trails!inner(is_public)', { count: 'exact', head: true })
      .is('deleted_at', null).eq('trails.is_public', true).is('trails.deleted_at', null).abortSignal(signal),
    sb.from('poi_points').select('id', { count: 'exact', head: true }).is('deleted_at', null).abortSignal(signal),
    sb.from('conquests').select('id', { count: 'exact', head: true })
      .in('verify_status', ['auto', 'manual']).not('season_id', 'is', null).abortSignal(signal),
  ])
  for (const r of [routes, pois, board]) if (r.error) throw new Error(r.error.message)
  return { routes: routes.count ?? 0, pois: pois.count ?? 0, boardConquests: board.count ?? 0 }
}

export interface RouteMeta {
  id: string
  name: string
  isDefault: boolean
  isRecommended: boolean
  distanceM: number | null
  gainM: number | null
  peakEleM: number | null
}

export interface PoiPoint {
  id: string
  name: string
  description: string | null
  lat: number
  lng: number
  imageUrl: string | null
}

export interface PoiGroup {
  id: string
  name: string
  icon: string | null
  points: PoiPoint[]
}

export interface LoreChapter {
  no: number
  title: string
  body: string
}

export interface TrailDetail {
  trail: TrailSummary
  routes: RouteMeta[]
  poiGroups: PoiGroup[]
  lore: LoreChapter[]
}

/** Một cung + các lộ trình (không hình học) + điểm đặc biệt + truyện núi. null = không có / không công khai. */
export async function fetchTrailDetail(trailId: string): Promise<TrailDetail | null> {
  const sb = await client()
  const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
  const [trail, routes, cats, lore] = await Promise.all([
    sb.from('trails_with_default_route').select(LIST_COLUMNS).eq('id', trailId).eq('is_public', true).abortSignal(signal).maybeSingle(),
    sb.from('trail_routes')
      .select('id, name, is_default, is_recommended, distance_m, elevation_gain_m, derived_elevation_gain_m, peak_elevation_m, gpx_max_elevation_m')
      .eq('trail_id', trailId).is('deleted_at', null).abortSignal(signal),
    sb.from('poi_categories')
      .select('id, name, icon, sort_order, poi_points(id, name, description, lat, lng, image_url, sort_order, deleted_at)')
      .eq('trail_id', trailId).is('deleted_at', null).abortSignal(signal),
    sb.from('trail_lore').select('chapter_no, chapter_title, body').eq('trail_id', trailId).order('chapter_no').abortSignal(signal),
  ])
  for (const r of [trail, routes, cats, lore]) if (r.error) throw new Error(r.error.message)
  const t = trail.data ? trailFromRow(trail.data as unknown as Record<string, unknown>) : null
  if (!t) return null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const routeRows = (routes.data ?? []) as Record<string, unknown>[]
  return {
    trail: t,
    routes: routeRows
      .map((r) => ({
        id: String(r.id),
        name: String(r.name ?? '').trim() || 'Lộ trình',
        isDefault: r.is_default === true,
        isRecommended: r.is_recommended === true,
        distanceM: num(r.distance_m),
        gainM: num(r.derived_elevation_gain_m) ?? num(r.elevation_gain_m),
        peakEleM: num(r.peak_elevation_m) ?? num(r.gpx_max_elevation_m),
      }))
      // Như app: lộ trình gợi ý trước, rồi mặc định, rồi ngắn trước.
      .sort((a, b) =>
        Number(b.isRecommended) - Number(a.isRecommended) ||
        Number(b.isDefault) - Number(a.isDefault) ||
        (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)),
    poiGroups: ((cats.data ?? []) as Record<string, unknown>[])
      .sort((a, b) => (num(a.sort_order) ?? 0) - (num(b.sort_order) ?? 0))
      .map((c) => ({
        id: String(c.id),
        name: String(c.name ?? ''),
        icon: typeof c.icon === 'string' ? c.icon : null,
        points: ((c.poi_points ?? []) as Record<string, unknown>[])
          .filter((p) => p.deleted_at == null && num(p.lat) != null && num(p.lng) != null)
          .sort((a, b) => (num(a.sort_order) ?? 0) - (num(b.sort_order) ?? 0))
          .map((p) => ({
            id: String(p.id),
            name: String(p.name ?? '').trim(),
            description: typeof p.description === 'string' && p.description.trim() ? p.description.trim() : null,
            lat: p.lat as number,
            lng: p.lng as number,
            imageUrl: typeof p.image_url === 'string' ? p.image_url : null,
          })),
      }))
      // Tab chưa có điểm nào thì không hiện (cùng luật `_poiTabs` của app).
      .filter((g) => g.points.length > 0),
    lore: ((lore.data ?? []) as Record<string, unknown>[])
      .filter((l) => typeof l.body === 'string' && l.body.trim())
      .map((l) => ({ no: num(l.chapter_no) ?? 0, title: String(l.chapter_title ?? ''), body: String(l.body) })),
  }
}

const geomCache = new Map<string, Promise<{ geojson: unknown; travel: TravelSpan[] }>>()

/** Hình học của MỘT lộ trình — có tuyến nặng tới gần 1 MB, nên chỉ tải lộ trình đang xem. */
export function fetchRouteGeometry(routeId: string): Promise<{ geojson: unknown; travel: TravelSpan[] }> {
  let p = geomCache.get(routeId)
  if (!p) {
    p = (async () => {
      const sb = await client()
      const { data, error } = await sb
        .from('trail_routes')
        .select('geojson, travel_modes')
        .eq('id', routeId)
        .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('Không tìm thấy lộ trình')
      const row = data as { geojson: unknown; travel_modes: unknown }
      const travel = Array.isArray(row.travel_modes)
        ? (row.travel_modes as Record<string, unknown>[])
          .filter((s) => typeof s.from_m === 'number' && typeof s.to_m === 'number')
          .map((s) => ({ mode: String(s.mode ?? 'moto'), fromM: s.from_m as number, toM: s.to_m as number }))
        : []
      return { geojson: row.geojson, travel }
    })()
    p.catch(() => geomCache.delete(routeId))
    geomCache.set(routeId, p)
  }
  return p
}
