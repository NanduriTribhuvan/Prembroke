import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, HelpCircle, Square, Columns2, LayoutGrid, Bookmark, Trash2, Plus } from 'lucide-react'
import type { ViewId } from '@/stores/view'
import { useView } from '@/stores/view'
import { useWorkspace, type Layout } from '@/stores/workspace'
import { isTimeframe, normalizeTimeframe } from '@shared/canvas'
import { IconButton, Toolbar, ToolbarDivider } from '@/components/ui'

const FUNCS: Record<string, ViewId> = {
  ALPHA: 'alpha', CIO: 'alpha', RADAR: 'alpha', BRIEF: 'alpha',
  DASH: 'dashboard', HOME: 'dashboard', CONV: 'conviction', CONVICTION: 'conviction',
  CHART: 'charts', CHARTS: 'charts', SCAN: 'scanner', HEAT: 'heatmap', MAP: 'heatmap',
  CORR: 'correlation', CORRELATION: 'correlation',
  DOM: 'orderbook', DEPTH: 'orderbook', OB: 'orderbook', MKT: 'markets', MARKETS: 'markets',
  FX: 'fx', FOREX: 'fx', IDX: 'indices', INDICES: 'indices', SPX: 'indices',
  COMD: 'commodities', COMM: 'commodities', COMMOD: 'commodities', OIL: 'commodities', GOLD: 'commodities',
  ETF: 'etfs', ETFS: 'etfs',
  COINS: 'coins', STOCK: 'stocks', STOCKS: 'stocks', EQ: 'stocks',
  FA: 'fundamentals', FUND: 'fundamentals', FUNDAMENTALS: 'fundamentals',
  FIN: 'financials', FINANCIALS: 'financials', IS: 'financials', BS: 'financials',
  OPT: 'options', OPTIONS: 'options', FLOWOPT: 'options',
  VOL: 'cryptooptions', IV: 'cryptooptions', GEX: 'cryptooptions', COPT: 'cryptooptions', DVOL: 'cryptooptions',
  SEC: 'filings', FILINGS: 'filings', EDGAR: 'filings', DERIV: 'derivatives',
  FUT: 'futures', FUTS: 'futures', FUTURES: 'futures', ES: 'futures', NQ: 'futures',
  LIQ: 'flow', FLOW: 'flow', CHAIN: 'onchain', GAS: 'onchain',
  DEX: 'dex', DEXSCREEN: 'dex', PAIRS: 'dex', TRENDING: 'dex',
  DEFI: 'defi', YIELDS: 'defi', APY: 'defi', TVL: 'defi', HACKS: 'defi',
  NEWS: 'news', TV: 'tv', X: 'social', SOCIAL: 'social', AI: 'ai', MENTOR: 'ai',
  RESEARCH: 'research', RT: 'research', TEAM: 'research', DD: 'research',
  PLAY: 'playbook', BOOK: 'playbook', ICT: 'playbook', CAL: 'calendar', ECO: 'calendar',
  ALERT: 'alerts', ALERTS: 'alerts', JRNL: 'journal', JOURNAL: 'journal', BT: 'backtest',
  TEST: 'backtest', TOOLS: 'toolkit', SET: 'settings', SETTINGS: 'settings',
  CANVAS: 'canvas', GRID: 'canvas', WORKSPACE: 'canvas', WS: 'canvas', APPS: 'apps', APP: 'apps'
}

const CODE_SUGGEST = ['CONV', 'CHART', 'SCAN', 'HEAT', 'CORR', 'DOM', 'MKT', 'FX', 'IDX', 'COMD', 'FUT', 'ETF', 'COINS', 'EQ', 'FA', 'OPT', 'VOL', 'SEC', 'DERIV', 'LIQ', 'GAS', 'DEX', 'DEFI', 'NEWS', 'CAL', 'TV', 'X', 'MENTOR', 'RT', 'ICT', 'ALERT', 'JRNL', 'BT', 'TOOLS', 'SET', 'CANVAS', 'APPS']
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC', 'ATOM', 'NEAR', 'APT', 'ARB', 'INJ']

