// Điều hướng trong waytrek.site — không thêm thư viện định tuyến: bảng đường
// dẫn nằm ở `core/routes.ts`, đây chỉ là phần nối với History API.
//
// /plan và /j/<mã> là hai ỨNG DỤNG khác, chọn lúc tải trang (main.tsx) — link
// tới đó phải tải lại trang thật, không đi qua `navigate`.

import { useEffect, useState } from 'react'
import { localizedPath, splitLocale } from '../i18n/locales'
import type { Locale } from '../i18n/locales'
import { parseSiteRoute } from './core/routes'
import type { SiteRoute } from './core/routes'

const EVENT = 'wt-site-navigate'

/** Ngôn ngữ của địa chỉ đang mở — địa chỉ là nguồn DUY NHẤT (không có state thứ hai để lệch). */
export const currentLocale = (): Locale => splitLocale(window.location.pathname).locale

/**
 * Đi tới một đường dẫn của trang, GIỮ ngôn ngữ đang xem: nơi gọi chỉ biết
 * đường dẫn không tiền tố (`/map?trail=…`), ngôn ngữ do đây thêm vào.
 */
export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = localizedPath(currentLocale(), to)
  if (opts.replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(EVENT))
}

export interface SiteLocation {
  route: SiteRoute
  locale: Locale
  /** pathname + search hiện tại — khoá để dựng lại trang khi đổi địa chỉ. */
  key: string
}

const read = (): SiteLocation => {
  const { locale, path } = splitLocale(window.location.pathname)
  return { route: parseSiteRoute(path, window.location.search), locale, key: window.location.pathname + window.location.search }
}

export function useSiteLocation(): SiteLocation {
  const [loc, setLoc] = useState(read)
  useEffect(() => {
    const sync = () => {
      // Nút Back / Forward có thể lùi sang trang của NGÔN NGỮ KHÁC: câu chữ nạp lúc
      // khởi động nên chỉ tải lại là đúng (không giữ hai ngôn ngữ trong một phiên).
      if (currentLocale() !== loc.locale) return window.location.reload()
      setLoc(read())
    }
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(EVENT, sync)
    }
  }, [loc.locale])
  return loc
}

/** Đường dẫn thuộc trang này (đi bằng History API) hay là ứng dụng khác / ngoài trang. */
export function isSitePath(to: string): boolean {
  if (!to.startsWith('/') || to.startsWith('//')) return false
  const [path, search = ''] = to.split('?')
  return parseSiteRoute(path, search ? `?${search}` : '').page !== 'notFound'
}
