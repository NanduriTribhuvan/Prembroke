import type { ComponentType } from 'react'
import {
  Activity,
  AppWindow,
  ArrowLeftRight,
  AtSign,
  Banknote,
  Bell,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Boxes,
  Brain,
  Building2,
  Calculator,
  CalendarDays,
  CandlestickChart,
  ChartCandlestick,
  CircleDollarSign,
  Coins,
  FileText,
  FlaskConical,
  Fuel,
  Gauge,
  Grid3x3,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LineChart,
  Network,
  Newspaper,
  Radar,
  Settings,
  Sigma,
  Sparkles,
  Spline,
  Sunrise,
  Tv,
  Users,
  Vault,
  Zap,
  type LucideIcon
} from 'lucide-react'
import type { ViewId } from '@/stores/view'
import ToolkitModule from './toolkit'
import TvModule from './tv'
import SocialModule from './social'
import DashboardModule from './dashboard'
import ConvictionModule from './conviction'
import ChartsModule from './charts'
import AiModule from './ai'
import MarketsModule from './markets'
import FxModule from './fx'
import IndicesModule from './indices'
import CommoditiesModule from './commodities'
import FuturesModule from './futures'
import EtfsModule from './etfs'
import DerivativesModule from './derivatives'
import ScannerModule from './scanner'
import AlertsModule from './alerts'
import NewsModule from './news'
import CalendarModule from './calendar'
import SettingsModule from './settings'
import OnchainModule from './onchain'
import FlowModule from './flow'
import CoinsModule from './coins'
import StocksModule from './stocks'
import HeatmapModule from './heatmap'
import BacktestModule from './backtest'
import JournalModule from './journal'
import PlaybookModule from './playbook'
import OrderBookModule from './orderbook'
import CorrelationModule from './correlation'
import FundamentalsModule from './fundamentals'
import OptionsModule from './options'
import FilingsModule from './filings'
import FinancialsModule from './financials'
import AlphaModule from './alpha'
import CryptoOptionsModule from './cryptooptions'
import ResearchModule from './research'
import AnalystModule from './analyst'
import DexModule from './dex'
import DefiModule from './defi'
import WidgetCanvas from '@/components/canvas/WidgetCanvas'
import AppsGallery from '@/components/canvas/AppsGallery'

export interface ModuleDef {
  id: ViewId
  label: string
  icon: LucideIcon
  component: ComponentType
}

export const MODULES: ModuleDef[] = [
  { id: 'alpha', label: 'Alpha Radar', icon: Sunrise, component: AlphaModule },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: DashboardModule },
  { id: 'conviction', label: 'Conviction', icon: Gauge, component: ConvictionModule },
  { id: 'scanner', label: 'Scanner', icon: Radar, component: ScannerModule },
  { id: 'heatmap', label: 'Heatmap', icon: Grid3x3, component: HeatmapModule },
  { id: 'correlation', label: 'Correlation', icon: Network, component: CorrelationModule },
  { id: 'backtest', label: 'Backtest', icon: FlaskConical, component: BacktestModule },
  { id: 'journal', label: 'Journal', icon: BookOpen, component: JournalModule },
  { id: 'charts', label: 'Charts', icon: ChartCandlestick, component: ChartsModule },
  { id: 'markets', label: 'Markets', icon: Coins, component: MarketsModule },
  { id: 'fx', label: 'FX Desk', icon: Banknote, component: FxModule },
  { id: 'indices', label: 'Indices', icon: Activity, component: IndicesModule },
  { id: 'commodities', label: 'Commodities', icon: Fuel, component: CommoditiesModule },
  { id: 'futures', label: 'Futures', icon: CandlestickChart, component: FuturesModule },
  { id: 'etfs', label: 'ETFs', icon: Layers, component: EtfsModule },
  { id: 'coins', label: 'Coins', icon: CircleDollarSign, component: CoinsModule },
  { id: 'stocks', label: 'Stocks', icon: LineChart, component: StocksModule },
  { id: 'fundamentals', label: 'Fundamentals', icon: Building2, component: FundamentalsModule },
  { id: 'financials', label: 'Financials', icon: Landmark, component: FinancialsModule },
  { id: 'options', label: 'Options Flow', icon: Sigma, component: OptionsModule },
  { id: 'filings', label: 'SEC Filings', icon: FileText, component: FilingsModule },
  { id: 'derivatives', label: 'Derivatives', icon: Activity, component: DerivativesModule },
  { id: 'cryptooptions', label: 'Crypto Options', icon: Spline, component: CryptoOptionsModule },
  { id: 'flow', label: 'Liquidations', icon: Zap, component: FlowModule },
  { id: 'orderbook', label: 'Order Book', icon: BookOpenCheck, component: OrderBookModule },
  { id: 'onchain', label: 'On-chain', icon: Boxes, component: OnchainModule },
  { id: 'dex', label: 'DEX Screener', icon: ArrowLeftRight, component: DexModule },
  { id: 'defi', label: 'DeFi Desk', icon: Vault, component: DefiModule },
  { id: 'news', label: 'News', icon: Newspaper, component: NewsModule },
  { id: 'tv', label: 'Live TV', icon: Tv, component: TvModule },
  { id: 'social', label: 'X Pulse', icon: AtSign, component: SocialModule },
  { id: 'ai', label: 'AI Mentor', icon: Sparkles, component: AiModule },
  { id: 'research', label: 'Research Team', icon: Users, component: ResearchModule },
  { id: 'analyst', label: 'Analyst', icon: Brain, component: AnalystModule },
  { id: 'playbook', label: 'Playbook', icon: BookMarked, component: PlaybookModule },
  { id: 'alerts', label: 'Alerts', icon: Bell, component: AlertsModule },
  { id: 'toolkit', label: 'Toolkit', icon: Calculator, component: ToolkitModule },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, component: CalendarModule },
  { id: 'canvas', label: 'Workspace', icon: LayoutGrid, component: WidgetCanvas },
  { id: 'apps', label: 'Apps', icon: AppWindow, component: AppsGallery },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsModule }
]
