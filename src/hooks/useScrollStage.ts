import { useCallback, useEffect, useRef, useState } from 'react'
import { easeInOutCubic } from '@/lib/ease'

/**
 * Một cử chỉ = một bước. Bánh xe chuột, vuốt trackpad, vuốt ngón tay hay phím
 * mũi tên đều chỉ tiến/lùi ĐÚNG MỘT màn, bất kể mạnh nhẹ.
 *
 * Cách làm: trang không cuộn tự do. Ta chặn wheel/touch, tự tween `scrollY`
 * tới mốc màn kế tiếp, và KHOÁ cho tới khi (a) tween xong và (b) không còn
 * sự kiện wheel nào trong một quãng lặng — trackpad bắn quán tính suốt
 * ~1,5 giây sau một cú hất, nếu chỉ khoá theo thời gian tween thì đuôi quán
 * tính sẽ kích bước thứ hai. Đó chính là lỗi "vuốt một cái nhảy tới màn 3".
 *
 * Bước cuối là phần kết (Outro) nằm dưới stage; ở đó cuộn xuống trả về cho
 * trình duyệt để đọc hết nội dung nếu nó dài hơn màn hình.
 */
const STEP_MS = 1050
const QUIET_MS = 180
const WHEEL_MIN = 8
const SWIPE_MIN = 36

export function useScrollStage(count: number, reducedMotion: boolean) {
  const [active, setActive] = useState(0)
  const [progress, setProgress] = useState(0)
  const stepRef = useRef(0) // 0..count (count = outro)
  const animating = useRef(false)
  const lastWheel = useRef(0)
  const armed = useRef(true) // được phép nhận cử chỉ mới
  const raf = useRef(0)

  const targetFor = useCallback((step: number) => {
    const vh = window.innerHeight
    if (step >= count) return document.documentElement.scrollHeight - vh
    return step * vh
  }, [count])

  const animateTo = useCallback((y: number) => {
    cancelAnimationFrame(raf.current)
    const from = window.scrollY
    if (reducedMotion || Math.abs(y - from) < 2) { window.scrollTo(0, y); animating.current = false; return }
    animating.current = true
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / STEP_MS)
      window.scrollTo(0, from + (y - from) * easeInOutCubic(k))
      if (k < 1) raf.current = requestAnimationFrame(tick)
      else animating.current = false
    }
    raf.current = requestAnimationFrame(tick)
  }, [reducedMotion])

  const go = useCallback((step: number) => {
    const s = Math.max(0, Math.min(count, step))
    stepRef.current = s
    animateTo(targetFor(s))
  }, [animateTo, count, targetFor])

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = 'none'

    // Đồng bộ chỉ số màn + tiến độ từ scrollY (kể cả khi kéo thanh cuộn).
    const onScroll = () => {
      const vh = window.innerHeight, y = window.scrollY
      setProgress(Math.min(1, Math.max(0, y / (vh * (count - 1)))))
      const i = Math.min(count - 1, Math.max(0, Math.floor((y + vh * 0.5) / vh)))
      setActive(prev => (prev === i ? prev : i))
      if (!animating.current) stepRef.current = y > (count - 1) * vh + 4 ? count : i
    }
    onScroll()

    const inOutro = () => window.scrollY > (count - 1) * window.innerHeight + 4

    // Mở khoá khi tween xong VÀ wheel đã lặng đủ lâu.
    let quiet = 0
    const rearm = () => {
      clearTimeout(quiet)
      quiet = window.setTimeout(() => {
        if (animating.current || performance.now() - lastWheel.current < QUIET_MS) rearm()
        else armed.current = true
      }, QUIET_MS)
    }
    const fire = (dir: 1 | -1) => {
      if (!armed.current) return
      armed.current = false
      go(stepRef.current + dir)
      rearm()
    }

    const onWheel = (e: WheelEvent) => {
      lastWheel.current = performance.now()
      // Ở phần kết: cuộn xuống hoặc đang ở sâu trong phần kết thì để trình duyệt lo.
      if (inOutro()) {
        const deep = window.scrollY > (count - 1) * window.innerHeight + window.innerHeight * 0.5
        if (e.deltaY > 0 || deep) return
      }
      e.preventDefault()
      if (!armed.current) { rearm(); return }
      if (Math.abs(e.deltaY) < WHEEL_MIN) return
      fire(e.deltaY > 0 ? 1 : -1)
    }

    let touchY = 0, touchTracking = false
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; touchTracking = true }
    const onTouchMove = (e: TouchEvent) => {
      if (inOutro()) return
      e.preventDefault()
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchTracking) return
      touchTracking = false
      const dy = touchY - e.changedTouches[0].clientY
      if (Math.abs(dy) < SWIPE_MIN) return
      if (inOutro() && dy > 0) return
      lastWheel.current = performance.now()
      fire(dy > 0 ? 1 : -1)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); fire(1) }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); fire(-1) }
      else if (e.key === 'Home') { e.preventDefault(); go(0) }
      else if (e.key === 'End') { e.preventDefault(); go(count) }
    }

    const onResize = () => { if (!animating.current) window.scrollTo(0, targetFor(stepRef.current)); onScroll() }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf.current); clearTimeout(quiet)
      window.removeEventListener('scroll', onScroll); window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart); window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd); window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.documentElement.style.overscrollBehavior = ''
    }
  }, [count, go, targetFor])

  return { active, progress, goTo: go }
}
