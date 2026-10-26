import { useState } from 'react'
import { clock, parseClock } from '@/shared/format'

/**
 * Ô giờ (HH:MM) chỉ báo giá trị lúc rời ô / bấm Enter — gõ dở không làm
 * tính lại kế hoạch. Rời ô rồi thì ô luôn bày `value` (giờ THẬT của kết quả),
 * không giữ chữ vừa gõ: máy chủ không nhận giờ đó thì ô phải nói ra, chứ đừng
 * ghi 04:00 trong khi ngày vẫn đi 11:30 (26/10).
 */
export function ClockInput({ value, onCommit, label, className }: {
  value: number
  onCommit(min: number): void
  label?: string
  className?: string
}) {
  /** Chữ đang gõ — chỉ có trong lúc ô có focus. */
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    setDraft(null)
    const m = parseClock(text)
    if (m != null && m !== value) onCommit(m)
  }
  return (
    <input
      type="time"
      className={className}
      aria-label={label}
      value={draft ?? clock(value)}
      onFocus={() => setDraft(clock(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
