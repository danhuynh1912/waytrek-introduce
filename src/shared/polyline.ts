// Giải mã polyline độ chính xác 5 — cùng thuật toán `engine/geo.ts`
// (`encodePolyline`). Trả [lon, lat] cho bản đồ (GeoJSON), dù chuỗi mã hoá
// theo thứ tự [lat, lon].

export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = []
  let i = 0
  let lat = 0
  let lon = 0
  while (i < encoded.length) {
    for (const which of [0, 1]) {
      let shift = 0
      let result = 0
      let b: number
      do {
        b = encoded.charCodeAt(i++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20 && i < encoded.length)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += delta
      else lon += delta
    }
    out.push([lon / 1e5, lat / 1e5])
  }
  return out
}
