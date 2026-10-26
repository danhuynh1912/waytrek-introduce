import { useEffect, useRef } from 'react'
import { clock } from '@/shared/format'
import { IWarn } from '../icons'

/** Giờ có mặt người dùng vừa đặt ở một điểm mà phải đi bộ trong tối mới tới. */
export interface LateArrival {
  name: string
  targetMin: number
  limitMin: number
}

/**
 * Đặt giờ có mặt muộn ở một điểm trên cung trek / chân núi (chủ sản phẩm
 * 26/10): không cấm, không tự dời — hỏi lại. "Đồng ý" giữ nguyên; "Dời sang
 * ngày sau" ngủ trước điểm đó, tới vào ngày hôm sau (bỏ giờ muộn đã đặt).
 */
export function LateArrivalDialog({ late, onKeep, onNextDay }: {
  late: LateArrival | null
  onKeep(): void
  onNextDay(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (late && !d.open) d.showModal()
    else if (!late && d.open) d.close()
  }, [late])

  return (
    <dialog ref={dialog} className="pl-dialog pl-strain" onCancel={onKeep} aria-labelledby="pl-late-title">
      <div className="pl-dialog-head">
        <h2 id="pl-late-title"><IWarn size={20} /> Tới nơi sau giờ an toàn</h2>
      </div>
      <p className="pl-dialog-lead">
        {late && (
          <>
            Tới <b>{late.name}</b> lúc {clock(late.targetMin)} — sau giờ an toàn {clock(late.limitMin)}, phải đi bộ
            trong tối.
          </>
        )}
      </p>
      <div className="pl-dialog-actions">
        <button type="button" className="pl-btn pl-btn-wide pl-btn-primary" onClick={onKeep} data-tip="Giữ giờ đã đặt — cảnh báo vẫn nằm ở ngày đó">
          Đồng ý
        </button>
        <button type="button" className="pl-btn pl-btn-wide pl-btn-outline" onClick={onNextDay} data-tip="Ngủ trước điểm này, tới vào ngày hôm sau — bỏ giờ muộn vừa đặt">
          Dời sang ngày sau
        </button>
      </div>
    </dialog>
  )
}
