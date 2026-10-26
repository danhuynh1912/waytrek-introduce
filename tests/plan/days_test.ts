// Kéo điểm sang ngày khác + giờ ở điểm máy chèn (chủ sản phẩm 26/10).

import { assert, assertEquals, assertStrictEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  appendWaypoint,
  chooseRest,
  clearArrivalsAfter,
  dropLateDepartures,
  keepAutoStop,
  makeWaypoint,
  MAX_AUTO_TIMES,
  moveToDay,
  moveWaypoint,
  newDoc,
  pushAutoToNextDay,
  pushToNextDay,
  relocateWaypoint,
  removeWaypoint,
  reorderWaypoints,
  returnToStart,
  setAutoTime,
  setDepartAt,
  toggleRest,
} from '../../src/plan/core/doc.ts'
import { dayLayout, isHomeSlot, nearestSlot } from '../../src/plan/core/days.ts'
import { commit, initHistory, replacePresent, undo } from '../../src/plan/core/history.ts'
import { buildTimeline } from '../../src/plan/core/timeline.ts'
import type { Row } from '../../src/plan/core/timeline.ts'
import type { DayWarning, PlanDoc, PlanResult, RestChoice, ResultDay, ResultLeg, ResultStop } from '../../src/plan/core/types.ts'
import { addedStrain, lateArrivalOf } from '../../src/plan/core/warnings.ts'

// Kết quả THẬT của `trip-plan` (24/10): KQS đi–về rồi Lảo Thẩn, 4 ngày —
// a | b | c d | e f, mỗi đêm ở một lán máy tự chọn.
const fx = JSON.parse(await Deno.readTextFile(new URL('./fixtures/kqs_laothan.json', import.meta.url))) as {
  doc: PlanDoc
  result: PlanResult
}
const layout = dayLayout(buildTimeline(fx.doc, fx.result, fx.doc).rows)

/** Ngày của từng điểm theo số đêm đã xếp — như máy chủ đếm (giữ đêm "Nghỉ đêm ở đây"). */
function daysOf(doc: PlanDoc): (number | null)[] {
  let d: number | null = 0
  return doc.waypoints.map((w, k) => {
    if (k === 0) return 0
    const own = k - 1 > 0 && k - 1 < doc.waypoints.length - 1 && doc.waypoints[k - 1].rest ? 1 : 0
    d = d == null || w.nightsBefore === undefined ? null : d + Math.max(w.nightsBefore, own)
    return d
  })
}

/** Doc với các điểm `ids`; `nights[k]` = số đêm đã xếp trước điểm k (undefined = máy tự chia). */
function plan(ids: string[], nights: (number | undefined)[] = [], rest: string[] = []): PlanDoc {
  let d = newDoc('2026-12-21')
  ids.forEach((id, i) => {
    const r = appendWaypoint(d, makeWaypoint({ id, kind: 'custom', lat: 22.5 + i * 0.01, lon: 103.6, name: id, rest: rest.includes(id) }))
    assert(r.ok)
    d = r.doc
  })
  return {
    ...d,
    waypoints: d.waypoints.map((w, k) => (nights[k] === undefined ? w : { ...w, nightsBefore: nights[k] })),
  }
}

const ids = (doc: PlanDoc) => doc.waypoints.map((w) => w.id)

Deno.test('dòng thời gian thật: ngày của từng điểm, và chỗ thả ở mọi ngày mà khoảng giữa hai điểm trải qua', () => {
  assertEquals([...layout.dayOf], [['a', 0], ['b', 1], ['c', 2], ['d', 2], ['e', 3], ['f', 3]])
  assertEquals(layout.slots.map((s) => `${s.index}/${s.day}@${s.anchor}`), [
    '0/0@wp:a',
    // a → b đi qua đêm ở lán: cuối ngày 1 (trên tiêu đề Ngày 2) hoặc đầu ngày 2.
    '1/0@day:1', '1/1@wp:b',
    '2/1@day:2', '2/2@wp:c',
    '3/2@wp:d',
    '4/2@day:3', '4/3@wp:e',
    '5/3@wp:f',
    '6/3@null',
  ])
})

