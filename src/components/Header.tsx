import { STORE_URL } from '@/data/screens'
import type { ThemeMode } from '@/hooks/useTheme'

const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)
export const Apple = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7 4.5 8 3.6 9.5c-1.9 3.3-.5 8.1 1.4 10.8.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.5.9c1.5 0 2.4-1.3 3.3-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-2.9-1.1-2.8-4.6zM13.9 5.3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z" /></svg>
)

export function Header({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  return (
    <header className="header">
      <a className="brand" href="/" aria-label="WayTrek">
        <img className="brand-mark" src="/icon-256.png" alt="" width={30} height={30} />
        <span className="brand-name">WayTrek</span>
        <span className="brand-sub">Cung núi Việt Nam</span>
      </a>
      <div className="header-right">
        <button className="icon-btn" onClick={onToggle} aria-label={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} title={mode === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}>
          {mode === 'dark' ? <Sun /> : <Moon />}
        </button>
        <a className="cta" href={STORE_URL} target="_blank" rel="noopener">
          <Apple /><span>Tải trên App Store</span>
        </a>
      </div>
    </header>
  )
}
