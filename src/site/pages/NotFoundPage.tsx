import { useI18n } from '../../i18n/context'
import { Link } from '../ui/Link'
import { Doodle } from '../ui/Doodle'
import { usePageMeta } from '../ui/page-meta'
import { useReveal } from '../ui/use-reveal'

export function NotFoundPage() {
  const { m } = useI18n()
  usePageMeta({ title: m.seo.notFoundTitle, path: '/', noindex: true })
  const ref = useReveal<HTMLDivElement>()
  return (
    <div className="st-wrap st-empty st-reveal" ref={ref}>
      <Doodle kind="compass" size={56} className="st-empty-doodle" />
      <h1 className="st-h2 st-h2-plain">{m.notFound.title}</h1>
      <p className="st-body">{m.notFound.text}</p>
      <div className="st-cta-row">
        <Link to="/map" className="st-btn st-btn-primary" data-tip={m.notFound.openMapTip}>{m.notFound.openMap}</Link>
        <Link to="/" className="st-btn st-btn-quiet" data-tip={m.notFound.homeTip}>{m.notFound.home}</Link>
      </div>
    </div>
  )
}