Deno.test('kéo một điểm sang ngày trước, cùng thứ tự: chỉ nó đổi ngày, mọi điểm khác giữ ngày đang thấy', () => {
  const next = moveToDay(fx.doc, layout.dayOf, 'c', { index: 2, day: 1 })
  assertEquals(ids(next), ids(fx.doc))
  assertEquals(daysOf(next), [0, 1, 1, 2, 3, 3])
})

Deno.test('kéo sang ngày khác và đổi thứ tự', () => {
  // e (Đỉnh Lảo Thẩn, ngày 4) thả giữa c và d ở ngày 3.
  const next = moveToDay(fx.doc, layout.dayOf, 'e', { index: 3, day: 2 })
  assertEquals(ids(next), ['a', 'b', 'c', 'e', 'd', 'f'])
  assertEquals(daysOf(next), [0, 1, 2, 2, 2, 3])
  // d thả lên đầu: thành điểm xuất phát, a vẫn ở ngày đầu.
  const head = moveToDay(fx.doc, layout.dayOf, 'd', { index: 0, day: 0 })
  assertEquals(ids(head), ['d', 'a', 'b', 'c', 'e', 'f'])
  assertEquals(daysOf(head), [0, 0, 1, 2, 3, 3])
  assertEquals(head.waypoints[0].nightsBefore, undefined)
})

Deno.test('thả đúng chỗ cũ thì không đổi gì — không lặng lẽ chốt ngày cho cả kế hoạch', () => {
  // Hai chỗ thả quanh chính nó (trước nó, ngay sau nó) cùng ngày là chỗ cũ.
  assertEquals(layout.slots.filter((s) => isHomeSlot(layout, 'c', s)).map((s) => `${s.index}/${s.day}`), ['2/2', '3/2'])
  assertStrictEquals(moveToDay(fx.doc, layout.dayOf, 'c', { index: 2, day: 2 }), fx.doc)
  assertStrictEquals(moveToDay(fx.doc, layout.dayOf, 'c', { index: 3, day: 2 }), fx.doc)
  assertStrictEquals(moveToDay(fx.doc, layout.dayOf, 'a', { index: 0, day: 0 }), fx.doc)
})

Deno.test('điểm "Nghỉ đêm ở đây" nằm đúng ngày được thả; đêm của nó đẩy điểm sau nó sang ngày kế', () => {
  const d = plan(['A', 'P', 'C', 'D'], [], ['P'])
  const dayOf = new Map([['A', 0], ['P', 0], ['C', 1], ['D', 1]])
  // Thả P giữa C và D ở ngày 2: C giữ ngày 2, ngủ ở P nên D sang ngày 3.
  const next = moveToDay(d, dayOf, 'P', { index: 3, day: 1 })
  assertEquals(ids(next), ['A', 'C', 'P', 'D'])
  assertEquals(daysOf(next), [0, 1, 1, 2])
  // Thả P sang đầu ngày sau, ngay sau chỗ cũ: nó sang ngày đó thật (máy chọn chỗ ngủ đêm trước).
  const later = moveToDay(d, dayOf, 'P', { index: 2, day: 1 })
  assertEquals(ids(later), ids(d))
  assertEquals(daysOf(later), [0, 1, 2, 2])
})

Deno.test('nút lên / xuống khi đã xếp ngày: hai dòng đổi chỗ, tiêu đề ngày đứng yên', () => {
  const lan = plan(['A', 'B', 'C', 'D'], [undefined, 0, 1, 0])
  const swapped = moveWaypoint(lan, 'B', 1)
  assertEquals(ids(swapped), ['A', 'C', 'B', 'D'])
  assertEquals(daysOf(swapped), [0, 0, 1, 1])
  // Điểm "Nghỉ đêm ở đây" sang dòng của ngày sau: vẫn ngủ ở nó, điểm sau nó sang ngày kế.
  const own = plan(['A', 'P', 'C', 'D'], [undefined, 0, 1, 0], ['P'])
  const moved = moveWaypoint(own, 'P', 1)
  assertEquals(ids(moved), ['A', 'C', 'P', 'D'])
  assertEquals(daysOf(moved), [0, 0, 1, 2])
  // Chưa xếp ngày: như cũ, không chốt gì.
  assert(moveWaypoint(plan(['A', 'B', 'C']), 'B', 1).waypoints.every((w) => w.nightsBefore === undefined))
})

