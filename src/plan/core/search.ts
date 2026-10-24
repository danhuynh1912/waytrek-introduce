// Tìm đỉnh theo tên — bỏ dấu ở CẢ HAI vế, như ô tìm cung của app
// (`core/utils/search_text.dart`): "ky quan" phải ra "Kỳ Quan San".

import type { TrailPin } from './types.ts'

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
