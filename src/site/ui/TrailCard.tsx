import { sitePath } from '../core/routes'
import type { DifficultyBoard } from '../core/difficulty'
import { trailMeta } from '../core/trails'
import type { TrailSummary } from '../core/trails'
import { DifficultyScore } from './DifficultyScore'
import { Link } from './Link'

/** Thẻ cung ở lưới trang chủ: ảnh, tên, vùng, số đo. Cả thẻ là một link. */
export function TrailCard({ t, board }: { t: TrailSummary; board: DifficultyBoard | null }) {
  return (
    <Link to={sitePath({ page: 'trail', trailId: t.id, routeId: null })} className="st-card">
      <span className="st-card-img">
        {t.imageUrl ? <img src={t.imageUrl} alt="" loading="lazy" decoding="async" /> : <span className="st-card-noimg" aria-hidden="true" />}
      </span>
      <span className="st-card-name">{t.name}</span>
      {t.region && <span className="st-card-region">{t.region}</span>}
      <MetaLine t={t} board={board} className="st-card-meta" />
    </Link>
  )
}

/** Điểm độ khó (có màu) rồi tới số đo — cùng một dòng ở mọi nơi bày một cung. */
export function MetaLine({ t, board, className }: { t: TrailSummary; board: DifficultyBoard | null; className?: string }) {
  const rest = trailMeta(t)
  return (
    <span className={className}>
      <DifficultyScore t={t} board={board} />
      {rest && <> · {rest}</>}
    </span>
  )
}
