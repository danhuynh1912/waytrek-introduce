// Chuẩn hoá chữ để SO KHỚP tìm kiếm — bỏ dấu ở CẢ HAI vế, như ô tìm cung của
// app (`core/utils/search_text.dart`): "ky quan" phải ra "Kỳ Quan San". Chỉ để
// so, không bao giờ để hiện hay lưu (tên lưu xuống DB giữ dấu).

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
