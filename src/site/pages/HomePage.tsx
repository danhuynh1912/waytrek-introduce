// Trang chủ waytrek.site — bố cục theo bản mẫu "case study": mở đầu chữ lớn +
// cụm màn hình nằm nghiêng, khối tổng quan có số liệu, cặp "nỗi lo / lời đáp"
// đổi bên, rồi tới nội dung thật của app (cung được leo nhiều nhất) và các
// tính năng. Một đường mòn nét đứt nối các khối từ trên xuống, cắm cờ ở danh
// sách cung thật — đích của đường mòn là nội dung, không phải nút tải app.

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { count } from '@/shared/format'
import { PLAY_URL, STORE_URL } from '@/shared/links'
import { DEFAULT_FILTER, filterTrails } from '../core/trails'
import type { DifficultyBoard } from '../core/difficulty'
import type { TrailSummary } from '../core/trails'
import { Link } from '../ui/Link'
import { Doodle } from '../ui/Doodle'
import { usePageMeta } from '../ui/page-meta'
import { Phone } from '../ui/Phone'
import { SketchMap } from '../ui/SketchMap'
import { TrailCard } from '../ui/TrailCard'
import { TrailConnector } from '../ui/TrailConnector'
import { useCatalog, useCatalogCounts, useDifficultyBoard } from '../ui/use-catalog'
import { useReveal } from '../ui/use-reveal'

const SHOT = {
  explore: '/screens/01-kham-pha.jpg',
  terrain: '/screens/02-dia-hinh-3d.jpg',
  offline: '/screens/03-ban-do-offline.jpg',
  tracklog: '/screens/04-track-log.jpg',
  replay: '/screens/05-phat-lai.jpg',
  legacy: '/screens/06-son-pha.jpg',
}

export function HomePage() {
  usePageMeta({
    title: 'WayTrek - Người bạn đồng hành cho trekkers Việt Nam',
    description:
      'WayTrek là bạn đồng hành leo núi: các cung núi Việt Nam với độ khó do người leo xếp hạng, bản đồ offline, địa hình 3D, ghi và phát lại hành trình, AI gọi tên cây cỏ trên đường.',
    path: '/',
  })
  const [catalog, retry] = useCatalog()
  const counts = useCatalogCounts()
  const board = useDifficultyBoard()
  const root = useRef<HTMLDivElement>(null)
  const trails = catalog.status === 'ready' ? catalog.data : null
  const trailCount = trails?.length ?? null

  return (
    <div className="st-home" ref={root}>
      <TrailConnector rootRef={root} />
      <Hero trailCount={trailCount} />
      <Overview
        items={[
          { icon: 'peaks', value: trailCount, label: 'Cung núi' },
          { icon: 'route', value: counts?.routes ?? null, label: 'Lộ trình' },
          { icon: 'flag', value: counts?.boardConquests ?? null, label: 'Lượt ghi danh' },
          { icon: 'pin', value: counts?.pois ?? null, label: 'Điểm đánh dấu' },
        ]}
      />
      <Worries />
      <Answers />
      <Popular
        state={catalog.status}
        trails={trails ? filterTrails(trails, DEFAULT_FILTER).slice(0, 6) : []}
        total={trailCount}
        board={board}
        onRetry={retry}
      />
      <Feature
        eyebrow="Địa hình 3D"
        title="Nhìn thấy con dốc trước khi đôi chân gặp nó"
        body="Bạn xoay, nghiêng và phóng to quanh đỉnh núi ngay trên điện thoại. Dữ liệu độ cao thật cho bạn biết đoạn nào dựng đứng, lán nghỉ nằm ở khúc quanh nào và lối mòn dẫn lên tới đâu."
        art={<Phone src={SHOT.terrain} alt="Màn địa hình 3D của một cung núi trong app WayTrek" />}
        doodle="compass"
      />
      <Feature
        reverse
        eyebrow="Phát lại hành trình"
        title="Đi xong, ngọn núi kể lại chuyến đi cho bạn"
        body="Camera bay theo đúng con đường bạn đã bước, kèm độ cao và quãng đường của từng chặng. Một lần quay màn hình là bạn có ngay thước phim để kể cho người ở nhà nghe."
        art={<Phone src={SHOT.replay} alt="Màn phát lại hành trình trên địa hình 3D trong app WayTrek" />}
        doodle="sun"
      />
      <Feature
        eyebrow="Sơn phả và Bảng Vàng"
        title="Mỗi đỉnh núi là một dòng trong gia phả của bạn"
        body="WayTrek ghi danh bạn ngay khoảnh khắc bạn chạm tới đỉnh. Sơn phả dày lên theo từng chuyến đi, Bảng Vàng xếp hạng theo mùa, và những danh hiệu như Người Khai Sơn chỉ dành cho người thật sự đặt chân lên tới nơi."
        art={<Phone src={SHOT.legacy} alt="Màn Sơn phả với các huy chương đỉnh núi trong app WayTrek" />}
        doodle="star"
      />
      <Feature
        reverse
        eyebrow="Lên kế hoạch"
        title="Chuyến đi bắt đầu từ bàn làm việc của bạn"
        body="Bạn chọn những đỉnh muốn leo, WayTrek tự chia chặng theo sức đi, gợi ý lán nghỉ và tính giờ xuất phát để bạn đứng trên đỉnh đúng lúc mặt trời lên."
        art={<PlanNote />}
        doodle="tent"
        action={<a className="st-btn st-btn-primary" href="/plan">Mở trang lên kế hoạch</a>}
      />
      <Closing />
    </div>
  )
}

