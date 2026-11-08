# WayTrek — trang giới thiệu (`landing_web`)

Trang tĩnh giới thiệu app WayTrek: Vite + React + TypeScript, miền
`www.waytrek.site`. Cấu trúc thư mục và cách cập nhật ảnh màn hình: `README.md`.

**Deploy = push `main`** → GitHub Action `.github/workflows/deploy-pages.yml`
(lint + build + `wrangler pages deploy`) lên **Cloudflare Pages**, project
`waytrek-site`. Chuyển từ Vercel ngày 28/10/2026 (Vercel Hobby cấm dùng thương
mại); DNS `waytrek.site` do Cloudflare quản lý.
- Cấu hình phục vụ nằm ở `public/_headers` (Content-Type JSON cho hai file
  liên kết app, `noindex` cho `/j/` `/plan/` `/t/`). Pages chạy chế độ SPA vì
  `dist/` KHÔNG có `404.html` — thêm file đó là mọi đường dẫn con thành 404.
- `waytrek.site` → `www` là một Redirect Rule của Cloudflare (không nằm trong
  repo), cố ý CHỪA `/.well-known/`: Android xác minh App Link ở cả hai tên và
  không chấp nhận chuyển hướng.
- Đừng chạy `wrangler` trong thư mục này: bản 4.x tự sửa `package.json` /
  `vite.config.ts`. Workflow chạy nó ở thư mục tạm; deploy tay thì làm y vậy.
- `vercel.json` còn lại cho tới khi gỡ hẳn project Vercel — sửa header thì sửa
  `_headers`, vì đó mới là thứ đang phục vụ.

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
  · Ảnh cung luôn đi qua `sizedImage` (`src/site/core/images.ts`, render endpoint
    của Storage, cắt đúng tỉ lệ ô) — KHÔNG đặt `imageUrl` trần vào `<img>`: ảnh gốc
    trung bình 814 kB, và Supabase tính mọi byte, kể cả từ CDN, vào hạn mức.
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

