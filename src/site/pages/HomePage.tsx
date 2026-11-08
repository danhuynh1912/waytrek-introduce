// Trang chủ waytrek.site — dựng theo bản vẽ "Trang web waytrek.site" trên canvas
// "WayTrek — bản vẽ các màn" (5/11): nền tối, một màu nhấn lime, chữ lớn + máy
// nằm nghiêng. Sáu khối: mở đầu · bản đồ đỉnh · di sản · tính năng · chia sẻ ·
// kêu gọi tải. Màn trong máy là ảnh chụp thật của app (public/screens/lp-*).
// Khối này CỐ Ý luôn tối (`wt-dark` ở SiteApp) — bản vẽ chỉ có nền tối.

import '../home.css'
import type { CSSProperties, ReactNode } from 'react'
import { playUrlFor, storeUrlFor } from '@/shared/links'
import { useI18n } from '../../i18n/context'
import { fill } from '../../i18n/text'
import { Link } from '../ui/Link'
import { usePageMeta } from '../ui/page-meta'
import { Phone } from '../ui/Phone'
import { useCatalog } from '../ui/use-catalog'
import { useReveal } from '../ui/use-reveal'

const SHOT = {
  trail: '/screens/lp-ban-do-cung.jpg',
  peaks: '/screens/lp-ban-do-dinh.jpg',
  legacy: '/screens/lp-di-san.jpg',
  recording: '/screens/lp-dang-ghi.jpg',
  post: '/screens/lp-bai-viet.jpg',
}

export function HomePage() {
  const { m, fmt } = useI18n()
  usePageMeta({ title: m.seo.home.title, description: m.seo.home.description, path: '/' })
  const [catalog] = useCatalog()
  // Chưa tải được danh mục thì nói "gần 80" như bản vẽ — đúng văn phạm từng ngôn ngữ nằm ở câu chữ.
  const trails = catalog.status === 'ready' ? fmt.count(catalog.data.length) : m.home.peaks.countFallback
  const peaks = m.home.peaks

  return (
    <div className="lp">
      <Hero />
      <Showcase
        reverse
        title={[...peaks.lines.map((l) => fill(l, { n: trails })), <Dim key="d">{peaks.dim}</Dim>]}
        caption={{
          icon: 'map',
          label: peaks.label,
          text: fill(peaks.text, { n: trails }),
          action: <Link to="/map" className="lp-cap-link" data-tip={peaks.linkTip}>{peaks.link} <Arrow /></Link>,
        }}
        shot={SHOT.peaks}
        alt={peaks.alt}
      />
      <Statement />
      <Features />
      <Showcase
        title={[...m.home.share.lines, <Dim key="d">{m.home.share.dim}</Dim>]}
        caption={{ icon: 'flag', label: m.home.share.label, text: m.home.share.text }}
        shot={SHOT.post}
        alt={m.home.share.alt}
      />
      <Closing />
    </div>
  )
}

/* ---------- Biểu tượng (nét, cùng bộ với bản vẽ) ---------- */

type IconName = 'map' | 'flag' | 'nav' | 'users' | 'buoy' | 'mount' | 'check' | 'wifiOff'

const ICON: Record<IconName, ReactNode> = {
  map: <><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  nav: <path d="M12 2.5 19.5 21 12 16.8 4.5 21z" fill="currentColor" stroke="none" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c1.9.7 3.2 2.6 3.5 5.3" /></>,
  buoy: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.6" /><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" /></>,
  mount: <path d="m3 19 6.5-11 3.5 5.5 2.5-3.5L21 19z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="2.2" />,
  wifiOff: <path d="M2 8.8a15 15 0 0 1 4.2-2.7M10.7 4.2A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5-2.6M14.7 10.5a10 10 0 0 1 4.3 2.4M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />,
}

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[name]}
    </svg>
  )
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

/** Phần chữ mờ của một tiêu đề (dòng thứ hai trở đi trong bản vẽ). */
const Dim = ({ children }: { children: ReactNode }) => <span className="lp-dim">{children}</span>