function Hero({ trailCount }: { trailCount: number | null }) {
  const copy = useReveal<HTMLDivElement>()
  const art = useReveal<HTMLDivElement>()
  return (
    <section className="st-hero">
      <div className="st-wrap st-hero-grid">
        <div className="st-hero-copy st-reveal" ref={copy}>
          <Doodle kind="dashArrow" size={96} className="st-d st-d-lead" />
          <p className="st-eyebrow"><b>WayTrek</b><span>Sổ tay của người leo núi Việt</span></p>
          <h1 className="st-h1">Mỗi cung núi đều có người đi trước</h1>
          <p className="st-lead">
            WayTrek gom những lối mòn mà cộng đồng người leo đã ghi lại bằng chính bước chân của họ, rồi đặt tất cả vào túi áo bạn.
            Khi vạch sóng cuối cùng tắt ở chân núi, tấm bản đồ ấy vẫn sáng trên màn hình.
          </p>
          <div className="st-cta-row">
            <Link to="/map" className="st-btn st-btn-primary st-btn-lg">
              {trailCount ? `Khám phá ${trailCount} cung núi` : 'Khám phá các cung núi'}
            </Link>
            <a className="st-btn st-btn-ghost st-btn-lg" href="#tai-app">Tải ứng dụng</a>
          </div>
          <Doodle kind="squiggle" size={72} className="st-d st-d-squiggle" />
          <Doodle kind="smiley" size={26} className="st-d st-d-smiley" />
          <Doodle kind="square" size={12} className="st-d st-d-sq1" />
        </div>
        <div className="st-hero-art st-reveal" ref={art} data-trail-anchor data-ax="0.18" data-ay="0.96">
          <div className="st-iso">
            <div className="st-iso-col">
              <Phone src={SHOT.explore} alt="Màn khám phá cung núi" eager />
              <Phone src={SHOT.tracklog} alt="Màn ghi hành trình" />
            </div>
            <div className="st-iso-col">
              <Phone src={SHOT.legacy} alt="Màn Sơn phả" eager />
              <Phone src={SHOT.offline} alt="Màn bản đồ offline" />
            </div>
            <div className="st-iso-col">
              <Phone src={SHOT.terrain} alt="Màn địa hình 3D" eager />
              <Phone src={SHOT.replay} alt="Màn phát lại hành trình" />
            </div>
          </div>
          <Doodle kind="bubble" size={104} className="st-d st-d-bubble" />
          <Doodle kind="square" size={12} className="st-d st-d-sq2" />
          <Doodle kind="star" size={22} className="st-d st-d-star" />
          <Doodle kind="arrowUp" size={22} className="st-d st-d-up" />
        </div>
      </div>
    </section>
  )
}

type StatIcon = 'peaks' | 'route' | 'flag' | 'pin'

const STAT_ICON: Record<StatIcon, ReactNode> = {
  peaks: <path d="M3 19 9.5 8l4 6 2.5-3.5L21 19z" />,
  route: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h5a3.5 3.5 0 0 1 0 7h-2a3.5 3.5 0 0 0 0 7h5" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 5c4-2 7 2 12 0v8c-5 2-8-2-12 0" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
}

