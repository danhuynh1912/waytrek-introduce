// Trang một cung (/trail/<id>, `?route=<id>` chọn sẵn lộ trình — cùng hình dạng
// deep link của app): ảnh, số đo, các lộ trình, bản đồ + biểu đồ độ cao của
// lộ trình đang xem, điểm đánh dấu và truyện núi. Chỉ dữ liệu catalog công khai.

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { count, distance, meters } from '@/shared/format'
import { detectPlatform } from '@/shared/platform'
import { formatDifficultyScore } from '../core/difficulty'
import { bboxOf, profileOf, scaleProfile, segmentsOf, splitByTravel } from '../core/geometry'
import type { ProfilePoint } from '../core/geometry'
import { sizedImage } from '../core/images'
import { appLink, sitePath } from '../core/routes'
import { difficultyLabel } from '../core/trails'
import { DifficultyScore } from '../ui/DifficultyScore'
import { useDifficultyBoard } from '../ui/use-catalog'
import type { RouteMeta, TrailDetail } from '../data/catalog'
import { navigate } from '../router'
import { ElevationChart } from '../ui/ElevationChart'
import { Link } from '../ui/Link'
import { TrailMap } from '../ui/map/trail-map'
import { usePageMeta } from '../ui/page-meta'
import { useRouteGeometry, useTrailDetail } from '../ui/use-trail'

export default function TrailPage({ trailId, routeId, dark }: { trailId: string; routeId: string | null; dark: boolean }) {
  const [detail, retry] = useTrailDetail(trailId)
  if (detail.status === 'loading') return <div className="st-page-loading" aria-label="Đang tải cung" />
  if (detail.status === 'error') {
    return (
      <div className="st-wrap st-empty">
        <p className="st-body">Chưa tải được thông tin cung này. <button type="button" className="st-text-btn" onClick={retry}>Thử lại</button></p>
      </div>
    )
  }
  if (!detail.data) return <TrailGone />
  return <TrailView d={detail.data} routeId={routeId} dark={dark} />
}

function TrailGone() {
  usePageMeta({ title: 'Không tìm thấy cung · WayTrek', path: window.location.pathname, noindex: true })
  return (
    <div className="st-wrap st-empty">
      <h1 className="st-h2 st-h2-plain">Cung này không còn trên bản đồ công khai</h1>
      <p className="st-body">Có thể cung đã được gộp vào một cung khác, hoặc đang chờ đội ngũ WayTrek thẩm định lại.</p>
      <div className="st-cta-row"><Link to="/map" className="st-btn st-btn-primary">Xem các cung khác</Link></div>
    </div>
  )
}

