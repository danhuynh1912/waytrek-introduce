import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { dismissAutoStop, isTailTrim, patchSettings, relocateWaypoint, removeWaypoint, setArriveAt, setDepartAt, updateWaypoint } from '../../src/plan/core/doc.ts'
import { decodePolyline } from '../../src/plan/core/polyline.ts'
import { pickTapHit } from '../../src/plan/core/snap.ts'
import { dayNote } from '../../src/plan/core/warnings.ts'
import { eleAt, pointAlong, profileGeometry, stopOffsets } from '../../src/plan/core/profile.ts'
import { transportChoiceShown, buildTimeline, drawLines, isRestSuggestion, resultSegments, withoutRestSuggestions } from '../../src/plan/core/timeline.ts'
import type { PlanDoc, PlanResult } from '../../src/plan/core/types.ts'

// Kết quả THẬT của `trip-plan` đã deploy (24/10): Kỳ Quan San đi–về, đi xe sang
// Lảo Thẩn, một điểm tự chấm ngoài lối. Có 3 lán tự chèn, 4 ngày.
const fx = JSON.parse(await Deno.readTextFile(new URL('./fixtures/kqs_laothan.json', import.meta.url))) as {
  doc: PlanDoc
  result: PlanResult
}

const shape = (rows: ReturnType<typeof buildTimeline>['rows']) =>
  rows.map((r) => {
    if (r.type === 'day') return `day${r.day.index}`
    if (r.type === 'dayStart') return `start${r.day.index}`
    if (r.type === 'stop') return `stop:${r.wp.id}`
    if (r.type === 'auto') return `auto:${r.stop.name}<${r.afterWaypointId}`
    return r.leg ? `leg${r.toggleFor ? '*' : ''}` : 'pending'
  })

Deno.test('kết quả khớp doc: mọi đoạn mượn được, ngày mở đúng sau điểm nghỉ', () => {
  const t = buildTimeline(fx.doc, fx.result, fx.doc)
  assertEquals(t.pending, false)
  assertEquals(shape(t.rows), [
    'day0', 'stop:a', 'leg*', 'auto:Lán nghỉ<a', 'day1', 'start1', 'leg', 'stop:b', 'leg*', 'auto:Lán nghỉ<b',
    'day2', 'start2', 'leg', 'stop:c', 'leg*', 'stop:d', 'leg*', 'auto:Lán 2 Lảo Thẩn<d', 'day3', 'start3', 'leg',
    'stop:e', 'leg*', 'stop:f',
  ])
})

Deno.test('đổi tên không làm đoạn nào phải tính lại', () => {
  const doc = updateWaypoint(fx.doc, 'c', { name: 'Bãi xe Sà Phìn' })
  const t = buildTimeline(doc, fx.result, fx.doc)
  assertEquals(t.pending, false)
  const c = t.rows.find((r) => r.type === 'stop' && r.wp.id === 'c')
  assert(c?.type === 'stop' && c.wp.name === 'Bãi xe Sà Phìn' && c.info?.etaMin === 640)
})

Deno.test('kéo một điểm: hai đoạn chạm nó thành "đang tính", phần còn lại giữ nguyên', () => {
  const r = relocateWaypoint(fx.doc, 'e', { lat: 22.611, lon: 103.687, kind: 'custom' })
  assert(r.ok)
  const t = buildTimeline(r.doc, fx.result, fx.doc)
  assertEquals(t.pending, true)
  const s = shape(t.rows)
  assertEquals(s.slice(-3), ['stop:e', 'pending', 'stop:f'])
  assertEquals(s.filter((x) => x === 'pending').length, 2)
  const d = drawLines(r.doc, fx.result, fx.doc)
  assertEquals(d.lines.filter((l) => l.kind === 'pending').length, 2)
  // Lán 2 nằm trong đoạn d→e vừa đổi: không còn vẽ nó như đã chọn.
  assertEquals(d.autos.map((a) => a.stop.name), ['Lán nghỉ', 'Lán nghỉ'])
})

Deno.test('đổi cách đi tới một điểm cũng là đổi đoạn', () => {
  const doc = updateWaypoint(fx.doc, 'd', { transport: 'walk' })
  assertEquals(buildTimeline(doc, fx.result, fx.doc).pending, true)
})

Deno.test('kết quả không khớp doc (khác số điểm) thì không mượn gì', () => {
  const short = { ...fx.doc, waypoints: fx.doc.waypoints.slice(0, 3) }
  assertEquals(resultSegments(short, fx.result).size, 0)
  const t = buildTimeline(fx.doc, null, null)
  assertEquals(shape(t.rows).filter((x) => x === 'pending').length, 5)
})

