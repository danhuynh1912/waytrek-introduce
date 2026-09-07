# WayTrek — trang giới thiệu

Landing page cho app WayTrek, dựng song song với `admin_web/` (cùng Vite + React + TypeScript).

- `npm run dev` — chạy local (từ thư mục này). Hoặc mở qua `.claude/launch.json` (server `landing`).
- `npm run build` — build ra `dist/`, deploy tĩnh (Vercel: có sẵn `vercel.json`).

## Cấu trúc

- `src/data/screens.ts` — bốn màn thật của app (ảnh trong `public/screens/`), câu chữ, và toạ độ
  chú thích viết tay (chuẩn hoá 0..1 theo khung ảnh, cùng quy ước `bbox` của `SpeciesAnnotation` trong app).
- `src/data/palettes.ts` — tone biển mây cho từng màn × theme, màu lấy từ hệ token của app.
- `src/components/CloudSea.tsx` — biển mây WebGL; đổi màn thì tween tone + trôi sang vùng mây khác.
- `src/components/Annotations.tsx` — vòng khoanh, mũi tên, chữ viết tay (font Grape Nuts, như app).
- `src/hooks/useScrollStage.ts` — mỗi cử chỉ cuộn/vuốt = đúng một màn, bất kể mạnh nhẹ.
- `src/styles.css` — token màu chép 1:1 từ `app_theme_colors.dart`, hai theme, mặc định theo hệ thống.

## Cập nhật ảnh màn hình

Chụp từ simulator bằng `xcrun simctl io booted screenshot`, xuất JPEG rộng ~830px vào `public/screens/`,
rồi chỉnh lại `box` của các chú thích trong `screens.ts` nếu bố cục màn đó đổi.
