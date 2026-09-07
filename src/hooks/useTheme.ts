import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

/**
 * Theme: mặc định TỐI như app, không theo hệ thống. Script inline trong
 * index.html đã đóng dấu `data-theme` trước khi React chạy nên không có
 * nhấp nháy; bấm nút thì ghi nhớ trong localStorage.
 */
export function useTheme(): [ThemeMode, () => void] {
  const read = (): ThemeMode => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const [mode, setMode] = useState<ThemeMode>(read)

  const toggle = useCallback(() => {
    const next: ThemeMode = read() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('wt-theme', next) } catch { /* private mode */ }
    setMode(next)
  }, [])

  return [mode, toggle]
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return r
}
