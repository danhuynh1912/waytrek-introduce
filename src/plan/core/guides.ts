// Hướng dẫn lần đầu (coach mark) của trình lên kế hoạch — MỘT bảng cho mọi
// hướng dẫn. Thêm hướng dẫn = thêm một dòng vào GUIDES + gắn
// `data-guide-anchor="<anchor>"` lên phần tử cần chỉ (nếu mốc đó chưa có), rồi
// gọi `fire(<sự kiện>)` ở chỗ hành động xảy ra. Không có logic hướng dẫn nào
// nằm rải trong màn hình.
//
// Thuần: không React, không DOM. Chỗ nhớ "đã xem" truyền vào qua SeenStore.

/** Hành động của người dùng có thể kích một hướng dẫn. */
export type GuideEvent = 'campOff'

/** Mốc trên giao diện mà hướng dẫn chỉ vào (giá trị của `data-guide-anchor`). */
export type GuideAnchor = 'settings'

export interface Guide {
  /** Khoá nhớ "đã xem". Đổi câu chữ đáng kể thì tăng hậu tố để hiện lại. */
  id: string
  on: GuideEvent
  anchor: GuideAnchor
  text: string
  /** Chờ chừng này rồi mới hiện — để người dùng kịp thấy kết quả hành động trước. */
  delayMs: number
}

export const GUIDES: readonly Guide[] = [
  {
    id: 'camp-off-settings.v1',
    on: 'campOff',
    anchor: 'settings',
    text: 'Muốn gợi ý lại chỗ cắm trại, bật "Có mang lều" trong Cài đặt.',
    delayMs: 2000,
  },
]

export interface SeenStore {
  has(id: string): boolean
  add(id: string): void
}

/** Hướng dẫn chưa xem đầu tiên cho sự kiện này, hoặc null. */
export function guideFor(event: GuideEvent, seen: SeenStore, guides: readonly Guide[] = GUIDES): Guide | null {
  return guides.find((g) => g.on === event && !seen.has(g.id)) ?? null
}

/** Danh sách id đã xem ⇄ chuỗi lưu trữ. Chuỗi hỏng coi như chưa xem gì. */
export function parseSeen(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const v: unknown = JSON.parse(raw)
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function serializeSeen(seen: Set<string>): string {
  return JSON.stringify([...seen].sort())
}
