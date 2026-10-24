// Tìm đỉnh theo tên — bỏ dấu ở CẢ HAI vế, như ô tìm cung của app
// (`core/utils/search_text.dart`): "ky quan" phải ra "Kỳ Quan San".

import type { PeakCombo, TrailPin } from './types.ts'

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Khớp đầu tên trước, rồi đầu một từ, rồi chứa ở giữa; vùng chỉ là vế phụ. */
export function searchTrails(trails: readonly TrailPin[], query: string, limit = 8): TrailPin[] {
  const q = fold(query)
  if (!q) return []
  const scored: { t: TrailPin; score: number }[] = []
  for (const t of trails) {
    const name = fold(t.name)
    let score = -1
    if (name.startsWith(q)) score = 0
    else if (name.includes(` ${q}`)) score = 1
    else if (name.includes(q)) score = 2
    else if (t.region && fold(t.region).includes(q)) score = 3
    if (score >= 0) scored.push({ t, score })
  }
  scored.sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name, 'vi'))
  return scored.slice(0, limit).map((s) => s.t)
}

/**
 * Danh sách của hộp Tìm: đỉnh đã chọn đứng đầu (theo thứ tự chọn — cũng là thứ
 * tự thêm vào kế hoạch), rồi tới phần còn lại: ô tìm trống thì TOÀN BỘ cung theo
 * tên, có chữ thì kết quả tìm. Đỉnh đã chọn luôn hiện dù không khớp chữ đang gõ.
 */
export function pickerList(
  trails: readonly TrailPin[],
  query: string,
  selected: readonly string[],
): { picked: TrailPin[]; rest: TrailPin[] } {
  const byId = new Map(trails.map((t) => [t.trailId, t]))
  const picked = selected.map((id) => byId.get(id)).filter((t): t is TrailPin => t != null)
  const taken = new Set(selected)
  const pool = fold(query)
    ? searchTrails(trails, query, Infinity)
    : [...trails].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  return { picked, rest: pool.filter((t) => !taken.has(t.trailId)) }
}

/** Combo → các đỉnh có thật trong danh mục (bỏ cung đã ẩn / chưa có đỉnh); dưới 2 đỉnh thì bỏ combo. */
export function resolveCombos(
  combos: readonly PeakCombo[],
  trails: readonly TrailPin[],
): { combo: PeakCombo; peaks: TrailPin[] }[] {
  const byId = new Map(trails.map((t) => [t.trailId, t]))
  return combos
    .map((combo) => ({
      combo,
      peaks: combo.trailIds.map((id) => byId.get(id)).filter((t): t is TrailPin => t != null && t.hasPeak),
    }))
    .filter((c) => c.peaks.length >= 2)
}

/**
 * Bấm một combo: chưa chọn đủ thì thêm các đỉnh còn thiếu (theo thứ tự combo,
 * sau những đỉnh đã chọn); đã chọn đủ thì bỏ hết các đỉnh của combo.
 */
export function toggleCombo(selected: readonly string[], peakIds: readonly string[]): string[] {
  const has = new Set(selected)
  if (peakIds.every((id) => has.has(id))) {
    const drop = new Set(peakIds)
    return selected.filter((id) => !drop.has(id))
  }
  return [...selected, ...peakIds.filter((id) => !has.has(id))]
}