const HELP_ROWS: { code: string; desc: string }[] = [
  { code: '<SYM>', desc: 'set active symbol (ETH) → opens Conviction' },
  { code: '<SYM> CONV/CHART', desc: 'conviction / chart a symbol (SOL CHART)' },
  { code: 'DOM · SCAN · HEAT', desc: 'order book · scanner · confluence heatmap' },
  { code: 'MKT · COINS · EQ', desc: 'markets · coins · stocks' },
  { code: 'FX · FOREX', desc: 'FX desk — carry, rate differentials, currency strength' },
  { code: 'IDX · INDICES', desc: 'indices desk — S&P/Nasdaq/DAX/Nikkei charts + quotes' },
  { code: 'COMD · OIL · GOLD', desc: 'commodities desk — energy, metals, ags' },
  { code: 'FUT · FUTURES', desc: 'futures desk — continuous front-month + seasonality' },
  { code: 'ETF · ETFS', desc: 'ETFs desk — sector-grouped funds + quotes' },
  { code: 'DERIV · LIQ · GAS', desc: 'derivatives · liquidations · on-chain' },
  { code: 'DEX · PAIRS', desc: 'on-chain DEX screener — trending, new, search' },
  { code: 'DEFI · YIELDS', desc: 'DeFi desk — top APY, chain TVL, exploits' },
  { code: 'VOL · GEX', desc: 'crypto options · dealer gamma (Deribit)' },
  { code: 'NEWS · CAL · TV · X', desc: 'news · calendar · live TV · social' },
  { code: 'MENTOR · ICT', desc: 'AI mentor · ICT/SMC playbook' },
  { code: 'RT · DD', desc: 'AI research team deep-dive on a symbol' },
  { code: 'CANVAS · APPS', desc: 'widget workspace · curated app dashboards' },
  { code: 'BT · JRNL · ALERT', desc: 'backtest · journal · alerts' }
]

function resolveSymbol(token: string): string {
  const t = token.toUpperCase()
  if (t.endsWith('USDT') || t.endsWith('USD')) return t
  return `${t}USDT`
}

