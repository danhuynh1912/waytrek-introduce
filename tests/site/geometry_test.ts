import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { bboxOf, profileOf, scaleProfile, segmentsOf, splitByTravel } from '../../src/site/core/geometry.ts'

const line = (n: number, lng0: number, ele0: number) =>
  Array.from({ length: n }, (_, i) => [lng0 + i * 0.001, 21, ele0 + i * 10])

Deno.test('LineString và MultiLineString đều ra các đoạn; kiểu lạ ra rỗng, không ném', () => {
  assertEquals(segmentsOf({ type: 'LineString', coordinates: line(3, 104, 1000) }).length, 1)
  assertEquals(segmentsOf({ type: 'MultiLineString', coordinates: [line(3, 104, 1000), line(4, 104.1, 1500)] }).length, 2)
  assertEquals(segmentsOf({ type: 'Feature', geometry: { type: 'LineString', coordinates: line(2, 104, 0) } }).length, 1)
  assertEquals(segmentsOf({ type: 'Point', coordinates: [1, 2] }), [])
  assertEquals(segmentsOf(null), [])
  // coordinates[0] của MultiLineString là cả một ĐOẠN, không phải một toạ độ.
  assertEquals(bboxOf(segmentsOf({ type: 'MultiLineString', coordinates: [line(2, 104, 0), line(2, 105, 0)] })), [104, 21, 105.001, 21])
})

Deno.test('biểu đồ độ cao giữ ranh giới đoạn, khe không cộng vào quãng đường', () => {
  const a = line(11, 104, 1000)
  const b = line(11, 104.5, 1500) // cách đoạn đầu ~50 km: khe mất tín hiệu
  const p = profileOf(segmentsOf({ type: 'MultiLineString', coordinates: [a, b] }))!
  assertEquals(p.segments.length, 2)
  // Hai đoạn mỗi đoạn ~1 km → tổng ~2 km, KHÔNG phải ~52 km.
  assert(p.lengthM > 1900 && p.lengthM < 2200, `lengthM ${p.lengthM}`)
  assertEquals([p.minEle, p.maxEle], [1000, 1600])
  // Đoạn sau nối tiếp mốc đoạn trước: không có điểm nào có d lùi lại.
  assert(p.segments[1][0].d >= p.segments[0][p.segments[0].length - 1].d)
})

Deno.test('tuyến không có độ cao hoặc phẳng tuyệt đối thì không có biểu đồ', () => {
  assertEquals(profileOf(segmentsOf({ type: 'LineString', coordinates: [[104, 21], [104.01, 21]] })), null)
  assertEquals(profileOf(segmentsOf({ type: 'LineString', coordinates: [[104, 21, 5], [104.01, 21, 5]] })), null)
})

Deno.test('ngân sách điểm chia theo độ dài đoạn', () => {
  const long = line(2000, 104, 0)
  const short = line(20, 105, 0)
  const p = profileOf(segmentsOf({ type: 'MultiLineString', coordinates: [long, short] }), 100)!
  assert(p.segments[0].length > p.segments[1].length * 10, `${p.segments[0].length} vs ${p.segments[1].length}`)
})

Deno.test('chặng xe: cắt đúng mốc-mét, nét giữa tô xe, hai đầu đi bộ', () => {
  // ~1,1 km theo kinh tuyến, 11 điểm cách ~111 m.
  const seg = Array.from({ length: 11 }, (_, i) => [104, 21 + i * 0.001, 1000] as [number, number, number])
  const lines = splitByTravel([seg], [{ mode: 'motorbike', fromM: 0, toM: 400 }])
  assertEquals(lines.map((l) => l.vehicle), [true, false])
  // Điểm cắt ở đúng 400 m: nằm giữa điểm 3 (333 m) và điểm 4 (445 m).
  const cut = lines[0].coords[lines[0].coords.length - 1]
  assert(cut[1] > 21.0035 && cut[1] < 21.0037, `cut ${cut[1]}`)
  assertEquals(lines[1].coords[0], cut)
})

Deno.test('chặng xe đi qua chỗ tạm dừng: khe không cộng mốc-mét, không nét nào nối hai đoạn', () => {
  const a = Array.from({ length: 6 }, (_, i) => [104, 21 + i * 0.001] as [number, number])
  const b = Array.from({ length: 6 }, (_, i) => [104.5, 21 + i * 0.001] as [number, number]) // cách ~52 km
  // Đoạn a dài ~556 m; chặng xe 300 → 800 m phủ cuối đoạn a và đầu đoạn b.
  const lines = splitByTravel([a, b], [{ mode: 'car', fromM: 300, toM: 800 }])
  assertEquals(lines.map((l) => l.vehicle), [false, true, true, false])
  for (const l of lines) {
    const lngs = new Set(l.coords.map((c) => c[0]))
    assertEquals(lngs.size, 1) // mỗi nét nằm gọn trong MỘT đoạn
  }
})

Deno.test('không có chặng xe thì giữ nguyên các đoạn, tất cả đi bộ', () => {
  const a = [[104, 21], [104, 21.01]] as [number, number][]
  assertEquals(splitByTravel([a], []), [{ coords: a, vehicle: false }])
  assertEquals(splitByTravel([a], [{ mode: 'car', fromM: 5, toM: 5 }]).map((l) => l.vehicle), [false])
})

Deno.test('trục quãng đường khớp số công bố, hệ số kẹp 0,7–1,3 như engine', () => {
  const p = profileOf(segmentsOf({ type: 'LineString', coordinates: line(11, 104, 1000) }))!
  const near = scaleProfile(p, p.lengthM * 0.8)
  assert(Math.abs(near.lengthM - p.lengthM * 0.8) < 1e-6)
  assert(Math.abs(near.segments[0][near.segments[0].length - 1].d - near.lengthM) < 1e-6)
  // Số công bố lệch quá xa (dữ liệu hỏng) → kẹp, không bóp méo biểu đồ.
  assert(Math.abs(scaleProfile(p, p.lengthM * 0.2).lengthM - p.lengthM * 0.7) < 1e-6)
  assertEquals(scaleProfile(p, null), p)
})
