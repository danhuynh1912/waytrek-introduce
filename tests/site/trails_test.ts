import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { DEFAULT_FILTER, difficultyLabel, filterTrails, trailFromRow, trailMeta } from '../../src/site/core/trails.ts'
import type { TrailSummary } from '../../src/site/core/trails.ts'
import { boardFromRows } from '../../src/site/core/difficulty.ts'

const t = (name: string, extra: Partial<TrailSummary> = {}): TrailSummary => ({
  id: name, name, region: null, difficulty: 'moderate', difficultyTitle: null, distanceM: null, gainM: null,
  peakEleM: null, imageUrl: null, conquests: 0, lat: null, lng: null, description: null, ...extra,
})

Deno.test('nhãn độ khó như app; tầng Siêu nhân đọc cột danh xưng', () => {
  assertEquals(difficultyLabel({ difficulty: 'expert', difficultyTitle: null }), 'Chuyên gia')
  assertEquals(difficultyLabel({ difficulty: 'expert', difficultyTitle: 'superhuman' }), 'Siêu nhân')
  assertEquals(difficultyLabel({ difficulty: 'easy', difficultyTitle: null }), 'Dễ')
})

Deno.test('dòng view → cung: độ leo hiệu dụng, ghim ở đỉnh, dòng hỏng thì bỏ', () => {
  const r = trailFromRow({
    id: 'x', name: ' Tà Chì Nhù ', region: 'Trạm Tấu, Yên Bái', difficulty: 'hard', elevation_gain_m: 1900,
    effective_elevation_gain_m: 2063, peak_elevation_m: 2964, conquest_count: 324, peak_lat: 21.57, peak_lng: 104.3,
    center_lat: 1, center_lng: 1, description: '',
  })!
  assertEquals([r.name, r.gainM, r.peakEleM, r.lat, r.lng, r.description], ['Tà Chì Nhù', 2063, 2964, 21.57, 104.3, null])
  assertEquals(trailFromRow({ id: 'y', name: 'Lạ', difficulty: 'wild' })!.difficulty, 'moderate')
  assertEquals(trailFromRow({ name: 'không id' }), null)
})

Deno.test('tìm bỏ dấu cả hai vế, theo tên hoặc vùng; xếp', () => {
  const list = [
    t('Tà Chì Nhù', { region: 'Yên Bái', difficulty: 'hard', conquests: 324, distanceM: 7152, peakEleM: 2964 }),
    t('Yên Tử', { region: 'Quảng Ninh', conquests: 340, distanceM: 13085, peakEleM: 1068 }),
    t('Hàm Lợn', { difficulty: 'easy', conquests: 216 }),
  ]
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, query: 'ta chi' }).map((x) => x.name), ['Tà Chì Nhù'])
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, query: 'quang ninh' }).map((x) => x.name), ['Yên Tử'])
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, query: 'TÀ CHÌ' }).map((x) => x.name), ['Tà Chì Nhù'])
  assertEquals(filterTrails(list, DEFAULT_FILTER).map((x) => x.name), ['Yên Tử', 'Tà Chì Nhù', 'Hàm Lợn'])
  // Thiếu số đo thì đứng cuối, không bị coi là 0.
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, sort: 'short' }).map((x) => x.name), ['Tà Chì Nhù', 'Yên Tử', 'Hàm Lợn'])
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, sort: 'high' }).map((x) => x.name), ['Tà Chì Nhù', 'Yên Tử', 'Hàm Lợn'])
})

Deno.test('dòng số đo: không còn nhãn Dễ/Khó (điểm vẽ riêng); thiếu số nào bỏ số đó, không ghi 0', () => {
  assertEquals(trailMeta(t('A', { difficulty: 'hard', distanceM: 7152, gainM: 2063 })), '7,2 km · ↑2.063 m')
  assertEquals(trailMeta(t('B', { difficulty: 'easy' })), '')
})

Deno.test('xếp theo độ khó dùng điểm của bảng cộng đồng; cung chưa có điểm đứng cuối', () => {
  const list = [t('A'), t('B'), t('C')]
  const board = boardFromRows([
    { trail_id: 'A', score: 3.9, rank: 2 },
    { trail_id: 'B', score: 10.6, rank: 1 },
  ])
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, sort: 'hardest' }, board).map((x) => x.id), ['B', 'A', 'C'])
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, sort: 'easiest' }, board).map((x) => x.id), ['A', 'B', 'C'])
  // Bảng chưa tải: không có điểm nào → giữ thứ tự tên, không ném.
  assertEquals(filterTrails(list, { ...DEFAULT_FILTER, sort: 'hardest' }, null).map((x) => x.id), ['A', 'B', 'C'])
})