function Overview({ items }: { items: { icon: StatIcon; value: number | null; label: string }[] }) {
  const fan = useReveal<HTMLDivElement>()
  const copy = useReveal<HTMLDivElement>()
  return (
    <section className="st-overview">
      <div className="st-wrap st-overview-grid">
        <div className="st-fan st-reveal" ref={fan} data-trail-anchor data-ax="0.62" data-ay="0.08">
          <Phone src={SHOT.replay} alt="" className="st-fan-back" />
          <Phone src={SHOT.terrain} alt="" className="st-fan-mid" />
          <Phone src={SHOT.explore} alt="Màn khám phá cung núi của app WayTrek" className="st-fan-front" />
          <Doodle kind="check" size={40} className="st-d st-d-check" />
        </div>
        <div className="st-overview-copy st-reveal" ref={copy}>
          <h2 className="st-h2 st-h2-plain">Tấm bản đồ do chính người leo vẽ nên</h2>
          <p className="st-body">
            Mỗi lộ trình trên WayTrek bắt đầu từ một chuyến đi có thật. Một người bấm ghi ở chân núi, bước tới đỉnh, rồi gửi tracklog
            về để đội ngũ WayTrek thẩm định. Nhờ vậy, từng con số về quãng đường, độ cao và từng ngã ba bạn thấy trên màn hình đều đã có
            người đứng ở đó trước bạn.
          </p>
          <ul className="st-stats">
            {items.map((s) => (
              <li key={s.label}>
                <span className="st-stat-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{STAT_ICON[s.icon]}</svg>
                </span>
                <span className="st-stat-text">
                  <b className={s.value == null ? 'is-pending' : undefined}>{s.value == null ? '—' : count(s.value)}</b>
                  <span>{s.label}</span>
                </span>
              </li>
            ))}
          </ul>
          <Doodle kind="squiggle" size={64} className="st-d st-d-squiggle2" />
        </div>
      </div>
    </section>
  )
}

function SplitHeading({ accent, rest }: { accent: string; rest: string }) {
  return (
    <h2 className="st-h2">
      <span className="st-h2-accent">{accent}</span> {rest}
    </h2>
  )
}

function Worries() {
  const copy = useReveal<HTMLDivElement>()
  const art = useReveal<HTMLDivElement>()
  return (
    <section className="st-split">
      <div className="st-wrap st-split-grid">
        <div className="st-split-copy st-reveal" ref={copy}>
          <SplitHeading accent="Nỗi lo" rest="trên núi" />
          <ul className="st-bullets is-worry">
            <li>Vạch sóng cuối cùng thường tắt ngay ở chân núi, đúng lúc bạn cần tra đường nhất.</li>
            <li>Lời review “dễ lắm” trên mạng chỉ đúng với người viết, còn đôi chân bạn thì phải tự kiểm chứng.</li>
            <li>Một ngã ba không biển báo đủ sức kéo cả đoàn đi lạc nửa ngày giữa rừng.</li>
            <li>Tin tức về lán nghỉ, nguồn nước và điểm đón xe ôm nằm rải rác trong hàng trăm bài đăng đã cũ.</li>
            <li>Những tấm ảnh đẹp nhất của chuyến đi thường chìm mất trong thư viện điện thoại sau vài tuần.</li>
          </ul>
        </div>
        <div className="st-split-art st-reveal" ref={art} data-trail-anchor data-ax="0.5" data-ay="0.1">
          <SketchMap />
        </div>
      </div>
    </section>
  )
}

