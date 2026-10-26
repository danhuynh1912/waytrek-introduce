import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  appendWaypoint,
  chooseRest,
  dismissAutoStop,
  endsAtStart,
  freshWaypointId,
  keepAutoStop,
  makeWaypoint,
  MAX_WAYPOINTS,
  moveWaypoint,
  newDoc,
  nextPointName,
  nightTransferOffered,
  patchSettings,
  restToggleAllowed,
  prependStart,
  relocateWaypoint,
  removeWaypoint,
  returnToStart,
  sameDoc,
  setArriveAt,
  setDepartAt,
  suggestReadiness,
  toggleRest,
  updateWaypoint,
} from '../../src/plan/core/doc.ts'
import { commit, initHistory, redo, undo } from '../../src/plan/core/history.ts'
import type { PlanDoc, RestChoice, ResultStop } from '../../src/plan/core/types.ts'

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

Deno.test('kéo điểm: giữ id + ô nghỉ, đổi loại; đỉnh kéo ra chỗ trống thì bỏ ref và tên đỉnh', () => {
  let d = withPoints('a')
  const r0 = appendWaypoint(d, makeWaypoint({ id: 'pk', kind: 'peak', ref: 'trail-1', lat: 22.6, lon: 103.7, name: 'Đỉnh', rest: true }))
  assert(r0.ok)
  d = r0.doc
  const r = relocateWaypoint(d, 'pk', { lat: 22.61, lon: 103.71, kind: 'custom' })
  assert(r.ok)
  const w = r.doc.waypoints[1]
  // Tên đỉnh không còn đúng chỗ: về tên theo số thứ tự, đúng số trên chấm bản đồ.
  assertEquals([w.id, w.name, w.rest, w.kind, w.latE6, 'ref' in w], ['pk', 'Điểm 2', true, 'custom', 22610000, false])
  assertEquals(relocateWaypoint(d, 'nope', { lat: 22, lon: 104, kind: 'custom' }), { ok: false, reason: 'missing' })
})

