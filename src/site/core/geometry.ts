// Hình học lộ trình (geojson của `trail_routes`) cho trang cung. Thuần.
//
// ⚠️ Lộ trình ghi từ chuyến có TẠM DỪNG là MultiLineString — mỗi lần đi tiếp
// là một đoạn mới, và khe giữa hai đoạn là chỗ KHÔNG có dữ liệu. Luật của
// repo: gộp phẳng chỉ để tính khung nhìn / đo đạc; khi VẼ (bản đồ, biểu đồ độ
// cao) thì giữ ranh giới đoạn — nối khe lại là bịa ra một lối đi không có thật.

export type Coord = [number, number, number?]

/** Các đoạn [lng, lat, ele?] của một geojson tuyến; kiểu lạ hoặc hỏng → rỗng. */
export function segmentsOf(geojson: unknown): Coord[][] {
  const g = geojson as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown }
  if (!g || typeof g !== 'object') return []
  if (g.type === 'Feature') return segmentsOf(g.geometry)
  if (g.type === 'FeatureCollection' && Array.isArray(g.features)) return g.features.flatMap((f) => segmentsOf(f))
  const okCoord = (c: unknown): c is Coord =>
    Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' && Number.isFinite(c[0]) && Number.isFinite(c[1])
  const line = (cs: unknown): Coord[] => (Array.isArray(cs) ? cs.filter(okCoord) : [])
  if (g.type === 'LineString') {
    const l = line(g.coordinates)
    return l.length >= 2 ? [l] : []
  }
  if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
    return g.coordinates.map(line).filter((l) => l.length >= 2)
  }
  return []
}

/** Khung bao [minLng, minLat, maxLng, maxLat] — đây là chỗ DUY NHẤT được gộp phẳng. */
export function bboxOf(segs: readonly Coord[][]): [number, number, number, number] | null {
  let b: [number, number, number, number] | null = null
  for (const s of segs) {
    for (const [lng, lat] of s) {
      if (!b) b = [lng, lat, lng, lat]
      else {
        if (lng < b[0]) b[0] = lng
        if (lat < b[1]) b[1] = lat
        if (lng > b[2]) b[2] = lng
        if (lat > b[3]) b[3] = lat
      }
    }
  }
  return b
}

const R = 6_371_000
const rad = (d: number) => (d * Math.PI) / 180

