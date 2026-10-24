// Trang Khám phá (/map, `map?trail=<id>` như deep link của app): danh sách cung
// có tìm + xếp ở bên trái, bản đồ mọi cung ở bên phải. Rê một dòng thì chấm của
// nó nổi lên; bấm một dòng HOẶC một chấm thì chọn cung đó trên bản đồ và hiện
// thẻ xem trước — vào trang cung bằng nút trong thẻ.

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { count } from '@/shared/format'
import { sitePath } from '../core/routes'
import type { DifficultyBoard } from '../core/difficulty'
import { sizedImage } from '../core/images'
import { DEFAULT_FILTER, filterTrails } from '../core/trails'
import type { TrailFilter, TrailSort, TrailSummary } from '../core/trails'
import { navigate } from '../router'
import { Link } from '../ui/Link'
import { ExploreMap } from '../ui/map/explore-map'
import { usePageMeta } from '../ui/page-meta'
import { MetaLine } from '../ui/TrailCard'
import { useCatalog, useDifficultyBoard } from '../ui/use-catalog'

const SORTS: { value: TrailSort; label: string }[] = [
  { value: 'popular', label: 'Nhiều lượt ghi danh' },
  { value: 'hardest', label: 'Khó nhất' },
  { value: 'easiest', label: 'Dễ nhất' },
  { value: 'high', label: 'Đỉnh cao nhất' },
  { value: 'short', label: 'Quãng đường ngắn' },
  { value: 'name', label: 'Tên A → Z' },
]

export default function MapPage({ selected, dark }: { selected: string | null; dark: boolean }) {
  usePageMeta({
    title: 'Khám phá cung núi · WayTrek',
    description: 'Bản đồ các cung núi Việt Nam trên WayTrek: quãng đường, độ cao, độ khó do người leo xếp hạng và số lượt lên đỉnh của từng cung.',
    path: '/map',
  })
  const [catalog, retry] = useCatalog()
  const board = useDifficultyBoard()
  const [filter, setFilter] = useState<TrailFilter>(DEFAULT_FILTER)
  const [hover, setHover] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<ExploreMap | null>(null)
  const all = catalog.status === 'ready' ? catalog.data : null
  const shown = useMemo(() => (all ? filterTrails(all, filter, board) : []), [all, filter, board])
  const picked = all && selected ? all.find((t) => t.id === selected) ?? null : null

  // Chọn = đổi địa chỉ (?trail=), để link đang mở luôn chia sẻ được đúng cung đang xem.
  const select = (id: string | null) => navigate(sitePath({ page: 'map', trailId: id }), { replace: true })

  // Bản đồ dựng một lần; đổi theme thì tô lại style, không dựng lại.
  useEffect(() => {
    if (!mapEl.current) return
    const m = new ExploreMap(mapEl.current, dark, {
      onSelect: (id) => select(id),
      onFatal: setMapError,
    })
    map.current = m
    return () => {
      m.destroy()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => map.current?.setTheme(dark), [dark])
  // Bản đồ chỉ vẽ những cung đang khớp bộ lọc — danh sách và bản đồ nói cùng một chuyện.
  useEffect(() => map.current?.setTrails(shown), [shown])
  useEffect(() => map.current?.setSelected(selected), [selected])
  useEffect(() => map.current?.setHover(hover), [hover])

  return (
    <div className="st-explore">
      <aside className="st-explore-panel" aria-label="Danh sách cung núi">
        <div className="st-explore-head">
          <h1 className="st-explore-title">Khám phá cung núi</h1>
          <label className="st-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
            <input
              type="search"
              value={filter.query}
              placeholder="Tìm tên cung hoặc vùng"
              aria-label="Tìm tên cung hoặc vùng"
              onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
            />
          </label>
          <div className="st-explore-bar">
            <span className="st-explore-count">{all ? `${count(shown.length)} cung` : ' '}</span>
            <label className="st-sort">
              <span className="sr-only">Xếp theo</span>
              <select value={filter.sort} onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as TrailSort }))}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        {catalog.status === 'error' ? (
          <p className="st-explore-note">
            Chưa tải được danh sách cung. <button type="button" className="st-text-btn" onClick={retry}>Thử lại</button>
          </p>
        ) : catalog.status === 'loading' ? (
          <ul className="st-explore-list" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => <li key={i} className="st-row is-skeleton" aria-hidden="true"><span className="st-row-img" /><span className="st-row-text"><span /><span /></span></li>)}
          </ul>
        ) : shown.length === 0 ? (
          <p className="st-explore-note">Không có cung nào khớp “{filter.query.trim() || 'bộ lọc này'}”. Bạn thử gõ tên ngắn hơn, hoặc tìm theo tỉnh.</p>
        ) : (
          <ul className="st-explore-list">
            {shown.map((t) => (
              <TrailRow key={t.id} t={t} board={board} active={t.id === selected} onHover={setHover} onSelect={select} />
            ))}
          </ul>
        )}
      </aside>
      <div className="st-explore-map">
        <div className="st-explore-canvas" ref={mapEl} />
        {mapError && <p className="st-map-error" role="alert">{mapError}</p>}
        {picked && <Preview t={picked} board={board} onClose={() => select(null)} />}
      </div>
    </div>
  )
}

