// Hoàn tác / làm lại theo bản chụp — doc là bất biến nên mỗi bước chỉ là một
// tham chiếu, không chép sâu.

export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

const LIMIT = 60

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h
  const past = [...h.past, h.present]
  return { past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past, present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  const past = h.past.slice(0, -1)
  return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const [next, ...future] = h.future
  return { past: [...h.past, h.present], present: next, future }
}
