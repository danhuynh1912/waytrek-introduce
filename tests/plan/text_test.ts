import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { editItem, mergeRows, progress, viewChecklist } from '../../src/plan/core/checklist.ts'
import type { ChecklistRow } from '../../src/plan/core/checklist.ts'
import { clock, distance, duration, meters, pace, parseClock, shortDate, todayVn } from '../../src/plan/core/format.ts'
import { fold, searchTrails } from '../../src/plan/core/search.ts'
import type { ResultLeg, TrailPin } from '../../src/plan/core/types.ts'
import { dayNote, knownNote, legFlagNotes } from '../../src/plan/core/warnings.ts'

Deno.test('giờ, thời lượng, quãng đường viết theo app', () => {
  assertEquals([clock(420), clock(65), clock(1445), clock(1439.6), clock(-5)], ['07:00', '01:05', '00:05 (+1)', '00:00 (+1)', '23:55 (-1)'])
  assertEquals([parseClock('6:05'), parseClock('23:59'), parseClock('24:00'), parseClock('x')], [365, 1439, null, null])
  assertEquals([duration(45), duration(60), duration(292), duration(1195)], ['45 phút', '1 giờ', '4 giờ 52', '19 giờ 55'])
  assertEquals([distance(850), distance(8041), distance(45257)], ['850 m', '8,0 km', '45,3 km'])
  assertEquals([meters(1073), meters(3024.4), pace(0.75)], ['1.073 m', '3.024 m', '0,75'])
})

Deno.test('ngày ngắn tính thẳng từ chuỗi, không qua múi giờ máy', () => {
  assertEquals([shortDate('2026-11-14'), shortDate('2026-12-21'), shortDate('2026-11-15')], ['T7, 14/11', 'T2, 21/12', 'CN, 15/11'])
  // 23:30 UTC ngày 23 đã là ngày 24 ở Việt Nam.
  assertEquals(todayVn(new Date('2026-10-23T23:30:00Z')), '2026-10-24')
})

const leg = (p: Partial<ResultLeg>): ResultLeg => ({
  from: 'a', to: 'b', transport: 'walk', distanceM: 2000, ascentM: 0, descentM: 0, moveMin: 30,
  driveMin: 0, knownPct: 100, unknownM: 0, flags: [], draw: [], ...p,
})

Deno.test('lối mòn OSM là vàng, không phải đỏ; thiếu đường xe thì nói ra', () => {
  assertEquals(knownNote(leg({ knownPct: 0, flags: ['mappedPath'] })), {
    level: 'warn',
    text: 'Đi theo lối mòn trên bản đồ OpenStreetMap — chưa ai đi trong dữ liệu WayTrek',
  })
  assertEquals(knownNote(leg({ knownPct: 0, unknownM: 300, flags: ['mappedPath'] }))?.level, 'warn')
  assertEquals(knownNote(leg({ knownPct: 0, flags: ['unknownPath', 'mappedPath'] }))?.level, 'danger')
  // Chặng xe có đoạn đi bộ nốt trên lối mòn: vẫn nói về phần đi bộ đó.
  assertEquals(knownNote(leg({ transport: 'vehicle', knownPct: 0, flags: ['mappedPath'] }))?.level, 'warn')
  assertEquals(legFlagNotes(leg({ transport: 'vehicle', flags: ['noRoadRoute'] })).map((n) => n.level), ['warn'])
})

Deno.test('mức đường đã biết theo đúng ba ngưỡng của spec', () => {
  assertEquals(knownNote(leg({ knownPct: 90 }))?.level, 'info')
  assertEquals(knownNote(leg({ knownPct: 89, unknownM: 220 })), { level: 'warn', text: '220 m chưa có lối đã biết' })
  assertEquals(knownNote(leg({ knownPct: 49 }))?.level, 'danger')
  assertEquals(knownNote(leg({ transport: 'vehicle', knownPct: 0 })), null)
  assertEquals(legFlagNotes(leg({ flags: ['steep', 'noElevation'] })).map((n) => n.level), ['warn', 'warn'])
})

Deno.test('cảnh báo ngày: tới sau giờ an toàn là đỏ, dời giờ là thông tin', () => {
  assertEquals(dayNote({ code: 'afterDark', arriveMin: 1060, limitMin: 986, sunsetMin: 1046 }), {
    level: 'danger',
    text: 'Tới nơi 17:40, quá giờ an toàn 16:26. Hoàng hôn 17:26 — trong rừng tối sớm hơn.',
  })
  assertEquals(dayNote({ code: 'departShifted', fromMin: 360, toMin: 310 }).text, 'Dời giờ đi sớm từ 06:00 lên 05:10 để kịp trước tối.')
  assertEquals(dayNote({ code: 'tooLong', walkMin: 596, capMin: 480, pushOn: false }).text, 'Đi bộ 9 giờ 56 trong ngày — quá 8 giờ.')
})

const row = (itemId: string, p: Partial<ChecklistRow> = {}): ChecklistRow => ({
  itemId, kind: 'builtin', label: null, done: false, removed: false, updatedAt: '2026-10-24T01:00:00Z', ...p,
})

