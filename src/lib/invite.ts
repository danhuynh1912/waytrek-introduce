// Link mời vào đoàn (WayTrek spec/32). Bản web của InviteCode / InviteLink
// trong app (way_trek/lib/features/group_invite/domain/) — giữ cùng bảng chữ
// và cùng định dạng chuỗi handoff.

export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const INVITE_HOST = 'www.waytrek.site'
export const ANDROID_PACKAGE = 'com.trek.way_trek'
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

/** Mã từ path `/j/<mã>`; null khi không phải mã hợp lệ. */
export function inviteCodeFromPath(pathname: string): string | null {
  const m = /^\/j\/([^/]+)\/?$/i.exec(pathname)
  if (!m) return null
  let raw: string
  try {
    raw = decodeURIComponent(m[1])
  } catch {
    return null
  }
  const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (code.length !== 8) return null
  for (const ch of code) if (!INVITE_ALPHABET.includes(ch)) return null
  return code
}

export const isInvitePath = (pathname: string) => /^\/j\//i.test(pathname)

export const displayCode = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`

/** Chuỗi chép vào clipboard trước khi sang App Store — app đọc lần mở đầu. */
export const iosHandoff = (code: string, nowMs = Date.now()) =>
  `https://${INVITE_HOST}/j/${code}?t=${Math.floor(nowMs / 1000)}&h=1`

export const schemeLink = (code: string) => `waytrek://j/${code}`

/** CH Play kèm referrer — app đọc qua Play Install Referrer API. */
export const playWithReferrer = (code: string) =>
  `${PLAY_URL}&referrer=${encodeURIComponent(`wt_join=${code}`)}`

/** Android: có app → mở app; không có → CH Play (có referrer). */
export const androidIntent = (code: string) =>
  `intent://j/${code}#Intent;scheme=waytrek;package=${ANDROID_PACKAGE};` +
  `S.browser_fallback_url=${encodeURIComponent(playWithReferrer(code))};end`

export type Platform = 'ios' | 'android' | 'other'

export function detectPlatform(ua: string): Platform {
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPadOS báo mình là Mac — phân biệt bằng màn cảm ứng.
  if (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios'
  return 'other'
}
