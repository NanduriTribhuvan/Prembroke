import clsx from 'clsx'
import { Bitcoin, DollarSign } from 'lucide-react'
import { useMarket } from '@/stores/market'
import type { MarketMode } from '@/stores/market'

const OPTIONS: { mode: MarketMode; label: string; icon: typeof Bitcoin }[] = [
  { mode: 'crypto', label: 'Crypto', icon: Bitcoin },
  { mode: 'forex', label: 'Forex', icon: DollarSign }
]

/**
 * Compact, always-available market switch. Floats bottom-left above the status
 * bar so users can flip Crypto/Forex without re-opening the gate.
 */
export default function MarketSwitch(): React.JSX.Element {
  const market = useMarket((s) => s.market)
  const setMarket = useMarket((s) => s.setMarket)

  return (
    <div className="pointer-events-auto fixed bottom-9 left-2 z-40 flex items-center rounded-full border border-edge bg-panel/95 p-0.5 shadow-lg backdrop-blur">
      {OPTIONS.map((o) => {
        const Icon = o.icon
        const active = market === o.mode
        return (
          <button
            key={o.mode}
            type="button"
            onClick={() => setMarket(o.mode)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              active ? 'bg-gold/20 text-accent' : 'text-muted hover:text-text'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
