// Thời gian leo mục tiêu (spec/48 của repo WayTrek). Máy chủ quyết chia ngày thế
// nào (`PlanResult.target`); ở đây chỉ quyết nói nó thế nào — câu chữ giống từng
// chữ với app (`PlanText.targetDays` / `targetNote` của way_trek).

import { pace } from '../../shared/format.ts'
import type { PlanTarget } from './types.ts'

/** Mức hay dùng ở ô chọn: đi trong ngày, 2N1Đ, 3N2Đ — cả ô giữ ≤ 5 lựa chọn. */
export const TARGET_PRESETS = [1, 2, 3] as const

/** "Hệ thống tự tính", "1 ngày", "3 ngày 2 đêm". */
export function targetDaysLabel(days: number | null | undefined): string {
  if (days == null) return 'Hệ thống tự tính'
  return days === 1 ? '1 ngày' : `${days} ngày ${days - 1} đêm`
}

/** Câu nói kết quả; null khi kịp — số ngày ở khối tổng đã nói đủ. */
export function targetNote(target: PlanTarget): string | null {
  switch (target.status) {
    case 'met':
      return null
    case 'strained': {
      const base = `Leo trong ${target.days} ngày thì ${target.strainedDays.length} ngày phải đi quá sức an toàn.`
      return target.paceNeeded == null ? base : `${base} Hoặc đi nhanh hơn: tốc độ từ ${pace(target.paceNeeded)}.`
    }
    case 'impossible':
      switch (target.reason) {
        case 'fixedNights':
          return `Các đêm bạn tự xếp đã thành ${target.actualDays} ngày.`
        case 'noRestPlace':
          return 'Không còn lán hay bản nào để ngủ thêm một đêm.'
        default:
          return `Quãng đi chỉ đủ chia tối đa ${target.actualDays} ngày.`
      }
  }
}
