// Biểu đồ độ cao ở dải số liệu đáy: vùng tô một màu phẳng (không gradient),
// đứt quãng ở chỗ không có độ cao (chặng đi xe, thiếu dữ liệu) thay vì nối bịa.

import type { PlanResult } from './types.ts'

export interface ProfileGeometry {
  area: string
  line: string
  minEle: number
  maxEle: number
  /** Trục ngang tính bằng mét, 0 → totalM. */
  totalM: number
}

export function profileGeometry(
  result: PlanResult,
  width: number,
  height: number,
): ProfileGeometry | null {
  const { ele, stepM } = result.profile
  const totalM = Math.max(result.totals.distanceM, (ele.length - 1) * stepM, 1)
  const known = ele.filter((e): e is number => e != null)
  if (known.length < 2) return null
  let minEle = Math.min(...known)
  let maxEle = Math.max(...known)
  if (maxEle - minEle < 50) {
    const mid = (maxEle + minEle) / 2
    minEle = mid - 25
    maxEle = mid + 25
  }
  const pad = (maxEle - minEle) * 0.12
  const lo = minEle - pad
  const hi = maxEle + pad
  const x = (i: number) => ((i * stepM) / totalM) * width
  const y = (e: number) => height - ((e - lo) / (hi - lo)) * height
  let area = ''
  let line = ''
  let run: [number, number][] = []
  const flush = () => {
    if (run.length >= 2) {
      const pts = run.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
      line += `M${pts.join('L')}`
      area += `M${run[0][0].toFixed(1)},${height}L${pts.join('L')}L${run[run.length - 1][0].toFixed(1)},${height}Z`
    }
    run = []
  }
  ele.forEach((e, i) => {
    if (e == null) flush()
    else run.push([x(i), y(e)])
  })
  flush()
  return { area, line, minEle, maxEle, totalM }
}

/** Vị trí (mét) của từng điểm dừng trên trục ngang, theo thứ tự `result.stops`. */
export function stopOffsets(result: PlanResult): number[] {
  const out = [0]
  for (const leg of result.legs) out.push(out[out.length - 1] + leg.distanceM)
  return out
}

/** Độ cao tại mét `m` (nội suy giữa hai mẫu; null nếu một bên không có). */
export function eleAt(result: PlanResult, m: number): number | null {
  const { ele, stepM } = result.profile
  if (ele.length === 0) return null
  const f = Math.max(0, m / stepM)
  const i = Math.min(ele.length - 1, Math.floor(f))
  const j = Math.min(ele.length - 1, i + 1)
  const a = ele[i]
  const b = ele[j]
  if (a == null || b == null) return a ?? null
  return a + (b - a) * (f - i)
}

const RAD = Math.PI / 180

function metres(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * RAD
  const dLon = (b[0] - a[0]) * RAD
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Điểm ở tỉ lệ `frac` (0–1) dọc các đường [lon, lat] nối tiếp nhau — để rê chuột
 * trên biểu đồ độ cao thì chấm chạy đúng chỗ trên bản đồ. Gần đúng theo tỉ lệ:
 * biểu đồ đo theo quãng đường công bố, đường vẽ là hình học đã rút gọn.
 */
export function pointAlong(paths: readonly (readonly [number, number])[][], frac: number): [number, number] | null {
  const segs: { a: [number, number]; b: [number, number]; len: number }[] = []
  let total = 0
  for (const p of paths) {
    for (let i = 1; i < p.length; i++) {
      const len = metres(p[i - 1] as [number, number], p[i] as [number, number])
      segs.push({ a: p[i - 1] as [number, number], b: p[i] as [number, number], len })
      total += len
    }
  }
  if (segs.length === 0) return null
  let target = Math.max(0, Math.min(1, frac)) * total
  for (const s of segs) {
    if (target <= s.len) {
      const t = s.len > 0 ? target / s.len : 0
      return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]
    }
    target -= s.len
  }
  const last = segs[segs.length - 1].b
  return [last[0], last[1]]
}
