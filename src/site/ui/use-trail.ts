import { useCallback, useEffect, useState } from 'react'
import { fetchRouteGeometry, fetchTrailDetail } from '../data/catalog'
import type { TrailDetail } from '../data/catalog'
import type { TravelSpan } from '../core/geometry'
import type { Loadable } from './use-catalog'

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Một cung + lộ trình + điểm đánh dấu. `data: null` = không có / không còn công khai. */
export function useTrailDetail(trailId: string): [Loadable<TrailDetail | null>, () => void] {
  const [state, setState] = useState<Loadable<TrailDetail | null>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    fetchTrailDetail(trailId)
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e) => {
        console.warn('site: tải cung lỗi —', e)
        if (alive) setState({ status: 'error', message: reason(e) })
      })
    return () => {
      alive = false
    }
  }, [trailId, attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])
  return [state, retry]
}

/** Hình học của lộ trình đang xem (tải theo từng lộ trình, có nhớ trong phiên). */
export function useRouteGeometry(routeId: string | null): Loadable<{ geojson: unknown; travel: TravelSpan[] }> | null {
  const [state, setState] = useState<{ id: string; value: Loadable<{ geojson: unknown; travel: TravelSpan[] }> } | null>(null)
  useEffect(() => {
    if (!routeId) return
    let alive = true
    // Không đặt 'loading' ở đây: id lệch với lộ trình đang hỏi đã là "đang tải" (xem return dưới).
    fetchRouteGeometry(routeId)
      .then((data) => alive && setState({ id: routeId, value: { status: 'ready', data } }))
      .catch((e) => {
        console.warn('site: tải hình học lộ trình lỗi —', e)
        if (alive) setState({ id: routeId, value: { status: 'error', message: reason(e) } })
      })
    return () => {
      alive = false
    }
  }, [routeId])
  if (!routeId) return null
  return state?.id === routeId ? state.value : { status: 'loading' }
}
