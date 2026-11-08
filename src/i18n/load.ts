// Nạp câu chữ của một ngôn ngữ — mỗi ngôn ngữ là một chunk riêng, người dùng chỉ
// tải ngôn ngữ mình đang xem. Tiếng Việt đã nằm sẵn trong bundle chính (là mặc
// định của ngữ cảnh và của trang /plan), nên không đi qua đây.

import type { Locale } from './locales.ts'
import type { Messages } from './messages/vi.ts'
import { vi } from './messages/vi.ts'

const LOADERS: Record<Exclude<Locale, 'vi'>, () => Promise<{ default: Messages }>> = {
  en: () => import('./messages/en.ts'),
  ja: () => import('./messages/ja.ts'),
  ko: () => import('./messages/ko.ts'),
  zh: () => import('./messages/zh.ts'),
  th: () => import('./messages/th.ts'),
  lo: () => import('./messages/lo.ts'),
  my: () => import('./messages/my.ts'),
  id: () => import('./messages/id.ts'),
  ms: () => import('./messages/ms.ts'),
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'vi') return vi
  return (await LOADERS[locale]()).default
}
