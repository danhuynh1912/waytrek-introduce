// Đường dẫn trong /plan. Không thêm thư viện định tuyến: chỉ có ba dạng.

import { useEffect, useState } from 'react'

export type PlanRoute =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'plan'; id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPlanPath(path: string): boolean {
  return path === '/plan' || path.startsWith('/plan/')
}

export function parsePlanPath(path: string): PlanRoute {
  const rest = path.replace(/^\/plan\/?/, '').replace(/\/+$/, '')
  if (rest === 'new') return { kind: 'new' }
  if (UUID.test(rest)) return { kind: 'plan', id: rest.toLowerCase() }
  return { kind: 'list' }
}

const EVENT = 'wt-plan-navigate'

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(EVENT))
}

/** `seq` tăng sau mỗi lần điều hướng — để hai lần mở /plan/new là hai màn khác nhau. */
export function useRoute(): { route: PlanRoute; seq: number } {
  const [state, setState] = useState(() => ({ route: parsePlanPath(window.location.pathname), seq: 0 }))
  useEffect(() => {
    const sync = () => setState((s) => ({ route: parsePlanPath(window.location.pathname), seq: s.seq + 1 }))
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(EVENT, sync)
    }
  }, [])
  return state
}

/**
 * Đổi địa chỉ mà KHÔNG dựng lại màn (lần Lưu đầu: /plan/new → /plan/<id>) —
 * dựng lại là mất lịch sử hoàn tác đang có trong bộ nhớ.
 */
export function replaceSilently(path: string): void {
  window.history.replaceState(null, '', path)
}
