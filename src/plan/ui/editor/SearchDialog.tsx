import { useEffect, useRef, useState } from 'react'
import { meters } from '../../core/format'
import { pickerList, resolveCombos, toggleCombo } from '../../core/search'
import type { PeakCombo, TrailPin } from '../../core/types'
import { ICheck, IClose, ISearch } from '../icons'

/**
 * Hộp chọn đỉnh, mở từ nút Tìm. Mở ra là thấy ngay combo gợi ý + TOÀN BỘ danh
 * sách cung; chọn được nhiều đỉnh, đỉnh đã chọn đứng đầu theo thứ tự chọn —
 * cũng là thứ tự thêm vào kế hoạch. Cung chưa có toạ độ đỉnh thì chỉ xem được
 * trên bản đồ.
 */
export function SearchDialog({
  open, onClose, trails, combos, onPick, onAddPeaks,
}: {
  open: boolean
  onClose(): void
  trails: TrailPin[]
  combos: PeakCombo[]
  onPick(t: TrailPin): void
  onAddPeaks(ts: TrailPin[]): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const { picked, rest } = pickerList(trails, q, selected)
  const comboRows = q.trim() ? [] : resolveCombos(combos, trails)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      setQ('')
      setSelected([])
      d.showModal()
      input.current?.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const add = () => {
    if (picked.length === 0) return
    onAddPeaks(picked)
    onClose()
  }
  const view = (t: TrailPin) => {
    onPick(t)
    onClose()
  }

  const row = (t: TrailPin, order: number | null) => (
    <li key={t.trailId} className={order != null ? 'is-picked' : ''}>
      {t.hasPeak ? (
        <button type="button" className="pl-hit" aria-pressed={order != null} onClick={() => toggle(t.trailId)}>
          <span className="pl-pick-box">{order != null ? order : null}</span>
          <span className="pl-hit-text">
            <span className="pl-hit-name">{t.name}</span>
            <span className="pl-muted">{[t.region, t.peakEleM ? meters(t.peakEleM) : null].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      ) : (
        <button type="button" className="pl-hit" onClick={() => view(t)}>
          <span className="pl-pick-box is-off" aria-hidden="true" />
          <span className="pl-hit-text">
            <span className="pl-hit-name">{t.name}</span>
            <span className="pl-muted">Chưa có toạ độ đỉnh — xem trên bản đồ</span>
          </span>
        </button>
      )}
    </li>
  )

  return (
    <dialog ref={dialog} className="pl-dialog pl-search-dialog" onClose={onClose} onCancel={onClose} aria-label="Chọn đỉnh">
      <div className="pl-search">
        <ISearch size={16} />
        <input
          ref={input}
          value={q}
          placeholder="Tìm đỉnh, cung…"
          aria-label="Tìm đỉnh, cung"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          }}
        />
        <button type="button" className="pl-icon-btn sm" onClick={onClose} aria-label="Đóng"><IClose size={16} /></button>
      </div>

      <div className="pl-picker">
        {comboRows.length > 0 && (
          <section aria-label="Combo gợi ý">
            <h3 className="pl-picker-head">Combo gợi ý</h3>
            <div className="pl-combos">
              {comboRows.map(({ combo, peaks }) => {
                const ids = peaks.map((p) => p.trailId)
                const on = ids.every((id) => selected.includes(id))
                return (
                  <button
                    key={combo.id}
                    type="button"
                    className={`pl-combo${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setSelected((s) => toggleCombo(s, ids))}
                  >
                    {on && <ICheck size={13} />}
                    <b>{combo.name}</b>
                    <span>{peaks.length} đỉnh</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
        {picked.length > 0 && (
          <section aria-label="Đã chọn">
            <h3 className="pl-picker-head">Đã chọn · theo thứ tự thêm</h3>
            <ul className="pl-search-hits">{picked.map((t, i) => row(t, i + 1))}</ul>
          </section>
        )}
        <section aria-label={q.trim() ? 'Kết quả' : 'Tất cả cung'}>
          <h3 className="pl-picker-head">{q.trim() ? `Kết quả · ${rest.length}` : `Tất cả cung · ${rest.length}`}</h3>
          {rest.length > 0
            ? <ul className="pl-search-hits">{rest.map((t) => row(t, null))}</ul>
            : <p className="pl-muted pl-picker-empty">Không có cung nào khớp.</p>}
        </section>
      </div>

      <div className="pl-picker-foot">
        <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setSelected([])} disabled={picked.length === 0}>
          Bỏ chọn
        </button>
        <button type="button" className="pl-btn pl-btn-primary" onClick={add} disabled={picked.length === 0}>
          {picked.length > 0 ? `Thêm ${picked.length} đỉnh vào kế hoạch` : 'Chọn đỉnh để thêm'}
        </button>
      </div>
    </dialog>
  )
}
