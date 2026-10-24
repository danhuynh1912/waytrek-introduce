// Đang mở trên máy nào — để chọn nút đúng (App Store / CH Play / mở app).

export type Platform = 'ios' | 'android' | 'other'

export function detectPlatform(ua: string): Platform {
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPadOS báo mình là Mac — phân biệt bằng màn cảm ứng.
  if (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios'
  return 'other'
}
