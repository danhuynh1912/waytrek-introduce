import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { freshPlaces, matchRecentPlaces, parseRecentPlaces, RECENT_PLACES_MAX, rememberPlace } from '../../src/plan/core/places.ts'
import type { Place } from '../../src/plan/core/types.ts'

const pl = (id: string, name: string, label = `${name}, Hà Nội, Việt Nam`): Place => ({ id, name, label, lat: 21, lon: 105.8 })

Deno.test('địa điểm đã chọn: chọn lại thì lên đầu, không trùng, có trần', () => {
  let list = rememberPlace([], pl('a', 'A'))
  list = rememberPlace(list, pl('b', 'B'))
  list = rememberPlace(list, pl('a', 'A'))
  assertEquals(list.map((p) => p.id), ['a', 'b'])
  for (let i = 0; i < 40; i++) list = rememberPlace(list, pl(`x${i}`, `X${i}`))
  assertEquals(list.length, RECENT_PLACES_MAX)
})

Deno.test('địa điểm đã chọn: gõ không dấu vẫn gợi ý, khớp cả nhãn; ô trống thì vài chỗ gần nhất', () => {
  const list = [pl('a', '165 Cầu Giấy'), pl('b', 'Bến xe Mỹ Đình', 'Bến xe Mỹ Đình, Nam Từ Liêm, Hà Nội')]
  assertEquals(matchRecentPlaces(list, 'cau giay').map((p) => p.id), ['a'])
  assertEquals(matchRecentPlaces(list, 'tu liem').map((p) => p.id), ['b'])
  assertEquals(matchRecentPlaces(list, '').map((p) => p.id), ['a', 'b'])
  assertEquals(freshPlaces([pl('a', 'A'), pl('c', 'C')], [pl('a', 'A')]).map((p) => p.id), ['c'])
})

Deno.test('địa điểm đã chọn: dữ liệu trên máy hỏng thì bỏ qua, không ném', () => {
  assertEquals(parseRecentPlaces(null), [])
  assertEquals(parseRecentPlaces('{không phải json'), [])
  assertEquals(parseRecentPlaces(JSON.stringify([pl('a', 'A'), { id: 1 }, null])).map((p) => p.id), ['a'])
})
