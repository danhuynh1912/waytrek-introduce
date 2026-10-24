import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MAX_ITEMS, progress } from '../../core/checklist'
import type { ChecklistItem } from '../../core/checklist'
import { IClose, IPlus } from '../icons'

interface Props {
  items: ChecklistItem[]
  error: string | null
  onDone(itemId: string, kind: ChecklistItem['kind'], done: boolean): void
  onRename(itemId: string, kind: ChecklistItem['kind'], label: string): void
  onRemove(itemId: string, kind: ChecklistItem['kind']): void
  onAdd(label: string): boolean
}

const EASE = [0.65, 0, 0.35, 1] as const

export function Checklist({ items, error, onDone, onRename, onRemove, onAdd }: Props) {
  const [text, setText] = useState('')
  const [full, setFull] = useState(false)
  const { done, total } = progress(items)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (onAdd(text)) {
      setText('')
      setFull(false)
    } else setFull(true)
  }

  return (
    <div className="pl-prep">
      <p className="pl-prep-count">
        <b>{done}/{total}</b> đã chuẩn bị
      </p>
      <ul className="pl-prep-list">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.itemId}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <Item item={it} onDone={onDone} onRename={onRename} onRemove={onRemove} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form className="pl-prep-add" onSubmit={add}>
        <input
          value={text}
          maxLength={120}
          placeholder="Thêm một mục…"
          aria-label="Thêm mục chuẩn bị"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="pl-icon-btn" aria-label="Thêm" disabled={!text.trim()}>
          <IPlus size={17} />
        </button>
      </form>
      {full && <p className="pl-note pl-note-warn">Mỗi kế hoạch tối đa {MAX_ITEMS} mục.</p>}
      {error && <p className="pl-note pl-note-warn">{error}</p>}
    </div>
  )
}

function Item({
  item, onDone, onRename, onRemove,
}: {
  item: ChecklistItem
  onDone: Props['onDone']
  onRename: Props['onRename']
  onRemove: Props['onRemove']
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.label)
  const finish = (save: boolean) => {
    setEditing(false)
    if (save && text.trim() && text.trim() !== item.label) onRename(item.itemId, item.kind, text)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') finish(true)
    if (e.key === 'Escape') finish(false)
  }
  return (
    <div className={`pl-prep-item${item.done ? ' is-done' : ''}`}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={(e) => onDone(item.itemId, item.kind, e.target.checked)}
        aria-label={item.label}
      />
      {editing ? (
        <input
          className="pl-name-input"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          maxLength={120}
          value={text}
          aria-label="Tên mục"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={onKey}
        />
      ) : (
        <button type="button" className="pl-prep-label" onClick={() => { setText(item.label); setEditing(true) }} title="Bấm để sửa">
          {item.label}
        </button>
      )}
      <button type="button" className="pl-icon-btn sm" onClick={() => onRemove(item.itemId, item.kind)} aria-label={`Xoá mục ${item.label}`}>
        <IClose size={15} />
      </button>
    </div>
  )
}
