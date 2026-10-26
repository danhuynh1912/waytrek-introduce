// Câu chữ của cảnh báo (spec/43 §6.1). Máy chủ quyết ĐIỀU GÌ xảy ra (mã cảnh
// báo + số liệu); ở đây chỉ quyết nói nó thế nào. Không gộp các cờ thành một
// con số "an toàn %" — đó đúng là thứ spec đã bỏ.

import { clock, distance, duration, meters } from '../../shared/format.ts'
import type { DayWarning, PlanResult, ResultDay, ResultLeg, ResultStop } from './types.ts'

/** danger: cần ra tay · warn: nên biết · info: nhắc chuẩn bị. */
export type Level = 'danger' | 'warn' | 'info'

export interface Note {
  level: Level
  text: string
}

/** `nameOf`: tên điểm theo id — cảnh báo nói về một điểm thì gọi đúng tên nó. */
export function dayNote(w: DayWarning, nameOf: (id: string) => string | undefined = () => undefined): Note | null {
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
    // Tới nơi muộn hơn giờ xuất phát đã đặt (điểm trước dời muộn): không cảnh báo
    // — người dùng vừa tự đổi, giờ đi ở đó thành dự tính (chủ sản phẩm 26/10), và
    // giờ đặt sẵn tự bỏ (`dropLateDepartures`).
    case 'departLate':
      return null
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
    default:
      // Mã của một engine mới hơn bản web đang chạy (kết quả lưu từ app mới
      // hơn, bundle cũ trong bộ nhớ đệm): bỏ qua thì danh sách cảnh báo vẫn
      // sắp được — trả undefined là cả màn trắng (review 26/10).
      return null
  }
}

/** Mức "đường đã biết" của một chặng đi bộ (spec/43 §6.1). */
/** Chặng xe: đoạn nối không lối ngắn hơn mức này (ra đường đón xe, xuống xe vào điểm) không cảnh báo. */
export const VEHICLE_JOIN_OK_M = 300

/**
 * Chặng đi bộ: đoạn không lối ngắn hơn mức này không cảnh báo — bước từ điểm
 * tự chấm (nhà, khách sạn giữa phố) ra con đường gần nhất, cỡ sai số GPS.
 */
export const WALK_JOIN_OK_M = 100

export function knownNote(leg: ResultLeg): Note | null {
  if (leg.transport === 'vehicle' && !leg.flags.includes('mappedPath') && leg.unknownM < VEHICLE_JOIN_OK_M) return null
  if (leg.transport === 'walk' && !leg.flags.includes('mappedPath') && leg.unknownM > 0 && leg.unknownM < WALK_JOIN_OK_M) {
    return null
  }
  if (leg.knownPct >= 90) return { level: 'info', text: 'Có lối đã biết' }
  // Lối mòn OSM: có lối trên bản đồ nhưng chưa ai đi trong dữ liệu WayTrek.
  if (leg.flags.includes('unknownPath')) {
    return {
      level: 'danger',
      text: `${distance(leg.unknownM)} không có lối nào trên bản đồ — nét kẻ thẳng chỉ để ước giờ, không phải đường đi. Đừng đi theo nó.`,
    }
  }
  if (leg.flags.includes('mappedPath')) {
    return {
      level: 'warn',
      text: leg.unknownM > 0
        ? `Đi theo lối mòn trên bản đồ OpenStreetMap, ${distance(leg.unknownM)} không có lối nào — hỏi người địa phương trước khi đi`
        : 'Đi theo lối mòn trên bản đồ OpenStreetMap — chưa ai đi trong dữ liệu WayTrek',
    }
  }
  if (leg.knownPct >= 50 || leg.flags.includes('partialPath')) {
    return { level: 'warn', text: `${distance(leg.unknownM)} chưa có lối đã biết` }
  }
  return { level: 'danger', text: 'Phần lớn đoạn này chưa ai đi qua trong dữ liệu của WayTrek' }
}

