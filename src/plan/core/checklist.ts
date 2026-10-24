// Danh sách chuẩn bị (spec/43 §11). Máy chủ quyết mục mặc định nào ÁP DỤNG
// (`result.checklist`); chữ của từng mã nằm ở client. Mỗi mục một dòng
// `trip_plan_checklist`, thắng theo `updatedAt` của riêng nó (không có version).

export interface ChecklistRow {
  itemId: string
  kind: 'builtin' | 'custom'
  /** builtin: null = dùng chữ mặc định; custom: bắt buộc. */
  label: string | null
  done: boolean
  removed: boolean
  /** ISO 8601. */
  updatedAt: string
}

export const BUILTIN_LABELS: Record<string, string> = {
  offline_maps: 'Tải bản đồ offline các cung trên tuyến trong app WayTrek',
  leader_phone: 'Lưu số trưởng đoàn / porter',
  share_plan: 'Gửi kế hoạch cho người thân',
  headlamp: 'Đèn pin + pin dự phòng',
  rain_gear: 'Áo mưa',
  warm_layer: 'Áo ấm',
  tent: 'Lều, túi ngủ, tấm lót — có đêm phải cắm trại',
  water: 'Nước cho chặng dài nhất không có nguồn nước',
  power_bank: 'Sạc dự phòng',
  first_aid: 'Túi y tế cá nhân',
  emergency_numbers: 'Lưu số cứu nạn 112, công an 113, cấp cứu 115',
}

export const MAX_ITEMS = 80

export interface ChecklistItem {
  itemId: string
  kind: 'builtin' | 'custom'
  label: string
  done: boolean
}

/** Mục hiện ra: mặc định đang áp dụng (chưa xoá) theo thứ tự máy chủ, rồi mục tự thêm. */
export function viewChecklist(
  codes: readonly string[],
  rows: ReadonlyMap<string, ChecklistRow>,
): ChecklistItem[] {
  const out: ChecklistItem[] = []
  for (const code of codes) {
    const label = BUILTIN_LABELS[code]
    if (!label) continue // mã mới của máy chủ mà bản web này chưa có chữ
    const row = rows.get(code)
    if (row?.removed) continue
    out.push({ itemId: code, kind: 'builtin', label: row?.label ?? label, done: row?.done ?? false })
  }
  const customs = [...rows.values()]
    .filter((r) => r.kind === 'custom' && !r.removed && r.label)
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
  for (const r of customs) out.push({ itemId: r.itemId, kind: 'custom', label: r.label!, done: r.done })
  return out
}

export function unknownCodes(codes: readonly string[]): string[] {
  return codes.filter((c) => !BUILTIN_LABELS[c])
}

/** Ghi một thay đổi lên một mục (tạo mới nếu chưa có dòng). */
export function editItem(
  rows: ReadonlyMap<string, ChecklistRow>,
  itemId: string,
  kind: 'builtin' | 'custom',
  patch: { label?: string; done?: boolean; removed?: boolean },
  nowIso: string,
): ChecklistRow {
  const old = rows.get(itemId)
  const label = patch.label === undefined ? (old?.label ?? null) : (patch.label.trim().slice(0, 120) || null)
  return {
    itemId,
    kind: old?.kind ?? kind,
    label,
    done: patch.done ?? old?.done ?? false,
    removed: patch.removed ?? old?.removed ?? false,
    updatedAt: nowIso,
  }
}

/** Gộp dòng máy chủ với dòng trên máy: mỗi mục, bản mới hơn thắng (cùng luật máy chủ). */
export function mergeRows(
  local: ReadonlyMap<string, ChecklistRow>,
  server: readonly ChecklistRow[],
): Map<string, ChecklistRow> {
  const out = new Map(local)
  for (const s of server) {
    const l = out.get(s.itemId)
    if (!l || Date.parse(l.updatedAt) <= Date.parse(s.updatedAt)) out.set(s.itemId, s)
  }
  return out
}

/** Id mục tự thêm — thứ tự hiển thị theo id nên kèm mốc thời gian. */
export function customItemId(nowMs: number, rand: () => string): string {
  return `c${nowMs.toString(36)}${rand()}`.slice(0, 64)
}

export function progress(items: readonly ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length }
}
