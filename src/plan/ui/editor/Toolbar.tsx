import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PACE_DEFAULT, PACE_MAX, PACE_MIN, PACE_SLOW_GROUP } from '../../core/doc'
import { pace as fmtPace } from '../../core/format'
import type { PlanDoc } from '../../core/types'
import { ICheck, ILayers, IRedo, ISliders, IUndo } from '../icons'
import type { LayerKey } from '../map/plan-map'
import type { SaveState } from './use-plan-editor'

interface Props {
  doc: PlanDoc
  canUndo: boolean
  canRedo: boolean
  onUndo(): void
  onRedo(): void
  layers: Record<LayerKey, boolean>
  onLayer(k: LayerKey, on: boolean): void
  onSettings(p: { pace?: number; restMinPerHour?: number; sunsetMarginMin?: number; autoShift?: boolean; camp?: boolean }): void
  save: SaveState
  saved: boolean
  canSave: boolean
  onSave(): void
  settingsOpen: boolean
  onSettingsOpen(open: boolean): void
}

const LAYER_LABELS: [LayerKey, string][] = [
  ['routes', 'Lộ trình các cung'],
  ['peaks', 'Đỉnh'],
  ['pois', 'Lán, nguồn nước, điểm có sẵn'],
  ['terrain', 'Bóng địa hình'],
]

