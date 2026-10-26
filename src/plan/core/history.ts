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

/**
 * Thay bản hiện tại mà KHÔNG thêm bước hoàn tác — máy tự sửa doc theo kết quả vừa
 * tính (bỏ giờ xuất phát không còn đạt được). Hoàn tác bước người dùng vừa làm thì
 * về đúng bản trước nó, gồm cả thứ máy vừa bỏ.
 */
export function replacePresent<T>(h: History<T>, next: T): History<T> {
  return next === h.present ? h : { ...h, present: next }
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
