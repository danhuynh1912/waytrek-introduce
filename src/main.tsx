import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { JoinPage } from './components/JoinPage'
import { inviteCodeFromPath, isInvitePath } from './lib/invite'
import { PlannerAppLazy } from './plan/lazy'
import { isPlanPath } from './plan/ui/route'
import { I18nProvider } from './i18n/provider'
import { applyDocumentLocale } from './i18n/document'
import { splitLocale } from './i18n/locales'
import { loadMessages } from './i18n/load'
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

const root = createRoot(document.getElementById('root')!)

async function start(): Promise<void> {
  if (isPlan) {
    root.render(
      <StrictMode>
        <Suspense fallback={null}>
          <PlannerAppLazy />
        </Suspense>
      </StrictMode>,
    )
    return
  }
  if (isInvitePath(path)) {
    root.render(
      <StrictMode>
        <JoinPage code={inviteCodeFromPath(path)} />
      </StrictMode>,
    )
    return
  }
  // waytrek.site: ngôn ngữ do tiền tố đường dẫn quyết (`/ja/map`); câu chữ nạp
  // TRƯỚC khi dựng để người dùng không thấy tiếng Việt nháy lên rồi mới đổi.
  const { locale } = splitLocale(path)
  const messages = await loadMessages(locale)
  applyDocumentLocale(locale)
  root.render(
    <StrictMode>
      <I18nProvider locale={locale} messages={messages}>
        <SiteApp />
      </I18nProvider>
    </StrictMode>,
  )
}

void start()
