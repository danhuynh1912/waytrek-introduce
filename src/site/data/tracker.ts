// Đọc link theo dõi chuyến đi (WayTrek spec/43 §10.6) bằng khoá anon:
// `get_trip_tracker(token)` — hàm SECURITY DEFINER chỉ trả đúng thứ người chia
// sẻ cho phép xem. supabase-js tải lười như mọi trang của site.

import { trackFromRpc } from '../core/tracker'
import type { TrackView } from '../core/tracker'

// Supabase KHÔNG có giờ chờ mặc định (luật repo: xoay vô hạn là một LỖI).
const READ_TIMEOUT_MS = 15_000

const client = () => import('@/shared/supabase').then((m) => m.supabase)

/** null = link không tồn tại. Lỗi mạng thì NÉM để trang nói ra và thử lại. */
export async function fetchTracker(token: string): Promise<TrackView | null> {
  const sb = await client()
  const { data, error } = await sb
    .rpc('get_trip_tracker', { p_token: token })
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS))
  if (error) throw new Error(error.message)
  return trackFromRpc(data)
}
