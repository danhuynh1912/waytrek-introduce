# WayTrek — trang giới thiệu

Landing page cho app WayTrek, dựng song song với `admin_web/` (cùng Vite + React + TypeScript).

- `npm run dev` — chạy local (từ thư mục này). Hoặc mở qua `.claude/launch.json` (server `landing`).
- `npm run build` — build ra `dist/`, deploy tĩnh (Vercel: có sẵn `vercel.json`).

## Cấu trúc

- `src/data/screens.ts` — sáu màn thật của app (ảnh trong `public/screens/`), câu chữ, và toạ độ
  chú thích viết tay (chuẩn hoá 0..1 theo khung ảnh, cùng quy ước `bbox` của `SpeciesAnnotation` trong app).
- `src/data/palettes.ts` — tone biển mây cho từng màn × theme, màu lấy từ hệ token của app.
- `src/components/CloudSea.tsx` — biển mây WebGL; đổi màn thì tween tone + trôi sang vùng mây khác.
- `src/components/Annotations.tsx` — vòng khoanh, mũi tên, chữ viết tay (font Grape Nuts, như app).
- `src/hooks/useScrollStage.ts` — mỗi cử chỉ cuộn/vuốt = đúng một màn, bất kể mạnh nhẹ.
- `src/styles.css` — token màu chép 1:1 từ `app_theme_colors.dart`, hai theme, mặc định theo hệ thống.

## Lên kế hoạch chuyến trek (`/plan`)

Thiết kế: `spec/43-trip-planner.md` (repo WayTrek). Mọi luật tính ở Edge Function `trip-plan`; web chỉ vẽ.

- `src/plan/core/` — thuần TypeScript: kiểu dữ liệu (chép từ engine), sửa `doc`, câu chữ cảnh báo, dòng thời
  gian, danh sách chuẩn bị. Test: `npm run test:plan` (cần `deno`).
- `src/plan/data/` — Supabase (khoá anon, `config.ts`), gọi `trip-plan` (`compute`, `suggest`, `save`), bản nháp.
- `src/plan/ui/` — bản đồ MapLibre, dòng thời gian, thẻ gợi ý thứ tự leo, thanh số liệu.
- Đăng nhập trên web cần `https://www.waytrek.site/**` (và `http://localhost:5174/**` khi thử) trong
  Supabase → Auth → URL Configuration → Redirect URLs.

## Cập nhật ảnh màn hình

Chụp từ simulator bằng `xcrun simctl io booted screenshot`, xuất JPEG rộng ~830px vào `public/screens/`,
rồi chỉnh lại `box` của các chú thích trong `screens.ts` nếu bố cục màn đó đổi.

- **Chụp từ build của nhánh `master`** (app thật sắp phát hành). Simulator trên máy dev hay đang cài bản
  build từ nhánh thử nghiệm giao diện (`experiment/ui-lab`) — kiểm `Runner.app` đang cài là của checkout
  nào trước khi chụp.
- **Chỉ dùng dữ liệu catalog hoặc của chính tài khoản chủ dự án.** Tên, ảnh, bài viết của người dùng khác
  (bài nổi bật, Bảng Vàng, dãy avatar người ghi danh) không được lên trang giới thiệu.
- Thanh trạng thái sạch: `xcrun simctl status_bar booted override --time "9:41" --batteryState discharging
  --batteryLevel 100 --cellularBars 4 --wifiBars 3`, chụp xong thì `status_bar booted clear`.
