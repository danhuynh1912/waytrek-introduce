// Bọc MapLibre cho trang lên kế hoạch. React chỉ gọi các hàm set* với dữ liệu
// đã dựng sẵn và nhận lại sự kiện qua `PlanMapHandlers` — không component nào
// đụng thẳng vào `maplibregl`.

import maplibregl from 'maplibre-gl'
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MlMap,
  MapGeoJSONFeature,
  MapMouseEvent,
  Marker,
  Popup,
} from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import { decodePolyline } from '../../core/polyline'
import { MAP_INK } from '@/shared/map/ink'
import type { MapInk } from '@/shared/map/ink'
import { ReliefMap } from '@/shared/map/relief-map'
import { hideTipAt, showTipAt } from '@/shared/tooltip'
import { RELIEF_HILLSHADE, RELIEF_TINT } from '@/shared/map/relief-style'
import { nearestOnLines, pickTapHit, SNAP_PX } from '../../core/snap'
import { mergeRoutes } from '../../core/route-merge'
import type { MergedLine } from '../../core/route-merge'
import type { DrawLine } from '../../core/timeline'
import type { PoiPin, RouteLine, TrailPin } from '../../core/types'
import type { Bbox } from '../../data/api'
import { poiKindLabel } from '../labels'

export interface LatLng {
  lat: number
  lng: number
}

export interface Snapped extends LatLng {
  trailId: string
  trailName: string
}

export interface MapWaypoint extends LatLng {
  id: string
  label: string
  name: string
  rest: boolean
  peak: boolean
  /** Có nút "Nghỉ đêm ở đây" (core/doc restToggleAllowed): điểm giữa, không phải đỉnh. */
  restToggle: boolean
}

export interface MapAuto extends LatLng {
  id: string
  name: string
  /** Chỗ nghỉ máy chủ gợi ý (`isRestSuggestion`) — nút "Ẩn gợi ý chỗ nghỉ" ẩn nó. */
  suggestion: boolean
  /** Vùng nên nghỉ (polyline mã hoá) — có thì đây là chỗ cắm trại, không phải lán. */
  zoneLine?: string
  /** Điểm engine chèn chỉ để cho biết (điểm bắt đầu leo, chỗ ngủ sau xe tối hôm trước): không Giữ / Bỏ. */
  info?: { sub: string; icon: 'walk' | 'car' | 'tent' }
}

/**
 * `rests`: gợi ý chỗ nghỉ — lán WayTrek tự chọn + vùng nên nghỉ (dải + lều). Tắt
 * đi thì bản đồ chỉ còn những điểm người dùng chọn (chủ sản phẩm 26/10). Bật / tắt
 * bằng nút cạnh "Gợi ý thứ tự leo" ở tab Lịch trình, không nằm trong menu lớp.
 */
export type LayerKey = 'rests' | 'routes' | 'pois' | 'peaks' | 'terrain'

/** Đỉnh / POI mà điểm đang kéo hít vào (chủ sản phẩm 26/10): thả ra là thành chính nó. */
export interface DropTarget {
  kind: 'peak' | 'poi'
  ref: string
  name: string
  lat: number
  lng: number
}

export interface PlanMapHandlers {
  /** Bấm chỗ trống rồi bấm "Thêm vào kế hoạch" trong bảng nhỏ (không thêm ngay — chủ sản phẩm 26/10). */
  onMapClick(at: LatLng, snapped: Snapped | null): void
  /** Tên điểm sẽ thêm ("Điểm N") — tiêu đề bảng nhỏ khi bấm chỗ trống. */
  nextPointName(): string
  /** Phần bản đồ bị thanh công cụ / panel đè lên (px) — để đặt bảng nhỏ vào chỗ nhìn thấy. */
  obstructed(): { top: number; bottom: number }
  onAddPeak(t: TrailPin): void
  onAddPoi(p: PoiPin): void
  /** `target`: thả đúng lên một đỉnh / POI (điểm đã hít vào tâm nó) — điểm mang tên, loại, mã của nó. */
  onWaypointMoved(id: string, at: LatLng, snapped: Snapped | null, target: DropTarget | null): void
  onWaypointRemove(id: string): void
  onWaypointToggleRest(id: string): void
  onKeepAuto(autoId: string): void
  onDismissAuto(autoId: string): void
  onView(bbox: Bbox, zoom: number): void
  onReady(): void
  onFatal(message: string): void
}

// Màu vẽ TRÊN bản đồ đi theo NỀN BẢN ĐỒ (Sáng: Liberty + nền xanh; Tối: bản
// tối của ui-lab) chứ không theo token giao diện — cùng luật "nhìn thứ phía
// sau" của app. Bản tối đổi nét kế hoạch sang teal sáng và viền tối, nếu không
// nét teal sẫm chìm hẳn vào nền gần đen.
/** Màu riêng của trang lên kế hoạch, cộng thêm vào bảng màu chung `MAP_INK`. */
interface Palette extends MapInk {
  straight: string
  pending: string
  catalog: string
  catalogOpacity: number
  shelter: string
  other: string
  zone: string
  zoneOpacity: number
}

/** Màu nét kế hoạch cho chú thích ngoài bản đồ — cùng bảng màu với nét vẽ. */
export function planLineColors(dark: boolean): { walk: string; vehicle: string } {
  const C = PALETTE[dark ? 'dark' : 'light']
  return { walk: C.route, vehicle: C.vehicle }
}

/**
 * Màu từng loại đường ở tab "Waypoints" — lấy từ đúng bảng màu của đường vẽ trên
 * bản đồ, để thanh "Loại đường" đọc cùng một thứ tiếng với bản đồ. Lối mòn OSM
 * và xe ôm là bản nhạt của đi bộ / đi xe (trên bản đồ chúng cùng màu đó).
 */
export function wayColors(dark: boolean): Record<'route' | 'path' | 'straight' | 'vehicle' | 'moto', string> {
  const C = PALETTE[dark ? 'dark' : 'light']
  return {
    route: C.route,
    path: `color-mix(in srgb, ${C.route} 50%, transparent)`,
    straight: C.straight,
    vehicle: C.vehicle,
    moto: `color-mix(in srgb, ${C.vehicle} 55%, transparent)`,
  }
}

/** Nhãn "Xe ôm" chỉ hiện từ mức phóng này (nhìn xa, đoạn xe ôm chỉ vài pixel). */
const MOTO_MIN_ZOOM = 11

