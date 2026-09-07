import type { Screen } from '@/data/screens'

export function Rail({ screens, active, onGo }: { screens: Screen[]; active: number; onGo: (i: number) => void }) {
  return (
    <nav className="rail" aria-label="Các màn của app">
      {screens.map((s, i) => (
        <button key={s.id} aria-current={i === active} onClick={() => onGo(i)}>
          <span>{s.rail}</span><i aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}
