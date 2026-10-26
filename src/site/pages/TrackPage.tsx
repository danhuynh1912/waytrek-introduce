// Trang theo dõi chuyến đi cho người thân (/t/<token>, WayTrek spec/43 §10.6):
// đường của kế hoạch + vị trí mới nhất người leo gửi lúc ghi track. Không cần
// đăng nhập, không lập chỉ mục. Người chia sẻ tắt link thì trang chỉ còn câu
// "đã tắt" — không tên, không đường, không vị trí (máy chủ lo).

import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { shortDate } from '@/shared/format'
import { sitePath } from '../core/routes'
import { trackBbox, trackHeadline } from '../core/tracker'
import type { TrackView } from '../core/tracker'
import { fetchTracker } from '../data/tracker'
import { TrackMap } from '../ui/map/track-map'
import { usePageMeta } from '../ui/page-meta'

/** Người ở nhà mở trang này để xem người leo đang ở đâu: một phút một lần là
 *  đủ (máy người leo gửi ba phút một lần), và CHỈ khi trang đang hiện. */
const REFRESH_MS = 60_000

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; view: TrackView | null }

export default function TrackPage({ token, dark }: { token: string; dark: boolean }) {
  usePageMeta({ title: 'Theo dõi chuyến đi · WayTrek', path: sitePath({ page: 'track', token }), noindex: true })
  const [load, retry] = useTracker(token)
  if (load.status === 'loading') return <div className="st-page-loading" aria-label="Đang tải" />
  if (load.status === 'error') {
    return (
      <div className="st-wrap st-empty">
        <p className="st-body">
          Chưa tải được link theo dõi.{' '}
          <button type="button" className="st-text-btn" onClick={retry} data-tip="Tải lại link theo dõi">Thử lại</button>
        </p>
      </div>
    )
  }
  return <TrackBody view={load.view} dark={dark} />
}

/** Tải link theo dõi, rồi làm tươi mỗi [REFRESH_MS] — CHỈ khi trang đang hiện
 *  trước mắt; quay lại trang thì tải ngay. Lỗi mạng khi đã có dữ liệu thì giữ
 *  dữ liệu cũ (mạng chập chờn không được xoá trang đang xem). */
function useTracker(token: string): [Load, () => void] {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    fetchTracker(token)
      .then((view) => alive && setLoad({ status: 'ready', view }))
      .catch((e) => {
        console.warn('track: không tải được link —', e)
        if (alive) setLoad((cur) => (cur.status === 'ready' ? cur : { status: 'error' }))
      })
    return () => {
      alive = false
    }
  }, [token, tick])
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const bump = () => setTick((t) => t + 1)
    const start = () => {
      if (timer == null) timer = setInterval(bump, REFRESH_MS)
    }
    const stop = () => {
      if (timer != null) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        bump()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setTick((t) => t + 1)
  }, [])
  return [load, retry]
}

function TrackBody({ view, dark }: { view: TrackView | null; dark: boolean }) {
  const { headline, detail } = trackHeadline(view)
  const live = view != null && view.status !== 'off' && view.status !== 'ended'
  return (
    <article className="st-track">
      <header className="st-wrap st-track-head">
        {live && view?.title && <p className="st-track-kicker">{view.name ? `${view.name} · ` : ''}{view.title}</p>}
        <h1 className="st-track-status">{headline}</h1>
        {detail && <p className="st-body st-track-detail">{detail}</p>}
        {live && view?.firstDay && view.lastDay && (
          <p className="st-track-dates">
            {view.firstDay === view.lastDay ? shortDate(view.firstDay) : `${shortDate(view.firstDay)} – ${shortDate(view.lastDay)}`}
          </p>
        )}
      </header>
      {live && view && <TrackMapBlock view={view} dark={dark} />}
      {live && (
        <p className="st-wrap st-track-note">
          Vị trí do điện thoại của người leo gửi khi đang ghi track bằng WayTrek, vài phút một lần khi có sóng. Cần trợ giúp khẩn cấp: gọi 112.
        </p>
      )}
    </article>
  )
}

function TrackMapBlock({ view, dark }: { view: TrackView; dark: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<TrackMap | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)

  useEffect(() => {
    if (!box.current) return
    const m = new TrackMap(box.current, dark, setFatal)
    map.current = m
    return () => {
      m.destroy()
      map.current = null
    }
    // Dựng một lần; đổi theme đi đường riêng bên dưới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => map.current?.setTheme(dark), [dark])
  useEffect(() => map.current?.set(view.lines, view.stops, view.position, trackBbox(view)), [view])

  const here = view.position
  return (
    <div className="st-wrap">
      <div className="st-trail-map st-track-map">
        <div ref={box} className="st-trail-canvas" />
        {fatal && <p className="st-map-error" role="alert">{fatal}</p>}
        {here && (
          <button
            type="button"
            className="st-map-fit"
            onClick={() => map.current?.focus(here)}
            aria-label="Tới vị trí mới nhất"
            data-tip="Đưa bản đồ tới vị trí mới nhất của người leo"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
