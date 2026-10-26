import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { distance, meters } from '@/shared/format'
import { draftChanged, draftPoints, draftReplacements, pathDetails, wayTypes } from '../../core/path'
import type { PathKind, PointsDraft } from '../../core/path'
import type { PointTarget } from '../../core/doc'
import type { PlanDoc, PlanResult, Waypoint } from '../../core/types'
import { IMore, IPlus } from '../icons'
import { wayColors } from '../map/plan-map'
import { RoundTripSwitch } from './RoundTripSwitch'

/**
 * Tab "Waypoints" (theo komoot, chủ sản phẩm 24/10): các điểm đã chọn, thanh
 * "Loại đường" và vài con số của cả chuyến. Mọi số là của máy chủ, ở đây chỉ cộng.
 */
const WAY_LABEL: Record<PathKind, string> = {
  vehicle: 'Đường xe',
  moto: 'Xe ôm',
  route: 'Lộ trình WayTrek',
  path: 'Lối mòn (OpenStreetMap)',
  straight: 'Chưa có lối',
}

export function PathTab({
  doc, result, dark, roundTrip, draft, onDraft, onFocus, onAdd, onReplace, onRoundTrip, onApply,
}: {
  doc: PlanDoc
  result: PlanResult | null
  dark: boolean
  roundTrip: boolean
  /**
   * Bản đang soạn (kéo đổi thứ tự, xoá, thay thế) — màn chính giữ, vì điểm thay
   * thế được chọn trong hộp tìm của màn chính. Kế hoạch chỉ đổi khi bấm "Áp dụng"
   * (chủ sản phẩm 26/10); nút đó tắt khi không còn gì khác kế hoạch.
   */
  draft: PointsDraft | null
  onDraft(d: PointsDraft | null): void
  onFocus(lat: number, lng: number): void
  onAdd(): void
  /** "Thay thế bằng…": mở hộp tìm cho điểm này — chọn xong chỉ ghi vào bản soạn. */
  onReplace(id: string): void
  onRoundTrip(on: boolean): void
  /** Áp bản soạn (id các điểm còn giữ + điểm thay thế) — một bước sửa, hoàn tác được. Trả false nếu không áp được. */
  onApply(ids: string[], swaps: ReadonlyMap<string, PointTarget>): boolean
}) {
  const types = wayTypes(result)
  const det = pathDetails(result)
  const colors = wayColors(dark)
  const wps = doc.waypoints
  const ids = wps.map((w) => w.id)
  const shown = draftPoints(ids, draft)
  const swaps = draftReplacements(shown, draft)
  const dirty = draftChanged(ids, shown, swaps)
  const byId = new Map(wps.map((w) => [w.id, w]))
  const removed = draft?.removed ?? []
  const reorder = (order: string[]) => onDraft({ ...draft, order, removed })
  const nudge = (id: string, delta: -1 | 1) => {
    const i = shown.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= shown.length) return
    const order = [...shown]
    ;[order[i], order[j]] = [order[j], order[i]]
    reorder(order)
  }

  return (
    <div className="pl-path">
      <section aria-label="Các điểm">
        <h3 className="pl-path-head">Các điểm</h3>
        <Reorder.Group as="ol" axis="y" values={shown} onReorder={reorder} className="pl-wps">
          {shown.map((id, i) => (
            <PointPill
              key={id}
              wp={byId.get(id)!}
              swap={swaps.get(id)}
              index={i}
              end={i === 0 || i === shown.length - 1}
              onFocus={onFocus}
              onNudge={(d) => nudge(id, d)}
              onRemove={() => onDraft({ ...draft, order: shown, removed: [...removed, id] })}
              onReplace={() => onReplace(id)}
            />
          ))}
        </Reorder.Group>
        <ol className="pl-wps is-tail">
          <li>
            <button type="button" className="pl-wp-pill is-add" onClick={onAdd} data-tip="Tìm một đỉnh, cung hay địa điểm để thêm vào kế hoạch">
              <span className="pl-wp-plus"><IPlus size={18} /></span>
              <span className="pl-wp-name">Thêm điểm</span>
            </button>
          </li>
        </ol>
        <div className="pl-wps-apply">
          <button
            type="button"
            className="pl-btn pl-btn-primary"
            disabled={!dirty}
            onClick={() => {
              if (onApply(shown, swaps)) onDraft(null)
            }}
            data-tip={dirty ? 'Đổi kế hoạch theo thứ tự và các điểm đang xếp ở đây' : 'Kéo đổi thứ tự, thay hoặc bỏ điểm rồi bấm để áp dụng'}
          >
            Áp dụng
          </button>
          {dirty && (
            <button type="button" className="pl-text-btn" onClick={() => onDraft(null)} data-tip="Bỏ các thay đổi chưa áp dụng, về đúng kế hoạch hiện tại">
              Huỷ thay đổi
            </button>
          )}
        </div>
        <div className="pl-path-tools">
          <RoundTripSwitch on={roundTrip} disabled={wps.length < 2} onChange={onRoundTrip} />
        </div>
      </section>

      {types.length > 0 && (
        <section aria-label="Loại đường">
          <h3 className="pl-path-head">Loại đường</h3>
          <div className="pl-way-bar" role="img" aria-label={types.map((t) => `${WAY_LABEL[t.kind]} ${t.pct}%`).join(', ')}>
            {types.map((t) => (
              <span key={t.kind} className={`pl-way-seg is-${t.kind}`} style={{ flexGrow: t.distanceM, background: colors[t.kind] }} />
            ))}
          </div>
          <ul className="pl-way-list">
            {types.map((t) => (
              <li key={t.kind}>
                <span className={`pl-way-swatch is-${t.kind}`} style={{ background: colors[t.kind] }} />
                <span className="pl-way-label">{WAY_LABEL[t.kind]}</span>
                <span className="pl-way-pct">{t.pct > 0 ? `${t.pct}%` : '<1%'}</span>
                <span className="pl-way-km">{distance(t.distanceM)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && (
        <section aria-label="Chi tiết">
          <h3 className="pl-path-head">Chi tiết</h3>
          <dl className="pl-path-details">
            {det.walkKmh != null && (
              <div><dt><svg className="pl-det-ico" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 8 5.5 3.5 9 6.5 15 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>Tốc độ đi bộ trung bình</dt><dd>{det.walkKmh.toFixed(1).replace('.', ',')} km/h</dd></div>
            )}
            {det.highestM != null && (
              <div><dt><svg className="pl-det-ico is-up" viewBox="0 0 16 10" aria-hidden="true"><path d="M8 1 15 9H1z" /></svg>Điểm cao nhất</dt><dd>{meters(det.highestM)}</dd></div>
            )}
            {det.lowestM != null && (
              <div><dt><svg className="pl-det-ico is-down" viewBox="0 0 16 10" aria-hidden="true"><path d="M1 1h14L8 9z" /></svg>Điểm thấp nhất</dt><dd>{meters(det.lowestM)}</dd></div>
            )}
          </dl>
        </section>
      )}

      {!result && wps.length >= 2 && <p className="pl-muted pl-pad">Đang tính đường đi…</p>}
    </div>
  )
}

/**
 * Một điểm trong danh sách: kéo bằng chấm số (chỉ chấm số — vuốt ở chỗ khác vẫn
 * cuộn được danh sách trên điện thoại), bấm tên đưa bản đồ tới điểm, nút ⋯ mở
 * menu "Thay thế bằng…" / "Xoá" (chủ sản phẩm 26/10). Cả hai chỉ đổi bản đang
 * soạn — điểm chờ thay ([swap]) hiện tên và chỗ MỚI. Chấm số dùng phím: mũi tên
 * lên / xuống.
 */
function PointPill({ wp, swap, index, end, onFocus, onNudge, onRemove, onReplace }: {
  wp: Waypoint
  swap?: PointTarget
  index: number
  end: boolean
  onFocus(lat: number, lng: number): void
  onNudge(delta: -1 | 1): void
  onRemove(): void
  onReplace(): void
}) {
  const controls = useDragControls()
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setMenu(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])
  const name = swap?.name ?? wp.name
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    onNudge(e.key === 'ArrowUp' ? -1 : 1)
  }
  return (
    <Reorder.Item as="li" value={wp.id} dragListener={false} dragControls={controls} className={`pl-wp-item${menu ? ' is-menu-open' : ''}`}>
      <div className="pl-wp-pill">
        <button
          type="button"
          className={`pl-wp-badge is-grab${end ? ' is-end' : ''}`}
          onPointerDown={(e) => controls.start(e)}
          onKeyDown={onKey}
          aria-label={`Điểm ${index + 1}: ${name} — kéo, hoặc mũi tên lên / xuống để đổi thứ tự`}
          data-tip="Giữ và kéo để đổi thứ tự"
        >
          {index + 1}
        </button>
        <button
          type="button"
          className="pl-wp-name"
          onClick={() => (swap ? onFocus(swap.lat, swap.lon) : onFocus(wp.latE6 / 1e6, wp.lonE6 / 1e6))}
          data-tip={swap ? `Thay cho ${wp.name} — bấm Áp dụng thì kế hoạch mới đổi` : `Đưa bản đồ tới ${wp.name}`}
        >
          {name}
        </button>
        <span className="pl-wp-more" ref={box}>
          <button
            type="button"
            className="pl-wp-del"
            onClick={() => setMenu((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Tuỳ chọn cho ${name}`}
            data-tip="Thay thế hoặc xoá điểm này"
          >
            <IMore size={18} />
          </button>
          <div className={`pl-menu pl-wp-menu${menu ? ' is-open' : ''}`} role="menu" aria-label={`Tuỳ chọn cho ${name}`}>
            <button
              type="button"
              role="menuitem"
              className="pl-menu-item"
              onClick={() => {
                setMenu(false)
                onReplace()
              }}
              data-tip="Chọn đỉnh hay địa điểm khác cho chỗ này — bấm Áp dụng thì kế hoạch mới đổi"
            >
              Thay thế bằng…
            </button>
            <button
              type="button"
              role="menuitem"
              className="pl-menu-item"
              onClick={() => {
                setMenu(false)
                onRemove()
              }}
              data-tip="Bỏ điểm này — bấm Áp dụng thì kế hoạch mới đổi"
            >
              Xoá
            </button>
          </div>
        </span>
      </div>
    </Reorder.Item>
  )
}
