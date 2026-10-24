// Bản nháp trên máy (localStorage): giữ công sức khi đóng tab, khi mất mạng,
// và khi đi vòng qua trang đăng nhập Google. Chỉ là chỗ đệm của MỘT trình
// duyệt — bản thật nằm trên máy chủ sau lần Lưu đầu tiên. Mọi lần đọc/ghi bọc
// try/catch: chế độ riêng tư hoặc bị chặn lưu trữ thì trang vẫn chạy, chỉ là
// không nhớ.

import type { ChecklistRow } from '../core/checklist'
import type { PlanDoc } from '../core/types'

export interface Draft {
  id: string
  doc: PlanDoc
  /** Đã có trên máy chủ chưa (sau lần Lưu đầu). */
  saved: boolean
  /** Version máy chủ mà doc này dựa vào. */
  baseVersion: number
  /** Còn thay đổi chưa gửi lên máy chủ. */
  dirty: boolean
  checklist: ChecklistRow[]
  /** Mục chuẩn bị chưa gửi được. */
  checklistDirty: string[]
  at: number
}

const key = (id: string) => `wt-plan:${id}`
const NEW_KEY = 'wt-plan:new'
const PENDING_SAVE_KEY = 'wt-plan:pending-save'

function read(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

function write(k: string, v: string | null): void {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch (e) {
    console.warn('plan: không ghi được bản nháp —', e)
  }
}

export function readDraft(id: string): Draft | null {
  const raw = read(key(id))
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Draft
    if (d?.doc?.v !== 1 || !Array.isArray(d.doc.waypoints)) return null
    return {
      ...d,
      checklist: Array.isArray(d.checklist) ? d.checklist : [],
      checklistDirty: Array.isArray(d.checklistDirty) ? d.checklistDirty : [],
    }
  } catch {
    console.warn('plan: bản nháp hỏng, bỏ qua —', id)
    return null
  }
}

export function writeDraft(d: Draft): void {
  write(key(d.id), JSON.stringify(d))
}

export function dropDraft(id: string): void {
  write(key(id), null)
}

/** Kế hoạch mới chưa lưu đang soạn — mở lại /plan/new thì soạn tiếp đúng nó. */
export function newDraftId(): string | null {
  return read(NEW_KEY)
}

export function setNewDraftId(id: string | null): void {
  write(NEW_KEY, id)
}

/** Bấm Lưu khi chưa đăng nhập → đi Google → quay về thì lưu tiếp kế hoạch này. */
export function pendingSaveId(): string | null {
  return read(PENDING_SAVE_KEY)
}

export function setPendingSave(id: string | null): void {
  write(PENDING_SAVE_KEY, id)
}
