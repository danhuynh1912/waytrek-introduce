import { useEffect } from 'react'

const SITE = 'https://www.waytrek.site'

function setMeta(attr: 'name' | 'property', key: string, value: string | null): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (value == null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = value
}

/**
 * Tiêu đề, mô tả, đường dẫn chuẩn của trang đang mở — mỗi trang tự khai, vì
 * index.html chỉ có một bộ cho mọi đường dẫn. `noindex` cho trang không nên
 * vào máy tìm kiếm.
 */
export function usePageMeta(m: { title: string; description?: string; path: string; noindex?: boolean } | null): void {
  const title = m?.title
  const description = m?.description
  const path = m?.path
  const noindex = m?.noindex ?? false
  useEffect(() => {
    if (title == null || path == null) return
    document.title = title
    setMeta('property', 'og:title', title)
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }
    const url = `${SITE}${path}`
    setMeta('property', 'og:url', url)
    const canon = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canon) canon.href = url
    setMeta('name', 'robots', noindex ? 'noindex' : null)
  }, [title, description, path, noindex])
}
