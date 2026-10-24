// Tấm kế hoạch trên điện thoại KÉO được bằng tay nắm. Bản cũ chỉ đổi mốc khi
// CHẠM, vuốt lên thì không có gì xảy ra — người dùng tưởng tấm bị kẹt và không
// xem được nội dung bên dưới (25/10).
//
// Kéo: tấm bám ngón tay (tắt chuyển động trong lúc kéo). Thả: về mốc theo
// `sheetOpensAt`. Chạm (di chưa tới TAP_PX): click của nút đổi mốc như cũ —
// bàn phím cũng đi đường đó. Lượt kéo nuốt click đi kèm để không đổi mốc hai lần.

import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { sheetDragHeight, sheetOpensAt } from '../../core/sheet-snap'

const TAP_PX = 6
/** Kéo xuống thấp nhất: còn thấy tay nắm + một dòng tóm tắt. */
const MIN_PX = 120
/** Mốc mở = `calc(100% - 64px)` của `.pl-panel.is-open`; mốc đóng = 44%. */
const OPEN_GAP_PX = 64
const HALF = 0.44

interface Drag {
  id: number
  y0: number
  h0: number
  moved: boolean
  lastY: number
  lastT: number
  velocity: number
}

/** `panelRef` là của tấm (`.pl-panel`): đo chiều cao lúc bắt đầu kéo và khoảng chứa nó. */
export function useSheetDrag(panelRef: RefObject<HTMLElement | null>, open: boolean, setOpen: (open: boolean) => void) {
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)
  const [height, setHeight] = useState<number | null>(null)

  const room = () => (panelRef.current?.offsetParent as HTMLElement | null)?.clientHeight ?? window.innerHeight

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const panel = panelRef.current
    if (!panel || (e.pointerType === 'mouse' && e.button !== 0)) return
    swallowClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      id: e.pointerId,
      y0: e.clientY,
      h0: panel.getBoundingClientRect().height,
      moved: false,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moved && Math.abs(e.clientY - d.y0) < TAP_PX) return
    d.moved = true
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    setHeight(sheetDragHeight(d.h0, d.y0, e.clientY, MIN_PX, room() - OPEN_GAP_PX))
  }

  const finish = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    const h = sheetDragHeight(d.h0, d.y0, e.clientY, MIN_PX, room() - OPEN_GAP_PX)
    setHeight(null)
    if (cancelled) return
    setOpen(sheetOpensAt(h, room() * HALF, room() - OPEN_GAP_PX, d.velocity))
    // Chuột: click bắn ngay sau pointerup trong cùng lượt — nuốt nó. Cảm ứng kéo
    // xa thì không có click, nên cờ phải tự hạ, kẻo nuốt mất lần chạm sau.
    swallowClick.current = true
    setTimeout(() => {
      swallowClick.current = false
    }, 0)
  }

  const onClick = () => {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    setOpen(!open)
  }

  const style: CSSProperties | undefined = height == null ? undefined : { height, transition: 'none' }

  return {
    style,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
      onClick,
    },
  }
}
