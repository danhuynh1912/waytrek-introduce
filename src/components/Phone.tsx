import { forwardRef, useEffect, useRef } from 'react'
import type { Screen } from '@/data/screens'

/**
 * Khung iPhone dựng bằng CSS, bốn ảnh màn hình xếp chồng và crossfade bằng
 * class `active`. Nghiêng nhẹ theo chuột (perspective) — chỉ trên máy có
 * con trỏ, và tắt khi người dùng yêu cầu giảm chuyển động.
 */
type Props = { screens: Screen[]; active: number; reducedMotion: boolean }

export const Phone = forwardRef<HTMLDivElement, Props>(function Phone({ screens, active, reducedMotion }, screenRef) {
  const phoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = phoneRef.current
    if (!el || reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      ty = nx * 9; tx = -ny * 7
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onLeave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick) }
    function tick() {
      rx += (tx - rx) * 0.08; ry += (ty - ry) * 0.08
      el!.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`
      raf = Math.abs(tx - rx) + Math.abs(ty - ry) > 0.01 ? requestAnimationFrame(tick) : 0
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => { window.removeEventListener('pointermove', onMove); document.documentElement.removeEventListener('pointerleave', onLeave); cancelAnimationFrame(raf) }
  }, [reducedMotion])

  return (
    <div className="phone-wrap">
      <div className="phone" ref={phoneRef}>
        <span className="phone-btn-vol" aria-hidden="true" />
        <div className="screen" ref={screenRef}>
          {screens.map((s, i) => (
            <img
              key={s.id}
              className={'shot' + (i === active ? ' active' : '')}
              src={s.src}
              alt={i === active ? `Màn ${s.rail} của WayTrek` : ''}
              width={828}
              height={1800}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          ))}
        </div>
        <div className="glare" aria-hidden="true" />
      </div>
    </div>
  )
})
