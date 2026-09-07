import { AnimatePresence, motion } from 'motion/react'
import type { Screen } from '@/data/screens'

/** Chữ rải quanh điện thoại như ảnh mẫu: đổi theo màn, trượt lên rồi mờ đi. */
const up = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } }
const T = (d = 0) => ({ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const, delay: d })

export function MarginNotes({ screen, index }: { screen: Screen; index: number }) {
  return (
    <div className="margin-notes">
      <AnimatePresence mode="wait">
        <motion.div key={screen.id} style={{ position: 'absolute', inset: 0 }}>
          <motion.h2 className="headline" {...up} transition={T(0.05)}>
            {screen.headline[0]}<span className="headline-dash" aria-hidden="true" /><br />
            <em>{screen.headline[1]}</em>
          </motion.h2>
          <motion.p className="tagline" {...up} transition={T(0.12)}>
            {screen.tagline}
            <small>{screen.taglineSub}</small>
          </motion.p>
          {screen.margins.map((m, i) => (
            <motion.div key={m.slot} className={'mn ' + m.slot} {...up} transition={T(0.18 + i * 0.05)}>
              <strong>{m.head}</strong>{m.body}
            </motion.div>
          ))}
          <motion.div className="mn tl" style={{ top: 'auto', bottom: 'clamp(18px, 3vh, 30px)', left: 'clamp(18px, 3.2vw, 44px)' }} {...up} transition={T(0.3)}>
            <strong>{String(index + 1).padStart(2, '0')} / 04</strong>{screen.rail}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
