// Ứng dụng lên kế hoạch ở /plan — chunk tải lười (spec/43 §15): maplibre-gl và
// supabase-js chỉ về máy khi vào /plan, trang giới thiệu không đổi một byte.

import 'maplibre-gl/dist/maplibre-gl.css'
import './plan.css'
import { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/shared/auth'
import { AppBar } from './ui/AppBar'
import { AuthDialog } from '@/shared/AuthDialog'
import type { AuthRequest } from '@/shared/AuthDialog'
import { PlanEditorScreen } from './ui/editor/PlanEditorScreen'
import { PlanList } from './ui/PlanList'
import { useRoute } from './ui/route'

export default function PlannerApp() {
  const { route, seq } = useRoute()
  const auth = useAuth()
  const [mode, toggleTheme] = useTheme()
  const [authReq, setAuthReq] = useState<AuthRequest | null>(null)
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const oauthNote = auth.oauthError && auth.oauthError !== dismissedError ? auth.oauthError : null

  useEffect(() => {
    // Kế hoạch là dữ liệu riêng: không cho máy tìm kiếm lập chỉ mục trang con.
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    if (route.kind !== 'list') document.head.appendChild(robots)
    if (route.kind === 'list') document.title = 'Lên kế hoạch chuyến trek · WayTrek'
    return () => robots.remove()
  }, [route.kind])

  return (
    <div className="pl-app">
      <AppBar session={auth.session} mode={mode} onToggleTheme={toggleTheme} onLogin={() => setAuthReq({})} />
      {!auth.ready ? (
        <div className="pl-progress" aria-label="Đang tải" />
      ) : route.kind === 'list' ? (
        <PlanList session={auth.session} onLogin={() => setAuthReq({})} />
      ) : (
        <PlanEditorScreen
          key={route.kind === 'plan' ? route.id : `new-${seq}`}
          routeId={route.kind === 'plan' ? route.id : null}
          session={auth.session}
          dark={mode === 'dark'}
          requestLogin={setAuthReq}
        />
      )}
      {oauthNote && (
        <div className="pl-banner" role="alert">
          Đăng nhập Google không thành công: {oauthNote}
          <button type="button" className="pl-text-btn" onClick={() => setDismissedError(oauthNote)} data-tip="Ẩn thông báo này">Đóng</button>
        </div>
      )}
      <AuthDialog request={authReq} onClose={() => setAuthReq(null)} />
    </div>
  )
}
