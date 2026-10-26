// Trạng thái của màn soạn một kế hoạch: lịch sử sửa, kết quả tính gần nhất,
// hàng gửi lưu, danh sách chuẩn bị, bản nháp trên máy. Luật nằm ở core/; hook
// này chỉ nối chúng với React và với lớp data/.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { customItemId, editItem, MAX_ITEMS, mergeRows, viewChecklist } from '../../core/checklist'
import type { ChecklistItem, ChecklistRow } from '../../core/checklist'
import { dropLateDepartures, isTailTrim, newDoc, sameDoc } from '../../core/doc'
import type { EditResult } from '../../core/doc'
import { todayVn } from '@/shared/format'
import { commit, initHistory, redo, replacePresent, undo } from '../../core/history'
import type { History } from '../../core/history'
import { SaveQueue } from '../../core/save-queue'
import type { SaveEvent } from '../../core/save-queue'
import type { PlanDoc, PlanResult, SuggestOutcome } from '../../core/types'
import { ApiError, computePlan, loadChecklist, loadPlan, saveChecklistItem, savePlan, suggestPlan } from '../../data/api'
import type { Draft } from '../../data/drafts'
import { dropDraft, newDraftId, pendingSaveId, readDraft, setNewDraftId, setPendingSave, writeDraft } from '../../data/drafts'

/** Dừng tay bao lâu thì tính lại (spec/43 §3.3). */
const SETTLE_MS = 600
/** Lỗi lưu thì tự thử lại vài lần, giãn dần, rồi để người dùng bấm. */
const RETRY_DELAYS_MS = [5_000, 20_000, 60_000]

export type SaveState =
  | { kind: 'draft' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string; willRetry: boolean }
  | { kind: 'conflict'; version: number; doc: PlanDoc; result: PlanResult | null }
  | { kind: 'deleted' }
  | { kind: 'auth' }

export type SuggestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; outcome: SuggestOutcome }
  | { kind: 'error'; message: string }

export type LoadState =
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'needAuth' }
  | { kind: 'notFound' }
  | { kind: 'failed'; message: string }

interface Core {
  history: History<PlanDoc>
  rev: number
  result: PlanResult | null
  /** Bản doc đã sinh ra `result` — để biết đoạn nào của kết quả còn dùng được. */
  resultDoc: PlanDoc | null
  resultRev: number
}

function defaultStartDate(): string {
  const d = new Date(Date.parse(`${todayVn(new Date())}T00:00:00Z`) + 7 * 86400_000)
  return d.toISOString().slice(0, 10)
}

function randomShort(): string {
  return Math.random().toString(36).slice(2, 8)
}

function friendly(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'PLAN_INVALID') return `Kế hoạch có dữ liệu không hợp lệ (${e.field ?? '?'}).`
    if (e.code === 'PLAN_TOO_BIG') return 'Kế hoạch quá lớn.'
    if (e.code === 'PLAN_LIMIT') return 'Đã tới giới hạn 200 kế hoạch.'
    if (e.code === 'ENGINE_ERROR') return 'Máy chủ tính lỗi. Thử lại sau ít phút.'
    if (e.code === 'READ_FAILED' || e.code === 'WRITE_FAILED') return 'Không kết nối được máy chủ.'
    return e.message
  }
  if (e instanceof DOMException && e.name === 'TimeoutError') return 'Máy chủ không trả lời kịp.'
  if (e instanceof TypeError) return 'Không kết nối được máy chủ.'
  const msg = e instanceof Error ? e.message : String(e)
  return /fetch|network/i.test(msg) ? 'Không kết nối được máy chủ.' : msg
}