Deno.test('nét vẽ: đi bộ có lối, đoạn thẳng chưa có lối, chặng xe', () => {
  const d = drawLines(fx.doc, fx.result, fx.doc)
  const kinds = new Set(d.lines.map((l) => l.kind))
  assertEquals([...kinds].sort(), ['route', 'straight', 'vehicle'])
  const veh = d.lines.find((l) => l.kind === 'vehicle')!
  const pts = decodePolyline(veh.encoded!)
  assertEquals(pts.length, 2)
  // Thứ tự [lon, lat] cho GeoJSON; đầu chặng xe là bãi xe Kỳ Quan San.
  assert(Math.abs(pts[0][0] - 103.65832) < 1e-4 && Math.abs(pts[0][1] - 22.52998) < 1e-4)
})

Deno.test('biểu đồ độ cao: đứt ở chặng xe, mốc điểm dừng cộng dồn theo chặng', () => {
  const g = profileGeometry(fx.result, 600, 80)
  assert(g)
  assertEquals(g.line.split('M').filter(Boolean).length, 2)
  assertEquals([g.minEle, g.maxEle], [1064, 2987])
  const off = stopOffsets(fx.result)
  assertEquals(off.length, fx.result.stops.length)
  assertEquals(off[off.length - 1], fx.result.legs.reduce((s, l) => s + l.distanceM, 0))
  assertEquals(eleAt(fx.result, 0), 1064)
  assertEquals(eleAt(fx.result, 30000), null)
})

Deno.test('điểm dọc đường vẽ theo tỉ lệ quãng đường', () => {
  const paths: [number, number][][] = [[[103, 22], [103.01, 22]], [[103.01, 22], [103.03, 22]]]
  const mid = pointAlong(paths, 0.5)!
  assert(Math.abs(mid[0] - 103.015) < 1e-6 && mid[1] === 22)
  assertEquals(pointAlong(paths, 0), [103, 22])
  assertEquals(pointAlong(paths, 2), [103.03, 22])
  assertEquals(pointAlong([], 0.5), null)
})

Deno.test('nút đi bộ / đi xe: ẩn khi cả đoạn đi bộ trên lối mòn đã biết; đoạn xe dài vẫn hiện', () => {
  const leg = (transport: 'walk' | 'vehicle', distanceM: number, knownPct = 100) =>
    ({ ...fx.result.legs[0], transport, distanceM, knownPct })
  // Leo lên lán theo lộ trình WayTrek — tự chọn hay đã chọn đi bộ đều ẩn.
  assertEquals(transportChoiceShown('auto', [leg('walk', 5800)]), false)
  assertEquals(transportChoiceShown('walk', [leg('walk', 5800)]), false)
  // Đi xe 228 km rồi leo: vẫn cho chọn đi bộ (đi bộ xuyên tuyến là có thật).
  assertEquals(transportChoiceShown('auto', [leg('vehicle', 228_000), leg('walk', 5800)]), true)
  // Đoạn đi bộ chưa có lối: cả hai cách đều hợp lý.
  assertEquals(transportChoiceShown('auto', [leg('walk', 3000, 20)]), true)
  // Đã tự chọn đi xe: hiện để đổi lại.
  assertEquals(transportChoiceShown('vehicle', [leg('walk', 5800)]), true)
})

Deno.test('bỏ điểm cuối: tấm kế hoạch giữ nguyên, không phải chờ tính lại', () => {
  const ids = fx.doc.waypoints.map((w) => w.id)
  const trimmed = removeWaypoint(fx.doc, ids[ids.length - 1])
  assert(isTailTrim(fx.doc, trimmed))
  assert(isTailTrim(fx.doc, removeWaypoint(trimmed, ids[ids.length - 2])))
  // Đổi tên kế hoạch không đụng tới giờ / đường.
  assert(isTailTrim(fx.doc, { ...trimmed, title: 'Khác' }))
  // Bỏ / dời điểm GIỮA, đổi thiết lập: phải tính lại.
  assert(!isTailTrim(fx.doc, removeWaypoint(fx.doc, ids[1])))
  const w1 = fx.doc.waypoints[1]
  const moved = relocateWaypoint(fx.doc, w1.id, { lat: w1.latE6 / 1e6 + 0.01, lon: w1.lonE6 / 1e6, kind: w1.kind, ref: w1.ref })
  assert(moved.ok)
  assert(!isTailTrim(fx.doc, removeWaypoint(moved.doc, ids[ids.length - 1])))
  assert(!isTailTrim(fx.doc, patchSettings(trimmed, { pace: fx.doc.pace + 0.1 })))
  assert(!isTailTrim(fx.doc, dismissAutoStop(trimmed, 'lan-khac')))
  assert(!isTailTrim(fx.doc, setDepartAt(trimmed, ids[1], 600)))
  // Điểm bị bỏ hẹn giờ có mặt (có thể là mốc giờ đi của cả ngày), hay điểm cuối
  // mới có giờ xuất phát (thôi được tính): giờ các điểm còn lại đổi theo.
  const last = ids[ids.length - 1]
  const anchored = setArriveAt(fx.doc, last, 600)
  assert(!isTailTrim(anchored, removeWaypoint(anchored, last)))
  const held = setDepartAt(fx.doc, ids[ids.length - 2], 600)
  assert(!isTailTrim(held, removeWaypoint(held, last)))
  // Không bớt gì, bớt sạch: không phải.
  assert(!isTailTrim(fx.doc, fx.doc))
  assert(!isTailTrim(fx.doc, { ...fx.doc, waypoints: [] }))
  // Mọi đoạn còn lại vẫn mượn được của lần tính trước.
  assertEquals(buildTimeline(trimmed, fx.result, fx.doc).pending, false)
})

