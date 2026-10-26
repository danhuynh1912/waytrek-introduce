import { useEffect, useRef, useState } from 'react'
import type { StartTrailhead } from '../../core/types'
import { IClose } from '../icons'

export interface StartPeakAsk {
  peakName: string
  /** Hỏi máy chủ chân núi — null = đỉnh chưa có lộ trình nào. */
  find: () => Promise<StartTrailhead | null>
  /** Chèn chân núi làm điểm xuất phát. */
  apply: (t: StartTrailhead) => void
}

/**
 * Người dùng chấm một ĐỈNH làm điểm đầu tiên: hỏi có thật xuất phát trên đỉnh
 * không, hay để máy chọn chân núi lên đỉnh nhanh nhất làm điểm xuất phát.
 */
export function StartPeakDialog({ ask, onClose }: { ask: StartPeakAsk | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (ask && !d.open) {
      setBusy(false)
      setError(null)
      d.showModal()
    } else if (!ask && d.open) d.close()
  }, [ask])

  const pick = async () => {
    if (!ask) return
    setBusy(true)
    setError(null)
    try {
      const t = await ask.find()
      if (!t) {
        setError(
          `${ask.peakName} chưa có lộ trình nào trong dữ liệu WayTrek nên chưa chọn được chân núi. Bạn có thể tự chấm điểm xuất phát trên bản đồ.`,
        )
        setBusy(false)
        return
      }
      ask.apply(t)
      onClose()
    } catch (e) {
      console.warn('plan: chọn chân núi lỗi —', e)
      setError('Chưa chọn được chân núi (lỗi mạng hoặc máy chủ). Thử lại sau giây lát.')
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} className="pl-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="pl-startpeak-title">
      <div className="pl-dialog-head">
        <h2 id="pl-startpeak-title">Điểm xuất phát đang là một đỉnh núi</h2>
        <button type="button" className="pl-icon-btn" onClick={onClose} aria-label="Đóng" data-tip="Đóng — giữ điểm xuất phát trên đỉnh">
          <IClose />
        </button>
      </div>
      <p className="pl-dialog-lead">
        Kế hoạch đang bắt đầu ngay trên đỉnh {ask?.peakName}. Thường thì chuyến đi bắt đầu từ chân núi — WayTrek có thể
        chọn giúp bạn chân núi lên đỉnh nhanh nhất theo các lộ trình đã có.
      </p>
      <div className="pl-dialog-actions">
        <button
          type="button"
          className="pl-btn pl-btn-wide pl-btn-primary"
          onClick={pick}
          disabled={busy}
          data-tip="Thêm chân núi lên đỉnh nhanh nhất làm điểm đầu tiên của kế hoạch"
        >
          {busy ? 'Đang chọn chân núi…' : 'Chọn giúp tôi điểm xuất phát dưới chân núi'}
        </button>
        <button type="button" className="pl-btn pl-btn-wide pl-btn-outline" onClick={onClose} disabled={busy} data-tip="Giữ nguyên — kế hoạch bắt đầu ngay trên đỉnh">
          Tôi xuất phát từ đỉnh
        </button>
      </div>
      {error && <p className="pl-note pl-note-danger">{error}</p>}
    </dialog>
  )
}

