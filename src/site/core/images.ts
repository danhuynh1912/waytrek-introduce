// Ảnh cung đúng cỡ ô hiển thị. Ảnh gốc trên Storage trung bình 814 kB, có tấm
// 2,25 MB (đo 25/10) — ô danh sách 76 px mà tải nguyên tấm là dư cả trăm lần,
// và Supabase tính MỌI byte phục vụ, kể cả từ CDN, vào hạn mức băng thông.
//
// Ảnh công khai trên Supabase Storage đi qua render endpoint (Image
// Transformations): cắt cover đúng tỉ lệ ô — khớp `object-fit: cover` canh giữa
// của CSS — và trình duyệt tự nhận WebP qua header Accept. Ảnh ở host khác trả
// nguyên.
//
// Thuần, không React.

const OBJECT = '/storage/v1/object/public/'
const RENDER = '/storage/v1/render/image/public/'
/** Trần cạnh của render endpoint. */
const MAX_SIDE = 2500

export interface SizedImage {
  src: string
  /** Bản 1x + 2x; thiếu = ảnh không thu nhỏ được (host khác), chỉ có `src`. */
  srcSet?: string
}

/** URL bản cắt `width × height` px ảnh. Không phải ảnh Storage công khai thì trả nguyên. */
export function renderUrl(url: string, width: number, height: number, quality = 70): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  if (!u.pathname.startsWith(OBJECT)) return url
  const side = (n: number) => String(Math.max(1, Math.min(MAX_SIDE, Math.round(n))))
  u.pathname = RENDER + u.pathname.slice(OBJECT.length)
  // Giữ tham số sẵn có: `?v=` là dấu admin đổi ảnh bìa — bỏ đi thì CDN trả ảnh cũ.
  u.searchParams.set('width', side(width))
  u.searchParams.set('height', side(height))
  u.searchParams.set('resize', 'cover')
  u.searchParams.set('quality', String(quality))
  return u.toString()
}

/** Ảnh cho một ô `cssWidth × cssHeight` px CSS: bản 1x làm `src`, kèm 2x cho màn nét. */
export function sizedImage(url: string, cssWidth: number, cssHeight: number, quality?: number): SizedImage {
  const one = renderUrl(url, cssWidth, cssHeight, quality)
  if (one === url) return { src: url }
  return { src: one, srcSet: `${one} 1x, ${renderUrl(url, cssWidth * 2, cssHeight * 2, quality)} 2x` }
}
