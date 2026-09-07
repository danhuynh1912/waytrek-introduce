export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5)

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
