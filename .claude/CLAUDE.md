# WayTrek — trang giới thiệu (`landing_web`)

Trang tĩnh giới thiệu app WayTrek: Vite + React + TypeScript, deploy Vercel
(`vercel.json`), miền `www.waytrek.site`. Cấu trúc thư mục và cách cập nhật
ảnh màn hình: `README.md`.

⚠️ Trang này còn là **cửa vào app**, không chỉ là trang giới thiệu:
- `public/.well-known/apple-app-site-association` + `assetlinks.json` quyết
  link nào mở thẳng app (Universal Link / App Link). Đổi đường dẫn ở đây là
  đổi hành vi app trên máy người dùng — đối chiếu với app trước.
- `/j/<mã>` là trang lời mời vào đoàn (`src/components/JoinPage.tsx`,
  `src/lib/invite.ts`); hình dạng link do app WayTrek quyết (`WayTrekWeb`,
  `InviteLink` trong `way_trek/lib`), trang này phải khớp.
- Mọi đường dẫn còn lại là **waytrek.site kiểu komoot** (`src/site/`): trang
  chủ, `/map` (khám phá mọi cung), `/trail/<id>` (một cung). Hiện nội dung app
  cho cả người chưa đăng nhập — TRỪ track log; thứ app bắt đăng nhập thì web
  cũng bắt đăng nhập (hộp chung `src/shared/AuthDialog.tsx`).
  · **Đường dẫn CHÉP hình dạng deep link của app** (`way_trek/lib/core/deep_link/
    deep_link_routes.dart`): `trail/<id>?route=`, `map?trail=`, `user/<id>`… — một
    link mở được cả web lẫn app (`waytrek://<cùng đường dẫn>`). Thêm trang = thêm
    đúng mẫu của app vào `src/site/core/routes.ts`, đừng đặt tên đường dẫn riêng.
  · Chỉ đọc dữ liệu CÔNG KHAI bằng khoá anon (RLS + RPC của `waytrek`), qua
    `src/site/data/catalog.ts`; supabase-js + maplibre tải lười — trang chủ không
    kéo theo. Đây là ngoại lệ có chủ đích của luật "trang tĩnh, không backend"
    (chủ sản phẩm 24/10: web phải xem được nội dung app).
  · Độ khó bày bằng **điểm** của bảng cộng đồng (`get_difficulty_board`, luật
    hiển thị + màu dải chép từ app ở `src/site/core/difficulty.ts`); nhãn Dễ/Khó
    chỉ là đường lui khi bảng chưa tải.
  · Hình học tuyến: LineString lẫn MultiLineString; gộp phẳng chỉ để tính khung
    nhìn, vẽ thì giữ ranh giới đoạn (`src/site/core/geometry.ts`). Trục quãng
    đường của biểu đồ độ cao khớp số CÔNG BỐ (`scaleProfile`).
  · Ảnh / tên / bài của NGƯỜI DÙNG KHÁC chưa có trên web: trang đó (Bảng Vàng,
    ảnh của cung, người ghi danh) cần một quyết định riêng về lập chỉ mục trước.
  · Test: `npm run test:site` (deno, `tests/site/`).
- `src/shared/` — thứ dùng chung của mọi trang: khoá + client Supabase, đăng nhập,
  định dạng số, bỏ dấu để tìm (`text.ts`), khởi động bản đồ theo theme
  (`map/relief-map.ts`), bảng màu nét vẽ (`map/ink.ts`). Đừng để trang này import
  ruột của trang kia — thứ hai trang cùng cần thì chuyển vào đây.
  · Hoàng Sa, Trường Sa (`map/vn-islands.ts`) do `relief-map.ts` cài cho MỌI bản
    đồ, trước lớp của trang. Dữ liệu + ba lớp chép từ app
    (`way_trek/lib/core/data/vn_islands_geojson.dart`,
    `core/map/vn_islands_layers.dart`) — app là chủ, sửa ở app trước rồi chép.
    Khung nhìn mở đầu vẫn chỉ ôm đất liền, như app (quyết định 22/9).
