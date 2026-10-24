// Đầu trang + chân trang của waytrek.site (trang chủ, khám phá, trang cung).
// /plan có thanh riêng vì nó là ứng dụng toàn màn.

import { lazy, Suspense, useEffect, useState } from 'react'
import type { ThemeMode } from '@/hooks/useTheme'
import { DELETE_ACCOUNT_URL, PLAY_URL, PRIVACY_URL, STORE_URL, TERMS_URL } from '@/shared/links'
import type { SiteRoute } from '../core/routes'
import { Link } from './Link'

const Account = lazy(() => import('./Account'))

const Sun = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)

export function SiteHeader({ page, mode, onToggleTheme }: { page: SiteRoute['page']; mode: ThemeMode; onToggleTheme(): void }) {
  // Viền dưới chỉ hiện khi đã cuộn — ở đầu trang, đầu trang tan vào nền giấy.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const dark = mode === 'dark'
  return (
    <header className={`st-head${scrolled || page === 'map' ? ' is-scrolled' : ''}`}>
      <div className="st-head-in">
        <Link to="/" className="st-brand" aria-label="WayTrek — trang chủ">
          <img src="/icon-256.png" alt="" width={28} height={28} />
          <span>WayTrek</span>
        </Link>
        <nav className="st-nav" aria-label="Mục chính">
          <Link to="/map" className={page === 'map' || page === 'trail' ? 'is-on' : undefined}>Khám phá</Link>
          <a href="/plan"><span className="st-nav-long">Lên kế hoạch</span><span className="st-nav-short">Kế hoạch</span></a>
        </nav>
        <div className="st-head-right">
          <button
            type="button"
            className="st-icon-btn"
            onClick={onToggleTheme}
            aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={dark ? 'Giao diện sáng' : 'Giao diện tối'}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          <Suspense fallback={<span className="st-account-slot" aria-hidden="true" />}>
            <Account />
          </Suspense>
          <a className="st-btn st-btn-primary st-head-cta" href={STORE_URL} target="_blank" rel="noopener">Tải app</a>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="st-foot">
      <div className="st-wrap st-foot-grid">
        <div className="st-foot-brand">
          <Link to="/" className="st-brand"><img src="/icon-256.png" alt="" width={28} height={28} /><span>WayTrek</span></Link>
          <p>WayTrek được làm ra cho những người tin rằng mỗi ngọn núi Việt Nam đều xứng đáng có một tấm bản đồ tử tế.</p>
        </div>
        <nav aria-label="Khám phá">
          <h3>Khám phá</h3>
          <Link to="/map">Bản đồ cung núi</Link>
          <a href="/plan">Lên kế hoạch chuyến đi</a>
        </nav>
        <nav aria-label="Ứng dụng">
          <h3>Ứng dụng</h3>
          <a href={STORE_URL} target="_blank" rel="noopener">App Store</a>
          <a href={PLAY_URL} target="_blank" rel="noopener">CH Play</a>
        </nav>
        <nav aria-label="Pháp lý">
          <h3>Pháp lý</h3>
          <a href={PRIVACY_URL} target="_blank" rel="noopener">Quyền riêng tư</a>
          <a href={TERMS_URL} target="_blank" rel="noopener">Điều khoản</a>
          <a href={DELETE_ACCOUNT_URL} target="_blank" rel="noopener">Xoá tài khoản</a>
        </nav>
      </div>
      <div className="st-wrap st-foot-base">© {new Date().getFullYear()} WayTrek. Dữ liệu bản đồ © OpenStreetMap.</div>
    </footer>
  )
}
