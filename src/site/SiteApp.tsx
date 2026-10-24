// waytrek.site — trang giới thiệu + xem nội dung của app (không gồm track log).
// Trang chủ nằm trong chunk chính; trang khám phá và trang cung kéo theo bản đồ
// nên tải lười.

import './site.css'
import { lazy, Suspense } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { useSiteLocation } from './router'
import { SiteFooter, SiteHeader } from './ui/SiteChrome'

const MapPage = lazy(() => import('./pages/MapPage'))
const TrailPage = lazy(() => import('./pages/TrailPage'))

export default function SiteApp() {
  const { route } = useSiteLocation()
  const [mode, toggleTheme] = useTheme()
  const dark = mode === 'dark'
  return (
    <div className="st">
      <SiteHeader page={route.page} mode={mode} onToggleTheme={toggleTheme} />
      <main className="st-main">
        <Suspense fallback={<div className="st-page-loading" aria-label="Đang tải" />}>
          {route.page === 'home' && <HomePage />}
          {route.page === 'map' && <MapPage selected={route.trailId} dark={dark} />}
          {/* Khoá theo CUNG, không theo cả địa chỉ: đổi ?route= chỉ đổi lộ trình, không dựng lại bản đồ. */}
          {route.page === 'trail' && <TrailPage key={route.trailId} trailId={route.trailId} routeId={route.routeId} dark={dark} />}
          {route.page === 'notFound' && <NotFoundPage />}
        </Suspense>
      </main>
      {/* Trang khám phá là bản đồ toàn màn — như app, không có chân trang. */}
      {route.page !== 'map' && <SiteFooter />}
    </div>
  )
}
