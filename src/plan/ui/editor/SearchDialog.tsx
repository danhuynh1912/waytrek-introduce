import { useEffect, useRef, useState } from 'react'
import { meters } from '@/shared/format'
import { freshPlaces, GEOCODE_MIN_CHARS, matchRecentPlaces } from '../../core/places'
import { pickerList, resolveCombos, toggleCombo } from '../../core/search'
import type { PeakCombo, Place, TrailPin } from '../../core/types'
import { geocodePlaces } from '../../data/api'
import { loadRecentPlaces, saveRecentPlace } from '../../data/recent-places'
import { ICheck, IClose, ISearch } from '../icons'

export type SearchPick = { kind: 'peak'; trail: TrailPin } | { kind: 'place'; place: Place }

/** Chờ người dùng ngừng gõ rồi mới hỏi máy chủ — ORS có trần lượt tìm theo ngày. */
const GEOCODE_DEBOUNCE_MS = 450

const placeKey = (id: string) => `place:${id}`

type Remote = { text: string; state: 'loading' | 'error' } | { text: string; state: 'done'; places: Place[] }

/**
 * Hộp chọn đỉnh / địa điểm, mở từ nút Tìm. Mở ra là thấy ngay combo gợi ý +
 * TOÀN BỘ danh sách cung; gõ chữ thì thêm "Địa điểm" (OpenRouteService) và
 * những chỗ đã chọn trước đây khớp chữ đó. Chọn được nhiều mục, mục đã chọn
 * đứng đầu theo thứ tự chọn — cũng là thứ tự thêm vào kế hoạch.
 */
