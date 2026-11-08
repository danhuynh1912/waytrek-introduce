import { useEffect } from 'react'
import { useI18n } from '../../i18n/context'
import { buildHead } from '../../i18n/seo'
import type { HeadSpec } from '../../i18n/seo'

function setNamed(attr: 'name' | 'property', key: string, values: string[]): void {
  document.head.querySelectorAll(`meta[${attr}="${key}"]`).forEach((el) => el.remove())
  for (const content of values) {
    const el = document.createElement('meta')
    el.setAttribute(attr, key)
    el.content = content
    document.head.appendChild(el)
  }
}

function apply(h: HeadSpec, noindex: boolean): void {
  document.title = h.title
  const byKey = new Map<string, { attr: 'name' | 'property'; key: string; values: string[] }>()
  for (const m of h.meta) {
    const id = `${m.attr}:${m.key}`
    const e = byKey.get(id) ?? { attr: m.attr, key: m.key, values: [] }
    e.values.push(m.content)
    byKey.set(id, e)
  }
  for (const { attr, key, values } of byKey.values()) setNamed(attr, key, values)
  setNamed('name', 'robots', noindex ? ['noindex'] : [])

  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
  for (const a of h.alternates) {
    const el = document.createElement('link')
    el.rel = 'alternate'
    el.hreflang = a.hreflang
    el.href = a.href
    document.head.appendChild(el)
  }
  const canon = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (h.canonical) {
    if (canon) canon.href = h.canonical
    else {
      const el = document.createElement('link')
      el.rel = 'canonical'
      el.href = h.canonical
      document.head.appendChild(el)
    }
  } else canon?.remove()
}

/**
 * Tiêu đề, mô tả, đường dẫn chuẩn, hreflang của trang đang mở — mỗi trang tự
 * khai, vì index.html chỉ có một bộ cho mọi đường dẫn. `path` là đường dẫn
 * KHÔNG tiền tố ngôn ngữ (ngôn ngữ lấy từ ngữ cảnh). `noindex` cho trang
 * không nên vào máy tìm kiếm: không canonical, không hreflang.
 */
export function usePageMeta(m: { title: string; description?: string; path: string; noindex?: boolean } | null): void {
  const { locale } = useI18n()
  const title = m?.title
  const description = m?.description
  const path = m?.path
  const noindex = m?.noindex ?? false
  useEffect(() => {
    if (title == null || path == null) return
    apply(buildHead({ locale, path, title, description, noindex }), noindex)
  }, [locale, title, description, path, noindex])
}
