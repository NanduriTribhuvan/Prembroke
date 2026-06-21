import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

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
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0b1710',
      gridColor: 'rgba(28,51,37,0.6)',
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
      className="tradingview-widget-container h-full w-full overflow-hidden rounded-lg border border-edge"
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
const INTERVALS = [
  { v: '15', l: '15m' },
  { v: '60', l: '1H' },
  { v: '240', l: '4H' },
  { v: 'D', l: '1D' }
]
type Layout = 1 | 2 | 4

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
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-2.5">
        <h1 className="text-[15px] font-semibold text-text">Charts</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) {
              setPaneSymbol(input.trim().toUpperCase())
              setInput('')
            }
          }}
          className="flex items-center"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Pane ${activePane + 1} symbol e.g. BINANCE:BTCUSDT`}
            className="num w-64 rounded border border-edge bg-panel px-2 py-1 text-xs text-text outline-none focus:border-gold/50"
          />
        </form>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPaneSymbol(p)}
              className="rounded bg-panel2 px-1.5 py-1 text-[10px] text-muted hover:text-gold"
            >
              {p.split(':')[1]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.v}
              onClick={() => setInterval(iv.v)}
              className={clsx(
                'rounded px-2 py-1 text-xs',
                interval === iv.v ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
              )}
            >
              {iv.l}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-edge" />
          {([1, 2, 4] as Layout[]).map((n) => (
            <button
              key={n}
              onClick={() => setLayout(n)}
              className={clsx(
                'rounded px-2 py-1 text-xs',
                layout === n ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
              )}
            >
              {n}×
            </button>
          ))}
        </div>
      </div>

      {/* grid */}
      <div
        className={clsx(
          'grid min-h-0 flex-1 gap-2 p-2',
          layout === 1 && 'grid-cols-1 grid-rows-1',
          layout === 2 && 'grid-cols-2 grid-rows-1',
          layout === 4 && 'grid-cols-2 grid-rows-2'
        )}
      >
        {visible.map((sym, i) => (
          <div
            key={i}
            onMouseDown={() => setActivePane(i)}
            className={clsx(
              'relative min-h-0',
              layout > 1 && activePane === i && 'rounded-lg ring-1 ring-gold/50'
            )}
          >
            {layout > 1 && (
              <span className="num absolute left-2 top-2 z-10 rounded bg-bg/70 px-1.5 py-0.5 text-[10px] text-gold">
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
