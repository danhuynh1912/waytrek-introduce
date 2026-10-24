import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ThemeMode } from '@/hooks/useTheme'
import { avatarUrl, displayName, signOut } from '../data/auth'
import { navigate } from './route'

const Sun = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)

export function AppBar({
  session,
  mode,
  onToggleTheme: toggle,
  onLogin,
}: {
  session: Session | null
  mode: ThemeMode
  onToggleTheme: () => void
  onLogin: () => void
}) {
  return (
    <header className="pl-top">
      <a className="pl-brand" href="/" aria-label="WayTrek — trang chủ">
        <img src="/icon-256.png" alt="" width={26} height={26} />
        <span className="pl-brand-name">WayTrek</span>
        <span className="pl-brand-sub">Kế hoạch</span>
      </a>
      <nav className="pl-top-right">
        {session && (
          <a
            className="pl-link"
            href="/plan"
            onClick={(e) => {
              e.preventDefault()
              navigate('/plan')
            }}
          >
            Kế hoạch của tôi
          </a>
        )}
        <button
          type="button"
          className="pl-icon-btn"
          onClick={toggle}
          aria-label={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          title={mode === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        >
          {mode === 'dark' ? <Sun /> : <Moon />}
        </button>
        {session ? <Account session={session} /> : (
          <button type="button" className="pl-btn pl-btn-quiet" onClick={onLogin}>Đăng nhập</button>
        )}
      </nav>
    </header>
  )
}

function Account({ session }: { session: Session }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const name = displayName(session)
  const avatar = avatarUrl(session)
  return (
    <div className="pl-account" ref={box}>
      <button type="button" className="pl-avatar-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Tài khoản: ${name}`}>
        {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
      </button>
      <div className={`pl-menu${open ? ' is-open' : ''}`} role="menu">
        <div className="pl-menu-head">
          <b>{name}</b>
          {session.user.email && <small>{session.user.email}</small>}
        </div>
        <button
          type="button"
          role="menuitem"
          className="pl-menu-item"
          onClick={() => {
            setOpen(false)
            void signOut()
          }}
        >
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