Deno.test('xoá điểm: hai khoảng quanh nó gộp lại; đêm của chính nó và giờ ở điểm máy chèn cạnh nó mất theo', () => {
  const d = {
    ...plan(['A', 'B', 'C', 'D'], [undefined, 0, 1, 1]),
    autoTimes: { 'trailhead:B>C': { departAt: 420 }, 'zone:C>D#2': { arriveAt: 'sunrise' as const }, 'rest:x#0': { departAt: 360 } },
  }
  const next = removeWaypoint(d, 'C')
  assertEquals(daysOf(next), [0, 0, 2])
  assertEquals(Object.keys(next.autoTimes!), ['rest:x#0'])
  const own = removeWaypoint(plan(['A', 'P', 'C'], [undefined, 0, 1], ['P']), 'P')
  assertEquals(daysOf(own), [0, 0])
})

Deno.test('tick "Nghỉ đêm ở đây": khoảng sau đã có đêm máy đặt thì ngủ ở đây thay chỗ; bỏ tick thì đêm mất', () => {
  const d = plan(['A', 'B', 'C', 'D'], [undefined, 0, 1, 0])
  const on = toggleRest(d, 'B')
  assert(on.waypoints[1].rest)
  assertEquals(daysOf(on), [0, 0, 1, 1])
  const off = toggleRest(on, 'B')
  assertEquals(daysOf(off), [0, 0, 0, 0])
  // Khoảng sau chưa có đêm nào: tick là thêm một đêm.
  assertEquals(daysOf(toggleRest(plan(['A', 'B', 'C'], [undefined, 0, 0]), 'B')), [0, 0, 1])
  // Chưa xếp ngày: chỉ đổi ô tick.
  assertEquals(toggleRest(plan(['A', 'B', 'C']), 'B').waypoints.map((w) => w.nightsBefore), [undefined, undefined, undefined])
})

Deno.test('đặt giờ đi sáng hôm sau ở đêm máy chọn ngay tại điểm: ghim đêm vào điểm, không thêm ngày', () => {
  const d = plan(['A', 'B', 'C'], [undefined, 0, 1])
  const next = setDepartAt(d, 'B', 420, true)
  assertEquals([next.waypoints[1].rest, next.waypoints[1].departAt], [true, 420])
  assertEquals(daysOf(next), [0, 0, 1])
})

const stop = (p: Partial<ResultStop>): ResultStop => ({
  id: 'auto:L2#0', kind: 'poi', ref: 'L2', name: 'Lán 2', latE6: 22_520_000, lonE6: 103_600_000, eleM: 2000, day: 1,
  etaMin: 900, rest: true, restSource: 'auto', inserted: true, poiId: 'L2', waypointIndex: -1, afterWaypointIndex: 0,
  leaveByMin: null, targetMin: null, zone: null, ...p,
})

Deno.test('Giữ một lán trong khoảng nhiều đêm: lán vào đúng đêm của nó, tổng số đêm giữ nguyên', () => {
  // A → B ba đêm máy đặt; lán giữ lại là đêm kết thúc ngày 2 (đêm thứ hai).
  const r = keepAutoStop(plan(['A', 'B'], [undefined, 3]), stop({ day: 1 }), 'A', 'X')
  assert(r.ok)
  assertEquals(ids(r.doc), ['A', 'X', 'B'])
  assertEquals(daysOf(r.doc), [0, 1, 3])
})

