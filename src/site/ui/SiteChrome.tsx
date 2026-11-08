// Đầu trang + chân trang của waytrek.site (trang chủ, khám phá, trang cung).
// /plan có thanh riêng vì nó là ứng dụng toàn màn.

import { lazy, Suspense, useEffect, useState } from 'react'
import type { ThemeMode } from '@/hooks/useTheme'
import { DELETE_ACCOUNT_URL, PRIVACY_URL, TERMS_URL, playUrlFor, storeUrlFor } from '@/shared/links'
import { Wordmark } from '@/shared/Wordmark'
import { useI18n } from '../../i18n/context'
import { fill } from '../../i18n/text'
import type { SiteRoute } from '../core/routes'
import { LanguageSwitch } from './LanguageSwitch'
import { Link } from './Link'

const Account = lazy(() => import('./Account'))

const Sun = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)

export function SiteHeader({ page, mode, onToggleTheme }: { page: SiteRoute['page']; mode: ThemeMode; onToggleTheme(): void }) {
  const { locale, m } = useI18n()
  // Viền dưới chỉ hiện khi đã cuộn — ở đầu trang, đầu trang tan vào nền giấy.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const dark = mode === 'dark'
  const toggleLabel = dark ? m.chrome.toLight : m.chrome.toDark
  return (
    <header className={`st-head${scrolled || page === 'map' ? ' is-scrolled' : ''}${page === 'home' ? ' is-over-hero' : ''}`}>
      <div className="st-head-in">
        <Link to="/" className="st-brand" aria-label={m.chrome.homeLabel} data-tip={m.chrome.homeTip}>
          <Wordmark />
        </Link>
        <nav className="st-nav" aria-label={m.chrome.navLabel}>
          <Link to="/map" className={page === 'map' || page === 'trail' ? 'is-on' : undefined} data-tip={m.chrome.exploreTip}>
            {m.chrome.explore}
          </Link>
          <a href="/plan" data-tip={m.chrome.planTip}>
            <span className="st-nav-long">{m.chrome.plan}</span><span className="st-nav-short">{m.chrome.planShort}</span>
          </a>
        </nav>
        <div className="st-head-right">
          <LanguageSwitch variant="icon" />
          <button type="button" className="st-icon-btn" onClick={onToggleTheme} aria-label={toggleLabel} data-tip={toggleLabel}>
            {dark ? <Sun /> : <Moon />}
          </button>
          <Suspense fallback={<span className="st-account-slot" aria-hidden="true" />}>
            <Account />
          </Suspense>
          <a className="st-btn st-btn-primary st-head-cta" href={storeUrlFor(locale)} target="_blank" rel="noopener" data-tip={m.chrome.getAppTip}>{m.chrome.getApp}</a>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const { locale, m } = useI18n()
  return (
    <footer className="st-foot">
      <div className="st-wrap st-foot-grid">
        <div className="st-foot-brand">
          <Link to="/" className="st-brand" aria-label={m.chrome.homeLabel}><Wordmark /></Link>
          <p>{m.chrome.footAbout}</p>
        </div>
        <nav aria-label={m.chrome.footExplore}>
          <h3>{m.chrome.footExplore}</h3>
          <Link to="/map">{m.chrome.footMap}</Link>
          <a href="/plan">{m.chrome.footPlan}</a>
        </nav>
        <nav aria-label={m.chrome.footApp}>
          <h3>{m.chrome.footApp}</h3>
          <a href={storeUrlFor(locale)} target="_blank" rel="noopener">{m.chrome.footAppStore}</a>
          <a href={playUrlFor(locale)} target="_blank" rel="noopener">{m.chrome.footPlay}</a>
        </nav>
        <nav aria-label={m.chrome.footLegal}>
          <h3>{m.chrome.footLegal}</h3>
          <a href={PRIVACY_URL} target="_blank" rel="noopener">{m.chrome.privacy}</a>
          <a href={TERMS_URL} target="_blank" rel="noopener">{m.chrome.terms}</a>
          <a href={DELETE_ACCOUNT_URL} target="_blank" rel="noopener">{m.chrome.deleteAccount}</a>
        </nav>
      </div>
      <div className="st-wrap st-foot-base">
        <span>{fill(m.chrome.copyright, { year: new Date().getFullYear() })}</span>
        <LanguageSwitch variant="field" />
      </div>
    </footer>
  )
}
