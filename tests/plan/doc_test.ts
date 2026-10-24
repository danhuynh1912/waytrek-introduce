import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  appendWaypoint,
  dismissAutoStop,
  endsAtStart,
  freshWaypointId,
  keepAutoStop,
  makeWaypoint,
  MAX_WAYPOINTS,
  moveWaypoint,
  newDoc,
  nextPointName,
  patchSettings,
  prependStart,
  relocateWaypoint,
  removeWaypoint,
  returnToStart,
  sameDoc,
  setArriveAt,
  suggestReadiness,
  updateWaypoint,
} from '../../src/plan/core/doc.ts'
import { commit, initHistory, redo, undo } from '../../src/plan/core/history.ts'
import type { PlanDoc, ResultStop } from '../../src/plan/core/types.ts'

const pt = (id: string, lat = 22.5, lon = 103.6, kind: 'custom' | 'poi' | 'peak' = 'custom', ref?: string) =>
  makeWaypoint({ id, kind, ref, lat, lon, name: id })

function withPoints(...ids: string[]): PlanDoc {
  let d = newDoc('2026-12-21')
  for (const [i, id] of ids.entries()) {
    const r = appendWaypoint(d, pt(id, 22.5 + i * 0.01))
    assert(r.ok)
    d = r.doc
  }
  return d
}

Deno.test('kế hoạch mới mang đúng mặc định của máy chủ', () => {
  const d = newDoc('2026-12-21')
  assertEquals([d.departMin, d.pace, d.restMinPerHour, d.sunsetMarginMin, d.autoShift], [360, 0.75, 10, 60, true])
})

Deno.test('makeWaypoint làm tròn toạ độ về E6 và cắt tên', () => {
  const w = makeWaypoint({ id: 'a', kind: 'custom', lat: 22.5299754, lon: 103.6583216, name: '  Bãi xe  ' })
  assertEquals([w.latE6, w.lonE6, w.name, w.rest, w.transport], [22529975, 103658322, 'Bãi xe', false, 'auto'])
  assertEquals('ref' in w, false)
})

Deno.test('thêm điểm: nối vào cuối, chặn quá trần và ngoài Việt Nam, không đổi doc cũ', () => {
  const d = withPoints('a', 'b')
  const r = appendWaypoint(d, pt('c'))
  assert(r.ok)
  assertEquals(r.doc.waypoints.map((w) => w.id), ['a', 'b', 'c'])
  assertEquals(d.waypoints.length, 2)
  assertEquals(appendWaypoint(d, pt('x', 48.85, 2.35)), { ok: false, reason: 'outside' })
  let full = newDoc('2026-12-21')
  for (let i = 0; i < MAX_WAYPOINTS; i++) {
    const rr = appendWaypoint(full, pt(`p${i}`))
    assert(rr.ok)
    full = rr.doc
  }
  assertEquals(appendWaypoint(full, pt('z')), { ok: false, reason: 'full' })
})

Deno.test('đổi chỗ, xoá, sửa tên — tên trống không ghi đè', () => {
  const d = withPoints('a', 'b', 'c')
  assertEquals(moveWaypoint(d, 'b', -1).waypoints.map((w) => w.id), ['b', 'a', 'c'])
  assertEquals(moveWaypoint(d, 'a', -1), d)
  assertEquals(moveWaypoint(d, 'c', 1), d)
  assertEquals(removeWaypoint(d, 'b').waypoints.map((w) => w.id), ['a', 'c'])
  assertEquals(updateWaypoint(d, 'a', { name: '   ' }).waypoints[0].name, 'a')
  assertEquals(updateWaypoint(d, 'a', { name: ' Lán 1 ', rest: true }).waypoints[0], { ...d.waypoints[0], name: 'Lán 1', rest: true })
})

Deno.test('kéo điểm: giữ id + tên + ô nghỉ, đổi loại; đỉnh kéo đi thì bỏ ref', () => {
  let d = withPoints('a')
  const r0 = appendWaypoint(d, makeWaypoint({ id: 'pk', kind: 'peak', ref: 'trail-1', lat: 22.6, lon: 103.7, name: 'Đỉnh', rest: true }))
  assert(r0.ok)
  d = r0.doc
  const r = relocateWaypoint(d, 'pk', { lat: 22.61, lon: 103.71, kind: 'custom' })
  assert(r.ok)
  const w = r.doc.waypoints[1]
  assertEquals([w.id, w.name, w.rest, w.kind, w.latE6, 'ref' in w], ['pk', 'Đỉnh', true, 'custom', 22610000, false])
  assertEquals(relocateWaypoint(d, 'nope', { lat: 22, lon: 104, kind: 'custom' }), { ok: false, reason: 'missing' })
})

