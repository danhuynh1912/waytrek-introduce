// Kéo một điểm sang ngày khác trên dòng thời gian (chủ sản phẩm 26/10): ngày
// ĐANG THẤY của từng điểm, và mọi chỗ thả được. Phép đổi doc nằm ở
// `moveToDay` (doc.ts); ở đây chỉ đọc dòng thời gian.

import type { DaySlot } from './doc.ts'
import type { Row } from './timeline.ts'

export interface DropSlot extends DaySlot {
  /**
   * Dòng mà vạch chèn vẽ ngay TRÊN nó: `wp:<id>` (dòng của một điểm) hoặc
   * `day:<n>` (tiêu đề ngày — thả ở cuối ngày trước đó); null = cuối danh sách.
   */
  anchor: string | null
}

export interface DayLayout {
  /** Id các điểm theo thứ tự trên dòng thời gian. */
  order: string[]
  /** Ngày đang thấy của từng điểm, theo id. */
  dayOf: Map<string, number>
  /** Mọi chỗ thả, theo thứ tự trên màn (gồm cả chỗ của chính điểm đang kéo). */
  slots: DropSlot[]
}

/**
 * Đọc ngày của từng điểm và các chỗ thả từ dòng thời gian. Giữa hai điểm liền
 * nhau thả được vào MỌI ngày mà khoảng đó trải qua; ngay sau một điểm "Nghỉ đêm
 * ở đây" thì không còn chỗ trong ngày của nó — đêm đó khép ngày lại.
 */
export function dayLayout(rows: readonly Row[]): DayLayout {
  const points: { id: string; day: number; rest: boolean }[] = []
  const heads = new Set<number>()
  let day = 0
  for (const r of rows) {
    if (r.type === 'day') {
      day = r.day.index
      heads.add(day)
    } else if (r.type === 'stop') points.push({ id: r.wp.id, day, rest: r.wp.rest })
  }
  const n = points.length
  const lastDay = points.length > 0 ? Math.max(day, points[n - 1].day) : day
  const slots: DropSlot[] = []
  const endOf = (d: number): string | null => (heads.has(d + 1) ? `day:${d + 1}` : null)
  for (let s = 0; s <= n; s++) {
    const prev = s > 0 ? points[s - 1] : null
    const next = s < n ? points[s] : null
    if (!prev) {
      if (next) slots.push({ index: 0, day: next.day, anchor: `wp:${next.id}` })
      continue
    }
    const middle = s - 1 > 0 && s - 1 < n - 1
    const lo = prev.day + (prev.rest && middle ? 1 : 0)
    const hi = next ? next.day : lastDay
    for (let d = lo; d <= hi; d++) {
      slots.push({ index: s, day: d, anchor: next && next.day === d ? `wp:${next.id}` : endOf(d) })
    }
  }
  return { order: points.map((p) => p.id), dayOf: new Map(points.map((p) => [p.id, p.day])), slots }
}

/** Thả điểm `id` vào `slot` có phải là để nguyên chỗ cũ không (cùng thứ tự, cùng ngày). */
export function isHomeSlot(layout: DayLayout, id: string, slot: DaySlot): boolean {
  const p = layout.order.indexOf(id)
  return (slot.index === p || slot.index === p + 1) && slot.day === layout.dayOf.get(id)
}

/** Chỗ thả gần vị trí `y` nhất; `ys[i]` là toạ độ dọc của vạch chèn của `slots[i]`. */
export function nearestSlot(ys: readonly number[], y: number): number {
  let best = -1
  let bestD = Infinity
  ys.forEach((v, i) => {
    const d = Math.abs(v - y)
    if (d < bestD) {
      best = i
      bestD = d
    }
  })
  return best
}
