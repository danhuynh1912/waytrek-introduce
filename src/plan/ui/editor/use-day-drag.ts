// Kéo một điểm trên dòng thời gian sang chỗ khác / ngày khác (chủ sản phẩm 26/10).
// Tay nắm: chấm số đầu dòng (bấm thì vẫn đưa bản đồ tới điểm, kéo thì nhấc điểm)
// và nút tay nắm trong cụm nút của dòng — nút này dùng được bằng phím: Enter
// nhấc lên, mũi tên chọn chỗ, Enter thả, Esc huỷ. Chỗ thả + ngày: core/days.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { DaySlot } from '../../core/doc'
import { isHomeSlot, nearestSlot } from '../../core/days'
import type { DayLayout } from '../../core/days'

export interface DayDrag {
  id: string
  /** Chỗ thả đang chọn (chỉ số trong `layout.slots`). */
  at: number
  /** Vạch chèn của từng chỗ thả, tính từ mép trên của dòng thời gian (px). */
  ys: number[]
  /** Kéo bằng phím (không có con trỏ để vẽ bóng điểm). */
  keyboard: boolean
}

export interface DragHandle {
  onPointerDown(e: ReactPointerEvent<HTMLElement>, id: string): void
  onKeyDown(e: KeyboardEvent<HTMLElement>, id: string): void
  onBlur(id: string): void
  /** Cú bấm ngay sau một lần kéo — chấm số không được bay bản đồ vì nó. */
  swallowClick(): boolean
}

/** Kéo quá chừng này (px) mới tính là kéo — ít hơn là bấm. */
const DRAG_START_PX = 6
/** Con trỏ cách mép vùng cuộn chừng này thì tự cuộn. */
const EDGE_PX = 56

