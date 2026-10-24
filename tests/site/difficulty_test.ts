import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { boardFromRows, difficultyRankColor, formatDifficultyScore } from '../../src/site/core/difficulty.ts'

Deno.test('điểm độ khó: hai chữ số thập phân, dấu phẩy như app', () => {
  assertEquals(formatDifficultyScore(3.9), '3,90')
  assertEquals(formatDifficultyScore(10.6040316815792), '10,60')
})

Deno.test('màu theo HẠNG như app: dễ nhất xanh lá 140°, khó nhất tím 285°, tối sáng hơn', () => {
  assertEquals(difficultyRankColor(5, 5, false), 'hsl(140 72% 42%)')
  assertEquals(difficultyRankColor(1, 5, false), 'hsl(285 72% 42%)')
  assertEquals(difficultyRankColor(1, 5, true), 'hsl(285 72% 60%)')
  // Một cung duy nhất = khó nhất (t = 1), giống `count <= 1` của app.
  assertEquals(difficultyRankColor(1, 1, false), 'hsl(285 72% 42%)')
})

Deno.test('bảng điểm: bỏ dòng thiếu id / điểm / hạng, không ném', () => {
  const b = boardFromRows([
    { trail_id: 'a', score: 3.9, rank: 2 },
    { trail_id: 'b', score: 'x', rank: 1 },
    { score: 1, rank: 3 },
  ])
  assertEquals([...b.byTrail.keys()], ['a'])
  assertEquals(b.count, 1)
})
