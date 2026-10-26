// Nút tài khoản ở đầu trang — chunk tải LƯỜI (kéo theo supabase-js), để trang
// chủ vẽ xong trước. Đăng nhập dùng đúng hộp chung của waytrek.site.

import { useEffect, useRef, useState } from 'react'
import { AuthDialog } from '@/shared/AuthDialog'
import type { AuthRequest } from '@/shared/AuthDialog'
import { avatarUrl, displayName, signOut, useAuth } from '@/shared/auth'

export default function Account() {
  const auth = useAuth()
  const [req, setReq] = useState<AuthRequest | null>(null)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const s = auth.session
  if (!auth.ready) return <span className="st-account-slot" aria-hidden="true" />
  if (!s) {
    return (
      <>
        <button type="button" className="st-btn st-btn-quiet" onClick={() => setReq({})} data-tip="Đăng nhập bằng tài khoản bạn dùng trên app WayTrek">Đăng nhập</button>
        <AuthDialog request={req} onClose={() => setReq(null)} />
      </>
    )
  }
  const name = displayName(s)
  const pic = avatarUrl(s)
  return (
    <div className="st-account" ref={box}>
      <button
        type="button"
        className="st-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Tài khoản ${name}`}
        data-tip={`Đang đăng nhập: ${name} — bấm để xem kế hoạch, đăng xuất`}
      >
        {pic ? <img src={pic} alt="" referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
      </button>
      <div className={`st-menu${open ? ' is-open' : ''}`} role="menu">
        <p className="st-menu-name">{name}</p>
        <a role="menuitem" href="/plan" data-tip="Các kế hoạch chuyến trek bạn đã lưu">Kế hoạch của tôi</a>
        <button role="menuitem" type="button" onClick={() => { setOpen(false); void signOut() }} data-tip="Thoát tài khoản trên trình duyệt này">
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
