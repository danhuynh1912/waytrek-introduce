// Điểm độ khó do cộng đồng xếp (RPC `get_difficulty_board`) — CHÉP luật hiển
// thị của app (`features/difficulty/domain/difficulty_board.dart`): app là chủ,
// đổi ở app trước rồi chép lại đây. App bày CON SỐ, không bày nhãn Dễ/Khó (chủ
// sản phẩm 4/10: nhãn quá chung chung); nhãn chỉ là đường lui khi bảng chưa tải.

export interface DifficultyScore {
  score: number
  /** 1 = khó nhất. */
  rank: number
}

/** Bảng điểm theo trailId. `count` là số cung trên bảng (để chia dải màu). */
export interface DifficultyBoard {
  byTrail: ReadonlyMap<string, DifficultyScore>
  count: number
}

/** Dòng RPC → bảng. Dòng thiếu id / điểm / hạng thì bỏ, không ném. */
export function boardFromRows(rows: readonly Record<string, unknown>[]): DifficultyBoard {
  const byTrail = new Map<string, DifficultyScore>()
  for (const r of rows) {
    const id = typeof r.trail_id === 'string' ? r.trail_id : null
    const score = typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : null
    const rank = typeof r.rank === 'number' && Number.isFinite(r.rank) ? Math.round(r.rank) : null
    if (id && score != null && rank != null) byTrail.set(id, { score, rank })
  }
  return { byTrail, count: byTrail.size }
}

/** "3,90" — hai chữ số thập phân, dấu phẩy kiểu Việt (`formatDifficultyScore` của app). */
export function formatDifficultyScore(score: number): string {
  return score.toFixed(2).replace('.', ',')
}

/**
 * Màu của cung trên DẢI độ khó, theo THỨ HẠNG chứ không theo điểm (điểm dồn
 * cục): xanh lá → vàng → cam → đỏ → tím cho cung khó nhất, như thang UV.
 * Trả chuỗi CSS `hsl()`; `dark` sáng hơn để đọc được trên nền tối.
 */
export function difficultyRankColor(rank: number, count: number, dark: boolean): string {
  const t = count <= 1 ? 1 : (count - rank) / (count - 1)
  // Dart `%` luôn ra số không âm; JS thì không — chuẩn hoá cho giống hệt.
  const hue = (((140 - 215 * Math.min(1, Math.max(0, t))) % 360) + 360) % 360
  return `hsl(${Math.round(hue * 10) / 10} 72% ${dark ? 60 : 42}%)`
}
