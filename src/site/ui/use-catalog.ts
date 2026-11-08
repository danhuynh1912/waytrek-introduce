import { useCallback, useEffect, useState } from 'react'
import type { TrailSummary } from '../core/trails'
import type { DifficultyBoard } from '../core/difficulty'
import { fetchCatalog, fetchDifficultyBoard } from '../data/catalog'

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Danh mục cung cho trang chủ + trang khám phá. `retry` gọi lại sau khi lỗi. */
export function useCatalog(): [Loadable<TrailSummary[]>, () => void] {
  const [state, setState] = useState<Loadable<TrailSummary[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    fetchCatalog()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e) => {
        console.warn('site: tải danh mục cung lỗi —', e)
        if (alive) setState({ status: 'error', message: reason(e) })
      })
    return () => {
      alive = false
    }
  }, [attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])
  return [state, retry]
}

/**
 * Bảng điểm độ khó. Hỏng thì null và chỗ hiển thị rơi về nhãn Dễ/Khó — như
 * app khi bảng chưa tải được lần nào (còn hơn để ô trống).
 */
export function useDifficultyBoard(): DifficultyBoard | null {
  const [board, setBoard] = useState<DifficultyBoard | null>(null)
  useEffect(() => {
    let alive = true
    fetchDifficultyBoard()
      .then((b) => alive && setBoard(b))
      .catch((e) => console.warn('site: tải bảng điểm độ khó lỗi —', e))
    return () => {
      alive = false
    }
  }, [])
  return board
}
