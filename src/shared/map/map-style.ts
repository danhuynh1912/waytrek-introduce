// Style gốc của bản đồ (bản tự host, `MapConfig.styleUrl` của app) — tải một
// lần mỗi phiên, hai bản Sáng/Tối dựng từ nó (core/relief-style.ts). Hỏng thì
// quên lời hứa để lần sau tải lại được.

import { MAP_STYLE_URL } from '../config'

export type StyleJson = Record<string, unknown> & { layers: unknown[] }

let baseP: Promise<StyleJson> | null = null

export function loadBaseStyle(): Promise<StyleJson> {
  baseP ??= (async () => {
    const res = await fetch(MAP_STYLE_URL, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`style HTTP ${res.status}`)
    const json = (await res.json()) as StyleJson
    if (!json || !Array.isArray(json.layers)) throw new Error('style không hợp lệ')
    return json
  })().catch((e) => {
    baseP = null
    throw e
  })
  return baseP
}