export interface PlanEditor {
  planId: string
  load: LoadState
  /** Kế hoạch đúng lúc vừa mở xong (để bản đồ ôm trọn nó một lần). null: chưa mở xong. */
  opened: PlanDoc | null
  doc: PlanDoc
  result: PlanResult | null
  resultDoc: PlanDoc | null
  /** Kết quả đang hiện là của đúng bản doc hiện tại. */
  fresh: boolean
  /**
   * Các dòng của panel vẫn đúng: kết quả của đúng bản này, hoặc bản này chỉ bớt
   * điểm ở cuối so với bản đã tính (isTailTrim) — bỏ điểm cuối không làm panel
   * mờ đi chờ tính lại; số tổng vẫn chờ máy chủ.
   */
  rowsFresh: boolean
  computing: boolean
  computeError: string | null
  saved: boolean
  save: SaveState
  canUndo: boolean
  canRedo: boolean
  /** Sửa doc. Trả lý do khi không sửa được ('full' | 'outside' | 'missing'). */
  edit: (fn: (doc: PlanDoc) => PlanDoc | EditResult) => string | null
  undo: () => void
  redo: () => void
  retryCompute: () => void
  /** Lưu lần đầu / thử lại. 'needAuth' khi phải đăng nhập trước. */
  saveNow: () => 'needAuth' | 'ok'
  /** Ghi bản nháp ngay (trước khi rời trang sang Google). */
  persistNow: () => void
  resolveConflict: (pick: 'mine' | 'theirs') => void
  saveAsNew: () => void
  discardNewDraft: () => void
  checklist: ChecklistItem[]
  checklistError: string | null
  setItemDone: (itemId: string, kind: 'builtin' | 'custom', done: boolean) => void
  renameItem: (itemId: string, kind: 'builtin' | 'custom', label: string) => void
  removeItem: (itemId: string, kind: 'builtin' | 'custom') => void
  addItem: (label: string) => boolean
  /** Gợi ý thứ tự leo cho ĐÚNG bản đang soạn — sửa gì là gợi ý cũ ẩn đi. */
  suggestion: SuggestState
  suggest: () => void
  applySuggestion: () => void
  dismissSuggestion: () => void
}

