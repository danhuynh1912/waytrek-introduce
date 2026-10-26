import { useEffect, useRef } from 'react'
import { IWarn } from '../icons'

/**
 * Vừa kéo một điểm sang chỗ / ngày khác mà lịch thành quá gắt (chủ sản phẩm
 * 26/10): hỏi lại giữa màn, nói ngắn gọn hậu quả của từng ngày (`addedStrain`).
 * "Vẫn giữ" đóng hộp; "Hoàn tác" bỏ đúng lần kéo đó.
 */
export function StrainDialog({ lines, onKeep, onUndo }: {
  /** Hậu quả của lịch mới; null = không hỏi. */
  lines: string[] | null
  onKeep(): void
  onUndo(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (lines && !d.open) d.showModal()
    else if (!lines && d.open) d.close()
  }, [lines])

  return (
    <dialog ref={dialog} className="pl-dialog pl-strain" onCancel={onKeep} aria-labelledby="pl-strain-title">
      <div className="pl-dialog-head">
        <h2 id="pl-strain-title"><IWarn size={20} /> Lịch trình này có thể quá sức bạn</h2>
      </div>
      <ul className="pl-strain-list">
        {lines?.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="pl-dialog-lead">Bạn vẫn muốn giữ lịch này?</p>
      <div className="pl-dialog-actions">
        <button type="button" className="pl-btn pl-btn-wide pl-btn-primary" onClick={onUndo} data-tip="Bỏ lần kéo vừa rồi, về lại lịch trước đó">
          Hoàn tác
        </button>
        <button type="button" className="pl-btn pl-btn-wide pl-btn-outline" onClick={onKeep} data-tip="Giữ lịch mới — cảnh báo vẫn nằm ở từng ngày">
          Vẫn giữ
        </button>
      </div>
    </dialog>
  )
}
