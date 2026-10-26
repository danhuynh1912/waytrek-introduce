import { useEffect, useState } from 'react'
import { STORE_URL } from '@/shared/links'
import {
  androidIntent,
  displayCode,
  iosHandoff,
  playWithReferrer,
  schemeLink,
} from '@/lib/invite'
import { detectPlatform } from '@/shared/platform'

// Trang /j/<mã> — chỉ hiện khi link KHÔNG mở được app (chưa cài, hoặc đang ở
// trình duyệt trong Zalo / Messenger). Luật chữ của WayTrek: câu ngắn, đủ chủ
// ngữ vị ngữ, không giải thích chuyện bên dưới.
export function JoinPage({ code }: { code: string | null }) {
  const platform = detectPlatform(navigator.userAgent)
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    document.title = 'Tham gia đoàn trên WayTrek'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    // Android: thử mở app ngay; không có app thì intent tự sang CH Play.
    if (code && platform === 'android') window.location.href = androidIntent(code)
    return () => robots.remove()
  }, [code, platform])

  if (!code) {
    return (
      <main className="join">
        <p className="join-lead">Lời mời này không còn dùng được.</p>
        <a className="join-secondary" href="/" data-tip="Về trang chủ WayTrek">WayTrek</a>
      </main>
    )
  }

  // iOS: chép lời mời vào clipboard TRONG cú chạm (ngoài cú chạm thì trình
  // duyệt từ chối), rồi mới sang App Store. App đọc nó ở lần mở đầu.
  const downloadIos = async () => {
    try {
      await navigator.clipboard.writeText(iosHandoff(code))
    } catch {
      setCopyFailed(true)
    }
    window.location.href = STORE_URL
  }

  return (
    <main className="join">
      <p className="join-lead">Tham gia đoàn trên WayTrek</p>
      <p className="join-code-label">Mã đoàn</p>
      <p className="join-code">{displayCode(code)}</p>
      <div className="join-actions">
        {platform === 'android' && (
          <>
            <a className="join-primary" href={androidIntent(code)} data-tip="Mở app và vào thẳng đoàn này">Mở WayTrek</a>
            <a className="join-secondary" href={playWithReferrer(code)} data-tip="Tải app trên CH Play — mở app lần đầu là vào đoàn">Tải WayTrek</a>
          </>
        )}
        {platform === 'ios' && (
          <>
            <button className="join-primary" type="button" onClick={downloadIos} data-tip="Tải app trên App Store — mở app lần đầu là vào đoàn">Tải WayTrek</button>
            <a className="join-secondary" href={schemeLink(code)} data-tip="Đã cài app thì mở thẳng vào đoàn này">Mở WayTrek</a>
          </>
        )}
        {platform === 'other' && (
          <>
            <a className="join-primary" href={STORE_URL} data-tip="Tải WayTrek cho iPhone">App Store</a>
            <a className="join-secondary" href={playWithReferrer(code)} data-tip="Tải WayTrek cho điện thoại Android">CH Play</a>
          </>
        )}
      </div>
      {copyFailed && <p className="join-note">Mở WayTrek rồi nhập mã đoàn này.</p>}
    </main>
  )
}