Deno.test('kéo điểm thả lên đỉnh / POI: mang tên, loại, mã của chỗ thả (chủ sản phẩm 26/10)', () => {
  let d = withPoints('a', 'b')
  d = updateWaypoint(d, 'b', { name: 'Rừng Đỗ Quyên' })
  const peak = relocateWaypoint(d, 'b', { lat: 22.422857, lon: 103.603917, kind: 'peak', ref: 'pu-ta-leng', name: 'Pu Ta Leng' })
  assert(peak.ok)
  const p = peak.doc.waypoints[1]
  assertEquals([p.name, p.kind, p.ref, p.latE6, p.lonE6], ['Pu Ta Leng', 'peak', 'pu-ta-leng', 22422857, 103603917])
  const poi = relocateWaypoint(peak.doc, 'b', { lat: 22.4121, lon: 103.6029, kind: 'poi', ref: 'lan-1', name: 'Lán nghỉ chân' })
  assert(poi.ok)
  assertEquals([poi.doc.waypoints[1].name, poi.doc.waypoints[1].kind], ['Lán nghỉ chân', 'poi'])
  // Điểm tự chấm có tên người dùng đặt: kéo ra chỗ trống thì giữ tên.
  const mine = relocateWaypoint(d, 'b', { lat: 22.52, lon: 103.62, kind: 'custom' })
  assert(mine.ok)
  assertEquals(mine.doc.waypoints[1].name, 'Rừng Đỗ Quyên')
  // Tên theo số thứ tự đã có điểm khác mang: lấy "Điểm N" kế tiếp chưa ai dùng.
  let e = updateWaypoint(withPoints('x', 'y', 'z'), 'x', { name: 'Điểm 2' })
  const r0 = relocateWaypoint(e, 'y', { lat: 22.6, lon: 103.7, kind: 'poi', ref: 'lan-1', name: 'Lán' })
  assert(r0.ok)
  e = r0.doc
  const away = relocateWaypoint(e, 'y', { lat: 22.61, lon: 103.71, kind: 'custom' })
  assert(away.ok)
  assertEquals(away.doc.waypoints[1].name, 'Điểm 4')
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

Deno.test('ô "Nghỉ đêm ở đây": chỉ điểm giữa, không cho đỉnh (đỉnh lỡ đánh dấu thì vẫn bỏ được)', () => {
  const at = (kind: 'peak' | 'custom', rest = false) =>
    ({ ...makeWaypoint({ id: 'x', kind, lat: 22, lon: 104, name: 'x' }), rest })
  assertEquals(restToggleAllowed(at('custom'), 1, 3), true)
  assertEquals(restToggleAllowed(at('peak'), 1, 3), false)
  assertEquals(restToggleAllowed(at('peak', true), 1, 3), true)
  assertEquals(restToggleAllowed(at('custom'), 0, 3), false)
  assertEquals(restToggleAllowed(at('custom'), 2, 3), false)
})

Deno.test('lán không có ô tick nghỉ đêm — đổi lán bằng restChoices', () => {
  const lan = { ...pt('l', 22.5, 103.6, 'poi', 'poi-1'), rest: true }
  assertEquals(restToggleAllowed(lan, 1, 3), false)
})

const choice = (poiId: string, extra: Partial<RestChoice> = {}): RestChoice => ({
  poiId, name: poiId, etaMin: 900, latE6: 22505000, lonE6: 103610000,
  waypointIndex: -1, afterWaypointIndex: 0, current: false, ...extra,
})

Deno.test('[Ngủ ở] lán tự chèn → lán khác chưa có: bỏ lán cũ, chèn lán mới tick nghỉ', () => {
  const d = withPoints('a', 'b')
  const r = chooseRest(d, auto, choice('poi-2'), 'n1')
  assert(r.ok)
  assertEquals(r.doc.dismissedRestPoiIds, ['poi-1'])
  assertEquals(r.doc.waypoints.map((w) => w.id), ['a', 'n1', 'b'])
  const n = r.doc.waypoints[1]
  assertEquals([n.kind, n.ref, n.rest, n.latE6], ['poi', 'poi-2', true, 22505000])
})

Deno.test('chèn lán giữa chặng: nửa đầu giữ cách đi của chặng cũ, nửa sau bỏ ép đi xe', () => {
  const d = updateWaypoint(withPoints('a', 'b'), 'b', { transport: 'vehicle' })
  for (const r of [keepAutoStop(d, auto, 'a', 'k1'), chooseRest(d, auto, choice('poi-2'), 'k1')]) {
    assert(r.ok)
    assertEquals(r.doc.waypoints.map((w) => [w.id, w.transport]), [['a', 'auto'], ['k1', 'vehicle'], ['b', 'auto']])
  }
  const w = updateWaypoint(withPoints('a', 'b'), 'b', { transport: 'walk' })
  const r = keepAutoStop(w, auto, 'a', 'k1')
  assert(r.ok)
  assertEquals(r.doc.waypoints.map((x) => x.transport), ['auto', 'walk', 'walk'])
})

Deno.test('[Ngủ ở] điểm lán của người dùng → lán đã là điểm: chuyển dấu nghỉ', () => {
  let d = withPoints('a', 'b', 'c')
  d = updateWaypoint(d, 'b', { rest: true })
  const mine: ResultStop = { ...auto, id: 'wp:b', restSource: 'user', inserted: false, poiId: null, waypointIndex: 1 }
  const r = chooseRest(d, mine, choice('poi-3', { waypointIndex: 2 }), 'n1')
  assert(r.ok)
  assertEquals(r.doc.waypoints.map((w) => [w.id, w.rest]), [['a', false], ['b', false], ['c', true]])
  assertEquals(chooseRest(d, mine, choice('poi-9', { current: true }), 'n2'), { ok: true, doc: d })
})

Deno.test('giờ đi sáng hôm sau đi theo đêm: đổi lán thì dời theo, bỏ ô nghỉ thì bỏ luôn', () => {
  let d = withPoints('a', 'b', 'c', 'd')
  d = setDepartAt(updateWaypoint(d, 'b', { rest: true }), 'b', 5 * 60)
  const mine: ResultStop = { ...auto, id: 'wp:b', restSource: 'user', inserted: false, poiId: null, waypointIndex: 1 }
  // Sang một điểm đã có.
  const toC = chooseRest(d, mine, choice('poi-3', { waypointIndex: 2 }), 'n1')
  assert(toC.ok)
  assertEquals(toC.doc.waypoints.map((w) => [w.id, w.rest, w.departAt]), [
    ['a', false, undefined], ['b', false, undefined], ['c', true, 300], ['d', false, undefined],
  ])
  // Sang một lán chưa là điểm: lán chèn vào mang giờ đó.
  const ins = chooseRest(d, mine, choice('poi-2', { afterWaypointIndex: 1 }), 'n1')
  assert(ins.ok)
  assertEquals(ins.doc.waypoints.map((w) => [w.id, w.rest, w.departAt]), [
    ['a', false, undefined], ['b', false, undefined], ['n1', true, 300], ['c', false, undefined], ['d', false, undefined],
  ])
  // Bỏ ô "Nghỉ đêm ở đây": 05:00 thôi là giờ sáng hôm sau → bỏ luôn.
  const off = toggleRest(d, 'b')
  assertEquals([off.waypoints[1].rest, off.waypoints[1].departAt], [false, undefined])
  assertEquals(toggleRest(off, 'b').waypoints[1].rest, true)
})

Deno.test('đặt giờ đi ở chỗ máy chủ tự cho ngủ: ghim đêm đó lại', () => {
  const d = withPoints('a', 'b', 'c')
  const pinned = setDepartAt(d, 'b', 5 * 60, true)
  assertEquals([pinned.waypoints[1].rest, pinned.waypoints[1].departAt], [true, 300])
  // Không ngủ ở đó: chỉ là giờ đi tiếp trong ngày.
  assertEquals(setDepartAt(d, 'b', 14 * 60).waypoints[1].rest, false)
  // Bỏ giờ không đụng tới ô nghỉ.
  assertEquals(setDepartAt(pinned, 'b', null, true).waypoints[1].rest, true)
})

Deno.test('nghỉ trưa: đặt 45 thì ghi, đặt lại 30 thì xoá trường, kẹp 0–180', () => {
  const d = newDoc('2026-11-02')
  assertEquals(patchSettings(d, { lunchMin: 45 }).lunchMin, 45)
  assertEquals('lunchMin' in patchSettings(patchSettings(d, { lunchMin: 45 }), { lunchMin: 30 }), false)
  assertEquals(patchSettings(d, { lunchMin: 999 }).lunchMin, 180)
  assertEquals(patchSettings(d, { lunchMin: 0 }).lunchMin, 0)
})

Deno.test('thời gian trên đỉnh: đặt 45 thì ghi, đặt lại 30 thì xoá trường, kẹp 0–180', () => {
  const d = newDoc('2026-11-02')
  assertEquals(patchSettings(d, { summitMin: 45 }).summitMin, 45)
  assertEquals('summitMin' in patchSettings(patchSettings(d, { summitMin: 45 }), { summitMin: 30 }), false)
  assertEquals(patchSettings(d, { summitMin: 999 }).summitMin, 180)
})

Deno.test('ô "Đi từ tối hôm trước": chỉ khi chặng xe > 100 km, hoặc đang bật sẵn', () => {
  assertEquals(nightTransferOffered(31_200, null), false)
  assertEquals(nightTransferOffered(228_600, null), true)
  assertEquals(nightTransferOffered(31_200, 19 * 60 + 30), true)
  assertEquals(nightTransferOffered(null, null), false)
})

Deno.test('giờ xuất phát ở một điểm: đặt, bỏ, ngoài 0..1439 thì bỏ qua; dời điểm vẫn giữ', () => {
  const d = withPoints('a', 'b', 'c')
  const set = setDepartAt(d, 'b', 7 * 60 + 30)
  assertEquals(set.waypoints[1].departAt, 450)
  assertEquals(set.waypoints[0].departAt, undefined)
  assertEquals(setDepartAt(set, 'b', null).waypoints[1].departAt, undefined)
  assert(setDepartAt(d, 'b', 24 * 60) === d)
  assert(setDepartAt(d, 'b', -5) === d)
  const moved = relocateWaypoint(set, 'b', { lat: 22.51, lon: 103.61, kind: 'custom' })
  assert(moved.ok)
  assertEquals(moved.doc.waypoints[1].departAt, 450)
  // Giờ có mặt và giờ xuất phát độc lập: đặt cái này không xoá cái kia.
  const both = setArriveAt(set, 'b', 'sunrise')
  assertEquals(both.waypoints[1].departAt, 450)
  assertEquals(both.waypoints[1].arriveAt, 'sunrise')
  assertEquals(setDepartAt(both, 'b', 480).waypoints[1].arriveAt, 'sunrise')
})
