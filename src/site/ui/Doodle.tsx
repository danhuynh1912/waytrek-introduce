// Nét vẽ tay rải quanh trang (như bản mẫu "case study"), thêm bộ hình của
// người leo núi: đỉnh, lều, cờ, thông, la bàn. Toàn bộ là nét, màu theo
// `currentColor`; mỗi nét có `pathLength=1` để CSS vẽ dần khi cuộn tới.

import type { CSSProperties } from 'react'

const SHAPES = {
  dashArrow: { box: '0 0 120 24', d: ['M4 12h12', 'M24 12h12', 'M44 12h68', 'M100 4l12 8-12 8'] },
  squiggle: { box: '0 0 80 20', d: ['M2 12c6-8 12-8 18 0s12 8 18 0 12-8 18 0 12 8 18 0'] },
  square: { box: '0 0 24 24', d: ['M6 5l13 1.5-1.5 13L4.5 18z'] },
  star: { box: '0 0 48 48', d: ['M24 6l5.2 11 12 1.6-8.8 8.3 2.3 11.9L24 33l-10.7 5.8 2.3-11.9-8.8-8.3 12-1.6z'] },
  smiley: { box: '0 0 48 48', d: ['M24 6a18 18 0 1 0 .1 0z', 'M17.5 19.5v2.5', 'M30.5 19.5v2.5', 'M16 29c4.5 5.5 11.5 5.5 16 0'] },
  heart: { box: '0 0 48 48', d: ['M24 40S8 30.5 8 19.5a8 8 0 0 1 16-2.5 8 8 0 0 1 16 2.5C40 30.5 24 40 24 40z'] },
  hash: { box: '0 0 48 48', d: ['M19 8l-5 32', 'M33 8l-5 32', 'M9 18h31', 'M7 30h31'] },
  check: { box: '0 0 48 48', d: ['M24 5a19 19 0 1 0 .1 0z', 'M15 24.5l6.5 6.5L34 17.5'] },
  peaks: { box: '0 0 64 40', d: ['M2 38L20 10l10 15 7-9 25 22', 'M15.5 17l4.5 4 4.5-4'] },
  tent: { box: '0 0 56 44', d: ['M6 40L28 6l22 34', 'M28 6v34', 'M21 40l7-11 7 11', 'M2 40h52'] },
  flag: { box: '0 0 40 48', d: ['M10 44V4', 'M10 6c8-4 14 4 22 0v16c-8 4-14-4-22 0'] },
  pine: { box: '0 0 40 52', d: ['M20 4l-9 13h6l-8 11h6l-9 12h28l-9-12h6l-8-11h6z', 'M20 40v9'] },
  compass: { box: '0 0 48 48', d: ['M24 5a19 19 0 1 0 .1 0z', 'M24 12l5 12-5 12-5-12z', 'M24 9v-2', 'M24 41v-2'] },
  sun: { box: '0 0 48 48', d: ['M24 15a9 9 0 1 0 .1 0z', 'M24 3v6', 'M24 39v6', 'M3 24h6', 'M39 24h6', 'M9 9l4 4', 'M35 35l4 4', 'M39 9l-4 4', 'M13 35l-4 4'] },
  arrowUp: { box: '0 0 40 64', d: ['M21 60c-1-16 1-34-1-54', 'M8 19c4-5 8-10 12-14 4 4 8 9 12 14'] },
  loopArrow: { box: '0 0 150 120', d: ['M146 6c-8 34-46 52-74 46-18-4-22-24-6-28 18-4 24 18 6 34-14 13-40 30-66 52', 'M6 110l14-3', 'M6 110l1-14'] },
  bubble: {
    box: '0 0 120 92',
    d: [
      'M16 8h88a11 11 0 0 1 11 11v38a11 11 0 0 1-11 11H52L34 86l3-18H16A11 11 0 0 1 5 57V19A11 11 0 0 1 16 8z',
      'M22 56l14-20 8 10 6-7 13 17',
      'M72 28h30',
      'M72 38h30',
      'M72 48h18',
    ],
  },
  signalOff: { box: '0 0 48 48', d: ['M10 38v3', 'M18 32v9', 'M26 26v15', 'M34 19v22', 'M6 9l36 34'] },
} as const

export type DoodleKind = keyof typeof SHAPES

export function Doodle({
  kind, size = 32, className, style, title,
}: {
  kind: DoodleKind
  /** Chiều RỘNG (px); chiều cao theo tỉ lệ hình. */
  size?: number
  className?: string
  style?: CSSProperties
  title?: string
}) {
  const s = SHAPES[kind]
  const [, , w, h] = s.box.split(' ').map(Number)
  return (
    <svg
      className={`st-doodle${className ? ` ${className}` : ''}`}
      viewBox={s.box}
      width={size}
      height={(size * h) / w}
      fill="none"
      stroke="currentColor"
      // Nét luôn ~1,6 px trên màn dù hình to nhỏ (đơn vị viewBox ↔ px).
      strokeWidth={(1.6 * w) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {s.d.map((d, i) => (
        <path key={i} d={d} pathLength={1} style={{ transitionDelay: `${i * 60}ms` }} />
      ))}
    </svg>
  )
}
