import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { count } from '../../src/shared/format.ts'

Deno.test('số đếm có dấu chấm ngăn nghìn, làm tròn', () => {
  assertEquals(count(2561), '2.561')
  assertEquals(count(67), '67')
  assertEquals(count(1234567.6), '1.234.568')
})
