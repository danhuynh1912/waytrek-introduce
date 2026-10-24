import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { newDoc } from '../../src/plan/core/doc.ts'
import { SaveQueue } from '../../src/plan/core/save-queue.ts'
import type { SaveEvent, SaveOutcome } from '../../src/plan/core/save-queue.ts'
import { nearestOnLines } from '../../src/plan/core/snap.ts'
import type { PlanDoc, PlanResult } from '../../src/plan/core/types.ts'

const result = { engine: 1 } as unknown as PlanResult
const doc = (title: string): PlanDoc => ({ ...newDoc('2026-12-21'), title })

/** Máy chủ giả: mỗi lượt gửi chờ tới khi test trả lời. */
function fakeServer() {
  const calls: { title: string; base: number; reply: (o: SaveOutcome) => void }[] = []
  const send = (d: PlanDoc, base: number) =>
    new Promise<SaveOutcome>((reply) => calls.push({ title: d.title, base, reply }))
  return { calls, send }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

Deno.test('một lượt bay; sửa trong lúc bay thì lượt sau mang bản mới nhất với version từ phản hồi', async () => {
  const srv = fakeServer()
  const events: SaveEvent['type'][] = []
  const q = new SaveQueue(srv.send, (e) => events.push(e.type), 0)
  q.submit(1, doc('v1'))
  q.submit(2, doc('v2'))
  q.submit(3, doc('v3'))
  assertEquals(srv.calls.map((c) => [c.title, c.base]), [['v1', 0]])
  srv.calls[0].reply({ kind: 'saved', version: 1, result })
  await tick()
  assertEquals(srv.calls.map((c) => [c.title, c.base]), [['v1', 0], ['v3', 1]])
  assertEquals(q.dirty, true)
  srv.calls[1].reply({ kind: 'saved', version: 2, result })
  await tick()
  assertEquals([q.version, q.dirty, srv.calls.length], [2, false, 2])
  assertEquals(events, ['saving', 'saved', 'saving', 'saved'])
})

Deno.test('bản cũ hơn bản đã nhận thì bỏ qua', async () => {
  const srv = fakeServer()
  const q = new SaveQueue(srv.send, () => {}, 4)
  q.submit(5, doc('mới'))
  q.submit(3, doc('cũ'))
  srv.calls[0].reply({ kind: 'saved', version: 5, result })
  await tick()
  assertEquals(srv.calls.length, 1)
})

Deno.test('xung đột chặn hàng; "Giữ bản này" ghi đè với version máy chủ', async () => {
  const srv = fakeServer()
  const seen: SaveEvent[] = []
  const q = new SaveQueue(srv.send, (e) => seen.push(e), 3)
  q.submit(1, doc('của tôi'))
  srv.calls[0].reply({ kind: 'conflict', version: 7, doc: doc('bản kia'), result: null })
  await tick()
  q.submit(2, doc('của tôi 2'))
  assertEquals(srv.calls.length, 1)
  q.keepMine(7)
  assertEquals(srv.calls.map((c) => [c.title, c.base]), [['của tôi', 3], ['của tôi 2', 7]])
  assertEquals(seen[1].type, 'conflict')
})

Deno.test('"Dùng bản kia": không gửi gì nữa cho tới lần sửa sau', async () => {
  const srv = fakeServer()
  const q = new SaveQueue(srv.send, () => {}, 3)
  q.submit(1, doc('của tôi'))
  srv.calls[0].reply({ kind: 'conflict', version: 7, doc: doc('bản kia'), result: null })
  await tick()
  q.takeServer(7, 1)
  await tick()
  assertEquals([srv.calls.length, q.dirty, q.version], [1, false, 7])
  q.submit(2, doc('sửa tiếp'))
  assertEquals(srv.calls[1].base, 7)
})

Deno.test('lỗi mạng dừng hàng, không mất bản đang sửa; thử lại thì gửi bản mới nhất', async () => {
  let n = 0
  const sent: string[] = []
  const q = new SaveQueue(async (d) => {
    sent.push(d.title)
    if (n++ === 0) throw new Error('Failed to fetch')
    return { kind: 'saved', version: 1, result }
  }, () => {}, 0)
  q.submit(1, doc('a'))
  await tick()
  q.submit(2, doc('b'))
  await tick()
  assertEquals([sent, q.dirty], [['a'], true])
  q.retry()
  await tick()
  assertEquals([sent, q.dirty], [['a', 'b'], false])
})

Deno.test('dính lộ trình trong 12 px, xa hơn thì không', () => {
  const lines = [[{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 30 }, { x: 100, y: 30 }]]
  assertEquals(nearestOnLines({ x: 50, y: 10 }, lines), { line: 0, edge: 0, t: 0.5, distPx: 10 })
  assertEquals(nearestOnLines({ x: 50, y: 18 }, lines)?.line, 1)
  assertEquals(nearestOnLines({ x: 50, y: 15.5 }, [lines[0]], 12), null)
})
