import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

// Schema riêng `waytrek` nên mọi query PostgREST đi qua client này (đặt sẵn
// Accept-Profile). PKCE: phiên quay về bằng `?code=` thay vì để token nằm trên
// thanh địa chỉ và trong lịch sử trình duyệt.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'waytrek' },
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
