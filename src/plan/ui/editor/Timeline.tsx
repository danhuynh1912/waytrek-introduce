import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DEFAULT_NIGHT_TRANSFER_MIN, nightTransferOffered, restToggleAllowed } from '../../core/doc'
import type { DaySlot } from '../../core/doc'
import { dayLayout, isHomeSlot } from '../../core/days'
import { clock, distance, duration, km, meters, parseClock, shortDate } from '@/shared/format'
import { transportChoiceShown, withoutRestSuggestions } from '../../core/timeline'
import type { Row } from '../../core/timeline'
import type { ArriveAt, AutoTime, RestChoice, ResultDay, ResultLeg, ResultStop, TrailPin, Transport, Waypoint } from '../../core/types'
import { ClockInput } from './ClockInput'
import { useDayDrag } from './use-day-drag'
import type { DragHandle } from './use-day-drag'
import { byLevel, dayNote, knownNote, legFlagNotes } from '../../core/warnings'
import type { Level, Note } from '../../core/warnings'
import { ICar, ICheck, IClose, IDown, IGrip, IInfo, IList, IPeak, ITent, IUp, IWalk, IWarn } from '../icons'

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
  /**
   * Giờ xuất phát người dùng đặt ở một điểm; null = để máy chủ tự tính.
   * `nightHere`: máy chủ đang cho ngủ ở điểm này — đặt giờ là ghim đêm đó lại.
   */
  setDepartAt(id: string, min: number | null, nightHere: boolean): void
  /** Chặng xe đầu đi tối hôm trước: giờ xe đón, null = tắt. */
  setNightTransfer(min: number | null): void
  /** Giờ xuất phát (doc.departMin) — sửa ngay ở điểm đầu tiên. */
  setDepart(min: number): void
  /** Đổi chỗ ngủ của đêm đó sang lán khác quanh đó (`stop.restChoices`). */
  chooseRest(stop: ResultStop, choice: RestChoice): void
  /** Kéo một điểm tới chỗ thả — có thể sang ngày khác (`moveToDay`). */
  moveToDay(id: string, slot: DaySlot): void
  /** Giờ có mặt / xuất phát ở một điểm MÁY chèn, theo `stop.timeKey`; null = bỏ. */
  setAutoTime(key: string, patch: { arriveAt?: ArriveAt | null; departAt?: number | null }): void
  focus(lat: number, lng: number): void
}