Deno.test('Đổi lán ngủ: đêm dời sang lán mới, tổng số đêm giữ nguyên', () => {
  const choice: RestChoice = {
    poiId: 'L3', name: 'Lán 3', etaMin: 950, latE6: 22_525_000, lonE6: 103_600_000, waypointIndex: -1, afterWaypointIndex: 0, current: false,
  }
  const r = chooseRest(plan(['A', 'B'], [undefined, 2]), stop({ day: 1 }), choice, 'X')
  assert(r.ok)
  assertEquals(ids(r.doc), ['A', 'X', 'B'])
  assertEquals(r.doc.dismissedRestPoiIds, ['L2'])
  assertEquals(daysOf(r.doc), [0, 1, 2])
  // Đêm ở một điểm của người dùng dời sang lán đã là một điểm.
  const d = plan(['A', 'M', 'C', 'D'], [undefined, 0, 1, 0], ['M'])
  const r2 = chooseRest(d, stop({ id: 'M', waypointIndex: 1, inserted: false, poiId: null, day: 0 }), { ...choice, waypointIndex: 2 }, 'X')
  assert(r2.ok)
  assertEquals(r2.doc.waypoints.map((w) => w.rest), [false, false, true, false])
  assertEquals(daysOf(r2.doc), [0, 0, 0, 1])
})

Deno.test('tab Waypoints: khoảng còn nguyên hai đầu giữ số đêm, khoảng mới để máy tự chia; bỏ điểm thì gộp', () => {
  const d = plan(['a', 'b', 'c', 'd', 'e'], [undefined, 1, 0, 1, 0])
  const re = reorderWaypoints(d, ['a', 'b', 'd', 'c', 'e'])
  assertEquals(ids(re), ['a', 'b', 'd', 'c', 'e'])
  assertEquals(re.waypoints.map((w) => w.nightsBefore), [undefined, 1, undefined, undefined, undefined])
  const cut = reorderWaypoints(d, ['a', 'b', 'd', 'e'])
  assertEquals(daysOf(cut), [0, 1, 2, 2])
  assertStrictEquals(reorderWaypoints(d, ids(d)), d)
})

Deno.test('giờ ở điểm máy chèn: đặt, bỏ, khoá rỗng tự biến mất; giờ sai bị bỏ qua', () => {
  const d = plan(['A', 'B'])
  const live = new Set(['trailhead:A>B'])
  const r = setAutoTime(d, 'trailhead:A>B', { departAt: 450 }, live)
  assert(r.ok)
  assertEquals(r.doc.autoTimes, { 'trailhead:A>B': { departAt: 450 } })
  const r2 = setAutoTime(r.doc, 'trailhead:A>B', { arriveAt: 'sunrise' }, live)
  assert(r2.ok)
  assertEquals(r2.doc.autoTimes, { 'trailhead:A>B': { departAt: 450, arriveAt: 'sunrise' } })
  const r3 = setAutoTime(r2.doc, 'trailhead:A>B', { departAt: null, arriveAt: null }, live)
  assert(r3.ok)
  assertEquals(r3.doc.autoTimes, undefined)
  const bad = setAutoTime(d, 'trailhead:A>B', { departAt: 1440 }, live)
  assert(bad.ok)
  assertStrictEquals(bad.doc, d)
})

Deno.test('giờ ở điểm máy chèn: chạm trần thì dọn giờ của điểm không còn trong kết quả, hết chỗ thì báo', () => {
  const full = Object.fromEntries(Array.from({ length: MAX_AUTO_TIMES }, (_, i) => [`rest:p${i}#0`, { departAt: 400 }]))
  const d = { ...plan(['A', 'B']), autoTimes: full }
  const stale = setAutoTime(d, 'transfer', { departAt: 300 }, new Set(['transfer', 'rest:p0#0']))
  assert(stale.ok)
  assertEquals(Object.keys(stale.doc.autoTimes!).sort(), ['rest:p0#0', 'transfer'])
  const allLive = setAutoTime(d, 'transfer', { departAt: 300 }, new Set(Object.keys(full)))
  assertEquals(allLive, { ok: false, reason: 'timesFull' })
  // Sửa giờ của khoá đã có thì không tính là thêm.
  assert(setAutoTime(d, 'rest:p1#0', { departAt: 420 }, new Set()).ok)
})

