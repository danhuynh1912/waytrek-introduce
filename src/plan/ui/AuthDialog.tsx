import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle } from '../data/auth'
import { IClose, IGoogle } from './icons'

export interface AuthRequest {
  /** Vì sao cần đăng nhập ("Đăng nhập để lưu kế hoạch"). */
  reason?: string
  /** Chạy ngay trước khi rời trang sang Google (ghi bản nháp). */
  beforeRedirect?: () => void
}

export function AuthDialog({ request, onClose }: { request: AuthRequest | null; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (request && !d.open) {
      setError(null)
      setBusy(null)
      d.showModal()
    } else if (!request && d.open) d.close()
  }, [request])

  const google = async () => {
    setBusy('google')
    setError(null)
    request?.beforeRedirect?.()
    const err = await signInWithGoogle()
    // Thành công thì trình duyệt đã rời trang; tới được đây nghĩa là hỏng.
    if (err) {
      setError(err)
      setBusy(null)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu.')
      return
    }
    setBusy('email')
    setError(null)
    const err = await signInWithEmail(email, password)
    setBusy(null)
    if (err) setError(err)
    else {
      setPassword('')
      onClose()
    }
  }

  return (
    <dialog ref={dialog} className="pl-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="pl-auth-title">
      <div className="pl-dialog-head">
        <h2 id="pl-auth-title">Đăng nhập WayTrek</h2>
        <button type="button" className="pl-icon-btn" onClick={onClose} aria-label="Đóng"><IClose /></button>
      </div>
      <p className="pl-dialog-lead">{request?.reason ?? 'Dùng đúng tài khoản bạn đăng nhập trên app WayTrek.'}</p>
      <button type="button" className="pl-btn pl-btn-wide pl-btn-outline" onClick={google} disabled={busy != null}>
        <IGoogle /> {busy === 'google' ? 'Đang chuyển sang Google…' : 'Tiếp tục với Google'}
      </button>
      <div className="pl-or"><span>hoặc email và mật khẩu</span></div>
      <form onSubmit={submit} className="pl-form">
        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>Mật khẩu</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="pl-btn pl-btn-wide pl-btn-primary" disabled={busy != null}>
          {busy === 'email' ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      {error && <p className="pl-note pl-note-danger" role="alert">{error}</p>}
      <p className="pl-dialog-foot">Tài khoản đăng nhập bằng Apple chưa dùng được trên web.</p>
    </dialog>
  )
}
