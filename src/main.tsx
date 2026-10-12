import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { JoinPage } from './components/JoinPage'
import { inviteCodeFromPath, isInvitePath } from './lib/invite'
import './styles.css'

// /j/<mã>: trang lời mời vào đoàn (WayTrek spec/32) — không kéo theo trang
// giới thiệu nặng ảnh.
const path = window.location.pathname

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isInvitePath(path) ? <JoinPage code={inviteCodeFromPath(path)} /> : <App />}
  </StrictMode>,
)
