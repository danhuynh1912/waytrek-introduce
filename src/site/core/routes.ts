// Đường dẫn của waytrek.site. Hình dạng CHÉP từ bảng deep link của app
// (`way_trek/lib/core/deep_link/deep_link_routes.dart`): một link mở được cả
// trang web lẫn đúng màn đó trong app (`waytrek://<cùng đường dẫn>`), và sau
// này thêm vào apple-app-site-association là xong, không phải đổi link nào.
// Thuần — không React, không DOM.

export type SiteRoute =
  | { page: 'home' }
  | { page: 'map'; trailId: string | null }
  | { page: 'trail'; trailId: string; routeId: string | null }
  | { page: 'notFound' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuidOrNull = (v: string | null): string | null => (v && UUID.test(v) ? v.toLowerCase() : null)

/** Đường dẫn + chuỗi truy vấn → trang. Không bao giờ ném: link tới từ mạng xã hội, gõ tay, link cũ. */
export function parseSiteRoute(pathname: string, search = ''): SiteRoute {
  let segs: string[]
  try {
    segs = pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  } catch {
    return { page: 'notFound' }
  }
  const q = new URLSearchParams(search)
  if (segs.length === 0 || (segs.length === 1 && segs[0] === 'home')) return { page: 'home' }
  if (segs.length === 1 && segs[0] === 'map') return { page: 'map', trailId: uuidOrNull(q.get('trail')) }
  if (segs.length === 2 && segs[0] === 'trail' && UUID.test(segs[1])) {
    return { page: 'trail', trailId: segs[1].toLowerCase(), routeId: uuidOrNull(q.get('route')) }
  }
  return { page: 'notFound' }
}

/** Trang → đường dẫn (kèm truy vấn). Ngược của `parseSiteRoute`. */
export function sitePath(r: SiteRoute): string {
  switch (r.page) {
    case 'home':
      return '/'
    case 'map':
      return r.trailId ? `/map?trail=${r.trailId}` : '/map'
    case 'trail':
      return r.routeId ? `/trail/${r.trailId}?route=${r.routeId}` : `/trail/${r.trailId}`
    case 'notFound':
      return '/'
  }
}

/** Nút "Mở trong app": cùng đường dẫn, scheme `waytrek://` (`WayTrekWeb.scheme` của app). */
export function appLink(r: SiteRoute): string {
  return `waytrek://${sitePath(r).replace(/^\//, '')}`
}
