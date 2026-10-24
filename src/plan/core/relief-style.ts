// Style bản đồ theo theme — CHÉP luật của app (`way_trek/lib/core/map/
// relief_style.dart`): bản Sáng là bản đang chạy trên master (nền xanh theo độ
// cao + bóng sườn nhiều hướng), bản Tối là bản của nhánh experiment/ui-lab
// (ee98010, chủ sản phẩm 24/10: "theme tối để địa hình và map tối hẳn").
// App là chủ bảng màu: đổi ở app trước rồi chép lại đây.
//
// Tô lại style gốc TẠI CHỖ chứ không thay sang một style tối khác: giữ nguyên
// nguồn tile, font, sprite và nhãn Biển Đông đã vá trong style tự host.

type Json = Record<string, unknown>
type Layer = Json & { id?: string; type?: string; paint?: Json }

export const RELIEF_SOURCE = 'wt-relief-dem'
export const RELIEF_HILLSHADE = 'wt-relief-hillshade'
export const RELIEF_TINT = 'wt-relief-land'

/** Nền xanh chỉ phủ chỗ đất cao từ mốc này (app, 20/10) — phố đồng bằng giữ nền be. */
const TINT_MIN_M = 50
const TINT_FADE_M = 10
const LAND = '#A3D29A'

const LAND_PAINT: Record<string, Json> = {
  park: { 'fill-color': '#9ACB90', 'fill-opacity': 0.35, 'fill-outline-color': 'rgba(0,0,0,0)' },
  park_outline: { 'line-opacity': 0 },
  landcover_wood: { 'fill-color': '#8CC283', 'fill-opacity': 0.45 },
  landcover_grass: { 'fill-color': '#B4DCA8', 'fill-opacity': 0.5 },
  landuse_residential: { 'fill-color': '#EEF0EA', 'fill-opacity': 0.85 },
}

const LAND_PAINT_DARK: Record<string, Json> = {
  park: { 'fill-color': '#141A12', 'fill-opacity': 0.5, 'fill-outline-color': 'rgba(0,0,0,0)' },
  park_outline: { 'line-opacity': 0 },
  landcover_wood: { 'fill-color': '#121A10', 'fill-opacity': 0.55 },
  landcover_grass: { 'fill-color': '#161C13', 'fill-opacity': 0.45 },
  landuse_residential: { 'fill-color': '#191A18', 'fill-opacity': 0.85 },
}

const HILLSHADE_LIGHT: Json = {
  'hillshade-method': 'multidirectional',
  'hillshade-exaggeration': 0.45,
  'hillshade-illumination-direction': [270, 315, 0, 225],
  'hillshade-illumination-altitude': [30, 30, 30, 30],
  'hillshade-shadow-color': ['rgba(30,74,40,0.35)', 'rgba(30,74,40,0.35)', 'rgba(30,74,40,0.25)', 'rgba(30,74,40,0.15)'],
  'hillshade-highlight-color': ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'],
}

/** Trên nền gần đen, khối núi hiện chủ yếu bằng SƯỜN SÁNG — trắng rất nhạt. */
const HILLSHADE_DARK: Json = {
  'hillshade-method': 'multidirectional',
  'hillshade-exaggeration': 0.55,
  'hillshade-illumination-direction': [270, 315, 0, 225],
  'hillshade-illumination-altitude': [30, 30, 30, 30],
  'hillshade-shadow-color': ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.3)'],
  'hillshade-highlight-color': ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.04)'],
}

const DARK_BG = '#0B0C0B'
const DARK_WATER = '#0D161C'
const DARK_HALO = 'rgba(11,12,11,0.9)'

/**
 * Paint thay thế cho MỘT lớp của style gốc ở bản tối, theo loại + TÊN lớp
 * (null = giữ nguyên). Theo tên chứ không theo từng lớp: OpenFreeMap thêm lớp
 * mới thì lớp đó vẫn rơi vào đúng nhóm thay vì sáng loá giữa bản đồ tối.
 */
