import { useEffect, useLayoutEffect, useState } from 'react'
import type { Guide } from '../../core/guides'

const GAP = 10
const MAX_W = 260
const EDGE = 12

interface Place {
  top: number
  left: number
  /** Toạ độ ngang của mũi nhọn, tính trong khung. */
  arrow: number
}

/**
 * Khung chỉ dẫn lần đầu, đứng dưới phần tử `[data-guide-anchor=<anchor>]` và
 * chỉ mũi nhọn vào nó. Đóng khi bấm "Đã hiểu", bấm ra ngoài, bấm chính mốc
 * (người dùng đã làm theo), hoặc Esc. Mốc không có trên màn thì không hiện.
 */
export function CoachMark({ guide, onClose }: { guide: Guide | null; onClose(): void }) {
  const [place, setPlace] = useState<Place | null>(null)

  useLayoutEffect(() => {
    // Không có hướng dẫn: `on` đã tắt khung, vị trí cũ không cần xoá.
    if (!guide) return
    const measure = () => {
      const el = document.querySelector(`[data-guide-anchor="${guide.anchor}"]`)
      if (!el) {
        setPlace(null)
        return
      }
      const r = el.getBoundingClientRect()
      const w = Math.min(MAX_W, window.innerWidth - 2 * EDGE)
      const cx = r.left + r.width / 2
      const left = Math.max(EDGE, Math.min(cx - w / 2, window.innerWidth - w - EDGE))
      setPlace({ top: r.bottom + GAP, left, arrow: cx - left })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [guide])

  useEffect(() => {
    if (!guide) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Bấm bất kỳ đâu (kể cả chính mốc) là đã thấy — đóng, không chặn cú bấm đó.
    const away = () => onClose()
    document.addEventListener('keydown', esc)
    document.addEventListener('pointerdown', away)
    return () => {
      document.removeEventListener('keydown', esc)
      document.removeEventListener('pointerdown', away)
    }
  }, [guide, onClose])

  const on = guide != null && place != null
  return (
    <div
      className={`pl-coach${on ? ' is-on' : ''}`}
      role="dialog"
      aria-live="polite"
      aria-hidden={!on}
      style={place ? { top: place.top, left: place.left, maxWidth: MAX_W } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {place && <span className="pl-coach-arrow" style={{ left: place.arrow }} />}
      <p>{guide?.text}</p>
      <button type="button" className="pl-coach-ok" onClick={onClose}>Đã hiểu</button>
    </div>
  )
}
