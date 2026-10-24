// Hợp đồng với Edge Function `trip-plan` — CHÉP từ
// `supabase/functions/trip-plan/engine/types.ts` (repo WayTrek). Máy chủ là
// chủ: đổi ở đó trước rồi chép lại đây, như token màu chép từ app.
//
// Thư mục `core/` là logic thuần (không React, không mạng, không DOM) và import
// tương đối kèm đuôi `.ts` để `deno test` chạy thẳng được (tests/plan/).

export type WaypointKind = 'custom' | 'peak' | 'poi' | 'route'
export type Transport = 'walk' | 'vehicle'

export interface Waypoint {
  id: string
  kind: WaypointKind
  /** trailId (peak) hoặc poiId (poi). */
  ref?: string
  latE6: number
  lonE6: number
  name: string
  /** "Nghỉ đêm ở đây". */
  rest: boolean
  /** Chặng TỚI điểm này đi bằng gì. Điểm đầu bỏ qua. */
  transport: Transport
  /** Nghỉ đêm được ở đây NẾU ngày cần cắt (bản dưới chân núi…) — máy chủ tự chọn. */
  restOk?: boolean
  /** Mốc: có mặt ở đây lúc nào — bình minh, hoặc phút kể từ 0h. */
  arriveAt?: ArriveAt
}

export type ArriveAt = 'sunrise' | number

export interface PlanDoc {
  v: 1
  title: string
  /** YYYY-MM-DD, giờ Việt Nam. */
  startDate: string
  /** Giờ khởi hành mỗi ngày, phút kể từ 0h. */
  departMin: number
  autoShift: boolean
  pace: number
  restMinPerHour: number
  sunsetMarginMin: number
  waypoints: Waypoint[]
  dismissedRestPoiIds: string[]
  /** Đoàn không mang lều: không dựng vùng nên nghỉ. */
  noCamp?: true
}

export type LegFlag = 'unknownPath' | 'partialPath' | 'steep' | 'noElevation'

export interface ResultStop {
  id: string
  kind: WaypointKind
  ref: string | null
  name: string
  latE6: number
  lonE6: number
  eleM: number | null
  day: number
  etaMin: number
  rest: boolean
  restSource: 'user' | 'auto' | null
  inserted: boolean
  poiId: string | null
  /** Vị trí trong doc.waypoints; điểm tự chèn: -1. */
  waypointIndex: number
  afterWaypointIndex: number
  leaveByMin: number | null
  /** Mốc giờ đã giải ra phút (bình minh → giờ thật). */
  targetMin: number | null
  /** Có ở điểm nghỉ máy chủ dựng chỗ KHÔNG có lán nào. */
  zone: RestZone | null
}

/**
 * Vùng nên nghỉ: tới giờ phải dừng, người đi chậm nhất đứng ở đầu vùng, người đi
 * nhanh nhất ở cuối vùng; điểm nghỉ (nhịp của kế hoạch) nằm giữa.
 */
export interface RestZone {
  /** Polyline mã hoá, độ chính xác 5, thứ tự [lat, lon]. */
  line: string
  /** Mét tính từ đầu kế hoạch. */
  fromM: number
  toM: number
  water: boolean
}

export interface DrawPiece {
  kind: 'route' | 'straight' | 'vehicle'
  /** Polyline mã hoá, độ chính xác 5, thứ tự [lat, lon]. */
  line: string
}

export interface ResultLeg {
  from: string
  to: string
  transport: Transport
  distanceM: number
  ascentM: number
  descentM: number
  moveMin: number
  knownPct: number
  unknownM: number
  flags: LegFlag[]
  draw: DrawPiece[]
}

export type DayWarning =
  | { code: 'afterDark'; arriveMin: number; limitMin: number; sunsetMin: number }
  | { code: 'driveAfterDark'; arriveMin: number; sunsetMin: number }
  /**
   * capMin: 8 giờ, hoặc 10 giờ nếu là ngày lên đỉnh từ lán. pushOn: chỉ lố ít và
   * vẫn kịp ra khỏi rừng trước tối — engine cố ý đi nốt thay vì ngủ thêm một đêm.
   */
  | { code: 'tooLong'; walkMin: number; capMin: number; pushOn: boolean }
  | { code: 'anchorLate'; stopId: string; targetMin: number; etaMin: number }
  | { code: 'campZone'; stopId: string }
  | { code: 'noRestKnown' }
  | { code: 'restDismissed' }
  | { code: 'departShifted'; fromMin: number; toMin: number }
  | { code: 'departSuggest'; toMin: number }
  | { code: 'darkStart'; sunriseMin: number }
  | { code: 'noWater' }
  | { code: 'cold'; maxEleM: number }

export interface ResultDay {
  index: number
  date: string
  departMin: number
  plannedDepartMin: number
  arriveMin: number
  sunriseMin: number | null
  sunsetMin: number | null
  limitMin: number | null
  walkMin: number
  elapsedMin: number
  distanceM: number
  ascentM: number
  startStopId: string
  endStopId: string
  /** Điểm có mốc quyết định giờ xuất phát của ngày. */
  anchorStopId: string | null
  warnings: DayWarning[]
}

export interface PlanResult {
  engine: number
  docHash: string
  stops: ResultStop[]
  legs: ResultLeg[]
  days: ResultDay[]
  totals: {
    distanceM: number
    walkDistanceM: number
    ascentM: number
    descentM: number
    walkMin: number
    elapsedMin: number
    dayCount: number
    knownPct: number
    maxEleM: number | null
  }
  profile: { stepM: number; ele: (number | null)[] }
  checklist: string[]
  trailIds: string[]
}

// ─── Gợi ý thứ tự leo (action "suggest") ───────────────────────────────────

/** Lên / rời một đỉnh bằng đường nào. */
export type Approach =
  | { kind: 'trailhead'; routeName: string | null; eleM: number | null }
  /** Đi thẳng từ (lúc lên) hoặc sang (lúc rời) đỉnh `peak` theo lối nối hai đỉnh. */
  | { kind: 'traverse'; peak: string }

export interface SuggestedPeak {
  waypointId: string
  name: string
  trailId: string
  up: Approach
  down: Approach
}

export interface SuggestTotals {
  elapsedMin: number
  dayCount: number
  knownPct: number
  distanceM: number
}

export type SuggestOutcome =
  | {
    kind: 'ok'
    doc: PlanDoc
    result: PlanResult
    order: SuggestedPeak[]
    removed: string[]
    before: SuggestTotals
    after: SuggestTotals
  }
  | { kind: 'same' }
  | { kind: 'missing'; peaks: string[] }
  | { kind: 'needStart' }
  | { kind: 'few' }
  | { kind: 'tooMany'; max: number }

// ─── Dữ liệu bản đồ (RPC planner_*) ────────────────────────────────────────

export interface TrailPin {
  trailId: string
  name: string
  region: string | null
  lat: number
  lng: number
  hasPeak: boolean
  peakEleM: number | null
}

export interface PoiPin {
  poiId: string
  trailId: string
  name: string
  /** Icon của tab POI trong app: shelter, camp, water, … */
  kind: string
  lat: number
  lng: number
}

export interface RouteLine {
  routeId: string
  trailId: string
  trailName: string
  routeName: string | null
  /** Từng đoạn GPX: [[lonE6, latE6], …]. */
  segments: [number, number][][]
}
