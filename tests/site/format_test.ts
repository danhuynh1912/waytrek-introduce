import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { count } from '../../src/shared/format.ts'

Deno.test('số đếm có dấu chấm ngăn nghìn, làm tròn', () => {
  assertEquals(count(2561), '2.561')
  assertEquals(count(67), '67')
  assertEquals(count(1234567.6), '1.234.568')
})

import { makeNumberFormat } from '../../src/shared/format.ts'

Deno.test('số theo ngôn ngữ: dấu ngăn nghìn / thập phân đổi, chữ số luôn Latin', () => {
  const en = makeNumberFormat('en-US-u-nu-latn')
  assertEquals(en.count(2561), '2,561')
  assertEquals(en.distance(7200), '7.2 km')
  assertEquals(en.meters(3143), '3,143 m')
  assertEquals(en.score(5.06), '5.06')
  const vi = makeNumberFormat('vi-VN')
  assertEquals(vi.distance(7200), '7,2 km')
  assertEquals(vi.score(5.06), '5,06')
  // Tiếng Miến mặc định dùng chữ số Miến — bản vẽ dùng số Latin nên ép `-u-nu-latn`.
  assertEquals(makeNumberFormat('my-MM-u-nu-latn').count(1234), '1,234')
})