interface Props {
  rows: Row[]
  count: number
  fresh: boolean
  computeError: string | null
  trails: ReadonlyMap<string, TrailPin>
  actions: TimelineActions
  /** Giờ xe đón tối hôm trước (doc.nightTransferMin), null = tắt. */
  nightTransferMin: number | null
  /** Điểm cuối của chặng ĐẦU — chỉ chặng đó có lựa chọn đi tối hôm trước. */
  firstLegWpId: string | null
  /** Máy chủ hiểu giờ xuất phát ở điểm giữa (`departAtSupported`). */
  departOk: boolean
  /** Hiện chỗ nghỉ máy chủ gợi ý (lán tự chọn, vùng nên nghỉ) — `withoutRestSuggestions`. */
  showRests: boolean
  /** Máy chủ hiểu ngày tự xếp + giờ ở điểm máy chèn (`dayEditSupported`): mới cho kéo điểm. */
  dayMove: boolean
  /** Giờ đã đặt ở các điểm máy chèn (doc.autoTimes). */
  autoTimes: Readonly<Record<string, AutoTime>> | undefined
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
    case 'dayStart':
      return `start-${r.day.index}`
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

/** Dòng làm mốc cho vạch chèn khi kéo điểm (`DropSlot.anchor`). */
function anchorOf(r: Row): string | undefined {
  if (r.type === 'stop') return `wp:${r.wp.id}`
  if (r.type === 'day') return `day:${r.day.index}`
  return undefined
}

export function Timeline({
  rows: all, count, fresh, computeError, trails, actions, nightTransferMin, firstLegWpId, departOk, showRests, dayMove, autoTimes,
}: Props) {
  const box = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => dayLayout(all), [all])
  const { drag, handle, ghost } = useDayDrag(box, layout, actions.moveToDay)
  if (count === 0) return null
  const rows = showRests ? all : withoutRestSuggestions(all)
  // Tên + số liệu của mọi điểm, để dòng ngày nói đúng tên điểm nó nhắc tới.
  const stops = new Map<string, { name: string; info: ResultStop | null }>()
  // Điểm của doc theo id — dòng đầu ngày sửa được giờ đi khi chỗ ngủ đêm trước
  // là một điểm của người dùng (không phải lán máy chủ tự chèn).
  const points = new Map<string, { wp: Waypoint; index: number; info: ResultStop | null }>()
  // Từ MỌI dòng, kể cả chỗ nghỉ đang ẩn: cảnh báo của ngày vẫn gọi đúng tên chỗ đó.
  for (const r of all) {
    if (r.type === 'stop') {
      stops.set(r.wp.id, { name: r.wp.name, info: r.info })
      points.set(r.wp.id, { wp: r.wp, index: r.index, info: r.info })
    } else if (r.type === 'auto') stops.set(r.stop.id, { name: r.stop.name, info: r.stop })
  }
  // Có Ngày 0 (xe tối hôm trước) thì ngày leo đầu tiên là Ngày 1.
  const hasDay0 = rows.some((r) => r.type === 'day' && r.day.transfer)
  const grip = dayMove && count >= 2 ? handle : null
  const slot = drag && drag.at >= 0 ? layout.slots[drag.at] : null
  const home = slot != null && drag != null && isHomeSlot(layout, drag.id, slot)
  const dragged = drag ? points.get(drag.id) : undefined
  return (
    <div ref={box} className={`pl-timeline${fresh ? '' : ' is-stale'}${drag ? ' is-dragging' : ''}`}>
      <AnimatePresence initial={false}>
        {rows.map((r, i) => (
          <motion.div
            key={rowKey(r, i, rows)}
            layout="position"
            {...ROW_MOTION}
            data-anchor={anchorOf(r)}
            className={r.type === 'stop' && drag?.id === r.wp.id ? 'pl-row-dragged' : undefined}
          >
            {r.type === 'day' && <DayRow day={r.day} stops={stops} number={hasDay0 ? r.day.index : r.day.index + 1} />}
            {r.type === 'dayStart' && (
              <DayStartRow
                day={r.day}
                name={stops.get(r.day.startStopId)?.name ?? 'Chỗ nghỉ đêm'}
                point={points.get(r.day.startStopId) ?? null}
                auto={points.has(r.day.startStopId) ? null : stops.get(r.day.startStopId)?.info ?? null}
                autoTimes={autoTimes}
                count={count}
                departOk={departOk}
                actions={actions}
              />
            )}
            {r.type === 'stop' && (
              <StopRow
                wp={r.wp}
                index={r.index}
                count={count}
                info={r.info}
                trails={trails}
                departOk={departOk}
                actions={actions}
                grip={grip}
                pickupFirst={hasDay0}
              />
            )}
            {r.type === 'auto' && <AutoRow stop={r.stop} afterWaypointId={r.afterWaypointId} autoTimes={autoTimes} actions={actions} />}
            {r.type === 'leg' && (
              <LegRow
                leg={r.leg}
                detached={r.detached === true}
                toggleFor={r.toggleFor != null && transportChoiceShown(r.toggleFor.transport, r.pairLegs ?? null) ? r.toggleFor : null}
                computeError={computeError}
                actions={actions}
                nightTransferMin={r.toggleFor != null && r.toggleFor.id === firstLegWpId ? nightTransferMin : undefined}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {/* Vạch chèn: chỗ điểm sẽ nằm nếu thả, kèm ngày của chỗ đó. Chỗ cũ thì không vẽ. */}
      <div
        className={`pl-drop-line${slot && !home ? ' is-on' : ''}`}
        style={{ transform: `translateY(${slot && drag ? drag.ys[drag.at] : 0}px)` }}
        aria-hidden="true"
      >
        {slot && <span>Ngày {hasDay0 ? slot.day : slot.day + 1}</span>}
      </div>
      {/* Bóng của điểm đang kéo, đi theo con trỏ (vị trí đặt thẳng từ use-day-drag). */}
      <div ref={ghost} className={`pl-drag-ghost${drag && !drag.keyboard ? ' is-on' : ''}`} aria-hidden="true">
        {dragged && (
          <>
            <span className={`pl-dot${dragged.wp.kind === 'peak' ? ' is-peak' : ''}`}>{dragged.index + 1}</span>
            <span>{dragged.wp.name}</span>
          </>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {drag?.keyboard && dragged
          ? `Đang chuyển ${dragged.wp.name}${slot ? ` — ${home ? 'chỗ cũ' : `ngày ${hasDay0 ? slot.day : slot.day + 1}`}` : ''}. Mũi tên lên, xuống để chọn chỗ; Enter để thả; Esc để huỷ.`
          : ''}
      </p>
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

function DayRow({
  day, stops, number,
}: {
  day: ResultDay
  stops: ReadonlyMap<string, { name: string; info: ResultStop | null }>
  number: number
}) {
  // Dòng "Xuất phát … để tới … lúc …" dưới tiêu đề ngày có mốc đã bỏ (chủ sản
  // phẩm 26/10, thừa): giờ đi nằm ngay ở điểm đầu ngày, giờ mốc ở dòng của mốc.
  const notes = day.warnings.flatMap((w) => dayNote(w, (id) => stops.get(id)?.name) ?? []).sort(byLevel)
  return (
    <section className="pl-day" aria-label={`Ngày ${day.index + 1}`}>
      <div className="pl-day-head">
        <span className="pl-day-title">
          Ngày {number} · {shortDate(day.date)}
        </span>
      </div>
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
        data-tip={open ? 'Gập các cảnh báo của ngày này' : 'Xem các cảnh báo, lưu ý của ngày này'}
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

/**
 * Đầu một ngày: xuất phát từ chính chỗ đã ngủ đêm trước. Giờ đi sáng nay là giờ
 * xuất phát của chỗ ngủ đó — sửa được ngay đây, kể cả khi chỗ ngủ là điểm máy chủ
 * tự chèn (lán tự chọn, vùng nên nghỉ — chủ sản phẩm 26/10).
 */
function DayStartRow({ day, name, point, auto, autoTimes, count, departOk, actions }: {
  day: ResultDay
  name: string
  point: { wp: Waypoint; index: number; info: ResultStop | null } | null
  /** Chỗ ngủ là điểm máy chèn (lán tự chọn, vùng nên nghỉ…): giờ đi sáng nay đặt theo khoá của nó. */
  auto: ResultStop | null
  autoTimes: Readonly<Record<string, AutoTime>> | undefined
  count: number
  departOk: boolean
  actions: TimelineActions
}) {
  const time = auto?.timeKey ? autoTimes?.[auto.timeKey] : undefined
  return (
    <div className="pl-stop is-auto is-start">
      <span className="pl-dot is-auto" aria-hidden="true"><ITent size={22} /></span>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <span className="pl-name static">{name}</span>
          <span className="pl-tag">Xuất phát</span>
          {point
            ? (
              <TimesChooser wp={point.wp} info={point.info} index={point.index} count={count} departOk={departOk} actions={actions}>
                <span className={`pl-eta${point.wp.departAt !== undefined ? ' is-set' : ''}`}>{clock(day.departMin)}</span>
              </TimesChooser>
            )
            : auto?.timeKey
            ? (
              <AutoTimes stop={auto} time={time} actions={actions}>
                <span className={`pl-eta${time?.departAt !== undefined ? ' is-set' : ''}`}>{clock(day.departMin)}</span>
              </AutoTimes>
            )
            : <span className="pl-eta">{clock(day.departMin)}</span>}
        </div>
      </div>
    </div>
  )
}

function NameField({ value, onCommit, label }: { value: string; onCommit: (v: string) => void; label: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  if (!editing) {
    return (
      <button type="button" className="pl-name" onClick={() => { setText(value); setEditing(true) }} data-tip="Bấm để đổi tên điểm">
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

function kindLine(wp: Waypoint, trails: ReadonlyMap<string, TrailPin>): string | null {
  switch (wp.kind) {
    case 'peak':
      return 'Đỉnh'
    case 'poi':
      // Lán / điểm có sẵn: tên đã nói đủ, không dòng mô tả (chủ sản phẩm 24/10).
      return null
    case 'route': {
      const t = wp.ref ? trails.get(wp.ref) : undefined
      return t ? `Trên lộ trình ${t.name}` : 'Trên lộ trình'
    }
    case 'custom':
      return null
  }
}

function StopRow({
  wp, index, count, info, trails, departOk, actions, grip, pickupFirst,
}: {
  wp: Waypoint
  index: number
  count: number
  info: ResultStop | null
  trails: ReadonlyMap<string, TrailPin>
  departOk: boolean
  actions: TimelineActions
  /** Kéo điểm sang chỗ khác / ngày khác; null = máy chủ chưa hiểu (`dayEditSupported`). */
  grip: DragHandle | null
  /**
   * Có chuyến xe tối hôm trước: giờ ở điểm đầu là giờ XE ĐÓN (Ngày 0), sửa nó là
   * sửa giờ xe đón — giờ đi sáng hôm sau sửa ở dòng "Xuất phát" đầu Ngày 1.
   */
  pickupFirst: boolean
}) {
  const middle = index > 0 && index < count - 1
  const userRest = wp.rest && middle
  // Điểm tự chấm: không dòng mô tả nào (chủ sản phẩm 24/10) — kể cả độ cao.
  const kind = kindLine(wp, trails)
  const parts = kind ? [kind, ...(info?.eleM != null ? [meters(info.eleM)] : [])] : []
  const selfMarked = userRest && (wp.kind === 'custom' || wp.kind === 'route')
  return (
    <div className={`pl-stop${wp.rest && middle ? ' is-rest' : ''}`}>
      <button
        type="button"
        className={`pl-dot${wp.kind === 'peak' ? ' is-peak' : ''}${grip ? ' is-grab' : ''}`}
        onClick={() => {
          if (!grip?.swallowClick()) actions.focus(wp.latE6 / 1e6, wp.lonE6 / 1e6)
        }}
        onPointerDown={grip ? (e) => grip.onPointerDown(e, wp.id) : undefined}
        aria-label={`Xem điểm ${index + 1} trên bản đồ`}
        data-tip={grip ? `Bấm: đưa bản đồ tới điểm ${index + 1} · Giữ và kéo: chuyển sang chỗ khác, ngày khác` : `Đưa bản đồ tới điểm ${index + 1}`}
      >
        {index + 1}
      </button>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <NameField value={wp.name} label={`Tên điểm ${index + 1}`} onCommit={(v) => actions.rename(wp.id, v)} />
          {info && <RestChooser stop={info} actions={actions} />}
          {/* Nút sửa điểm đứng TRƯỚC giờ: trên màn cảm ứng chúng nằm ngay trong hàng,
              để giờ của mọi dòng dạt sát mép phải (chủ sản phẩm 26/10). */}
          <div className="pl-stop-tools">
            {grip && (
              <button
                type="button"
                className="pl-icon-btn sm pl-grip"
                onPointerDown={(e) => grip.onPointerDown(e, wp.id)}
                onKeyDown={(e) => grip.onKeyDown(e, wp.id)}
                onBlur={() => grip.onBlur(wp.id)}
                aria-label={`Chuyển ${wp.name} sang chỗ khác — Enter để nhấc lên`}
                data-tip="Giữ và kéo để chuyển điểm sang chỗ khác, ngày khác"
              >
                <IGrip size={16} />
              </button>
            )}
            <button
              type="button"
              className="pl-icon-btn sm"
              onClick={() => actions.move(wp.id, -1)}
              disabled={index === 0}
              aria-label="Đưa lên"
              data-tip="Đổi chỗ với điểm ngay trước nó"
            >
              <IUp size={16} />
            </button>
            <button
              type="button"
              className="pl-icon-btn sm"
              onClick={() => actions.move(wp.id, 1)}
              disabled={index === count - 1}
              aria-label="Đưa xuống"
              data-tip="Đổi chỗ với điểm ngay sau nó"
            >
              <IDown size={16} />
            </button>
            <button type="button" className="pl-icon-btn sm" onClick={() => actions.remove(wp.id)} aria-label={`Xoá ${wp.name}`} data-tip="Bỏ điểm này khỏi kế hoạch">
              <IClose size={16} />
            </button>
          </div>
          {/* Điểm đầu chỉ có giờ xuất phát (giờ đi mỗi ngày); điểm khác có giờ có
              mặt và giờ xuất phát, sửa cả hai ở một ô (chủ sản phẩm 26/10). */}
          {info && (index === 0
            ? (
              <ClockInput
                className="pl-eta pl-eta-edit"
                value={info.etaMin}
                label={pickupFirst ? 'Giờ xe đón' : 'Giờ khởi hành'}
                onCommit={pickupFirst ? actions.setNightTransfer : actions.setDepart}
              />
            )
            : (
              <TimesChooser wp={wp} info={info} index={index} count={count} departOk={departOk} actions={actions}>
                <StopTimes wp={wp} info={info} />
              </TimesChooser>
            ))}
        </div>
        {(parts.length > 0 || info?.leaveByMin != null || (info?.waitMin ?? 0) > 0) && <div className="pl-stop-sub">
          {wp.kind === 'peak' && <IPeak size={13} />}
          {[
            parts.length > 0 ? <span key="kind">{parts.join(' · ')}</span> : null,
            info?.leaveByMin != null
              ? (
                // Tới đỉnh đã muộn hơn giờ phải rời: nói thẳng là không kịp.
                info.leaveByMin < info.etaMin
                  ? <span key="leave" className="pl-late">Giờ lên đỉnh khá muộn, trời sẽ tối khi xuống núi</span>
                  : <span key="leave">rời đỉnh muộn nhất <b>{clock(info.leaveByMin)}</b></span>
              )
              : null,
            (info?.waitMin ?? 0) > 0 ? <span key="wait">chờ {duration(info!.waitMin!)}</span> : null,
          ]
            .filter((x) => x != null)
            .flatMap((x, k) => (k === 0 ? [x] : [<span key={`sep${k}`} aria-hidden="true">·</span>, x]))}
        </div>}
        {restToggleAllowed(wp, index, count) && (
          <label className="pl-check" data-tip="Ngủ lại ở điểm này — sáng hôm sau đi tiếp từ đây">
            <input type="checkbox" checked={wp.rest} onChange={() => actions.toggleRest(wp.id)} />
            <span>Nghỉ đêm ở đây{selfMarked && <em> · do bạn đánh dấu</em>}</span>
          </label>
        )}
      </div>
    </div>
  )
}

/**
 * Cột giờ của một điểm (trừ điểm đầu): giờ có mặt, và dưới nó "đi HH:MM" khi giờ
 * rời khác giờ tới (đứng trên đỉnh, chờ giờ đã đặt). Giờ người dùng tự đặt màu
 * teal; chỗ nghỉ đêm thì giờ đi nằm ở dòng đầu ngày hôm sau.
 */
function StopTimes({ wp, info }: { wp: Waypoint; info: ResultStop }) {
  const depart = info.departMin
  const showDepart = !info.rest && depart != null && (wp.departAt !== undefined || depart !== info.etaMin)
  return (
    <>
      <span className={`pl-eta${wp.arriveAt !== undefined ? ' is-set' : ''}`}>{clock(info.etaMin)}</span>
      {showDepart && <span className={`pl-eta-depart${wp.departAt !== undefined ? ' is-set' : ''}`}>đi {clock(depart)}</span>}
    </>
  )
}

/** Giờ cụ thể mở từ giờ đang có, làm tròn 5 phút; chưa có thì 06:00. */
function startAt(computed: number | null | undefined): number {
  return computed == null ? 6 * 60 : (Math.round(computed / 5) * 5) % 1440
}

/**
 * Giờ có mặt và giờ xuất phát của một điểm (chủ sản phẩm 26/10: mỗi điểm trừ
 * điểm đầu có cả hai). Giờ có mặt: máy chủ tính ngược ra giờ đi đầu ngày — phần
 * đông lên đỉnh để đón bình minh. Giờ xuất phát: tới sớm thì chờ; ở chỗ nghỉ đêm
 * là giờ đi sáng hôm sau. Bấm vào giờ mở một ô nổi, như ô chọn lán.
 */
function TimesChooser({ wp, info, index, count, departOk, actions, children }: {
  wp: Waypoint
  info: ResultStop | null
  index: number
  count: number
  departOk: boolean
  actions: TimelineActions
  children: ReactNode
}) {
  const overnight = info?.rest ?? (wp.rest && index > 0 && index < count - 1)
  // Đêm máy chủ tự chọn ở điểm này (chưa đánh dấu nghỉ): đặt giờ đi sáng hôm
  // sau thì ghim đêm đó lại, kẻo lần tính sau ngủ chỗ khác (setDepartAt).
  const nightHere = overnight && !wp.rest
  return (
    <TimesPopover
      name={wp.name}
      info={info}
      overnight={overnight}
      arriveAt={wp.arriveAt}
      departAt={wp.departAt}
      canArrive
      // Điểm cuối không có gì sau nó để đi tiếp — máy chủ bỏ qua giờ xuất phát.
      // Giờ đã đặt từ trước vẫn hiện (để bỏ được) dù máy chủ đang chạy bản cũ.
      canDepart={index < count - 1 && (departOk || wp.departAt !== undefined)}
      onArrive={(at) => actions.setArriveAt(wp.id, at)}
      onDepart={(m) => actions.setDepartAt(wp.id, m, nightHere)}
    >
      {children}
    </TimesPopover>
  )
}

/**
 * Giờ ở một điểm MÁY chèn — điểm bắt đầu leo, điểm lên xe, lán tự chọn, vùng nên
 * nghỉ, chỗ ngủ sau chuyến xe đêm (chủ sản phẩm 26/10: sửa được giờ của mọi
 * điểm). Điểm vẫn là của máy: giờ gắn theo `stop.timeKey`, lần tính sau còn
 * điểm đó thì còn tác dụng. Chỗ ngủ sau xe đêm chỉ có giờ đi sáng hôm sau — giờ
 * tới là giờ xe chạy, sửa ở ô "Xe đón lúc".
 */
function AutoTimes({ stop, time, actions, children }: {
  stop: ResultStop
  time: AutoTime | undefined
  actions: TimelineActions
  children: ReactNode
}) {
  const key = stop.timeKey
  if (!key) return <>{children}</>
  return (
    <TimesPopover
      name={stop.name}
      info={stop}
      overnight={stop.rest}
      arriveAt={time?.arriveAt}
      departAt={time?.departAt}
      canArrive={!stop.transfer}
      canDepart
      onArrive={(at) => actions.setAutoTime(key, { arriveAt: at })}
      onDepart={(m) => actions.setAutoTime(key, { departAt: m })}
    >
      {children}
    </TimesPopover>
  )
}

/** Cột giờ của một điểm máy chèn: giờ tới, và "đi HH:MM" khi giờ rời khác giờ tới. */
function AutoStopTimes({ stop, time }: { stop: ResultStop; time: AutoTime | undefined }) {
  const depart = stop.departMin
  const showDepart = !stop.rest && depart != null && (time?.departAt !== undefined || depart !== stop.etaMin)
  return (
    <>
      <span className={`pl-eta${time?.arriveAt !== undefined ? ' is-set' : ''}`}>{clock(stop.etaMin)}</span>
      {showDepart && <span className={`pl-eta-depart${time?.departAt !== undefined ? ' is-set' : ''}`}>đi {clock(depart)}</span>}
    </>
  )
}

/**
 * Chữ nổi trên ô giờ (chủ sản phẩm 26/10): nói giờ dự tính của chính điểm đó rồi
 * mời sửa — "Dự tính có mặt lúc 10:16, xuất phát từ đây lúc 16:10. Click để sửa".
 * Chỗ ngủ đêm thì giờ đi là sáng hôm sau. Chưa có kết quả thì chỉ nói sửa được gì.
 */
function timesTip(info: ResultStop | null, overnight: boolean, canArrive: boolean, canDepart: boolean): string {
  const depart = canDepart && info?.departMin != null
    ? `xuất phát từ đây lúc ${clock(info.departMin)}${overnight ? ' sáng hôm sau' : ''}`
    : null
  if (info && canArrive) return `Dự tính có mặt lúc ${clock(info.etaMin)}${depart ? `, ${depart}` : ''}. Click để sửa`
  if (depart) return `Dự tính ${depart}. Click để sửa`
  return canArrive && canDepart
    ? 'Đặt giờ có mặt, giờ xuất phát ở điểm này'
    : canArrive ? 'Đặt giờ có mặt ở điểm này' : 'Đặt giờ xuất phát ở điểm này'
}

function TimesPopover({ name, info, overnight, arriveAt, departAt, canArrive, canDepart, onArrive, onDepart, children }: {
  name: string
  info: ResultStop | null
  overnight: boolean
  arriveAt: ArriveAt | undefined
  departAt: number | undefined
  canArrive: boolean
  canDepart: boolean
  onArrive(at: ArriveAt | null): void
  onDepart(min: number | null): void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const arrive = arriveAt === undefined ? 'auto' : arriveAt === 'sunrise' ? 'sunrise' : 'clock'
  const depart = departAt === undefined ? 'auto' : 'clock'
  const pickArrive = (v: string) => {
    if (v === 'auto') onArrive(null)
    else if (v === 'sunrise') onArrive('sunrise')
    else onArrive(startAt(info?.etaMin))
  }
  const pickDepart = (v: string) => onDepart(v === 'auto' ? null : startAt(info?.departMin))
  const tip = timesTip(info, overnight, canArrive, canDepart)
  return (
    <span className="pl-times-pick" ref={box}>
      <button
        type="button"
        className={`pl-times-btn${open ? ' is-on' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Sửa giờ ở ${name}`}
        data-tip={tip}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      <div className={`pl-rest-tip pl-times-tip${open ? ' is-open' : ''}`} role="dialog" aria-label={`Giờ ở ${name}`}>
        {canArrive && (
          <>
            <p className="pl-rest-tip-head">Giờ có mặt</p>
            <div className="pl-times-row">
              <select value={arrive} aria-label={`Giờ có mặt ở ${name}`} tabIndex={open ? 0 : -1} onChange={(e) => pickArrive(e.target.value)} className={arrive === 'auto' ? '' : 'is-on'}>
                <option value="auto">Tự tính{arrive === 'auto' && info ? ` · ${clock(info.etaMin)}` : ''}</option>
                <option value="sunrise">Lúc bình minh{arrive === 'sunrise' && info?.targetMin != null ? ` · ${clock(info.targetMin)}` : ''}</option>
                <option value="clock">Lúc…</option>
              </select>
              {typeof arriveAt === 'number' && (
                <ClockInput value={arriveAt} label={`Giờ có mặt ở ${name}`} onCommit={(m) => onArrive(m)} />
              )}
            </div>
          </>
        )}
        {canDepart && (
          <>
            <p className="pl-rest-tip-head">{overnight ? 'Giờ xuất phát sáng hôm sau' : 'Giờ xuất phát'}</p>
            <div className="pl-times-row">
              <select value={depart} aria-label={`Giờ xuất phát ở ${name}`} tabIndex={open ? 0 : -1} onChange={(e) => pickDepart(e.target.value)} className={depart === 'auto' ? '' : 'is-on'}>
                <option value="auto">Tự tính{depart === 'auto' && info?.departMin != null ? ` · ${clock(info.departMin)}` : ''}</option>
                <option value="clock">Lúc…</option>
              </select>
              {departAt !== undefined && (
                <ClockInput value={departAt} label={`Giờ xuất phát ở ${name}`} onCommit={(m) => onDepart(m)} />
              )}
            </div>
          </>
        )}
      </div>
    </span>
  )
}

function AutoRow({ stop, afterWaypointId, autoTimes, actions }: {
  stop: ResultStop
  afterWaypointId: string
  autoTimes: Readonly<Record<string, AutoTime>> | undefined
  actions: TimelineActions
}) {
  const time = stop.timeKey ? autoTimes?.[stop.timeKey] : undefined
  // Giờ ở điểm máy chèn sửa được khi máy chủ có khoá cho nó (engine ≥ 7).
  const times = stop.timeKey
    ? <AutoTimes stop={stop} time={time} actions={actions}><AutoStopTimes stop={stop} time={time} /></AutoTimes>
    : <span className="pl-eta">{clock(stop.etaMin)}</span>
  if (stop.zone) return <ZoneRow stop={stop} afterWaypointId={afterWaypointId} times={times} actions={actions} />
  if (stop.transfer || stop.trailhead || stop.pickup) {
    // Điểm engine chèn để cho biết giờ: điểm bắt đầu leo (xe → đi bộ) và/hoặc
    // chỗ ngủ sau chặng xe tối hôm trước. Không Giữ / Bỏ — tắt xe tối hôm trước
    // bằng ô trên chặng xe. Không dòng mô tả nào (chủ sản phẩm 24/10): tên +
    // giờ là đủ.
    return (
      <div className={`pl-stop is-auto${stop.transfer ? ' is-rest' : ' is-head'}`}>
        <button
          type="button"
          className="pl-dot is-auto"
          onClick={() => actions.focus(stop.latE6 / 1e6, stop.lonE6 / 1e6)}
          aria-label={`Xem ${stop.name} trên bản đồ`}
          data-tip={`Đưa bản đồ tới ${stop.name}`}
        >
          {stop.trailhead ? <IWalk size={22} /> : stop.pickup ? <ICar size={22} /> : <ITent size={22} />}
        </button>
        <div className="pl-stop-body">
          <div className="pl-stop-line">
            <span className="pl-name static">{stop.name}</span>
            {times}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="pl-stop is-auto is-rest">
      <button
        type="button"
        className="pl-dot is-auto"
        onClick={() => actions.focus(stop.latE6 / 1e6, stop.lonE6 / 1e6)}
        aria-label={`Xem ${stop.name} trên bản đồ`}
        data-tip={`Đưa bản đồ tới ${stop.name}`}
      >
        <ITent size={22} />
      </button>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <span className="pl-name static">{stop.name}</span>
          <RestChooser stop={stop} actions={actions} />
          <span className="pl-tag">Tự chọn</span>
          {times}
        </div>
        <div className="pl-stop-sub">
          Lán{stop.poiId?.startsWith('osm:') ? ' (OpenStreetMap)' : ''}
          {stop.eleM != null && <> · {meters(stop.eleM)}</>}
          {stop.offTrailM != null && <> · rẽ khỏi lối ~{meters(stop.offTrailM)}</>} · nghỉ đêm để kịp tới trước tối
        </div>
      </div>
    </div>
  )
}

/**
 * Chỗ ngủ là lán: quanh đó có lán khác đi kịp thì cho chọn lán, chỉ một lán
 * thì bắt buộc ngủ ở đó — không có gì để bấm (chủ sản phẩm 24/10). Danh sách
 * và luật "đi kịp" do máy chủ tính (`restChoices`).
 */
function RestChooser({ stop, actions }: { stop: ResultStop; actions: TimelineActions }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const choices = stop.restChoices
  if (!choices || choices.length < 2) return null
  return (
    <span className="pl-rest-pick" ref={box}>
      <button
        type="button"
        className={`pl-rest-btn${open ? ' is-on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chọn lán ngủ thay cho ${stop.name}`}
        data-tip="Đổi sang lán khác quanh đây mà vẫn tới kịp trước tối"
        onClick={() => setOpen((o) => !o)}
      >
        <IList size={16} />
      </button>
      <div className={`pl-rest-tip${open ? ' is-open' : ''}`} role="listbox" aria-label="Lán ngủ quanh đây">
        <p className="pl-rest-tip-head">Ngủ ở lán nào</p>
        {choices.map((c) => (
          <button
            key={c.poiId}
            type="button"
            role="option"
            aria-selected={c.current}
            className={`pl-rest-opt${c.current ? ' is-current' : ''}`}
            tabIndex={open ? 0 : -1}
            data-tip={c.current ? 'Lán đang ngủ đêm này' : `Ngủ đêm này ở ${c.name}, tới khoảng ${clock(c.etaMin)}`}
            onClick={() => {
              setOpen(false)
              if (!c.current) actions.chooseRest(stop, c)
            }}
          >
            <span className="pl-rest-opt-check">{c.current && <ICheck size={14} />}</span>
            <span className="pl-rest-opt-name">{c.name}</span>
            <span className="pl-rest-opt-eta">{clock(c.etaMin)}</span>
          </button>
        ))}
      </div>
    </span>
  )
}

/**
 * Vùng nên nghỉ: chỗ không có lán mà ngày phải dừng (chủ sản phẩm 24/10) — đoạn
 * đi trong 1 giờ cuối trước chỗ muộn nhất phải dừng (26/10); điểm nghỉ ở cuối.
 */
function ZoneRow({ stop, afterWaypointId, times, actions }: {
  stop: ResultStop
  afterWaypointId: string
  times: ReactNode
  actions: TimelineActions
}) {
  const z = stop.zone!
  return (
    <div className="pl-stop is-auto is-rest is-zone">
      <button
        type="button"
        className="pl-dot is-auto"
        onClick={() => actions.focus(stop.latE6 / 1e6, stop.lonE6 / 1e6)}
        aria-label="Xem vùng nên nghỉ trên bản đồ"
        data-tip="Đưa bản đồ tới vùng nên nghỉ"
      >
        <ITent size={22} />
      </button>
      <div className="pl-stop-body">
        <div className="pl-stop-line">
          <span className="pl-name static">Vùng nên nghỉ</span>
          <span className="pl-tag">Cắm trại</span>
          {/* Phần chữ phụ thu vào nút "i" (chủ sản phẩm 26/10) — dòng chỉ còn tên, nhãn, giờ. */}
          <InfoTip label="Chi tiết vùng nên nghỉ" title="Vùng nên nghỉ">
            <div className="pl-zone-info">
              <p>
                Chưa có lán ·{' '}
                {z.refName != null && z.refFromM != null && z.refToM != null
                  ? `cách ${z.refName} ${km(z.refFromM)}–${km(z.refToM)} km`
                  : `km ${km(z.fromM)}–${km(z.toM)}`}
                {stop.eleM != null && <> · {meters(stop.eleM)}</>}
                {' · '}
                {z.water ? 'có nguồn nước đã biết' : 'chưa thấy nguồn nước — mang đủ nước'}
              </p>
              <p>Đoạn đi trong khoảng 1 giờ cuối trước chỗ phải dừng — tìm chỗ cắm trại từ đầu vùng, muộn nhất dừng ở cuối vùng.</p>
            </div>
          </InfoTip>
          {times}
        </div>
        <div className="pl-auto-actions">
          <button
            type="button"
            className="pl-btn pl-btn-quiet sm"
            onClick={() => actions.keepAuto(stop, afterWaypointId)}
            data-tip="Ghim chỗ cắm trại vào kế hoạch thành một điểm nghỉ đêm"
          >
            Đặt chỗ cắm trại ở đây
          </button>
          <button
            type="button"
            className="pl-btn pl-btn-quiet sm"
            onClick={() => actions.dismissAuto(stop)}
            data-tip="Đoàn không mang lều — bỏ mọi vùng nên nghỉ, chỉ ngủ ở lán"
          >
            Không mang lều
          </button>
        </div>
      </div>
    </div>
  )
}

function LegRow({
  leg, detached, toggleFor, computeError, actions, nightTransferMin,
}: {
  leg: ResultLeg | null
  /** Nối tới / từ một chỗ nghỉ đang ẩn: không vẽ đường dọc (`Row.detached`). */
  detached: boolean
  toggleFor: Waypoint | null
  computeError: string | null
  actions: TimelineActions
  /** Chỉ có ở chặng đầu: undefined = không phải chặng đầu, null = đang tắt. */
  nightTransferMin?: number | null
}) {
  const vehicle = (leg?.transport ?? toggleFor?.transport) === 'vehicle'
  const known = leg ? knownNote(leg) : null
  const notes = leg ? [...(known && known.level !== 'info' ? [known] : []), ...legFlagNotes(leg)] : []
  const lineKind = !leg ? 'pending' : vehicle ? 'vehicle' : leg.knownPct >= 90 ? 'known' : 'unknown'
  // Chỉ cảnh báo nguy hiểm (không có lối) nằm ngay trên dòng; phần còn lại vào
  // hộp mở bằng nút "i" (chủ sản phẩm 24/10).
  const inline = notes.filter((n) => n.level === 'danger')
  const more = notes.filter((n) => n.level !== 'danger')
  return (
    <div className={`pl-leg is-${lineKind}${detached ? ' is-detached' : ''}`}>
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
            {more.length > 0 && (
              <InfoTip label={`${more.length} lưu ý về đoạn này`} title="Lưu ý về đoạn này" tone={more[0].level}>
                <Notes notes={more} />
              </InfoTip>
            )}
          </div>
        ) : (
          <div className="pl-leg-stats pl-muted">{computeError ? 'Chưa tính được đoạn này' : 'Đang tính…'}</div>
        )}
        <Notes notes={inline} />
        {toggleFor && (
          <div className="pl-leg-mode">
            <TransportToggle wp={toggleFor} resolved={leg?.transport ?? null} actions={actions} />
          </div>
        )}
        {nightTransferMin !== undefined && vehicle && nightTransferOffered(leg?.distanceM ?? null, nightTransferMin) && (
          <NightTransfer value={nightTransferMin} onChange={actions.setNightTransfer} />
        )}
      </div>
    </div>
  )
}

/**
 * Nút "i": phần chữ phụ của một dòng (lưu ý của đoạn, chi tiết vùng nên nghỉ)
 * thu vào đây cho dòng gọn (chủ sản phẩm 24/10, 26/10). Rê chuột: thẻ hiện ngay
 * dưới dòng. Bấm (cả trên điện thoại): mở hộp.
 */
function InfoTip({ label, title, tone, children }: { label: string; title: string; tone?: Level; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])
  return (
    <>
      <span className="pl-leg-info-wrap">
        <button
          type="button"
          className={`pl-leg-info${tone ? ` pl-note-${tone}` : ''}`}
          onClick={() => setOpen(true)}
          aria-label={label}
        >
          <IInfo size={15} />
        </button>
        <span className="pl-leg-tip" role="tooltip">{children}</span>
      </span>
      <dialog ref={dialog} className="pl-dialog" onClose={() => setOpen(false)} onCancel={() => setOpen(false)} aria-label={title}>
        <div className="pl-dialog-head">
          <h2>{title}</h2>
          <button type="button" className="pl-icon-btn sm" onClick={() => setOpen(false)} aria-label="Đóng" data-tip="Đóng"><IClose size={16} /></button>
        </div>
        {children}
      </dialog>
    </>
  )
}

/**
 * Chặng xe đầu: đi từ tối hôm trước (đa số tour đón 19:00–19:30), tới chân núi
 * trong đêm — có đoàn nghỉ lại, có đoàn leo luôn từ rạng sáng (chủ sản phẩm 26/10).
 */
function NightTransfer({ value, onChange }: { value: number | null; onChange(min: number | null): void }) {
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    const m = text == null ? null : parseClock(text)
    if (m != null && m !== value) onChange(m)
    setText(null)
  }
  return (
    <div className="pl-night">
      <label className="pl-check" data-tip="Xe đón từ tối hôm trước, tới chân núi trong đêm">
        <input
          type="checkbox"
          checked={value != null}
          onChange={(e) => onChange(e.target.checked ? DEFAULT_NIGHT_TRANSFER_MIN : null)}
        />
        <span>Đi từ tối hôm trước</span>
      </label>
      {value != null && (
        <label className="pl-night-time">
          <span>Xe đón lúc</span>
          <input
            type="time"
            value={text ?? clock(value)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      )}
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
        data-tip="Đi bộ đoạn này — máy chủ thôi tự chọn cách đi"
      >
        <IWalk size={14} /> Đi bộ
      </button>
      <button
        type="button"
        className={on === 'vehicle' ? 'is-on' : ''}
        aria-pressed={!auto && on === 'vehicle'}
        onClick={() => actions.setTransport(wp.id, 'vehicle')}
        data-tip="Đi xe đoạn này — máy chủ thôi tự chọn cách đi"
      >
        <ICar size={14} /> Đi xe
      </button>
      {auto && <span className="pl-seg-auto">tự chọn</span>}
    </div>
  )
}
