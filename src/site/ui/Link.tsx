import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { isSitePath, navigate } from '../router'

/**
 * `<a>` thật (chuột giữa, Cmd+click, chép link đều chạy), chỉ chặn cú bấm
 * trái thường khi đích nằm trong trang này.
 */
export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    if (!isSitePath(to)) return
    e.preventDefault()
    navigate(to)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }
  return <a href={to} onClick={handle} {...rest} />
}
