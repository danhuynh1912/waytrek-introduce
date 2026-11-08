// Trang tĩnh theo ngôn ngữ (vite-plugins/seo-pages.ts): đủ thẻ, đúng ngôn ngữ, và
// BUILD HỎNG khi mẫu index.html đổi hình (không âm thầm sinh trang thiếu thẻ).
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { renderPage } from '../../vite-plugins/seo-pages.ts'
import { homeBody, mapBody } from '../../src/i18n/static-body.ts'
import { LOCALES } from '../../src/i18n/locales.ts'
import type { Locale } from '../../src/i18n/locales.ts'
import type { StaticTrail } from '../../src/i18n/static-body.ts'
import { vi } from '../../src/i18n/messages/vi.ts'

const TEMPLATE = `<!doctype html>
<html lang="vi">
  <head>
    <link rel="canonical" href="https://www.waytrek.site/" />
    <meta property="og:image" content="https://www.waytrek.site/icon-512.png" />
    <meta property="og:locale" content="vi_VN" />
    <title>cũ</title>
    <meta name="description" content="cũ" />
  </head>
  <body><div id="root"></div></body>
</html>`

const HOME = {
  path: '/',
  file: 'index.html',
  title: (m: typeof vi) => m.seo.home.title,
  description: (m: typeof vi) => m.seo.home.description,
  structuredData: true,
  body: (l: Locale, m: typeof vi, t: readonly StaticTrail[]) => homeBody(l, m, t.length || null),
}

Deno.test('trang chủ tiếng Nhật: lang, title, canonical, 11 hreflang, JSON-LD', () => {
  const html = renderPage(TEMPLATE, 'ja', HOME)
  assertStringIncludes(html, '<html lang="ja"')
  assertStringIncludes(html, '<title>WayTrek – ベトナムの山')
  assertStringIncludes(html, '<link rel="canonical" href="https://www.waytrek.site/ja/" />')
  assertEquals((html.match(/rel="alternate" hreflang=/g) ?? []).length, 11)
  assertStringIncludes(html, 'hreflang="x-default" href="https://www.waytrek.site/en/"')
  assertStringIncludes(html, 'hreflang="zh-Hans"')
  assertStringIncludes(html, 'application/ld+json')
  // Thẻ cũ bị thay, không nhân đôi; thẻ không phụ thuộc trang (og:image) còn nguyên.
  assertEquals((html.match(/<title>/g) ?? []).length, 1)
  assertEquals((html.match(/rel="canonical"/g) ?? []).length, 1)
  assertEquals((html.match(/property="og:locale" /g) ?? []).length, 1)
  assertStringIncludes(html, 'og:image')
  assert(!html.includes('cũ'))
  // Font Nhật nạp kèm trong trang tĩnh (không chờ JS).
  assertStringIncludes(html, 'Noto+Sans+JP')
})

Deno.test('tiếng Việt không tiền tố', () => {
  const html = renderPage(TEMPLATE, 'vi', HOME)
  assertStringIncludes(html, '<link rel="canonical" href="https://www.waytrek.site/" />')
  assertStringIncludes(html, 'hreflang="vi" href="https://www.waytrek.site/"')
})

Deno.test('ký tự đặc biệt trong mô tả được thoát', () => {
  const html = renderPage(TEMPLATE, 'en', { ...HOME, description: () => 'a "b" <c> & d' })
  assertStringIncludes(html, 'content="a &quot;b&quot; &lt;c&gt; &amp; d"')
})

Deno.test('mẫu thiếu thẻ thì ném lỗi', () => {
  assertThrows(() => renderPage('<html lang="vi"><head></head></html>', 'en', HOME), Error, '<title>')
  assertThrows(() => renderPage('<html><head><title>x</title></head></html>', 'en', HOME), Error, '<html lang>')
})

const TRAILS: StaticTrail[] = [
  { id: 'abc', name: 'Yên Tử', region: 'Quảng Ninh', distanceM: 13100, gainM: 936, peakEleM: 1068, conquests: 636 },
  { id: 'def', name: 'A & B <x>', region: null, distanceM: null, gainM: null, peakEleM: null, conquests: 0 },
]

Deno.test('thân tĩnh trang chủ: văn bản thật của ngôn ngữ, nằm trong #root', () => {
  const html = renderPage(TEMPLATE, 'ja', HOME, TRAILS)
  assertStringIncludes(html, '<div id="root"><main class="seo-static wt-dark">')
  assertStringIncludes(html, '<h1>「山小屋まで あと489m」</h1>')
  // Số cung thật (2) thay cho "約80"; link cửa hàng đúng nước.
  assertStringIncludes(html, '2の山を、')
  assertStringIncludes(html, 'apps.apple.com/jp/')
  assertStringIncludes(html, 'href="/ja/map"')
})

Deno.test('thân tĩnh: chỉ trang chủ TIẾNG VIỆT có chốt tự gỡ (đường lui SPA của mọi địa chỉ khác)', () => {
  assertStringIncludes(renderPage(TEMPLATE, 'vi', HOME), "location.pathname!=='/'")
  assert(!renderPage(TEMPLATE, 'en', HOME).includes('location.pathname'))
})

Deno.test('thân tĩnh Khám phá: danh sách cung có link đúng ngôn ngữ, tên được thoát', () => {
  const map = { ...HOME, path: '/map', file: 'map.html', body: (l: Locale, m: typeof vi, t: readonly StaticTrail[]) => mapBody(l, m, t) }
  const html = renderPage(TEMPLATE, 'en', map, TRAILS)
  assertStringIncludes(html, '<a href="/en/trail/abc">Yên Tử</a> — Quảng Ninh — 13.1 km · ↑936 m · 1,068 m')
  assertStringIncludes(html, '<a href="/en/trail/def">A &amp; B &lt;x&gt;</a>')
  // Không lấy được danh sách → vẫn có tiêu đề + mô tả, không có <ul>.
  const none = renderPage(TEMPLATE, 'en', map, [])
  assertStringIncludes(none, '<h1>Explore peaks</h1>')
  assert(!none.includes('<ul>'))
})

Deno.test('mọi ngôn ngữ dựng được thân tĩnh, không còn {biến} chưa điền', async () => {
  for (const l of LOCALES) {
    const m = (await import(`../../src/i18n/messages/${l}.ts`)) as { default?: typeof vi; vi?: typeof vi }
    const messages = m.default ?? m.vi!
    for (const body of [homeBody(l, messages, null), mapBody(l, messages, TRAILS)]) assert(!/\{\w+\}/.test(body), `${l}: còn biến trong thân tĩnh`)
  }
})
