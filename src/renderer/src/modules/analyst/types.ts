// ─── Tool Names ──────────────────────────────────────────────────────────────

export const TOOL_NAMES = [
  'conviction', 'indicators', 'price', 'candles', 'funding',
  'news', 'calendar', 'onchain', 'dex', 'options',
  'fundamentals', 'correlation', 'scanner', 'explain'
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export function isToolName(v: unknown): v is ToolName {
  return typeof v === 'string' && (TOOL_NAMES as readonly string[]).includes(v)
}

// ─── Tool Adapter ────────────────────────────────────────────────────────────

/** Uniform result envelope returned by every tool adapter. */
export interface ToolResult {
  ok: boolean
  data: unknown
  error?: string
}

/** Signature every tool adapter implements. */
export type ToolAdapter = (args: Record<string, unknown>) => Promise<ToolResult>

/** The typed registry mapping tool names to their adapter functions. */
export type ToolRegistry = Record<ToolName, ToolAdapter>

// ─── Plan & Execution ────────────────────────────────────────────────────────

export interface ToolCall {
  tool: ToolName
  args: Record<string, unknown>
  purpose: string
}

export interface StepResult {
  tool: ToolName
  args: Record<string, unknown>
  purpose: string
  result: ToolResult
  durationMs: number
}

export interface AnalysisContext {
  goal: string
  steps: StepResult[]
  iteration: number
  startedAt: number
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

export interface TradePlanVerdict {
  entry: number | null
  stop: number | null
  target: number | null
  rr: number | null
}

export interface Verdict {
  satisfied: boolean
  confidence: number
  recommendation: 'YES' | 'NO' | 'WAIT'
  score: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'skip'
  verdict: string
  plan: TradePlanVerdict | null
  factors: { bullish: string[]; bearish: string[] }
  risks: string[]
  missingData: string[] | null
  nextSteps: string[] | null
}

// ─── Agent State Machine ─────────────────────────────────────────────────────

export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'evaluating'
  | 'looping'
  | 'done'
  | 'cancelled'
  | 'timeout'
  | 'error'

export interface AgentState {
  phase: AgentPhase
  goal: string
  iteration: number
  maxIterations: number
  currentStep: number
  totalSteps: number
  context: AnalysisContext | null
  verdict: Verdict | null
  error: string | null
  startedAt: number | null
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export interface PersistedVerdict {
  id: string
  goal: string
  verdict: Verdict
  timestamp: number
  symbol: string
  toolsUsed: ToolName[]
  iterations: number
}
