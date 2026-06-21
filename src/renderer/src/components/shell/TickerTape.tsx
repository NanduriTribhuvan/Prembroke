import clsx from 'clsx'
import { useTickers } from '@/ws/binance'
import { Skeleton } from '@/components/ui'
import LeafLogo from './LeafLogo'

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

export default function TickerTape(): React.JSX.Element {
  const ticks = useTickers()

  return (
    <header
      className="flex shrink-0 items-center overflow-x-auto border-b border-edge bg-panel [scrollbar-width:none]"
      style={{ height: 'var(--tape-h)' }}
    >
      <div className="flex shrink-0 items-center border-r border-edge px-3">
        <LeafLogo size={16} />
      </div>

      {ticks.length === 0 && (
        <div className="flex items-center gap-2 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="72px" height="18px" rounded />
          ))}
        </div>
      )}

      {ticks.map((tick) => (
        <div
          key={tick.symbol}
          className="t-colors flex items-center gap-2 whitespace-nowrap border-l border-border-subtle px-3"
        >
          <span className="text-[length:var(--text-caption)] text-text-tertiary">{tick.label}</span>
          <span
            className={clsx(
              'num text-[length:var(--text-caption)]',
              tick.dir > 0 ? 'text-up' : tick.dir < 0 ? 'text-down' : 'text-text'
            )}
          >
            {formatPrice(tick.price)}
          </span>
          <span
            className={clsx(
              'num text-[length:var(--text-caption)]',
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