export default function CommandBar(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [help, setHelp] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [sel, setSel] = useState(0)
  const [wsOpen, setWsOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const setConvictionSymbol = useView((s) => s.setConvictionSymbol)
  const setActiveTimeframe = useView((s) => s.setActiveTimeframe)
  const openInActive = useWorkspace((s) => s.openInActive)
  const layout = useWorkspace((s) => s.layout)
  const setLayout = useWorkspace((s) => s.setLayout)
  const presets = useWorkspace((s) => s.presets)
  const savePreset = useWorkspace((s) => s.savePreset)
  const loadPreset = useWorkspace((s) => s.loadPreset)
  const deletePreset = useWorkspace((s) => s.deletePreset)
  const canvasEnabled = useWorkspace((s) => s.canvasEnabled)
  const dashboards = useWorkspace((s) => s.dashboards)
  const activeDashboardId = useWorkspace((s) => s.activeDashboardId)
  const saveDashboard = useWorkspace((s) => s.saveDashboard)
  const loadDashboard = useWorkspace((s) => s.loadDashboard)
  const deleteDashboard = useWorkspace((s) => s.deleteDashboard)
  const [dashName, setDashName] = useState('')

  const lastToken = input.trim().split(/\s+/).pop()?.toUpperCase() ?? ''
  const suggestions = useMemo(() => {
    if (!lastToken) return []
    const codes = CODE_SUGGEST.filter((c) => c.startsWith(lastToken)).map((c) => ({ v: c, kind: 'fn' as const }))
    const syms = SYMBOLS.filter((s) => s.startsWith(lastToken)).map((s) => ({ v: s, kind: 'sym' as const }))
    return [...syms, ...codes].slice(0, 6)
  }, [lastToken])

  const dispatch = (raw: string): void => {
    const parts = raw.trim().toUpperCase().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return
    if (parts[parts.length - 1] === 'GO') parts.pop()
    if (parts[0] === 'HELP' || parts[0] === '?') {
      setHelp(true)
      setInput('')
      return
    }
    let symbol: string | null = null
    let func: ViewId | null = null
    let timeframe: string | null = null
    for (const p of parts) {
      if (FUNCS[p]) func = FUNCS[p]
      else if (isTimeframe(p)) timeframe = normalizeTimeframe(p)
      else symbol = p
    }
    if (timeframe) setActiveTimeframe(timeframe)
    if (symbol) {
      const resolved = resolveSymbol(symbol)
      setConvictionSymbol(resolved)
      if (!func) func = 'conviction'
      setFlash(`${resolved}${timeframe ? ` ${timeframe}` : ''} → ${func.toUpperCase()}`)
    } else if (timeframe) {
      setFlash(timeframe)
    } else if (func) {
      setFlash(func.toUpperCase())
    } else {
      setFlash('unknown — type HELP')
    }
    if (func) openInActive(func)
    setInput('')
    setHelp(false)
    setSel(0)
    window.setTimeout(() => setFlash(null), 2200)
  }

  const applySuggestion = (s: string): void => {
    const parts = input.trim().split(/\s+/)
    parts[parts.length - 1] = s
    dispatch(parts.join(' '))
  }

  const layoutIcons: [Layout, typeof Square, string][] = [
    [1, Square, '1-panel layout'],
    [2, Columns2, '2-panel layout'],
    [4, LayoutGrid, '4-panel layout'],
  ]

  return (
    <div
      className="relative z-30 flex shrink-0 items-center gap-2 border-b border-border-subtle bg-bg px-3 shadow-[var(--shadow-sm)]"
      style={{ height: 'var(--cmdbar-h)' }}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="num flex h-5 items-center rounded-md bg-accent-soft px-1.5 text-[10px] font-bold tracking-[0.15em] text-gold shadow-[var(--hairline)]">
          CMD
        </span>
        <ChevronRight size={13} strokeWidth={2.5} className="text-gold/70" />
      </div>
      {input === '' && <span className="cmd-cursor shrink-0" aria-hidden />}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (suggestions.length && sel >= 0 && sel < suggestions.length && lastToken && suggestions[sel].v !== lastToken) {
            applySuggestion(suggestions[sel].v)
          } else {
            dispatch(input)
          }
        }}
        className="relative flex-1"
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setSel(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setHelp(false)
              setInput('')
            } else if (e.key === 'ArrowDown' && suggestions.length) {
              e.preventDefault()
              setSel((s) => Math.min(s + 1, suggestions.length - 1))
            } else if (e.key === 'ArrowUp' && suggestions.length) {
              e.preventDefault()
              setSel((s) => Math.max(s - 1, 0))
            }
          }}
          placeholder="Command — e.g.  ETH CONV   ·   SOL CHART   ·   DOM   ·   SCAN   ·   type HELP"
          className={clsx(
            'focus-ring num w-full rounded bg-transparent text-[12px] uppercase tracking-wide text-gold outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted',
            input !== '' && 'text-glow'
          )}
          spellCheck={false}
        />
        {suggestions.length > 0 && (
          <div className="surface-pop absolute left-0 top-8 z-50 w-64 overflow-hidden p-1">
            {suggestions.map((s, i) => (
              <button
                key={s.v}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  applySuggestion(s.v)
                }}
                onMouseEnter={() => setSel(i)}
                className={clsx(
                  't-colors flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs',
                  i === sel ? 'bg-accent-soft' : 'hover:bg-panel2/70'
                )}
              >
                <span className="num text-gold">{s.v}</span>
                <span className="text-[10px] text-muted">{s.kind === 'sym' ? 'symbol' : 'function'}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {flash && <span className="num text-[11px] text-up">{flash}</span>}

      <Toolbar>
        <IconButton
          icon={HelpCircle}
          title="Function codes (HELP)"
          onClick={() => setHelp((h) => !h)}
          active={help}
          size="sm"
        />
        <ToolbarDivider />
        <IconButton
          icon={Bookmark}
          title="Saved workspaces"
          onClick={() => setWsOpen((o) => !o)}
          active={wsOpen}
          size="sm"
        />
        <ToolbarDivider />
        {layoutIcons.map(([n, Icon, label]) => (
          <IconButton
            key={n}
            icon={Icon}
            title={label}
            onClick={() => setLayout(n)}
            active={layout === n}
            size="sm"
          />
        ))}
      </Toolbar>

      {help && (
        <div className="surface-pop absolute left-3 top-10 z-50 w-[460px] p-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gold">Function codes</div>
          <div className="space-y-1">
            {HELP_ROWS.map((r) => (
              <div key={r.code} className="flex items-baseline gap-3 text-xs">
                <span className="num w-32 shrink-0 text-gold">{r.code}</span>
                <span className="text-muted">{r.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-edge pt-2 text-[10px] text-muted">
            Append GO like a real terminal (<span className="num text-gold">BTC CONV GO</span>). Bookmark icon saves
            workspaces. Esc clears.
          </div>
        </div>
      )}

      {wsOpen && (
        <div className="surface-pop absolute right-16 top-10 z-50 w-64 p-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gold">Workspaces</div>
          <div className="space-y-1">
            {presets.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadPreset(p.name)
                    setWsOpen(false)
                  }}
                  className="flex-1 rounded px-2 py-1 text-left text-xs text-text hover:bg-panel2"
                >
                  {p.name} <span className="num text-[10px] text-muted">· {p.layout}-up</span>
                </button>
                <button onClick={() => deletePreset(p.name)} className="text-muted hover:text-down">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {presets.length === 0 && <div className="text-[11px] text-muted">No saved workspaces yet.</div>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (presetName.trim()) {
                savePreset(presetName.trim())
                setPresetName('')
              }
            }}
            className="mt-2 flex items-center gap-1 border-t border-edge pt-2"
          >
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Save current as…"
              className="flex-1 rounded border border-edge bg-panel2 px-2 py-1 text-[11px] text-text outline-none focus:border-gold/50"
            />
            <button type="submit" className="rounded bg-gold/20 p-1 text-gold hover:bg-gold/30">
              <Plus size={13} />
            </button>
          </form>

          {canvasEnabled && (
            <div className="mt-3 border-t border-edge pt-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gold">
                Canvas dashboards
              </div>
              <div className="space-y-1">
                {dashboards.map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        loadDashboard(d.id)
                        setWsOpen(false)
                      }}
                      className={clsx(
                        'flex-1 rounded px-2 py-1 text-left text-xs hover:bg-panel2',
                        d.id === activeDashboardId ? 'text-gold' : 'text-text'
                      )}
                    >
                      {d.name}{' '}
                      <span className="num text-[10px] text-muted">· {d.widgets.length}w</span>
                    </button>
                    <button
                      onClick={() => deleteDashboard(d.id)}
                      title="Delete dashboard"
                      className="text-muted hover:text-down"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {dashboards.length === 0 && (
                  <div className="text-[11px] text-muted">No dashboards yet.</div>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (dashName.trim()) {
                    saveDashboard(dashName.trim())
                    setDashName('')
                  }
                }}
                className="mt-2 flex items-center gap-1 border-t border-edge pt-2"
              >
                <input
                  value={dashName}
                  onChange={(e) => setDashName(e.target.value)}
                  placeholder="Save current canvas as…"
                  className="flex-1 rounded border border-edge bg-panel2 px-2 py-1 text-[11px] text-text outline-none focus:border-gold/50"
                />
                <button type="submit" className="rounded bg-gold/20 p-1 text-gold hover:bg-gold/30">
                  <Plus size={13} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
