import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { clock, distance, duration, km, meters, parseClock, shortDate } from '../../core/format'
import type { Row } from '../../core/timeline'
import type { ArriveAt, PoiPin, ResultDay, ResultLeg, ResultStop, TrailPin, Transport, Waypoint } from '../../core/types'
import { byLevel, dayNote, knownNote, legFlagNotes } from '../../core/warnings'
import type { Note } from '../../core/warnings'
import { ICar, IClose, IDown, IInfo, IPeak, ITent, IUp, IWalk, IWarn } from '../icons'
import { poiKindLabel } from '../labels'

export interface TimelineActions {
  rename(id: string, name: string): void
  move(id: string, delta: -1 | 1): void
  remove(id: string): void
  toggleRest(id: string): void
  setTransport(id: string, t: Transport): void
  keepAuto(stop: ResultStop, afterWaypointId: string): void
  /** Lán: không chèn lại lán đó. Vùng nên nghỉ: đoàn không mang lều. */
  dismissAuto(stop: ResultStop): void
  setArriveAt(id: string, at: ArriveAt | null): void
  focus(lat: number, lng: number): void
}

interface Props {
  rows: Row[]
  count: number
  fresh: boolean
  computeError: string | null
  trails: ReadonlyMap<string, TrailPin>
  pois: ReadonlyMap<string, PoiPin>
  actions: TimelineActions
}

const EASE = [0.65, 0, 0.35, 1] as const
const ROW_MOTION = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.16, ease: EASE } },
  transition: { duration: 0.22, ease: EASE },
}

function rowKey(r: Row, i: number, rows: Row[]): string {
  switch (r.type) {
    case 'day':
      return `day-${r.day.index}`
    case 'stop':
      return `wp-${r.wp.id}`
    case 'auto':
      return `auto-${r.stop.id}`
    case 'leg': {
      if (r.leg) return `leg-${r.leg.from}-${r.leg.to}`
      const prev = rows.slice(0, i).reverse().find((x) => x.type === 'stop')
      return `pend-${prev?.type === 'stop' ? prev.wp.id : i}`
    }
  }
}

