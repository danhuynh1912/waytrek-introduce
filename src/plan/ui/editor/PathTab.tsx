import { distance, meters } from '../../core/format'
import { pathDetails, wayTypes } from '../../core/path'
import type { PathKind } from '../../core/path'
import type { PlanDoc, PlanResult } from '../../core/types'
import { IPlus } from '../icons'
import { wayColors } from '../map/plan-map'

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
  doc, result, dark, roundTrip, onFocus, onAdd, onRoundTrip,
}: {
  doc: PlanDoc
  result: PlanResult | null
  dark: boolean
  roundTrip: boolean
  onFocus(lat: number, lng: number): void
  onAdd(): void
  onRoundTrip(on: boolean): void
}) {
  const types = wayTypes(result)
  const det = pathDetails(result)
  const colors = wayColors(dark)
  const wps = doc.waypoints

  return (
    <div className="pl-path">
      <section aria-label="Các điểm">
        <h3 className="pl-path-head">Các điểm</h3>
        <ol className="pl-wps">
          {wps.map((w, i) => (
            <li key={w.id}>
              <button type="button" className="pl-wp-pill" onClick={() => onFocus(w.latE6 / 1e6, w.lonE6 / 1e6)}>
                <span className={`pl-wp-badge${i === 0 || i === wps.length - 1 ? ' is-end' : ''}`}>{i + 1}</span>
                <span className="pl-wp-name">{w.name}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="pl-wp-pill is-add" onClick={onAdd}>
              <span className="pl-wp-plus"><IPlus size={18} /></span>
              <span className="pl-wp-name">Thêm điểm</span>
            </button>
          </li>
        </ol>
        <div className="pl-path-tools">
          <label className="pl-switch">
            <input type="checkbox" checked={roundTrip} disabled={wps.length < 2} onChange={(e) => onRoundTrip(e.target.checked)} />
            <span className="pl-switch-track" aria-hidden="true" />
            <span>Quay về điểm xuất phát</span>
          </label>
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
