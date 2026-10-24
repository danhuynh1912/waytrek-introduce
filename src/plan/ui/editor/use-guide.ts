import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { guideFor, parseSeen, serializeSeen } from '../../core/guides'
import type { Guide, GuideEvent, SeenStore } from '../../core/guides'

const SEEN_KEY = 'wt-plan:guides-seen'

/**
 * "Đã xem" lưu ở localStorage của trình duyệt — tiện ích theo từng máy, không
 * phải dữ liệu cần đồng bộ. Không đọc/ghi được (riêng tư, chặn) thì nhớ trong
 * phiên: hướng dẫn vẫn chỉ hiện một lần mỗi lần mở trang.
 */
function browserSeenStore(): SeenStore {
  let seen: Set<string>
  try {
    seen = parseSeen(localStorage.getItem(SEEN_KEY))
  } catch {
    seen = new Set()
  }
  return {
    has: (id) => seen.has(id),
    add: (id) => {
      seen.add(id)
      try {
        localStorage.setItem(SEEN_KEY, serializeSeen(seen))
      } catch {
        // Không ghi được: vẫn nhớ trong phiên.
      }
    },
  }
}

/** Hướng dẫn đang hiện + `fire(sự kiện)` để kích + `dismiss()` để đóng. */
export function useGuide() {
  const store = useMemo(() => browserSeenStore(), [])
  const [current, setCurrent] = useState<Guide | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const fire = useCallback((event: GuideEvent) => {
    const g = guideFor(event, store)
    if (!g) return
    // Ghi "đã xem" ngay khi lên lịch: bấm lần hai trong lúc chờ không xếp thêm.
    store.add(g.id)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCurrent(g), g.delayMs)
  }, [store])

  const dismiss = useCallback(() => setCurrent(null), [])

  return useMemo(() => ({ current, fire, dismiss }), [current, fire, dismiss])
}