function TrailView({ d, routeId, dark }: { d: TrailDetail; routeId: string | null; dark: boolean }) {
  const t = d.trail
  const route: RouteMeta | null = d.routes.find((r) => r.id === routeId) ?? d.routes[0] ?? null
  const label = difficultyLabel(t)
  const board = useDifficultyBoard()
  const score = board?.byTrail.get(t.id)
  usePageMeta({
    title: `${t.name} · WayTrek`,
    description: [
      `${t.name}${t.region ? ` (${t.region})` : ''}`,
      [t.distanceM != null ? distance(t.distanceM) : null, t.gainM != null ? `leo ${meters(t.gainM)}` : null, t.peakEleM != null ? `đỉnh ${meters(t.peakEleM)}` : null]
        .filter(Boolean).join(', '),
      score ? `điểm độ khó ${formatDifficultyScore(score.score)} do người leo xếp hạng trên WayTrek.` : `độ khó ${label.toLowerCase()} do người leo xếp hạng trên WayTrek.`,
    ].filter(Boolean).join(': '),
    path: sitePath({ page: 'trail', trailId: t.id, routeId: null }),
  })

  const geo = useRouteGeometry(route?.id ?? null)
  const segs = useMemo(() => (geo?.status === 'ready' ? segmentsOf(geo.data.geojson) : []), [geo])
  const lines = useMemo(() => (geo?.status === 'ready' ? splitByTravel(segs, geo.data.travel) : []), [geo, segs])
  // Trục quãng đường khớp số CÔNG BỐ của lộ trình (cùng con số ở hàng số đo phía trên).
  const routeDistance = route?.distanceM ?? null
  const profile = useMemo(() => {
    const p = profileOf(segs)
    return p ? scaleProfile(p, routeDistance) : null
  }, [segs, routeDistance])
  const hasVehicle = lines.some((l) => l.vehicle)

  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<TrailMap | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  useEffect(() => {
    if (!mapEl.current) return
    const m = new TrailMap(mapEl.current, dark, setMapError)
    map.current = m
    return () => {
      m.destroy()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => map.current?.setTheme(dark), [dark])
  useEffect(() => map.current?.setRoute(lines, bboxOf(segs)), [lines, segs])
  const pois = useMemo(() => d.poiGroups.flatMap((g) => g.points), [d.poiGroups])
  useEffect(() => {
    map.current?.setPois(
      pois.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })),
      t.lat != null && t.lng != null ? { id: 'peak', name: t.name, lat: t.lat, lng: t.lng } : null,
    )
  }, [pois, t])
  const onProfileHover = (p: ProfilePoint | null) => map.current?.setCursor(p ? { lat: p.lat, lng: p.lng } : null)

  const pickRoute = (r: RouteMeta) => navigate(sitePath({ page: 'trail', trailId: t.id, routeId: r.id }), { replace: true })
  const onMobile = detectPlatform(navigator.userAgent) !== 'other'

  return (
    <article className="st-trail">
      <div className="st-wrap st-crumbs">
        <Link to="/map">Khám phá</Link>
        <span aria-hidden="true">/</span>
        <span>{t.name}</span>
      </div>
      {t.imageUrl && (
        <div className="st-wrap">
          <TrailHero url={t.imageUrl} name={t.name} />
        </div>
      )}
      <header className="st-wrap st-trail-head">
        <div>
          <h1 className="st-trail-title">{t.name}</h1>
          {t.region && <p className="st-trail-region">{t.region}</p>}
        </div>
        <div className="st-trail-actions">
          <a className="st-btn st-btn-primary" href="/plan/new">Lên kế hoạch chuyến đi</a>
          {onMobile && <a className="st-btn st-btn-quiet" href={appLink({ page: 'trail', trailId: t.id, routeId: route?.id ?? null })}>Mở trong WayTrek</a>}
        </div>
      </header>
      <div className="st-wrap">
        <dl className="st-facts">
          <Fact label="Điểm độ khó" value={<DifficultyScore t={t} board={board} />} />
          <Fact label="Quãng đường" value={route?.distanceM != null ? distance(route.distanceM) : t.distanceM != null ? distance(t.distanceM) : null} />
          <Fact label="Leo" value={route?.gainM != null ? meters(route.gainM) : t.gainM != null ? meters(t.gainM) : null} />
          <Fact label="Độ cao đỉnh" value={t.peakEleM != null ? meters(t.peakEleM) : null} />
          <Fact label="Lượt ghi danh" value={count(t.conquests)} />
        </dl>
      </div>

      <div className="st-wrap st-trail-grid">
        <div className="st-trail-main">
          {t.description && (
            <section className="st-trail-sec">
              <h2>Giới thiệu</h2>
              {t.description.split(/\n+/).map((p, i) => <p key={i} className="st-body">{p}</p>)}
            </section>
          )}
          <section className="st-trail-sec">
            <h2>Lộ trình <span className="st-sec-count">{d.routes.length}</span></h2>
            {d.routes.length === 0 ? (
              <p className="st-body">Cung này chưa có lộ trình công khai nào.</p>
            ) : (
              <ul className="st-routes" role="listbox" aria-label="Chọn lộ trình">
                {d.routes.map((r) => {
                  const on = r.id === route?.id
                  return (
                    <li key={r.id}>
                      <button type="button" role="option" aria-selected={on} className={`st-route${on ? ' is-on' : ''}`} onClick={() => pickRoute(r)}>
                        <span className="st-route-name">
                          {r.name}
                          {r.isRecommended && <em>Gợi ý</em>}
                        </span>
                        <span className="st-route-meta">
                          {[r.distanceM != null ? distance(r.distanceM) : null, r.gainM != null ? `↑${meters(r.gainM)}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          {d.poiGroups.length > 0 && (
            <section className="st-trail-sec">
              <h2>Điểm đánh dấu <span className="st-sec-count">{pois.length}</span></h2>
              {d.poiGroups.map((g) => (
                <div key={g.id} className="st-poi-group">
                  <h3>{g.name}</h3>
                  <ul>
                    {g.points.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="st-poi" onClick={() => map.current?.focus({ lat: p.lat, lng: p.lng })}>
                          <b>{p.name}</b>
                          {p.description && <span>{p.description}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {d.lore.length > 0 && (
            <section className="st-trail-sec">
              <h2>Truyện núi</h2>
              {d.lore.map((c) => (
                <div key={c.no} className="st-lore">
                  {c.title && <h3>{c.title}</h3>}
                  {c.body.split(/\n+/).map((p, i) => <p key={i} className="st-body">{p}</p>)}
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="st-trail-side" aria-label="Bản đồ lộ trình">
          <div className="st-trail-map">
            <div className="st-trail-canvas" ref={mapEl} />
            {mapError && <p className="st-map-error" role="alert">{mapError}</p>}
            {geo?.status === 'error' && <p className="st-map-error" role="alert">Chưa tải được đường đi của lộ trình này.</p>}
            <button type="button" className="st-map-fit" onClick={() => map.current?.fitRoute()} aria-label="Xem trọn lộ trình" title="Xem trọn lộ trình">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            </button>
          </div>
          {hasVehicle && (
            <p className="st-legend"><i className="is-walk" /> Đi bộ <i className="is-vehicle" /> Đi xe</p>
          )}
          {profile && <ElevationChart key={route?.id} profile={profile} onHover={onProfileHover} />}
        </aside>
      </div>
    </article>
  )
}

/**
 * Ảnh đầu trang cung: máy tính 21:9 bị chặn cao 460 px trên bề ngang 1180 px,
 * điện thoại 4:3 (CSS ≤ 640 px) — hai khung khác tỉ lệ nên hai bản cắt.
 */
function TrailHero({ url, name }: { url: string; name: string }) {
  const wide = sizedImage(url, 1180, 460, 75)
  const phone = sizedImage(url, 360, 270, 75)
  return (
    <picture>
      {phone.srcSet && <source media="(max-width: 640px)" srcSet={phone.srcSet} />}
      <img className="st-trail-hero" src={wide.src} srcSet={wide.srcSet} alt={`Phong cảnh ${name}`} />
    </picture>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value == null) return null
  return (
    <div className="st-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
