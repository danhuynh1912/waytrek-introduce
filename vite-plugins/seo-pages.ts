// Bước build: dựng trang tĩnh THEO NGÔN NGỮ + sitemap có hreflang.
//
// Vì sao cần: waytrek.site là SPA, mọi đường dẫn trả về cùng một index.html.
// Googlebot có chạy JS, nhưng trình xem trước link (Facebook, Zalo, LINE,
// KakaoTalk, Slack, WhatsApp…) và nhiều crawler thì KHÔNG — chúng chỉ đọc <head>
// tĩnh. Nên mỗi (ngôn ngữ × trang) có một file HTML với đúng title, mô tả,
// canonical, hreflang, og:locale và dữ liệu có cấu trúc của ngôn ngữ đó. Thân
// trang vẫn do React dựng; sau khi chạy, `usePageMeta` ghi lại đúng bộ thẻ này
// (cùng `buildHead`), nên hai bên không lệch nhau.
//
// Các trang động (`/trail/<id>`, `/t/<token>`) không có file riêng: chúng rơi về
// index.html như trước và tự khai thẻ lúc chạy.

import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { LOCALES, LOCALE_INFO, DEFAULT_LOCALE, fontHref, localizedPath } from '../src/i18n/locales.ts'
import type { Locale } from '../src/i18n/locales.ts'
import { SITE, absoluteUrl, alternatesOf, buildHead } from '../src/i18n/seo.ts'
import { homeBody, mapBody } from '../src/i18n/static-body.ts'
import type { StaticTrail } from '../src/i18n/static-body.ts'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../src/shared/config.ts'
import { vi } from '../src/i18n/messages/vi.ts'
import type { Messages } from '../src/i18n/messages/vi.ts'
import en from '../src/i18n/messages/en.ts'
import ja from '../src/i18n/messages/ja.ts'
import ko from '../src/i18n/messages/ko.ts'
import zh from '../src/i18n/messages/zh.ts'
import th from '../src/i18n/messages/th.ts'
import lo from '../src/i18n/messages/lo.ts'
import my from '../src/i18n/messages/my.ts'
import id from '../src/i18n/messages/id.ts'
import ms from '../src/i18n/messages/ms.ts'

const MESSAGES: Record<Locale, Messages> = { vi, en, ja, ko, zh, th, lo, my, id, ms }

interface PageSpec {
  /** Đường dẫn không tiền tố. */
  path: string
  /** Tên file tĩnh (không tiền tố ngôn ngữ): trang chủ là thư mục (`/en/`), trang con là `.html` (`/en/map`, không đuôi, không chuyển hướng). */
  file: string
  title: (m: Messages) => string
  description: (m: Messages) => string
  structuredData: boolean
  /** Thân trang tĩnh trong #root (xem `static-body.ts`). */
  body: (locale: Locale, m: Messages, trails: readonly StaticTrail[]) => string
}

const PAGES: PageSpec[] = [
  { path: '/', file: 'index.html', title: (m) => m.seo.home.title, description: (m) => m.seo.home.description, structuredData: true, body: (l, m, t) => homeBody(l, m, t.length || null) },
  { path: '/map', file: 'map.html', title: (m) => m.seo.map.title, description: (m) => m.seo.map.description, structuredData: false, body: (l, m, t) => mapBody(l, m, t) },
]

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** JSON-LD an toàn trong <script>: không cho `</script>` hay `<!--` thoát ra. */
const jsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c')

/** Thẻ <head> của một (ngôn ngữ × trang), đọc từ cùng `buildHead` với trình duyệt. */
function headBlock(locale: Locale, page: PageSpec): string {
  const m = MESSAGES[locale]
  const title = page.title(m)
  const description = page.description(m)
  const h = buildHead({ locale, path: page.path, title, description })
  const lines = [`<title>${esc(h.title)}</title>`]
  for (const t of h.meta) lines.push(`<meta ${t.attr}="${esc(t.key)}" content="${esc(t.content)}" />`)
  if (h.canonical) lines.push(`<link rel="canonical" href="${esc(h.canonical)}" />`)
  for (const a of h.alternates) lines.push(`<link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}" />`)
  const font = LOCALE_INFO[locale].font
  if (font) lines.push(`<link rel="stylesheet" href="${esc(fontHref(font.query))}" />`)
  if (page.structuredData) {
    const tag = LOCALE_INFO[locale].tag
    lines.push(
      `<script type="application/ld+json">${jsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'WayTrek', inLanguage: tag },
          {
            '@type': 'MobileApplication',
            name: 'WayTrek',
            url: absoluteUrl(locale, '/'),
            description,
            operatingSystem: 'iOS, Android',
            applicationCategory: 'TravelApplication',
            image: `${SITE}/icon-512.png`,
            inLanguage: tag,
          },
        ],
      })}</script>`,
    )
  }
  return lines.map((l) => `    ${l}`).join('\n')
}

