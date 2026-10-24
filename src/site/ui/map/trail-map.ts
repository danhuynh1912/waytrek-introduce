// Bản đồ của trang cung: nét lộ trình (giữ ranh giới đoạn, chặng xe tô cam như
// app), đỉnh, điểm đánh dấu, và chấm con trỏ đi theo biểu đồ độ cao.

import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import { LABEL_FONT, MAP_INK } from '@/shared/map/ink'
import { ReliefMap } from '@/shared/map/relief-map'
import type { DrawLine } from '../../core/geometry'

export interface MapPoint {
  id: string
  name: string
  lat: number
  lng: number
}

const S = { route: 'st-route', pois: 'st-pois', peak: 'st-peak', cursor: 'st-cursor' }
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })
const point = (p: MapPoint): Feature => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name } })

export class TrailMap {
  #rm: ReliefMap
  #map: MlMap
  #lines: DrawLine[] = []
  #pois: MapPoint[] = []
  #peak: MapPoint | null = null
  #cursor: { lat: number; lng: number } | null = null
  #bbox: [number, number, number, number] | null = null

  constructor(container: HTMLElement, dark: boolean, onFatal: (message: string) => void) {
    this.#rm = new ReliefMap(
      container,
      {
        dark,
        logTag: 'trail',
        mapOptions: {
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          // Bản đồ nằm giữa một trang cuộn: cuộn trang không được bị bản đồ "nuốt".
          cooperativeGestures: true,
          locale: {
            'CooperativeGesturesHandler.WindowsHelpText': 'Giữ Ctrl rồi cuộn để phóng to bản đồ',
            'CooperativeGesturesHandler.MacHelpText': 'Giữ ⌘ rồi cuộn để phóng to bản đồ',
            'CooperativeGesturesHandler.MobileHelpText': 'Dùng hai ngón tay để di chuyển bản đồ',
          },
        },
      },
      { onStyle: (m) => this.#install(m), onFatal },
    )
    this.#map = this.#rm.map
    this.#map.touchZoomRotate.disableRotation()
  }

  destroy(): void {
    this.#rm.destroy()
  }

  setTheme(dark: boolean): void {
    this.#rm.setTheme(dark)
  }

  /** Nét lộ trình + khung nhìn ôm trọn nó. */
  setRoute(lines: DrawLine[], bbox: [number, number, number, number] | null): void {
    this.#lines = lines
    this.#bbox = bbox
    this.#set(S.route, this.#routeData())
    this.fitRoute(false)
  }

  setPois(pois: MapPoint[], peak: MapPoint | null): void {
    this.#pois = pois
    this.#peak = peak
    this.#set(S.pois, { type: 'FeatureCollection', features: pois.map(point) })
    this.#set(S.peak, { type: 'FeatureCollection', features: peak ? [point(peak)] : [] })
  }

  setCursor(at: { lat: number; lng: number } | null): void {
    this.#cursor = at
    this.#set(S.cursor, this.#cursorData())
  }

  focus(at: { lat: number; lng: number }): void {
    this.#map.easeTo({ center: [at.lng, at.lat], zoom: Math.max(this.#map.getZoom(), 14.5), duration: 600 })
  }

  fitRoute(animate = true): void {
    if (!this.#bbox) return
    const [w, s, e, n] = this.#bbox
    // Đáy chừa rộng hơn: dòng ghi công của bản đồ nằm ở góc dưới.
    this.#map.fitBounds([[w, s], [e, n]], { padding: { top: 40, right: 40, bottom: 60, left: 40 }, duration: animate ? 600 : 0, maxZoom: 15 })
  }

  #routeData(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.#lines.map((l) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: l.coords.map((c) => [c[0], c[1]]) },
        properties: { vehicle: l.vehicle },
      })),
    }
  }

  #cursorData(): FeatureCollection {
    const c = this.#cursor
    return c ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: {} }] } : empty()
  }

  #set(source: string, data: FeatureCollection): void {
    if (!this.#rm.ready) return
    ;(this.#map.getSource(source) as GeoJSONSource | undefined)?.setData(data)
  }

  #install(m: MlMap): void {
    const C = MAP_INK[this.#rm.dark ? 'dark' : 'light']
    m.addSource(S.route, { type: 'geojson', data: this.#routeData() })
    m.addSource(S.pois, { type: 'geojson', data: { type: 'FeatureCollection', features: this.#pois.map(point) } })
    m.addSource(S.peak, { type: 'geojson', data: { type: 'FeatureCollection', features: this.#peak ? [point(this.#peak)] : [] } })
    m.addSource(S.cursor, { type: 'geojson', data: this.#cursorData() })
    m.addLayer({
      id: 'st-route-casing',
      type: 'line',
      source: S.route,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.casing, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 8], 'line-opacity': 0.9 },
    })
    m.addLayer({
      id: 'st-route-line',
      type: 'line',
      source: S.route,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['get', 'vehicle'], C.vehicle, C.route],
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.6, 15, 4.5],
      },
    })
    m.addLayer({
      id: 'st-pois-dot',
      type: 'circle',
      source: S.pois,
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 15, 6], 'circle-color': C.water, 'circle-stroke-color': C.poiStroke, 'circle-stroke-width': 1.5 },
    })
    m.addLayer({
      id: 'st-pois-label',
      type: 'symbol',
      source: S.pois,
      minzoom: 13,
      layout: { 'text-field': ['get', 'name'], 'text-font': LABEL_FONT.regular, 'text-size': 11.5, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': C.poiLabel, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    })
    m.addLayer({
      id: 'st-peak-dot',
      type: 'circle',
      source: S.peak,
      paint: { 'circle-radius': 6.5, 'circle-color': C.peak, 'circle-stroke-color': C.peakStroke, 'circle-stroke-width': 2 },
    })
    m.addLayer({
      id: 'st-peak-label',
      type: 'symbol',
      source: S.peak,
      layout: { 'text-field': ['get', 'name'], 'text-font': LABEL_FONT.bold, 'text-size': 12.5, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-allow-overlap': true },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
    })
    m.addLayer({
      id: 'st-cursor-dot',
      type: 'circle',
      source: S.cursor,
      paint: { 'circle-radius': 6, 'circle-color': C.casing, 'circle-stroke-color': C.route, 'circle-stroke-width': 3 },
    })
  }
}
