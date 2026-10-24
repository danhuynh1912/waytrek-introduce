// Danh mục cung trên web: kiểu dữ liệu, tìm + xếp, dòng số đo. Thuần.
// Độ khó HIỂN THỊ là điểm của bảng cộng đồng (`core/difficulty.ts`), như app;
// nhãn Dễ/Khó ở đây chỉ là đường lui khi bảng điểm chưa tải được — chép từ app
// (`app_vi.arb` difficulty*, `Trail.difficultyLabel`).

import { distance, meters } from '../../shared/format.ts'
import { fold } from '../../shared/text.ts'
import type { DifficultyBoard } from './difficulty.ts'

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'expert'

export interface TrailSummary {
  id: string
  name: string
  region: string | null
  difficulty: Difficulty
  /** `trails.difficulty_title`: 'superhuman' cho tầng "Siêu nhân". */
  difficultyTitle: string | null
  distanceM: number | null
  gainM: number | null
  peakEleM: number | null
  imageUrl: string | null
  conquests: number
  /** Toạ độ ghim trên bản đồ: đỉnh nếu có, không thì tâm lộ trình. */
  lat: number | null
  lng: number | null
  description: string | null
}

const LABEL: Record<Difficulty, string> = {
  easy: 'Dễ',
  moderate: 'Trung bình',
  hard: 'Khó',
  expert: 'Chuyên gia',
}

export function difficultyLabel(t: Pick<TrailSummary, 'difficulty' | 'difficultyTitle'>): string {
  return t.difficultyTitle === 'superhuman' ? 'Siêu nhân' : LABEL[t.difficulty] ?? 'Trung bình'
}

/** Số đo của cung: "7,2 km · ↑2.063 m" (điểm độ khó vẽ riêng, có màu). Thiếu số nào thì bỏ số đó, không ghi 0. */
export function trailMeta(t: TrailSummary): string {
  return [t.distanceM != null ? distance(t.distanceM) : null, t.gainM != null ? `↑${meters(t.gainM)}` : null]
    .filter(Boolean)
    .join(' · ')
}

/** Một dòng của view `trails_with_default_route` → TrailSummary. Dòng hỏng thì null. */
export function trailFromRow(r: Record<string, unknown>): TrailSummary | null {
  const id = typeof r.id === 'string' ? r.id : null
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!id || !name) return null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const d = r.difficulty
  const difficulty: Difficulty = d === 'easy' || d === 'moderate' || d === 'hard' || d === 'expert' ? d : 'moderate'
  return {
    id,
    name,
    region: str(r.region),
    difficulty,
    difficultyTitle: str(r.difficulty_title),
    distanceM: num(r.distance_m),
    // Độ leo "hiệu dụng" là số app bày trên thẻ cung (đã bù hướng ghi lúc đi xuống).
    gainM: num(r.effective_elevation_gain_m) ?? num(r.elevation_gain_m),
    peakEleM: num(r.peak_elevation_m) ?? num(r.gpx_max_elevation_m),
    imageUrl: str(r.image_url),
    conquests: num(r.conquest_count) ?? 0,
    lat: num(r.peak_lat) ?? num(r.center_lat),
    lng: num(r.peak_lng) ?? num(r.center_lng),
    description: str(r.description),
  }
}

export type TrailSort = 'popular' | 'hardest' | 'easiest' | 'high' | 'short' | 'name'

export interface TrailFilter {
  query: string
  sort: TrailSort
}

export const DEFAULT_FILTER: TrailFilter = { query: '', sort: 'popular' }

/**
 * Tìm bỏ dấu ở cả hai vế (như ô tìm cung của app), rồi xếp. Xếp theo độ khó
 * dùng điểm của bảng cộng đồng; cung thiếu số đo / chưa có điểm đứng cuối khi
 * xếp theo số đó — không bị coi là 0.
 */
export function filterTrails(list: readonly TrailSummary[], f: TrailFilter, board: DifficultyBoard | null = null): TrailSummary[] {
  const q = fold(f.query)
  const out = list.filter((t) => !q || fold(t.name).includes(q) || (t.region != null && fold(t.region).includes(q)))
  const score = (t: TrailSummary) => board?.byTrail.get(t.id)?.score ?? null
  const byName = (a: TrailSummary, b: TrailSummary) => a.name.localeCompare(b.name, 'vi')
  const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) =>
    a == null ? (b == null ? 0 : 1) : b == null ? -1 : (a - b) * dir
  switch (f.sort) {
    case 'popular':
      return out.sort((a, b) => b.conquests - a.conquests || byName(a, b))
    case 'hardest':
      return out.sort((a, b) => nullsLast(score(a), score(b), -1) || byName(a, b))
    case 'easiest':
      return out.sort((a, b) => nullsLast(score(a), score(b), 1) || byName(a, b))
    case 'name':
      return out.sort(byName)
    case 'short':
      return out.sort((a, b) => nullsLast(a.distanceM, b.distanceM, 1) || byName(a, b))
    case 'high':
      return out.sort((a, b) => nullsLast(a.peakEleM, b.peakEleM, -1) || byName(a, b))
  }
}
