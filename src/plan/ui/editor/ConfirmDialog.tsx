import { useEffect, useRef } from 'react'
import { IWarn } from '../icons'

/**
 * Hỏi lại trước một việc không hoàn tác được (chủ sản phẩm 26/10: bỏ bản nháp).
 * Nút làm việc đó màu đỏ; nút giữ nguyên là nút chính. Esc / đóng hộp = giữ.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm(): void
  onCancel(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={dialog} className="pl-dialog pl-strain" onCancel={onCancel} aria-labelledby="pl-confirm-title">
      <div className="pl-dialog-head">
        <h2 id="pl-confirm-title"><IWarn size={20} /> {title}</h2>
      </div>
      <p className="pl-dialog-lead">{body}</p>
      <div className="pl-dialog-actions">
        <button type="button" className="pl-btn pl-btn-wide pl-btn-primary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="pl-btn pl-btn-wide pl-btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