/** Mẫu index.html đã build → trang của một (ngôn ngữ × trang). Mẫu đổi hình mà regex không khớp thì BUILD HỎNG (không im lặng sinh trang thiếu thẻ). */
export function renderPage(template: string, locale: Locale, page: PageSpec, trails: readonly StaticTrail[] = []): string {
  let html = template
  const must = (re: RegExp, what: string): void => {
    if (!re.test(html)) throw new Error(`seo-pages: index.html không có ${what} — mẫu đã đổi?`)
  }
  must(/<html lang="[^"]*"/, '<html lang>')
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${LOCALE_INFO[locale].tag}"`)
  must(/<title>[\s\S]*?<\/title>/, '<title>')
  html = html.replace(/\s*<title>[\s\S]*?<\/title>/, '')
  // Các thẻ phụ thuộc trang / ngôn ngữ do `headBlock` viết lại; thẻ còn lại (og:image, og:type…) giữ nguyên.
  html = html
    .replace(/\s*<meta name="description"[^>]*>/g, '')
    .replace(/\s*<meta property="og:(?:title|description|url|locale)"[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
  must(/<\/head>/, '</head>')
  html = html.replace('</head>', `${headBlock(locale, page)}\n  </head>`)
  must(/<div id="root"><\/div>/, '<div id="root"></div>')
  return html.replace('<div id="root"></div>', () => `<div id="root">${staticBody(locale, page, trails)}</div>`)
}

/**
 * Thân tĩnh của (ngôn ngữ × trang). Riêng `/` tiếng Việt là `dist/index.html` — file
 * này cũng là đường lui SPA của MỌI đường dẫn không có file riêng (`/trail/<id>`,
 * `/plan`…), nên thân trang chủ phải tự gỡ khi địa chỉ không phải `/` (không để
 * văn bản trang chủ nháy lên trên trang cung trước khi JS chạy).
 */
function staticBody(locale: Locale, page: PageSpec, trails: readonly StaticTrail[]): string {
  const body = page.body(locale, MESSAGES[locale], trails)
  if (locale !== DEFAULT_LOCALE || page.path !== '/') return body
  return `${body}<script>if(location.pathname!=='/'){var s=document.querySelector('.seo-static');s&&s.remove()}</script>`
}

/** Cung công khai lúc build — để có danh sách link ở trang Khám phá và địa chỉ từng cung trong sitemap. Hỏng thì build VẪN chạy (không để Supabase chập chờn chặn deploy) nhưng nói to: thiếu danh sách này là mất SEO của ~70 trang cung. */
async function fetchTrails(): Promise<StaticTrail[]> {
  const cols = 'id,name,region,distance_m,effective_elevation_gain_m,elevation_gain_m,peak_elevation_m,gpx_max_elevation_m,conquest_count'
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/trails_with_default_route?select=${cols}&is_public=eq.true&order=conquest_count.desc.nullslast,name.asc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Accept-Profile': 'waytrek' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = (await res.json()) as Record<string, unknown>[]
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    const out = rows
      .filter((r) => typeof r.id === 'string' && typeof r.name === 'string' && r.name.trim())
      .map((r) => ({
        id: r.id as string,
        name: (r.name as string).trim(),
        region: typeof r.region === 'string' && r.region.trim() ? r.region.trim() : null,
        distanceM: num(r.distance_m),
        gainM: num(r.effective_elevation_gain_m) ?? num(r.elevation_gain_m),
        peakEleM: num(r.peak_elevation_m) ?? num(r.gpx_max_elevation_m),
        conquests: num(r.conquest_count) ?? 0,
      }))
    if (out.length === 0) throw new Error('danh sách rỗng')
    return out
  } catch (e) {
    console.warn(`\n⚠️  seo-pages: KHÔNG lấy được danh sách cung (${e instanceof Error ? e.message : e}) — trang Khám phá tĩnh không có danh sách link, sitemap không có trang cung.\n`)
    return []
  }
}

function sitemap(trails: readonly StaticTrail[]): string {
  const url = (loc: string, extra: string, freq: string, prio: string) =>
    `  <url>\n    <loc>${esc(loc)}</loc>\n${extra}    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`
  const entries: string[] = []
  for (const [i, page] of PAGES.entries()) {
    const links = alternatesOf(page.path)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}" />\n`)
      .join('')
    for (const l of LOCALES) entries.push(url(absoluteUrl(l, page.path), links, i === 0 ? 'monthly' : 'weekly', i === 0 ? (l === DEFAULT_LOCALE ? '1.0' : '0.9') : l === DEFAULT_LOCALE ? '0.9' : '0.8'))
  }
  // Trang từng cung: nội dung (tên, mô tả, truyện) là tiếng Việt, nhưng khung trang đã dịch — vẫn là một bản của mỗi ngôn ngữ.
  for (const t of trails) {
    const links = alternatesOf(`/trail/${t.id}`)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}" />\n`)
      .join('')
    for (const l of LOCALES) entries.push(url(absoluteUrl(l, `/trail/${t.id}`), links, 'monthly', '0.6'))
  }
  // Trang lên kế hoạch chưa dịch: một địa chỉ, không hreflang.
  entries.push(url(`${SITE}/plan`, '', 'monthly', '0.6'))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
}

export function seoPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'waytrek-seo-pages',
    apply: 'build',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir)
    },
    async closeBundle() {
      const templatePath = path.join(outDir, 'index.html')
      const template = fs.readFileSync(templatePath, 'utf8')
      const trails = await fetchTrails()
      for (const locale of LOCALES) {
        for (const page of PAGES) {
          const dir = locale === DEFAULT_LOCALE ? outDir : path.join(outDir, locale)
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(path.join(dir, page.file), renderPage(template, locale, page, trails))
        }
      }
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap(trails))
      // localizedPath chỉ để chắc `/en/` (thư mục) và `/en/map` (không đuôi) khớp tên file đã ghi.
      if (localizedPath('en', '/') !== '/en/' || localizedPath('en', '/map') !== '/en/map') throw new Error('seo-pages: tên file lệch với localizedPath')
    },
  }
}
