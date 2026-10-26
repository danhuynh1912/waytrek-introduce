import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { JoinPage } from './components/JoinPage'
import { inviteCodeFromPath, isInvitePath } from './lib/invite'
import { PlannerAppLazy } from './plan/lazy'
import { isPlanPath } from './plan/ui/route'
import { installTooltips } from './shared/tooltip'
import SiteApp from './site/SiteApp'
import './styles.css'

// /plan…: ứng dụng lên kế hoạch (WayTrek spec/43) — chunk tải lười, kéo theo bản
// đồ và Supabase; hai trang dưới không phải tải chúng.
// /j/<mã>: trang lời mời vào đoàn (WayTrek spec/32) — không dựng trang chủ
// nặng ảnh. Mọi đường dẫn còn lại là waytrek.site (src/site/).
const path = window.location.pathname
const isPlan = isPlanPath(path)
// Tooltip khi rê chuột lên nút / điểm bản đồ — một lần cho mọi trang.
installTooltips()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPlan ? (
      <Suspense fallback={null}>
        <PlannerAppLazy />
      </Suspense>
    ) : isInvitePath(path) ? (
      <JoinPage code={inviteCodeFromPath(path)} />
    ) : (
      <SiteApp />
    )}
  </StrictMode>,
)
