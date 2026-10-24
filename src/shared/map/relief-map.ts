// Một bản đồ MapLibre theo theme của WayTrek — phần KHỞI ĐỘNG dùng chung cho
// trang lên kế hoạch và các trang xem cung: nền tạm đúng màu theme (không chớp
// trắng), style gốc tự host tô lại theo theme (relief-style), đổi theme thì dựng
// lại style, hỏng thì rơi về URL style gốc, quá hạn thì nói ra.
//
// Lớp riêng của từng trang cài trong `onStyle` — bắn lại SAU MỖI lần đổi style
// (đổi theme xoá sạch mọi source/layer đã cài).

import maplibregl from 'maplibre-gl'
import type { LayerSpecification, MapOptions, StyleSpecification } from 'maplibre-gl'
import { DEM_TILES_URL, MAP_STYLE_URL } from '../config'
import { MAP_INK } from './ink'
import { loadBaseStyle } from './map-style'
import type { StyleJson } from './map-style'
import { reliefStyle } from './relief-style'
import { VN_ISLANDS, VN_ISLANDS_SOURCE, vnIslandsLayers } from './vn-islands'

export const VIETNAM: { center: [number, number]; zoom: number } = { center: [105.6, 18.4], zoom: 5.1 }

/** Style tạm trong lúc tải style thật: chỉ một màu nền đúng theme. */
const placeholder = (dark: boolean): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: 'wt-placeholder', type: 'background', paint: { 'background-color': dark ? '#0B0C0B' : '#F0F5F7' } }],
})

export interface ReliefMapHooks {
  /** Style thật vừa nạp xong (lần đầu hoặc sau đổi theme): cài lại lớp của trang. */
  onStyle(map: maplibregl.Map, first: boolean): void
  /** Không có bản đồ nào dùng được — câu này hiện cho người dùng. */
  onFatal(message: string): void
}

const LOAD_TIMEOUT_MS = 20_000

export class ReliefMap {
  readonly map: maplibregl.Map
  #hooks: ReliefMapHooks
  #logTag: string
  #dark: boolean
  #base: StyleJson | null = null
  #realStyle = false
  #ready = false
  #removed = false
  #loadTimer: ReturnType<typeof setTimeout>

  constructor(
    container: HTMLElement,
    opts: { dark: boolean; logTag: string; mapOptions?: Partial<MapOptions> },
    hooks: ReliefMapHooks,
  ) {
    this.#hooks = hooks
    this.#logTag = opts.logTag
    this.#dark = opts.dark
    this.map = new maplibregl.Map({
      container,
      style: placeholder(opts.dark),
      center: VIETNAM.center,
      zoom: VIETNAM.zoom,
      ...opts.mapOptions,
    })
    this.#loadTimer = setTimeout(() => {
      if (!this.#ready) hooks.onFatal('Không tải được bản đồ. Kiểm tra mạng rồi tải lại trang.')
    }, LOAD_TIMEOUT_MS)
    // 'style.load', không phải 'load': 'load' chờ MỌI ô đầu tiên tải xong (ô độ
    // cao có lúc 5 giây), lớp của trang không được phải chờ theo.
    this.map.on('style.load', () => this.#onStyle())
    // Lỗi lẻ của từng ô (ô độ cao ngoài vùng phục vụ…) không chặn gì; chỉ ghi lại.
    this.map.on('error', (e) => console.warn(`${opts.logTag} map:`, e.error?.message ?? e))
    loadBaseStyle()
      .then((base) => {
        this.#base = base
        this.#apply()
      })
      .catch((e) => {
        // Không dựng được bản theo theme: dùng thẳng URL style gốc (bản sáng,
        // không bóng địa hình) — bản đồ vẫn dùng được, chỉ không đúng theme.
        console.warn(`${opts.logTag} map: không dựng được style theo theme —`, e)
        if (this.#removed) return
        this.#realStyle = true
        this.map.setStyle(MAP_STYLE_URL)
      })
  }

  get ready(): boolean {
    return this.#ready
  }

  get dark(): boolean {
    return this.#dark
  }

  setTheme(dark: boolean): void {
    if (dark === this.#dark) return
    this.#dark = dark
    this.#apply()
  }

  destroy(): void {
    this.#removed = true
    clearTimeout(this.#loadTimer)
    this.map.remove()
  }

  #apply(): void {
    if (this.#removed || !this.#base) return
    this.#realStyle = true
    this.#ready = false
    this.map.setStyle(reliefStyle(this.#base, { demTiles: DEM_TILES_URL, dark: this.#dark }) as unknown as StyleSpecification, {
      diff: false,
    })
  }

  #onStyle(): void {
    // Style về SAU khi bản đồ đã bị gỡ (React dựng lại) vẫn bắn sự kiện; nền tạm thì bỏ qua.
    if (this.#removed || !this.#realStyle) return
    clearTimeout(this.#loadTimer)
    const first = !this.#ready
    this.#ready = true
    this.#installIslands()
    this.#hooks.onStyle(this.map, first)
  }

  /** Hoàng Sa, Trường Sa (vn-islands.ts): lớp của MỌI bản đồ, cài trước lớp của trang. */
  #installIslands(): void {
    try {
      this.map.addSource(VN_ISLANDS_SOURCE, { type: 'geojson', data: VN_ISLANDS })
      for (const layer of vnIslandsLayers(MAP_INK[this.#dark ? 'dark' : 'light'])) {
        this.map.addLayer(layer as unknown as LayerSpecification)
      }
    } catch (e) {
      // Không chặn lớp của trang — bản đồ vẫn dùng được — nhưng phải để lại dấu vết.
      console.warn(`${this.#logTag} map: không vẽ được lớp Hoàng Sa, Trường Sa —`, e)
    }
  }
}
