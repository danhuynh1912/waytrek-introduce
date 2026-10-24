# WayTrek — trang giới thiệu

Landing page cho app WayTrek, dựng song song với `admin_web/` (cùng Vite + React + TypeScript).

- `npm run dev` — chạy local (từ thư mục này). Hoặc mở qua `.claude/launch.json` (server `landing`).
- `npm run build` — build ra `dist/`, deploy tĩnh (Vercel: có sẵn `vercel.json`).

## Cấu trúc

- `src/main.tsx` — chọn ứng dụng theo đường dẫn lúc tải trang: `/plan…` (lên kế hoạch), `/j/<mã>`
  (lời mời vào đoàn), còn lại là waytrek.site (`src/site/`).
- `src/site/` — trang chủ + xem nội dung app (trừ track log). Đường dẫn chép hình dạng deep link của
  app (`/map?trail=`, `/trail/<id>?route=`).
  - `core/` — thuần TypeScript: bảng đường dẫn, danh mục cung (tìm / xếp), điểm độ khó + màu dải
    (chép từ app), hình học tuyến (đoạn, biểu đồ độ cao, chặng đi xe). Test: `npm run test:site`.
  - `data/catalog.ts` — mọi lần đọc Supabase của các trang này (khoá anon, có trần thời gian chờ).
  - `pages/` — `HomePage` (bố cục "case study": mở đầu, tổng quan có số liệu thật, nỗi lo / lời đáp,
    cung được leo nhiều nhất, tính năng), `MapPage` (`/map`), `TrailPage` (`/trail/<id>`).
  - `ui/` — đầu / chân trang, nét vẽ tay (`Doodle`), bản đồ vẽ tay (`SketchMap`), đường mòn nét đứt
    nối các khối (`TrailConnector`), bản đồ MapLibre của từng trang (`ui/map/`), biểu đồ độ cao.
- `src/shared/` — dùng chung cho mọi trang: Supabase + đăng nhập (`AuthDialog`), định dạng số, bỏ dấu
  để tìm, link ra ngoài, khởi động bản đồ theo theme + bảng màu nét vẽ (`map/`).
- `src/styles.css` — token màu chép 1:1 từ `app_theme_colors.dart`, hai theme; mặc định Tối như app.

## Lên kế hoạch chuyến trek (`/plan`)

Thiết kế: `spec/43-trip-planner.md` (repo WayTrek). Mọi luật tính ở Edge Function `trip-plan`; web chỉ vẽ.

- `src/plan/core/` — thuần TypeScript: kiểu dữ liệu (chép từ engine), sửa `doc`, câu chữ cảnh báo, dòng thời
  gian, danh sách chuẩn bị. Test: `npm run test:plan` (cần `deno`).
- `src/plan/data/` — gọi `trip-plan` (`compute`, `suggest`, `save`) qua client chung `src/shared/supabase.ts`, bản nháp.
- `src/plan/ui/` — bản đồ MapLibre, dòng thời gian, thẻ gợi ý thứ tự leo, thanh số liệu.
- Đăng nhập trên web cần `https://www.waytrek.site/**` (và `http://localhost:5174/**` khi thử) trong
  Supabase → Auth → URL Configuration → Redirect URLs.

## Cập nhật ảnh màn hình

Chụp từ simulator bằng `xcrun simctl io booted screenshot`, xuất JPEG rộng ~830px vào `public/screens/`
(trang chủ dùng sáu ảnh này trong các khung máy — tên file khai ở `src/site/pages/HomePage.tsx`).

- **Chụp từ build của nhánh `master`** (app thật sắp phát hành). Simulator trên máy dev hay đang cài bản
  build từ nhánh thử nghiệm giao diện (`experiment/ui-lab`) — kiểm `Runner.app` đang cài là của checkout
  nào trước khi chụp.
- **Chỉ dùng dữ liệu catalog hoặc của chính tài khoản chủ dự án.** Tên, ảnh, bài viết của người dùng khác
  (bài nổi bật, Bảng Vàng, dãy avatar người ghi danh) không được lên trang giới thiệu.
- Thanh trạng thái sạch: `xcrun simctl status_bar booted override --time "9:41" --batteryState discharging
  --batteryLevel 100 --cellularBars 4 --wifiBars 3`, chụp xong thì `status_bar booted clear`.
