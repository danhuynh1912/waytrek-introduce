// Phần của ngôn ngữ nằm NGOÀI cây React: thuộc tính `<html lang>` (CSS chọn font
// và khoảng dòng theo `:lang()`, trình đọc màn hình chọn giọng) và font chữ
// riêng của ngôn ngữ — Inter Tight không có chữ Nhật / Hàn / Hoa / Thái / Lào /
// Miến, nên nạp Noto tương ứng, CHỈ khi trang đang ở ngôn ngữ đó.

import { LOCALE_INFO, fontHref } from './locales.ts'
import type { Locale } from './locales.ts'

export function applyDocumentLocale(locale: Locale): void {
  const info = LOCALE_INFO[locale]
  document.documentElement.lang = info.tag
  if (!info.font) return
  const href = fontHref(info.font.query)
  if (document.head.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
