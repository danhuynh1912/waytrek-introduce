import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { JoinPage } from './components/JoinPage'
import { inviteCodeFromPath, isInvitePath } from './lib/invite'
import { PlannerAppLazy } from './plan/lazy'
import { isPlanPath } from './plan/ui/route'
import './styles.css'

// /plan…: ứng dụng lên kế hoạch (WayTrek spec/43) — chunk tải lười, kéo theo bản
// đồ và Supabase; hai trang dưới không phải tải chúng.
// /j/<mã>: trang lời mời vào đoàn (WayTrek spec/32) — không kéo theo trang
// giới thiệu nặng ảnh.
const path = window.location.pathname
const isPlan = isPlanPath(path)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPlan ? (
      <Suspense fallback={null}>
        <PlannerAppLazy />
      </Suspense>
    ) : isInvitePath(path) ? (
      <JoinPage code={inviteCodeFromPath(path)} />
    ) : (
      <App />
    )}
  </StrictMode>,
)