/** Khoảng từ điểm tới mũi nhọn của bảng nhỏ (px) — đủ để bảng không che cái chấm. */
const POPUP_OFFSET_PX = 14
/** Nhãn tên đỉnh chỉ tính là bấm trúng khi chạm vào chính chữ (± vài px). */
const LABEL_HIT_PX = 2
/**
 * Kéo một điểm vào gần tâm một đỉnh / POI chừng này px thì điểm hít vào đúng tâm
 * nó — như căn giữa chữ khi chỉnh ảnh (chủ sản phẩm 26/10). Đã hít thì phải kéo
 * ra xa hơn (OUT) mới nhả, không thì rung ở mép. Ngón tay thì rộng hơn.
 */
const MAGNET_IN_PX = 16
const MAGNET_OUT_PX = 24
const MAGNET_TOUCH_IN_PX = 26
const MAGNET_TOUCH_OUT_PX = 36

const PALETTE: Record<'light' | 'dark', Palette> = {
  light: {
    ...MAP_INK.light,
    straight: '#B4690E',
    pending: '#6B7C85',
    catalog: '#7A6E58',
    catalogOpacity: 0.85,
    shelter: '#8A5A2B',
    other: '#6B7C85',
    zone: '#B4690E',
    zoneOpacity: 0.22,
  },
  dark: {
    ...MAP_INK.dark,
    straight: '#F5D77A',
    pending: '#8E918A',
    catalog: '#B3AC98',
    catalogOpacity: 0.75,
    shelter: '#C08A52',
    other: '#8E918A',
    zone: '#F5D77A',
    zoneOpacity: 0.2,
  },
}

const LAYERS: Record<LayerKey, string[]> = {
  // Lán + lều là điểm DOM, dải vùng nên nghỉ mờ dần bằng độ đục — cả hai do
  // setLayer lo, không bật/tắt `visibility`.
  rests: [],
  routes: ['wt-routes-line'],
  pois: ['wt-pois-dot', 'wt-pois-label'],
  peaks: ['wt-trails-dot', 'wt-trails-label'],
  terrain: [RELIEF_HILLSHADE, RELIEF_TINT],
}

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })

export class PlanMap {
  #rm: ReliefMap
  #map: MlMap
  #h: PlanMapHandlers
  #trails: TrailPin[] = []
  #pois: PoiPin[] = []
  #routes = new Map<string, RouteLine>()
  /** Nét đang vẽ (đã gộp) — chấm điểm bám đúng nét người dùng nhìn thấy. */
  #merged: MergedLine[] = []
  #lines: DrawLine[] = []
  #hover: LatLng | null = null
  #me: LatLng | null = null
  #visible: Record<LayerKey, boolean> = { rests: true, routes: true, pois: true, peaks: true, terrain: true }
  #wps = new Map<string, { marker: Marker; data: MapWaypoint }>()
  #autos = new Map<string, { marker: Marker; data: MapAuto }>()
  #zones: string[] = []
  #popup: Popup | null = null
  /** Chấm đánh dấu chỗ sẽ thêm điểm, đi cùng bảng nhỏ của chỗ trống. */
  #pin: Marker | null = null
  #suppressClickUntil = 0
  /** Thứ trên canvas đang có tooltip (đỉnh / POI) — null: không có gì. */
  #tipKey: string | null = null
  /** Đang kéo một điểm: tooltip của đỉnh / POI dưới con trỏ nhường cho tooltip "thả vào đây". */
  #dragging = false

