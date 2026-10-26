import './auth-dialog.css'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle } from './auth'

export interface AuthRequest {
  /** Vì sao cần đăng nhập ("Đăng nhập để lưu kế hoạch"). */
  reason?: string
  /** Chạy ngay trước khi rời trang sang Google (ghi bản nháp). */
  beforeRedirect?: () => void
}

/**
 * Hộp đăng nhập DUY NHẤT của waytrek.site — trang lên kế hoạch và các trang
 * xem nội dung cùng dùng. Cùng tài khoản với app WayTrek. Style riêng
 * (`auth-dialog.css`) để không phụ thuộc CSS của trang nào.
 */
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
    <dialog ref={dialog} className="wt-auth" onClose={onClose} onCancel={onClose} aria-labelledby="wt-auth-title">
      <div className="wt-auth-head">
        <h2 id="wt-auth-title">Đăng nhập WayTrek</h2>
        <button type="button" className="wt-auth-close" onClick={onClose} aria-label="Đóng" data-tip="Đóng, không đăng nhập">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <p className="wt-auth-lead">{request?.reason ?? 'Dùng đúng tài khoản bạn đăng nhập trên app WayTrek.'}</p>
      <button
        type="button"
        className="wt-auth-btn is-outline"
        onClick={google}
        disabled={busy != null}
        data-tip="Chuyển sang Google để đăng nhập, xong quay lại đúng trang này"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.4-.2-2.1H12v4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-7.9z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        {busy === 'google' ? 'Đang chuyển sang Google…' : 'Tiếp tục với Google'}
      </button>
      <div className="wt-auth-or"><span>hoặc email và mật khẩu</span></div>
      <form onSubmit={submit} className="wt-auth-form">
        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>Mật khẩu</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="wt-auth-btn is-primary" disabled={busy != null} data-tip="Đăng nhập bằng email và mật khẩu của tài khoản WayTrek">
          {busy === 'email' ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      {error && <p className="wt-auth-error" role="alert">{error}</p>}
      <p className="wt-auth-foot">Tài khoản đăng nhập bằng Apple chưa dùng được trên web.</p>
    </dialog>
  )
}
