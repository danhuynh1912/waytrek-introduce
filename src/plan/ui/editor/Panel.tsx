import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { distance, duration, meters } from '@/shared/format'
import type { PlanDoc, PlanResult } from '../../core/types'
import type { SaveState } from './use-plan-editor'
import { ClockInput } from './ClockInput'

export type PanelTab = 'route' | 'path' | 'prep'

interface Props {
  doc: PlanDoc
  result: PlanResult | null
  computing: boolean
  computeError: string | null
  save: SaveState
  tab: PanelTab
  prepCount: { done: number; total: number }
  onTab(t: PanelTab): void
  onTitle(v: string): void
  onDate(v: string): void
  onDepart(min: number): void
  onRetryCompute(): void
  onRetrySave(): void
  onConflict(pick: 'mine' | 'theirs'): void
  onSaveAsNew(): void
  onLogin(): void
  children: ReactNode
}

export function Panel(p: Props) {
  const [open, setOpen] = useState(false)
  return (
    <aside className={`pl-panel${open ? ' is-open' : ''}`} aria-label="Kế hoạch">
      <button type="button" className="pl-sheet-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span />
        <SheetSummary result={p.result} count={p.doc.waypoints.length} />
      </button>
      <div className={`pl-busy${p.computing ? ' is-on' : ''}`} aria-hidden="true" />
      <div className="pl-panel-head">
        <TitleField value={p.doc.title} onCommit={p.onTitle} />
        <div className="pl-when">
          <label>
            <span>Ngày bắt đầu leo</span>
            <input type="date" value={p.doc.startDate} min="2020-01-01" max="2100-12-31" onChange={(e) => e.target.value && p.onDate(e.target.value)} />
          </label>
          <TimeField value={p.doc.departMin} onCommit={p.onDepart} />
        </div>
      </div>
      <StatusLines {...p} />
      <div className="pl-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={p.tab === 'path'} className={p.tab === 'path' ? 'is-on' : ''} onClick={() => p.onTab('path')}>
          Waypoints
        </button>
        <button type="button" role="tab" aria-selected={p.tab === 'route'} className={p.tab === 'route' ? 'is-on' : ''} onClick={() => p.onTab('route')}>
          Lộ trình
        </button>
        <button type="button" role="tab" aria-selected={p.tab === 'prep'} className={p.tab === 'prep' ? 'is-on' : ''} onClick={() => p.onTab('prep')}>
          Chuẩn bị <span className="pl-muted">{p.prepCount.done}/{p.prepCount.total}</span>
        </button>
      </div>
      <div className="pl-panel-body">{p.children}</div>
    </aside>
  )
}

function SheetSummary({ result, count }: { result: PlanResult | null; count: number }) {
  if (!result || count < 2) return <b>{count === 0 ? 'Bấm lên bản đồ để thêm điểm' : `${count} điểm`}</b>
  const t = result.totals
  return (
    <b>
      {distance(t.distanceM)} · {duration(t.elapsedMin)} · ↑ {meters(t.ascentM)} · {t.dayCount} ngày
    </b>
  )
}

function TitleField({ value, onCommit }: { value: string; onCommit(v: string): void }) {
  const [text, setText] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])
  const commit = () => {
    if (text.trim() && text.trim() !== value) onCommit(text)
    else setText(value)
  }
  return (
    <input
      className="pl-title"
      aria-label="Tên kế hoạch"
      maxLength={120}
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false
        commit()
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function TimeField({ value, onCommit }: { value: number; onCommit(min: number): void }) {
  return (
    <label>
      <span>Giờ xuất phát mỗi ngày</span>
      <ClockInput value={value} onCommit={onCommit} />
    </label>
  )
}

function StatusLines(p: Props) {
  const lines: ReactNode[] = []
  if (p.computeError) {
    lines.push(
      <p key="c" className="pl-status is-warn">
        Không tính lại được — {p.computeError}{' '}
        <button type="button" className="pl-text-btn" onClick={p.onRetryCompute}>Thử lại</button>
      </p>,
    )
  }
  const s = p.save
  if (s.kind === 'error') {
    lines.push(
      <p key="s" className="pl-status is-warn">
        Chưa lưu được — {s.message} {s.willRetry ? 'Sẽ tự thử lại. ' : ''}
        <button type="button" className="pl-text-btn" onClick={p.onRetrySave}>Thử lại ngay</button>
      </p>,
    )
  } else if (s.kind === 'conflict') {
    lines.push(
      <div key="s" className="pl-status is-danger">
        <p>Kế hoạch đã đổi trên thiết bị khác.</p>
        <div className="pl-status-actions">
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={() => p.onConflict('theirs')}>Dùng bản kia</button>
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={() => p.onConflict('mine')}>Giữ bản này</button>
        </div>
      </div>,
    )
  } else if (s.kind === 'deleted') {
    lines.push(
      <div key="s" className="pl-status is-danger">
        <p>Kế hoạch này đã bị xoá ở nơi khác.</p>
        <div className="pl-status-actions">
          <button type="button" className="pl-btn pl-btn-quiet sm" onClick={p.onSaveAsNew}>Lưu thành kế hoạch mới</button>
        </div>
      </div>,
    )
  } else if (s.kind === 'auth') {
    lines.push(
      <p key="s" className="pl-status is-warn">
        Phiên đăng nhập đã hết — thay đổi chưa được lưu.{' '}
        <button type="button" className="pl-text-btn" onClick={p.onLogin}>Đăng nhập lại</button>
      </p>,
    )
  }
  return lines.length ? <div className="pl-status-wrap">{lines}</div> : null
}
