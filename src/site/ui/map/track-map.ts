// Bản đồ của trang theo dõi chuyến đi: đường của kế hoạch (chặng xe tô màu chặng
// xe như app), mốc của kế hoạch, và vị trí mới nhất của người leo.
//
// Khung nhìn chỉ ôm MỘT lần lúc có dữ liệu: các lượt làm tươi sau chỉ dời chấm
// vị trí — người xem đang phóng vào một khúc thì không bị kéo về toàn cảnh.

import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { LABEL_FONT, MAP_INK } from '@/shared/map/ink'
import { ReliefMap } from '@/shared/map/relief-map'
import type { TrackLine, TrackPosition, TrackStop } from '../../core/tracker'

const S = { route: 'tk-route', stops: 'tk-stops', here: 'tk-here' }

export class TrackMap {
  #rm: ReliefMap
  #map: MlMap
  #lines: TrackLine[] = []
  #stops: TrackStop[] = []
  #here: TrackPosition | null = null
  #fitted = false

  constructor(container: HTMLElement, dark: boolean, onFatal: (message: string) => void) {
    this.#rm = new ReliefMap(
      container,
      {
        dark,
        logTag: 'track',
        mapOptions: {
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
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

  set(lines: TrackLine[], stops: TrackStop[], here: TrackPosition | null, bbox: [number, number, number, number] | null): void {
    this.#lines = lines
    this.#stops = stops
    this.#here = here
    this.#put(S.route, this.#routeData())
    this.#put(S.stops, this.#stopsData())
    this.#put(S.here, this.#hereData())
    if (!this.#fitted && bbox) {
      this.#fitted = true
      this.fit(bbox, false)
    }
  }

  fit(bbox: [number, number, number, number], animate = true): void {
    const [w, s, e, n] = bbox
    // Đáy chừa rộng: dòng ghi công của bản đồ nằm ở góc dưới, chấm vị trí sát
    // mép dưới thì bị nó đè.
    this.#map.fitBounds([[w, s], [e, n]], { padding: { top: 48, right: 48, bottom: 96, left: 48 }, duration: animate ? 600 : 0, maxZoom: 14 })
  }

  focus(at: { lat: number; lng: number }): void {
    this.#map.easeTo({ center: [at.lng, at.lat], zoom: Math.max(this.#map.getZoom(), 13.5), duration: 600 })
  }

  #routeData(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.#lines.map((l) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: l.coords },
        properties: { vehicle: l.vehicle },
      })),
    }
  }

  #stopsData(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.#stops.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { name: s.name, peak: s.kind === 'peak', rest: s.rest },
      })),
    }
  }

  #hereData(): FeatureCollection {
    const h = this.#here
    return {
      type: 'FeatureCollection',
      features: h ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [h.lng, h.lat] }, properties: {} }] : [],
    }
  }

  #put(source: string, data: FeatureCollection): void {
    if (!this.#rm.ready) return
    ;(this.#map.getSource(source) as GeoJSONSource | undefined)?.setData(data)
  }

  #install(m: MlMap): void {
    const C = MAP_INK[this.#rm.dark ? 'dark' : 'light']
    m.addSource(S.route, { type: 'geojson', data: this.#routeData() })
    m.addSource(S.stops, { type: 'geojson', data: this.#stopsData() })
    m.addSource(S.here, { type: 'geojson', data: this.#hereData() })
    m.addLayer({
      id: 'tk-route-casing',
      type: 'line',
      source: S.route,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.casing, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 15, 8], 'line-opacity': 0.9 },
    })
    m.addLayer({
      id: 'tk-route-line',
      type: 'line',
      source: S.route,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['get', 'vehicle'], C.vehicle, C.route],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.2, 15, 4.5],
      },
    })
    m.addLayer({
      id: 'tk-stops-dot',
      type: 'circle',
      source: S.stops,
      paint: {
        'circle-radius': ['case', ['get', 'peak'], 6, 4.5],
        'circle-color': ['case', ['get', 'peak'], C.peak, C.route],
        'circle-stroke-color': C.peakStroke,
        'circle-stroke-width': 1.5,
      },
    })
    m.addLayer({
      id: 'tk-stops-label',
      type: 'symbol',
      source: S.stops,
      minzoom: 11,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT.regular,
        'text-size': 12,
        'text-offset': [0, 1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.4 },
    })
    // Vị trí người leo: chấm xanh dương có quầng — màu "bạn ở đây" quen thuộc,
    // khác hẳn nét lộ trình (teal) và chặng xe (cam). Không nhấp nháy (luật
    // thiết kế).
    m.addLayer({
      id: 'tk-here-halo',
      type: 'circle',
      source: S.here,
      paint: { 'circle-radius': 16, 'circle-color': C.water, 'circle-opacity': 0.25 },
    })
    m.addLayer({
      id: 'tk-here-dot',
      type: 'circle',
      source: S.here,
      paint: { 'circle-radius': 7, 'circle-color': C.water, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 },
    })
  }
}
