// Ngôn ngữ của waytrek.site — MỘT bảng cho cả đường dẫn, thẻ SEO, font, link cửa
// hàng. Thuần (không React, không DOM): chạy được cả trong vite.config lúc build
// (dựng trang tĩnh theo ngôn ngữ + sitemap) lẫn trong trình duyệt.
//
// Tiếng Việt là ngôn ngữ gốc và KHÔNG có tiền tố (`/`, `/map`) — giữ nguyên mọi
// link đã lập chỉ mục và link deep link của app. Ngôn ngữ khác có tiền tố
// (`/en/`, `/ja/map`).

export const LOCALES = ['vi', 'en', 'ja', 'ko', 'zh', 'th', 'lo', 'my', 'id', 'ms'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'vi'

export interface LocaleInfo {
  /** Tên ngôn ngữ bằng chính ngôn ngữ đó — thứ người dùng tìm trong bộ chọn. */
  native: string
  /** Giá trị `hreflang` / `<html lang>` (BCP 47). */
  tag: string
  /** `og:locale` (định dạng của Open Graph: `ja_JP`). */
  og: string
  /** Mã ngôn ngữ cho `Intl` — luôn chữ số Latin (`-u-nu-latn`): tiếng Miến có chữ số riêng, bản vẽ dùng số Latin. */
  intl: string
  /** Cửa hàng App Store của nước dùng ngôn ngữ này (app phát hành ở 11 nước, xem CLAUDE.md của WayTrek). */
  storefront: string
  /** `hl` của Google Play. */
  playLang: string
  /** Font Google Fonts nạp thêm (Inter Tight không có chữ này); null = Inter Tight đủ. */
  font: { family: string; query: string } | null
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  vi: { native: 'Tiếng Việt', tag: 'vi', og: 'vi_VN', intl: 'vi-VN-u-nu-latn', storefront: 'vn', playLang: 'vi', font: null },
  en: { native: 'English', tag: 'en', og: 'en_US', intl: 'en-US-u-nu-latn', storefront: 'us', playLang: 'en', font: null },
  ja: { native: '日本語', tag: 'ja', og: 'ja_JP', intl: 'ja-JP-u-nu-latn', storefront: 'jp', playLang: 'ja', font: { family: 'Noto Sans JP', query: 'Noto+Sans+JP:wght@400;500;600;700' } },
  ko: { native: '한국어', tag: 'ko', og: 'ko_KR', intl: 'ko-KR-u-nu-latn', storefront: 'kr', playLang: 'ko', font: { family: 'Noto Sans KR', query: 'Noto+Sans+KR:wght@400;500;600;700' } },
  zh: { native: '简体中文', tag: 'zh-Hans', og: 'zh_CN', intl: 'zh-CN-u-nu-latn', storefront: 'tw', playLang: 'zh-CN', font: { family: 'Noto Sans SC', query: 'Noto+Sans+SC:wght@400;500;600;700' } },
  th: { native: 'ไทย', tag: 'th', og: 'th_TH', intl: 'th-TH-u-nu-latn', storefront: 'th', playLang: 'th', font: { family: 'Noto Sans Thai', query: 'Noto+Sans+Thai:wght@400;500;600;700' } },
  lo: { native: 'ລາວ', tag: 'lo', og: 'lo_LA', intl: 'lo-LA-u-nu-latn', storefront: 'la', playLang: 'lo', font: { family: 'Noto Sans Lao', query: 'Noto+Sans+Lao:wght@400;500;600;700' } },
  my: { native: 'မြန်မာ', tag: 'my', og: 'my_MM', intl: 'my-MM-u-nu-latn', storefront: 'us', playLang: 'my', font: { family: 'Noto Sans Myanmar', query: 'Noto+Sans+Myanmar:wght@400;500;600;700' } },
  id: { native: 'Bahasa Indonesia', tag: 'id', og: 'id_ID', intl: 'id-ID-u-nu-latn', storefront: 'sg', playLang: 'id', font: null },
  ms: { native: 'Bahasa Melayu', tag: 'ms', og: 'ms_MY', intl: 'ms-MY-u-nu-latn', storefront: 'sg', playLang: 'ms', font: null },
}

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v)

/**
 * Tách tiền tố ngôn ngữ khỏi đường dẫn: `/ja/map` → { ja, `/map` }. Không có
 * tiền tố (hoặc tiền tố không phải ngôn ngữ nào) → tiếng Việt, đường dẫn giữ
 * nguyên. `/vi/...` KHÔNG được nhận: tiếng Việt chỉ có một địa chỉ (không tiền tố).
 */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/([a-z]{2})(\/.*)?$/.exec(pathname)
  if (m && m[1] !== DEFAULT_LOCALE && isLocale(m[1])) return { locale: m[1], path: m[2] ?? '/' }
  return { locale: DEFAULT_LOCALE, path: pathname }
}

/**
 * Đường dẫn của trang trong một ngôn ngữ. `path` là đường dẫn KHÔNG tiền tố,
 * có thể kèm truy vấn (`/map?trail=…`). Trang chủ luôn có dấu `/` cuối
 * (`/en/`): trang tĩnh dựng sẵn nằm ở `/en/index.html`.
 */
export function localizedPath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path
  if (path === '/' || path === '') return `/${locale}/`
  return `/${locale}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Địa chỉ Google Fonts của font ngôn ngữ (`LocaleInfo.font.query`). */
export const fontHref = (query: string): string => `https://fonts.googleapis.com/css2?family=${query}&display=swap`
