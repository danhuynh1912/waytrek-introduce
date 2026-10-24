// Địa điểm đã chọn ở ô Tìm — localStorage của trình duyệt, tiện ích theo máy.
// Không đọc/ghi được (riêng tư, bị chặn) thì chỉ là không có gợi ý, không lỗi.

import { parseRecentPlaces, rememberPlace } from '../core/places'
import type { Place } from '../core/types'

const KEY = 'wt-plan:recent-places'

export function loadRecentPlaces(): Place[] {
  try {
    return parseRecentPlaces(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

export function saveRecentPlace(p: Place): Place[] {
  const next = rememberPlace(loadRecentPlaces(), p)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch (e) {
    console.warn('plan: không lưu được địa điểm đã chọn —', e)
  }
  return next
}
