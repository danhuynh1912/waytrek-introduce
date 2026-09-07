/** LCG tiền định — cùng seed thì cùng dãy số, nét vẽ không rung giữa các render. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = (seed & 0x7fffffff) | 1
  }
  next(): number {
    this.s = (Math.imul(this.s, 1103515245) + 12345) & 0x7fffffff
    return this.s / 0x7fffffff
  }
  range(a: number, b: number): number {
    return a + this.next() * (b - a)
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
