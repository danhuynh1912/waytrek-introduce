// Link theo dõi chuyến đi cho người thân (WayTrek spec/43 §10.6) — phần THUẦN
// của trang waytrek.site/t/<token>: đọc phản hồi `get_trip_tracker`, câu trạng
// thái, độ cũ của vị trí. Không React, không DOM, không mạng.
//
// Câu chữ chỉ nói điều đã biết (spec/43 §6.2): vị trí mới nhất là LÚC NÀO, chứ
// không suy ra người leo "an toàn" hay "gặp nạn" từ chuyện lâu chưa có vị trí —
// trên núi mất sóng là chuyện thường.

import { decodePolyline } from '../../shared/polyline.ts'
import { clock, shortDate } from '../../shared/format.ts'

export type TrackStatus = 'upcoming' | 'waiting' | 'moving' | 'paused' | 'finished' | 'ended' | 'off'

export interface TrackStop {
  name: string
  lat: number
  lng: number
  day: number
  kind: string
  /** Chỗ ngủ đêm. */
  rest: boolean
}

export interface TrackPosition {
  lat: number
  lng: number
  accuracyM: number | null
  at: Date
  state: 'moving' | 'paused' | 'finished'
}

export interface TrackLine {
  /** [lon, lat] cho bản đồ. */
  coords: [number, number][]
  /** Chặng đi xe — tô màu chặng xe như app. */
  vehicle: boolean
}

export interface TrackView {
  status: TrackStatus
  name: string | null
  title: string | null
  firstDay: string | null
  lastDay: string | null
  lines: TrackLine[]
  stops: TrackStop[]
  position: TrackPosition | null
  /** Giờ MÁY CHỦ lúc trả lời — độ cũ đo theo nó, không theo đồng hồ máy người xem (có thể lệch). */
  serverNow: Date | null
}

const STATUSES: readonly TrackStatus[] = ['upcoming', 'waiting', 'moving', 'paused', 'finished', 'ended', 'off']
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const date = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const day = (v: unknown): string | null => (typeof v === 'string' && ISO_DAY.test(v) ? v : null)

/**
 * Phản hồi của `get_trip_tracker` → dữ liệu của trang. null = link không tồn
 * tại (máy chủ trả null). Trường hỏng thì bỏ trường đó, không ném — một phần
 * tử lạ không được làm trắng cả trang.
 */
export function trackFromRpc(raw: unknown): TrackView | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const status = STATUSES.find((s) => s === r.status)
  if (!status) return null
  const lines: TrackLine[] = []
  for (const d of Array.isArray(r.draw) ? r.draw : []) {
    const line = (d as Record<string, unknown> | null)?.line
    if (typeof line !== 'string' || line === '') continue
    const coords = decodePolyline(line)
    if (coords.length < 2) continue
    lines.push({ coords, vehicle: (d as Record<string, unknown>).kind === 'vehicle' })
  }
  const stops: TrackStop[] = []
  for (const s of Array.isArray(r.stops) ? r.stops : []) {
    const o = (s ?? {}) as Record<string, unknown>
    const lat = num(o.lat)
    const lng = num(o.lng)
    if (lat == null || lng == null) continue
    stops.push({
      name: str(o.name) ?? '',
      lat,
      lng,
      day: num(o.day) ?? 0,
      kind: str(o.kind) ?? 'custom',
      rest: o.rest === true,
    })
  }
  let position: TrackPosition | null = null
  const p = (r.position ?? null) as Record<string, unknown> | null
  if (p && typeof p === 'object') {
    const lat = num(p.lat)
    const lng = num(p.lng)
    const at = date(p.at)
    const state = p.state === 'paused' || p.state === 'finished' ? p.state : 'moving'
    if (lat != null && lng != null && at) position = { lat, lng, accuracyM: num(p.accuracyM), at, state }
  }
  return {
    status,
    name: str(r.name),
    title: str(r.title),
    firstDay: day(r.firstDay),
    lastDay: day(r.lastDay),
    lines,
    stops,
    position,
    serverNow: date(r.now),
  }
}