  constructor(container: HTMLElement, handlers: PlanMapHandlers, dark: boolean) {
    this.#h = handlers
    // Khởi động bản đồ theo theme (nền tạm, style tự host, đổi theme, hẹn giờ
    // báo hỏng) là phần dùng chung — `shared/map/relief-map`.
    this.#rm = new ReliefMap(
      container,
      {
        dark,
        logTag: 'plan',
        mapOptions: {
          // Đường xe / lối mòn của kế hoạch do OpenRouteService (HeiGIT) tìm — điều kiện dùng gói miễn phí.
          attributionControl: { compact: true, customAttribution: 'Tìm đường © <a href="https://openrouteservice.org/" target="_blank" rel="noopener">openrouteservice.org</a> by HeiGIT' },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        },
      },
      { onStyle: (_m, first) => this.#onStyle(first), onFatal: (msg) => handlers.onFatal(msg) },
    )
    this.#map = this.#rm.map
    this.#map.touchZoomRotate.disableRotation()
    this.#map.on('click', (e) => this.#onClick(e))
    this.#map.on('moveend', () => this.#emitView())
    for (const id of ['wt-trails-dot', 'wt-trails-label', 'wt-pois-dot']) {
      this.#map.on('mouseenter', id, () => (this.#map.getCanvas().style.cursor = 'pointer'))
      this.#map.on('mouseleave', id, () => (this.#map.getCanvas().style.cursor = ''))
    }
    // Tooltip cho đỉnh / POI vẽ trên canvas (điểm DOM tự có `data-tip`): dò thứ
    // dưới con trỏ, cùng luật "đỉnh thắng POI" như lúc bấm. Trình duyệt đã gộp
    // mousemove theo khung hình, không cần tự hẹn thêm.
    this.#map.on('mousemove', (e) => {
      // Con trỏ đang trên một điểm / bảng nhỏ (DOM): tooltip của chính nó lo.
      if (e.originalEvent.target !== this.#map.getCanvas()) return
      this.#hoverTip(e.point)
    })
    this.#map.on('mouseout', () => this.#clearTip())
    this.#map.on('movestart', () => this.#clearTip())
  }

  get #ready(): boolean {
    return this.#rm.ready
  }

  destroy(): void {
    this.#clearTip()
    this.#popup?.remove()
    this.#dropPin()
    this.#rm.destroy()
  }

  /** Đổi theme: dựng lại style từ style gốc đã có, lớp của kế hoạch tự cài lại. */
  setTheme(dark: boolean): void {
    this.#rm.setTheme(dark)
  }

  #onStyle(first: boolean): void {
    this.#installLayers(PALETTE[this.#rm.dark ? 'dark' : 'light'])
    this.#pushAll()
    if (first) this.#h.onReady()
    this.#emitView()
  }

  #installLayers(C: Palette): void {
    const m = this.#map
    m.addSource('wt-routes', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-routes-line',
      type: 'line',
      source: 'wt-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        // Lộ trình người dùng WayTrek đã đi: nét liền màu đất, không trùng màu
        // nét kế hoạch; đường mòn của bản đồ nền là chấm nhỏ, sẫm.
        'line-color': C.catalog,
        // Nét đông người đi (nhiều lộ trình gộp lại) dày hơn, tới gấp đôi.
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          9, ['*', 1.5, ['min', 2, ['+', 1, ['*', 0.25, ['-', ['get', 'heat'], 1]]]]],
          14, ['*', 3, ['min', 2, ['+', 1, ['*', 0.25, ['-', ['get', 'heat'], 1]]]]],
        ],
        'line-opacity': C.catalogOpacity,
      },
    })

    // Vùng nên nghỉ: dải mờ NẰM DƯỚI đường kế hoạch — chỉ ra cả đoạn, không che lối đi.
    m.addSource('wt-zones', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-zones-band',
      type: 'line',
      source: 'wt-zones',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.zone,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 9, 14, 20],
        'line-opacity': C.zoneOpacity,
        'line-opacity-transition': { duration: 220, delay: 0 },
      },
    })

    m.addSource('wt-plan', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-plan-casing',
      type: 'line',
      source: 'wt-plan',
      filter: ['!=', ['get', 'kind'], 'pending'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.casing, 'line-width': 8, 'line-opacity': 0.9 },
    })
    const planLine = (id: string, kind: string, color: string, width: number, dash?: number[]) =>
      m.addLayer({
        id,
        type: 'line',
        source: 'wt-plan',
        filter: ['==', ['get', 'kind'], kind],
        layout: { 'line-cap': dash ? 'butt' : 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': width,
          ...(dash ? { 'line-dasharray': dash } : {}),
          ...(kind === 'pending' ? { 'line-opacity': 0.75 } : {}),
        },
      })
    planLine('wt-plan-route', 'route', C.route, 4.5)
    // Lối mòn OSM: nét liền cùng màu đi bộ, mảnh hơn lộ trình WayTrek.
    planLine('wt-plan-path', 'path', C.route, 3.5)
    planLine('wt-plan-straight', 'straight', C.straight, 4, [1.4, 1.1])
    // Đường xe: nét liền màu cam — đúng màu phương tiện của app WayTrek.
    planLine('wt-plan-vehicle', 'vehicle', C.vehicle, 4)
    planLine('wt-plan-pending', 'pending', C.pending, 3, [1, 1.4])
    // Mũi tên hướng đi dọc nét kế hoạch (ý từ komoot, kiểu của WayTrek): viên
    // tròn màu của chính đoạn, chevron trắng, tự xoay theo chiều đi. Nhìn xa vẫn
    // có nhưng thưa (gần như một cái mỗi đoạn), phóng gần thì dày dần.
    for (const [id, color] of [['wt-arrow-walk', C.route], ['wt-arrow-vehicle', C.vehicle]] as const) {
      if (!m.hasImage(id)) {
        const img = arrowImage(color, C.casing)
        if (img) m.addImage(id, img, { pixelRatio: 2 })
      }
    }
    m.addLayer({
      id: 'wt-plan-arrows',
      type: 'symbol',
      source: 'wt-plan',
      filter: ['in', ['get', 'kind'], ['literal', ['route', 'path', 'vehicle']]],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 6, 2000, 10, 900, 13, 260, 15, 160],
        'icon-image': ['case', ['==', ['get', 'kind'], 'vehicle'], 'wt-arrow-vehicle', 'wt-arrow-walk'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 13, 1],
        'icon-rotation-alignment': 'map',
        'icon-keep-upright': false,
        'icon-padding': 6,
      },
    })
    // Đoạn xe ôm theo lộ trình WayTrek: nét cam như mọi đoạn xe, thêm một
    // tooltip trắng có đuôi chỉ xuống, đứng PHÍA TRÊN điểm giữa đoạn — không đè
    // lên nét. Chỉ hiện từ MOTO_MIN_ZOOM: nhìn xa thì đoạn xe ôm chỉ là vài
    // pixel, nhãn che mất tên đỉnh (chủ sản phẩm 24/10).
    if (!m.hasImage('wt-moto-tip')) {
      const tip = tooltipImage()
      if (tip) {
        m.addImage('wt-moto-tip', tip, {
          pixelRatio: 2,
          stretchX: [[14, 26], [38, 50]],
          stretchY: [[16, 20]],
          content: [14, 6, 50, 32],
        })
      }
    }
    m.addSource('wt-moto', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-moto-badge',
      type: 'symbol',
      source: 'wt-moto',
      minzoom: MOTO_MIN_ZOOM,
      layout: {
        'icon-image': 'wt-moto-tip',
        'icon-text-fit': 'both',
        'text-field': 'Xe ôm',
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.05],
        'icon-allow-overlap': true,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#12222B' },
    })

    m.addSource('wt-pois', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-pois-dot',
      type: 'circle',
      source: 'wt-pois',
      minzoom: 9,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 14, 6],
        'circle-color': ['match', ['get', 'kind'], 'shelter', C.shelter, 'water', C.water, C.other],
        'circle-stroke-color': C.poiStroke,
        'circle-stroke-width': 1.5,
      },
    })
    m.addLayer({
      id: 'wt-pois-label',
      type: 'symbol',
      source: 'wt-pois',
      minzoom: 12.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 0.9],
        'text-anchor': 'top',
        'text-max-width': 9,
      },
      paint: { 'text-color': C.poiLabel, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    })

    m.addSource('wt-trails', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-trails-dot',
      type: 'circle',
      source: 'wt-trails',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3.5, 12, 6],
        'circle-color': C.peak,
        'circle-stroke-color': C.peakStroke,
        'circle-stroke-width': 1.8,
      },
    })
    m.addLayer({
      id: 'wt-trails-label',
      type: 'symbol',
      source: 'wt-trails',
      minzoom: 7,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-offset': [0, 0.85],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-optional': true,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
    })

    // Vị trí người dùng (nút "về vị trí của tôi"): chấm xanh, vòng trắng.
    m.addSource('wt-me', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-me-dot',
      type: 'circle',
      source: 'wt-me',
      paint: { 'circle-radius': 7, 'circle-color': '#2B7BB9', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 },
    })

    m.addSource('wt-hover', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-hover-dot',
      type: 'circle',
      source: 'wt-hover',
      paint: { 'circle-radius': 6, 'circle-color': C.route, 'circle-stroke-color': C.casing, 'circle-stroke-width': 2.5 },
    })
  }

  // ─── Dữ liệu ────────────────────────────────────────────────────────────

  setTrails(trails: TrailPin[]): void {
    this.#trails = trails
    this.#push('wt-trails', {
      type: 'FeatureCollection',
      features: trails.map((t) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
        properties: { trailId: t.trailId, name: t.name },
      })),
    })
  }

  setPois(pois: PoiPin[]): void {
    this.#pois = pois
    this.#push('wt-pois', {
      type: 'FeatureCollection',
      features: pois.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { poiId: p.poiId, name: p.name, kind: p.kind },
      })),
    })
  }

  /** Thêm lộ trình vừa tải vào bộ nhớ (cả mạng lộ trình công khai chỉ cỡ trăm đường). */
  addRoutes(routes: RouteLine[]): void {
    let changed = false
    for (const r of routes) {
      if (!this.#routes.has(r.routeId)) changed = true
      this.#routes.set(r.routeId, r)
    }
    if (changed) this.#pushRoutes()
  }

  setPlan(lines: DrawLine[]): void {
    this.#lines = lines
    this.#pushPlan()
  }

  setHover(p: LatLng | null): void {
    this.#hover = p
    this.#push('wt-hover', {
      type: 'FeatureCollection',
      features: p ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: {} }] : [],
    })
  }

  setMe(p: LatLng | null): void {
    this.#me = p
    this.#push('wt-me', {
      type: 'FeatureCollection',
      features: p ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: {} }] : [],
    })
  }

  setLayer(key: LayerKey, on: boolean): void {
    this.#visible[key] = on
    if (key === 'rests') {
      // Lán tự chọn + lều của vùng là điểm DOM: mờ dần cùng nhịp với dải.
      // Chỉ chỗ nghỉ máy chủ gợi ý (`suggestion`); điểm cho biết giờ vẫn hiện.
      for (const m of this.#autos.values()) restVisibility(m.marker, m.data, on)
      if (this.#ready && this.#map.getLayer('wt-zones-band')) {
        const C = PALETTE[this.#rm.dark ? 'dark' : 'light']
        this.#map.setPaintProperty('wt-zones-band', 'line-opacity', on ? C.zoneOpacity : 0)
      }
      return
    }
    if (!this.#ready) return
    for (const id of LAYERS[key]) {
      if (this.#map.getLayer(id)) this.#map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
  }

  #push(source: string, data: FeatureCollection): void {
    if (!this.#ready) return
    ;(this.#map.getSource(source) as GeoJSONSource | undefined)?.setData(data)
  }

  #pushRoutes(): void {
    // Lộ trình chồng nhau gộp về một nét (core/route-merge); nét giữ routeId
    // của lộ trình nó lấy hình học, nên #snapAt vẫn chấm đúng lên nét đã vẽ.
    this.#merged = mergeRoutes([...this.#routes.values()])
    const features: Feature[] = this.#merged.map((l) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: l.coords },
      properties: { routeId: l.routeId, trailId: l.trailId, trailName: l.trailName, heat: l.heat },
    }))
    this.#push('wt-routes', { type: 'FeatureCollection', features })
  }

  #pushPlan(): void {
    this.#push('wt-moto', {
      type: 'FeatureCollection',
      features: this.#lines
        .filter((l) => l.moto && l.encoded)
        .map((l) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: midpoint(decodePolyline(l.encoded!)) },
          properties: {},
        })),
    })
    this.#push('wt-plan', {
      type: 'FeatureCollection',
      features: this.#lines.map((l) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: l.encoded ? decodePolyline(l.encoded) : (l.ends ?? []) },
        properties: { kind: l.kind, moto: l.moto === true },
      })),
    })
  }

  #pushZones(): void {
    this.#push('wt-zones', {
      type: 'FeatureCollection',
      features: this.#zones.map((line) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: decodePolyline(line) },
        properties: {},
      })),
    })
  }

  #pushAll(): void {
    this.setTrails(this.#trails)
    this.setPois(this.#pois)
    this.#pushRoutes()
    this.#pushZones()
    this.#pushPlan()
    this.setHover(this.#hover)
    this.setMe(this.#me)
    for (const k of Object.keys(this.#visible) as LayerKey[]) this.setLayer(k, this.#visible[k])
  }

  // ─── Điểm của kế hoạch ──────────────────────────────────────────────────

  setWaypoints(list: MapWaypoint[]): void {
    const keep = new Set(list.map((w) => w.id))
    for (const [id, m] of this.#wps) {
      if (!keep.has(id)) {
        m.marker.remove()
        this.#wps.delete(id)
      }
    }
    for (const w of list) {
      const have = this.#wps.get(w.id)
      if (have) {
        have.data = w
        have.marker.setLngLat([w.lng, w.lat])
        paintWaypoint(have.marker.getElement(), w)
        continue
      }
      const el = document.createElement('div')
      paintWaypoint(el, w)
      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([w.lng, w.lat])
        .addTo(this.#map)
      const entry = { marker, data: w }
      let target: DropTarget | null = null
      marker.on('dragstart', () => {
        this.#closePopup()
        this.#clearTip()
        this.#dragging = true
        target = null
      })
      marker.on('drag', () => {
        // Vị trí MapLibre vừa tính theo con trỏ — hít thì đè bằng tâm đỉnh / POI;
        // lần di chuột sau nó lại tính theo con trỏ, nên ra khỏi vùng hút là nhả.
        const next = this.#magnet(this.#map.project(marker.getLngLat()), target)
        if (next) marker.setLngLat([next.lng, next.lat])
        if (next?.ref !== target?.ref || next?.kind !== target?.kind) {
          el.classList.toggle('is-snap', next != null)
          if (next) this.#dragTip(next)
          else this.#clearTip()
        }
        target = next
      })
      marker.on('dragend', () => {
        this.#suppressClickUntil = performance.now() + 300
        this.#dragging = false
        el.classList.remove('is-snap')
        this.#clearTip()
        const ll = marker.getLngLat()
        const at = target
        target = null
        this.#h.onWaypointMoved(
          entry.data.id,
          { lat: ll.lat, lng: ll.lng },
          at ? null : this.#snapAt(this.#map.project(ll)),
          at,
        )
      })
      stopMapEvents(el, () => {
        if (performance.now() < this.#suppressClickUntil) return
        this.#openWaypointPopup(entry.data)
      })
      this.#wps.set(w.id, entry)
    }
  }

  setAutos(list: MapAuto[]): void {
    this.#zones = list.flatMap((a) => (a.zoneLine ? [a.zoneLine] : []))
    this.#pushZones()
    const keep = new Set(list.map((a) => a.id))
    for (const [id, m] of this.#autos) {
      if (!keep.has(id)) {
        m.marker.remove()
        this.#autos.delete(id)
      }
    }
    for (const a of list) {
      const have = this.#autos.get(a.id)
      if (have) {
        have.data = a
        have.marker.setLngLat([a.lng, a.lat])
        have.marker.getElement().dataset.tip = autoTip(a)
        restVisibility(have.marker, a, this.#visible.rests)
        continue
      }
      const el = document.createElement('div')
      el.className = `pl-mk pl-mk-auto${a.zoneLine ? ' is-zone' : ''}${a.info ? ' is-info' : ''}`
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', a.zoneLine ? 'Vùng nên nghỉ — cắm trại' : a.info ? a.name : `${a.name} — lán tự chọn`)
      el.innerHTML = a.info?.icon === 'walk' ? WALK_SVG : a.info?.icon === 'car' ? CAR_SVG : TENT_SVG
      el.dataset.tip = autoTip(a)
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([a.lng, a.lat]).addTo(this.#map)
      restVisibility(marker, a, this.#visible.rests)
      const entry = { marker, data: a }
      stopMapEvents(el, () => this.#openAutoPopup(entry.data))
      this.#autos.set(a.id, entry)
    }
  }

  // ─── Camera ─────────────────────────────────────────────────────────────

  /** `animate: false` cho lần mở: nhảy thẳng, không phụ thuộc khung hình (tab nền dừng hoạt ảnh). */
  fit(
    bounds: LngLatBoundsLike,
    padding: { top: number; right: number; bottom: number; left: number },
    animate = true,
  ): void {
    // `flyTo({ padding })` GHI NHỚ phần đệm vào camera, và fitBounds CỘNG đệm của nó
    // lên trên: sau một lần bay tới điểm, điện thoại có đệm dọc 2 × (70 + 315) px —
    // quá chiều cao bản đồ, MapLibre bỏ cú ôm và nút "Ôm trọn kế hoạch" như chết
    // (25/10). Trừ phần đệm camera đang giữ để tổng đúng bằng `padding`.
    const held = this.#map.getPadding()
    const extra = {
      top: Math.max(0, padding.top - (held.top ?? 0)),
      right: Math.max(0, padding.right - (held.right ?? 0)),
      bottom: Math.max(0, padding.bottom - (held.bottom ?? 0)),
      left: Math.max(0, padding.left - (held.left ?? 0)),
    }
    this.#map.fitBounds(bounds, { padding: extra, maxZoom: 14, duration: animate ? 600 : 0 })
  }

  /** `padding`: phần khung bị panel / dải số liệu che — tâm bay về giữa phần còn thấy. */
  flyTo(at: LatLng, zoom: number, padding: { top: number; right: number; bottom: number; left: number }): void {
    this.#map.flyTo({ center: [at.lng, at.lat], zoom, padding, duration: 900, essential: true })
  }

  zoomBy(delta: number): void {
    this.#map.easeTo({ zoom: this.#map.getZoom() + delta, duration: 220 })
  }

  resize(): void {
    this.#map.resize()
  }

  #emitView(): void {
    if (!this.#ready) return
    const b = this.#map.getBounds()
    this.#h.onView(
      { minLng: b.getWest(), minLat: b.getSouth(), maxLng: b.getEast(), maxLat: b.getNorth() },
      this.#map.getZoom(),
    )
  }

  // ─── Bấm ────────────────────────────────────────────────────────────────

  #onClick(e: MapMouseEvent): void {
    if (performance.now() < this.#suppressClickUntil) return
    // Đang mở một bảng nhỏ: lần bấm này chỉ để đóng nó, không đặt điểm.
    if (this.#popup) {
      this.#closePopup()
      return
    }
    const { x, y } = e.point
    const shown = (ids: string[]) =>
      ids.filter((id) => this.#map.getLayer(id) && this.#map.getLayoutProperty(id, 'visibility') !== 'none')
    const query = (r: number, layers: string[]) =>
      layers.length ? this.#map.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers }) : []
    // Ngón tay không chính xác như con trỏ chuột: trượt khỏi cái chấm là thành
    // "thêm điểm" ngay tại đó — nên trên màn cảm ứng hỏi rộng hơn. Nhãn tên đỉnh
    // thì đã là một khối chữ lớn: hỏi rộng quanh nó là POI nằm dưới nhãn không
    // bao giờ bấm được (đỉnh thắng POI) — chỉ tính khi bấm trúng chữ.
    const r = window.matchMedia?.('(pointer: coarse)').matches ? 20 : 7
    const hits = [
      ...query(r, shown(['wt-pois-dot', 'wt-trails-dot'])),
      ...query(LABEL_HIT_PX, shown(['wt-trails-label'])),
    ]
    const away = (p: { lat: number; lng: number }) => {
      const q = this.#map.project([p.lng, p.lat])
      return Math.hypot(q.x - x, q.y - y)
    }
    const trailIds = new Set(hits.filter((f) => f.layer.id.startsWith('wt-trails')).map((f) => String(f.properties.trailId)))
    const poiIds = new Set(hits.filter((f) => f.layer.id === 'wt-pois-dot').map((f) => String(f.properties.poiId)))
    const pick = pickTapHit(
      this.#trails.filter((t) => trailIds.has(t.trailId)).map((t) => [t, away(t)] as const),
      this.#pois.filter((p) => poiIds.has(p.poiId)).map((p) => [p, away(p)] as const),
    )
    if (pick?.peak) return this.#openTrailPopup(pick.peak)
    if (pick?.poi) return this.#openPoiPopup(pick.poi)
    this.#openAddPopup({ lat: e.lngLat.lat, lng: e.lngLat.lng }, this.#snapAt(e.point))
  }

  /** Điểm gần nhất trên một lộ trình công khai trong vòng SNAP_PX quanh `p`. */
  #snapAt(p: { x: number; y: number }): Snapped | null {
    if (!this.#visible.routes || !this.#map.getLayer('wt-routes-line')) return null
    const r = SNAP_PX
    const near: MapGeoJSONFeature[] = this.#map.queryRenderedFeatures(
      [[p.x - r, p.y - r], [p.x + r, p.y + r]],
      { layers: ['wt-routes-line'] },
    )
    const ids = new Set(near.map((f) => String(f.properties.routeId)))
    const lines: { x: number; y: number }[][] = []
    const owners: MergedLine[] = []
    for (const l of this.#merged) {
      if (!ids.has(l.routeId)) continue
      lines.push(l.coords.map(([lon, lat]) => this.#map.project([lon, lat])))
      owners.push(l)
    }
    const hit = nearestOnLines(p, lines, r)
    if (!hit) return null
    const a = lines[hit.line][hit.edge]
    const b = lines[hit.line][hit.edge + 1]
    const ll = this.#map.unproject([a.x + (b.x - a.x) * hit.t, a.y + (b.y - a.y) * hit.t])
    const own = owners[hit.line]
    return { lat: ll.lat, lng: ll.lng, trailId: own.trailId, trailName: own.trailName }
  }

  // ─── Tooltip khi rê chuột ──────────────────────────────────────────────

  #hoverTip(p: { x: number; y: number }): void {
    // Đang mở bảng nhỏ: nó đã nói đủ, tooltip chỉ chồng chữ lên. Đang kéo một
    // điểm: tooltip "thả vào đây" của #dragTip lo.
    if (this.#popup || this.#dragging) return
    const shown = (ids: string[]) =>
      ids.filter((id) => this.#map.getLayer(id) && this.#map.getLayoutProperty(id, 'visibility') !== 'none')
    const query = (r: number, layers: string[]) =>
      layers.length ? this.#map.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers }) : []
    const hits = [...query(4, shown(['wt-pois-dot', 'wt-trails-dot'])), ...query(LABEL_HIT_PX, shown(['wt-trails-label']))]
    const away = (q: LatLng) => {
      const s = this.#map.project([q.lng, q.lat])
      return Math.hypot(s.x - p.x, s.y - p.y)
    }
    const trailIds = new Set(hits.filter((f) => f.layer.id.startsWith('wt-trails')).map((f) => String(f.properties.trailId)))
    const poiIds = new Set(hits.filter((f) => f.layer.id === 'wt-pois-dot').map((f) => String(f.properties.poiId)))
    const pick = pickTapHit(
      this.#trails.filter((t) => trailIds.has(t.trailId)).map((t) => [t, away(t)] as const),
      this.#pois.filter((q) => poiIds.has(q.poiId)).map((q) => [q, away(q)] as const),
    )
    const at = pick?.peak ?? pick?.poi
    if (!pick || !at) return this.#clearTip()
    const key = pick.peak ? `t:${pick.peak.trailId}` : `p:${pick.poi!.poiId}`
    if (key === this.#tipKey) return
    let text: string
    if (pick.peak) {
      const t = pick.peak
      const ele = t.peakEleM ? ` · ${t.peakEleM.toLocaleString('vi-VN')} m` : ''
      text = `${t.name}${ele} — bấm để ${t.hasPeak ? 'thêm đỉnh vào kế hoạch' : 'xem, thêm vào kế hoạch'}`
    } else {
      const q = pick.poi!
      text = `${q.name} · ${poiKindLabel(q.kind)} — bấm để thêm vào kế hoạch`
    }
    // Neo vào chính cái chấm, không vào con trỏ: lắc chuột trên chấm thì chữ đứng yên.
    const box = this.#map.getCanvas().getBoundingClientRect()
    const s = this.#map.project([at.lng, at.lat])
    // Chỉ nhớ "đang giải thích" khi tooltip nhận lời (con trỏ là chuột).
    if (showTipAt(box.left + s.x, box.top + s.y, text)) this.#tipKey = key
  }

  /**
   * Đỉnh / POI hút điểm đang kéo ở vị trí màn hình `p` (null: không có gì đủ
   * gần). Đỉnh thắng POI như lúc bấm; chỉ xét lớp đang hiện. Đỉnh phải có toạ độ
   * đỉnh thật (`hasPeak`) — không thì chấm của cung chỉ là chỗ đặt nhãn.
   */
  #magnet(p: { x: number; y: number }, current: DropTarget | null): DropTarget | null {
    const touch = window.matchMedia?.('(pointer: coarse)').matches
    const inPx = touch ? MAGNET_TOUCH_IN_PX : MAGNET_IN_PX
    const outPx = touch ? MAGNET_TOUCH_OUT_PX : MAGNET_OUT_PX
    const away = (q: { lat: number; lng: number }) => {
      const s = this.#map.project([q.lng, q.lat])
      return Math.hypot(s.x - p.x, s.y - p.y)
    }
    if (current && away(current) <= outPx) return current
    const layers = ['wt-trails-dot', 'wt-pois-dot'].filter(
      (id) => this.#map.getLayer(id) && this.#map.getLayoutProperty(id, 'visibility') !== 'none',
    )
    if (!layers.length) return null
    const hits = this.#map.queryRenderedFeatures([[p.x - inPx, p.y - inPx], [p.x + inPx, p.y + inPx]], { layers })
    const trailIds = new Set(hits.filter((f) => f.layer.id === 'wt-trails-dot').map((f) => String(f.properties.trailId)))
    const poiIds = new Set(hits.filter((f) => f.layer.id === 'wt-pois-dot').map((f) => String(f.properties.poiId)))
    const near = <T extends { lat: number; lng: number }>(list: T[]) =>
      list.map((x) => [x, away(x)] as const).filter(([, d]) => d <= inPx)
    const pick = pickTapHit(
      near(this.#trails.filter((t) => t.hasPeak && trailIds.has(t.trailId))),
      near(this.#pois.filter((q) => poiIds.has(q.poiId))),
    )
    if (pick?.peak) return { kind: 'peak', ref: pick.peak.trailId, name: pick.peak.name, lat: pick.peak.lat, lng: pick.peak.lng }
    if (pick?.poi) return { kind: 'poi', ref: pick.poi.poiId, name: pick.poi.name, lat: pick.poi.lat, lng: pick.poi.lng }
    return null
  }

  /** Tooltip lúc điểm đang kéo hít vào một đỉnh / POI: thả ra thì thành chỗ nào. */
  #dragTip(t: DropTarget): void {
    const box = this.#map.getCanvas().getBoundingClientRect()
    const s = this.#map.project([t.lng, t.lat])
    if (showTipAt(box.left + s.x, box.top + s.y, `Thả để đặt điểm tại ${t.name}`)) this.#tipKey = `drop:${t.kind}:${t.ref}`
  }

  #clearTip(): void {
    if (this.#tipKey == null) return
    this.#tipKey = null
    hideTipAt()
  }

  // ─── Bảng nhỏ trên bản đồ ───────────────────────────────────────────────

  #open(at: LatLng, content: HTMLElement): void {
    this.#closePopup()
    const make = (anchor?: 'top') =>
      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
        offset: POPUP_OFFSET_PX,
        className: 'pl-popup',
        ...(anchor ? { anchor } : {}),
      })
        .setLngLat([at.lng, at.lat])
        .setDOMContent(content)
        .addTo(this.#map)
    let popup = make()
    // MapLibre tự chọn phía đặt bảng theo khung bản đồ, nhưng không biết thanh
    // công cụ đè mép trên và panel đè mép dưới. Bảng phía trên mà lọt vào dưới
    // thanh công cụ thì mở xuống dưới điểm — nếu dưới đủ chỗ, hoặc dưới rộng
    // hơn. Đo bảng thật vì cao thấp theo nội dung (cùng luật bên app).
    const box = this.#map.getContainer().getBoundingClientRect()
    const r = popup.getElement().getBoundingClientRect()
    const pad = this.#h.obstructed()
    const visTop = pad.top
    const visBottom = box.height - pad.bottom
    const y = this.#map.project([at.lng, at.lat]).y
    if (r.top - box.top < visTop) {
      const fitsBelow = y + POPUP_OFFSET_PX + r.height <= visBottom
      if (fitsBelow || visBottom - y > y - visTop) {
        popup.remove()
        popup = make('top')
      }
    }
    popup.getElement().querySelector('.maplibregl-popup-close-button')?.setAttribute('data-tip', 'Đóng')
    popup.on('close', () => {
      if (this.#popup !== popup) return
      this.#popup = null
      this.#dropPin()
    })
    this.#popup = popup
  }

  #closePopup(): void {
    const p = this.#popup
    this.#popup = null
    p?.remove()
    this.#dropPin()
  }

  #dropPin(): void {
    this.#pin?.remove()
    this.#pin = null
  }

  /**
   * Bấm chỗ trống: hỏi trước rồi mới đặt điểm (chủ sản phẩm 26/10) — trên điện
   * thoại một cú chạm lỡ tay khi kéo bản đồ là đủ chèn thêm một điểm. Điểm rơi
   * lên lộ trình thì bảng và chấm đặt đúng chỗ đã bám.
   */
  #openAddPopup(at: LatLng, snapped: Snapped | null): void {
    const where = snapped ? { lat: snapped.lat, lng: snapped.lng } : at
    this.#open(where, card(this.#h.nextPointName(), snapped ? `Trên lộ trình ${snapped.trailName}` : '', [
      { label: 'Thêm vào kế hoạch', tip: 'Thêm điểm ở chỗ vừa chấm vào cuối kế hoạch', primary: true, run: () => this.#h.onMapClick(at, snapped) },
    ], () => this.#closePopup()))
    const el = document.createElement('div')
    el.className = 'pl-mk pl-mk-pin'
    el.setAttribute('aria-hidden', 'true')
    this.#pin = new maplibregl.Marker({ element: el }).setLngLat([where.lng, where.lat]).addTo(this.#map)
  }

  #openTrailPopup(t: TrailPin): void {
    const sub = [t.region, t.peakEleM ? `${t.peakEleM.toLocaleString('vi-VN')} m` : null].filter(Boolean).join(' · ')
    this.#open(t, card(t.name, sub, [
      {
        label: t.hasPeak ? 'Thêm đỉnh vào kế hoạch' : 'Thêm vào kế hoạch',
        tip: 'Thêm vào cuối kế hoạch — máy chủ tính đường lên tới đó',
        primary: true,
        run: () => this.#h.onAddPeak(t),
      },
    ], () => this.#closePopup()))
  }

  #openPoiPopup(p: PoiPin): void {
    const trail = this.#trails.find((t) => t.trailId === p.trailId)
    const sub = [poiKindLabel(p.kind), trail?.name].filter(Boolean).join(' · ')
    this.#open(p, card(p.name, sub, [
      { label: 'Thêm vào kế hoạch', tip: 'Thêm điểm này vào cuối kế hoạch', primary: true, run: () => this.#h.onAddPoi(p) },
    ], () => this.#closePopup()))
  }

  #openWaypointPopup(w: MapWaypoint): void {
    const actions: CardAction[] = []
    if (w.restToggle) {
      actions.push({
        label: w.rest ? 'Bỏ nghỉ đêm ở đây' : 'Nghỉ đêm ở đây',
        tip: w.rest ? 'Không ngủ ở đây nữa — đi tiếp qua điểm này' : 'Ngủ lại ở điểm này — sáng hôm sau đi tiếp từ đây',
        primary: !w.rest,
        run: () => this.#h.onWaypointToggleRest(w.id),
      })
    }
    actions.push({ label: 'Xoá điểm', tip: 'Bỏ điểm này khỏi kế hoạch', danger: true, run: () => this.#h.onWaypointRemove(w.id) })
    this.#open(w, card(w.name, `Điểm ${w.label}`, actions, () => this.#closePopup()))
  }

  #openAutoPopup(a: MapAuto): void {
    if (a.info) {
      this.#open(a, card(a.name, a.info.sub, [], () => this.#closePopup()))
      return
    }
    if (a.zoneLine) {
      this.#open(a, card('Vùng nên nghỉ', 'Chưa có lán — nghỉ đêm trong đoạn tô màu, mang lều', [
        { label: 'Đặt chỗ cắm trại', tip: 'Ghim chỗ cắm trại vào kế hoạch thành một điểm nghỉ đêm', primary: true, run: () => this.#h.onKeepAuto(a.id) },
        { label: 'Không mang lều', tip: 'Đoàn không mang lều — bỏ mọi vùng nên nghỉ, chỉ ngủ ở lán', run: () => this.#h.onDismissAuto(a.id) },
      ], () => this.#closePopup()))
      return
    }
    this.#open(a, card(a.name, 'Lán tự chọn để kịp tới trước tối', [
      { label: 'Giữ', tip: 'Ghim lán này vào kế hoạch thành điểm nghỉ đêm', primary: true, run: () => this.#h.onKeepAuto(a.id) },
      { label: 'Bỏ', tip: 'Không ngủ ở lán này — WayTrek chọn chỗ nghỉ khác', run: () => this.#h.onDismissAuto(a.id) },
    ], () => this.#closePopup()))
  }
}

interface CardAction {
  label: string
  /** Câu giải thích khi rê chuột (tooltip chung). */
  tip?: string
  primary?: boolean
  danger?: boolean
  run: () => void
}

function card(title: string, sub: string, actions: CardAction[], close: () => void): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pl-pop'
  const h = document.createElement('div')
  h.className = 'pl-pop-title'
  h.textContent = title
  el.appendChild(h)
  if (sub) {
    const s = document.createElement('div')
    s.className = 'pl-pop-sub'
    s.textContent = sub
    el.appendChild(s)
  }
  const row = document.createElement('div')
  row.className = 'pl-pop-actions'
  for (const a of actions) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `pl-btn ${a.primary ? 'pl-btn-primary' : a.danger ? 'pl-btn-danger' : 'pl-btn-quiet'}`
    b.textContent = a.label
    if (a.tip) b.dataset.tip = a.tip
    b.addEventListener('click', () => {
      close()
      a.run()
    })
    row.appendChild(b)
  }
  el.appendChild(row)
  return el
}

function paintWaypoint(el: HTMLElement, w: MapWaypoint): void {
  // classList, KHÔNG gán đè className: MapLibre gắn `maplibregl-marker` (lớp đặt
  // position: absolute) lên chính phần tử này; xoá nó là marker rơi vào dòng
  // chảy thường và cái sau xếp chồng dưới cái trước.
  el.classList.add('pl-mk', 'pl-mk-wp')
  el.classList.toggle('is-rest', w.rest)
  el.classList.toggle('is-peak', w.peak)
  el.textContent = w.label
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', `Điểm ${w.label}: ${w.name}`)
  // Điểm tự chấm tên sẵn là "Điểm N": đừng nói hai lần.
  const head = w.name === `Điểm ${w.label}` ? w.name : `Điểm ${w.label} · ${w.name}`
  el.dataset.tip = `${head}${w.rest ? ' · nghỉ đêm' : ''} — kéo để dời chỗ, bấm để ${w.restToggle ? 'đổi nghỉ đêm hoặc xoá' : 'xoá'}`
}

/** Câu giải thích khi rê chuột lên một điểm engine tự đặt (lán, vùng nên nghỉ, mốc giờ). */
/**
 * Ẩn / hiện một chỗ nghỉ máy chủ gợi ý (lán tự chọn, lều của vùng nên nghỉ) theo
 * nút "Ẩn gợi ý chỗ nghỉ"; điểm chỉ để cho biết giờ luôn hiện.
 * Độ đục đi qua `setOpacity` của MapLibre, KHÔNG qua lớp CSS: MapLibre tự ghi
 * `style.opacity` lên điểm mỗi lần bản đồ dựng lại, đè mất mọi quy tắc CSS —
 * lớp `is-hidden` chỉ còn lo chặn chạm (lỗi 26/10: tắt rồi mà lều vẫn hiện).
 */
function restVisibility(marker: maplibregl.Marker, a: MapAuto, shown: boolean): void {
  const hide = !shown && a.suggestion
  if (hide) marker.setOpacity(0, 0)
  else marker.setOpacity()
  marker.getElement().classList.toggle('is-hidden', hide)
}

function autoTip(a: MapAuto): string {
  if (a.zoneLine) return 'Vùng nên nghỉ: chưa có lán, cắm trại trong đoạn tô màu — bấm để chọn chỗ'
  if (a.info) return a.info.sub ? `${a.name} — ${a.info.sub}` : a.name
  return `${a.name} — lán tự chọn để kịp tới trước tối, bấm để giữ hoặc bỏ`
}

/** Bấm vào điểm không được lọt xuống bản đồ (đặt thêm một điểm, hay phóng to). */
function stopMapEvents(el: HTMLElement, onClick: () => void): void {
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  el.addEventListener('dblclick', (e) => e.stopPropagation())
}

const CAR_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v2H3z"/></svg>'
const WALK_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4.5" r="1.8"/><path d="m10 21 2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 2-1 3"/></svg>'
const TENT_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20 12 4l9 16M12 4v16M8.5 20 12 13l3.5 7"/></svg>'

/** Điểm giữa (theo chiều dài) của một đường [lon, lat]. */
function midpoint(c: [number, number][]): [number, number] {
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < c.length; i++) {
    const d = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1])
    seg.push(d)
    total += d
  }
  let left = total / 2
  for (let i = 1; i < c.length; i++) {
    if (left <= seg[i - 1] && seg[i - 1] > 0) {
      const t = left / seg[i - 1]
      return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]
    }
    left -= seg[i - 1]
  }
  return c[c.length - 1]
}

/**
 * Nền tooltip trắng 32×26 (vẽ ở 2×): thân bo tròn + đuôi tam giác ở giữa đáy.
 * Vùng co giãn chừa đuôi ra để đuôi luôn ở giữa. null nếu không có canvas.
 */
function tooltipImage(): ImageData | null {
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 52
  const g = cv.getContext('2d')
  if (!g) return null
  g.fillStyle = '#FFFFFF'
  g.strokeStyle = 'rgba(18,34,43,0.18)'
  g.lineWidth = 2
  g.beginPath()
  g.roundRect(1, 1, 62, 36, 10)
  g.moveTo(26, 37)
  g.lineTo(32, 50)
  g.lineTo(38, 37)
  g.closePath()
  g.fill()
  g.stroke()
  // Lấp vạch viền giữa thân và đuôi.
  g.fillRect(27, 34, 10, 4)
  return g.getImageData(0, 0, 64, 52)
}

/**
 * Viên tròn 22 px (vẽ ở 2×) màu `fill`, viền `ring`, chevron trắng chỉ sang PHẢI
 * — symbol đặt theo nét xoay trục x của ảnh theo chiều đi của nét.
 */
function arrowImage(fill: string, ring: string): ImageData | null {
  const cv = document.createElement('canvas')
  cv.width = 44
  cv.height = 44
  const g = cv.getContext('2d')
  if (!g) return null
  g.fillStyle = fill
  g.strokeStyle = ring
  g.lineWidth = 4
  g.beginPath()
  g.arc(22, 22, 18, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.strokeStyle = '#FFFFFF'
  g.lineWidth = 4.5
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(17, 13)
  g.lineTo(26, 22)
  g.lineTo(17, 31)
  g.stroke()
  return g.getImageData(0, 0, 44, 44)
}
