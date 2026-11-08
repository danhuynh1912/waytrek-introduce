import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { makeNumberFormat } from '../shared/format.ts'
import { I18nContext } from './context.ts'
import type { I18n } from './context.ts'
import { LOCALE_INFO } from './locales.ts'
import type { Locale } from './locales.ts'
import type { Messages } from './messages/vi.ts'

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo<I18n>(() => ({ locale, m: messages, fmt: makeNumberFormat(LOCALE_INFO[locale].intl) }), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