export function usePlanEditor(opts: {
  routeId: string | null
  session: Session | null
  onSaved: (planId: string) => void
}): PlanEditor {
  const { routeId, session } = opts
  const onSavedRef = useRef(opts.onSaved)

  // ─── Khởi tạo ───────────────────────────────────────────────────────────
  const [boot] = useState(() => {
    if (routeId) return { planId: routeId, doc: newDoc(defaultStartDate()), draft: readDraft(routeId) }
    const reuse = newDraftId()
    const old = reuse ? readDraft(reuse) : null
    const draft = old && !old.saved ? old : null
    const planId = draft ? draft.id : crypto.randomUUID()
    return { planId, doc: draft ? draft.doc : newDoc(defaultStartDate()), draft }
  })

  const [planId, setPlanId] = useState(boot.planId)
  const [load, setLoad] = useState<LoadState>(routeId ? { kind: 'loading' } : { kind: 'ready' })
  const [opened, setOpened] = useState<PlanDoc | null>(routeId ? null : boot.doc)
  const [core, setCore] = useState<Core>({
    history: initHistory(boot.doc),
    rev: 0,
    result: null,
    resultDoc: null,
    resultRev: -1,
  })
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [save, setSave] = useState<SaveState>({ kind: 'draft' })
  const [rows, setRows] = useState<Map<string, ChecklistRow>>(
    () => new Map((boot.draft?.checklist ?? []).map((r) => [r.itemId, r])),
  )
  const [rowsDirty, setRowsDirty] = useState<Set<string>>(() => new Set(boot.draft?.checklistDirty ?? []))
  const [checklistError, setChecklistError] = useState<string | null>(null)
  const [sugg, setSugg] = useState<{ forDoc: PlanDoc | null; state: SuggestState }>({
    forDoc: null,
    state: { kind: 'idle' },
  })

  // Bản mới nhất cho các lời gọi bất đồng bộ (closure của React thì cũ).
  const coreRef = useRef(core)
  const sessionRef = useRef(session)
  const savedRef = useRef(saved)
  const saveRef = useRef(save)
  // Ref giữ bản đã COMMIT — gán sau render, không gán trong lúc render.
  useLayoutEffect(() => {
    onSavedRef.current = opts.onSaved
    sessionRef.current = session
    saveRef.current = save
  })
  const planIdRef = useRef(planId)
  const rowsRef = useRef(rows)
  const rowsDirtyRef = useRef(rowsDirty)

  const queueRef = useRef<SaveQueue | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)
  const computeCtl = useRef<AbortController | null>(null)
  const suggestCtl = useRef<AbortController | null>(null)
  const suggRef = useRef(sugg)
  const computeSeq = useRef(0)
  const wantSave = useRef(false)

  const setCoreNow = useCallback((c: Core) => {
    coreRef.current = c
    setCore(c)
  }, [])
  const setSavedNow = useCallback((v: boolean) => {
    savedRef.current = v
    setSaved(v)
  }, [])
  const setRowsNow = useCallback((m: Map<string, ChecklistRow>) => {
    rowsRef.current = m
    setRows(m)
  }, [])
  const setRowsDirtyNow = useCallback((s: Set<string>) => {
    rowsDirtyRef.current = s
    setRowsDirty(s)
  }, [])
  const setSuggNow = useCallback((v: { forDoc: PlanDoc | null; state: SuggestState }) => {
    suggRef.current = v
    setSugg(v)
  }, [])

  // ─── Tính ───────────────────────────────────────────────────────────────

  const applyResult = useCallback((rev: number, doc: PlanDoc, result: PlanResult) => {
    const c = coreRef.current
    if (rev <= c.resultRev) return
    setCoreNow({ ...c, result, resultDoc: doc, resultRev: rev })
  }, [setCoreNow])

  const compute = useCallback(
    async (rev: number, doc: PlanDoc) => {
      computeCtl.current?.abort()
      const ctl = new AbortController()
      computeCtl.current = ctl
      const seq = ++computeSeq.current
      setComputing(true)
      try {
        const result = await computePlan(doc, ctl.signal)
        applyResult(rev, doc, result)
        if (seq === computeSeq.current) setComputeError(null)
      } catch (e) {
        // Bị lượt mới hơn huỷ: không phải lỗi.
        if (ctl.signal.aborted && seq !== computeSeq.current) return
        console.warn('plan: tính lỗi —', e)
        if (seq === computeSeq.current) setComputeError(friendly(e))
      } finally {
        if (seq === computeSeq.current) setComputing(false)
      }
    },
    [applyResult],
  )

  // ─── Danh sách chuẩn bị ─────────────────────────────────────────────────

  const pushItem = useCallback(async (itemId: string) => {
    const row = rowsRef.current.get(itemId)
    if (!row || !savedRef.current || !sessionRef.current) return
    try {
      const won = await saveChecklistItem(planIdRef.current, row)
      const cur = rowsRef.current.get(itemId)
      if (!cur || Date.parse(cur.updatedAt) <= Date.parse(won.updatedAt)) {
        setRowsNow(new Map(rowsRef.current).set(itemId, won))
      }
      if (rowsRef.current.get(itemId)?.updatedAt === won.updatedAt || cur?.updatedAt === row.updatedAt) {
        const next = new Set(rowsDirtyRef.current)
        next.delete(itemId)
        setRowsDirtyNow(next)
      }
      setChecklistError(null)
    } catch (e) {
      console.warn('plan: lưu mục chuẩn bị lỗi —', e)
      setChecklistError('Chưa lưu được thay đổi ở danh sách chuẩn bị — sẽ thử lại ở lần lưu kế hoạch sau.')
    }
  }, [setRowsNow, setRowsDirtyNow])

  const flushChecklist = useCallback(async () => {
    for (const id of [...rowsDirtyRef.current]) await pushItem(id)
  }, [pushItem])

  // ─── Lưu ────────────────────────────────────────────────────────────────

  const onSaveEvent = useCallback(
    (e: SaveEvent) => {
      switch (e.type) {
        case 'saving':
          setSave({ kind: 'saving' })
          return
        case 'saved': {
          retryCount.current = 0
          applyResult(e.rev, e.doc, e.result)
          const first = !savedRef.current
          setSavedNow(true)
          setSave(queueRef.current?.dirty ? { kind: 'pending' } : { kind: 'saved' })
          if (first) {
            setNewDraftId(null)
            setPendingSave(null)
            onSavedRef.current(planIdRef.current)
          }
          void flushChecklist()
          return
        }
        case 'conflict':
          setSave({ kind: 'conflict', version: e.version, doc: e.doc, result: e.result })
          return
        case 'deleted':
          setSave({ kind: 'deleted' })
          return
        case 'auth':
          setSave({ kind: 'auth' })
          return
        case 'failed': {
          const delay = RETRY_DELAYS_MS[retryCount.current]
          setSave({ kind: 'error', message: friendly(new Error(e.message)), willRetry: delay != null })
          if (retryTimer.current) clearTimeout(retryTimer.current)
          if (delay != null) {
            retryCount.current += 1
            retryTimer.current = setTimeout(() => queueRef.current?.retry(), delay)
          }
          return
        }
      }
    },
    [applyResult, flushChecklist, setSavedNow],
  )

  const ensureQueue = useCallback(
    (version: number) => {
      if (!queueRef.current) {
        queueRef.current = new SaveQueue((doc, base) => savePlan(planIdRef.current, doc, base), onSaveEvent, version)
      }
      return queueRef.current
    },
    [onSaveEvent],
  )

  const run = useCallback(() => {
    const { history, rev } = coreRef.current
    const doc = history.present
    if (savedRef.current) {
      const q = queueRef.current
      if (sessionRef.current && q) {
        q.submit(rev, doc)
        return
      }
      setSave({ kind: 'auth' })
    }
    void compute(rev, doc)
  }, [compute])

  const schedule = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (savedRef.current) setSave((s) => (s.kind === 'saved' || s.kind === 'saving' ? { kind: 'pending' } : s))
    settleTimer.current = setTimeout(run, SETTLE_MS)
  }, [run])

  // Giờ xuất phát đặt sẵn mà nay tới nơi đã muộn hơn (điểm trước dời muộn): bỏ
  // giờ đó, giờ đi ở đó thành dự tính (`dropLateDepartures`). Sửa thẳng vào bước
  // lịch sử hiện tại — hoàn tác lần sửa gây ra nó thì giờ đặt sẵn về cùng.
  useEffect(() => {
    const c = coreRef.current
    if (!c.result || c.resultRev !== c.rev || c.resultDoc !== c.history.present) return
    const cleaned = dropLateDepartures(c.history.present, c.result)
    if (cleaned === c.history.present) return
    setCoreNow({ ...c, history: replacePresent(c.history, cleaned), rev: c.rev + 1 })
    schedule()
  }, [core.result, core.resultRev, schedule, setCoreNow])

  // ─── Nạp kế hoạch đã lưu ────────────────────────────────────────────────
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!routeId) return
    if (!userId) {
      setLoad({ kind: 'needAuth' })
      return
    }
    let alive = true
    setLoad({ kind: 'loading' })
    Promise.all([loadPlan(routeId), loadChecklist(routeId)])
      .then(([plan, serverRows]) => {
        if (!alive) return
        if (!plan) {
          setLoad({ kind: 'notFound' })
          return
        }
        // Bản trên máy còn thay đổi chưa gửi (đóng tab lúc mất mạng…)?
        const d: Draft | null = boot.draft
        const mine = d && d.saved && d.dirty && !sameDoc(d.doc, plan.doc) ? d : null
        const doc = mine ? mine.doc : plan.doc
        setCoreNow({
          history: initHistory(doc),
          rev: 0,
          result: plan.result,
          resultDoc: plan.result ? plan.doc : null,
          resultRev: plan.result && !mine ? 0 : -1,
        })
        setSavedNow(true)
        const q = ensureQueue(plan.version)
        if (mine && mine.baseVersion < plan.version) {
          // Nơi khác đã lưu bản mới hơn bản mà các thay đổi này dựa vào: hỏi.
          setSave({ kind: 'conflict', version: plan.version, doc: plan.doc, result: plan.result })
        } else if (mine) {
          q.submit(0, doc)
        } else {
          setSave({ kind: 'saved' })
        }
        const merged = mergeRows(rowsRef.current, serverRows)
        const serverAt = new Map(serverRows.map((r) => [r.itemId, Date.parse(r.updatedAt)]))
        const dirty = new Set(
          [...merged.values()]
            .filter((r) => (serverAt.get(r.itemId) ?? -Infinity) < Date.parse(r.updatedAt))
            .map((r) => r.itemId),
        )
        setRowsNow(merged)
        setRowsDirtyNow(dirty)
        setOpened(doc)
        setLoad({ kind: 'ready' })
        if (dirty.size) void flushChecklist()
        if (!plan.result || mine) void compute(0, doc)
      })
      .catch((e) => {
        if (!alive) return
        console.warn('plan: nạp kế hoạch lỗi —', e)
        setLoad({ kind: 'failed', message: friendly(e) })
      })
    return () => {
      alive = false
    }
    // Chỉ nạp lại khi đổi kế hoạch hoặc đổi người — không theo từng lần làm mới token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, userId])

  // Kế hoạch mới chưa lưu: nhớ id để mở lại /plan/new là soạn tiếp đúng nó. Ghi ở
  // effect chứ không ở hàm khởi tạo — StrictMode gọi hàm đó hai lần và bỏ một kết quả.
  useEffect(() => {
    if (!routeId && !savedRef.current) setNewDraftId(planId)
  }, [routeId, planId])

  // Mạng có lại: gửi tiếp phần đang dở, không bắt người dùng bấm.
  useEffect(() => {
    const onOnline = () => {
      if (saveRef.current.kind === 'error') {
        retryCount.current = 0
        queueRef.current?.retry()
      } else if (!savedRef.current) run()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [run])

  // Kế hoạch mới: tính ngay (cả khi chưa có điểm — để có danh sách chuẩn bị).
  useEffect(() => {
    if (!routeId) void compute(0, boot.doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quay về từ trang Google với ý định lưu dở, hoặc vừa đăng nhập bằng email.
  useEffect(() => {
    if (!userId || savedRef.current) return
    if (wantSave.current || pendingSaveId() === planIdRef.current) {
      wantSave.current = false
      setPendingSave(null)
      const { history, rev } = coreRef.current
      ensureQueue(0).submit(rev, history.present)
    }
  }, [userId, ensureQueue])

  // Đăng nhập lại sau khi phiên hết hạn giữa chừng.
  useEffect(() => {
    if (!userId || saveRef.current.kind !== 'auth' || !savedRef.current) return
    const q = queueRef.current
    if (!q) return
    setSave({ kind: 'pending' })
    q.retry()
    q.submit(coreRef.current.rev, coreRef.current.history.present)
  }, [userId])

  // Bản nháp trên máy.
  const draftOf = useCallback(
    (): Draft => ({
      id: planIdRef.current,
      doc: coreRef.current.history.present,
      saved: savedRef.current,
      baseVersion: queueRef.current?.version ?? 0,
      dirty: !savedRef.current || saveRef.current.kind !== 'saved',
      checklist: [...rowsRef.current.values()],
      checklistDirty: [...rowsDirtyRef.current],
      at: Date.now(),
    }),
    [],
  )
  useEffect(() => {
    if (load.kind !== 'ready') return
    const t = setTimeout(() => writeDraft(draftOf()), 300)
    return () => clearTimeout(t)
  }, [load.kind, planId, core.history.present, saved, save.kind, rows, rowsDirty, draftOf])

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
      if (retryTimer.current) clearTimeout(retryTimer.current)
      computeCtl.current?.abort()
      suggestCtl.current?.abort()
    },
    [],
  )

  // ─── Thao tác ───────────────────────────────────────────────────────────

  const edit = useCallback(
    (fn: (doc: PlanDoc) => PlanDoc | EditResult): string | null => {
      const c = coreRef.current
      const out = fn(c.history.present)
      let next: PlanDoc
      if ('ok' in out) {
        if (!out.ok) return out.reason
        next = out.doc
      } else next = out
      if (next === c.history.present) return null
      setCoreNow({ ...c, history: commit(c.history, next), rev: c.rev + 1 })
      schedule()
      return null
    },
    [schedule, setCoreNow],
  )

  const step = useCallback(
    (dir: 'undo' | 'redo') => {
      const c = coreRef.current
      const h = dir === 'undo' ? undo(c.history) : redo(c.history)
      if (h === c.history) return
      setCoreNow({ ...c, history: h, rev: c.rev + 1 })
      schedule()
    },
    [schedule, setCoreNow],
  )

  const saveNow = useCallback((): 'needAuth' | 'ok' => {
    if (!sessionRef.current) {
      wantSave.current = true
      setPendingSave(planIdRef.current)
      writeDraft(draftOf())
      return 'needAuth'
    }
    retryCount.current = 0
    const q = ensureQueue(0)
    q.retry()
    q.submit(coreRef.current.rev, coreRef.current.history.present)
    return 'ok'
  }, [ensureQueue, draftOf])

  const resolveConflict = useCallback(
    (pick: 'mine' | 'theirs') => {
      const s = saveRef.current
      const q = queueRef.current
      if (s.kind !== 'conflict' || !q) return
      const c = coreRef.current
      if (pick === 'mine') {
        setSave({ kind: 'pending' })
        q.keepMine(s.version)
        q.submit(c.rev, c.history.present)
        return
      }
      const rev = c.rev + 1
      setCoreNow({
        history: commit(c.history, s.doc),
        rev,
        result: s.result,
        resultDoc: s.result ? s.doc : null,
        resultRev: s.result ? rev : c.resultRev,
      })
      q.takeServer(s.version, rev)
      setSave({ kind: 'saved' })
      if (!s.result) void compute(rev, s.doc)
    },
    [compute, setCoreNow],
  )

  const saveAsNew = useCallback(() => {
    dropDraft(planIdRef.current)
    const id = crypto.randomUUID()
    queueRef.current = null
    planIdRef.current = id
    setPlanId(id)
    setSavedNow(false)
    setSave({ kind: 'draft' })
    saveNow()
  }, [saveNow, setSavedNow])

  const discardNewDraft = useCallback(() => {
    if (savedRef.current) return
    dropDraft(planIdRef.current)
    const doc = newDoc(defaultStartDate())
    setCoreNow({ history: initHistory(doc), rev: coreRef.current.rev + 1, result: null, resultDoc: null, resultRev: -1 })
    setRowsNow(new Map())
    setRowsDirtyNow(new Set())
    setComputeError(null)
    void compute(coreRef.current.rev, doc)
  }, [compute, setCoreNow, setRowsNow, setRowsDirtyNow])

  const changeItem = useCallback(
    (itemId: string, kind: 'builtin' | 'custom', patch: { label?: string; done?: boolean; removed?: boolean }) => {
      const row = editItem(rowsRef.current, itemId, kind, patch, new Date().toISOString())
      setRowsNow(new Map(rowsRef.current).set(itemId, row))
      setRowsDirtyNow(new Set(rowsDirtyRef.current).add(itemId))
      void pushItem(itemId)
    },
    [pushItem, setRowsNow, setRowsDirtyNow],
  )

  const addItem = useCallback(
    (label: string): boolean => {
      const text = label.trim()
      if (!text || rowsRef.current.size >= MAX_ITEMS) return false
      changeItem(customItemId(Date.now(), randomShort), 'custom', { label: text })
      return true
    },
    [changeItem],
  )

  const checklist = useMemo(() => viewChecklist(core.result?.checklist ?? [], rows), [core.result?.checklist, rows])
  const present = core.history.present
  const fresh = core.result != null && core.resultRev === core.rev
  const trimmed = useMemo(
    () => core.result != null && core.resultDoc != null && isTailTrim(core.resultDoc, present),
    [core.result, core.resultDoc, present],
  )

  // ─── Gợi ý thứ tự leo ───────────────────────────────────────────────────

  const suggest = useCallback(async () => {
    suggestCtl.current?.abort()
    const ctl = new AbortController()
    suggestCtl.current = ctl
    const doc = coreRef.current.history.present
    setSuggNow({ forDoc: doc, state: { kind: 'loading' } })
    try {
      const outcome = await suggestPlan(doc, ctl.signal)
      if (!ctl.signal.aborted) setSuggNow({ forDoc: doc, state: { kind: 'ready', outcome } })
    } catch (e) {
      if (ctl.signal.aborted) return
      console.warn('plan: gợi ý thứ tự lỗi —', e)
      setSuggNow({ forDoc: doc, state: { kind: 'error', message: friendly(e) } })
    }
  }, [setSuggNow])

  const dismissSuggestion = useCallback(() => {
    suggestCtl.current?.abort()
    setSuggNow({ forDoc: null, state: { kind: 'idle' } })
  }, [setSuggNow])

  // Áp dụng = một bước sửa (hoàn tác được). Kết quả đi kèm gợi ý là của đúng
  // doc gợi ý, nên hiện ngay — không bắt chờ một lượt tính nữa.
  const applySuggestion = useCallback(() => {
    const s = suggRef.current
    const c = coreRef.current
    if (s.forDoc !== c.history.present || s.state.kind !== 'ready' || s.state.outcome.kind !== 'ok') return
    const { doc, result } = s.state.outcome
    const rev = c.rev + 1
    setCoreNow({ history: commit(c.history, doc), rev, result, resultDoc: doc, resultRev: rev })
    setSuggNow({ forDoc: null, state: { kind: 'idle' } })
    schedule()
  }, [schedule, setCoreNow, setSuggNow])

  const suggestion: SuggestState = sugg.forDoc === core.history.present ? sugg.state : { kind: 'idle' }

  return {
    planId,
    load,
    opened,
    doc: present,
    result: core.result,
    resultDoc: core.resultDoc,
    fresh,
    // Lượt tính lại sau khi bỏ điểm cuối hỏng: thôi coi panel là mới — nó sẽ đứng đó mãi.
    rowsFresh: fresh || (trimmed && computeError == null),
    computing,
    computeError,
    saved,
    save,
    canUndo: core.history.past.length > 0,
    canRedo: core.history.future.length > 0,
    edit,
    undo: () => step('undo'),
    redo: () => step('redo'),
    retryCompute: run,
    saveNow,
    persistNow: () => writeDraft(draftOf()),
    resolveConflict,
    saveAsNew,
    discardNewDraft,
    checklist,
    checklistError,
    setItemDone: (id, kind, done) => changeItem(id, kind, { done }),
    renameItem: (id, kind, label) => changeItem(id, kind, { label }),
    removeItem: (id, kind) => changeItem(id, kind, { removed: true }),
    addItem,
    suggestion,
    suggest: () => void suggest(),
    applySuggestion,
    dismissSuggestion,
  }
}
