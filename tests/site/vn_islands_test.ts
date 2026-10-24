import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { ISLAND_MIN_ZOOM, VN_ISLANDS, vnIslandsLayers } from '../../src/shared/map/vn-islands.ts'

const ink = { label: '#111111', halo: '#ffffff' }
const ofKind = (kind: string) => VN_ISLANDS.features.filter((f) => f.properties.kind === kind)

Deno.test('Hoàng Sa, Trường Sa: đủ hai tên quần đảo và mười đảo như app', () => {
  assertEquals(ofKind('group').map((f) => f.properties.name), ['QUẦN ĐẢO HOÀNG SA', 'QUẦN ĐẢO TRƯỜNG SA'])
  const islands = ofKind('island')
  assertEquals(islands.length, 10)
  assertEquals(new Set(islands.map((f) => f.properties.name)).size, 10)
})

Deno.test('mỗi điểm nằm trong một trong hai quần đảo — chép nhầm thứ tự kinh/vĩ độ là rơi ra ngoài', () => {
  const inHoangSa = ([lng, lat]: [number, number]) => lng >= 110.5 && lng <= 113 && lat >= 15.5 && lat <= 17.5
  const inTruongSa = ([lng, lat]: [number, number]) => lng >= 111 && lng <= 117 && lat >= 6 && lat <= 12
  for (const f of VN_ISLANDS.features) {
    const c = f.geometry.coordinates
    assert(inHoangSa(c) || inTruongSa(c), `${f.properties.name} lệch khỏi hai quần đảo: ${c}`)
  }
})

Deno.test('luật zoom như app: chấm ở mọi zoom, tên đảo từ zoom 9, tên quần đảo luôn hiện và được đè', () => {
  const [dot, label, group] = vnIslandsLayers(ink)
  assertEquals([dot.id, label.id, group.id], ['vn-islands-dot', 'vn-islands-label', 'vn-islands-group-label'])
  assertEquals(ISLAND_MIN_ZOOM, 9)
  assertEquals(dot.minzoom, undefined)
  assertEquals(label.minzoom, ISLAND_MIN_ZOOM)
  assertEquals(group.minzoom, undefined)
  assertEquals((label.layout as Record<string, unknown>)['text-allow-overlap'], undefined)
  assertEquals((group.layout as Record<string, unknown>)['text-allow-overlap'], true)
  assertEquals(dot.filter, ['==', ['get', 'kind'], 'island'])
  assertEquals(group.filter, ['==', ['get', 'kind'], 'group'])
})

Deno.test('chữ theo theme của web, chấm giữ màu của app', () => {
  const [dot, label, group] = vnIslandsLayers(ink)
  assertEquals((label.paint as Record<string, unknown>)['text-color'], '#111111')
  assertEquals((group.paint as Record<string, unknown>)['text-halo-color'], '#ffffff')
  assertEquals((dot.paint as Record<string, unknown>)['circle-color'], '#22C55E')
  assertEquals((dot.paint as Record<string, unknown>)['circle-stroke-color'], '#B22222')
})