export function legFlagNotes(leg: ResultLeg): Note[] {
  const out: Note[] = []
  if (leg.flags.includes('noRoadRoute')) {
    out.push({ level: 'warn', text: 'Chưa tìm được đường xe — giờ đi xe đang ước theo đường chim bay' })
  }
  if (leg.flags.includes('motoTaxi')) {
    out.push({ level: 'info', text: 'Có đoạn đi xe ôm theo lộ trình — người đi trước đã đi xe máy ở đoạn này' })
  }
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

/** Một hậu quả nặng của lịch: ngày đi bộ quá sức, hoặc tới nơi sau giờ an toàn. */
type Hard =
  | Extract<DayWarning, { code: 'afterDark' }>
  | Extract<DayWarning, { code: 'tooLong' }>

function hardOf(result: PlanResult): { day: number; w: Hard }[] {
  return result.days.flatMap((d) =>
    d.warnings.flatMap((w) =>
      w.code === 'afterDark' || (w.code === 'tooLong' && !w.pushOn) ? [{ day: d.index, w }] : []
    )
  )
}

/** Tổng số phút lố: đi bộ quá trần + tới nơi sau giờ an toàn. */
function excessMin(list: { w: Hard }[]): number {
  return list.reduce((t, { w }) => t + (w.code === 'tooLong' ? w.walkMin - w.capMin : w.arriveMin - w.limitMin), 0)
}

/** Chênh dưới mức này (phút lố) coi như không nặng thêm — giờ tính lại xê dịch vài phút. */
const STRAIN_SLACK_MIN = 15

/**
 * Lịch mới có NẶNG hơn lịch cũ không — thêm ngày đi bộ quá sức hoặc tới nơi sau
 * giờ an toàn, hoặc lố nhiều hơn (chủ sản phẩm 26/10: kéo điểm sang ngày khác
 * mà lịch thành quá gắt thì hỏi lại). Trả về các hậu quả của lịch mới, nói
 * ngắn gọn từng ngày; null = không nặng thêm. Số ngày đếm như dòng thời gian
 * (có Ngày 0 khi đi xe tối hôm trước).
 */
export function addedStrain(before: PlanResult | null, after: PlanResult): string[] | null {
  const now = hardOf(after)
  const was = before ? hardOf(before) : []
  if (now.length <= was.length && excessMin(now) <= excessMin(was) + STRAIN_SLACK_MIN) return null
  const first = after.days.some((d) => d.transfer) ? 0 : 1
  return now.map(({ day, w }) =>
    w.code === 'tooLong'
      ? `Ngày ${day + first}: đi bộ ${duration(w.walkMin)}, quá ${duration(w.capMin)} — dễ đuối sức, dễ chấn thương.`
      : `Ngày ${day + first}: tới nơi ${clock(w.arriveMin)}, sau giờ an toàn ${clock(w.limitMin)} — phải đi trong tối.`
  )
}

/**
 * Điểm vừa được đặt giờ có mặt (`match`) mà giờ đó sau giờ an toàn của ngày,
 * VÀ điểm đó nằm trên đường đi bộ: có chặng đi bộ tới nó, hoặc đi bộ tiếp từ nó
 * trong cùng ngày (cung trek, chân núi — ngày có cảnh báo `afterDark`). Điểm chỉ
 * đi xe tới mà sau đó không đi bộ nữa (khách sạn, bến xe) tới muộn là việc của
 * người dùng: không hỏi (chủ sản phẩm 26/10). null = không cần hỏi.
 */
export function lateArrivalOf(
  result: PlanResult,
  match: (s: ResultStop) => boolean,
): { stop: ResultStop; day: ResultDay } | null {
  const stop = result.stops.find(match)
  if (!stop || stop.targetMin == null) return null
  const day = result.days.find((d) => d.index === stop.day)
  if (!day || day.limitMin == null || stop.targetMin <= day.limitMin) return null
  if (!day.warnings.some((w) => w.code === 'afterDark')) return null
  return walksAt(result, stop) ? { stop, day } : null
}

/** Đi bộ tới `stop`, hoặc đi bộ tiếp từ nó trong cùng ngày (không phải chỗ ngủ). */
function walksAt(result: PlanResult, stop: ResultStop): boolean {
  if (result.legs.some((l) => l.to === stop.id && l.transport === 'walk')) return true
  return !stop.rest && result.legs.some((l) => l.from === stop.id && l.transport === 'walk')
}