function TrailRow({ t, board, active, onHover, onSelect }: {
  t: TrailSummary
  board: DifficultyBoard | null
  active: boolean
  onHover(id: string | null): void
  onSelect(id: string): void
}) {
  const ref = useRef<HTMLLIElement>(null)
  // Chọn từ bản đồ thì dòng tương ứng cuộn vào khung, để hai bên khớp nhau.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])
  return (
    <li ref={ref} className={`st-row${active ? ' is-active' : ''}`} onMouseEnter={() => onHover(t.id)} onMouseLeave={() => onHover(null)}>
      <button type="button" className="st-row-link" aria-pressed={active} onClick={() => onSelect(t.id)}>
        <span className="st-row-img">{t.imageUrl && <RowImage url={t.imageUrl} />}</span>
        <span className="st-row-text">
          <b>{t.name}</b>
          {t.region && <span className="st-row-region">{t.region}</span>}
          <MetaLine t={t} board={board} className="st-row-meta" />
          {t.conquests > 0 && <span className="st-row-meta is-faint">{count(t.conquests)} lượt ghi danh</span>}
        </span>
      </button>
    </li>
  )
}

/** Ảnh ô danh sách: 76 × 76 px CSS (`.st-row-img`). */
function RowImage({ url }: { url: string }) {
  const img = sizedImage(url, 76, 76)
  return <img src={img.src} srcSet={img.srcSet} alt="" loading="lazy" decoding="async" />
}

/**
 * Ảnh thẻ xem trước: máy tính là dải 16:9 trên đầu thẻ (330 px), điện thoại là
 * ô vuông bên trái thẻ dẹt (CSS ≤ 900 px) — hai khung khác tỉ lệ nên hai bản cắt.
 */
function PreviewImage({ url }: { url: string }) {
  const wide = sizedImage(url, 330, 186)
  const square = sizedImage(url, 120, 120)
  return (
    <picture className="st-preview-media">
      {square.srcSet && <source media="(max-width: 900px)" srcSet={square.srcSet} />}
      <img className="st-preview-img" src={wide.src} srcSet={wide.srcSet} alt="" />
    </picture>
  )
}

function Preview({ t, board, onClose }: { t: TrailSummary; board: DifficultyBoard | null; onClose(): void }) {
  return (
    <div className={`st-preview${t.imageUrl ? ' has-img' : ''}`} key={t.id}>
      <button type="button" className="st-preview-close" onClick={onClose} aria-label="Đóng thẻ xem trước">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      {t.imageUrl && <PreviewImage url={t.imageUrl} />}
      <div className="st-preview-body">
        <p className="st-preview-name">{t.name}</p>
        {t.region && <p className="st-preview-region">{t.region}</p>}
        <p className="st-preview-meta"><MetaLine t={t} board={board} /></p>
        <Link to={sitePath({ page: 'trail', trailId: t.id, routeId: null })} className="st-btn st-btn-primary">Xem cung</Link>
      </div>
    </div>
  )
}
