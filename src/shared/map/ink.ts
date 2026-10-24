// Màu nét / nhãn vẽ ĐÈ lên bản đồ theo theme — dùng chung cho trang lên kế
// hoạch và các trang xem cung, để một cung trông giống nhau ở mọi trang.
// Màu lộ trình chép theo app; `vehicle` là màu chặng đi xe của app (#E8821E).

export interface MapInk {
  route: string
  casing: string
  vehicle: string
  peak: string
  peakStroke: string
  label: string
  halo: string
  poiLabel: string
  poiStroke: string
  water: string
}

export const MAP_INK: Record<'light' | 'dark', MapInk> = {
  light: {
    route: '#2F677A',
    casing: '#FFFFFF',
    vehicle: '#E8821E',
    peak: '#12222B',
    peakStroke: '#FFFFFF',
    label: '#12222B',
    halo: '#FFFFFF',
    poiLabel: '#2A3A42',
    poiStroke: '#FFFFFF',
    water: '#2B7BB9',
  },
  dark: {
    route: '#7FBDD0',
    casing: '#050605',
    vehicle: '#E8821E',
    peak: '#E6E8E3',
    peakStroke: '#0B0C0B',
    label: '#D4D7CF',
    halo: 'rgba(11,12,11,0.9)',
    poiLabel: '#A7AAA2',
    poiStroke: '#0B0C0B',
    water: '#5D9FD0',
  },
}

/** Font chữ có sẵn trong style tự host (glyph của OpenFreeMap). */
export const LABEL_FONT = { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'] }
