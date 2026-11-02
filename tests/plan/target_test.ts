// Thời gian leo mục tiêu (spec/48): ghi / bỏ trường trên doc và câu nói kết quả.
// Câu chữ phải giống từng chữ với app (way_trek/test/trip_plans/plan_target_days_test.dart).

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { MAX_TARGET_DAYS, newDoc, patchSettings, sameDoc } from '../../src/plan/core/doc.ts'
import { suggestLabel, targetDaysLabel, targetNote, targetRefusal, targetSuggestDays } from '../../src/plan/core/target.ts'
import type { PlanTarget, TargetReason, TargetStatus } from '../../src/plan/core/types.ts'

Deno.test('đặt thời gian leo thì ghi, về tự tính thì xoá hẳn khoá (giữ băm)', () => {
  const d = newDoc('2026-12-21')
  const two = patchSettings(d, { targetDays: 2 })
  assertEquals(two.targetDays, 2)
  const auto = patchSettings(two, { targetDays: null })
  assertEquals('targetDays' in auto, false)
  assertEquals(sameDoc(auto, d), true)
})

Deno.test('thời gian leo bị kẹp về khoảng máy chủ nhận (1–60), số lẻ làm tròn', () => {
  const d = newDoc('2026-12-21')
  assertEquals(patchSettings(d, { targetDays: 0 }).targetDays, 1)
  assertEquals(patchSettings(d, { targetDays: 999 }).targetDays, MAX_TARGET_DAYS)
  assertEquals(patchSettings(d, { targetDays: 2.6 }).targetDays, 3)
  assertEquals('targetDays' in patchSettings(d, { targetDays: Number.NaN }), false)
})

Deno.test('chữ của thời gian leo: tự tính, 1 ngày, N ngày N−1 đêm', () => {
  assertEquals(targetDaysLabel(null), 'Hệ thống tự tính')
  assertEquals(targetDaysLabel(1), '1 ngày')
  assertEquals(targetDaysLabel(3), '3 ngày 2 đêm')
})

const target = (status: TargetStatus, extra: { reason?: TargetReason; paceNeeded?: number; suggestDays?: number } = {}): PlanTarget => ({
  days: 2,
  status,
  actualDays: 3,
  strainedDays: status === 'strained' ? [1] : [],
  ...extra,
})

Deno.test('câu kết quả: kịp hay phải gồng thì im lặng; không thể thì nói ra lý do', () => {
  assertEquals(targetNote(target('met')), null)
  // Người dùng tự chọn số ngày nên biết nó căng thế nào (chủ sản phẩm 2/11).
  assertEquals(targetNote(target('strained', { paceNeeded: 0.9, suggestDays: 4 })), null)
  assertEquals(targetNote(target('impossible', { reason: 'fixedNights' })), 'Các đêm bạn tự xếp đã thành 3 ngày.')
  assertEquals(targetNote(target('impossible', { reason: 'overnight' })), 'Leo trong 2 ngày thì phải đi xuyên đêm.')
  assertEquals(targetNote(target('impossible', { reason: 'tooShort' })), 'Quãng đi chỉ đủ chia tối đa 3 ngày.')
  assertEquals(targetNote(target('impossible', { reason: 'noRestPlace' })), 'Không còn lán hay bản nào để ngủ thêm một đêm.')
})

Deno.test('một nút gỡ duy nhất: số ngày gợi ý — hết chỗ ngủ thì không (cách gỡ là mang lều)', () => {
  assertEquals(targetSuggestDays(target('met')), null)
  assertEquals(targetSuggestDays(target('strained', { suggestDays: 8 })), 8)
  assertEquals(targetSuggestDays(target('strained')), null)
  assertEquals(targetSuggestDays(target('impossible', { reason: 'fixedNights' })), 3)
  assertEquals(targetSuggestDays(target('impossible', { reason: 'tooShort' })), 3)
  assertEquals(targetSuggestDays(target('impossible', { reason: 'overnight' })), 3)
  assertEquals(targetSuggestDays(target('impossible', { reason: 'noRestPlace' })), null)
  assertEquals(suggestLabel(8), 'Gợi ý: 8 ngày 7 đêm')
  assertEquals(suggestLabel(1), 'Gợi ý: 1 ngày')
})

Deno.test('chọn số ngày không đi được: hộp thoại nói lý do và số ngày đi được; đi được thì không có hộp nào', () => {
  assertEquals(targetRefusal(target('met')), null)
  assertEquals(targetRefusal(target('strained', { suggestDays: 4 })), null)
  assertEquals(targetRefusal(target('impossible', { reason: 'overnight' })), {
    title: 'Không leo được trong 2 ngày 1 đêm',
    body: 'Leo trong 2 ngày thì phải đi xuyên đêm. Cần ít nhất 3 ngày.',
  })
  assertEquals(targetRefusal(target('impossible', { reason: 'tooShort' }))?.body, 'Quãng đi chỉ đủ chia tối đa 3 ngày.')
  assertEquals(
    targetRefusal(target('impossible', { reason: 'noRestPlace' }))?.body,
    'Không còn lán hay bản nào để ngủ thêm một đêm. Đoàn mang lều thì chia thêm được.',
  )
})
