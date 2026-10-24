// Cách viết số, giờ, quãng đường trên web — theo app (dấu chấm ngăn nghìn,
// dấu phẩy thập phân: "34,2 km", "1.073 m", "4 giờ 52").

const int = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const one = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const two = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Số đếm có dấu chấm ngăn nghìn: "2.561". */
export function count(n: number): string {
  return int.format(Math.round(n))
}

/** Giờ trong ngày từ số phút kể từ 0h: "07:05". Qua nửa đêm thì kèm "(+1)". */
export function clock(min: number): string {
  const m = Math.round(min)
  const dayShift = Math.floor(m / 1440)
  const r = ((m % 1440) + 1440) % 1440
  const s = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
  if (dayShift > 0) return `${s} (+${dayShift})`
  return dayShift < 0 ? `${s} (${dayShift})` : s
}

/** "HH:MM" của ô nhập giờ → phút; sai thì null. */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

/** "4 giờ 52", "45 phút", "2 giờ". */
export function duration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} giờ` : `${h} giờ ${String(r).padStart(2, '0')}`
}

/** Quãng đường: dưới 1 km viết mét, còn lại một chữ số thập phân. */
export function distance(m: number): string {
  if (m < 1000) return `${int.format(Math.round(m / 10) * 10)} m`
  return `${one.format(m / 1000)} km`
}

/** Cột mốc km trên chuyến đi: "36,2". */
export function km(m: number): string {
  return one.format(m / 1000)
}

export function meters(m: number): string {
  return `${int.format(Math.round(m))} m`
}

export function pace(p: number): string {
  return two.format(p)
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** "T7, 14/11" — tính thẳng từ chuỗi ngày, không qua múi giờ của máy. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${WEEKDAY[wd]}, ${d}/${m}`
}

/** "14/11/2026". */
export function fullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${m}/${y}`
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayVn(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}
