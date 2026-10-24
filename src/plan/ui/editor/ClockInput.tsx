import { useEffect, useRef, useState } from 'react'
import { clock, parseClock } from '../../core/format'

/**
 * Ô giờ (HH:MM) chỉ báo giá trị lúc rời ô / bấm Enter — gõ dở không làm
 * tính lại kế hoạch. Giá trị ngoài đổi khi ô không có focus thì ô theo.
 */
export function ClockInput({ value, onCommit, label, className }: {
  value: number
  onCommit(min: number): void
  label?: string
  className?: string
}) {
  const [text, setText] = useState(clock(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(clock(value))
  }, [value])
  const commit = () => {
    const m = parseClock(text)
    if (m != null && m !== value) onCommit(m)
    else setText(clock(value))
  }
  return (
    <input
      type="time"
      className={className}
      aria-label={label}
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
