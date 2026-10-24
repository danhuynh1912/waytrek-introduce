import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { mergeRoutes } from '../../src/plan/core/route-merge.ts'
import type { RouteLine } from '../../src/plan/core/types.ts'

// Lối thẳng hướng bắc dài ~2,2 km quanh (21.5, 104.3), lệch ngang `offM` mét.
const M_LAT = 1 / 111_195
const M_LON = 1 / (111_195 * Math.cos((21.5 * Math.PI) / 180))
function line(id: string, offM: number, fromM = 0, toM = 2200, step = 50): RouteLine {
  const pts: [number, number][] = []
  for (let m = fromM; m <= toM; m += step) {
    pts.push([Math.round((104.3 + offM * M_LON) * 1e6), Math.round((21.5 + m * M_LAT) * 1e6)])
  }
  return { routeId: id, trailId: 't', trailName: 'Cung', routeName: null, segments: [pts] }
}
const len = (c: [number, number][]) => {
  let s = 0
  for (let i = 1; i < c.length; i++) s += Math.hypot((c[i][0] - c[i - 1][0]) / M_LON, (c[i][1] - c[i - 1][1]) / M_LAT)
  return s
}

Deno.test('năm lộ trình cùng một lối (lệch ≤ 20 m) chỉ còn một nét', () => {
  const out = mergeRoutes([line('a', 0), line('b', 8), line('c', -12), line('d', 20), line('e', 5)])
  assertEquals(out.length, 1)
  assertEquals(out[0].heat, 5)
  assert(len(out[0].coords) > 2100)
})

Deno.test('đại diện là lộ trình giữa hành lang, không phải lộ trình rìa', () => {
  const out = mergeRoutes([line('rim', 28), line('mid', 0), line('l', -14), line('r', 14)])
  assertEquals(out.length, 1)
  assert(out[0].routeId === 'mid' || out[0].routeId === 'l' || out[0].routeId === 'r')
})

Deno.test('hai lối thật sự khác nhau (cách 200 m) giữ cả hai', () => {
  const out = mergeRoutes([line('a', 0), line('b', 200)])
  assertEquals(out.length, 2)
  assertEquals(out.map((l) => l.heat), [1, 1])
})

Deno.test('lộ trình đi xa hơn chỉ góp phần nối dài, nét nối liền vào nét đã vẽ', () => {
  const out = mergeRoutes([line('short', 0, 0, 1000), line('short2', 6, 0, 1000), line('long', 10, 0, 2200)])
  assertEquals(out.length, 2)
  const ext = out.find((l) => l.heat === 1)!
  assertEquals(ext.routeId, 'long')
  assert(len(ext.coords) > 1100 && len(ext.coords) < 1300)
})

Deno.test('mẩu lệch GPS ngắn ở rìa không thành nét riêng', () => {
  const wobble = line('w', 0)
  // 60 m giữa tuyến lệch ra 45 m.
  wobble.segments[0] = wobble.segments[0].map(([x, y], i) => (i === 20 ? [x + Math.round(45 * M_LON * 1e6), y] : [x, y]))
  const out = mergeRoutes([line('a', 0), line('b', 4), wobble])
  assertEquals(out.length, 1)
})

Deno.test('rỗng → rỗng', () => assertEquals(mergeRoutes([]), []))

Deno.test('nhánh rẽ ở ngã ba nối hẳn vào nét chính, không hở ở mép vùng gộp', () => {
  // Nhánh: đi chung lối chính tới mét 1000 rồi rẽ hướng đông 800 m.
  const main = line('main', 0)
  const main2 = line('main2', 6)
  const branch: RouteLine = { ...line('branch', 0, 0, 1000), routeId: 'branch' }
  const seg = branch.segments[0]
  const [x0, y0] = seg[seg.length - 1]
  for (let m = 50; m <= 800; m += 50) seg.push([x0 + Math.round(m * M_LON * 1e6), y0])
  const out = mergeRoutes([main, main2, branch])
  const br = out.find((l) => l.routeId === 'branch')!
  // Đầu nhánh phía ngã ba phải nằm ngay trên nét chính (lon gốc 104.3).
  const ends = [br.coords[0], br.coords[br.coords.length - 1]]
  const gapM = Math.min(...ends.map(([lon]) => Math.abs(lon - 104.3) / M_LON))
  assert(gapM < 5, `nhánh hở ${gapM.toFixed(0)} m trước ngã ba`)
})
