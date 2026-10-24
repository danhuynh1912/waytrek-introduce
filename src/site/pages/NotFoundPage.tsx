import { Link } from '../ui/Link'
import { Doodle } from '../ui/Doodle'
import { usePageMeta } from '../ui/page-meta'
import { useReveal } from '../ui/use-reveal'

export function NotFoundPage() {
  usePageMeta({ title: 'Không tìm thấy trang · WayTrek', path: window.location.pathname, noindex: true })
  const ref = useReveal<HTMLDivElement>()
  return (
    <div className="st-wrap st-empty st-reveal" ref={ref}>
      <Doodle kind="compass" size={56} className="st-empty-doodle" />
      <h1 className="st-h2 st-h2-plain">Lối này chưa có trên bản đồ</h1>
      <p className="st-body">Đường dẫn bạn mở không dẫn tới trang nào của WayTrek, nhưng những cung núi thật vẫn đang chờ bạn ở trang khám phá.</p>
      <div className="st-cta-row">
        <Link to="/map" className="st-btn st-btn-primary">Mở bản đồ cung núi</Link>
        <Link to="/" className="st-btn st-btn-quiet">Về trang chủ</Link>
      </div>
    </div>
  )
}