/** Haversine trên cầu 6 371 km — cùng công thức `haversineMetres` của app. */
export function metresBetween(a: Coord, b: Coord): number {
  const dLat = rad(b[1] - a[1])
  const dLng = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface ProfilePoint {
  /** Mét tính từ đầu tuyến, CHỈ cộng quãng đi trong đoạn (khe không tính). */
  d: number
  ele: number
  lng: number
  lat: number
}

export interface Profile {
  /** Mỗi đoạn của tuyến một dãy điểm — vẽ thành các vùng tách rời. */
  segments: ProfilePoint[][]
  lengthM: number
  minEle: number
  maxEle: number
}

/**
 * Biểu đồ độ cao từ toạ độ thứ ba của geojson. Ngân sách điểm chia theo TỈ LỆ
 * độ dài đoạn (đoạn 20 điểm không ăn cùng phần với đoạn 8000 điểm). Tuyến
 * không có độ cao (GPX thiếu ele, hoặc mọi điểm cùng một giá trị) → null.
 */
export function profileOf(segs: readonly Coord[][], budget = 400): Profile | null {
  const raw: ProfilePoint[][] = []
  let d = 0
  for (const s of segs) {
    const out: ProfilePoint[] = []
    for (let i = 0; i < s.length; i++) {
      if (i > 0) d += metresBetween(s[i - 1], s[i])
      const ele = s[i][2]
      if (typeof ele === 'number' && Number.isFinite(ele) && ele > -500 && ele < 9000) {
        out.push({ d, ele, lng: s[i][0], lat: s[i][1] })
      }
    }
    if (out.length >= 2) raw.push(out)
  }
  if (raw.length === 0 || d <= 0) return null
  let minEle = Infinity
  let maxEle = -Infinity
  for (const s of raw) for (const p of s) {
    if (p.ele < minEle) minEle = p.ele
    if (p.ele > maxEle) maxEle = p.ele
  }
  if (maxEle - minEle < 1) return null
  const span = raw.reduce((a, s) => a + (s[s.length - 1].d - s[0].d), 0) || 1
  const segments = raw.map((s) => {
    const share = Math.max(2, Math.round((budget * (s[s.length - 1].d - s[0].d)) / span))
    if (s.length <= share) return s
    const step = (s.length - 1) / (share - 1)
    return Array.from({ length: share }, (_, k) => s[Math.round(k * step)])
  })
  return { segments, lengthM: d, minEle, maxEle }
}

/** Điểm trên biểu đồ gần mốc `d` nhất (cho con trỏ rê chuột ↔ chấm trên bản đồ). */
export function pointAtDistance(p: Profile, d: number): ProfilePoint | null {
  let best: ProfilePoint | null = null
  for (const s of p.segments) for (const q of s) {
    if (!best || Math.abs(q.d - d) < Math.abs(best.d - d)) best = q
  }
  return best
}

/** Chặng đi xe của lộ trình (`trail_routes.travel_modes`): mét dọc tuyến, KHÔNG tính khe giữa các đoạn. */
export interface TravelSpan {
  mode: string
  fromM: number
  toM: number
}

export interface DrawLine {
  coords: Coord[]
  /** Nằm trong một chặng đi xe (xe ôm / ô tô) — app tô cam. */
  vehicle: boolean
}

/**
 * Cắt các đoạn của tuyến thành nét đi bộ / nét đi xe theo mốc-mét của chặng
 * xe. Ranh giới đoạn (chỗ tạm dừng) vẫn giữ: mỗi nét nằm gọn trong một đoạn.
 * Mốc-mét đo như app: cộng dồn trong từng đoạn, khe giữa hai đoạn không tính.
 */
export function splitByTravel(segs: readonly Coord[][], spans: readonly TravelSpan[]): DrawLine[] {
  const live = spans.filter((s) => Number.isFinite(s.fromM) && Number.isFinite(s.toM) && s.toM > s.fromM)
  if (live.length === 0) return segs.map((coords) => ({ coords: [...coords], vehicle: false }))
  const inVehicle = (d: number) => live.some((s) => d >= s.fromM && d < s.toM)
  const cuts = [...new Set(live.flatMap((s) => [s.fromM, s.toM]))].sort((a, b) => a - b)
  const out: DrawLine[] = []
  let d = 0
  for (const s of segs) {
    let cur: DrawLine | null = null
    const push = (a: Coord, b: Coord, vehicle: boolean) => {
      if (!cur || cur.vehicle !== vehicle) {
        cur = { coords: [a], vehicle }
        out.push(cur)
      }
      cur.coords.push(b)
    }
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1]
      const b = s[i]
      const len = metresBetween(a, b)
      const d0 = d
      const d1 = d + len
      // Điểm cắt nằm giữa cạnh này: nội suy ra toạ độ, chia cạnh thành các khúc.
      const inner = cuts.filter((c) => c > d0 && c < d1)
      let from = a
      let fromD = d0
      for (const c of [...inner, d1]) {
        const t = len > 0 ? (c - d0) / len : 1
        const to: Coord = c === d1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] != null && b[2] != null ? a[2] + (b[2] - a[2]) * t : undefined]
        push(from, to, inVehicle((fromD + c) / 2))
        from = to
        fromD = c
      }
      d = d1
    }
  }
  return out.filter((l) => l.coords.length >= 2)
}

/**
 * Khoá hệ số khớp quãng đường công bố — CHÉP `SCALE_MIN`/`SCALE_MAX` của engine
 * lên kế hoạch (`trip-plan/engine/routes.ts`, spec/43 §5.2). Hình học GPS thô dài
 * hơn số công bố vì nhiễu lúc đứng yên; app luôn bày số CÔNG BỐ (vụ "cùng một
 * track, hai con số quãng đường"), nên mọi mốc-mét bày ra đều nhân hệ số này.
 */
export const DISTANCE_SCALE_MIN = 0.7
export const DISTANCE_SCALE_MAX = 1.3

/** Biểu đồ độ cao với trục quãng đường khớp số công bố của lộ trình. Không có số công bố → giữ nguyên. */
export function scaleProfile(p: Profile, publishedM: number | null): Profile {
  if (publishedM == null || !(publishedM > 0) || !(p.lengthM > 0)) return p
  const k = Math.min(DISTANCE_SCALE_MAX, Math.max(DISTANCE_SCALE_MIN, publishedM / p.lengthM))
  return {
    ...p,
    lengthM: p.lengthM * k,
    segments: p.segments.map((s) => s.map((q) => ({ ...q, d: q.d * k }))),
  }
}
