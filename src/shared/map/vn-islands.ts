// Hoàng Sa, Trường Sa trên MỌI bản đồ của web — chép từ app WayTrek: toạ độ +
// tên ở `way_trek/lib/core/data/vn_islands_geojson.dart`, ba lớp ở
// `way_trek/lib/core/map/vn_islands_layers.dart`. App là chủ: thêm hay đổi tên
// một đảo thì sửa ở app trước rồi chép sang đây.
//
// Vì sao phải tự vẽ: style tự host TẮT mọi nhãn nền trong hộp hai quần đảo
// (`way_trek/scripts/map_style.py`), còn ô nền không vẽ đảo ở zoom xa — thiếu
// lớp này thì khung nhìn cả nước là một mặt biển trống. Cùng luật với app:
//   · chấm từng đảo ở MỌI zoom, bán kính co theo zoom;
//   · tên từng đảo chỉ từ zoom 9 và không được đè nhau (zoom xa thì díu vào nhau);
//   · tên quần đảo ở mọi zoom, được đè lên nhãn khác.
// Chữ đổi theo theme của web (sau nó là mặt biển theo theme, như mọi nhãn khác
// của `MAP_INK`); chấm giữ đúng màu của app.
//
// Thuần (không MapLibre): `relief-map.ts` cài cho mọi bản đồ, test kiểm luật ở đây.

import { LABEL_FONT } from './ink.ts'
import type { MapInk } from './ink.ts'

export const VN_ISLANDS_SOURCE = 'vn-islands'
/** Tên từng đảo hiện từ mức này (app: `VnIslandsLayers.islandMinZoom`). */
export const ISLAND_MIN_ZOOM = 9

type IslandKind = 'group' | 'island'

interface IslandFeature {
  type: 'Feature'
  properties: { name: string; kind: IslandKind }
  geometry: { type: 'Point'; coordinates: [number, number] }
}

const at = (name: string, kind: IslandKind, lng: number, lat: number): IslandFeature => ({
  type: 'Feature',
  properties: { name, kind },
  geometry: { type: 'Point', coordinates: [lng, lat] },
})

export const VN_ISLANDS: { type: 'FeatureCollection'; features: IslandFeature[] } = {
  type: 'FeatureCollection',
  features: [
    at('QUẦN ĐẢO HOÀNG SA', 'group', 112.0, 16.5),
    at('QUẦN ĐẢO TRƯỜNG SA', 'group', 113.5, 9.0),
    // Hoàng Sa
    at('Đảo Phú Lâm', 'island', 112.3352, 16.8302),
    at('Nhóm đảo Lưỡi Liềm', 'island', 111.6, 16.5),
    at('Đá Lồi', 'island', 111.6833, 16.25),
    at('Đảo Tri Tôn', 'island', 111.2, 15.7833),
    at('Đảo Hoàng Sa', 'island', 111.6094, 16.5064),
    // Trường Sa
    at('Đảo Trường Sa Lớn', 'island', 111.9195, 8.644),
    at('Đảo Song Tử Tây', 'island', 114.3295, 11.4258),
    at('Đảo Sinh Tồn', 'island', 114.3316, 9.8814),
    at('Đảo Nam Yết', 'island', 114.3672, 10.1811),
    at('Đảo Sơn Ca', 'island', 114.3389, 10.3775),
  ],
}

/** Màu chấm đảo của app (`PoiMapLayer.dotColor`, viền đỏ) — không đổi theo theme. */
const DOT = { fill: '#22C55E', stroke: '#B22222' }

const ofKind = (kind: IslandKind) => ['==', ['get', 'kind'], kind]

/** Ba lớp, đúng thứ tự vẽ của app: chấm → tên đảo → tên quần đảo. */
export function vnIslandsLayers(ink: Pick<MapInk, 'label' | 'halo'>): Record<string, unknown>[] {
  return [
    {
      id: 'vn-islands-dot',
      type: 'circle',
      source: VN_ISLANDS_SOURCE,
      // KHÔNG có minzoom: ở khung nhìn cả nước mà chỉ còn chữ, không có đảo
      // dưới chân, là đọc ngược ý định của cả lớp này (app sửa đúng lỗi đó 22/9).
      filter: ofKind('island'),
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, ISLAND_MIN_ZOOM, 5],
        'circle-color': DOT.fill,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': DOT.stroke,
      },
    },
    {
      id: 'vn-islands-label',
      type: 'symbol',
      source: VN_ISLANDS_SOURCE,
      minzoom: ISLAND_MIN_ZOOM,
      filter: ofKind('island'),
      layout: {
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT.bold,
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
      },
      paint: { 'text-color': ink.label, 'text-halo-color': ink.halo, 'text-halo-width': 1.2 },
    },
    {
      id: 'vn-islands-group-label',
      type: 'symbol',
      source: VN_ISLANDS_SOURCE,
      filter: ofKind('group'),
      layout: {
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT.bold,
        'text-size': 13,
        'text-letter-spacing': 0.08,
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': ink.label, 'text-halo-color': ink.halo, 'text-halo-width': 1.4 },
    },
  ]
}
