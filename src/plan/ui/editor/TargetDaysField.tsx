import { useState } from 'react'
import { MAX_TARGET_DAYS } from '../../core/doc'
import { TARGET_PRESETS, targetDaysLabel } from '../../core/target'

const AUTO = 'auto'
const CUSTOM = 'custom'
/** Ô số mở ở mức này khi chưa đặt số ngày nào. */
const CUSTOM_START = 4

const isPreset = (days: number) => (TARGET_PRESETS as readonly number[]).includes(days)

/**
 * Ô "Thời gian leo" (spec/48): máy tự tính, vài mức hay dùng, hoặc "Số ngày
 * khác…" mở ô số 1–60 — ghi khi rời ô / Enter, như ô số trong Cài đặt. Cùng bộ
 * lựa chọn với sheet của app. `null` = máy tự tính.
 */
export function TargetDaysField({ value, onChange }: { value: number | null; onChange(days: number | null): void }) {
  // Người dùng vừa mở "Số ngày khác…" (kể cả khi số đang chọn trùng một mức có sẵn).
  const [opened, setOpened] = useState(false)
  // null = không gõ dở: hiện giá trị thật.
  const [text, setText] = useState<string | null>(null)
  const custom = opened || (value != null && !isPreset(value))
  const pick = (v: string) => {
    if (v === CUSTOM) {
      setOpened(true)
      if (value == null) onChange(CUSTOM_START)
      return
    }
    setOpened(false)
    onChange(v === AUTO ? null : Number(v))
  }
  const commit = () => {
    const n = Number(text)
    if (text != null && text.trim() !== '' && Number.isFinite(n)) {
      const days = Math.min(MAX_TARGET_DAYS, Math.max(1, Math.round(n)))
      if (days !== value) onChange(days)
    }
    setText(null)
  }
  return (
    <div className="pl-target">
      <label>
        <span>Thời gian leo</span>
        <select value={custom ? CUSTOM : value == null ? AUTO : String(value)} onChange={(e) => pick(e.target.value)}>
          <option value={AUTO}>{targetDaysLabel(null)}</option>
          {TARGET_PRESETS.map((d) => (
            <option key={d} value={d}>{targetDaysLabel(d)}</option>
          ))}
          <option value={CUSTOM}>Số ngày khác…</option>
        </select>
      </label>
      {custom && (
        <label className="pl-num">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_TARGET_DAYS}
            aria-label={`Số ngày leo (1–${MAX_TARGET_DAYS})`}
            value={text ?? String(value ?? CUSTOM_START)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          ngày
        </label>
      )}
    </div>
  )
}
