// Đăng nhập trên web — cùng tài khoản với app WayTrek (cùng project Supabase).
// Google đi đường OAuth như admin_web; email đi email + mật khẩu như app
// (`signInWithPassword`). Apple trên web chưa có (cần Services ID — spec/43 §15).

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface AuthState {
  ready: boolean
  session: Session | null
  /** Lỗi trả về từ trang Google (?error_description=…), nói ra một lần. */
  oauthError: string | null
}

function takeOauthParams(): string | null {
  const url = new URL(window.location.href)
  const err = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  let changed = false
  for (const k of ['code', 'error', 'error_code', 'error_description']) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k)
      changed = true
    }
  }
  if (changed) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  return err
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ ready: false, session: null, oauthError: null })
  useEffect(() => {
    let alive = true
    // getSession chờ client đổi `?code=` lấy phiên xong rồi mới trả.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      const oauthError = takeOauthParams() ?? (error ? error.message : null)
      setState({ ready: true, session: data.session, oauthError })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setState((s) => ({ ...s, ready: true, session }))
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])
  return state
}

/** Đi Google rồi quay về đúng trang đang mở. */
export async function signInWithGoogle(): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  return error ? error.message : null
}

/** Vì sao đăng nhập bằng email hỏng: hai lỗi người dùng tự sửa được có mã riêng (câu chữ theo ngôn ngữ do nơi hiển thị quyết); còn lại giữ nguyên lời của máy chủ. */
export type EmailSignInFailure = { code: 'invalid' | 'unconfirmed' } | { code: 'other'; message: string }

export async function signInWithEmail(email: string, password: string): Promise<EmailSignInFailure | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (!error) return null
  const msg = error.message.toLowerCase()
  if (error.code === 'invalid_credentials' || msg.includes('invalid login credentials')) return { code: 'invalid' }
  if (error.code === 'email_not_confirmed' || msg.includes('not confirmed')) return { code: 'unconfirmed' }
  return { code: 'other', message: error.message }
}

/** `scope: 'local'` — chỉ thoát trình duyệt này, không đá văng phiên trên điện thoại. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) console.warn('auth: đăng xuất lỗi —', error.message)
}

export function displayName(session: Session, fallback = 'Tài khoản WayTrek'): string {
  const m = session.user.user_metadata ?? {}
  const name = typeof m.full_name === 'string' ? m.full_name : typeof m.name === 'string' ? m.name : ''
  return name.trim() || session.user.email || fallback
}

export function avatarUrl(session: Session): string | null {
  const m = session.user.user_metadata ?? {}
  return typeof m.avatar_url === 'string' ? m.avatar_url : null
}
