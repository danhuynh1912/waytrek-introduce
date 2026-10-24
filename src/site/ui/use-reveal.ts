import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Gắn `is-in` cho phần tử khi nó lọt vào khung nhìn (một lần) — CSS lo phần
 * hiện dần và vẽ nét. Trình duyệt không có IntersectionObserver, hoặc người
 * dùng tắt chuyển động, thì hiện ngay: nội dung không bao giờ bị giấu.
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