const auto: ResultStop = {
  id: 'auto:poi-1#0', kind: 'poi', ref: 'poi-1', name: 'Lán nghỉ', latE6: 22506220, lonE6: 103615333,
  eleM: 2129, day: 0, etaMin: 712, rest: true, restSource: 'auto', inserted: true, poiId: 'poi-1',
  waypointIndex: -1, afterWaypointIndex: 0, leaveByMin: null, targetMin: null, zone: null,
}

Deno.test('[Giữ] lán tự chèn: thành điểm thật ngay sau điểm đứng trước nó, tick nghỉ đêm sẵn', () => {
  const d = withPoints('a', 'b')
  const r = keepAutoStop(d, auto, 'a', 'k1')
  assert(r.ok)
  assertEquals(r.doc.waypoints.map((w) => w.id), ['a', 'k1', 'b'])
  const k = r.doc.waypoints[1]
  assertEquals([k.kind, k.ref, k.rest, k.name, k.latE6], ['poi', 'poi-1', true, 'Lán nghỉ', 22506220])
  assertEquals(keepAutoStop(d, auto, 'gone', 'k2'), { ok: false, reason: 'missing' })
})

Deno.test('[Bỏ] lán thì nhớ trong kế hoạch; chọn lại tường minh thì xoá dấu bỏ', () => {
  const d = dismissAutoStop(dismissAutoStop(withPoints('a', 'b'), 'poi-9'), 'poi-1')
  assertEquals(d.dismissedRestPoiIds, ['poi-1', 'poi-9'])
  assertEquals(dismissAutoStop(d, 'poi-1'), d)
  const kept = keepAutoStop(d, auto, 'a', 'k1')
  assert(kept.ok)
  assertEquals(kept.doc.dismissedRestPoiIds, ['poi-9'])
})

Deno.test('về điểm xuất phát', () => {
  const d = withPoints('a', 'b')
  assertEquals(endsAtStart(d), false)
  const r = returnToStart(d, 'back')
  assert(r.ok)
  assertEquals(endsAtStart(r.doc), true)
  assertEquals(r.doc.waypoints[2].name, 'Về a')
  assertEquals(returnToStart(withPoints('a'), 'x'), { ok: false, reason: 'missing' })
})

Deno.test('cài đặt bị kẹp về khoảng máy chủ nhận', () => {
  const d = newDoc('2026-12-21')
  const p = patchSettings(d, { pace: 9, restMinPerHour: -3, sunsetMarginMin: 500, departMin: 2000, startDate: '2026-02-30', title: '  ' })
  assertEquals([p.pace, p.restMinPerHour, p.sunsetMarginMin, p.departMin, p.startDate, p.title], [1.5, 0, 120, 1439, '2026-12-21', 'Kế hoạch mới'])
  assertEquals(patchSettings(d, { pace: 0.6333 }).pace, 0.63)
})

Deno.test('id điểm không trùng, tên mặc định không trùng', () => {
  const d = withPoints('wa', 'wb')
  const seq = ['a', 'b', 'c']
  let i = 0
  assertEquals(freshWaypointId(d, () => seq[i++]), 'wc')
  const named = updateWaypoint(withPoints('a', 'b'), 'a', { name: 'Điểm 3' })
  assertEquals(nextPointName(named), 'Điểm 4')
})

Deno.test('hoàn tác / làm lại', () => {
  let h = initHistory(1)
  h = commit(h, 2)
  h = commit(h, 3)
  assertEquals(commit(h, 3), h)
  h = undo(h)
  assertEquals([h.present, h.past, h.future], [2, [1], [3]])
  h = commit(h, 9)
  assertEquals(h.future, [])
  assertEquals(redo(h), h)
  assertEquals(undo(undo(undo(h))).present, 1)
})

Deno.test('so hai bản kế hoạch bỏ qua thứ tự khoá (jsonb xếp lại khoá)', () => {
  const d = withPoints('a', 'b')
  const reordered = JSON.parse(JSON.stringify(d, Object.keys(d).sort())) as PlanDoc
  reordered.waypoints = d.waypoints.map((w) => ({ transport: w.transport, rest: w.rest, name: w.name, lonE6: w.lonE6, latE6: w.latE6, kind: w.kind, id: w.id }))
  assertEquals(sameDoc(d, reordered), true)
  assertEquals(sameDoc(d, updateWaypoint(d, 'a', { rest: true })), false)
})

