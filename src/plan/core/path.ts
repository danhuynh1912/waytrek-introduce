import type { PointTarget } from './doc.ts'
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

/**
 * Thay đổi đang soạn ở danh sách "Các điểm" (chủ sản phẩm 26/10): kéo đổi thứ
 * tự, bỏ điểm — chưa đụng tới kế hoạch cho tới khi bấm "Áp dụng".
 */
export interface PointsDraft {
  /** Thứ tự đang xếp (id). */
  order: string[]
  /** Điểm đã bấm bỏ. */
  removed: string[]
  /** "Thay thế bằng…" đã chọn mà chưa áp dụng: id → chỗ mới. */
  replaced?: Readonly<Record<string, PointTarget>>
}

/**
 * Danh sách đang hiện = bản soạn đặt lên kế hoạch hiện tại. Kế hoạch đổi trong
 * lúc soạn (thêm điểm trên bản đồ, bỏ điểm ở chỗ khác) thì bản soạn tự khớp
 * lại — điểm mới nối vào cuối, điểm đã mất thì thôi — chứ không lặng lẽ mất
 * những gì người dùng đã xếp.
 */
export function draftPoints(ids: readonly string[], draft: PointsDraft | null): string[] {
  if (!draft) return [...ids]
  const live = new Set(ids)
  const gone = new Set(draft.removed)
  const kept = draft.order.filter((id) => live.has(id) && !gone.has(id))
  const seen = new Set(kept)
  return [...kept, ...ids.filter((id) => !seen.has(id) && !gone.has(id))]
}

/**
 * Danh sách đang hiện khác kế hoạch chưa — nút "Áp dụng" chỉ sáng khi có. Có
 * điểm đang chờ thay ([swaps]) cũng là khác.
 */
export function draftChanged(
  ids: readonly string[],
  shown: readonly string[],
  swaps?: ReadonlyMap<string, PointTarget>,
): boolean {
  return (swaps?.size ?? 0) > 0 || shown.length !== ids.length || shown.some((id, k) => id !== ids[k])
}

/** Ghi một "Thay thế bằng…" vào bản soạn — kế hoạch chưa đổi. */
export function stageReplacement(
  ids: readonly string[],
  draft: PointsDraft | null,
  id: string,
  to: PointTarget,
): PointsDraft {
  return {
    order: draftPoints(ids, draft),
    removed: draft?.removed ?? [],
    replaced: { ...draft?.replaced, [id]: to },
  }
}

/**
 * Các thay thế còn áp được, theo thứ tự đang hiện: điểm đã bấm bỏ hay đã mất
 * khỏi kế hoạch thì thôi.
 */
export function draftReplacements(shown: readonly string[], draft: PointsDraft | null): Map<string, PointTarget> {
  const out = new Map<string, PointTarget>()
  for (const id of shown) {
    const to = draft?.replaced?.[id]
    if (to) out.set(id, to)
  }
  return out
}