export function Toolbar(p: Props) {
  return (
    <div className="pl-toolbar">
      <div className="pl-tool-group">
        <button type="button" className="pl-tool" onClick={p.onUndo} disabled={!p.canUndo} aria-label="Hoàn tác" title="Hoàn tác (Ctrl/⌘ Z)">
          <IUndo />
        </button>
        <button type="button" className="pl-tool" onClick={p.onRedo} disabled={!p.canRedo} aria-label="Làm lại" title="Làm lại (Ctrl/⌘ ⇧ Z)">
          <IRedo />
        </button>
        <span className="pl-tool-sep" />
        <Dropdown label="Nội dung bản đồ" icon={<ILayers />}>
          {LAYER_LABELS.map(([k, label]) => (
            <label key={k} className="pl-check">
              <input type="checkbox" checked={p.layers[k]} onChange={(e) => p.onLayer(k, e.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </Dropdown>
        <Dropdown label="Cài đặt" icon={<ISliders />} open={p.settingsOpen} onOpen={p.onSettingsOpen}>
          <Settings doc={p.doc} onChange={p.onSettings} />
        </Dropdown>
      </div>
      <SaveButton {...p} />
    </div>
  )
}

function SaveButton({ save, saved, canSave, onSave }: Props) {
  if (!saved) {
    return (
      <button type="button" className="pl-btn pl-btn-primary pl-save" onClick={onSave} disabled={!canSave}>
        Lưu
      </button>
    )
  }
  const label: Record<SaveState['kind'], ReactNode> = {
    draft: 'Lưu',
    pending: 'Đang chờ lưu…',
    saving: 'Đang lưu…',
    saved: <><ICheck size={16} /> Đã lưu</>,
    error: 'Lưu lại',
    conflict: 'Có xung đột',
    deleted: 'Đã bị xoá',
    auth: 'Đăng nhập để lưu',
  }
  const actionable = save.kind === 'error' || save.kind === 'auth'
  return (
    <button
      type="button"
      className={`pl-btn pl-save ${actionable ? 'pl-btn-primary' : 'pl-btn-quiet'} is-${save.kind}`}
      onClick={actionable ? onSave : undefined}
      aria-live="polite"
      disabled={!actionable}
    >
      {label[save.kind]}
    </button>
  )
}

function Dropdown({
  label, icon, children, open: openProp, onOpen,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
  open?: boolean
  onOpen?: (open: boolean) => void
}) {
  const [own, setOwn] = useState(false)
  const open = openProp ?? own
  const setOpen = onOpen ?? setOwn
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open, setOpen])
  return (
    <div className="pl-dd" ref={box}>
      <button type="button" className={`pl-tool wide${open ? ' is-on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {icon}
        <span>{label}</span>
      </button>
      <div className={`pl-dd-panel${open ? ' is-open' : ''}`} role="dialog" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

function Settings({ doc, onChange }: { doc: PlanDoc; onChange: Props['onSettings'] }) {
  // Đang kéo thanh trượt thì hiện số tạm; nhả tay mới ghi (một bước hoàn tác).
  const [dragging, setDragging] = useState<number | null>(null)
  const pace = dragging ?? doc.pace
  const commitPace = () => {
    if (dragging != null && dragging !== doc.pace) onChange({ pace: dragging })
    setDragging(null)
  }
  return (
    <div className="pl-settings">
      <div className="pl-field">
        <div className="pl-field-head">
          <span>Tốc độ đi</span>
          <b>{fmtPace(pace)}</b>
        </div>
        <input
          type="range"
          min={PACE_MIN}
          max={PACE_MAX}
          step={0.05}
          value={pace}
          aria-label="Hệ số tốc độ đi"
          onChange={(e) => setDragging(Number(e.target.value))}
          onPointerUp={commitPace}
          onKeyUp={commitPace}
          onBlur={commitPace}
        />
        <div className="pl-chips">
          <button type="button" className={doc.pace === PACE_SLOW_GROUP ? 'is-on' : ''} onClick={() => onChange({ pace: PACE_SLOW_GROUP })}>
            Đoàn đi chậm {fmtPace(PACE_SLOW_GROUP)}
          </button>
          <button type="button" className={doc.pace === PACE_DEFAULT ? 'is-on' : ''} onClick={() => onChange({ pace: PACE_DEFAULT })}>
            Mặc định {fmtPace(PACE_DEFAULT)}
          </button>
          <button type="button" className={doc.pace === 1 ? 'is-on' : ''} onClick={() => onChange({ pace: 1 })}>
            Nhanh {fmtPace(1)}
          </button>
        </div>
        <p className="pl-muted">Nhân vào tốc độ đi bộ theo độ dốc (công thức Tobler). 0,75 hợp với người đeo balo trên đường núi.</p>
      </div>
      <NumberField
        label="Nghỉ ngắn mỗi giờ đi"
        unit="phút"
        min={0}
        max={30}
        value={doc.restMinPerHour}
        onCommit={(v) => onChange({ restMinPerHour: v })}
      />
      <NumberField
        label="Tới nơi trước hoàng hôn ít nhất"
        unit="phút"
        min={30}
        max={120}
        value={doc.sunsetMarginMin}
        hint="Trong rừng trời tối sớm hơn ngoài trống."
        onCommit={(v) => onChange({ sunsetMarginMin: v })}
      />
      <label className="pl-check">
        <input type="checkbox" checked={doc.autoShift} onChange={(e) => onChange({ autoShift: e.target.checked })} />
        <span>Tự dời giờ đi sớm hơn khi cần (sớm nhất 04:30)</span>
      </label>
      <label className="pl-check">
        <input type="checkbox" checked={!doc.noCamp} onChange={(e) => onChange({ camp: e.target.checked })} />
        <span>Có mang lều — chỗ không có lán thì gợi ý vùng nên nghỉ để cắm trại</span>
      </label>
    </div>
  )
}

function NumberField({
  label, unit, min, max, value, hint, onCommit,
}: {
  label: string
  unit: string
  min: number
  max: number
  value: number
  hint?: string
  onCommit(v: number): void
}) {
  // null = không gõ dở: hiện giá trị thật.
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    const n = Number(text)
    if (text != null && text.trim() !== '' && Number.isFinite(n) && Math.round(n) !== value) {
      onCommit(Math.min(max, Math.max(min, Math.round(n))))
    }
    setText(null)
  }
  return (
    <div className="pl-field">
      <label className="pl-field-head">
        <span>{label}</span>
        <span className="pl-num">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={text ?? String(value)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          {unit}
        </span>
      </label>
      {hint && <p className="pl-muted">{hint}</p>}
    </div>
  )
}
