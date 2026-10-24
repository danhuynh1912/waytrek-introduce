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
  StyleSpecification,
} from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import { DEM_TILES_URL, MAP_STYLE_URL } from '../../config'
import { decodePolyline } from '../../core/polyline'
import { RELIEF_HILLSHADE, RELIEF_TINT, reliefStyle } from '../../core/relief-style'
import { nearestOnLines, SNAP_PX } from '../../core/snap'
import type { DrawLine } from '../../core/timeline'
import type { PoiPin, RouteLine, TrailPin } from '../../core/types'
import type { Bbox } from '../../data/api'
import { loadBaseStyle } from '../../data/map-style'
import type { StyleJson } from '../../data/map-style'
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
  /** Điểm đầu / cuối không có ô nghỉ đêm. */
  middle: boolean
}

export interface MapAuto extends LatLng {
  id: string
  name: string
  /** Vùng nên nghỉ (polyline mã hoá) — có thì đây là chỗ cắm trại, không phải lán. */
  zoneLine?: string
}

export type LayerKey = 'routes' | 'pois' | 'peaks' | 'terrain'

export interface PlanMapHandlers {
  onMapClick(at: LatLng, snapped: Snapped | null): void
  onAddPeak(t: TrailPin): void
  onAddPoi(p: PoiPin): void
  onWaypointMoved(id: string, at: LatLng, snapped: Snapped | null): void
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
interface Palette {
  route: string
  casing: string
  straight: string
  vehicle: string
  pending: string
  catalog: string
  catalogOpacity: number
  peak: string
  peakStroke: string
  label: string
  halo: string
  poiLabel: string
  shelter: string
  water: string
  other: string
  poiStroke: string
  zone: string
  zoneOpacity: number
}

const PALETTE: Record<'light' | 'dark', Palette> = {
  light: {
    route: '#2F677A',
    casing: '#FFFFFF',
    straight: '#B4690E',
    vehicle: '#E8821E',
    pending: '#6B7C85',
    catalog: '#5BA3B8',
    catalogOpacity: 0.85,
    peak: '#12222B',
    peakStroke: '#FFFFFF',
    label: '#12222B',
    halo: '#FFFFFF',
    poiLabel: '#2A3A42',
    shelter: '#8A5A2B',
    water: '#2B7BB9',
    other: '#6B7C85',
    poiStroke: '#FFFFFF',
    zone: '#B4690E',
    zoneOpacity: 0.22,
  },
  dark: {
    route: '#7FBDD0',
    casing: '#050605',
    straight: '#F5D77A',
    vehicle: '#E8821E',
    pending: '#8E918A',
    catalog: '#5BA3B8',
    catalogOpacity: 0.55,
    peak: '#E6E8E3',
    peakStroke: '#0B0C0B',
    label: '#D4D7CF',
    halo: 'rgba(11,12,11,0.9)',
    poiLabel: '#A7AAA2',
    shelter: '#C08A52',
    water: '#5D9FD0',
    other: '#8E918A',
    poiStroke: '#0B0C0B',
    zone: '#F5D77A',
    zoneOpacity: 0.2,
  },
}

const LAYERS: Record<LayerKey, string[]> = {
  routes: ['wt-routes-line'],
  pois: ['wt-pois-dot', 'wt-pois-label'],
  peaks: ['wt-trails-dot', 'wt-trails-label'],
  terrain: [RELIEF_HILLSHADE, RELIEF_TINT],
}

const VIETNAM: { center: [number, number]; zoom: number } = { center: [105.6, 18.4], zoom: 5.1 }
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })

/** Style tạm trong lúc tải style thật: chỉ một màu nền đúng theme, không chớp trắng. */
const placeholder = (dark: boolean): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: 'wt-placeholder', type: 'background', paint: { 'background-color': dark ? '#0B0C0B' : '#F0F5F7' } }],
})

