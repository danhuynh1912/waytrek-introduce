import type { DifficultyBoard } from '../core/difficulty'
import { trailMeta } from '../core/trails'
import type { TrailSummary } from '../core/trails'
import { useI18n } from '../../i18n/context'
import { DifficultyScore } from './DifficultyScore'

/** Điểm độ khó (có màu) rồi tới số đo — cùng một dòng ở mọi nơi bày một cung. */
export function MetaLine({ t, board, className }: { t: TrailSummary; board: DifficultyBoard | null; className?: string }) {
  const { fmt } = useI18n()
  const rest = trailMeta(t, fmt)
  return (
    <span className={className}>
      <DifficultyScore t={t} board={board} />
      {rest && <> · {rest}</>}
    </span>
  )
}
