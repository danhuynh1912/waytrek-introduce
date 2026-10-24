// Khoá CÔNG KHAI (anon, publishable) — cùng giá trị app WayTrek đóng gói trong
// `way_trek/.env`, ai mở app ra cũng đọc được. Quyền thật nằm ở RLS + RPC của
// schema `waytrek`; khoá service_role không bao giờ được nằm ở web.
export const SUPABASE_URL = 'https://xgucqsejhvjkbeyomtqf.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWNxc2VqaHZqa2JleW9tdHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjMxMTYsImV4cCI6MjA5ODYzOTExNn0.Zgsx7vP8X_goFIyDZP4_QvoJrZqq3TySEfegLo-vxmI'

export const TRIP_PLAN_URL = `${SUPABASE_URL}/functions/v1/trip-plan`

/** Style tự host như app (`MapConfig.styleUrl`) — nhãn Biển Đông theo bản của WayTrek. */
export const MAP_STYLE_URL = `${SUPABASE_URL}/storage/v1/object/public/map-styles/liberty-vi.json`

/** Tile độ cao terrarium qua worker `waytrek-dem` (`MapConfig.demTilesUrl`), chỉ phục vụ z ≤ 14. */
export const DEM_TILES_URL = 'https://waytrek-dem.trekkingdev.workers.dev/terrarium/{z}/{x}/{y}.png'
