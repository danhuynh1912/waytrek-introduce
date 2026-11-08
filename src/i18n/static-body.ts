// Thân trang TĨNH cho máy tìm kiếm — thuần (chuỗi vào, chuỗi ra), chạy lúc build.
//
// React dựng trang ở trình duyệt, nên HTML gốc chỉ có `<div id="root"></div>`:
// crawler không chạy JS (Bing, Naver, Baidu, trình xem trước link…) thấy một trang
// trống. Đây là bản văn bản của chính các khối đó, cùng câu chữ với trang thật
// (`messages/`), bỏ vào `#root` — React gọi `createRoot().render` là thay thế ngay,
// nên người dùng chỉ thấy nó trong khoảnh khắc tải JS (trước đây là màn trống).
//
// Trang Khám phá còn kèm DANH SÁCH CUNG có link thật tới `/trail/<id>` của đúng
// ngôn ngữ: đó là cách duy nhất để crawler không chạy JS đi từ trang này sang
// trang cung (danh sách ở trang thật được vẽ bằng JS sau khi gọi Supabase).

import { playUrlFor, storeUrlFor } from '../shared/links.ts'
import { makeNumberFormat } from '../shared/format.ts'
import { LOCALE_INFO, localizedPath } from './locales.ts'
import type { Locale } from './locales.ts'
import type { Messages } from './messages/vi.ts'
import { fill } from './text.ts'

/** Phần của một cung mà trang tĩnh cần (đủ để viết một dòng danh sách). */
export interface StaticTrail {
  id: string
  name: string
  region: string | null
  distanceM: number | null
  gainM: number | null
  peakEleM: number | null
  conquests: number
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Các dòng của một tiêu đề, nối thành MỘT câu liền mạch (ngôn ngữ không dùng dấu cách như tiếng Thái / Lào cũng đọc được: mỗi dòng đã là một cụm trọn nghĩa). */
const sentence = (...lines: string[]): string => lines.map(esc).join(' ')

export function homeBody(locale: Locale, m: Messages, trailCount: number | null): string {
  const h = m.home
  const n = trailCount == null ? h.peaks.countFallback : makeNumberFormat(LOCALE_INFO[locale].intl).count(trailCount)
  return `<main class="seo-static wt-dark">
<p>${sentence(...h.kicker)}</p>
<h1>${sentence(...h.title)}</h1>
<p>${sentence(...h.tagline)}</p>
<p><a href="${esc(storeUrlFor(locale))}">${esc(h.appStore)}</a> · <a href="${esc(playUrlFor(locale))}">${esc(h.googlePlay)}</a></p>
<section><h2>${esc(h.trail.label)}</h2><p>${esc(h.trail.text)}</p></section>
<section><h2>${sentence(...h.peaks.lines.map((l) => fill(l, { n })), h.peaks.dim)}</h2><p>${esc(fill(h.peaks.text, { n }))}</p><p><a href="${esc(localizedPath(locale, '/map'))}">${esc(h.peaks.link)}</a></p></section>
<section><h2>${sentence(...h.legacy.lines)}</h2><p>${esc(h.legacy.text)}</p></section>
<section><h2>${esc(h.features.label)}</h2><ol>${h.features.items.map((it) => `<li><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p></li>`).join('')}</ol></section>
<section><h2>${sentence(...h.share.lines, h.share.dim)}</h2><p>${esc(h.share.text)}</p></section>
<section><h2>${sentence(...h.cta.lines, h.cta.dim)}</h2><p>${esc(h.cta.text)}</p></section>
</main>`
}

export function mapBody(locale: Locale, m: Messages, trails: readonly StaticTrail[]): string {
  const fmt = makeNumberFormat(LOCALE_INFO[locale].intl)
  const items = trails.map((t) => {
    const facts = [
      t.distanceM != null ? fmt.distance(t.distanceM) : null,
      t.gainM != null ? `↑${fmt.meters(t.gainM)}` : null,
      t.peakEleM != null ? fmt.meters(t.peakEleM) : null,
    ].filter(Boolean).join(' · ')
    const rest = [t.region, facts].filter(Boolean).join(' — ')
    return `<li><a href="${esc(localizedPath(locale, `/trail/${t.id}`))}">${esc(t.name)}</a>${rest ? ` — ${esc(rest)}` : ''}</li>`
  })
  return `<main class="seo-static wt-dark">
<h1>${esc(m.explore.title)}</h1>
<p>${esc(m.seo.map.description)}</p>
${trails.length ? `<p>${esc(fill(m.explore.count, { n: fmt.count(trails.length) }))}</p>\n<ul>${items.join('\n')}</ul>` : ''}
</main>`
}
