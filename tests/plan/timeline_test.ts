import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { relocateWaypoint, updateWaypoint } from '../../src/plan/core/doc.ts'
import { decodePolyline } from '../../src/plan/core/polyline.ts'
import { eleAt, pointAlong, profileGeometry, stopOffsets } from '../../src/plan/core/profile.ts'
import { transportChoiceShown, buildTimeline, drawLines, resultSegments } from '../../src/plan/core/timeline.ts'
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