Deno.test('[Giữ] vùng nên nghỉ: thành "Chỗ cắm trại" tự chấm ở đúng điểm nghỉ, tick nghỉ đêm', () => {
  const d = withPoints('a', 'b')
  const zone: ResultStop = {
    ...auto,
    id: 'zone:812',
    kind: 'custom',
    ref: null,
    poiId: null,
    name: 'Vùng nên nghỉ',
    zone: { line: '_p~iF~ps|U', fromM: 8823, toM: 15226, water: false },
  }
  const r = keepAutoStop(d, zone, 'a', 'k1')
  assert(r.ok)
  const k = r.doc.waypoints[1]
  assertEquals([k.kind, k.ref, k.rest, k.name, k.latE6], ['custom', undefined, true, 'Chỗ cắm trại', 22506220])
})

Deno.test('mốc giờ: đặt bình minh / giờ cụ thể, bỏ mốc; giá trị lạ không ghi', () => {
  const d = withPoints('a', 'b')
  const sun = setArriveAt(d, 'b', 'sunrise')
  assertEquals(sun.waypoints[1].arriveAt, 'sunrise')
  assertEquals(setArriveAt(sun, 'b', 390).waypoints[1].arriveAt, 390)
  assert(!('arriveAt' in setArriveAt(sun, 'b', null).waypoints[1]))
  assertEquals(setArriveAt(d, 'b', 1440), d)
  assertEquals(setArriveAt(d, 'b', 12.5), d)
  // Kéo điểm đi chỗ khác vẫn giữ mốc và "nghỉ được ở đây".
  const marked = { ...sun, waypoints: sun.waypoints.map((w) => (w.id === 'b' ? { ...w, restOk: true } : w)) }
  const moved = relocateWaypoint(marked, 'b', { lat: 22.6, lon: 103.7, kind: 'custom' })
  assert(moved.ok)
  assertEquals([moved.doc.waypoints[1].arriveAt, moved.doc.waypoints[1].restOk], ['sunrise', true])
})

Deno.test('cắm trại: tắt thì ghi noCamp, bật lại thì xoá hẳn khoá (băm kế hoạch cũ giữ nguyên)', () => {
  const d = withPoints('a')
  const off = patchSettings(d, { camp: false })
  assertEquals(off.noCamp, true)
  const on = patchSettings(off, { camp: true })
  assert(!('noCamp' in on))
  assert(sameDoc(on, d))
})

Deno.test('nút gợi ý thứ tự leo: cần điểm xuất phát ở đầu và từ hai đỉnh', () => {
  const peak = (id: string, ref: string) => pt(id, 22.5, 103.6, 'peak', ref)
  const doc = (...w: ReturnType<typeof pt>[]) => ({ ...newDoc('2026-12-21'), waypoints: w })
  assertEquals(suggestReadiness(doc(pt('home'), peak('p1', 't1'))), null)
  // Hai lần cùng một đỉnh vẫn là một đỉnh.
  assertEquals(suggestReadiness(doc(pt('home'), peak('p1', 't1'), peak('p2', 't1'))), null)
  assertEquals(suggestReadiness(doc(pt('home'), peak('p1', 't1'), peak('p2', 't2'))), 'ready')
  assertEquals(suggestReadiness(doc(peak('p1', 't1'), peak('p2', 't2'), pt('home'))), 'needStart')
})

Deno.test('chân núi máy chủ chọn được chèn lên TRƯỚC đỉnh, nghỉ đêm được', () => {
  const peak = makeWaypoint({ id: 'p', kind: 'peak', ref: 'trail-1', lat: 22.5, lon: 103.6, name: 'Đỉnh' })
  const r = prependStart({ ...newDoc('2026-12-21'), waypoints: [peak] }, 's', {
    latE6: 22529975,
    lonE6: 103658322,
    name: 'Chân Đỉnh',
    trailId: 'trail-1',
  })
  assert(r.ok)
  const [start, second] = r.doc.waypoints
  assertEquals([start.id, start.kind, start.ref, start.restOk, start.name], ['s', 'route', 'trail-1', true, 'Chân Đỉnh'])
  assertEquals(second.id, 'p')
})

Deno.test('giờ sớm nhất: đặt 02:00 thì ghi, đặt lại 04:30 thì xoá trường (giữ băm doc cũ)', () => {
  const d = newDoc('2026-11-02')
  const early = patchSettings(d, { earliestDepartMin: 120 })
  assertEquals(early.earliestDepartMin, 120)
  assertEquals('earliestDepartMin' in patchSettings(early, { earliestDepartMin: 270 }), false)
  assertEquals(patchSettings(d, { earliestDepartMin: 2000 }).earliestDepartMin, 720)
})