export function Timeline({ rows, count, fresh, computeError, trails, pois, actions }: Props) {
  if (count === 0) return null
  // Tên + số liệu của mọi điểm, để dòng ngày nói đúng tên điểm nó nhắc tới.
  const stops = new Map<string, { name: string; info: ResultStop | null }>()
  for (const r of rows) {
    if (r.type === 'stop') stops.set(r.wp.id, { name: r.wp.name, info: r.info })
    else if (r.type === 'auto') stops.set(r.stop.id, { name: r.stop.name, info: r.stop })
  }
  return (
    <div className={`pl-timeline${fresh ? '' : ' is-stale'}`}>
      <AnimatePresence initial={false}>
        {rows.map((r, i) => (
          <motion.div key={rowKey(r, i, rows)} layout="position" {...ROW_MOTION}>
            {r.type === 'day' && <DayRow day={r.day} stops={stops} />}
            {r.type === 'stop' && (
              <StopRow wp={r.wp} index={r.index} count={count} info={r.info} trails={trails} pois={pois} actions={actions} />
            )}
            {r.type === 'auto' && <AutoRow stop={r.stop} afterWaypointId={r.afterWaypointId} actions={actions} />}
            {r.type === 'leg' && <LegRow leg={r.leg} toggleFor={r.toggleFor} computeError={computeError} actions={actions} />}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Notes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null
  return (
    <ul className="pl-notes">
      {notes.map((n, i) => (
        <li key={i} className={`pl-note pl-note-${n.level}`}>
          {n.level === 'info' ? <IInfo size={15} /> : <IWarn size={15} />}
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  )
}

function DayRow({ day, stops }: { day: ResultDay; stops: ReadonlyMap<string, { name: string; info: ResultStop | null }> }) {
  const notes = day.warnings.map((w) => dayNote(w, (id) => stops.get(id)?.name)).sort(byLevel)
  const anchor = day.anchorStopId ? stops.get(day.anchorStopId) : undefined
  return (
    <section className="pl-day" aria-label={`Ngày ${day.index + 1}`}>
      <div className="pl-day-head">
        <span className="pl-day-title">Ngày {day.index + 1} · {shortDate(day.date)}</span>
        <span className="pl-day-time">{clock(day.departMin)} → {clock(day.arriveMin)}</span>
      </div>
      <div className="pl-day-sub">
        {distance(day.distanceM)} · ↑ {meters(day.ascentM)} · đi bộ {duration(day.walkMin)}
        {day.sunsetMin != null && <> · hoàng hôn {clock(day.sunsetMin)}</>}
      </div>
      {anchor?.info?.targetMin != null && (
        // Ngày có mốc: giờ đi không phải giờ xuất phát thường — nói ra vì sao.
        <div className="pl-day-sub">
          Xuất phát {clock(day.departMin)} để tới <b>{anchor.name}</b> lúc {clock(anchor.info.targetMin)}
        </div>
      )}
      <DayNotes notes={notes} />
    </section>
  )
}

/**
 * Cảnh báo của một ngày — gập sẵn (chủ sản phẩm 24/10), chỉ còn một dòng tóm
 * tắt mang màu của mức nặng nhất. Bấm để mở / gập.
 */
function DayNotes({ notes }: { notes: Note[] }) {
  const [open, setOpen] = useState(false)
  if (notes.length === 0) return null
  const worst = notes[0].level // đã sắp theo byLevel: nặng nhất đứng đầu
  const warns = notes.filter((n) => n.level !== 'info').length
  const infos = notes.length - warns
  const summary = [warns > 0 ? `${warns} cảnh báo` : null, infos > 0 ? `${infos} lưu ý` : null].filter(Boolean).join(' · ')
  return (
    <div className="pl-day-notes">
      <button
        type="button"
        className={`pl-day-notes-toggle pl-note-${worst}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {worst === 'info' ? <IInfo size={15} /> : <IWarn size={15} />}
        <span>{summary}</span>
        <span className={`pl-day-notes-chev${open ? ' is-open' : ''}`}><IDown size={14} /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="notes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Notes notes={notes} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NameField({ value, onCommit, label }: { value: string; onCommit: (v: string) => void; label: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  if (!editing) {
    return (
      <button type="button" className="pl-name" onClick={() => { setText(value); setEditing(true) }} title="Bấm để đổi tên">
        {value}
      </button>
    )
  }
  const done = (save: boolean) => {
    setEditing(false)
    if (save && text.trim() && text.trim() !== value) onCommit(text)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') done(true)
    if (e.key === 'Escape') done(false)
  }
  return (
    <input
      className="pl-name-input"
      aria-label={label}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      maxLength={120}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={onKey}
    />
  )
}

function kindLine(wp: Waypoint, trails: ReadonlyMap<string, TrailPin>, pois: ReadonlyMap<string, PoiPin>): string {
  switch (wp.kind) {
    case 'peak':
      return 'Đỉnh'
    case 'poi': {
      const p = wp.ref ? pois.get(wp.ref) : undefined
      return p ? poiKindLabel(p.kind) : 'Điểm có sẵn'
    }
    case 'route': {
      const t = wp.ref ? trails.get(wp.ref) : undefined
      return t ? `Trên lộ trình ${t.name}` : 'Trên lộ trình'
    }
    case 'custom':
      return 'Điểm tự chấm'
  }
}

function StopRow({
  wp, index, count, info, trails, pois, actions,
}: {
  wp: Waypoint
  index: number
  count: number
  info: ResultStop | null
  trails: ReadonlyMap<string, TrailPin>
  pois: ReadonlyMap<string, PoiPin>
  actions: TimelineActions
}) {
  const middle = index > 0 && index < count - 1
  const userRest = wp.rest && middle
  const parts = [kindLine(wp, trails, pois)]
  if (info?.eleM != null) parts.push(meters(info.eleM))
  const selfMarked = userRest && (wp.kind === 'custom' || wp.kind === 'route')
  return (
    <div className={`pl-stop${wp.rest && middle ? ' is-rest' : ''}`}>
      <button
        type="button"
        className={`pl-dot${wp.kind === 'peak' ? ' is-peak' : ''}`}
        onClick={() => actions.focus(wp.latE6 / 1e6, wp.lonE6 / 1e6)}
        aria-label={`Xem điểm ${index + 1} trên bản đồ`}
      >
        {index + 1}
      </button>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <NameField value={wp.name} label={`Tên điểm ${index + 1}`} onCommit={(v) => actions.rename(wp.id, v)} />
          {info && <span className="pl-eta">{clock(info.etaMin)}</span>}
        </div>
        <div className="pl-stop-sub">
          {wp.kind === 'peak' && <IPeak size={13} />}
          {parts.join(' · ')}
          {info?.leaveByMin != null && (
            // Tới đỉnh đã muộn hơn giờ phải rời: nói thẳng là không kịp.
            info.leaveByMin < info.etaMin ? (
              <span className="pl-late"> · tới đỉnh đã quá giờ phải quay xuống — không kịp tới chỗ nghỉ trước tối</span>
            ) : (
              <> · rời đỉnh muộn nhất <b>{clock(info.leaveByMin)}</b></>
            )
          )}
        </div>
        {middle && (
          <label className="pl-check">
            <input type="checkbox" checked={wp.rest} onChange={() => actions.toggleRest(wp.id)} />
            <span>Nghỉ đêm ở đây{selfMarked && <em> · do bạn đánh dấu</em>}</span>
          </label>
        )}
        {wp.kind === 'peak' && index > 0 && (
          <ArriveField wp={wp} info={info} onChange={(at) => actions.setArriveAt(wp.id, at)} />
        )}
      </div>
      <div className="pl-stop-tools">
        <button type="button" className="pl-icon-btn sm" onClick={() => actions.move(wp.id, -1)} disabled={index === 0} aria-label="Đưa lên">
          <IUp size={16} />
        </button>
        <button type="button" className="pl-icon-btn sm" onClick={() => actions.move(wp.id, 1)} disabled={index === count - 1} aria-label="Đưa xuống">
          <IDown size={16} />
        </button>
        <button type="button" className="pl-icon-btn sm" onClick={() => actions.remove(wp.id)} aria-label={`Xoá ${wp.name}`}>
          <IClose size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * Hẹn giờ lên đỉnh (chủ sản phẩm 24/10): phần đông lên đỉnh để đón bình minh,
 * nên họ chọn giờ ĐỨNG TRÊN ĐỈNH; máy chủ tính ngược ra giờ phải dậy.
 */
function ArriveField({ wp, info, onChange }: { wp: Waypoint; info: ResultStop | null; onChange(at: ArriveAt | null): void }) {
  const mode = wp.arriveAt === undefined ? 'none' : wp.arriveAt === 'sunrise' ? 'sunrise' : 'clock'
  const [text, setText] = useState<string | null>(null)
  const pick = (v: string) => {
    if (v === 'none') onChange(null)
    else if (v === 'sunrise') onChange('sunrise')
    // Giờ cụ thể: bắt đầu từ giờ tới đỉnh hiện tại, làm tròn 5 phút.
    else onChange(info ? Math.round(info.etaMin / 5) * 5 % 1440 : 6 * 60)
  }
  const commit = () => {
    const m = text == null ? null : parseClock(text)
    if (m != null && m !== wp.arriveAt) onChange(m)
    setText(null)
  }
  return (
    <div className="pl-arrive">
      <select
        value={mode}
        aria-label={`Giờ lên đỉnh ${wp.name}`}
        onChange={(e) => pick(e.target.value)}
        className={mode === 'none' ? '' : 'is-on'}
      >
        <option value="none">Không hẹn giờ lên đỉnh</option>
        <option value="sunrise">Lên đỉnh lúc bình minh</option>
        <option value="clock">Lên đỉnh lúc…</option>
      </select>
      {mode === 'clock' && typeof wp.arriveAt === 'number' && (
        <input
          type="time"
          aria-label="Giờ có mặt trên đỉnh"
          value={text ?? clock(wp.arriveAt)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      )}
      {mode === 'sunrise' && info?.targetMin != null && <span className="pl-muted">{clock(info.targetMin)}</span>}
    </div>
  )
}

function AutoRow({ stop, afterWaypointId, actions }: { stop: ResultStop; afterWaypointId: string; actions: TimelineActions }) {
  if (stop.zone) return <ZoneRow stop={stop} afterWaypointId={afterWaypointId} actions={actions} />
  return (
    <div className="pl-stop is-auto is-rest">
      <button type="button" className="pl-dot is-auto" onClick={() => actions.focus(stop.latE6 / 1e6, stop.lonE6 / 1e6)} aria-label={`Xem ${stop.name} trên bản đồ`}>
        <ITent size={14} />
      </button>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <span className="pl-name static">{stop.name}</span>
          <span className="pl-tag">Tự chọn</span>
          <span className="pl-eta">{clock(stop.etaMin)}</span>
        </div>
        <div className="pl-stop-sub">
          Lán{stop.poiId?.startsWith('osm:') ? ' (OpenStreetMap)' : ''}
          {stop.eleM != null && <> · {meters(stop.eleM)}</>}
          {stop.offTrailM != null && <> · rẽ khỏi lối ~{meters(stop.offTrailM)}</>} · nghỉ đêm để kịp tới trước tối
        </div>
        <div className="pl-auto-actions">
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={() => actions.keepAuto(stop, afterWaypointId)}>Giữ</button>
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={() => actions.dismissAuto(stop)}>Bỏ</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Vùng nên nghỉ: chỗ không có lán mà ngày phải dừng (chủ sản phẩm 24/10). Hai mép
 * là chỗ người đi chậm nhất / nhanh nhất tới khi hết giờ đi; điểm nghỉ ở giữa.
 */
function ZoneRow({ stop, afterWaypointId, actions }: { stop: ResultStop; afterWaypointId: string; actions: TimelineActions }) {
  const z = stop.zone!
  return (
    <div className="pl-stop is-auto is-rest is-zone">
      <button type="button" className="pl-dot is-auto" onClick={() => actions.focus(stop.latE6 / 1e6, stop.lonE6 / 1e6)} aria-label="Xem vùng nên nghỉ trên bản đồ">
        <ITent size={14} />
      </button>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <span className="pl-name static">Vùng nên nghỉ</span>
          <span className="pl-tag">Cắm trại</span>
          <span className="pl-eta">{clock(stop.etaMin)}</span>
        </div>
        <div className="pl-stop-sub">
          Chưa có lán ·{' '}
          {z.refName != null && z.refFromM != null && z.refToM != null
            ? `cách ${z.refName} ${km(z.refFromM)}–${km(z.refToM)} km`
            : `km ${km(z.fromM)}–${km(z.toM)}`}
          {stop.eleM != null && <> · {meters(stop.eleM)}</>}
          {' · '}
          {z.water ? 'có nguồn nước đã biết' : 'chưa thấy nguồn nước — mang đủ nước'}
        </div>
        <div className="pl-stop-sub">Đi chậm thì dừng ở đầu vùng, đi nhanh thì tới cuối vùng.</div>
        <div className="pl-auto-actions">
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={() => actions.keepAuto(stop, afterWaypointId)}>Đặt chỗ cắm trại ở đây</button>
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={() => actions.dismissAuto(stop)}>Không mang lều</button>
        </div>
      </div>
    </div>
  )
}

function LegRow({
  leg, toggleFor, computeError, actions,
}: {
  leg: ResultLeg | null
  toggleFor: Waypoint | null
  computeError: string | null
  actions: TimelineActions
}) {
  const vehicle = (leg?.transport ?? toggleFor?.transport) === 'vehicle'
  const known = leg ? knownNote(leg) : null
  const notes = leg ? [...(known && known.level !== 'info' ? [known] : []), ...legFlagNotes(leg)] : []
  const lineKind = !leg ? 'pending' : vehicle ? 'vehicle' : leg.knownPct >= 90 ? 'known' : 'unknown'
  return (
    <div className={`pl-leg is-${lineKind}`}>
      <span className="pl-leg-line" aria-hidden="true" />
      <div className="pl-leg-body">
        {leg ? (
          <div className="pl-leg-stats">
            {distance(leg.distanceM)}
            {!vehicle && <> · ↑ {meters(leg.ascentM)} ↓ {meters(leg.descentM)}</>}
            {' · '}
            {vehicle
              ? `đi xe ${duration(leg.driveMin)}${leg.moveMin - leg.driveMin >= 5 ? ` + đi bộ ${duration(leg.moveMin - leg.driveMin)}` : ''}`
              : duration(leg.moveMin)}
            {known?.level === 'info' && <span className="pl-muted"> · {known.text.toLowerCase()}</span>}
          </div>
        ) : (
          <div className="pl-leg-stats pl-muted">{computeError ? 'Chưa tính được đoạn này' : 'Đang tính…'}</div>
        )}
        <Notes notes={notes} />
        {toggleFor && (
          <TransportToggle wp={toggleFor} resolved={leg?.transport ?? null} actions={actions} />
        )}
      </div>
    </div>
  )
}

/**
 * "auto": nút sáng theo cách máy chủ đã chọn, kèm chữ "tự chọn". Bấm một nút là
 * người dùng quyết — từ đó máy chủ không đổi nữa.
 */
function TransportToggle({
  wp, resolved, actions,
}: {
  wp: Waypoint
  resolved: 'walk' | 'vehicle' | null
  actions: TimelineActions
}) {
  const auto = wp.transport === 'auto'
  const on = auto ? resolved : wp.transport
  return (
    <div className={`pl-seg${on === 'vehicle' ? ' is-vehicle' : ''}`} role="group" aria-label="Cách đi đoạn này">
      <button
        type="button"
        className={on === 'walk' ? 'is-on' : ''}
        aria-pressed={!auto && on === 'walk'}
        onClick={() => actions.setTransport(wp.id, 'walk')}
      >
        <IWalk size={14} /> Đi bộ
      </button>
      <button
        type="button"
        className={on === 'vehicle' ? 'is-on' : ''}
        aria-pressed={!auto && on === 'vehicle'}
        onClick={() => actions.setTransport(wp.id, 'vehicle')}
      >
        <ICar size={14} /> Đi xe
      </button>
      {auto && <span className="pl-seg-auto">tự chọn</span>}
    </div>
  )
}