Deno.test('kéo điểm trên bản đồ giữ số đêm đã xếp; điểm về trùng điểm xuất phát không mang ngày theo', () => {
  const d = plan(['A', 'B', 'C'], [undefined, 1, 0])
  const r = relocateWaypoint(d, 'B', { lat: 22.6, lon: 103.7, kind: 'custom' })
  assert(r.ok)
  assertEquals(r.doc.waypoints[1].nightsBefore, 1)
  const odd = { ...d, waypoints: d.waypoints.map((w, k) => (k === 0 ? { ...w, nightsBefore: 2 } : w)) }
  const back = returnToStart(odd, 'Z')
  assert(back.ok)
  assertEquals(back.doc.waypoints.at(-1)!.nightsBefore, undefined)
})

Deno.test('chỗ thả gần con trỏ nhất', () => {
  assertEquals(nearestSlot([10, 50, 90], 62), 1)
  assertEquals(nearestSlot([10, 50, 90], 200), 2)
  assertEquals(nearestSlot([], 5), -1)
})

// ─── Lịch quá sức sau khi kéo ────────────────────────────────────────────

const day = (index: number, warnings: DayWarning[], transfer = false): ResultDay => ({
  index, date: '2026-12-21', departMin: 360, plannedDepartMin: 360, arriveMin: 1000, sunriseMin: 380, sunsetMin: 1050,
  limitMin: 990, walkMin: 400, elapsedMin: 600, distanceM: 10_000, ascentM: 800, startStopId: 'a', endStopId: 'b',
  anchorStopId: null, warnings, ...(transfer ? { transfer: true as const } : {}),
})
const result = (days: ResultDay[]) => ({ ...fx.result, engine: 7, days })
const tooLong = (walkMin: number, pushOn = false): DayWarning => ({ code: 'tooLong', walkMin, capMin: 480, pushOn })
const dark: DayWarning = { code: 'afterDark', arriveMin: 1110, limitMin: 990, sunsetMin: 1050 }

Deno.test('lịch quá sức: chỉ hỏi khi NẶNG thêm, và nói hậu quả của từng ngày', () => {
  const before = result([day(0, []), day(1, [tooLong(560)])])
  const after = result([day(0, [tooLong(700), dark]), day(1, [tooLong(560)])])
  assertEquals(addedStrain(before, after), [
    'Ngày 1: đi bộ 11 giờ 40, quá 8 giờ — dễ đuối sức, dễ chấn thương.',
    'Ngày 1: tới nơi 18:30, sau giờ an toàn 16:30 — phải đi trong tối.',
    'Ngày 2: đi bộ 9 giờ 20, quá 8 giờ — dễ đuối sức, dễ chấn thương.',
  ])
  assertEquals(addedStrain(after, after), null)
  // Lố thêm vài phút do tính lại không phải "nặng thêm"; lố thêm hẳn một giờ thì phải.
  assertEquals(addedStrain(before, result([day(0, []), day(1, [tooLong(570)])])), null)
  assert(addedStrain(before, result([day(0, []), day(1, [tooLong(620)])])) != null)
  // Lố ít mà vẫn kịp trước tối (pushOn) không tính là quá sức.
  assertEquals(addedStrain(before, result([day(0, [tooLong(500, true)]), day(1, [tooLong(560)])])), null)
  // Có Ngày 0 (xe tối hôm trước): đếm ngày như dòng thời gian.
  assertEquals(addedStrain(null, result([day(0, [], true), day(1, [dark])])), [
    'Ngày 1: tới nơi 18:30, sau giờ an toàn 16:30 — phải đi trong tối.',
  ])
})

Deno.test('sau một điểm "Nghỉ đêm ở đây" không còn chỗ thả trong ngày của nó — đêm đó khép ngày', () => {
  const w = (id: string, rest = false) => makeWaypoint({ id, kind: 'custom', lat: 22.5, lon: 103.6, name: id, rest })
  const rows: Row[] = [
    { type: 'day', day: day(0, []) },
    { type: 'stop', wp: w('A'), index: 0, info: null },
    { type: 'stop', wp: w('R', true), index: 1, info: null },
    { type: 'day', day: day(1, []) },
    { type: 'stop', wp: w('B'), index: 2, info: null },
  ]
  assertEquals(dayLayout(rows).slots.map((s) => `${s.index}/${s.day}@${s.anchor}`), ['0/0@wp:A', '1/0@wp:R', '2/1@wp:B', '3/1@null'])
})

