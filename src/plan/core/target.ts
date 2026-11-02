// Thời gian leo mục tiêu (spec/48 của repo WayTrek). Máy chủ quyết chia ngày thế
// nào (`PlanResult.target`); ở đây chỉ quyết nói nó thế nào — câu chữ giống từng
// chữ với app (`PlanText.targetDays` / `targetNote` của way_trek).

import type { PlanTarget } from './types.ts'

/** Mức hay dùng ở ô chọn: đi trong ngày, 2N1Đ, 3N2Đ — cả ô giữ ≤ 5 lựa chọn. */
export const TARGET_PRESETS = [1, 2, 3] as const

/** "Hệ thống tự tính", "1 ngày", "3 ngày 2 đêm". */
export function targetDaysLabel(days: number | null | undefined): string {
  if (days == null) return 'Hệ thống tự tính'
  return days === 1 ? '1 ngày' : `${days} ngày ${days - 1} đêm`
}

/**
 * Câu nói kết quả — chỉ khi KHÔNG chia được đúng số ngày đã chọn. Kịp, hay kịp
 * mà phải gồng, thì im lặng: người dùng tự chọn số ngày nên biết nó căng thế nào
 * (chủ sản phẩm 2/11); ngày gồng vẫn có cảnh báo riêng trong khối của ngày đó.
 */
export function targetNote(target: PlanTarget): string | null {
  if (target.status !== 'impossible') return null
  switch (target.reason) {
    case 'fixedNights':
      return `Các đêm bạn tự xếp đã thành ${target.actualDays} ngày.`
    case 'noRestPlace':
      return 'Không còn lán hay bản nào để ngủ thêm một đêm.'
    case 'overnight':
      return `Leo trong ${target.days} ngày thì phải đi xuyên đêm.`
    default:
      return `Quãng đi chỉ đủ chia tối đa ${target.actualDays} ngày.`
  }
}

/**
 * Số ngày nên đặt — nút DUY NHẤT của kết quả (chủ sản phẩm 2/11: "Đặt N ngày"
 * đứng cạnh "Về tự tính" ra cùng một kế hoạch, người dùng rối). Gồng: số máy tự
 * tính; không chia nổi: số ngày chia được. Hết chỗ ngủ thì cách gỡ là mang lều,
 * không phải số ngày.
 */
export function targetSuggestDays(target: PlanTarget): number | null {
  switch (target.status) {
    case 'met':
      return null
    case 'strained':
      return target.suggestDays ?? null
    case 'impossible':
      return target.reason === 'noRestPlace' || target.actualDays === target.days ? null : target.actualDays
  }
}

/** "Gợi ý: 8 ngày 7 đêm". */
export function suggestLabel(days: number): string {
  return `Gợi ý: ${targetDaysLabel(days)}`
}
