/**
 * IndicatorPanel — compact dropdown panel for managing indicators and SMC overlays.
 *
 * Two sections:
 * 1. **Indicators** — select a built-in indicator (SMA, EMA, RSI, etc.), set period,
 *    add it, and see active indicators with remove buttons. Also shows custom indicators
 *    from the persisted store.
 * 2. **SMC Overlays** — toggle checkboxes for each of the 9 overlay IDs.
 *
 * Style: institutional aesthetic — border-edge, bg-panel, text-muted, small toggles.
 *
 * @module charts/IndicatorPanel
 */

import { useState } from 'react'
import { X, Plus, Layers } from 'lucide-react'
import type { BuiltinIndicatorSpec } from '@shared/chart/indicator-series'
import { builtinRenderTarget } from '@shared/chart/indicator-series'
import { ALL_OVERLAY_IDS, type SmcOverlayId, type SmcOverlayState } from '@shared/smc'
import { useIndicators } from '@/stores/indicators'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndicatorPanelProps {
  indicators: BuiltinIndicatorSpec[]
  onAdd: (spec: BuiltinIndicatorSpec) => void
  onRemove: (index: number) => void
  smcState: SmcOverlayState
  onToggle: (id: SmcOverlayId) => void
  open: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUILTIN_IDS = [
  'sma',
  'ema',
  'rsi',
  'macd',
  'bollinger',
  'atr',
  'vwap',
  'obv'
] as const

const BUILTIN_LABELS: Record<string, string> = {
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  macd: 'MACD',
  bollinger: 'Bollinger',
  atr: 'ATR',
  vwap: 'VWAP',
  obv: 'OBV'
}

const OVERLAY_LABELS: Record<SmcOverlayId, string> = {
  structure: 'Structure (BOS/CHoCH)',
  liquidity: 'Liquidity (BSL/SSL)',
  orderblocks: 'Order Blocks',
  breaker: 'Breaker Blocks',
  mitigation: 'Mitigation Blocks',
  fvg: 'Fair Value Gaps',
  premiumdiscount: 'Premium/Discount',
  killzones: 'Killzones',
  displacement: 'Displacement'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IndicatorPanel({
  indicators,
  onAdd,
  onRemove,
  smcState,
  onToggle,
  open,
  onClose
}: IndicatorPanelProps): React.JSX.Element | null {
  const [selectedId, setSelectedId] = useState<string>('sma')
  const [period, setPeriod] = useState<number>(20)
  const customDefs = useIndicators((s) => s.definitions)
  const removeCustom = useIndicators((s) => s.remove)

  if (!open) return null

  const handleAdd = (): void => {
    const target = builtinRenderTarget(selectedId)
    const params: Record<string, number> = {}
    // For indicators that take a period param
    if (['sma', 'ema', 'rsi', 'atr', 'bollinger'].includes(selectedId)) {
      params.period = period
    }
    onAdd({ kind: 'builtin', id: selectedId, params, target })
  }

  return (
    <div className="absolute right-2 top-10 z-30 w-72 rounded border border-edge bg-panel shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-accent" />
          <span className="text-[length:var(--text-caption)] font-semibold text-text">
            Overlays
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted hover:bg-panel2 hover:text-text t-colors"
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {/* Indicators section */}
        <div className="border-b border-edge px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
            Indicators
          </span>

          {/* Add controls */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="flex-1 rounded border border-edge bg-bg px-1.5 py-1 text-[length:var(--text-caption)] text-text outline-none focus:border-accent/50"
            >
              {BUILTIN_IDS.map((id) => (
                <option key={id} value={id}>
                  {BUILTIN_LABELS[id]}
                </option>
              ))}
            </select>
            {['sma', 'ema', 'rsi', 'atr', 'bollinger'].includes(selectedId) && (
              <input
                type="number"
                min={1}
                max={200}
                value={period}
                onChange={(e) => setPeriod(Math.max(1, Number(e.target.value) || 1))}
                className="num w-14 rounded border border-edge bg-bg px-1.5 py-1 text-[length:var(--text-caption)] text-text outline-none focus:border-accent/50"
              />
            )}
            <button
              type="button"
              onClick={handleAdd}
              className="rounded bg-accent/10 p-1 text-accent hover:bg-accent/20 t-colors"
              aria-label="Add indicator"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Active built-in indicators */}
          {indicators.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {indicators.map((ind, i) => (
                <li
                  key={`${ind.id}-${i}`}
                  className="flex items-center justify-between rounded px-1.5 py-0.5 text-[length:var(--text-caption)] text-muted hover:bg-panel2"
                >
                  <span>
                    {BUILTIN_LABELS[ind.id] ?? ind.id}
                    {ind.params.period != null ? `(${ind.params.period})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="rounded p-0.5 text-muted hover:text-red-400 t-colors"
                    aria-label={`Remove ${ind.id}`}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Custom indicators from store */}
          {customDefs.length > 0 && (
            <div className="mt-2 border-t border-edge pt-1.5">
              <span className="text-[10px] text-muted">Custom</span>
              <ul className="mt-0.5 space-y-0.5">
                {customDefs.map((def, i) => (
                  <li
                    key={`custom-${i}`}
                    className="flex items-center justify-between rounded px-1.5 py-0.5 text-[length:var(--text-caption)] text-muted hover:bg-panel2"
                  >
                    <span>{def.name}</span>
                    <button
                      type="button"
                      onClick={() => removeCustom(i)}
                      className="rounded p-0.5 text-muted hover:text-red-400 t-colors"
                      aria-label={`Remove ${def.name}`}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* SMC Overlays section */}
        <div className="px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
            SMC Overlays
          </span>
          <ul className="mt-1.5 space-y-1">
            {ALL_OVERLAY_IDS.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={smcState[id]}
                    onChange={() => onToggle(id)}
                    className="h-3 w-3 rounded border-edge accent-accent"
                  />
                  <span className="text-[length:var(--text-caption)] text-muted">
                    {OVERLAY_LABELS[id]}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