Deno.test('"Dời sang ngày sau": điểm tới muộn sang hôm sau, bỏ giờ muộn đã đặt; điểm sau nó cũng sang theo', () => {
  const d = setArriveAtTest(plan(['A', 'B', 'C', 'D'], [undefined, 0, 0, 1]), 'C', 23 * 60 + 35)
  const next = pushToNextDay(d, new Map([['A', 0], ['B', 0], ['C', 0], ['D', 1]]), 'C')
  assertEquals(ids(next), ['A', 'B', 'C', 'D'])
  assertEquals(daysOf(next), [0, 0, 1, 1])
  assertEquals(next.waypoints[2].arriveAt, undefined)
  // Điểm máy chèn (điểm bắt đầu leo nằm giữa B và C): thêm một đêm vào khoảng đó.
  const auto = { ...plan(['A', 'B', 'C']), autoTimes: { 'trailhead:B>C': { arriveAt: 23 * 60 } } }
  const pushed = pushAutoToNextDay(auto, new Map([['A', 0], ['B', 0], ['C', 0]]), 'C', 'trailhead:B>C', new Set(['trailhead:B>C']))
  assertEquals(daysOf(pushed), [0, 0, 1])
  assertEquals(pushed.autoTimes, undefined)
})

function setArriveAtTest(doc: PlanDoc, id: string, at: number): PlanDoc {
  return { ...doc, waypoints: doc.waypoints.map((w) => (w.id === id ? { ...w, arriveAt: at } : w)) }
}

Deno.test('giờ có mặt muộn: chỉ hỏi khi giờ đó sau giờ an toàn VÀ điểm nằm trên đường đi bộ của ngày', () => {
  const stop = (p: Partial<ResultStop>): ResultStop => ({
    id: 'X', kind: 'custom', ref: null, name: 'X', latE6: 0, lonE6: 0, eleM: null, day: 0, etaMin: 1400, rest: false,
    restSource: null, inserted: false, poiId: null, waypointIndex: 1, afterWaypointIndex: 1, leaveByMin: null, targetMin: 1415,
    zone: null, ...p,
  })
  const leg = (from: string, to: string, transport: ResultLeg['transport']): ResultLeg => ({ ...fx.result.legs[0], from, to, transport })
  const walkIn = [leg('P', 'X', 'walk')]
  const r = (warnings: DayWarning[], s: ResultStop, legs: ResultLeg[] = walkIn) => ({ ...result([day(0, warnings)]), stops: [s], legs })
  const at = (res: PlanResult) => lateArrivalOf(res, (s) => s.id === 'X')
  // Đi bộ tới (trên cung trek, xuống tới chân núi): hỏi.
  const late = at(r([dark], stop({})))
  assert(late != null)
  assertEquals(late.stop.targetMin, 1415)
  // Đi xe tới rồi leo tiếp ngay trong ngày (điểm bắt đầu leo): hỏi.
  assert(at(r([dark], stop({}), [leg('P', 'X', 'vehicle'), leg('X', 'Q', 'walk')])) != null)
  // Đi xe tới, không đi bộ tiếp (khách sạn cuối ngày), dù ngày có đi bộ trong tối: không hỏi.
  assertEquals(at(r([dark], stop({}), [leg('P', 'X', 'vehicle')])), null)
  // Đi xe tới, ngủ ở đó — sáng mai mới leo: không hỏi.
  assertEquals(at(r([dark], stop({ rest: true }), [leg('P', 'X', 'vehicle'), leg('X', 'Q', 'walk')])), null)
  // Chỉ đi xe trong tối (driveAfterDark): không hỏi.
  assertEquals(at(r([{ code: 'driveAfterDark', arriveMin: 1415, sunsetMin: 1050 }], stop({}))), null)
  // Giờ đặt trước giờ an toàn: không hỏi.
  assertEquals(at(r([dark], stop({ targetMin: 900 }))), null)
  // Chưa đặt giờ (targetMin null): không hỏi.
  assertEquals(at(r([dark], stop({ targetMin: null }))), null)
})

