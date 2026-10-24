import { assert, assertEquals, assertNotStrictEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { darkPaintFor, RELIEF_HILLSHADE, RELIEF_SOURCE, RELIEF_TINT, reliefStyle } from '../../src/plan/core/relief-style.ts'

// Mẩu style Liberty thu gọn — đúng tên lớp, đúng thứ tự như bản tự host.
const base = () => ({
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
    { id: 'park', type: 'fill', paint: { 'fill-color': '#d8e8c8' } },
    { id: 'landcover_wood', type: 'fill', paint: { 'fill-color': '#e0e8c0' } },
    { id: 'landuse_pitch', type: 'fill', paint: { 'fill-pattern': 'pitch' } },
    { id: 'waterway_river', type: 'line', paint: { 'line-color': '#a0c8f0' } },
    { id: 'water', type: 'fill', paint: { 'fill-color': '#a0c8f0' } },
    { id: 'road_motorway', type: 'line', paint: { 'line-color': '#fc8' } },
    { id: 'road_path_pedestrian', type: 'line', paint: { 'line-color': '#fff' } },
    { id: 'water_name', type: 'symbol', paint: { 'text-color': '#495e91' } },
    { id: 'label_city', type: 'symbol', paint: { 'text-color': '#333' } },
  ],
})
const ids = (s: { layers: { id?: string }[] }) => s.layers.map((l) => l.id)
const layer = (s: { layers: { id?: string; paint?: Record<string, unknown> }[] }, id: string) => s.layers.find((l) => l.id === id)!

Deno.test('bóng sườn nằm ngay trước lớp nước đầu tiên, nền đất ngay sau nền', () => {
  const s = reliefStyle(base(), { demTiles: 'https://dem/{z}/{x}/{y}.png', dark: false })
  assertEquals(ids(s), [
    'background', RELIEF_TINT, 'park', 'landcover_wood', 'landuse_pitch', RELIEF_HILLSHADE,
    'waterway_river', 'water', 'road_motorway', 'road_path_pedestrian', 'water_name', 'label_city',
  ])
  const src = (s.sources as Record<string, Record<string, unknown>>)[RELIEF_SOURCE]
  assertEquals([src.encoding, src.maxzoom, (src.tiles as string[])[0]], ['terrarium', 13, 'https://dem/{z}/{x}/{y}.png'])
  // Nguồn gốc và font giữ nguyên.
  assert('openmaptiles' in (s.sources as object))
  assertEquals(s.glyphs, base().glyphs)
})

Deno.test('bản sáng: chỉ tô lại thảm phủ, đường sá giữ màu gốc', () => {
  const s = reliefStyle(base(), { demTiles: 'x', dark: false })
  assertEquals(layer(s, 'park').paint!['fill-color'], '#9ACB90')
  assertEquals(layer(s, 'road_motorway').paint!['line-color'], '#fc8')
  assertEquals(layer(s, 'background').paint!['background-color'], '#f8f4f0')
})

Deno.test('bản tối: mọi lớp tối hẳn theo nhóm tên', () => {
  const s = reliefStyle(base(), { demTiles: 'x', dark: true })
  assertEquals(layer(s, 'background').paint!['background-color'], '#0B0C0B')
  assertEquals(layer(s, 'water').paint!['fill-color'], '#0D161C')
  assertEquals(layer(s, 'park').paint!['fill-color'], '#141A12')
  assertEquals(layer(s, 'road_motorway').paint!['line-color'], '#4E4C42')
  assertEquals(layer(s, 'road_path_pedestrian').paint!['line-color'], '#3C3D39')
  assertEquals(layer(s, 'label_city').paint!['text-color'], '#D4D7CF')
  assertEquals(layer(s, 'water_name').paint!['text-color'], '#5D7F92')
  // Ô hoa văn vẽ cho nền sáng: chỉ còn vệt mờ, giữ nguyên hoa văn.
  assertEquals(layer(s, 'landuse_pitch').paint, { 'fill-pattern': 'pitch', 'fill-opacity': 0.08 })
  assertEquals(layer(s, RELIEF_HILLSHADE).paint!['hillshade-exaggeration'], 0.55)
})

Deno.test('không sửa style gốc, dựng lại nhiều lần không nhân đôi lớp', () => {
  const b = base()
  const before = JSON.stringify(b)
  const once = reliefStyle(b, { demTiles: 'x', dark: true })
  assertEquals(JSON.stringify(b), before)
  assertNotStrictEquals(once.layers[0], b.layers[0])
  const twice = reliefStyle(once, { demTiles: 'x', dark: false })
  assertEquals(ids(twice).filter((i) => i === RELIEF_HILLSHADE || i === RELIEF_TINT).length, 2)
})

Deno.test('lớp lạ vẫn rơi vào nhóm tối, không sáng loá', () => {
  assertEquals(darkPaintFor({ id: 'brand_new_label', type: 'symbol' })?.['text-color'], '#A7AAA2')
  assertEquals(darkPaintFor({ id: 'something', type: 'fill' })?.['fill-color'], '#121311')
  assertEquals(darkPaintFor({ id: 'x', type: 'heatmap' }), null)
})
