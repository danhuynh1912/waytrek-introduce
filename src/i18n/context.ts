// Ngữ cảnh ngôn ngữ của cây React: ngôn ngữ đang xem, câu chữ, và cách viết số.
// Mặc định là tiếng Việt — trang /plan, /j và các nơi chưa dịch không có Provider
// vẫn chạy y như cũ. (Provider nằm ở `provider.tsx`: tách để file này chỉ xuất hook.)

import { createContext, useContext } from 'react'
import { makeNumberFormat } from '../shared/format.ts'
import type { NumberFormat } from '../shared/format.ts'
import { DEFAULT_LOCALE, LOCALE_INFO } from './locales.ts'
import type { Locale } from './locales.ts'
import { vi } from './messages/vi.ts'
import type { Messages } from './messages/vi.ts'

export interface I18n {
  locale: Locale
  m: Messages
  fmt: NumberFormat
}

export const DEFAULT_I18N: I18n = { locale: DEFAULT_LOCALE, m: vi, fmt: makeNumberFormat(LOCALE_INFO[DEFAULT_LOCALE].intl) }

export const I18nContext = createContext<I18n>(DEFAULT_I18N)

export const useI18n = (): I18n => useContext(I18nContext)
