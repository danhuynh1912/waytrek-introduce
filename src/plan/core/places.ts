// Địa điểm người dùng ĐÃ CHỌN ở ô Tìm: nhớ trên máy để lần sau gõ là gợi ý
// ngay, không tốn lượt tìm của ORS (hạn mức theo ngày). Thuần — chỗ đọc/ghi
// localStorage nằm ở data/recent-places.ts.

import { fold } from '../../shared/text.ts'
import type { Place } from './types.ts'

export const RECENT_PLACES_MAX = 30
/** Gõ ít hơn chừng này ký tự thì không gọi máy chủ (chỉ gợi ý từ chỗ đã chọn). */
export const GEOCODE_MIN_CHARS = 3

function isPlace(x: unknown): x is Place {
  const p = x as Place
  return !!p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.label === 'string' &&
    Number.isFinite(p.lat) && Number.isFinite(p.lon)
}

/** Dữ liệu trên máy có thể hỏng / từ bản cũ: bỏ mục sai, không ném. */
export function parseRecentPlaces(raw: string | null): Place[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter(isPlace).slice(0, RECENT_PLACES_MAX) : []
  } catch {
    return []
  }
}

/** Chọn một địa điểm: đưa lên đầu, bỏ bản trùng, cắt ở trần. */
export function rememberPlace(list: readonly Place[], p: Place): Place[] {
  return [p, ...list.filter((x) => x.id !== p.id)].slice(0, RECENT_PLACES_MAX)
}

/** Chỗ đã chọn khớp chữ đang gõ (bỏ dấu, theo tên hoặc nhãn); ô trống thì vài chỗ gần đây nhất. */
export function matchRecentPlaces(list: readonly Place[], query: string, limit = 5): Place[] {
  const q = fold(query)
  if (!q) return list.slice(0, limit)
  return list.filter((p) => fold(p.name).includes(q) || fold(p.label).includes(q)).slice(0, limit)
}

/** Kết quả máy chủ trừ những chỗ đã hiện ở phần "đã chọn trước đây". */
export function freshPlaces(remote: readonly Place[], shown: readonly Place[]): Place[] {
  const ids = new Set(shown.map((p) => p.id))
  return remote.filter((p) => !ids.has(p.id))
}
