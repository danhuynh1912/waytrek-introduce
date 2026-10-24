import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'motion/react'
import { distance, fullDate, meters } from '@/shared/format'
import { deletePlan, listPlans } from '../data/api'
import type { PlanSummary } from '../data/api'
import { newDraftId, readDraft } from '../data/drafts'
import { IPlus, ITrash } from './icons'
import { navigate } from './route'


type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; plans: PlanSummary[] }
  | { kind: 'failed'; message: string }

const EASE = [0.65, 0, 0.35, 1] as const

function updatedLabel(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `Sửa ${d.getDate()}/${d.getMonth() + 1} lúc ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function PlanList({ session, onLogin }: { session: Session | null; onLogin: () => void }) {
  const [state, setState] = useState<ListState>({ kind: 'loading' })
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const draftId = newDraftId()
  const draft = draftId ? readDraft(draftId) : null
  const unsaved = draft && !draft.saved && draft.doc.waypoints.length > 0 ? draft : null

  const fetchList = useCallback(() => {
    listPlans()
      .then((plans) => setState({ kind: 'ready', plans }))
      .catch((e) => {
        console.warn('plan: tải danh sách lỗi —', e)
        setState({ kind: 'failed', message: 'Không tải được danh sách kế hoạch.' })
      })
  }, [])
  const reload = () => {
    setState({ kind: 'loading' })
    fetchList()
  }

  const userId = session?.user.id
  useEffect(() => {
    if (userId) fetchList()
  }, [userId, fetchList])

  const remove = async (id: string) => {
    setDeleteError(null)
    try {
      await deletePlan(id)
      setConfirming(null)
      setState((s) => (s.kind === 'ready' ? { kind: 'ready', plans: s.plans.filter((p) => p.id !== id) } : s))
    } catch (e) {
      console.warn('plan: xoá lỗi —', e)
      setDeleteError('Chưa xoá được — kiểm tra mạng rồi thử lại.')
    }
  }

  const open = (path: string) => navigate(path)

  if (!session) {
    return (
      <main className="pl-page">
        <div className="pl-intro">
          <h1>Lên kế hoạch chuyến trek</h1>
          <p>Từng giờ của chuyến đi, tính trên địa hình thật.</p>
          <div className="pl-intro-actions">
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => open('/plan/new')}>Bắt đầu lên kế hoạch</button>
            <button type="button" className="pl-btn pl-btn-quiet" onClick={onLogin}>Đăng nhập</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pl-page">
      <div className="pl-list-head">
        <h1>Kế hoạch của tôi</h1>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => open('/plan/new')}>
          <IPlus size={16} /> Kế hoạch mới
        </button>
      </div>

      {unsaved && (
        <button type="button" className="pl-list-row is-draft" onClick={() => open('/plan/new')}>
          <span className="pl-list-title">{unsaved.doc.title}</span>
          <span className="pl-list-meta">Bản nháp chưa lưu · {unsaved.doc.waypoints.length} điểm</span>
        </button>
      )}

      {state.kind === 'loading' && <div className="pl-progress" aria-label="Đang tải" />}
      {state.kind === 'failed' && (
        <p className="pl-note pl-note-danger">
          {state.message} <button type="button" className="pl-text-btn" onClick={reload}>Thử lại</button>
        </p>
      )}
      {state.kind === 'ready' && state.plans.length === 0 && !unsaved && (
        <p className="pl-muted pl-empty">Chưa có kế hoạch nào.</p>
      )}
      {deleteError && <p className="pl-note pl-note-danger">{deleteError}</p>}

      <AnimatePresence initial={false}>
        {state.kind === 'ready' &&
          state.plans.map((p) => (
            <motion.div
              key={p.id}
              className="pl-list-item"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <a
                className="pl-list-row"
                href={`/plan/${p.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  open(`/plan/${p.id}`)
                }}
              >
                <span className="pl-list-title">{p.title}</span>
                <span className="pl-list-meta">
                  {fullDate(p.startDate)} · {p.dayCount} ngày · {distance(p.distanceM)} · ↑ {meters(p.ascentM)}
                </span>
                <span className="pl-list-time">{updatedLabel(p.updatedAt)}</span>
              </a>
              {confirming === p.id ? (
                <span className="pl-list-confirm">
                  Xoá kế hoạch này?
                  <button type="button" className="pl-btn pl-btn-danger" onClick={() => remove(p.id)}>Xoá</button>
                  <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setConfirming(null)}>Huỷ</button>
                </span>
              ) : (
                <button type="button" className="pl-icon-btn" aria-label={`Xoá ${p.title}`} onClick={() => setConfirming(p.id)}>
                  <ITrash size={17} />
                </button>
              )}
            </motion.div>
          ))}
      </AnimatePresence>
    </main>
  )
}
