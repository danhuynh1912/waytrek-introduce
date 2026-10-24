import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { renderUrl, sizedImage } from '../../src/site/core/images.ts'

const STORAGE = 'https://x.supabase.co/storage/v1/object/public/trail-images/covers/a/b.jpg'

Deno.test('ảnh Storage công khai → render endpoint, cắt cover đúng ô', () => {
  assertEquals(
    renderUrl(STORAGE, 160, 120),
    'https://x.supabase.co/storage/v1/render/image/public/trail-images/covers/a/b.jpg?width=160&height=120&resize=cover&quality=70',
  )
})

Deno.test('giữ dấu đổi ảnh `?v=` của admin, không thì CDN trả ảnh cũ', () => {
  const u = new URL(renderUrl(`${STORAGE}?v=1792862532132`, 76, 76))
  assertEquals(u.searchParams.get('v'), '1792862532132')
  assertEquals(u.searchParams.get('width'), '76')
})

Deno.test('host khác hoặc chuỗi hỏng: trả nguyên, không có srcSet', () => {
  const cdn = 'https://d1ei3xw5e5agtc.cloudfront.net/locations/images/a.jpg'
  assertEquals(renderUrl(cdn, 160, 160), cdn)
  assertEquals(sizedImage(cdn, 76, 76), { src: cdn })
  assertEquals(renderUrl('không phải url', 10, 10), 'không phải url')
})

Deno.test('1x làm src, 2x gấp đôi cạnh; cạnh kẹp trong trần 2500 của endpoint', () => {
  const s = sizedImage(STORAGE, 330, 186)
  assertEquals(s.src, renderUrl(STORAGE, 330, 186))
  assertEquals(s.srcSet, `${renderUrl(STORAGE, 330, 186)} 1x, ${renderUrl(STORAGE, 660, 372)} 2x`)
  assertEquals(new URL(renderUrl(STORAGE, 4000, 1600)).searchParams.get('width'), '2500')
})
