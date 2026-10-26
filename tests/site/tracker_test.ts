import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { ageMinutes, ageText, QUIET_AFTER_MIN, trackBbox, trackFromRpc, trackHeadline } from '../../src/site/core/tracker.ts'

const live = {
  status: 'moving',
  name: 'Trang',
  title: 'Lảo Thẩn – KQS',
  firstDay: '2026-11-14',
  lastDay: '2026-11-17',
  draw: [
    { kind: 'route', moto: false, line: '_p~iF~ps|U_ulLnnqC' },
    { kind: 'vehicle', moto: false, line: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    { kind: 'route', line: '' },
  ],
  stops: [
    { name: 'Bãi xe', lat: 22.5, lng: 103.6, day: 0, kind: 'custom', rest: false },
    { name: 'Hỏng', lat: 'x', lng: 103.6 },
  ],
  position: { lat: 22.55, lng: 103.62, accuracyM: 12, at: '2026-11-14T03:00:00Z', state: 'moving' },
  now: '2026-11-14T03:12:00Z',
}

Deno.test('đọc phản hồi: bỏ phần tử hỏng, không ném', () => {
  const v = trackFromRpc(live)!
  assertEquals(v.status, 'moving')
  assertEquals(v.name, 'Trang')
  assertEquals(v.lines.length, 2)
  assertEquals(v.lines.map((l) => l.vehicle), [false, true])
  assertEquals(v.stops.length, 1)
  assertEquals(v.position?.accuracyM, 12)
  assertEquals(ageMinutes(v), 12, 'độ cũ đo theo giờ MÁY CHỦ')
  assertEquals(trackFromRpc(null), null)
  assertEquals(trackFromRpc({ status: 'lạ' }), null)
  assertEquals(trackFromRpc([]), null)
})

Deno.test('trạng thái ngắn gọn: link tắt / hết hạn không còn gì khác', () => {
  const off = trackFromRpc({ status: 'off' })!
  assertEquals(off.lines, [])
  assertEquals(off.position, null)
  assertEquals(trackHeadline(off).headline, 'Link theo dõi đã tắt')
  assertEquals(trackHeadline(trackFromRpc({ status: 'ended' })).headline, 'Chuyến đi đã kết thúc')
  assertEquals(trackHeadline(null).headline, 'Không tìm thấy link này')
})

Deno.test('câu trạng thái nói vị trí mới nhất là LÚC NÀO; lâu không có thì nói vì sao hay gặp', () => {
  const v = trackFromRpc(live)!
  assertEquals(trackHeadline(v), { headline: 'Đang đi', detail: 'Vị trí mới nhất 12 phút trước.' })
  const quiet = trackFromRpc({ ...live, now: new Date(Date.parse(live.position.at) + QUIET_AFTER_MIN * 60_000).toISOString() })!
  assert(trackHeadline(quiet).detail!.includes('mất sóng'))
  const paused = trackFromRpc({ ...live, status: 'paused', now: new Date(Date.parse(live.position.at) + 600 * 60_000).toISOString() })!
  assertEquals(trackHeadline(paused).headline, 'Đang tạm dừng')
  assert(!trackHeadline(paused).detail!.includes('mất sóng'), 'tạm dừng nghỉ đêm là chuyện bình thường')
  const upcoming = trackFromRpc({ status: 'upcoming', name: null, firstDay: '2026-11-14' })!
  assertEquals(trackHeadline(upcoming).headline, 'Chuyến đi bắt đầu T7, 14/11')
  assertEquals(trackHeadline(upcoming).detail, 'Vị trí của Người leo hiện ở đây khi bắt đầu ghi track.')
})

Deno.test('độ cũ dễ đọc', () => {
  const at = new Date('2026-11-14T00:40:00Z')
  assertEquals(ageText(0, at), 'vừa xong')
  assertEquals(ageText(59, at), '59 phút trước')
  assertEquals(ageText(120, at), '2 giờ trước')
  assertEquals(ageText(125, at), '2 giờ 05 phút trước')
  assertEquals(ageText(24 * 60 + 5, at), 'lúc 07:40, T7, 14/11')
})

Deno.test('khung nhìn ôm đường + vị trí; không có gì thì null', () => {
  const b = trackBbox(trackFromRpc(live)!)!
  assert(b[0] <= 103.6 && b[2] >= 103.62 && b[1] <= 22.5 && b[3] >= 22.55)
  assertEquals(trackBbox(trackFromRpc({ status: 'waiting' })!), null)
})
