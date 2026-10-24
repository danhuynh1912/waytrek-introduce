import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { pickerList, resolveCombos, toggleCombo } from '../../src/plan/core/search.ts'
import type { TrailPin } from '../../src/plan/core/types.ts'

const pin = (trailId: string, name: string, hasPeak = true): TrailPin =>
  ({ trailId, name, region: 'Lai Châu', lat: 22, lng: 103, hasPeak, peakEleM: 2800 })
const trails = [pin('cv', 'Chu Va 12'), pin('can', 'Can Chua Thìa Sản'), pin('mieu', 'Miêu Thạch Sơn'), pin('x', 'Xà Hồ', false)]

Deno.test('ô tìm trống: hiện toàn bộ cung theo tên; đỉnh đã chọn đứng đầu theo thứ tự chọn', () => {
  const { picked, rest } = pickerList(trails, '', ['mieu', 'can'])
  assertEquals(picked.map((t) => t.trailId), ['mieu', 'can'])
  assertEquals(rest.map((t) => t.trailId), ['cv', 'x'])
})

Deno.test('đang gõ: đỉnh đã chọn vẫn hiện dù không khớp chữ', () => {
  const { picked, rest } = pickerList(trails, 'chu va', ['mieu'])
  assertEquals(picked.map((t) => t.trailId), ['mieu'])
  assertEquals(rest.map((t) => t.trailId), ['cv'])
})

Deno.test('combo: bỏ cung không có đỉnh / không còn trong danh mục; dưới 2 đỉnh thì bỏ combo', () => {
  const r = resolveCombos([
    { id: 'a', name: 'Can Miêu Chu', trailIds: ['can', 'mieu', 'cv', 'gone'] },
    { id: 'b', name: 'Lẻ', trailIds: ['cv', 'x'] },
  ], trails)
  assertEquals(r.map((c) => c.combo.id), ['a'])
  assertEquals(r[0].peaks.map((t) => t.trailId), ['can', 'mieu', 'cv'])
})

Deno.test('bấm combo: thêm phần còn thiếu theo thứ tự combo; đã đủ thì bỏ cả combo', () => {
  assertEquals(toggleCombo(['cv'], ['can', 'mieu', 'cv']), ['cv', 'can', 'mieu'])
  assertEquals(toggleCombo(['x', 'can', 'mieu', 'cv'], ['can', 'mieu', 'cv']), ['x'])
})