function Answers() {
  const copy = useReveal<HTMLDivElement>()
  const art = useReveal<HTMLDivElement>()
  return (
    <section className="st-split is-reverse">
      <div className="st-wrap st-split-grid">
        <div className="st-split-art st-reveal" ref={art} data-trail-anchor data-ax="0.5" data-ay="0.12">
          <div className="st-rings">
            <Phone src={SHOT.offline} alt="Màn bản đồ offline của một cung núi trong app WayTrek" />
          </div>
        </div>
        <div className="st-split-copy st-reveal" ref={copy}>
          <SplitHeading accent="WayTrek" rest="trả lời" />
          <ul className="st-bullets is-answer">
            <li>Bản đồ, lộ trình và các điểm đánh dấu được tải sẵn về máy, nên bạn vẫn biết mình đang đứng ở đâu khi điện thoại báo mất sóng.</li>
            <li>Độ khó của mỗi cung do chính những người đã leo xếp hạng, không do một bài quảng cáo quyết định.</li>
            <li>Từng ngã ba, lán nghỉ và điểm bắt xe ôm đều do người leo đánh dấu tại chỗ, rồi được kiểm duyệt trước khi hiện lên bản đồ.</li>
            <li>Địa hình 3D dựng từ dữ liệu độ cao thật cho bạn thấy con dốc trước khi đôi chân phải gặp nó.</li>
            <li>Ảnh bạn chụp nằm đúng vị trí trên tuyến, và cả chuyến đi được phát lại từ trên cao như một thước phim.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Popular({ state, trails, total, board, onRetry }: {
  state: 'loading' | 'error' | 'ready'
  trails: TrailSummary[]
  total: number | null
  board: DifficultyBoard | null
  onRetry(): void
}) {
  const head = useReveal<HTMLDivElement>()
  return (
    <section className="st-popular" data-trail-anchor data-ax="0.04" data-ay="0.02">
      <div className="st-wrap">
        <div className="st-section-head st-reveal" ref={head}>
          <div>
            <SplitHeading accent="Cung núi" rest="được leo nhiều nhất" />
            <p className="st-body">Thứ tự này thay đổi theo từng lượt ghi danh có thật trên WayTrek.</p>
          </div>
          <Link to="/map" className="st-more">{total ? `Xem cả ${total} cung trên bản đồ` : 'Xem tất cả trên bản đồ'} <span aria-hidden="true">→</span></Link>
        </div>
        {state === 'error' ? (
          <p className="st-error">
            Chưa tải được danh sách cung. <button type="button" className="st-text-btn" onClick={onRetry}>Thử lại</button>
          </p>
        ) : (
          <div className="st-cards" aria-busy={state === 'loading'}>
            {state === 'loading'
              ? Array.from({ length: 6 }, (_, i) => <div key={i} className="st-card is-skeleton" aria-hidden="true"><span className="st-card-img" /><span className="st-card-name" /><span className="st-card-meta" /></div>)
              : trails.map((t) => <TrailCard key={t.id} t={t} board={board} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function Feature({ eyebrow, title, body, art, reverse = false, doodle, action }: {
  eyebrow: string
  title: string
  body: string
  art: ReactNode
  reverse?: boolean
  doodle: 'compass' | 'sun' | 'star' | 'tent'
  action?: ReactNode
}) {
  const copy = useReveal<HTMLDivElement>()
  const pic = useReveal<HTMLDivElement>()
  return (
    <section className={`st-feature${reverse ? ' is-reverse' : ''}`}>
      <div className="st-wrap st-feature-grid">
        <div className="st-feature-art st-reveal" ref={pic}>
          {art}
          <Doodle kind={doodle} size={34} className="st-d st-d-feature" />
        </div>
        <div className="st-feature-copy st-reveal" ref={copy}>
          <p className="st-kicker">{eyebrow}</p>
          <h2 className="st-h3">{title}</h2>
          <p className="st-body">{body}</p>
          {action && <div className="st-cta-row">{action}</div>}
        </div>
      </div>
    </section>
  )
}

/** Tờ lịch trình viết tay — minh hoạ trang lên kế hoạch, không phải ảnh chụp màn. */
function PlanNote() {
  return (
    <div className="st-note" aria-label="Ví dụ một lịch trình hai ngày do trang lên kế hoạch dựng">
      <p className="st-note-day">Ngày 0</p>
      <p><time>19:30</time> xe đón ở Hà Nội, ngủ dưới chân núi</p>
      <p className="st-note-day">Ngày 1</p>
      <p><time>06:30</time> bắt đầu leo từ bản Xà Hồ</p>
      <p><time>15:00</time> nghỉ đêm ở lán 2.800 m</p>
      <p className="st-note-day">Ngày 2</p>
      <p><time>05:35</time> đứng trên đỉnh Tà Chì Nhù đón bình minh</p>
      <Doodle kind="sun" size={30} className="st-d st-d-note" />
    </div>
  )
}

function Closing() {
  const ref = useReveal<HTMLElement>()
  return (
    <section className="st-closing st-reveal" id="tai-app" ref={ref}>
      <div className="st-wrap st-closing-in">
        <h2 className="st-h2 st-h2-plain">Lần leo tới, hãy để WayTrek đi cùng bạn.</h2>
        <p className="st-body">Ứng dụng tải về miễn phí, và tài khoản trên điện thoại dùng được ngay trên trang này.</p>
        <div className="st-stores">
          <a className="st-store" href={STORE_URL} target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7 4.5 8 3.6 9.5c-1.9 3.3-.5 8.1 1.4 10.8.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.5.9c1.5 0 2.4-1.3 3.3-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-2.9-1.1-2.8-4.6zM13.9 5.3c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z" /></svg>
            <span><small>Tải về trên</small><b>App Store</b></span>
          </a>
          <a className="st-store" href={PLAY_URL} target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M4.2 2.6c-.3.3-.4.7-.4 1.2v16.4c0 .5.1.9.4 1.2l.1.1 9.2-9.2v-.2L4.3 2.5zM16.6 15.4l-3.1-3.1v-.2l3.1-3.1.1.1 3.6 2.1c1 .6 1 1.5 0 2.1l-3.6 2.1zM16.7 15.3 13.5 12l-9.3 9.3c.3.4.9.4 1.5.1l10.9-6.1M16.7 8.7 5.7 2.5C5.1 2.2 4.5 2.2 4.2 2.6l9.3 9.4z" /></svg>
            <span><small>Tải về trên</small><b>CH Play</b></span>
          </a>
        </div>
        <Doodle kind="peaks" size={120} className="st-d st-d-peaks" />
        <Doodle kind="pine" size={24} className="st-d st-d-pine1" />
        <Doodle kind="pine" size={18} className="st-d st-d-pine2" />
      </div>
    </section>
  )
}
