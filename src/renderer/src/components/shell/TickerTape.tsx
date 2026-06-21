import clsx from 'clsx'
import { useTickers } from '@/ws/binance'
import LeafLogo from './LeafLogo'

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (price >= 1) return price.toFixed(2)
  return price.toFixed(4)
}

export default function TickerTape(): React.JSX.Element {
  const ticks = useTickers()

  return (
    <header className="flex h-9 shrink-0 items-center overflow-x-auto border-b border-edge bg-panel [scrollbar-width:none]">
      <div className="flex items-center gap-1.5 px-3">
        <LeafLogo size={18} />
        <span className="brandmark text-[13px]">PREMBROKE</span>
      </div>
      {ticks.length === 0 && (
        <span className="border-l border-border-subtle px-3 text-xs text-muted">connecting to market data…</span>
      )}
      {ticks.map((tick) => (
        <div
          key={tick.symbol}
          className="flex items-center gap-2 whitespace-nowrap border-l border-border-subtle px-3"
        >
          <span className="text-xs text-muted">{tick.label}</span>
          <span
            className={clsx(
              'num text-xs',
              tick.dir > 0 ? 'text-up' : tick.dir < 0 ? 'text-down' : 'text-text'
            )}
          >
            {formatPrice(tick.price)}
          </span>
          <span className={clsx('num text-[11px]', tick.changePct >= 0 ? 'text-up' : 'text-down')}>
            {tick.changePct >= 0 ? '+' : ''}
            {tick.changePct.toFixed(2)}%
          </span>
        </div>
      ))}
    </header>
  )
}