/** Khung ôm đường của kế hoạch + vị trí mới nhất; null khi không có gì để ôm. */
export function trackBbox(v: TrackView): [number, number, number, number] | null {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  const add = (lon: number, lat: number) => {
    w = Math.min(w, lon)
    e = Math.max(e, lon)
    s = Math.min(s, lat)
    n = Math.max(n, lat)
  }
  for (const l of v.lines) for (const [lon, lat] of l.coords) add(lon, lat)
  for (const st of v.stops) add(st.lng, st.lat)
  if (v.position) add(v.position.lng, v.position.lat)
  return Number.isFinite(w) ? [w, s, e, n] : null
}

/** Số phút từ vị trí mới nhất tới lúc máy chủ trả lời; null khi chưa có vị trí. */
export function ageMinutes(v: TrackView, viewerNow: Date = new Date()): number | null {
  if (!v.position) return null
  const now = v.serverNow ?? viewerNow
  return Math.max(0, Math.round((now.getTime() - v.position.at.getTime()) / 60_000))
}

/** "vừa xong", "12 phút trước", "2 giờ 05 phút trước", "lúc 07:40, T7, 14/11". */
export function ageText(minutes: number, at: Date): string {
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m === 0 ? `${h} giờ trước` : `${h} giờ ${String(m).padStart(2, '0')} phút trước`
  }
  return `lúc ${vnClock(at)}, ${shortDate(vnDay(at))}`
}

/** Giờ Việt Nam của một mốc: "07:40". */
export function vnClock(at: Date): string {
  const vn = new Date(at.getTime() + 7 * 3600_000)
  return clock(vn.getUTCHours() * 60 + vn.getUTCMinutes())
}

const vnDay = (at: Date): string => new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

/** Lâu hơn chừng này chưa có vị trí mới thì nói ra (không kết luận gì thêm). */
export const QUIET_AFTER_MIN = 45

/** Câu trạng thái của trang: một dòng chính + một dòng phụ. */
export function trackHeadline(v: TrackView | null, viewerNow: Date = new Date()): { headline: string; detail: string | null } {
  if (!v) return { headline: 'Không tìm thấy link này', detail: 'Link có thể bị gõ sai, hoặc đã bị xoá.' }
  const who = v.name ?? 'Người leo'
  switch (v.status) {
    case 'off':
      return { headline: 'Link theo dõi đã tắt', detail: 'Người chia sẻ đã tắt link này.' }
    case 'ended':
      return { headline: 'Chuyến đi đã kết thúc', detail: 'Link theo dõi đã hết hạn.' }
    case 'upcoming':
      return {
        headline: v.firstDay ? `Chuyến đi bắt đầu ${shortDate(v.firstDay)}` : 'Chuyến đi chưa bắt đầu',
        detail: `Vị trí của ${who} hiện ở đây khi bắt đầu ghi track.`,
      }
    case 'waiting':
      return { headline: 'Chưa có vị trí', detail: `${who} chưa bắt đầu ghi track, hoặc chưa có sóng để gửi vị trí.` }
    case 'moving':
    case 'paused':
    case 'finished': {
      const age = ageMinutes(v, viewerNow)
      const when = age == null || !v.position ? null : ageText(age, v.position.at)
      const head = v.status === 'moving' ? 'Đang đi' : v.status === 'paused' ? 'Đang tạm dừng' : 'Đã kết thúc ghi track'
      const quiet = v.status === 'moving' && age != null && age >= QUIET_AFTER_MIN
      const detail = when == null
        ? null
        : quiet
          ? `Vị trí mới nhất ${when} — trên núi thường mất sóng, máy sẽ gửi tiếp khi có sóng.`
          : `Vị trí mới nhất ${when}.`
      return { headline: head, detail }
    }
  }
}
