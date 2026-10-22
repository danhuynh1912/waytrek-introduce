/**
 * Sáu màn THẬT của app, chụp từ build master (simulator iPhone 17, 22/10/2026).
 * Toạ độ chú thích chuẩn hoá 0..1 theo khung ảnh màn hình (1206×2622), gốc góc
 * trái trên — cùng quy ước `bbox` của SpeciesAnnotation trong app.
 *
 * Chỉ chụp màn có dữ liệu catalog (cung, bản đồ) hoặc dữ liệu của chính tài
 * khoản chủ dự án: ảnh, tên và bài của người dùng khác KHÔNG được đưa lên trang
 * giới thiệu (mục đích khác với lúc họ đăng).
 *
 * Màn hẹp chỉ vẽ chú thích ĐẦU TIÊN của mỗi màn (xem `Annotations`), nên chú
 * thích quan trọng nhất đứng đầu.
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
    src: '/screens/01-kham-pha.jpg',
    headline: ['Hơn 60 cung núi,', 'xếp hạng bởi người leo'],
    tagline: 'Chọn cung vừa sức mình.',
    taglineSub: 'Mỗi cung có ảnh thật, quãng đường, thời gian đi và một điểm độ khó do chính những người đã leo xếp hạng.',
    notes: [
      { box: [0.080, 0.168, 0.157, 0.028], side: 'left', dy: -0.02, label: 'Độ khó do người đã leo xếp hạng' },
      { box: [0.832, 0.840, 0.138, 0.0635], side: 'right', dy: -0.08, label: 'Chụp một tấm, AI gọi tên cây' },
    ],
    margins: [
      { slot: 'tl', head: 'Ứng dụng iOS', body: 'Leo núi / Việt Nam' },
      { slot: 'ml', head: '60+ cung núi', body: 'Từ Bắc vào Nam' },
      { slot: 'mr', head: 'Độ khó', body: 'Do cộng đồng xếp hạng' },
      { slot: 'br', head: 'Miễn phí', body: 'Tải về là dùng' },
    ],
  },
  {
    id: 'dia-hinh-3d',
    rail: 'Địa hình 3D',
    src: '/screens/02-dia-hinh-3d.jpg',
    headline: ['Xem núi trước,', 'rồi hãy leo'],
    tagline: 'Địa hình 3D từ dữ liệu độ cao thật.',
    taglineSub: 'Xoay, nghiêng và phóng to quanh đỉnh để biết đoạn nào dốc, lán nghỉ ở đâu và con đường dẫn lên tới đâu.',
    notes: [
      { box: [0.515, 0.1585, 0.065, 0.030], side: 'right', dy: -0.02, label: 'Đỉnh Pu Si Lung, 3083 m' },
      { box: [0.438, 0.5395, 0.072, 0.033], side: 'left', dy: 0.0, label: 'Lán nghỉ trên đường lên' },
      { box: [0.632, 0.803, 0.180, 0.045], side: 'right', dy: -0.03, label: 'Cung khó nhất, do người leo xếp hạng' },
    ],
    margins: [
      { slot: 'tl', head: 'Pu Si Lung', body: 'Mường Tè, Lai Châu' },
      { slot: 'ml', head: '3083 m', body: 'Độ cao đỉnh' },
      { slot: 'mr', head: 'Siêu nhân', body: 'Tầng độ khó cao nhất' },
      { slot: 'br', head: 'Địa hình 3D', body: 'Ảnh vệ tinh + độ cao DEM' },
    ],
  },
  {
    id: 'ban-do-offline',
    rail: 'Offline',
    src: '/screens/03-ban-do-offline.jpg',
    headline: ['Mất sóng,', 'bản đồ vẫn còn'],
    tagline: 'Tải trước, giữa rừng vẫn thấy đường.',
    taglineSub: 'Bạn tải bản đồ, địa hình và các điểm đặc biệt của cung trước khi đi. Lên núi không có sóng, tuyến vẫn nằm đúng dưới chân bạn.',
    notes: [
      { box: [0.084, 0.653, 0.357, 0.030], side: 'left', dy: 0.0, label: 'Một chạm là tải cả cung về máy' },
      { box: [0.303, 0.366, 0.070, 0.032], side: 'left', dy: -0.04, label: 'Đỉnh và lán nghỉ có sẵn trên bản đồ' },
      { box: [0.378, 0.884, 0.562, 0.065], side: 'right', dy: -0.10, label: 'Bấm là ghi hành trình bằng GPS' },
    ],
    margins: [
      { slot: 'tl', head: 'Bản đồ offline', body: 'Bản đồ + địa hình + điểm đặc biệt' },
      { slot: 'ml', head: 'GPX thật', body: 'Từng khúc cua' },
      { slot: 'mr', head: 'GPS nền', body: 'Khoá màn vẫn ghi' },
      { slot: 'br', head: 'Tôi bị lạc', body: 'Chỉ đường quay lại tuyến' },
    ],
  },
  {
    id: 'track-log',
    rail: 'Track log',
    src: '/screens/04-track-log.jpg',
    headline: ['Mỗi chuyến đi', 'là một bản ghi đầy đủ'],
    tagline: 'Track log giữ lại cả hành trình.',
    taglineSub: 'Quãng đường, thời gian, độ cao tích luỹ và biểu đồ độ cao của cả chuyến. Ảnh bạn chụp nằm đúng chỗ trên tuyến.',
    notes: [
      { box: [0.789, 0.218, 0.098, 0.0445], side: 'right', dy: -0.02, label: 'Ảnh nằm đúng chỗ bạn chụp' },
      { box: [0.041, 0.800, 0.920, 0.1725], side: 'left', dy: -0.06, label: 'Biểu đồ độ cao cả chuyến' },
      { box: [0.588, 0.5125, 0.371, 0.054], side: 'right', dy: 0.04, label: 'Lần sau đi lại đúng đường này' },
    ],
    margins: [
      { slot: 'tl', head: 'Nam Kang Ho Tao', body: 'Sa Pa, Lào Cai' },
      { slot: 'ml', head: '27 km', body: 'Hai ngày trên núi' },
      { slot: 'mr', head: '+2663 m', body: 'Độ cao tích luỹ' },
      { slot: 'br', head: 'GPX', body: 'Tải về hoặc đăng bài' },
    ],
  },
  {
    id: 'phat-lai',
    rail: 'Phát lại',
    src: '/screens/05-phat-lai.jpg',
    headline: ['Đi xong,', 'xem lại từ trên cao'],
    tagline: 'Phát lại hành trình trên địa hình 3D.',
    taglineSub: 'Camera bay theo đúng đường bạn đi, kèm tên, độ cao và quãng đường. Quay màn hình là có ngay một đoạn phim để khoe.',
    notes: [
      { box: [0.413, 0.586, 0.068, 0.031], side: 'left', dy: 0.02, label: 'Camera bay theo từng bước chân' },
      { box: [0.250, 0.196, 0.500, 0.037], side: 'right', dy: 0.0, label: 'Độ cao, quãng đường chạy theo chấm' },
      { box: [0.118, 0.139, 0.790, 0.036], side: 'left', dy: -0.03, label: 'Tên bạn trên từng khung hình' },
    ],
    margins: [
      { slot: 'tl', head: 'Phát lại 3D', body: 'Camera bay theo đường đi' },
      { slot: 'ml', head: 'Quay màn hình', body: 'Thành phim ngắn để khoe' },
      { slot: 'mr', head: 'Poster', body: 'Ảnh khoe chuyến một chạm' },
      { slot: 'br', head: 'Dừng ở ảnh', body: 'Tới chỗ chụp là dừng lại' },
    ],
  },
  {
    id: 'son-pha',
    rail: 'Sơn phả',
    src: '/screens/06-son-pha.jpg',
    headline: ['Mỗi đỉnh', 'là một huy chương'],
    tagline: 'Đỉnh nào bạn lên, núi đều ghi nhớ.',
    taglineSub: 'Bạn lên tới đỉnh là được ghi danh. Sơn phả lớn dần theo số đỉnh, có Bảng Vàng theo mùa và danh hiệu đổi theo mùa leo.',
    notes: [
      { box: [0.055, 0.672, 0.400, 0.110], side: 'left', dy: 0.0, label: 'Mỗi đỉnh ghi danh là một huy chương' },
      { box: [0.326, 0.4425, 0.353, 0.0275], side: 'right', dy: -0.03, label: 'Cấp bậc lớn dần theo số đỉnh' },
      { box: [0.524, 0.2675, 0.106, 0.0265], side: 'right', dy: -0.05, label: 'Huy hiệu 500 người đầu tiên' },
    ],
    margins: [
      { slot: 'tl', head: 'Sơn phả', body: 'Sổ đỉnh của riêng bạn' },
      { slot: 'ml', head: 'Ghi danh', body: 'Đứng trên đỉnh là đủ' },
      { slot: 'mr', head: 'Danh hiệu', body: 'Đổi theo mùa Sơn Tinh' },
      { slot: 'br', head: 'Bảng Vàng', body: 'Ai lên nhiều đỉnh nhất mùa' },
    ],
  },
]

export const STORE_URL = 'https://apps.apple.com/vn/app/waytrek/id6789542012'
export const PRIVACY_URL = 'https://admin-waytrek.vercel.app/privacy'
export const TERMS_URL = 'https://admin-waytrek.vercel.app/terms'
