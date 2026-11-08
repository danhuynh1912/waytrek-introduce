// Trang tĩnh theo ngôn ngữ (vite-plugins/seo-pages.ts): đủ thẻ, đúng ngôn ngữ, và
// BUILD HỎNG khi mẫu index.html đổi hình (không âm thầm sinh trang thiếu thẻ).
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { renderPage } from '../../vite-plugins/seo-pages.ts'
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
  <body></body>
</html>`

const HOME = { path: '/', file: 'index.html', title: (m: typeof vi) => m.seo.home.title, description: (m: typeof vi) => m.seo.home.description, structuredData: true }

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
