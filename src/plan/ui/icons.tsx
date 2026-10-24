// Icon nét 24×24, cùng kiểu với `components/Header.tsx`. Màu theo chữ (currentColor).

import type { ReactNode } from 'react'

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const IUndo = (p: P) => <Svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>
export const IRedo = (p: P) => <Svg {...p}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>
export const ILayers = (p: P) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></Svg>
export const ISliders = (p: P) => <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>
export const IPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IMinus = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>
export const IFit = (p: P) => <Svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>
export const ISearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>
export const IClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
export const ITrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>
export const IUp = (p: P) => <Svg {...p}><path d="m6 15 6-6 6 6" /></Svg>
export const IDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
export const IMoon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" /></Svg>
export const ICar = (p: P) => <Svg {...p}><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v2H3z" /><circle cx="7.5" cy="13" r="0.6" /><circle cx="16.5" cy="13" r="0.6" /></Svg>
export const IWalk = (p: P) => <Svg {...p}><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 2-1 3" /></Svg>
export const ITent = (p: P) => <Svg {...p}><path d="M3 20 12 4l9 16H3z" /><path d="M12 4v16M9 20l3-6 3 6" /></Svg>
export const IRoute = (p: P) => <Svg {...p}><circle cx="6" cy="5.5" r="2" /><circle cx="18" cy="12" r="2" /><circle cx="6" cy="18.5" r="2" /><path d="M8 5.5h3.5a4.5 4.5 0 0 1 4.5 4.5M16 14a4.5 4.5 0 0 1-4.5 4.5H8" /></Svg>
export const IPeak = (p: P) => <Svg {...p}><path d="m3 20 7-12 4 6 2-3 5 9H3z" /><path d="m8.5 11 1.5 1.5 1.5-1.5" /></Svg>
export const IWarn = (p: P) => <Svg {...p}><path d="M12 4 2.5 20h19L12 4z" /><path d="M12 10v4.5M12 17.5v.01" /></Svg>
export const IInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 8v.01" /></Svg>
export const ICheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
export const IBack = (p: P) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
export const IReturn = (p: P) => <Svg {...p}><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 0 0-10h-2" /></Svg>
export const IMore = (p: P) => <Svg {...p}><circle cx="5.5" cy="12" r="0.9" /><circle cx="12" cy="12" r="0.9" /><circle cx="18.5" cy="12" r="0.9" /></Svg>
export const IGoogle = ({ size = 18 }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.4-.2-2.1H12v4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-7.9z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
  </svg>
)
