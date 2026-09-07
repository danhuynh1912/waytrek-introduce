import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Annotations } from '@/components/Annotations'
import { CloudSea } from '@/components/CloudSea'
import { Header } from '@/components/Header'
import { MarginNotes } from '@/components/MarginNotes'
import { Outro } from '@/components/Outro'
import { Phone } from '@/components/Phone'
import { Rail } from '@/components/Rail'
import { DARK, LIGHT } from '@/data/palettes'
import { SCREENS } from '@/data/screens'
import { useScrollStage } from '@/hooks/useScrollStage'
import { useReducedMotion, useTheme } from '@/hooks/useTheme'

type Rect = { left: number; top: number; width: number; height: number; stageWidth: number }

export default function App() {
  const [mode, toggle] = useTheme()
  const reduced = useReducedMotion()
  const { active, progress, goTo } = useScrollStage(SCREENS.length, reduced)
  const tone = useMemo(() => (mode === 'dark' ? DARK : LIGHT)[active], [mode, active])

  // Khung màn hình điện thoại (toạ độ trong stage) để đặt chú thích.
  const stageRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const s = stageRef.current?.getBoundingClientRect(), e = screenRef.current?.getBoundingClientRect()
      if (!s || !e) return
      setRect({ left: e.left - s.left, top: e.top - s.top, width: e.width, height: e.height, stageWidth: s.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [])

  // Nạp trước ảnh màn kế tiếp để crossfade không bị khựng.
  useEffect(() => {
    const n = SCREENS[active + 1]
    if (n) { const im = new Image(); im.src = n.src }
  }, [active])

  const screen = SCREENS[active]
  const wordShift = progress * (SCREENS.length - 1) - active // −0.5..0.5 quanh mỗi màn

  return (
    <>
      <Header mode={mode} onToggle={toggle} />
      <div className="scroller" style={{ height: `${SCREENS.length * 100}vh` }}>
        <div className="stage" ref={stageRef}>
          <CloudSea tone={tone} reducedMotion={reduced} />
          <div className="veil" aria-hidden="true" />
          <div className="guides" aria-hidden="true" />

          <div className="wordmark" aria-hidden="true" style={{ transform: `translateX(calc(-50% + ${(-wordShift * 3).toFixed(2)}vw))` }}>
            <span>WayTrek</span>
          </div>

          <MarginNotes screen={screen} />
          <Phone ref={screenRef} screens={SCREENS} active={active} reducedMotion={reduced} />
          <Annotations notes={screen.notes} screenRect={rect} seed={screen.id} reducedMotion={reduced} />
          <Rail screens={SCREENS} active={active} onGo={goTo} />

          <div className="scroll-hint" style={{ opacity: active === 0 && progress < 0.08 ? 1 : 0 }} aria-hidden="true">
            Cuộn để xem<i />
          </div>
        </div>
      </div>
      <Outro />
    </>
  )
}
