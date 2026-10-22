/**
 * Tone biển mây cho từng màn × từng theme. Màu lấy từ hệ token của app
 * (teal, gilt, ice, bronze) để mây và giao diện cùng một họ.
 */
export type Tone = {
  skyTop: string
  skyHorizon: string
  cloudLit: string
  cloudShadow: string
  sun: string
  /** Vị trí mặt trời theo uv (0..1), gốc góc trái DƯỚI. */
  sunPos: [number, number]
  /** Vùng mây camera trôi tới. */
  offset: [number, number]
}

// Cùng thứ tự với `SCREENS`: khám phá (teal) · địa hình 3D (rừng) · offline
// (băng) · track log (gilt) · phát lại (hoàng hôn) · sơn phả (đồng).
export const DARK: Tone[] = [
  { skyTop: '#06111A', skyHorizon: '#33586B', cloudLit: '#93BCCB', cloudShadow: '#152531', sun: '#9FD2E3', sunPos: [0.74, 0.70], offset: [0, 0] },
  { skyTop: '#07130F', skyHorizon: '#3B6650', cloudLit: '#A6D3B4', cloudShadow: '#12221A', sun: '#CDEFD6', sunPos: [0.36, 0.66], offset: [7.5, -1.6] },
  { skyTop: '#061A22', skyHorizon: '#2F7180', cloudLit: '#C4E8F4', cloudShadow: '#0E2A31', sun: '#E6FBFF', sunPos: [0.62, 0.76], offset: [15, -2.2] },
  { skyTop: '#0E1524', skyHorizon: '#9A6432', cloudLit: '#E8C06A', cloudShadow: '#2C1D18', sun: '#F5D77A', sunPos: [0.30, 0.62], offset: [22.5, 2.8] },
  { skyTop: '#130E1C', skyHorizon: '#8A4A3B', cloudLit: '#F1B48C', cloudShadow: '#2A1720', sun: '#FFD3AA', sunPos: [0.66, 0.58], offset: [30, -3.2] },
  { skyTop: '#170F1F', skyHorizon: '#7D4A34', cloudLit: '#F0C878', cloudShadow: '#26161A', sun: '#F5D77A', sunPos: [0.50, 0.60], offset: [37.5, 4.4] },
]

export const LIGHT: Tone[] = [
  { skyTop: '#8FC6DB', skyHorizon: '#EAF4F8', cloudLit: '#FFFFFF', cloudShadow: '#AFC6D1', sun: '#FFFFFF', sunPos: [0.74, 0.72], offset: [0, 0] },
  { skyTop: '#93C6A6', skyHorizon: '#E7F3EA', cloudLit: '#FFFFFF', cloudShadow: '#A9C7B3', sun: '#FFFFFF', sunPos: [0.36, 0.68], offset: [7.5, -1.6] },
  { skyTop: '#6FB5CB', skyHorizon: '#DFF1F7', cloudLit: '#FFFFFF', cloudShadow: '#9DBECB', sun: '#FFFFFF', sunPos: [0.62, 0.76], offset: [15, -2.2] },
  { skyTop: '#D7A98C', skyHorizon: '#FBE6C6', cloudLit: '#FFF6E8', cloudShadow: '#D2A483', sun: '#FFE8A8', sunPos: [0.30, 0.64], offset: [22.5, 2.8] },
  { skyTop: '#E0A48C', skyHorizon: '#FBE2D2', cloudLit: '#FFF4EC', cloudShadow: '#D3A08A', sun: '#FFE4C8', sunPos: [0.66, 0.60], offset: [30, -3.2] },
  { skyTop: '#D9B072', skyHorizon: '#F7E3BF', cloudLit: '#FFF3D6', cloudShadow: '#C49A66', sun: '#FFE7A0', sunPos: [0.50, 0.62], offset: [37.5, 4.4] },
]
