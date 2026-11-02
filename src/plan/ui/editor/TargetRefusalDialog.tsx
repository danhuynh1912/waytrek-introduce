import { useEffect, useRef } from 'react'
import { chooseLabel } from '../../core/target'
import { IWarn } from '../icons'

export interface TargetRefusal {
  title: string
  body: string
  /** Số ngày máy gợi ý (nút "Chọn N ngày"); null = không có số nào gợi ý được. */
  suggestDays: number | null
}

/**
 * Số ngày vừa chọn không đi được (spec/48 §3.1): nói lý do, "Chọn N ngày" (số
 * máy gợi ý) và "Đã hiểu". Lựa chọn cũ giữ nguyên tới khi bấm chọn — kế hoạch
 * không bao giờ mang nhãn "2 ngày" mà vẽ ra 5.
 */
export function TargetRefusalDialog({ refusal, onClose, onChoose }: {
  refusal: TargetRefusal | null
  onClose: () => void
  onChoose: (days: number) => void
}) {
  const suggest = refusal?.suggestDays ?? null
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (refusal && !d.open) d.showModal()
    else if (!refusal && d.open) d.close()
  }, [refusal])
  return (
    <dialog ref={dialog} className="pl-dialog pl-strain" onClose={onClose} onCancel={onClose} aria-labelledby="pl-target-refusal-title">
      <div className="pl-dialog-head">
        <h2 id="pl-target-refusal-title"><IWarn size={20} /> {refusal?.title}</h2>
      </div>
      <p className="pl-dialog-lead">{refusal?.body}</p>
      <div className="pl-dialog-actions">
        {suggest != null && (
          <button type="button" className="pl-btn pl-btn-wide pl-btn-primary" onClick={() => onChoose(suggest)} autoFocus>
            {chooseLabel(suggest)}
          </button>
        )}
        <button
          type="button"
          className={`pl-btn pl-btn-wide ${suggest != null ? 'pl-btn-outline' : 'pl-btn-primary'}`}
          onClick={onClose}
          autoFocus={suggest == null}
        >
          Đã hiểu
        </button>
      </div>
    </dialog>
  )
}