Deno.test('chuẩn bị: mục mặc định theo máy chủ, xoá thì ẩn, đổi tên giữ, mục tự thêm ở cuối', () => {
  const rows = new Map([
    ['headlamp', row('headlamp', { done: true })],
    ['rain_gear', row('rain_gear', { removed: true })],
    ['water', row('water', { label: 'Nước 3 lít' })],
    ['c2', row('c2', { kind: 'custom', label: 'Gậy trek' })],
    ['c1', row('c1', { kind: 'custom', label: 'Thuốc chống vắt', done: true })],
    ['power_bank', row('power_bank', { done: true })],
  ])
  const items = viewChecklist(['headlamp', 'rain_gear', 'water', 'brand_new_code'], rows)
  assertEquals(items.map((i) => `${i.itemId}:${i.label}:${i.done}`), [
    'headlamp:Đèn pin + pin dự phòng:true',
    'water:Nước 3 lít:false',
    'c1:Thuốc chống vắt:true',
    'c2:Gậy trek:false',
  ])
  // power_bank không còn áp dụng (máy chủ không trả mã) thì không hiện, dù đã tick.
  assertEquals(progress(items), { done: 2, total: 4 })
})

Deno.test('chuẩn bị: mỗi mục bản mới hơn thắng, giống máy chủ', () => {
  const local = new Map([['headlamp', row('headlamp', { done: true, updatedAt: '2026-10-24T02:00:00Z' })]])
  const merged = mergeRows(local, [
    row('headlamp', { done: false, updatedAt: '2026-10-24T01:30:00Z' }),
    row('water', { done: true }),
  ])
  assertEquals([merged.get('headlamp')?.done, merged.get('water')?.done], [true, true])
  const e = editItem(merged, 'water', 'builtin', { label: '  ' }, '2026-10-24T03:00:00Z')
  assertEquals([e.label, e.done, e.updatedAt], [null, true, '2026-10-24T03:00:00Z'])
})

const trails: TrailPin[] = [
  { trailId: '1', name: 'Kỳ Quan San', region: 'Lào Cai', lat: 22.5, lng: 103.5, hasPeak: true, peakEleM: 3046 },
  { trailId: '2', name: 'Lảo Thẩn', region: 'Lào Cai', lat: 22.6, lng: 103.6, hasPeak: true, peakEleM: 2860 },
  { trailId: '3', name: 'Đỉnh Tà Chì Nhù', region: 'Yên Bái', lat: 21.6, lng: 104.2, hasPeak: true, peakEleM: 2979 },
  { trailId: '4', name: 'Núi Bà Đen', region: 'Tây Ninh', lat: 11.3, lng: 106.1, hasPeak: true, peakEleM: 986 },
]

Deno.test('tìm đỉnh bỏ dấu ở cả hai vế', () => {
  assertEquals(fold('  Đỉnh  Tà Chì   Nhù '), 'dinh ta chi nhu')
  assertEquals(searchTrails(trails, 'ky quan').map((t) => t.trailId), ['1'])
  assertEquals(searchTrails(trails, 'tà chì').map((t) => t.trailId), ['3'])
  assertEquals(searchTrails(trails, 'lao').map((t) => t.trailId), ['2', '1'])
  assertEquals(searchTrails(trails, '   '), [])
})

Deno.test('cảnh báo mới: trần theo ngày, xe sau hoàng hôn, trễ mốc gọi đúng tên, cắm trại', () => {
  assertEquals(dayNote({ code: 'tooLong', walkMin: 522, capMin: 480, pushOn: false }), {
    level: 'danger',
    text: 'Đi bộ 8 giờ 42 trong ngày — quá 8 giờ.',
  })
  assertEquals(
    dayNote({ code: 'tooLong', walkMin: 640, capMin: 600, pushOn: false }).text,
    'Đi bộ 10 giờ 40 trong ngày — quá 10 giờ của ngày lên đỉnh từ lán.',
  )
  // Lố ít mà kịp trước tối: chỉ nhắc, và nói ra vì sao không chia ngày.
  assertEquals(dayNote({ code: 'tooLong', walkMin: 601, capMin: 600, pushOn: true }), {
    level: 'warn',
    text: 'Đi bộ 10 giờ 01 trong ngày — quá 10 giờ của ngày lên đỉnh từ lán. Vẫn tới nơi trước giờ an toàn nên đi nốt, không dừng giữa đường.',
  })
  assertEquals(dayNote({ code: 'driveAfterDark', arriveMin: 1110, sunsetMin: 1047 }), {
    level: 'warn',
    text: 'Đi xe tới nơi 18:30, sau hoàng hôn (17:27).',
  })
  const late = { code: 'anchorLate', stopId: 'p1', targetMin: 401, etaMin: 687 } as const
  assertEquals(
    dayNote(late, (id) => (id === 'p1' ? 'Ky Quan San' : undefined)).text,
    'Ky Quan San: tới khoảng 11:27, không kịp mốc 06:41 — muốn kịp phải nghỉ đêm gần hơn.',
  )
  assertEquals(dayNote(late).text.startsWith('tới khoảng 11:27'), true)
  assertEquals(dayNote({ code: 'campZone', stopId: 'zone:1' }).level, 'warn')
})