/* ---------- Mảnh dùng chung ---------- */

interface CaptionProps {
  icon: IconName
  label: string
  text: string
  action?: ReactNode
}

/** Chú thích nhỏ cạnh máy: vòng icon · "Nhãn /" · một đoạn chữ. */
function Caption({ icon, label, text, action, className }: CaptionProps & { className: string }) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div className={`lp-cap st-reveal ${className}`} ref={ref}>
      <span className="lp-cap-icon"><Icon name={icon} size={16} /></span>
      <p className="lp-cap-label">{label} /</p>
      <p className="lp-cap-text">{text}</p>
      {action}
    </div>
  )
}

function Stores({ className = '' }: { className?: string }) {
  const { locale, m } = useI18n()
  return (
    <div className={`lp-stores ${className}`}>
      <a className="lp-pill is-white" href={storeUrlFor(locale)} target="_blank" rel="noopener" data-tip={m.home.appStoreTip}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" /></svg>
        {m.home.appStore}
      </a>
      <a className="lp-pill is-line" href={playUrlFor(locale)} target="_blank" rel="noopener" data-tip={m.home.googlePlayTip}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M5 3.8v16.4c0 .7.8 1.2 1.4.8l13.4-8.2c.6-.4.6-1.2 0-1.6L6.4 3c-.6-.4-1.4.1-1.4.8z" /></svg>
        {m.home.googlePlay}
      </a>
    </div>
  )
}

/** Quầng sáng lime dâng từ góc (công thức WtGlowPainter của app, mép tan dần). */
const Glow = ({ className }: { className: string }) => <div className={`lp-glow ${className}`} aria-hidden="true" />

/* ---------- Các khối ---------- */

function Hero() {
  const { m } = useI18n()
  const phone = useReveal<HTMLDivElement>()
  return (
    <section className="lp-hero">
      <Glow className="lp-glow-hero" />
      <p className="lp-bgword" aria-hidden="true">WAYTREK</p>
      <svg className="lp-streak" viewBox="0 0 1440 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="lp-bl1" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="34" /></filter>
          <filter id="lp-bl2" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
          <linearGradient id="lp-sg" x1="0" x2="1">
            <stop offset="0" stopColor="#BDFE2E" stopOpacity=".15" />
            <stop offset=".45" stopColor="#BDFE2E" />
            <stop offset="1" stopColor="#9BD020" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <path d="M -160 470 C 260 520, 640 600, 980 680 C 1180 727, 1340 752, 1620 770" fill="none" stroke="url(#lp-sg)" strokeWidth="150" filter="url(#lp-bl1)" />
        <path d="M -160 470 C 260 520, 640 600, 980 680 C 1180 727, 1340 752, 1620 770" fill="none" stroke="#EEFFC0" strokeOpacity=".85" strokeWidth="16" filter="url(#lp-bl2)" />
      </svg>
      <div className="lp-in">
        <div className="lp-stage lp-hero-stage">
          <p className="lp-kicker">{m.home.kicker[0]}<br />{m.home.kicker[1]}</p>
          <h1 className="lp-h1"><span>{m.home.title[0]}</span><span>{m.home.title[1]}</span></h1>
          <div className="lp-side">
            <p>{m.home.tagline[0]}<br />{m.home.tagline[1]}</p>
            <Stores className="is-stack" />
          </div>
          <div className="lp-hero-phone st-reveal" ref={phone}>
            <Phone src={SHOT.trail} alt={m.home.trail.alt} eager />
          </div>
          <div className="lp-float" aria-hidden="true"><Icon name="wifiOff" size={40} /></div>
          <Caption
            className="lp-hero-cap"
            icon="map"
            label={m.home.trail.label}
            text={m.home.trail.text}
          />
        </div>
      </div>
    </section>
  )
}

