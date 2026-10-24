// Câu chữ của cảnh báo (spec/43 §6.1). Máy chủ quyết ĐIỀU GÌ xảy ra (mã cảnh
// báo + số liệu); ở đây chỉ quyết nói nó thế nào. Không gộp các cờ thành một
// con số "an toàn %" — đó đúng là thứ spec đã bỏ.

import { clock, distance, duration, meters } from './format.ts'
import type { DayWarning, ResultLeg } from './types.ts'

/** danger: cần ra tay · warn: nên biết · info: nhắc chuẩn bị. */
export type Level = 'danger' | 'warn' | 'info'

export interface Note {
  level: Level
  text: string
}

/** `nameOf`: tên điểm theo id — cảnh báo nói về một điểm thì gọi đúng tên nó. */
export function dayNote(w: DayWarning, nameOf: (id: string) => string | undefined = () => undefined): Note {
  switch (w.code) {
    case 'afterDark':
      return {
        level: 'danger',
        text: `Tới nơi ${clock(w.arriveMin)}, quá giờ an toàn ${clock(w.limitMin)}. Hoàng hôn ${clock(w.sunsetMin)} — trong rừng tối sớm hơn.`,
      }
    case 'driveAfterDark':
      return { level: 'warn', text: `Đi xe tới nơi ${clock(w.arriveMin)}, sau hoàng hôn (${clock(w.sunsetMin)}).` }
    case 'tooLong': {
      const over = `Đi bộ ${duration(w.walkMin)} trong ngày — quá ${duration(w.capMin)}${w.capMin > 8 * 60 ? ' của ngày lên đỉnh từ lán' : ''}`
      // Lố ít mà vẫn kịp trước tối: engine cố ý đi nốt thay vì dừng giữa đường.
      return w.pushOn
        ? { level: 'warn', text: `${over}. Vẫn tới nơi trước giờ an toàn nên đi nốt, không dừng giữa đường.` }
        : { level: 'danger', text: `${over}.` }
    }
    case 'anchorLate': {
      const name = nameOf(w.stopId)
      return {
        level: 'warn',
        text: `${name ? `${name}: ` : ''}tới khoảng ${clock(w.etaMin)}, không kịp mốc ${clock(w.targetMin)} — muốn kịp phải nghỉ đêm gần hơn.`,
      }
    }
    case 'campZone':
      return { level: 'warn', text: 'Không có lán nào trên đoạn này — nghỉ đêm trong vùng nên nghỉ, mang lều.' }
    case 'noRestKnown':
      return {
        level: 'danger',
        text: 'Chưa có lán nào được ghi nhận trên đoạn này. Tick "Nghỉ đêm ở đây" ở một điểm bạn biết nghỉ được.',
      }
    case 'restDismissed':
      return {
        level: 'danger',
        text: 'Bạn đã bỏ lán tự chọn. Chọn một chỗ nghỉ khác, hoặc tick "Nghỉ đêm ở đây" ở một điểm.',
      }
    case 'departShifted':
      return { level: 'info', text: `Dời giờ đi sớm từ ${clock(w.fromMin)} lên ${clock(w.toMin)} để kịp trước tối.` }
    case 'departSuggest':
      return { level: 'warn', text: `Nên khởi hành ${clock(w.toMin)} để kịp trước tối.` }
    case 'darkStart':
      return { level: 'info', text: `Đi trước lúc mặt trời mọc (${clock(w.sunriseMin)}) — cần đèn pin.` }
    case 'noWater':
      return { level: 'info', text: 'Không qua nguồn nước nào đã biết — mang đủ nước.' }
    case 'cold':
      return { level: 'info', text: `Lên tới ${meters(w.maxEleM)} — đêm có thể rất lạnh.` }
  }
}

/** Mức "đường đã biết" của một chặng đi bộ (spec/43 §6.1). */
export function knownNote(leg: ResultLeg): Note | null {
  if (leg.transport === 'vehicle') return null
  if (leg.knownPct >= 90) return { level: 'info', text: 'Có lối đã biết' }
  if (leg.knownPct >= 50) return { level: 'warn', text: `${distance(leg.unknownM)} chưa có lối đã biết` }
  return { level: 'danger', text: 'Phần lớn đoạn này chưa ai đi qua trong dữ liệu của WayTrek' }
}

export function legFlagNotes(leg: ResultLeg): Note[] {
  const out: Note[] = []
  if (leg.flags.includes('steep')) out.push({ level: 'warn', text: 'Có đoạn dốc trên 35%' })
  if (leg.flags.includes('noElevation')) {
    out.push({ level: 'warn', text: 'Thiếu dữ liệu độ cao — giờ đi đã cộng thêm 30%' })
  }
  return out
}

const ORDER: Record<Level, number> = { danger: 0, warn: 1, info: 2 }

export function byLevel(a: Note, b: Note): number {
  return ORDER[a.level] - ORDER[b.level]
}
