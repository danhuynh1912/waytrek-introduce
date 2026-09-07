import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

/** Theme: mặc định theo hệ thống, người dùng bấm thì ghi nhớ trong localStorage. */
export function useTheme(): [ThemeMode, () => void] {
  const read = (): ThemeMode => {
    const forced = document.documentElement.dataset.theme
    if (forced === 'dark' || forced === 'light') return forced
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const [mode, setMode] = useState<ThemeMode>(read)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const f = () => { if (!document.documentElement.dataset.theme) setMode(mq.matches ? 'dark' : 'light') }
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

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