Deno.test('sửa giờ xuất phát: bỏ giờ có mặt mà giờ đó quyết — tới hết chỗ ngủ hoặc điểm có giờ xuất phát kế tiếp', () => {
  // Ngày 0: p0 → điểm bắt đầu leo (máy chèn) → p1 → p2 (ngủ). Ngày 1: p3 → p4.
  const st = (id: string, day: number, extra: Partial<ResultStop> = {}): ResultStop => ({
    id, kind: 'custom', ref: null, name: id, latE6: 0, lonE6: 0, eleM: null, day, etaMin: 600, rest: false,
    restSource: null, inserted: false, poiId: null, waypointIndex: -1, afterWaypointIndex: 0, leaveByMin: null,
    targetMin: null, zone: null, ...extra,
  })
  const res = (stops: ResultStop[]): PlanResult => ({ ...fx.result, engine: 7, stops })
  const head = st('trailhead:5', 0, { inserted: true, trailhead: true, timeKey: 'trailhead:p0>p1' })
  const r = res([st('p0', 0), head, st('p1', 0), st('p2', 0, { rest: true }), st('p3', 1), st('p4', 1)])
  const base = plan(['p0', 'p1', 'p2', 'p3', 'p4'])
  const arrive = (d: PlanDoc, ids: string[]) =>
    ({ ...d, waypoints: d.waypoints.map((w) => (ids.includes(w.id) ? { ...w, arriveAt: 23 * 60 + 35 } : w)) })
  const doc: PlanDoc = {
    ...arrive(base, ['p1', 'p2', 'p3', 'p4']),
    autoTimes: { 'trailhead:p0>p1': { arriveAt: 15 * 60 + 46 } },
  }
  const set = (d: PlanDoc) => d.waypoints.filter((w) => w.arriveAt !== undefined).map((w) => w.id)

  // Điểm đầu (ca của chủ sản phẩm: Điểm 1 sửa 04:00 mà điểm bắt đầu leo vẫn 15:46).
  const first = clearArrivalsAfter(doc, r, { kind: 'first' })
  assertEquals(set(first), ['p3', 'p4'])
  assertEquals(first.autoTimes, undefined)
  // Điểm có giờ xuất phát riêng chặn đường lan: giờ tới của NÓ vẫn bị bỏ, sau nó thì không.
  const held = { ...doc, waypoints: doc.waypoints.map((w) => (w.id === 'p1' ? { ...w, departAt: 13 * 60 } : w)) }
  assertEquals(set(clearArrivalsAfter(held, r, { kind: 'first' })), ['p2', 'p3', 'p4'])
  // Điểm máy chèn có cả hai giờ: mất giờ có mặt, giữ giờ xuất phát — và chặn đường lan.
  const both: PlanDoc = { ...doc, autoTimes: { 'trailhead:p0>p1': { arriveAt: 15 * 60 + 46, departAt: 16 * 60 } } }
  const fromStart = clearArrivalsAfter(both, r, { kind: 'first' })
  assertEquals(fromStart.autoTimes, { 'trailhead:p0>p1': { departAt: 16 * 60 } })
  assertEquals(set(fromStart), ['p1', 'p2', 'p3', 'p4'])
  // Giờ đi sáng hôm sau ở chỗ ngủ: quyết ngày hôm sau.
  assertEquals(set(clearArrivalsAfter(doc, r, { kind: 'wp', id: 'p2' })), ['p1', 'p2'])
  // Điểm giữa ngày: tới hết chỗ ngủ.
  assertEquals(set(clearArrivalsAfter(doc, r, { kind: 'wp', id: 'p1' })), ['p1', 'p3', 'p4'])
  // Điểm máy chèn.
  assertEquals(set(clearArrivalsAfter(doc, r, { kind: 'auto', key: 'trailhead:p0>p1' })), ['p3', 'p4'])
  // Chưa có kết quả, hay không có gì để bỏ: trả lại đúng doc.
  assertStrictEquals(clearArrivalsAfter(doc, null, { kind: 'first' }), doc)
  assertStrictEquals(clearArrivalsAfter(base, r, { kind: 'first' }), base)
  // Có chuyến xe tối hôm trước: giờ đi của điểm đầu quyết ngày bắt đầu ở chỗ ngủ sau chuyến xe.
  const ride = res([
    st('p0', 0),
    st('transfer:3', 0, { rest: true, inserted: true, transfer: true, timeKey: 'transfer' }),
    st('p1', 1),
    st('p2', 1, { rest: true }),
    st('p3', 2),
  ])
  const nightDoc: PlanDoc = { ...arrive(base, ['p1', 'p3']), autoTimes: { transfer: { arriveAt: 22 * 60 } } }
  const afterRide = clearArrivalsAfter(nightDoc, ride, { kind: 'first' })
  assertEquals(set(afterRide), ['p3'])
  assertEquals(afterRide.autoTimes, { transfer: { arriveAt: 22 * 60 } })
})