- `/plan` là **ứng dụng lên kế hoạch chuyến trek** (`src/plan/`, thiết kế:
  `spec/43-trip-planner.md` của repo WayTrek) — phần DUY NHẤT có tính toán ở
  máy chủ: Edge Function `trip-plan` (cùng Supabase, khoá anon công khai). Chunk
  tải lười: `/` và `/j/<mã>` không kéo `maplibre-gl` / `supabase-js` theo.
  · **Luật nằm hết ở máy chủ** (chia ngày, chọn lán, vùng nên nghỉ, mốc bình
    minh, gợi ý thứ tự leo). Web chỉ vẽ `doc` + `result` và gọi `trip-plan` —
    đừng tính lại giờ / cảnh báo ở đây, hai chỗ tính là hai chỗ lệch.
  · `src/plan/core/` thuần TypeScript (không React, không mạng), test bằng
    `npm run test:plan` (deno). Kiểu dữ liệu `core/types.ts` chép từ
    `supabase/functions/trip-plan/engine/types.ts` — engine là chủ, sửa ở đó trước.

## Engineering Rules

These rules apply to all code you create or modify. Follow existing project
conventions unless they conflict with a rule below; explain any necessary
exception.

1. **Separation of concerns:** Keep UI, business rules, data access, and
   infrastructure responsibilities separate.
2. **High cohesion, low coupling:** Keep related behavior together; modules
   must interact through small, explicit contracts.
3. **Dependency direction:** Business logic must not depend directly on UI
   frameworks, databases, vendors, or infrastructure. Use abstractions at
   boundaries when they provide real value.
4. **Encapsulation:** Do not expose or mutate a module's internal state from
   outside its ownership boundary. Enforce important invariants at the
   responsible boundary.
5. **Single source of truth (SSOT):** Each piece of authoritative state or
   business knowledge has one owner. Avoid competing copies and duplicated
   configuration.
   - Ở repo này: token màu trong `src/styles.css` chép 1:1 từ
     `app_theme_colors.dart` của app WayTrek — app là chủ, sửa ở app trước rồi
     chép lại. Ảnh màn trong `public/screens/` cũng chụp từ app (cách làm ở
     README).
6. **DRY:** Do not duplicate meaningful business rules or knowledge. Do not
   abstract code merely because it looks similar; keep separate concepts
   separate.
7. **Explicit data flow and side effects:** Make state changes, I/O, and side
   effects visible and predictable. Avoid hidden mutation and surprising
   global effects.
8. **Simple by default (KISS/YAGNI):** Implement the simplest design that
   satisfies current requirements. Do not add speculative features, layers,
   or abstractions.
   - Ở repo này: không backend riêng, không state manager — đừng thêm. Dữ liệu
     chỉ đọc qua Supabase (khoá anon) ở `/plan` và `src/site/` (xem đầu file);
     trạng thái nằm trong hook (`use-plan-editor`, `use-catalog`…), không thư
     viện quản lý trạng thái, không thư viện định tuyến.
9. **Testability:** Make business-critical behavior testable. Add or update
   focused tests for changed behavior and relevant edge cases.
10. **Fail clearly:** Validate untrusted inputs and important preconditions at
    system boundaries. Handle errors explicitly; do not silently swallow
    failures.
11. **Safe change scope:** Avoid unrelated refactors and behavior changes.
    Preserve existing public contracts unless the task requires changing them.
12. **Verify before completion:** Run relevant tests, type checks, lint, and
    build commands when available. Report what ran, what passed, and what
    could not be run.
    - Ở repo này: `npm run lint` (oxlint) và `npm run build` (`tsc -b` +
      `vite build`); đụng `src/plan/` thì thêm `npm run test:plan`. Đổi giao
      diện thì chạy `npm run dev` và nhìn cả hai theme ở bề ngang điện thoại.

### Working requirements

- Inspect the relevant code and existing patterns before editing.
- Prefer composition over deep inheritance.
- Avoid circular dependencies and unnecessary cross-module knowledge.
- Do not claim a rule is satisfied without inspecting supporting code or test
  evidence.
- If a rule conflicts with a requirement or existing constraint, choose the
  smallest safe exception and document the reason.
- In the final response, summarize the implementation, verification
  performed, and any known risks.

Kiểm một tính năng vừa làm theo bộ luật này: skill `architecture-rule-audit`
(`.claude/skills/architecture-rule-audit/SKILL.md`).