function Showcase({ title, caption, shot, alt, reverse = false }: {
  title: ReactNode[]
  caption: CaptionProps
  shot: string
  alt: string
  reverse?: boolean
}) {
  const head = useReveal<HTMLHeadingElement>()
  const art = useReveal<HTMLDivElement>()
  return (
    <section className={`lp-show${reverse ? ' is-reverse' : ''}`}>
      <div className="lp-in">
        <div className="lp-stage lp-show-stage">
          <h2 className="lp-h2 lp-show-title st-reveal" ref={head}>
            {title.map((t, i) => (typeof t === 'string' ? <span key={i}>{t}</span> : t))}
          </h2>
          <Caption className="lp-show-cap" {...caption} />
          <div className="lp-show-art st-reveal" ref={art}>
            <Phone src={shot} alt={alt} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Độ sáng đích của một dòng tuyên ngôn — CSS đọc qua biến `--o`. */
const lineOpacity = (o: number) => ({ '--o': o }) as CSSProperties

/** Độ sáng đích của từng dòng tuyên ngôn, từ dòng 1 tới dòng 4 (bản vẽ). */
const LEGACY_OPACITY = [1, 0.74, 0.5, 0.32]

/** Tên đỉnh là danh từ riêng — giữ nguyên ở mọi ngôn ngữ; độ cao viết theo quy ước số của ngôn ngữ. */
const RECENT = [
  { name: 'Fansipan', heightM: 3143 },
  { name: 'Tà Xùa', heightM: 2865 },
  { name: 'Lảo Thẩn', heightM: 2860 },
]

function Statement() {
  const { m, fmt } = useI18n()
  const lg = m.home.legacy
  const art = useReveal<HTMLDivElement>()
  return (
    <section className="lp-stm">
      <div className="lp-in">
        <div className="lp-stage lp-stm-stage">
          {/* Từng dòng sáng dần theo cuộn (CSS scroll-driven, có đường lui tĩnh). */}
          <h2 className="lp-h2 lp-stm-title">
            {lg.lines.map((line, i) => <span key={i} style={lineOpacity(LEGACY_OPACITY[i])}>{line}</span>)}
          </h2>
          <Caption className="lp-stm-cap" icon="flag" label={lg.label} text={lg.text} />
          <div className="lp-stm-art st-reveal" ref={art}>
            <Phone src={SHOT.legacy} alt={lg.alt} className="lp-stm-phone" />
            <div className="lp-frag" aria-label={lg.recentLabel}>
              <p className="lp-frag-head"><Icon name="check" size={16} />{lg.recent}</p>
              <ul>
                {RECENT.map((r) => (
                  <li key={r.name}>
                    <span className="lp-frag-icon"><Icon name="mount" /></span>
                    <span><b>{r.name}</b><em>{fmt.meters(r.heightM)}</em></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Icon của năm tính năng, theo thứ tự `m.home.features.items`. */
const FEATURE_ICONS: IconName[] = ['map', 'nav', 'flag', 'users', 'buoy']

function Features() {
  const { m } = useI18n()
  const f = m.home.features
  const art = useReveal<HTMLDivElement>()
  const list = useReveal<HTMLOListElement>()
  return (
    <section className="lp-fts">
      <div className="lp-in lp-fts-in">
        <div className="lp-fts-left st-reveal" ref={art}>
          <p className="lp-sec-label">{f.label} /</p>
          <Phone src={SHOT.recording} alt={f.alt} className="lp-fts-phone" />
        </div>
        <ol className="lp-fts-list st-reveal" ref={list}>
          {f.items.map((it, i) => (
            <li key={it.title}>
              <span className="lp-fts-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </div>
              <span className="lp-fts-icon"><Icon name={FEATURE_ICONS[i]} /></span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Closing() {
  const { m } = useI18n()
  const ref = useReveal<HTMLDivElement>()
  return (
    <section className="lp-cta" id="tai-app">
      <Glow className="lp-glow-cta" />
      <div className="lp-cta-in st-reveal" ref={ref}>
        <h2 className="lp-h2 lp-cta-title">{m.home.cta.lines.map((l, i) => <span key={i}>{l}</span>)}<Dim>{m.home.cta.dim}</Dim></h2>
        <p>{m.home.cta.text}</p>
        <Stores className="is-center" />
      </div>
    </section>
  )
}
