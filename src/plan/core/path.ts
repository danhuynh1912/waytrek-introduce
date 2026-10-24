import type { DrawPiece, PlanResult } from './types.ts'

/**
 * Tab "Waypoints" (kiểu komoot): bao nhiêu km theo từng LOẠI đường — đi xe, xe
 * ôm, lộ trình WayTrek, lối mòn OSM, chưa có lối. Chỉ cộng số máy chủ đã đo
 * cho từng mảnh vẽ, không tính lại.
 */
export type PathKind = 'vehicle' | 'moto' | 'route' | 'path' | 'straight'

function kindOf(d: DrawPiece): PathKind {
  return d.kind === 'vehicle' && d.moto ? 'moto' : d.kind
}

export interface WayType {
  kind: PathKind
  distanceM: number
  /** Phần trăm của tổng quãng đường, đã làm tròn. */
  pct: number
}

/** Tổng quãng đường theo loại đường (kiểu "Way types" của komoot), dài nhất trước. */
export function wayTypes(result: PlanResult | null): WayType[] {
  const by = new Map<PathKind, number>()
  for (const leg of result?.legs ?? []) {
    for (const d of leg.draw) by.set(kindOf(d), (by.get(kindOf(d)) ?? 0) + (d.distanceM ?? 0))
  }
  const total = [...by.values()].reduce((a, b) => a + b, 0)
  return [...by.entries()]
    .filter(([, m]) => m > 0)
    .map(([kind, distanceM]) => ({ kind, distanceM, pct: total > 0 ? Math.round((distanceM / total) * 100) : 0 }))
    .sort((a, b) => b.distanceM - a.distanceM)
}

export interface PathDetails {
  /** Tốc độ đi bộ trung bình (km/h) — quãng đi bộ ÷ phút đi bộ, không tính xe. */
  walkKmh: number | null
  highestM: number | null
  lowestM: number | null
}

export function pathDetails(result: PlanResult | null): PathDetails {
  if (!result) return { walkKmh: null, highestM: null, lowestM: null }
  const t = result.totals
  const eles = result.profile.ele.filter((e): e is number => e != null)
  return {
    walkKmh: t.walkMin > 0 && t.walkDistanceM > 0 ? (t.walkDistanceM / 1000) / (t.walkMin / 60) : null,
    highestM: t.maxEleM ?? (eles.length ? Math.max(...eles) : null),
    lowestM: eles.length ? Math.min(...eles) : null,
  }
}
