import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { appLink, parseSiteRoute, sitePath } from '../../src/site/core/routes.ts'

const T = '526e4311-41f5-4bd0-8943-431a158eebb0'
const R = '3ef98e94-0000-4000-8000-000000000001'

Deno.test('đường dẫn web chép đúng hình dạng deep link của app', () => {
  assertEquals(parseSiteRoute('/'), { page: 'home' })
  assertEquals(parseSiteRoute('/home'), { page: 'home' })
  assertEquals(parseSiteRoute('/map'), { page: 'map', trailId: null })
  assertEquals(parseSiteRoute('/map', `?trail=${T}`), { page: 'map', trailId: T })
  assertEquals(parseSiteRoute(`/trail/${T.toUpperCase()}`), { page: 'trail', trailId: T, routeId: null })
  assertEquals(parseSiteRoute(`/trail/${T}/`, `?route=${R}`), { page: 'trail', trailId: T, routeId: R })
})

Deno.test('link lạ / hỏng không ném, ra trang không tìm thấy', () => {
  assertEquals(parseSiteRoute('/trail/khong-phai-uuid'), { page: 'notFound' })
  assertEquals(parseSiteRoute('/trail/%E0%A4%A'), { page: 'notFound' })
  assertEquals(parseSiteRoute('/map', '?trail=abc'), { page: 'map', trailId: null })
  assertEquals(parseSiteRoute('/gi-do'), { page: 'notFound' })
})

Deno.test('trang → đường dẫn → trang giữ nguyên; nút mở app dùng cùng đường dẫn', () => {
  for (const r of [
    { page: 'home' } as const,
    { page: 'map', trailId: T } as const,
    { page: 'trail', trailId: T, routeId: R } as const,
  ]) {
    const [path, search = ''] = sitePath(r).split('?')
    assertEquals(parseSiteRoute(path, search ? `?${search}` : ''), r)
  }
  assertEquals(appLink({ page: 'trail', trailId: T, routeId: null }), `waytrek://trail/${T}`)
})

Deno.test('link theo dõi chuyến đi: /t/<token 24 ký tự>, giữ nguyên hoa thường', () => {
  const tok = 'AbCdEfGhIjKlMnOpQrSt-_Wx'
  assertEquals(parseSiteRoute(`/t/${tok}`), { page: 'track', token: tok })
  assertEquals(sitePath({ page: 'track', token: tok }), `/t/${tok}`)
  assertEquals(parseSiteRoute('/t/ngan'), { page: 'notFound' })
  assertEquals(parseSiteRoute(`/t/${tok}x`), { page: 'notFound' })
})
