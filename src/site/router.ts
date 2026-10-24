// Điều hướng trong waytrek.site — không thêm thư viện định tuyến: bảng đường
// dẫn nằm ở `core/routes.ts`, đây chỉ là phần nối với History API.
//
// /plan và /j/<mã> là hai ỨNG DỤNG khác, chọn lúc tải trang (main.tsx) — link
// tới đó phải tải lại trang thật, không đi qua `navigate`.

import { useEffect, useState } from 'react'
import { parseSiteRoute } from './core/routes'
import type { SiteRoute } from './core/routes'

const EVENT = 'wt-site-navigate'

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENT))
}

export interface SiteLocation {
  route: SiteRoute
  /** pathname + search hiện tại — khoá để dựng lại trang khi đổi địa chỉ. */
  key: string
}

const read = (): SiteLocation => ({
  route: parseSiteRoute(window.location.pathname, window.location.search),
  key: window.location.pathname + window.location.search,
})

export function useSiteLocation(): SiteLocation {
  const [loc, setLoc] = useState(read)
  useEffect(() => {
    const sync = () => setLoc(read())
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(EVENT, sync)
    }
  }, [])
  return loc
}

/** Đường dẫn thuộc trang này (đi bằng History API) hay là ứng dụng khác / ngoài trang. */
export function isSitePath(to: string): boolean {
  if (!to.startsWith('/') || to.startsWith('//')) return false
  const [path, search = ''] = to.split('?')
  return parseSiteRoute(path, search ? `?${search}` : '').page !== 'notFound'
}
