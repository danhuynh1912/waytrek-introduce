import type { CSSProperties } from 'react'

/**
 * Ảnh chụp màn thật của app (public/screens, 780 px ngang) trong khung máy viền
 * kim loại tối như bản vẽ trang chủ. Bề ngang do CSS của nơi đặt quyết qua
 * `--pw`; viền, bo góc co theo đó.
 */
export function Phone({ src, alt, className, style, eager = false }: {
  src: string
  alt: string
  className?: string
  style?: CSSProperties
  /** Ảnh ở màn đầu tiên: tải ngay thay vì đợi cuộn tới. */
  eager?: boolean
}) {
  return (
    <figure className={`st-phone${className ? ` ${className}` : ''}`} style={style}>
      <img src={src} alt={alt} width={780} height={1688} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </figure>
  )
}