export function SearchDialog({
  open, onClose, trails, combos, onPick, onAdd, focus,
}: {
  open: boolean
  onClose(): void
  trails: TrailPin[]
  combos: PeakCombo[]
  onPick(t: TrailPin): void
  onAdd(items: SearchPick[]): void
  /** Ưu tiên địa điểm gần chỗ này (điểm cuối của kế hoạch). */
  focus: { lat: number; lng: number } | null
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  // Khoá theo thứ tự chọn: trailId của đỉnh, "place:<id>" của địa điểm.
  const [selected, setSelected] = useState<string[]>([])
  const [chosenPlaces, setChosenPlaces] = useState<ReadonlyMap<string, Place>>(new Map())
  const [recent, setRecent] = useState<Place[]>([])
  const [remote, setRemote] = useState<Remote | null>(null)
  // Cùng chữ trong một lần mở trang thì không hỏi lại máy chủ.
  const memo = useRef(new Map<string, Place[]>())

  const text = q.trim()
  const { picked: pickedPeaks, rest } = pickerList(trails, q, selected)
  const comboRows = text ? [] : resolveCombos(combos, trails)
  const peakById = new Map(pickedPeaks.map((t) => [t.trailId, t]))
  const picked: SearchPick[] = selected.flatMap((k): SearchPick[] => {
    const t = peakById.get(k)
    if (t) return [{ kind: 'peak', trail: t }]
    const p = chosenPlaces.get(k)
    return p ? [{ kind: 'place', place: p }] : []
  })
  const recentRows = matchRecentPlaces(recent, q).filter((p) => !selected.includes(placeKey(p.id)))
  const remoteRows = remote?.state === 'done' && remote.text === text
    ? freshPlaces(remote.places, recentRows).filter((p) => !selected.includes(placeKey(p.id)))
    : []

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      setQ('')
      setSelected([])
      setChosenPlaces(new Map())
      setRemote(null)
      setRecent(loadRecentPlaces())
      d.showModal()
      input.current?.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    if (!open || text.length < GEOCODE_MIN_CHARS) return
    const hit = memo.current.get(text)
    if (hit) {
      setRemote({ text, state: 'done', places: hit })
      return
    }
    const ctl = new AbortController()
    const timer = setTimeout(() => {
      setRemote({ text, state: 'loading' })
      geocodePlaces(text, focus, ctl.signal)
        .then((places) => {
          memo.current.set(text, places)
          setRemote({ text, state: 'done', places })
        })
        .catch((e) => {
          if (ctl.signal.aborted) return
          console.warn('plan: tìm địa điểm lỗi —', e)
          setRemote({ text, state: 'error' })
        })
    }, GEOCODE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctl.abort()
    }
    // focus chỉ là gợi ý thứ tự — đổi focus không đáng một lượt tìm mới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, text])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const togglePlace = (p: Place) => {
    const k = placeKey(p.id)
    if (!selected.includes(k)) {
      // Chọn là nhớ ngay: lần sau gõ vài chữ là gợi ý lại, không tốn lượt tìm.
      setRecent(saveRecentPlace(p))
      setChosenPlaces((m) => new Map(m).set(k, p))
    }
    toggle(k)
  }
  const add = () => {
    if (picked.length === 0) return
    onAdd(picked)
    onClose()
  }
  const view = (t: TrailPin) => {
    onPick(t)
    onClose()
  }

  const peakRow = (t: TrailPin, order: number | null) => (
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
  const placeRow = (p: Place, order: number | null) => (
    <li key={p.id} className={order != null ? 'is-picked' : ''}>
      <button type="button" className="pl-hit" aria-pressed={order != null} onClick={() => togglePlace(p)}>
        <span className="pl-pick-box">{order != null ? order : null}</span>
        <span className="pl-hit-text">
          <span className="pl-hit-name">{p.name}</span>
          <span className="pl-muted">{p.label}</span>
        </span>
      </button>
    </li>
  )

  const placesBusy = text.length >= GEOCODE_MIN_CHARS && (remote?.text !== text || remote.state === 'loading')

  return (
    <dialog ref={dialog} className="pl-dialog pl-search-dialog" onClose={onClose} onCancel={onClose} aria-label="Chọn đỉnh hoặc địa điểm">
      <div className="pl-search-top">
        <div className="pl-search">
          <ISearch size={16} />
          <input
            ref={input}
            value={q}
            placeholder="Tìm đỉnh, cung, địa chỉ…"
            aria-label="Tìm đỉnh, cung, địa chỉ"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
            }}
          />
          {q && (
            <button
              type="button"
              className="pl-icon-btn sm"
              onClick={() => {
                setQ('')
                input.current?.focus()
              }}
              aria-label="Xoá chữ đang tìm"
            >
              <IClose size={16} />
            </button>
          )}
        </div>
        <button type="button" className="pl-icon-btn" onClick={onClose} aria-label="Đóng hộp tìm"><IClose size={20} /></button>
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
            <ul className="pl-search-hits">
              {picked.map((p, i) => (p.kind === 'peak' ? peakRow(p.trail, i + 1) : placeRow(p.place, i + 1)))}
            </ul>
          </section>
        )}
        {recentRows.length > 0 && (
          <section aria-label="Địa điểm đã chọn trước đây">
            <h3 className="pl-picker-head">Đã chọn trước đây</h3>
            <ul className="pl-search-hits">{recentRows.map((p) => placeRow(p, null))}</ul>
          </section>
        )}
        {text.length >= GEOCODE_MIN_CHARS && (
          <section aria-label="Địa điểm">
            <h3 className="pl-picker-head">Địa điểm</h3>
            {remoteRows.length > 0 ? (
              <ul className="pl-search-hits">{remoteRows.map((p) => placeRow(p, null))}</ul>
            ) : (
              <p className="pl-muted pl-picker-empty">
                {placesBusy
                  ? 'Đang tìm địa điểm…'
                  : remote?.state === 'error'
                    ? 'Không tìm được địa điểm lúc này — thử lại sau.'
                    : 'Không có địa điểm nào khớp.'}
              </p>
            )}
          </section>
        )}
        <section aria-label={text ? 'Đỉnh, cung' : 'Tất cả cung'}>
          <h3 className="pl-picker-head">{text ? `Đỉnh, cung · ${rest.length}` : `Tất cả cung · ${rest.length}`}</h3>
          {rest.length > 0
            ? <ul className="pl-search-hits">{rest.map((t) => peakRow(t, null))}</ul>
            : <p className="pl-muted pl-picker-empty">Không có cung nào khớp.</p>}
        </section>
      </div>

      <div className="pl-picker-foot">
        <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setSelected([])} disabled={picked.length === 0}>
          Bỏ chọn
        </button>
        <button type="button" className="pl-btn pl-btn-primary" onClick={add} disabled={picked.length === 0}>
          {picked.length > 0 ? `Thêm ${picked.length} điểm vào kế hoạch` : 'Chọn đỉnh hoặc địa điểm để thêm'}
        </button>
      </div>
    </dialog>
  )
}
