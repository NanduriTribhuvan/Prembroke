import { useEffect, useRef, useState } from 'react'
import { ChartCandlestick } from 'lucide-react'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { TabBar } from '@/components/ui/TabBar'
import { IconButton } from '@/components/ui/IconButton'
import { Toolbar, ToolbarDivider } from '@/components/ui/Toolbar'
import { LayoutDashboard } from 'lucide-react'

// TradingView embed uses literal colours for the chart background/grid.
// These cannot be CSS vars because the embed config is a JSON string.
const TV_COLORS = {
  background: '#14110b',
  grid: 'rgba(52,44,28,0.6)',
} as const

/** Single TradingView Advanced Chart embed. Rebuilds when symbol/interval change. */
function TVChart({ symbol, interval }: { symbol: string; interval: string }): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = ''
    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.height = '100%'
    widget.style.width = '100%'
    el.appendChild(widget)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: TV_COLORS.background,
      gridColor: TV_COLORS.grid,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      studies: ['STD;EMA', 'STD;RSI'],
      support_host: 'https://www.tradingview.com'
    })
    el.appendChild(script)
  }, [symbol, interval])

  return (
    <div
      ref={host}
      className="tradingview-widget-container h-full w-full overflow-hidden rounded-sm border border-edge"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

const PRESETS = [
  'BINANCE:BTCUSDT',
  'BINANCE:ETHUSDT',
  'BINANCE:SOLUSDT',
  'FX:EURUSD',
  'FX:GBPUSD',
  'OANDA:XAUUSD',
  'TVC:DXY'
]

const INTERVAL_TABS = [
  { id: '15',  label: '15m' },
  { id: '60',  label: '1H' },
  { id: '240', label: '4H' },
  { id: 'D',   label: '1D' }
]

type Layout = 1 | 2 | 4

const LAYOUT_TABS = [
  { id: '1', label: '1×' },
  { id: '2', label: '2×' },
  { id: '4', label: '4×' }
]

export default function ChartsModule(): React.JSX.Element {
  const [layout, setLayout] = useState<Layout>(1)
  const [interval, setInterval] = useState('240')
  const [symbols, setSymbols] = useState<string[]>([
    'BINANCE:BTCUSDT',
    'BINANCE:ETHUSDT',
    'BINANCE:SOLUSDT',
    'OANDA:XAUUSD'
  ])
  const [activePane, setActivePane] = useState(0)
  const [input, setInput] = useState('')

  const setPaneSymbol = (sym: string): void => {
    setSymbols((prev) => {
      const next = [...prev]
      next[activePane] = sym
      return next
    })
  }

  const visible = symbols.slice(0, layout)

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
                className="num w-48 rounded border border-edge bg-panel px-2 py-1 text-[length:var(--text-caption)] text-text outline-none focus:border-gold/50 t-colors"
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
                  {p.split(':')[1]}
                </button>
              ))}
            </div>

            <ToolbarDivider />

            {/* Interval picker */}
            <TabBar
              tabs={INTERVAL_TABS}
              active={interval}
              onTabChange={setInterval}
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
          </div>
        }
      />

      <div
        className={
          layout === 1
            ? 'grid min-h-0 flex-1 gap-2 p-2 grid-cols-1 grid-rows-1'
            : layout === 2
              ? 'grid min-h-0 flex-1 gap-2 p-2 grid-cols-2 grid-rows-1'
              : 'grid min-h-0 flex-1 gap-2 p-2 grid-cols-2 grid-rows-2'
        }
      >
        {visible.map((sym, i) => (
          <div
            key={i}
            onMouseDown={() => setActivePane(i)}
            className={
              layout > 1 && activePane === i
                ? 'relative min-h-0 rounded-sm ring-1 ring-accent/50'
                : 'relative min-h-0'
            }
          >
            {layout > 1 && (
              <span className="num absolute left-2 top-2 z-10 rounded bg-bg/70 px-1.5 py-0.5 text-[length:var(--text-caption)] text-accent">
                {sym.split(':')[1] ?? sym}
              </span>
            )}
            <TVChart symbol={sym} interval={interval} />
          </div>
        ))}
      </div>
    </div>
  )
}
