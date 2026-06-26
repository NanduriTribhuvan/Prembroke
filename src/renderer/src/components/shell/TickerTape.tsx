import clsx from 'clsx'
import { useTickers } from '@/ws/binance'
import { Skeleton } from '@/components/ui'

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

export default function TickerTape(): React.JSX.Element {
  const ticks = useTickers()

  return (
    <header
      className="glass fade-right relative z-20 flex shrink-0 items-center overflow-x-auto border-b border-edge [scrollbar-width:none]"
      style={{ height: 'var(--tape-h)' }}
    >
      <div className="sticky left-0 z-10 flex h-full shrink-0 items-center gap-2 border-r border-edge bg-panel2 px-3">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />
          <span className="num text-[9px] font-bold uppercase tracking-[0.18em] text-up">Live</span>
        </span>
      </div>

      {ticks.length === 0 && (
        <div className="flex items-center gap-2 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="72px" height="16px" rounded />
          ))}
        </div>
      )}

      {ticks.map((tick) => (
        <div
          key={tick.symbol}
          className="t-colors group flex h-full items-center gap-2 whitespace-nowrap border-r border-edge px-3.5 hover:bg-panel2"
        >
          <span className="text-[length:var(--text-micro)] font-medium uppercase tracking-[0.04em] text-text-tertiary">
            {tick.label}
          </span>
          <span
            className={clsx(
              'num text-[length:var(--text-caption)] font-semibold',
              tick.dir > 0 ? 'text-up' : tick.dir < 0 ? 'text-down' : 'text-text'
            )}
          >
            {formatPrice(tick.price)}
          </span>
          <span
            className={clsx(
              'num text-[length:var(--text-micro)] tabular-nums',
              tick.changePct >= 0 ? 'text-up' : 'text-down'
            )}
          >
            {tick.changePct >= 0 ? '+' : ''}
            {tick.changePct.toFixed(2)}%
          </span>
        </div>
      ))}
    </header>
  )
}