Deno.test('tới muộn hơn giờ xuất phát đã đặt: không cảnh báo — giờ đi ở đó thành dự tính (26/10)', () => {
  assertEquals(dayNote({ code: 'departLate', stopId: 'b', departAtMin: 420, etaMin: 455 }, () => 'Chùa Đồng'), null)
})

Deno.test('mã cảnh báo lạ (engine mới hơn bản web) bị bỏ qua, không làm sập danh sách', () => {
  const unknown = { code: 'fromTheFuture', stopId: 'x' } as unknown as Parameters<typeof dayNote>[0]
  assertEquals(dayNote(unknown), null)
})

Deno.test('chạm bản đồ: đỉnh thắng POI sát nó dù POI gần ngón tay hơn; cùng loại thì gần nhất', () => {
  assertEquals(pickTapHit([['Yên Tử', 15], ['Đỉnh khác', 9]], [['Chùa Đồng', 2]]), { peak: 'Đỉnh khác', poi: null })
  assertEquals(pickTapHit([], [['Lán A', 12], ['Lán B', 4]]), { peak: null, poi: 'Lán B' })
  assertEquals(pickTapHit([], []), null)
})

Deno.test('ẩn gợi ý chỗ nghỉ: bỏ lán tự chọn / vùng nên nghỉ và dòng "Xuất phát" từ đó; điểm cho biết giờ giữ nguyên', () => {
  const base = { kind: 'custom', ref: null, latE6: 0, lonE6: 0, eleM: null, day: 0, etaMin: 0, restSource: null, poiId: null, waypointIndex: -1, afterWaypointIndex: 0, leaveByMin: null, targetMin: null, departMin: null, waitMin: 0, zone: null, offTrailM: null }
  const stop = (id: string, extra: Record<string, unknown>) => ({ ...base, id, name: id, rest: false, inserted: true, ...extra }) as unknown as PlanResult['stops'][number]
  const lan = stop('auto:lan', { rest: true, restSource: 'auto', kind: 'poi' })
  const zone = stop('zone:9', { rest: true, restSource: 'auto', zone: { line: '', fromM: 0, toM: 1, water: false, refName: 'x', refFromM: 0, refToM: 1 } })
  const head = stop('trailhead:3', { trailhead: true })
  const night = stop('transfer:2', { rest: true, restSource: 'auto', transfer: true })
  const mine = stop('wp:b', { rest: true, restSource: 'user', inserted: false, waypointIndex: 1 })
  assertEquals([lan, zone, head, night, mine].map(isRestSuggestion), [true, true, false, false, false])
  const day = (index: number, startStopId: string) => ({ index, startStopId }) as unknown as PlanResult['days'][number]
  const leg = (from: string, to: string) => ({ type: 'leg', leg: { from, to }, toggleFor: null })
  const rows = [
    { type: 'auto', stop: head, afterWaypointId: 'a' },
    leg(head.id, lan.id),
    { type: 'auto', stop: lan, afterWaypointId: 'a' },
    { type: 'day', day: day(1, lan.id) },
    { type: 'dayStart', day: day(1, lan.id) },
    leg(lan.id, zone.id),
    { type: 'auto', stop: zone, afterWaypointId: 'a' },
    { type: 'day', day: day(2, zone.id) },
    { type: 'dayStart', day: day(2, zone.id) },
    { type: 'auto', stop: night, afterWaypointId: 'a' },
  ] as Parameters<typeof withoutRestSuggestions>[0]
  const left = withoutRestSuggestions(rows)
  assertEquals(left.map((r) => r.type === 'auto' ? r.stop.id : r.type), ['trailhead:3', 'leg', 'day', 'leg', 'day', 'transfer:2'])
  // Chặng tới / từ chỗ đã ẩn: còn số liệu, thôi vẽ đường dọc (không nối tới điểm nào).
  assertEquals(left.filter((r) => r.type === 'leg').map((r) => r.type === 'leg' && r.detached), [true, true])
  // Không có gì để ẩn: trả lại nguyên danh sách.
  const none = rows.filter((r) => (r.type !== 'auto' || !isRestSuggestion(r.stop)) && r.type !== 'dayStart' && r.type !== 'leg')
  assert(withoutRestSuggestions(none) === none)
})