export class PlanMap {
  #map: MlMap
  #h: PlanMapHandlers
  #ready = false
  #dark: boolean
  /** Style đang dùng là style thật (đủ glyph để cài lớp chữ), không phải style tạm. */
  #realStyle = false
  #base: StyleJson | null = null
  #trails: TrailPin[] = []
  #pois: PoiPin[] = []
  #routes = new Map<string, RouteLine>()
  #lines: DrawLine[] = []
  #hover: LatLng | null = null
  #visible: Record<LayerKey, boolean> = { routes: true, pois: true, peaks: true, terrain: true }
  #wps = new Map<string, { marker: Marker; data: MapWaypoint }>()
  #autos = new Map<string, { marker: Marker; data: MapAuto }>()
  #zones: string[] = []
  #popup: Popup | null = null
  #suppressClickUntil = 0
  #loadTimer: ReturnType<typeof setTimeout>
  #removed = false

  constructor(container: HTMLElement, handlers: PlanMapHandlers, dark: boolean) {
    this.#h = handlers
    this.#dark = dark
    this.#map = new maplibregl.Map({
      container,
      style: placeholder(dark),
      center: VIETNAM.center,
      zoom: VIETNAM.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    this.#map.touchZoomRotate.disableRotation()
    this.#loadTimer = setTimeout(() => {
      if (!this.#ready) this.#h.onFatal('Không tải được bản đồ. Kiểm tra mạng rồi tải lại trang.')
    }, 20_000)
    // 'style.load', không phải 'load': 'load' chờ MỌI ô đầu tiên tải xong (ô độ
    // cao có lúc 5 giây), các lớp của kế hoạch không được phải chờ theo. Bắn lại
    // sau mỗi lần đổi style (đổi theme) — lớp của kế hoạch cài lại từ dữ liệu đang giữ.
    this.#map.on('style.load', () => this.#onStyle())
    this.#map.on('error', (e) => {
      // Lỗi lẻ của từng ô (ô độ cao ngoài vùng phục vụ…) không chặn gì; chỉ
      // ghi lại. Style không nạp được thì hẹn giờ ở trên nói ra.
      console.warn('plan map:', e.error?.message ?? e)
    })
    this.#map.on('click', (e) => this.#onClick(e))
    this.#map.on('moveend', () => this.#emitView())
    for (const id of ['wt-trails-dot', 'wt-trails-label', 'wt-pois-dot']) {
      this.#map.on('mouseenter', id, () => (this.#map.getCanvas().style.cursor = 'pointer'))
      this.#map.on('mouseleave', id, () => (this.#map.getCanvas().style.cursor = ''))
    }
    loadBaseStyle()
      .then((base) => {
        this.#base = base
        this.#applyStyle()
      })
      .catch((e) => {
        // Không tải được style gốc để dựng bản theo theme: dùng thẳng URL (bản
        // sáng, không bóng địa hình) — bản đồ vẫn dùng được, chỉ không đúng theme.
        console.warn('plan map: không dựng được style theo theme —', e)
        if (this.#removed) return
        this.#realStyle = true
        this.#map.setStyle(MAP_STYLE_URL)
      })
  }

  destroy(): void {
    this.#removed = true
    clearTimeout(this.#loadTimer)
    this.#popup?.remove()
    this.#map.remove()
  }

  /** Đổi theme: dựng lại style từ style gốc đã có, lớp của kế hoạch tự cài lại. */
  setTheme(dark: boolean): void {
    if (dark === this.#dark) return
    this.#dark = dark
    this.#applyStyle()
  }

  #applyStyle(): void {
    if (this.#removed || !this.#base) return
    this.#realStyle = true
    this.#ready = false
    this.#map.setStyle(reliefStyle(this.#base, { demTiles: DEM_TILES_URL, dark: this.#dark }) as unknown as StyleSpecification, {
      diff: false,
    })
  }

  #onStyle(): void {
    // Style về SAU khi bản đồ đã bị gỡ (React dựng lại) vẫn bắn sự kiện.
    if (this.#removed || !this.#realStyle) return
    clearTimeout(this.#loadTimer)
    this.#installLayers(PALETTE[this.#dark ? 'dark' : 'light'])
    const first = !this.#ready
    this.#ready = true
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
        'line-color': C.catalog,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 14, 3],
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
    planLine('wt-plan-straight', 'straight', C.straight, 4, [1.4, 1.1])
    planLine('wt-plan-vehicle', 'vehicle', C.vehicle, 4, [2.2, 1.2])
    planLine('wt-plan-pending', 'pending', C.pending, 3, [1, 1.4])

    m.addSource('wt-pois', { type: 'geojson', data: empty() })
    m.addLayer({
      id: 'wt-pois-dot',
      type: 'circle',
      source: 'wt-pois',
      minzoom: 9,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 14, 6],
        'circle-color': ['match', ['get', 'kind'], ['shelter', 'camp'], C.shelter, 'water', C.water, C.other],
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

  setLayer(key: LayerKey, on: boolean): void {
    this.#visible[key] = on
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
    const features: Feature[] = []
    for (const r of this.#routes.values()) {
      for (const seg of r.segments) {
        if (seg.length < 2) continue
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: seg.map(([lon, lat]) => [lon / 1e6, lat / 1e6]) },
          properties: { routeId: r.routeId, trailId: r.trailId, trailName: r.trailName },
        })
      }
    }
    this.#push('wt-routes', { type: 'FeatureCollection', features })
  }

  #pushPlan(): void {
    this.#push('wt-plan', {
      type: 'FeatureCollection',
      features: this.#lines.map((l) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: l.encoded ? decodePolyline(l.encoded) : (l.ends ?? []) },
        properties: { kind: l.kind },
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
      marker.on('dragstart', () => this.#closePopup())
      marker.on('dragend', () => {
        this.#suppressClickUntil = performance.now() + 300
        const ll = marker.getLngLat()
        this.#h.onWaypointMoved(entry.data.id, { lat: ll.lat, lng: ll.lng }, this.#snapAt(this.#map.project(ll)))
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
        continue
      }
      const el = document.createElement('div')
      el.className = `pl-mk pl-mk-auto${a.zoneLine ? ' is-zone' : ''}`
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', a.zoneLine ? 'Vùng nên nghỉ — cắm trại' : `${a.name} — lán tự chọn`)
      el.innerHTML = TENT_SVG
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([a.lng, a.lat]).addTo(this.#map)
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
    this.#map.fitBounds(bounds, { padding, maxZoom: 14, duration: animate ? 600 : 0 })
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
    const layers = ['wt-pois-dot', 'wt-trails-dot', 'wt-trails-label'].filter(
      (id) => this.#map.getLayer(id) && this.#map.getLayoutProperty(id, 'visibility') !== 'none',
    )
    const hits = layers.length
      ? this.#map.queryRenderedFeatures([[x - 7, y - 7], [x + 7, y + 7]], { layers })
      : []
    const poi = hits.find((f) => f.layer.id === 'wt-pois-dot')
    if (poi) {
      const p = this.#pois.find((q) => q.poiId === poi.properties.poiId)
      if (p) return this.#openPoiPopup(p)
    }
    const trail = hits.find((f) => f.layer.id.startsWith('wt-trails'))
    if (trail) {
      const t = this.#trails.find((q) => q.trailId === trail.properties.trailId)
      if (t) return this.#openTrailPopup(t)
    }
    this.#h.onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }, this.#snapAt(e.point))
  }

  /** Điểm gần nhất trên một lộ trình công khai trong vòng SNAP_PX quanh `p`. */
  #snapAt(p: { x: number; y: number }): Snapped | null {
    if (!this.#visible.routes || !this.#map.getLayer('wt-routes-line')) return null
    const r = SNAP_PX
    const near: MapGeoJSONFeature[] = this.#map.queryRenderedFeatures(
      [[p.x - r, p.y - r], [p.x + r, p.y + r]],
      { layers: ['wt-routes-line'] },
    )
    const ids = [...new Set(near.map((f) => String(f.properties.routeId)))]
    const lines: { x: number; y: number }[][] = []
    const owners: { route: RouteLine; seg: [number, number][] }[] = []
    for (const id of ids) {
      const route = this.#routes.get(id)
      if (!route) continue
      for (const seg of route.segments) {
        lines.push(seg.map(([lon, lat]) => this.#map.project([lon / 1e6, lat / 1e6])))
        owners.push({ route, seg })
      }
    }
    const hit = nearestOnLines(p, lines, r)
    if (!hit) return null
    const a = lines[hit.line][hit.edge]
    const b = lines[hit.line][hit.edge + 1]
    const ll = this.#map.unproject([a.x + (b.x - a.x) * hit.t, a.y + (b.y - a.y) * hit.t])
    const { route } = owners[hit.line]
    return { lat: ll.lat, lng: ll.lng, trailId: route.trailId, trailName: route.trailName }
  }

  // ─── Bảng nhỏ trên bản đồ ───────────────────────────────────────────────

  #open(at: LatLng, content: HTMLElement): void {
    this.#closePopup()
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '280px', offset: 14, className: 'pl-popup' })
      .setLngLat([at.lng, at.lat])
      .setDOMContent(content)
      .addTo(this.#map)
    popup.on('close', () => {
      if (this.#popup === popup) this.#popup = null
    })
    this.#popup = popup
  }

  #closePopup(): void {
    const p = this.#popup
    this.#popup = null
    p?.remove()
  }

  #openTrailPopup(t: TrailPin): void {
    const sub = [t.region, t.peakEleM ? `${t.peakEleM.toLocaleString('vi-VN')} m` : null].filter(Boolean).join(' · ')
    this.#open(t, card(t.name, sub, [
      { label: t.hasPeak ? 'Thêm đỉnh vào kế hoạch' : 'Thêm vào kế hoạch', primary: true, run: () => this.#h.onAddPeak(t) },
    ], () => this.#closePopup()))
  }

  #openPoiPopup(p: PoiPin): void {
    const trail = this.#trails.find((t) => t.trailId === p.trailId)
    const sub = [poiKindLabel(p.kind), trail?.name].filter(Boolean).join(' · ')
    this.#open(p, card(p.name, sub, [
      { label: 'Thêm vào kế hoạch', primary: true, run: () => this.#h.onAddPoi(p) },
    ], () => this.#closePopup()))
  }

  #openWaypointPopup(w: MapWaypoint): void {
    const actions: CardAction[] = []
    if (w.middle) {
      actions.push({
        label: w.rest ? 'Bỏ nghỉ đêm ở đây' : 'Nghỉ đêm ở đây',
        primary: !w.rest,
        run: () => this.#h.onWaypointToggleRest(w.id),
      })
    }
    actions.push({ label: 'Xoá điểm', danger: true, run: () => this.#h.onWaypointRemove(w.id) })
    this.#open(w, card(w.name, `Điểm ${w.label}`, actions, () => this.#closePopup()))
  }

  #openAutoPopup(a: MapAuto): void {
    if (a.zoneLine) {
      this.#open(a, card('Vùng nên nghỉ', 'Chưa có lán — nghỉ đêm trong đoạn tô màu, mang lều', [
        { label: 'Đặt chỗ cắm trại', primary: true, run: () => this.#h.onKeepAuto(a.id) },
        { label: 'Không mang lều', run: () => this.#h.onDismissAuto(a.id) },
      ], () => this.#closePopup()))
      return
    }
    this.#open(a, card(a.name, 'Lán tự chọn để kịp tới trước tối', [
      { label: 'Giữ', primary: true, run: () => this.#h.onKeepAuto(a.id) },
      { label: 'Bỏ', run: () => this.#h.onDismissAuto(a.id) },
    ], () => this.#closePopup()))
  }
}

interface CardAction {
  label: string
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
  el.title = w.name
}

/** Bấm vào điểm không được lọt xuống bản đồ (đặt thêm một điểm, hay phóng to). */
function stopMapEvents(el: HTMLElement, onClick: () => void): void {
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  el.addEventListener('dblclick', (e) => e.stopPropagation())
}

const TENT_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20 12 4l9 16M12 4v16M8.5 20 12 13l3.5 7"/></svg>'
