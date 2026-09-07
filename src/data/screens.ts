/**
 * Bốn màn THẬT của app, chụp từ build đang chạy. Toạ độ chú thích chuẩn hoá
 * 0..1 theo khung ảnh màn hình (1206×2622), gốc góc trái trên — cùng quy ước
 * `bbox` của SpeciesAnnotation trong app.
 */
export type Note = {
  /** Khung chủ thể cần khoanh, chuẩn hoá. */
  box: [x: number, y: number, w: number, h: number]
  /** Chữ nằm bên nào của điện thoại. */
  side: 'left' | 'right'
  /** Lệch dọc của chữ so với tâm vòng, tính theo chiều cao màn (−0.5..0.5). */
  dy?: number
  label: string
}

export type MarginNote = { slot: 'tl' | 'ml' | 'mr' | 'br'; head: string; body: string }

export type Screen = {
  id: string
  /** Tên ngắn cho rail bên phải. */
  rail: string
  src: string
  /** Câu tuyên ngôn trên phải, chia dòng bằng mảng. */
  headline: [string, string]
  /** Câu dẫn bên trái + dòng phụ. */
  tagline: string
  taglineSub: string
  notes: Note[]
  margins: MarginNote[]
}

export const SCREENS: Screen[] = [
  {
    id: 'kham-pha',
    rail: 'Khám phá',
    src: '/screens/01-home.jpg',
    headline: ['Chọn một đỉnh,', 'biết trước địa hình'],
    tagline: 'Cung núi Việt Nam trong tay bạn.',
    taglineSub: 'Bạn mở app là thấy thời tiết tại chân núi, ảnh bạn bè vừa chụp trên cung, và cung nào đang chờ mình.',
    notes: [
      { box: [0.052, 0.159, 0.897, 0.05], side: 'right', dy: -0.04, label: 'Thời tiết ngay tại chân núi' },
      { box: [0.05, 0.515, 0.90, 0.15], side: 'left', dy: 0.04, label: 'Bạn bè vừa chụp gì trên cung' },
      { box: [0.80, 0.812, 0.16, 0.062], side: 'right', dy: 0.0, label: 'Chụp một tấm, AI gọi tên cây' },
    ],
    margins: [
      { slot: 'tl', head: 'Ứng dụng iOS', body: 'Leo núi / Việt Nam' },
      { slot: 'ml', head: '16 cung núi', body: 'Tây Bắc & Đông Bắc' },
      { slot: 'mr', head: 'Ảnh bạn bè', body: 'Có toạ độ trên cung' },
      { slot: 'br', head: 'Miễn phí', body: 'Tải về là dùng' },
    ],
  },
  {
    id: 'chi-tiet',
    rail: 'Chi tiết cung',
    src: '/screens/02-detail.jpg',
    headline: ['Số đo thật,', 'không phải ước lượng'],
    tagline: 'Mỗi cung là một bộ số đo từ GPX.',
    taglineSub: 'Độ cao đỉnh, quãng đường và tổng leo dốc được tính từ đường mòn thật, nên bạn biết mình sắp đi vào đâu.',
    notes: [
      { box: [0.06, 0.412, 0.34, 0.225], side: 'left', dy: -0.02, label: 'Số đo tính từ tuyến GPX thật' },
      { box: [0.375, 0.882, 0.57, 0.066], side: 'right', dy: -0.02, label: 'Bấm là ghi hành trình bằng GPS' },
      { box: [0.055, 0.882, 0.145, 0.066], side: 'left', dy: -0.15, label: 'Mở tuyến trên bản đồ' },
    ],
    margins: [
      { slot: 'tl', head: 'Fansipan', body: 'Sa Pa, Lào Cai' },
      { slot: 'ml', head: '3143 m', body: 'Nóc nhà Đông Dương' },
      { slot: 'mr', head: '8.9 km', body: 'Một chiều lên đỉnh' },
      { slot: 'br', head: 'Trung bình', body: 'Độ khó' },
    ],
  },
  {
    id: 'ban-do',
    rail: 'Bản đồ',
    src: '/screens/03-map.jpg',
    headline: ['Mất sóng,', 'bản đồ vẫn còn'],
    tagline: 'Tải trước, giữa rừng vẫn thấy đường.',
    taglineSub: 'Bạn tải bản đồ và địa hình trước khi đi. Lên núi không có sóng, tuyến vẫn nằm đúng dưới chân bạn.',
    notes: [
      { box: [0.36, 0.16, 0.33, 0.53], side: 'right', dy: -0.2, label: 'Đường mòn thật, đo từng mét' },
      { box: [0.09, 0.648, 0.35, 0.05], side: 'left', dy: 0.0, label: 'Tải về, mất sóng vẫn có bản đồ' },
      { box: [0.84, 0.50, 0.15, 0.21], side: 'right', dy: 0.12, label: 'Ôm trọn tuyến trong một chạm' },
    ],
    margins: [
      { slot: 'tl', head: 'Bản đồ offline', body: 'Tile + địa hình' },
      { slot: 'ml', head: 'GPX thật', body: 'Từng khúc cua' },
      { slot: 'mr', head: 'GPS nền', body: 'Khoá màn vẫn ghi' },
      { slot: 'br', head: 'Cảnh báo', body: 'Lệch tuyến là biết ngay' },
    ],
  },
  {
    id: 'son-pha',
    rail: 'Sơn phả',
    src: '/screens/05-sonpha.jpg',
    headline: ['Mỗi đỉnh', 'là một huy chương'],
    tagline: 'Đỉnh nào bạn lên, núi đều ghi nhớ.',
    taglineSub: 'Bạn lên tới đỉnh là được ghi danh. Sơn phả lớn dần theo số đỉnh, và danh hiệu đổi theo mùa leo.',
    notes: [
      { box: [0.33, 0.20, 0.35, 0.22], side: 'right', dy: -0.08, label: 'Cấp bậc lớn dần theo số đỉnh' },
      { box: [0.06, 0.522, 0.86, 0.08], side: 'left', dy: 0.02, label: 'Mỗi đỉnh ghi danh là một huy chương' },
      { box: [0.05, 0.706, 0.90, 0.17], side: 'right', dy: 0.05, label: 'Danh hiệu đổi theo mùa leo' },
    ],
    margins: [
      { slot: 'tl', head: 'Sơn phả', body: 'Sổ đỉnh của riêng bạn' },
      { slot: 'ml', head: 'Á Thần', body: 'Từ 10 đỉnh trở lên' },
      { slot: 'mr', head: 'Danh hiệu', body: 'Đổi theo mùa Sơn Tinh' },
      { slot: 'br', head: 'Bảng Vàng', body: 'Ai lên nhiều đỉnh nhất' },
    ],
  },
]

export const STORE_URL = 'https://apps.apple.com/vn/app/waytrek/id6789542012'
export const PRIVACY_URL = 'https://admin-waytrek.vercel.app/privacy'
export const TERMS_URL = 'https://admin-waytrek.vercel.app/terms'
