// Thẻ SEO theo ngôn ngữ — thuần, dùng chung cho trình duyệt (`usePageMeta`) và
// lúc build (`vite-plugins/seo-pages.ts` dựng trang tĩnh + sitemap). Một chỗ khai
// địa chỉ gốc, danh sách bản dịch của một trang, và x-default.

import { DEFAULT_LOCALE, LOCALES, LOCALE_INFO, localizedPath } from './locales.ts'
import type { Locale } from './locales.ts'

export const SITE = 'https://www.waytrek.site'

/** Ngôn ngữ dự phòng khi không ngôn ngữ nào khớp người xem: tiếng Anh (khán giả quốc tế rộng nhất). */
export const X_DEFAULT_LOCALE: Locale = 'en'

export const absoluteUrl = (locale: Locale, path: string): string => `${SITE}${localizedPath(locale, path)}`

export interface Alternate {
  /** `hreflang` hoặc `x-default`. */
  hreflang: string
  href: string
}

/** Mọi bản dịch của một trang (kể cả chính nó) + x-default — mỗi bản phải liệt kê ĐỦ cả bộ, kể cả mình, nếu không Google bỏ qua. */
export function alternatesOf(path: string): Alternate[] {
  return [
    ...LOCALES.map((l) => ({ hreflang: LOCALE_INFO[l].tag, href: absoluteUrl(l, path) })),
    { hreflang: 'x-default', href: absoluteUrl(X_DEFAULT_LOCALE, path) },
  ]
}

/** `og:locale:alternate` — các ngôn ngữ còn lại của trang. */
export const ogAlternates = (locale: Locale): string[] => LOCALES.filter((l) => l !== locale).map((l) => LOCALE_INFO[l].og)

export interface HeadMeta {
  attr: 'name' | 'property'
  key: string
  content: string
}

export interface HeadSpec {
  title: string
  meta: HeadMeta[]
  /** `link rel="canonical"` + `rel="alternate" hreflang`. Trang noindex không có. */
  canonical: string | null
  alternates: Alternate[]
}

/**
 * Mọi thẻ <head> phụ thuộc trang + ngôn ngữ, dưới dạng dữ liệu: trình duyệt
 * (`usePageMeta`) và bước dựng trang tĩnh lúc build cùng đọc MỘT bản này, nên
 * trang tĩnh và trang sau khi React chạy không bao giờ lệch nhau.
 * `path` là đường dẫn KHÔNG tiền tố ngôn ngữ.
 */
export function buildHead(h: { locale: Locale; path: string; title: string; description?: string; noindex?: boolean }): HeadSpec {
  const meta: HeadMeta[] = [
    { attr: 'property', key: 'og:title', content: h.title },
    { attr: 'name', key: 'twitter:title', content: h.title },
  ]
  if (h.description) {
    meta.push(
      { attr: 'name', key: 'description', content: h.description },
      { attr: 'property', key: 'og:description', content: h.description },
      { attr: 'name', key: 'twitter:description', content: h.description },
    )
  }
  if (h.noindex) return { title: h.title, meta, canonical: null, alternates: [] }
  const url = absoluteUrl(h.locale, h.path)
  meta.push(
    { attr: 'property', key: 'og:url', content: url },
    { attr: 'property', key: 'og:locale', content: LOCALE_INFO[h.locale].og },
    ...ogAlternates(h.locale).map((og) => ({ attr: 'property' as const, key: 'og:locale:alternate', content: og })),
  )
  return { title: h.title, meta, canonical: url, alternates: alternatesOf(h.path) }
}

export { DEFAULT_LOCALE }
