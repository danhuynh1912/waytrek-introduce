// Bản đồ trang Khám phá: mỗi cung một chấm, rê chuột / chọn thì chấm nổi lên.
// React chỉ gọi các hàm set* và nhận sự kiện qua `ExploreMapHandlers` — không
// component nào đụng thẳng vào maplibregl.

import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { LABEL_FONT, MAP_INK } from '@/shared/map/ink'
import { ReliefMap } from '@/shared/map/relief-map'
import { hideTipAt, showTipAt } from '@/shared/tooltip'
import type { TrailSummary } from '../../core/trails'

export interface ExploreMapHandlers {
  onSelect(trailId: string | null): void
  onFatal(message: string): void
}

const SRC = 'st-trails'
const DOT = 'st-trails-dot'
const RING = 'st-trails-ring'
const LABEL = 'st-trails-label'

export class ExploreMap {
  #rm: ReliefMap
  #map: MlMap
  #trails: TrailSummary[] = []
  #selected: string | null = null
  #hover: string | null = null
  #fitted = false
  /** Cung đang có tooltip trên canvas — null: không có gì. */
  #tipId: string | null = null

  constructor(container: HTMLElement, dark: boolean, h: ExploreMapHandlers) {
    this.#rm = new ReliefMap(
      container,
      { dark, logTag: 'explore', mapOptions: { attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false } },
      { onStyle: (m) => this.#install(m), onFatal: h.onFatal },
    )
    this.#map = this.#rm.map
    this.#map.touchZoomRotate.disableRotation()
    this.#map.on('click', (e) => {
      const f = this.#rm.ready ? this.#map.queryRenderedFeatures(e.point, { layers: [DOT, LABEL] })[0] : undefined
      h.onSelect(f ? String(f.properties?.id) : null)
    })
    for (const id of [DOT, LABEL]) {
      this.#map.on('mouseenter', id, () => (this.#map.getCanvas().style.cursor = 'pointer'))
      this.#map.on('mouseleave', id, () => (this.#map.getCanvas().style.cursor = ''))
    }
    // Nhìn xa chấm không có tên (#paintState): rê chuột lên chấm là biết cung nào.
    this.#map.on('mousemove', (e) => this.#hoverTip(e.point))
    this.#map.on('mouseout', () => this.#clearTip())
    this.#map.on('movestart', () => this.#clearTip())
  }

  destroy(): void {
    this.#clearTip()
    this.#rm.destroy()
  }

  #hoverTip(p: { x: number; y: number }): void {
    if (!this.#rm.ready) return
    const f = this.#map.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers: [DOT] })[0]
      ?? this.#map.queryRenderedFeatures([p.x, p.y], { layers: [LABEL] })[0]
    const t = f ? this.#trails.find((x) => x.id === String(f.properties?.id)) : undefined
    if (!t || t.lat == null || t.lng == null) return this.#clearTip()
    if (t.id === this.#tipId) return
    // Neo vào chính cái chấm, không vào con trỏ: lắc chuột trên chấm thì chữ đứng yên.
    const box = this.#map.getCanvas().getBoundingClientRect()
    const s = this.#map.project([t.lng, t.lat])
    // Chỉ nhớ "đang giải thích" khi tooltip nhận lời (con trỏ là chuột).
    if (showTipAt(box.left + s.x, box.top + s.y, `${t.name}${t.region ? ` · ${t.region}` : ''} — bấm để xem nhanh`)) this.#tipId = t.id
  }

  #clearTip(): void {
    if (this.#tipId == null) return
    this.#tipId = null
    hideTipAt()
  }

  setTheme(dark: boolean): void {
    this.#rm.setTheme(dark)
  }

  resize(): void {
    this.#map.resize()
  }

  setTrails(list: TrailSummary[]): void {
    this.#trails = list
    this.#push()
    this.#fitOnce()
  }

  /** Chọn một cung (từ danh sách hoặc từ địa chỉ trang): chấm nổi lên và bản đồ bay tới. */
  setSelected(id: string | null): void {
    this.#selected = id
    this.#paintState()
    this.#flyToSelected(700)
  }

  #flyToSelected(duration: number): boolean {
    const t = this.#selected ? this.#trails.find((x) => x.id === this.#selected) : null
    if (t?.lat == null || t.lng == null) return false
    this.#map.easeTo({ center: [t.lng, t.lat], zoom: Math.max(this.#map.getZoom(), 10.5), duration })
    return true
  }

  setHover(id: string | null): void {
    this.#hover = id
    this.#paintState()
  }

  #install(m: MlMap): void {
    const C = MAP_INK[this.#rm.dark ? 'dark' : 'light']
    m.addSource(SRC, { type: 'geojson', data: this.#data() })
    m.addLayer({
      id: RING,
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'id'], ''],
      paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': C.route, 'circle-stroke-width': 2 },
    })
    m.addLayer({
      id: DOT,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 6.5, 14, 8],
        'circle-color': C.route,
        'circle-stroke-color': C.casing,
        'circle-stroke-width': 1.8,
      },
    })
    m.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SRC,
      // Nhìn xa thì chỉ cung đang chọn / đang rê có tên; gần lại mới hiện hết.
      filter: ['any', ['>=', ['zoom'], 8], ['==', ['get', 'id'], '']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT.bold,
        'text-size': 12.5,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.6 },
    })
    this.#paintState()
  }

  #data(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.#trails
        .filter((t) => t.lat != null && t.lng != null)
        .map((t) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [t.lng!, t.lat!] },
          properties: { id: t.id, name: t.name },
        })),
    }
  }

  #push(): void {
    if (!this.#rm.ready) return
    ;(this.#map.getSource(SRC) as GeoJSONSource | undefined)?.setData(this.#data())
  }

  #paintState(): void {
    if (!this.#rm.ready || !this.#map.getLayer(RING)) return
    const focus = this.#hover ?? this.#selected ?? ''
    this.#map.setFilter(RING, ['==', ['get', 'id'], focus])
    this.#map.setFilter(LABEL, ['any', ['>=', ['zoom'], 8], ['==', ['get', 'id'], focus]])
  }

  /**
   * Khung nhìn đầu, một lần: mở bằng link có sẵn cung thì tới thẳng cung đó,
   * không thì ôm mọi cung. Đừng giật lại khi người dùng đã kéo bản đồ.
   */
  #fitOnce(): void {
    if (this.#fitted) return
    if (this.#flyToSelected(0)) {
      this.#fitted = true
      return
    }
    const pts = this.#trails.filter((t) => t.lat != null && t.lng != null)
    if (pts.length === 0) return
    this.#fitted = true
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const t of pts) {
      w = Math.min(w, t.lng!)
      e = Math.max(e, t.lng!)
      s = Math.min(s, t.lat!)
      n = Math.max(n, t.lat!)
    }
    this.#map.fitBounds([[w, s], [e, n]], { padding: 48, duration: 0, maxZoom: 9 })
  }
}
