import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { DrawLine } from '../../core/timeline'
import type { PoiPin, RouteLine, TrailPin } from '../../core/types'
import { PlanMap } from '../map/plan-map'
import type { LatLng, LayerKey, MapAuto, MapWaypoint, PlanMapHandlers } from '../map/plan-map'

type Padding = { top: number; right: number; bottom: number; left: number }

export interface MapApi {
  fit(points: LatLng[], padding: Padding, animate?: boolean): void
  flyTo(at: LatLng, zoom: number, padding: Padding): void
  zoomBy(delta: number): void
  setHover(p: LatLng | null): void
  addRoutes(routes: RouteLine[]): void
}

interface Props {
  apiRef: RefObject<MapApi | null>
  /** Theme tối thì bản đồ + địa hình tối hẳn (style bản tối). */
  dark: boolean
  /** Khung nhìn đầu: ôm trọn các điểm này, một lần cho mỗi bản đồ được dựng. */
  initialFit: { points: LatLng[]; padding: Padding } | null
  trails: TrailPin[]
  pois: PoiPin[]
  lines: DrawLine[]
  waypoints: MapWaypoint[]
  autos: MapAuto[]
  layers: Record<LayerKey, boolean>
  handlers: Omit<PlanMapHandlers, 'onReady' | 'onFatal'>
}

export function MapView({ apiRef, dark, initialFit, trails, pois, lines, waypoints, autos, layers, handlers }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<PlanMap | null>(null)
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })
  const [fatal, setFatal] = useState<string | null>(null)
  // Theme lúc dựng bản đồ; đổi về sau đi qua setTheme (không dựng lại bản đồ).
  const darkAtCreate = useRef(dark)

  useEffect(() => {
    if (!box.current) return
    // Gọi qua `latest` để bản đồ dựng MỘT lần, không dựng lại mỗi lần handler đổi.
    const m = new PlanMap(box.current, {
      onMapClick: (...a) => latest.current.onMapClick(...a),
      onAddPeak: (...a) => latest.current.onAddPeak(...a),
      onAddPoi: (...a) => latest.current.onAddPoi(...a),
      onWaypointMoved: (...a) => latest.current.onWaypointMoved(...a),
      onWaypointRemove: (...a) => latest.current.onWaypointRemove(...a),
      onWaypointToggleRest: (...a) => latest.current.onWaypointToggleRest(...a),
      onKeepAuto: (...a) => latest.current.onKeepAuto(...a),
      onDismissAuto: (...a) => latest.current.onDismissAuto(...a),
      onView: (...a) => latest.current.onView(...a),
      onReady: () => setFatal(null),
      onFatal: (msg) => setFatal(msg),
    }, darkAtCreate.current)
    map.current = m
    apiRef.current = {
      fit: (points, padding, animate = true) => {
        if (points.length === 0) return
        let w = 180, s = 90, e = -180, n = -90
        for (const p of points) {
          w = Math.min(w, p.lng)
          e = Math.max(e, p.lng)
          s = Math.min(s, p.lat)
          n = Math.max(n, p.lat)
        }
        // Một điểm: nới khung ra ~1 km để không phóng sát tới mức 14.
        const pad = points.length === 1 ? 0.01 : 0
        m.fit([[w - pad, s - pad], [e + pad, n + pad]], padding, animate)
      },
      flyTo: (at, zoom, padding) => m.flyTo(at, zoom, padding),
      zoomBy: (d) => m.zoomBy(d),
      setHover: (p) => m.setHover(p),
      addRoutes: (r) => m.addRoutes(r),
    }
    const onResize = () => m.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      apiRef.current = null
      map.current = null
      m.destroy()
    }
  }, [apiRef])

  // Theo TỪNG bản đồ, không theo màn: StrictMode (dev) dựng bản đồ hai lần.
  const fittedFor = useRef<PlanMap | null>(null)
  useEffect(() => {
    const m = map.current
    if (!m || !initialFit || fittedFor.current === m) return
    fittedFor.current = m
    apiRef.current?.fit(initialFit.points, initialFit.padding, false)
  }, [initialFit, apiRef])

  useEffect(() => map.current?.setTheme(dark), [dark])
  useEffect(() => map.current?.setTrails(trails), [trails])
  useEffect(() => map.current?.setPois(pois), [pois])
  useEffect(() => map.current?.setPlan(lines), [lines])
  useEffect(() => map.current?.setWaypoints(waypoints), [waypoints])
  useEffect(() => map.current?.setAutos(autos), [autos])
  useEffect(() => {
    for (const k of Object.keys(layers) as LayerKey[]) map.current?.setLayer(k, layers[k])
  }, [layers])

  return (
    <div className="pl-map-wrap">
      <div ref={box} className="pl-map" />
      {fatal && (
        <div className="pl-map-fatal" role="alert">
          {fatal} <button type="button" className="pl-text-btn" onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      )}
    </div>
  )
}
