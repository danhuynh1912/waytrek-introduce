// Ghim đỉnh + lán/nước: ~65 và ~76 dòng, tải một lần cho cả phiên. Lỗi thì
// quên lời hứa đã hỏng để lần sau gọi lại được, không giữ lỗi đầu tiên mãi.

import { useCallback, useEffect, useState } from 'react'
import type { PoiPin, TrailPin } from '../../core/types'
import { fetchPois, fetchTrails } from '../../data/api'

let trailsP: Promise<TrailPin[]> | null = null
let poisP: Promise<PoiPin[]> | null = null

export function useCatalog(): { trails: TrailPin[]; pois: PoiPin[]; error: string | null; retry: () => void } {
  const [trails, setTrails] = useState<TrailPin[]>([])
  const [pois, setPois] = useState<PoiPin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const t = (trailsP ??= fetchTrails())
    const p = (poisP ??= fetchPois())
    t.then((v) => alive && setTrails(v)).catch((e) => {
      trailsP = null
      console.warn('plan: tải đỉnh lỗi —', e)
      if (alive) setError('Không tải được danh sách đỉnh và lán.')
    })
    p.then((v) => alive && setPois(v)).catch((e) => {
      poisP = null
      console.warn('plan: tải lán lỗi —', e)
      if (alive) setError('Không tải được danh sách đỉnh và lán.')
    })
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((a) => a + 1)
  }, [])
  return { trails, pois, error, retry }
}
