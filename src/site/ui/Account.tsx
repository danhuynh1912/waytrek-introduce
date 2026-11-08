// Nút tài khoản ở đầu trang — chunk tải LƯỜI (kéo theo supabase-js), để trang
// chủ vẽ xong trước. Đăng nhập dùng đúng hộp chung của waytrek.site.

import { useEffect, useRef, useState } from 'react'
import { AuthDialog } from '@/shared/AuthDialog'
import type { AuthRequest } from '@/shared/AuthDialog'
import { avatarUrl, displayName, signOut, useAuth } from '@/shared/auth'
import { useI18n } from '../../i18n/context'
import { fill } from '../../i18n/text'

export default function Account() {
  const { m } = useI18n()
  const a = m.account
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
        <button type="button" className="st-btn st-btn-quiet" onClick={() => setReq({})} data-tip={a.signInTip}>{a.signIn}</button>
        <AuthDialog request={req} onClose={() => setReq(null)} />
      </>
    )
  }
  const name = displayName(s, a.defaultName)
  const pic = avatarUrl(s)
  return (
    <div className="st-account" ref={box}>
      <button
        type="button"
        className="st-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={fill(a.accountLabel, { name })}
        data-tip={fill(a.accountTip, { name })}
      >
        {pic ? <img src={pic} alt="" referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
      </button>
      <div className={`st-menu${open ? ' is-open' : ''}`} role="menu">
        <p className="st-menu-name">{name}</p>
        <a role="menuitem" href="/plan" data-tip={a.myPlansTip}>{a.myPlans}</a>
        <button role="menuitem" type="button" onClick={() => { setOpen(false); void signOut() }} data-tip={a.signOutTip}>
          {a.signOut}
        </button>
      </div>
    </div>
  )
}