Deno.test('giờ xuất phát đã đặt mà nay tới nơi muộn hơn (điểm trước dời muộn): bỏ, về "Hệ thống tự tính"; hoàn tác thì về lại', () => {
  const st = (id: string, extra: Partial<ResultStop>): ResultStop => ({
    id, kind: 'custom', ref: null, name: id, latE6: 0, lonE6: 0, eleM: null, day: 0, etaMin: 600, rest: false,
    restSource: null, inserted: false, poiId: null, waypointIndex: -1, afterWaypointIndex: 0, leaveByMin: null,
    targetMin: null, zone: null, ...extra,
  })
  const base = plan(['p0', 'p1', 'p2', 'p3'])
  const doc: PlanDoc = {
    ...base,
    waypoints: base.waypoints.map((w) =>
      w.id === 'p1' ? { ...w, departAt: 9 * 60 } : w.id === 'p2' ? { ...w, departAt: 6 * 60, rest: true } : w
    ),
    // Chân núi (máy chèn) đặt đi 09:15.
    autoTimes: { 'trailhead:p0>p1': { departAt: 9 * 60 + 15 } },
  }
  const res = (stops: ResultStop[]): PlanResult => ({ ...fx.result, engine: 7, stops })
  // Điểm 1 dời muộn: tới chân núi 10:16, tới p1 lúc 11:00 — cả hai giờ đặt sẵn đã trễ.
  const late = res([
    st('p0', { departMin: 360 }),
    st('trailhead:4', { inserted: true, trailhead: true, timeKey: 'trailhead:p0>p1', etaMin: 616, departMin: 616 }),
    st('p1', { etaMin: 660, departMin: 660 }),
    // Chỗ ngủ: giờ đặt là giờ đi sáng hôm sau — giữ, kể cả khi số trong kết quả khác.
    st('p2', { rest: true, departMin: 420, etaMin: 900 }),
    st('p3', { departMin: null }),
  ])
  const cleaned = dropLateDepartures(doc, late)
  assertEquals(cleaned.autoTimes, undefined)
  assertEquals(cleaned.waypoints.map((w) => w.departAt), [undefined, undefined, 6 * 60, undefined])
  // Vẫn kịp (chờ tới giờ đặt): giữ nguyên, trả lại đúng doc.
  const onTime = res([
    st('p0', { departMin: 300 }),
    st('trailhead:4', { inserted: true, trailhead: true, timeKey: 'trailhead:p0>p1', etaMin: 500, departMin: 555, waitMin: 55 }),
    st('p1', { etaMin: 530, departMin: 540, waitMin: 10 }),
    st('p2', { rest: true, departMin: 360 }),
    st('p3', { departMin: null }),
  ])
  assertStrictEquals(dropLateDepartures(doc, onTime), doc)
  // Máy sửa thẳng vào bước hiện tại: hoàn tác lần dời điểm trước thì giờ đặt sẵn về cùng.
  const h = commit(initHistory(base), doc)
  const fixed = replacePresent(h, cleaned)
  assertEquals(fixed.past, h.past)
  assertStrictEquals(undo(fixed).present, base)
  assertStrictEquals(replacePresent(h, h.present), h)
})
