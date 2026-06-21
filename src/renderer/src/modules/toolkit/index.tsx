import type { ComponentType } from 'react'
import clsx from 'clsx'
import {
  Bitcoin,
  Banknote,
  Coins,
  Scale,
  Gauge,
  TrendingUp,
  Percent,
  ArrowDownToLine,
  Clock,
  Layers,
  Spline,
  Receipt,
  Boxes,
  BarChart3,
  LineChart,
  FileText,
  Radar,
  NotebookPen,
  Sparkles,
  FlaskConical,
  Grid3x3,
  PieChart,
  CalendarRange,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react'
import { usePersistedState } from './lib'
import PositionSizeCrypto from './tools/PositionSizeCrypto'
import PositionSizeForex from './tools/PositionSizeForex'
import PipValueTool from './tools/PipValue'
import RiskReward from './tools/RiskReward'
import MarginLiquidation from './tools/MarginLiquidation'
import Compounding from './tools/Compounding'
import Kelly from './tools/Kelly'
import DrawdownRecovery from './tools/DrawdownRecovery'
import SessionClock from './tools/SessionClock'
import TradePnl from './tools/TradePnl'
import PivotPoints from './tools/PivotPoints'
import Fibonacci from './tools/Fibonacci'
import Dca from './tools/Dca'
import CurrencyStrength from './tools/CurrencyStrength'
import IndicatorPlayground from './tools/IndicatorPlayground'
import ResearchReader from './tools/ResearchReader'
import SignalScanner from './tools/SignalScanner'
import TradeJournal from './tools/TradeJournal'
import MarketBrief from './tools/MarketBrief'
import BacktestLab from './tools/BacktestLab'
import CorrelationMatrix from './tools/CorrelationMatrix'
import PortfolioRisk from './tools/PortfolioRisk'
import Seasonality from './tools/Seasonality'
import StrategyOptimizer from './tools/StrategyOptimizer'

interface ToolDef {
  id: string
  label: string
  group: string
  icon: LucideIcon
  blurb: string
  component: ComponentType
}

const TOOLS: ToolDef[] = [
  {
    id: 'brief',
    label: 'Market brief',
    group: 'Overview',
    icon: Sparkles,
    blurb: 'Live rule-based session readout: breadth, FX strength, sessions.',
    component: MarketBrief
  },
  {
    id: 'pos-crypto',
    label: 'Position size · Crypto',
    group: 'Risk',
    icon: Bitcoin,
    blurb: 'Size a linear-contract trade from a fixed risk budget.',
    component: PositionSizeCrypto
  },
  {
    id: 'pos-forex',
    label: 'Position size · Forex',
    group: 'Risk',
    icon: Banknote,
    blurb: 'Size a forex trade in lots from pip-distance risk.',
    component: PositionSizeForex
  },
  {
    id: 'pip',
    label: 'Pip value',
    group: 'Risk',
    icon: Coins,
    blurb: 'Value of a pip per lot in your account currency.',
    component: PipValueTool
  },
  {
    id: 'rr',
    label: 'Risk / reward',
    group: 'Edge',
    icon: TrendingUp,
    blurb: 'R-multiple, break-even win rate and expectancy.',
    component: RiskReward
  },
  {
    id: 'pnl',
    label: 'Trade P&L / ROI',
    group: 'Edge',
    icon: Receipt,
    blurb: 'Net P&L, ROI on margin and fee-aware breakeven.',
    component: TradePnl
  },
  {
    id: 'kelly',
    label: 'Kelly criterion',
    group: 'Edge',
    icon: Percent,
    blurb: 'Optimal and fractional stake sizing from your edge.',
    component: Kelly
  },
  {
    id: 'margin',
    label: 'Margin & liquidation',
    group: 'Leverage',
    icon: Gauge,
    blurb: 'Required margin and isolated liquidation price.',
    component: MarginLiquidation
  },
  {
    id: 'dca',
    label: 'DCA / average entry',
    group: 'Leverage',
    icon: Boxes,
    blurb: 'Volume-weighted average entry across scale-in fills.',
    component: Dca
  },
  {
    id: 'pivots',
    label: 'Pivot points',
    group: 'Levels',
    icon: Layers,
    blurb: 'Classic, Fibonacci, Camarilla and Woodie pivots.',
    component: PivotPoints
  },
  {
    id: 'fibonacci',
    label: 'Fibonacci levels',
    group: 'Levels',
    icon: Spline,
    blurb: 'Retracement and extension levels from a swing.',
    component: Fibonacci
  },
  {
    id: 'compound',
    label: 'Compounding',
    group: 'Growth',
    icon: Scale,
    blurb: 'Project equity growth period by period.',
    component: Compounding
  },
  {
    id: 'drawdown',
    label: 'Drawdown recovery',
    group: 'Growth',
    icon: ArrowDownToLine,
    blurb: 'Gain needed to recover from a drawdown.',
    component: DrawdownRecovery
  },
  {
    id: 'strength',
    label: 'Currency strength',
    group: 'Market',
    icon: BarChart3,
    blurb: 'Live 8-currency strength meter from the 28 majors.',
    component: CurrencyStrength
  },
  {
    id: 'indicators',
    label: 'Indicator playground',
    group: 'Market',
    icon: LineChart,
    blurb: 'Live RSI, MACD, Bollinger, ATR and more on real candles.',
    component: IndicatorPlayground
  },
  {
    id: 'scanner',
    label: 'Signal scanner',
    group: 'Market',
    icon: Radar,
    blurb: 'Confluence scan across a watchlist, ranked & exportable.',
    component: SignalScanner
  },
  {
    id: 'backtest',
    label: 'Backtest lab',
    group: 'Market',
    icon: FlaskConical,
    blurb: 'Test SMA/RSI strategies on real history vs buy & hold.',
    component: BacktestLab
  },
  {
    id: 'session',
    label: 'Session clock',
    group: 'Market',
    icon: Clock,
    blurb: 'Live forex session times, status and overlaps.',
    component: SessionClock
  },
  {
    id: 'research',
    label: 'Research reader',
    group: 'Research',
    icon: FileText,
    blurb: 'Open and read PDF reports, decks and whitepapers in-app.',
    component: ResearchReader
  },
  {
    id: 'correlation',
    label: 'Correlation matrix',
    group: 'Quant',
    icon: Grid3x3,
    blurb: 'Cross-asset return correlation heatmap (their CORR).',
    component: CorrelationMatrix
  },
  {
    id: 'portfolio',
    label: 'Portfolio risk',
    group: 'Quant',
    icon: PieChart,
    blurb: 'VaR, Sharpe, Sortino, drawdown and volatility (their PORT).',
    component: PortfolioRisk
  },
  {
    id: 'optimizer',
    label: 'Strategy optimizer',
    group: 'Quant',
    icon: SlidersHorizontal,
    blurb: 'Sweep SMA parameters and rank by Sharpe.',
    component: StrategyOptimizer
  },
  {
    id: 'seasonality',
    label: 'Seasonality',
    group: 'Quant',
    icon: CalendarRange,
    blurb: 'Average return by weekday and month.',
    component: Seasonality
  },
  {
    id: 'journal',
    label: 'Trade journal',
    group: 'Journal',
    icon: NotebookPen,
    blurb: 'Log trades; auto-track R, win rate, expectancy and equity.',
    component: TradeJournal
  }
]

const GROUP_ORDER = ['Overview', 'Risk', 'Edge', 'Leverage', 'Levels', 'Growth', 'Market', 'Quant', 'Research', 'Journal']

export default function ToolkitModule(): React.JSX.Element {
  const [activeId, setActiveId] = usePersistedState<string>('active-tool', TOOLS[0].id)
  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0]
  const ActiveComponent = active.component

  return (
    <div className="flex h-full min-h-0">
      {/* Left rail */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-edge bg-panel/40 p-3">
        <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Trader Toolkit
        </div>
        {GROUP_ORDER.map((group) => {
          const items = TOOLS.filter((t) => t.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-4">
              <div className="mb-1 px-2 text-[10px] uppercase tracking-wide text-muted/60">
                {group}
              </div>
              <div className="space-y-0.5">
                {items.map((tool) => {
                  const Icon = tool.icon
                  const isActive = tool.id === active.id
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveId(tool.id)}
                      className={clsx(
                        'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[12px] transition-colors',
                        isActive
                          ? 'bg-accent/15 text-accent'
                          : 'text-muted hover:bg-panel2 hover:text-text'
                      )}
                    >
                      <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-accent' : '')} />
                      <span className="truncate">{tool.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </aside>

      {/* Tool surface */}
      <section className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center gap-3 border-b border-edge px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-edge bg-panel">
            <active.icon className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-[15px] font-medium leading-tight text-text">{active.label}</h1>
            <p className="text-[11px] text-muted">{active.blurb}</p>
          </div>
        </header>
        <div className="p-6">
          <ActiveComponent />
        </div>
      </section>
    </div>
  )
}
