// Luật thả tấm kế hoạch trên điện thoại (thuần — `ui/editor/use-sheet-drag.ts`
// gắn nó vào cử chỉ). Hai mốc như trước: nửa màn (đóng) và gần đầy màn (mở).

/** Vuốt nhanh hơn mức này (px/ms) thì theo hướng vuốt, bất kể đang ở đâu. */
export const SHEET_FLICK = 0.45

/**
 * Thả ở chiều cao `height`: vuốt nhanh lên (vận tốc âm — y màn hình giảm) thì
 * mở, nhanh xuống thì đóng; không thì về mốc gần hơn.
 */
export function sheetOpensAt(height: number, half: number, full: number, velocity: number): boolean {
  if (velocity <= -SHEET_FLICK) return true
  if (velocity >= SHEET_FLICK) return false
  return height > (half + full) / 2
}

/** Chiều cao lúc đang kéo: bám ngón tay, kẹp trong [min, max]. */
export function sheetDragHeight(startHeight: number, startY: number, y: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, startHeight - (y - startY)))
}
