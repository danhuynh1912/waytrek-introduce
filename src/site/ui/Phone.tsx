import type { CSSProperties } from 'react'

/** Ảnh chụp màn thật của app (public/screens, 828×1800) trong một khung máy mảnh. */
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
      <img src={src} alt={alt} width={828} height={1800} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </figure>
  )
}
