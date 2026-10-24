import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { GUIDES, guideFor, parseSeen, serializeSeen } from '../../src/plan/core/guides.ts'
import type { SeenStore } from '../../src/plan/core/guides.ts'

const store = (ids: string[] = []): SeenStore => {
  const s = new Set(ids)
  return { has: (id) => s.has(id), add: (id) => void s.add(id) }
}

Deno.test('lần đầu tắt cắm trại → hướng dẫn chỉ vào Cài đặt; đã xem thì thôi', () => {
  const g = guideFor('campOff', store())
  assertEquals(g?.anchor, 'settings')
  assertEquals(guideFor('campOff', store([g!.id])), null)
})

Deno.test('mỗi hướng dẫn một id riêng (khoá nhớ không đè nhau)', () => {
  assertEquals(new Set(GUIDES.map((g) => g.id)).size, GUIDES.length)
})

Deno.test('chuỗi "đã xem" hỏng coi như chưa xem; ghi rồi đọc lại khớp', () => {
  assertEquals(parseSeen('{rác').size, 0)
  assertEquals(parseSeen('[1,"a"]'), new Set(['a']))
  assertEquals(parseSeen(serializeSeen(new Set(['b', 'a']))), new Set(['a', 'b']))
})
