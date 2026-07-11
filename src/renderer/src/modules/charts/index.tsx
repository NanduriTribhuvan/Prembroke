/**
 * ChartsModule — the native charting module shell.
 *
 * Replaces the TradingView embed with first-party canvas rendering.
 * Composes ChartCanvas + useChartData, with placeholder slots for
 * IndicatorPanel and IndicatorBuilder (filled in the next batch).
 *
 * NO TradingView script tag, NO external charting library imports.
 *
 * @module charts
 */

import { useCallback, useState } from 'react'
import { ChartCandlestick, LayoutDashboard, Layers, WifiOff } from 'lucide-react'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { TabBar } from '@/components/ui/TabBar'
import { IconButton } from '@/components/ui/IconButton'
import { Toolbar, ToolbarDivider } from '@/components/ui/Toolbar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSettings } from '@/stores/settings'
import type { BuiltinIndicatorSpec } from '@shared/chart/indicator-series'
import { ALL_OVERLAY_IDS, type SmcOverlayId, type SmcOverlayState, type Drawable } from '@shared/smc'
import { ChartCanvas } from './ChartCanvas'
import { IndicatorPanel } from './IndicatorPanel'
import { useChartData } from './useChartData'
import type { ChartInterval } from './useChartData'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'AVAXUSDT',
  'DOGEUSDT'
]

const INTERVAL_TABS: { id: ChartInterval; label: string }[] = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' }
]

type Layout = 1 | 2 | 4

const LAYOUT_TABS = [
  { id: '1', label: '1×' },
  { id: '2', label: '2×' },
  { id: '4', label: '4×' }
]

// ---------------------------------------------------------------------------
// Single chart pane component
// ---------------------------------------------------------------------------

function ChartPane({
  symbol,
  interval,
  reduceMotion,
  showLabel,
  indicators,
  smcDrawables
}: {
  symbol: string
  interval: ChartInterval
  reduceMotion: boolean
  showLabel: boolean
  indicators: BuiltinIndicatorSpec[]
  smcDrawables: Drawable[]
}): React.JSX.Element {
  const { candles, live, lastPrice, lastDir, status, requestHistory } = useChartData(
    symbol,
    interval
  )

  if (status === 'offline') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-panel">
        <EmptyState
          icon={WifiOff}
          title="No Feed"
          description={`No live data available for ${symbol}`}
        />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {showLabel && (
        <span className="num absolute left-2 top-2 z-10 rounded bg-bg/70 px-1.5 py-0.5 text-[length:var(--text-caption)] text-accent">
          {symbol}
        </span>
      )}
      {status === 'connecting' && candles.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center bg-panel">
          <span className="text-[length:var(--text-caption)] text-muted animate-pulse">
            Connecting…
          </span>
        </div>
      ) : (
        <ChartCanvas
          candles={candles}
          live={live}
          lastPrice={lastPrice}
          lastDir={lastDir}
          reduceMotion={reduceMotion}
          onRequestHistory={requestHistory}
          indicators={indicators}
          smcOverlays={smcDrawables}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export default function ChartsModule(): React.JSX.Element {
  const [layout, setLayout] = useState<Layout>(1)
  const [interval, setInterval] = useState<ChartInterval>('4h')
  const [symbols, setSymbols] = useState<string[]>([
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT'
  ])
  const [activePane, setActivePane] = useState(0)
  const [input, setInput] = useState('')
  const reduceMotion = useSettings((s) => s.reduceMotion)

  // Indicator state
  const [indicators, setIndicators] = useState<BuiltinIndicatorSpec[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  // SMC overlay state — default all off
  const [smcState, setSmcState] = useState<SmcOverlayState>(
    () => Object.fromEntries(ALL_OVERLAY_IDS.map((id) => [id, false])) as SmcOverlayState
  )

  const handleAddIndicator = useCallback((spec: BuiltinIndicatorSpec): void => {
    setIndicators((prev) => [...prev, spec])
  }, [])

  const handleRemoveIndicator = useCallback((index: number): void => {
    setIndicators((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleToggleSmc = useCallback((id: SmcOverlayId): void => {
    setSmcState((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const setPaneSymbol = (sym: string): void => {
    setSymbols((prev) => {
      const next = [...prev]
      next[activePane] = sym
      return next
    })
  }

  const visible = symbols.slice(0, layout)

  // SMC drawables — empty array for now; computing real SMC overlays requires
  // ConvictionResult which is a stretch goal. Passing empty keeps the prop wired.
  const smcDrawables: Drawable[] = []

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={ChartCandlestick}
        title="Charts"
        actions={
          <div className="flex items-center gap-2">
            {/* Symbol search */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (input.trim()) {
                  setPaneSymbol(input.trim().toUpperCase())
                  setInput('')
                }
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Pane ${activePane + 1} symbol`}
                className="num w-48 rounded border border-edge bg-panel px-2 py-1 text-[length:var(--text-caption)] text-text outline-none focus:border-accent/50 t-colors"
              />
            </form>

            {/* Preset symbols */}
            <div className="flex items-center gap-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPaneSymbol(p)}
                  className="rounded px-1.5 py-0.5 text-[length:var(--text-caption)] text-muted hover:bg-panel2 hover:text-accent t-colors"
                >
                  {p}
                </button>
              ))}
            </div>

            <ToolbarDivider />

            {/* Interval picker */}
            <TabBar
              tabs={INTERVAL_TABS}
              active={interval}
              onTabChange={(id) => setInterval(id as ChartInterval)}
              size="sm"
            />

            <ToolbarDivider />

            {/* Layout picker */}
            <Toolbar>
              {LAYOUT_TABS.map((lt) => (
                <IconButton
                  key={lt.id}
                  icon={LayoutDashboard}
                  title={`${lt.label} layout`}
                  active={layout === Number(lt.id)}
                  onClick={() => setLayout(Number(lt.id) as Layout)}
                  size="sm"
                />
              ))}
            </Toolbar>

            <ToolbarDivider />

            {/* Indicator/Overlay panel toggle */}
            <IconButton
              icon={Layers}
              title="Indicators & Overlays"
              active={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
              size="sm"
            />
          </div>
        }
      />

      <div className="relative min-h-0 flex-1">
        {/* Indicator Panel (absolute positioned) */}
        <IndicatorPanel
          indicators={indicators}
          onAdd={handleAddIndicator}
          onRemove={handleRemoveIndicator}
          smcState={smcState}
          onToggle={handleToggleSmc}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />

        <div
          className={
            layout === 1
              ? 'grid h-full gap-2 p-2 grid-cols-1 grid-rows-1'
              : layout === 2
                ? 'grid h-full gap-2 p-2 grid-cols-2 grid-rows-1'
                : 'grid h-full gap-2 p-2 grid-cols-2 grid-rows-2'
          }
        >
          {visible.map((sym, i) => (
            <div
              key={`${sym}-${i}`}
              onMouseDown={() => setActivePane(i)}
              className={
                layout > 1 && activePane === i
                  ? 'relative min-h-0 rounded-sm ring-1 ring-accent/50 overflow-hidden'
                  : 'relative min-h-0 rounded-sm border border-edge overflow-hidden'
              }
            >
              <ChartPane
                symbol={sym}
                interval={interval}
                reduceMotion={reduceMotion}
                showLabel={layout > 1}
                indicators={indicators}
                smcDrawables={smcDrawables}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
