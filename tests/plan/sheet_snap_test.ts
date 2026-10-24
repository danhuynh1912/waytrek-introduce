import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { SHEET_FLICK, sheetDragHeight, sheetOpensAt } from '../../src/plan/core/sheet-snap.ts'

const HALF = 330
const FULL = 690

Deno.test('thả chậm: về mốc gần hơn', () => {
  assertEquals(sheetOpensAt(400, HALF, FULL, 0), false)
  assertEquals(sheetOpensAt(600, HALF, FULL, 0), true)
  assertEquals(sheetOpensAt((HALF + FULL) / 2, HALF, FULL, 0), false)
})

Deno.test('vuốt nhanh: theo hướng vuốt, kể cả khi chưa qua nửa đường', () => {
  assertEquals(sheetOpensAt(360, HALF, FULL, -SHEET_FLICK), true)
  assertEquals(sheetOpensAt(660, HALF, FULL, SHEET_FLICK), false)
})

Deno.test('đang kéo: tấm bám ngón tay, kẹp trong khoảng cho phép', () => {
  // Ngón tay đi lên 100 px → tấm cao thêm 100 px.
  assertEquals(sheetDragHeight(HALF, 500, 400, 120, FULL), HALF + 100)
  assertEquals(sheetDragHeight(HALF, 500, 0, 120, FULL), FULL)
  assertEquals(sheetDragHeight(HALF, 500, 900, 120, FULL), 120)
})
