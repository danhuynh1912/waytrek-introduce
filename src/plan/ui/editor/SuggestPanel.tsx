import { AnimatePresence, motion } from 'motion/react'
import { distance, duration } from '@/shared/format'
import type { Approach, SuggestOutcome, SuggestTotals } from '../../core/types'
import { dayNote } from '../../core/warnings'
import { IRoute } from '../icons'
import type { SuggestState } from './use-plan-editor'

const EASE = [0.65, 0, 0.35, 1] as const
const CARD_MOTION = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.24, ease: EASE },
}

interface Props {
  readiness: 'ready' | 'needStart' | null
  state: SuggestState
  onSuggest(): void
  onApply(): void
  onDismiss(): void
}

/**
 * Gợi ý thứ tự leo khi kế hoạch có từ hai đỉnh (chủ sản phẩm 24/10). Nút chỉ có
 * khi đã có điểm xuất phát; thẻ kết quả chỉ hiện sau khi bấm.
 */
export function SuggestPanel({ readiness, state, onSuggest, onApply, onDismiss }: Props) {
  // Chưa có điểm xuất phát thì không hiện gì (chủ sản phẩm 24/10: bỏ dòng nhắc).
  if (readiness == null || readiness === 'needStart') return null
  const open = state.kind === 'ready' || state.kind === 'error'
  return (
    <div className="pl-suggest">
      {!open && (
        <button type="button" className="pl-btn pl-btn-quiet pl-suggest-btn" onClick={onSuggest} disabled={state.kind === 'loading'}>
          <IRoute size={16} />
          {state.kind === 'loading' ? 'Đang tìm thứ tự leo…' : 'Gợi ý thứ tự leo nhanh nhất'}
        </button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="card" className="pl-suggest-card" {...CARD_MOTION}>
            <div className="pl-suggest-inner">
              {state.kind === 'error' ? (
                <>
                  <p className="pl-suggest-msg">Chưa gợi ý được — {state.message}</p>
                  <div className="pl-suggest-actions">
                    <button type="button" className="pl-btn pl-btn-quiet sm" onClick={onSuggest}>Thử lại</button>
                    <button type="button" className="pl-btn pl-btn-quiet sm" onClick={onDismiss}>Đóng</button>
                  </div>
                </>
              ) : (
                <Outcome outcome={state.outcome} onApply={onApply} onDismiss={onDismiss} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Outcome({ outcome, onApply, onDismiss }: { outcome: SuggestOutcome; onApply(): void; onDismiss(): void }) {
  const close = (
    <div className="pl-suggest-actions">
      <button type="button" className="pl-btn pl-btn-quiet sm" onClick={onDismiss}>Đóng</button>
    </div>
  )
  switch (outcome.kind) {
    case 'same':
      return <><p className="pl-suggest-msg">Kế hoạch đã đi theo thứ tự và lối nhanh nhất.</p>{close}</>
    case 'missing':
      return (
        <>
          <p className="pl-suggest-msg">Chưa có lộ trình nào lên tới {outcome.peaks.join(', ')} trong dữ liệu của WayTrek — chưa gợi ý được.</p>
          {close}
        </>
      )
    case 'needStart':
      return <><p className="pl-suggest-msg">Đặt điểm xuất phát lên đầu danh sách trước.</p>{close}</>
    case 'tooMany':
      return <><p className="pl-suggest-msg">Gợi ý xếp được tối đa {outcome.max} đỉnh một lần.</p>{close}</>
    case 'few':
      return <><p className="pl-suggest-msg">Cần từ hai đỉnh trở lên.</p>{close}</>
    case 'ok': {
      const camps = outcome.result.stops.filter((s) => s.zone).length
      const unsafe = outcome.result.days.filter((d) => d.warnings.some((w) => dayNote(w).level === 'danger')).length
      return (
        <>
          <p className="pl-suggest-title">{summary(outcome.after)}</p>
          <ol className="pl-suggest-list">
            {outcome.order.map((p) => (
              <li key={p.waypointId}>
                <b>{p.name}</b>
                <span className="pl-muted">{approach(p.up, p.down)}</span>
              </li>
            ))}
          </ol>
          <ul className="pl-suggest-notes">
            {unsafe > 0 && <li className="pl-note-danger">{unsafeNote(unsafe, outcome.doc.noCamp === true)}</li>}
            {camps > 0 && <li>{camps} đêm cắm trại ở chỗ chưa có lán — cần mang lều.</li>}
            {outcome.removed.length > 0 && <li>Bỏ khỏi kế hoạch: {outcome.removed.join(', ')}.</li>}
            <li className="pl-muted">{before(outcome.before)}</li>
          </ul>
          <div className="pl-suggest-actions">
            <button type="button" className="pl-btn pl-btn-primary sm" onClick={onApply}>Áp dụng</button>
            <button type="button" className="pl-btn pl-btn-quiet sm" onClick={onDismiss}>Bỏ qua</button>
          </div>
        </>
      )
    }
  }
}

function summary(t: SuggestTotals): string {
  return `${t.dayCount} ngày · ${distance(t.distanceM)} · ${t.knownPct}% trên lối đã biết`
}

/** "lên từ chân 1.063 m (Cung chính)", "từ Miêu Thạch Sơn theo lối nối hai đỉnh", kèm hướng xuống nếu khác. */
function approach(up: Approach, down: Approach): string {
  const foot = (a: Approach & { kind: 'trailhead' }) =>
    [a.eleM != null ? `chân ${a.eleM.toLocaleString('vi-VN')} m` : 'chân núi', a.routeName ? `(${a.routeName})` : null]
      .filter(Boolean)
      .join(' ')
  const parts = [up.kind === 'traverse' ? `đi tiếp từ ${up.peak}` : `lên từ ${foot(up)}`]
  if (down.kind === 'traverse') parts.push(`rồi sang ${down.peak}`)
  else if (up.kind === 'traverse' || up.routeName !== down.routeName || up.eleM !== down.eleM) {
    parts.push(`xuống ${foot(down)}`)
  }
  return ` — ${parts.join(', ')}`
}

/** Lịch tốt nhất mà vẫn có ngày nguy hiểm thì nói ra TRƯỚC khi người ta bấm Áp dụng. */
function unsafeNote(days: number, noCamp: boolean): string {
  const head = `${days} ngày vẫn chưa an toàn (đi bộ quá sức hoặc còn trên lối mòn khi trời tối) — xem cảnh báo của từng ngày.`
  return noCamp ? `${head} Bật "Có mang lều" thì có thể nghỉ giữa đường.` : head
}

function before(t: SuggestTotals): string {
  const head = `Bản hiện tại: ${t.dayCount} ngày, ${duration(t.elapsedMin)}, ${t.knownPct}% trên lối đã biết`
  // Đường thẳng qua núi thì số giờ đó là giả: nói ra, đừng để người ta tưởng gợi ý chậm hơn.
  return t.knownPct < 50 ? `${head} — phần lớn là đường thẳng qua núi, chưa đi được thật.` : `${head}.`
}
