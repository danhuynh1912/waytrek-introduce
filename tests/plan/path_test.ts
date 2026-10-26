import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { draftChanged, draftPoints, pathDetails, wayTypes } from '../../src/plan/core/path.ts'
import type { DrawPiece, PlanResult, ResultLeg } from '../../src/plan/core/types.ts'

const piece = (kind: DrawPiece['kind'], distanceM: number, extra: Partial<DrawPiece> = {}): DrawPiece => ({
  kind, line: '', distanceM, ascentM: 0, descentM: 0, moveMin: 0, ...extra,
})
const result = (...legs: DrawPiece[][]) =>
  ({ legs: legs.map((draw) => ({ draw }) as unknown as ResultLeg) }) as unknown as PlanResult

Deno.test('Loại đường: cộng theo loại qua mọi chặng, xe ôm tách khỏi ô tô, dài nhất trước', () => {
  const r = result(
    [piece('vehicle', 7000), piece('route', 1000)],
    [piece('route', 1000), piece('vehicle', 500, { moto: true }), piece('path', 500)],
  )
  assertEquals(wayTypes(r).map((t) => [t.kind, t.distanceM, t.pct]), [
    ['vehicle', 7000, 70], ['route', 2000, 20], ['moto', 500, 5], ['path', 500, 5],
  ])
})

Deno.test('Loại đường: kết quả cũ không có số đo thì không có dòng nào, không vỡ', () => {
  assertEquals(wayTypes(result([{ kind: 'route', line: 'x' }])), [])
  assertEquals(wayTypes(null), [])
})

Deno.test('Chi tiết: tốc độ đi bộ từ tổng của máy chủ; thấp nhất từ biểu đồ độ cao', () => {
  const r = {
    totals: { walkDistanceM: 6000, walkMin: 120, maxEleM: 2930 },
    profile: { stepM: 100, ele: [null, 1200, 900, 2930] },
  } as unknown as PlanResult
  assertEquals(pathDetails(r), { walkKmh: 3, highestM: 2930, lowestM: 900 })
  assertEquals(pathDetails(null), { walkKmh: null, highestM: null, lowestM: null })
})

Deno.test('danh sách "Các điểm" đang soạn: kéo, bỏ, và tự khớp khi kế hoạch đổi giữa chừng', () => {
  const ids = ['a', 'b', 'c', 'd']
  assertEquals(draftPoints(ids, null), ids)
  assertEquals(draftChanged(ids, draftPoints(ids, null)), false)
  const d = { order: ['c', 'a', 'b', 'd'], removed: ['b'] }
  assertEquals(draftPoints(ids, d), ['c', 'a', 'd'])
  assertEquals(draftChanged(ids, draftPoints(ids, d)), true)
  // Thêm điểm e trên bản đồ, d bị bỏ ở chỗ khác: e nối vào cuối, d thôi.
  assertEquals(draftPoints(['a', 'b', 'c', 'e'], d), ['c', 'a', 'e'])
  // Xếp lại đúng thứ tự cũ: không còn gì để áp dụng.
  assertEquals(draftChanged(ids, draftPoints(ids, { order: ids, removed: [] })), false)
})
