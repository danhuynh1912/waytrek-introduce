// Bộ chọn ngôn ngữ — `<select>` thật (bàn phím, trình đọc màn hình, danh sách gốc
// của hệ điều hành đều chạy), hai dáng: nút tròn chỉ có quả địa cầu ở đầu trang
// (select trong suốt phủ lên trên), và ô chọn có chữ ở chân trang.
//
// Đổi ngôn ngữ = TẢI TRANG của địa chỉ tương ứng (không chuyển trong SPA): câu
// chữ nạp một lần lúc khởi động, và mỗi ngôn ngữ có địa chỉ riêng cho máy tìm kiếm.

import { useI18n } from '../../i18n/context'
import { LOCALES, LOCALE_INFO, localizedPath, splitLocale } from '../../i18n/locales'
import type { Locale } from '../../i18n/locales'

function switchTo(next: Locale): void {
  const { path } = splitLocale(window.location.pathname)
  window.location.assign(localizedPath(next, path) + window.location.search)
}

const Globe = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
  </svg>
)

export function LanguageSwitch({ variant }: { variant: 'icon' | 'field' }) {
  const { locale, m } = useI18n()
  return (
    <label className={`st-lang is-${variant}`} data-tip={variant === 'icon' ? m.chrome.languageTip : undefined}>
      {variant === 'icon' ? <Globe /> : <span className="sr-only">{m.chrome.language}</span>}
      <select value={locale} aria-label={m.chrome.language} onChange={(e) => switchTo(e.target.value as Locale)}>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={LOCALE_INFO[l].tag}>{LOCALE_INFO[l].native}</option>
        ))}
      </select>
    </label>
  )
}