- **Đa ngôn ngữ** (`src/i18n/`, 10 ngôn ngữ: vi · en · ja · ko · zh (giản thể) · th · lo · my · id · ms):
  · **Tiếng Việt là bản gốc và KHÔNG có tiền tố** (`/`, `/map`) — giữ nguyên link đã lập chỉ mục và
    deep link của app; ngôn ngữ khác có tiền tố `/en/`, `/ja/map`, `/zh/trail/<id>`… Địa chỉ là nguồn
    DUY NHẤT của ngôn ngữ (không state thứ hai); `navigate` / `Link` tự giữ tiền tố, đổi ngôn ngữ =
    tải trang của địa chỉ mới (bộ chọn `LanguageSwitch`). `routes.ts` KHÔNG biết tiền tố — `router.ts`
    tách nó ra trước khi parse.
  · **Câu chữ ở `src/i18n/messages/<mã>.ts`**; `vi.ts` định nghĩa kiểu `Messages`, ngôn ngữ khác thiếu
    khoá là TypeScript báo. `npm run test:i18n` bắt thêm: lệch số phần tử mảng, lệch biến `{tên}`, chuỗi
    rỗng. Thêm khoá = thêm vào `vi.ts` rồi cả 9 file kia. Dịch cho TỰ NHIÊN theo từng ngôn ngữ, đừng
    dịch từng chữ (đã chốt: "cung" → peak/山/산/山峰…; "ghi danh" → check-in / 登頂記録 / 登顶打卡…).
    Mảnh ghép câu (`seo.sep`, `seo.colon`, `nameRegion`) có để mỗi ngôn ngữ dùng dấu câu của mình.
  · **Số theo ngôn ngữ**: `useI18n().fmt` (`makeNumberFormat`, luôn chữ số Latin — `-u-nu-latn`).
    Đừng import `count` / `distance` / `meters` trần vào trang đã dịch: đó là bản tiếng Việt (dấu chấm
    ngăn nghìn) dành cho /plan và test.
  · **Font**: Inter Tight không có chữ Nhật / Hàn / Hoa / Thái / Lào / Miến → `document.ts` nạp Noto
    tương ứng CHỈ khi trang ở ngôn ngữ đó; `styles.css` đặt `--font-sans`, khoảng dòng, tắt
    letter-spacing âm theo `:lang()`; `home.css` đọc `--h1-k` / `--h1-lh` / `--h2-lh`.
  · **SEO**: `seo.ts` (`buildHead`, `alternatesOf`) là MỘT nguồn cho cả `usePageMeta` (lúc chạy) lẫn
    `vite-plugins/seo-pages.ts` (lúc build: `/en/` → `dist/en/index.html`, `/en/map` → `dist/en/map.html`
    — thư mục + `.html` để Pages phục vụ đúng địa chỉ, KHÔNG chuyển hướng `/map` → `/map/` làm lệch
    canonical; kèm `sitemap.xml` có hreflang và JSON-LD ở trang chủ). Mỗi bản liệt kê ĐỦ cả bộ hreflang
    kể cả chính mình + `x-default` (= `/en/`). Mẫu `index.html` đổi hình mà regex không khớp thì build
    HỎNG (cố ý).
    **Thân trang tĩnh** (`i18n/static-body.ts`): văn bản của trang chủ / Khám phá nằm sẵn trong `#root` cho
    crawler không chạy JS (React `createRoot` thay nó ngay khi JS chạy). Trang Khám phá tĩnh kèm danh
    sách cung có link thật `/xx/trail/<id>`. Lúc build, `fetchTrails` gọi Supabase (khoá anon) lấy danh sách
    cung → danh sách đó + ~70 cung × 10 ngôn ngữ trong `sitemap.xml`; Supabase hỏng thì build VẪN chạy
    nhưng in cảnh báo to (xem log deploy: "KHÔNG lấy được danh sách cung") — đừng bỏ qua. `dist/index.html` là
    đường lui SPA của mọi địa chỉ không có file riêng, nên thân trang chủ tiếng Việt có chốt tự gỡ khi
    `location.pathname !== '/'`; ngôn ngữ khác có file riêng nên không cần. Mô tả ≤ 160 ký tự Latin,
    tiêu đề ≤ 75 (test chặn). KHÔNG tự chuyển hướng theo `Accept-Language`: crawler không gửi nó và sẽ lập chỉ mục
    nhầm.
  · **Chưa dịch** (vẫn tiếng Việt): `/plan` (cả Edge Function `trip-plan` trả cảnh báo tiếng Việt),
    `/t/<mã>` (theo dõi chuyến đi), `/j/<mã>` (lời mời đoàn), nội dung người dùng / đội ngũ nhập (tên
    cung, mô tả, truyện núi, điểm đánh dấu), trang pháp lý ở admin web, nhãn địa danh trên bản đồ.
  · Link cửa hàng theo ngôn ngữ (`storeUrlFor` / `playUrlFor` trong `shared/links.ts`): App Store của
    nước dùng ngôn ngữ đó (app phát hành ở 11 nước, xem CLAUDE.md của WayTrek) — đổi bảng ở
    `LOCALE_INFO.storefront`.

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
   - Ở repo này: token màu trong `src/styles.css` theo bộ thành phần mới của
     app (spec/52, canvas "WayTrek — bản vẽ các màn": nền #0A0A0A / #F7F7F5,
     nhấn lime #BDFE2E) — bản vẽ là chủ, sửa ở đó trước rồi chép. Mặt TÔ dùng
     `--accent` (+ `--on-accent`), chữ / nét mang màu nhấn dùng `--accent-ink`
     (lime trên nền tối, rêu sẫm trên nền sáng — lime trên nền sáng không đọc
     được). Trang chủ CỐ Ý luôn tối (`.wt-dark`). Ảnh màn trong
     `public/screens/` chụp từ app (cách làm ở README).
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