export function useDayDrag(
  box: RefObject<HTMLDivElement | null>,
  layout: DayLayout,
  drop: (id: string, slot: DaySlot) => void,
): {
  drag: DayDrag | null
  handle: DragHandle
  /** Gắn vào bóng của điểm đang kéo — vị trí đặt thẳng vào style, không render lại cả dòng thời gian. */
  ghost: RefObject<HTMLDivElement | null>
} {
  const [drag, setDrag] = useState<DayDrag | null>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const cur = useRef<DayDrag | null>(null)
  const set = useCallback((d: DayDrag | null) => {
    cur.current = d
    setDrag(d)
  }, [])
  const swallow = useRef(false)
  const lastY = useRef<number | null>(null)
  const speed = useRef(0)
  const raf = useRef<number | null>(null)
  const detach = useRef<(() => void) | null>(null)

  const scroller = () => box.current?.closest<HTMLElement>('.pl-panel-body') ?? null

  const measure = (): number[] => {
    const el = box.current
    if (!el) return []
    const r = el.getBoundingClientRect()
    return layout.slots.map((s) => {
      const a = s.anchor ? el.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(s.anchor)}"]`) : null
      return a ? a.getBoundingClientRect().top - r.top : r.height
    })
  }

  const slotAt = (clientY: number): number => {
    const el = box.current
    const d = cur.current
    if (!el || !d) return -1
    return nearestSlot(d.ys, clientY - el.getBoundingClientRect().top)
  }

  const retarget = (clientY: number) => {
    const d = cur.current
    if (!d) return
    const at = slotAt(clientY)
    if (at !== d.at) set({ ...d, at })
  }

  const stopScroll = () => {
    speed.current = 0
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
  }

  // Sát mép trên / dưới của vùng cuộn: cuộn dần, nhanh hơn khi càng sát.
  const autoscroll = (clientY: number) => {
    const sc = scroller()
    if (!sc) return
    const r = sc.getBoundingClientRect()
    const over = clientY < r.top + EDGE_PX ? clientY - (r.top + EDGE_PX) : clientY > r.bottom - EDGE_PX ? clientY - (r.bottom - EDGE_PX) : 0
    speed.current = Math.max(-EDGE_PX, Math.min(EDGE_PX, over)) / 4
    if (speed.current === 0 || raf.current != null) return
    const tick = () => {
      const s = scroller()
      if (!s || speed.current === 0 || !cur.current) {
        raf.current = null
        return
      }
      s.scrollTop += speed.current
      if (lastY.current != null) retarget(lastY.current)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const finish = (commit: boolean) => {
    stopScroll()
    detach.current?.()
    detach.current = null
    document.body.classList.remove('pl-drag-active')
    const d = cur.current
    set(null)
    if (!commit || !d || d.at < 0) return
    const slot = layout.slots[d.at]
    if (slot && !isHomeSlot(layout, d.id, slot)) drop(d.id, { index: slot.index, day: slot.day })
  }

  const begin = (id: string, keyboard: boolean): DayDrag | null => {
    const p = layout.order.indexOf(id)
    if (p < 0) return null
    const day = layout.dayOf.get(id)
    const home = layout.slots.findIndex((s) => s.index === p && s.day === day)
    const d = { id, at: home, ys: measure(), keyboard }
    set(d)
    return d
  }

  const moveGhost = (x: number, y: number) => {
    const g = ghost.current
    if (g) g.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || cur.current) return
    const x0 = e.clientX
    const y0 = e.clientY
    let started = false
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_START_PX) return
        started = true
        swallow.current = true
        document.body.classList.add('pl-drag-active')
        if (!begin(id, false)) return
      }
      ev.preventDefault()
      lastY.current = ev.clientY
      moveGhost(ev.clientX, ev.clientY)
      retarget(ev.clientY)
      autoscroll(ev.clientY)
    }
    const up = () => {
      cleanup()
      if (started) {
        finish(true)
        // Cú bấm (click) của chính lần thả này tới ngay sau — nuốt đúng cú đó.
        setTimeout(() => (swallow.current = false), 0)
      }
    }
    const cancel = () => {
      cleanup()
      if (started) finish(false)
    }
    const key = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape' && started) {
        cleanup()
        finish(false)
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', key)
      detach.current = null
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
    detach.current = cleanup
  }

  // Bàn phím: kéo cho tới khi thả; vạch chèn luôn nằm trong vùng nhìn thấy.
  const reveal = (y: number) => {
    const sc = scroller()
    const el = box.current
    if (!sc || !el) return
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop + y
    if (top < sc.scrollTop + EDGE_PX) sc.scrollTop = top - EDGE_PX
    else if (top > sc.scrollTop + sc.clientHeight - EDGE_PX) sc.scrollTop = top - sc.clientHeight + EDGE_PX
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, id: string) => {
    const d = cur.current
    if (!d) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        begin(id, true)
      }
      return
    }
    if (d.id !== id || !d.keyboard) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const at = Math.max(0, Math.min(layout.slots.length - 1, d.at + (e.key === 'ArrowUp' ? -1 : 1)))
      set({ ...d, at })
      reveal(d.ys[at] ?? 0)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      finish(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finish(false)
    }
  }

  const onBlur = (id: string) => {
    const d = cur.current
    if (d && d.keyboard && d.id === id) finish(false)
  }

  // Dòng thời gian đổi giữa lúc kéo (kết quả vừa về): chỗ thả đã đo không còn
  // đúng — huỷ lần kéo này còn hơn thả nhầm chỗ.
  const shape = layout.slots.map((s) => `${s.index}/${s.day}@${s.anchor}`).join(',')
  const lastShape = useRef(shape)
  useEffect(() => {
    if (lastShape.current !== shape && cur.current) finish(false)
    lastShape.current = shape
  })

  useEffect(
    () => () => {
      stopScroll()
      detach.current?.()
      document.body.classList.remove('pl-drag-active')
    },
    [],
  )

  return {
    drag,
    ghost,
    handle: {
      onPointerDown,
      onKeyDown,
      onBlur,
      swallowClick: () => swallow.current,
    },
  }
}