export function darkPaintFor(l: Layer): Json | null {
  const id = (l.id ?? '').toLowerCase()
  switch (l.type) {
    case 'background':
      return { 'background-color': DARK_BG }
    case 'raster':
      return { 'raster-opacity': 0.3, 'raster-saturation': -1.0 }
    case 'fill-extrusion':
      return { 'fill-extrusion-color': '#151614' }
    case 'fill': {
      if (l.paint && 'fill-pattern' in l.paint) return { 'fill-opacity': 0.08 }
      if (id.includes('water')) return { 'fill-color': DARK_WATER }
      if (id.includes('building')) return { 'fill-color': '#141513', 'fill-outline-color': '#1C1D1B' }
      if (id.includes('ice')) return { 'fill-color': '#1A1D1F' }
      if (id.includes('sand')) return { 'fill-color': '#17160F', 'fill-opacity': 0.6 }
      return { 'fill-color': '#121311', 'fill-opacity': 0.6 }
    }
    case 'line':
      if (id.includes('outline')) return { 'line-opacity': 0 }
      if (id.includes('casing')) return { 'line-color': '#050505' }
      if (id.includes('hatching')) return { 'line-color': '#262724' }
      if (id.includes('rail')) return { 'line-color': '#2E2F2C' }
      if (id.startsWith('waterway')) return { 'line-color': '#15232C' }
      if (id.startsWith('boundary')) return { 'line-color': '#4A4B47' }
      if (id.startsWith('aeroway')) return { 'line-color': '#222320' }
      if (id.includes('path') || id.includes('pedestrian')) return { 'line-color': '#3C3D39' }
      if (id.includes('motorway') || id.includes('trunk')) return { 'line-color': '#4E4C42' }
      if (id.includes('secondary') || id.includes('tertiary')) return { 'line-color': '#3E3D37' }
      return { 'line-color': '#2C2D2A' }
    case 'symbol':
      if (id.includes('water')) return { 'text-color': '#5D7F92', 'text-halo-color': DARK_HALO }
      if (id.startsWith('poi') || id === 'airport') {
        return { 'text-color': '#8E918A', 'text-halo-color': DARK_HALO, 'icon-opacity': 0.55 }
      }
      if (id.startsWith('highway-name')) return { 'text-color': '#7D8079', 'text-halo-color': DARK_HALO }
      if (id.includes('shield') || id.includes('arrow')) return { 'icon-opacity': 0.4, 'text-opacity': 0.6 }
      if (id.includes('city') || id.includes('town')) return { 'text-color': '#D4D7CF', 'text-halo-color': DARK_HALO }
      if (id.includes('country') || id.includes('state')) return { 'text-color': '#8A8D86', 'text-halo-color': DARK_HALO }
      return { 'text-color': '#A7AAA2', 'text-halo-color': DARK_HALO }
  }
  return null
}

/**
 * Bản sao của style gốc có thêm nguồn độ cao, nền đất theo độ cao và bóng sườn;
 * `dark` thì tô lại mọi lớp. THUẦN: không sửa object đầu vào.
 */
export function reliefStyle<T extends Json>(base: T, opts: { demTiles: string; dark: boolean }): T {
  const { demTiles, dark } = opts
  const out: Json = { ...base }
  out.sources = {
    ...((base.sources as Json | undefined) ?? {}),
    [RELIEF_SOURCE]: {
      type: 'raster-dem',
      tiles: [demTiles],
      tileSize: 256,
      encoding: 'terrarium',
      // z13 như app: z12 nhoè khi zoom sát tuyến, z14 lộ nhiễu radar của SRTM.
      maxzoom: 13,
      attribution: 'Độ cao: Terrain Tiles',
    },
  }

  const layers: Layer[] = ((base.layers as Layer[] | undefined) ?? [])
    .filter((l) => l && l.id !== RELIEF_HILLSHADE && l.id !== RELIEF_TINT)
    .map((l) => {
      const over = (dark ? LAND_PAINT_DARK : LAND_PAINT)[l.id ?? ''] ?? (dark ? darkPaintFor(l) : null)
      return over ? { ...l, paint: { ...(l.paint ?? {}), ...over } } : { ...l }
    })

  const tint: Layer = {
    id: RELIEF_TINT,
    type: 'color-relief',
    source: RELIEF_SOURCE,
    paint: {
      'color-relief-color': dark
        ? [
          'interpolate', ['linear'], ['elevation'],
          TINT_MIN_M - TINT_FADE_M, 'rgba(18,21,17,0)',
          TINT_MIN_M + TINT_FADE_M, '#121511',
          // Sáng lên RẤT nhẹ theo độ cao: đọc ra thung lũng với đỉnh, không thành cầu vồng.
          1500, '#171B15',
          3000, '#1D2219',
        ]
        : [
          'interpolate', ['linear'], ['elevation'],
          TINT_MIN_M - TINT_FADE_M, 'rgba(163,210,154,0)',
          TINT_MIN_M + TINT_FADE_M, LAND,
        ],
    },
  }
  let lastBg = -1
  layers.forEach((l, i) => {
    if (l.type === 'background') lastBg = i
  })
  layers.splice(lastBg + 1, 0, tint)

  // Bóng nằm NGAY TRƯỚC lớp nước đầu tiên: trên đất và thảm phủ, dưới sông,
  // đường và chữ — bóng đè lên chữ là mất chữ.
  const hillshade: Layer = { id: RELIEF_HILLSHADE, type: 'hillshade', source: RELIEF_SOURCE, paint: dark ? HILLSHADE_DARK : HILLSHADE_LIGHT }
  let at = layers.findIndex((l) => (l.id ?? '').toLowerCase().includes('water'))
  if (at < 0) at = layers.findIndex((l) => l.type === 'line' || l.type === 'symbol')
  if (at < 0) layers.push(hillshade)
  else layers.splice(at, 0, hillshade)

  out.layers = layers
  return out as T
}
