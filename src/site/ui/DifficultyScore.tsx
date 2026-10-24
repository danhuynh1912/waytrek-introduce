import type { CSSProperties } from 'react'
import { difficultyRankColor, formatDifficultyScore } from '../core/difficulty'
import type { DifficultyBoard } from '../core/difficulty'
import { difficultyLabel } from '../core/trails'
import type { TrailSummary } from '../core/trails'

/**
 * Điểm độ khó của một cung, mang màu của cung trên dải độ khó (như chip ở thẻ
 * cung của app). Cả hai màu sáng/tối đi qua biến CSS, CSS chọn theo theme.
 * Bảng chưa có điểm của cung → nhãn chữ, mờ hơn (đường lui giống app).
 */
export function DifficultyScore({ t, board, className }: { t: TrailSummary; board: DifficultyBoard | null; className?: string }) {
  const s = board?.byTrail.get(t.id)
  if (!s || !board) return <span className={`st-score is-label${className ? ` ${className}` : ''}`}>{difficultyLabel(t)}</span>
  const style = {
    '--dc-l': difficultyRankColor(s.rank, board.count, false),
    '--dc-d': difficultyRankColor(s.rank, board.count, true),
  } as CSSProperties
  return (
    <span className={`st-score${className ? ` ${className}` : ''}`} style={style} title={`Điểm độ khó, hạng ${s.rank}/${board.count}`}>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" /></svg>
      {formatDifficultyScore(s.score)}
    </span>
  )
}
