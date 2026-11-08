// Mọi ngôn ngữ phải có ĐỦ khoá của bản tiếng Việt, cùng số phần tử mảng và cùng bộ
// biến `{tên}` — thiếu một biến là câu hiện ra "{n}" trần trước mắt người dùng.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { LOCALES, localizedPath, splitLocale } from '../../src/i18n/locales.ts'
import { alternatesOf } from '../../src/i18n/seo.ts'
import { fill } from '../../src/i18n/text.ts'
import { vi } from '../../src/i18n/messages/vi.ts'

type Json = string | Json[] | { [k: string]: Json }

/** Mọi lá của cây câu chữ: đường dẫn → chuỗi. Mảng được đánh chỉ số. */
function leaves(node: Json, path = ''): Map<string, string> {
  const out = new Map<string, string>()
  if (typeof node === 'string') out.set(path, node)
  else if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${path}[${i}]`).forEach((s, k) => out.set(k, s)))
  else for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k).forEach((s, p) => out.set(p, s))
  return out
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const source = leaves(vi as unknown as Json)

for (const locale of LOCALES.filter((l) => l !== 'vi')) {
  Deno.test(`ngôn ngữ ${locale}: đủ khoá, đủ biến, không để trống`, async () => {
    const mod = await import(`../../src/i18n/messages/${locale}.ts`)
    const got = leaves(mod.default as Json)
    assertEquals([...got.keys()].sort(), [...source.keys()].sort())
    for (const [k, vi] of source) {
      const s = got.get(k)!
      assert(s.trim().length > 0, `${locale}.${k} để trống`)
      assertEquals(vars(s), vars(vi), `${locale}.${k}: lệch biến {…}`)
    }
  })
}

Deno.test('tách / ghép tiền tố ngôn ngữ', () => {
  assertEquals(splitLocale('/ja/map'), { locale: 'ja', path: '/map' })
  assertEquals(splitLocale('/ja'), { locale: 'ja', path: '/' })
  assertEquals(splitLocale('/ja/'), { locale: 'ja', path: '/' })
  assertEquals(splitLocale('/map'), { locale: 'vi', path: '/map' })
  assertEquals(splitLocale('/xx/map'), { locale: 'vi', path: '/xx/map' })
  // Tiếng Việt chỉ có một địa chỉ: /vi/… không phải là một ngôn ngữ.
  assertEquals(splitLocale('/vi/map'), { locale: 'vi', path: '/vi/map' })
  assertEquals(localizedPath('vi', '/map'), '/map')
  assertEquals(localizedPath('en', '/'), '/en/')
  assertEquals(localizedPath('en', '/map?trail=x'), '/en/map?trail=x')
})

Deno.test('hreflang: đủ mọi ngôn ngữ + x-default, địa chỉ tuyệt đối', () => {
  const alts = alternatesOf('/map')
  assertEquals(alts.length, LOCALES.length + 1)
  assertEquals(alts.find((a) => a.hreflang === 'vi')?.href, 'https://www.waytrek.site/map')
  assertEquals(alts.find((a) => a.hreflang === 'zh-Hans')?.href, 'https://www.waytrek.site/zh/map')
  assertEquals(alts.find((a) => a.hreflang === 'x-default')?.href, 'https://www.waytrek.site/en/map')
})

Deno.test('fill điền biến, thiếu biến thì để nguyên', () => {
  assertEquals(fill('{n} peaks', { n: 78 }), '78 peaks')
  assertEquals(fill('{a} {b}', { a: 'x' }), 'x {b}')
})
