/**
 * AnalystModule — the Agentic Analyst UI panel.
 *
 * Composes goal input, quick mode buttons, progress display, and
 * structured verdict rendering into a BONDA1-compliant module shell.
 *
 * @module analyst
 */

import { useState, useRef, useCallback } from 'react'
import { Brain, X, Zap, Search, Shield, Activity } from 'lucide-react'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { useView } from '@/stores/view'
import { useAiLimit } from '@/stores/ailimit'
import { useAnalyst } from '@/stores/analyst'
import { askAI, askAIStream } from '@/lib/ai'
import { plan } from './planner'
import { execute } from './executor'
import { evaluate } from './evaluator'
import { registry } from './tools'
import { runLoop, type LoopDeps } from './loop'
import type { AgentState, AgentPhase, Verdict } from './types'

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_STATE: AgentState = {
  phase: 'idle',
  goal: '',
  iteration: 1,
  maxIterations: 3,
  currentStep: 0,
  totalSteps: 0,
  context: null,
  verdict: null,
  error: null,
  startedAt: null
}

const RUNNING_PHASES: AgentPhase[] = ['planning', 'executing', 'evaluating', 'looping']

// ─── Quick Mode Templates ────────────────────────────────────────────────────

interface QuickMode {
  label: string
  icon: typeof Zap
  template: (symbol: string) => string
}

const QUICK_MODES: QuickMode[] = [
  {
    label: 'Quick Read',
    icon: Zap,
    template: (s) =>
      `Quick read on ${s}: conviction + price + funding + news risk. Give a 10-second verdict.`
  },
  {
    label: 'Deep Dive',
    icon: Search,
    template: (s) =>
      `Deep dive on ${s}: full multi-factor analysis with conviction, derivatives, on-chain, correlation, and news. Be thorough.`
  },
  {
    label: 'Scan',
    icon: Activity,
    template: () =>
      `Scan the market: find the top 3 setups right now with the highest conviction scores.`
  },
  {
    label: 'Risk Check',
    icon: Shield,
    template: (s) =>
      `Risk check for ${s}: derivatives exposure, correlation risk, calendar events, and news threats.`
  }
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnalystModule(): React.JSX.Element {
  const symbol = useView((s) => s.convictionSymbol) || 'BTCUSDT'
  const addVerdict = useAnalyst((s) => s.addVerdict)

  // Local state
  const [state, setState] = useState<AgentState>(INITIAL_STATE)
  const [goalInput, setGoalInput] = useState('')
  const [validationError, setValidationError] = useState('')
  const controllerRef = useRef<AbortController | null>(null)

  const isRunning = RUNNING_PHASES.includes(state.phase)

  // ── Submit handler ──

  const handleSubmit = useCallback(async () => {
    const trimmed = goalInput.trim()
    if (!trimmed) {
      setValidationError('Enter a goal to analyze.')
      setTimeout(() => setValidationError(''), 2500)
      return
    }
    if (isRunning) return

    setValidationError('')
    const controller = new AbortController()
    controllerRef.current = controller

    const { canAsk, record } = useAiLimit.getState()

    const deps: LoopDeps = {
      plan,
      execute,
      evaluate,
      registry,
      askAI,
      askAIStream,
      canAsk,
      record,
      onStateChange: (next) => setState({ ...next })
    }

    const finalState = await runLoop(trimmed, deps)
    setState({ ...finalState })
    controllerRef.current = null

    // Persist if we got a verdict
    if (finalState.verdict) {
      addVerdict({
        id: crypto.randomUUID(),
        goal: trimmed,
        verdict: finalState.verdict,
        timestamp: Date.now(),
        symbol,
        toolsUsed: finalState.context?.steps.map((s) => s.tool) ?? [],
        iterations: finalState.iteration
      })
    }
  }, [goalInput, isRunning, symbol, addVerdict])

  // ── Cancel ──

  const handleCancel = useCallback(() => {
    controllerRef.current?.abort()
    setState((prev) => ({ ...prev, phase: 'cancelled' }))
  }, [])

  // ── Quick mode fill ──

  const handleQuickMode = useCallback(
    (template: (s: string) => string) => {
      if (isRunning) return
      setGoalInput(template(symbol))
    },
    [isRunning, symbol]
  )

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader icon={Brain} title="Analyst" badge="agentic" />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── 8.1: Goal Input ── */}
        <div className="space-y-2">
          <textarea
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="What do you want to know?"
            disabled={isRunning}
            rows={3}
            className="num w-full resize-none rounded-sm border border-edge bg-panel2 px-3 py-2 text-sm text-text placeholder:text-muted outline-none focus:border-accent/50 disabled:opacity-50 t-colors"
          />
          {validationError && (
            <p className="text-xs text-down">{validationError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isRunning || !goalInput.trim()}
            className="rounded-sm bg-accent-soft px-4 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed t-colors"
          >
            Analyze
          </button>
        </div>

        {/* ── 8.2: Quick Mode Buttons ── */}
        <div className="flex flex-wrap gap-1">
          {QUICK_MODES.map((mode) => {
            const Icon = mode.icon
            return (
              <button
                key={mode.label}
                type="button"
                onClick={() => handleQuickMode(mode.template)}
                disabled={isRunning}
                className="flex items-center gap-1.5 rounded-sm border border-edge px-2.5 py-1.5 text-xs text-muted hover:text-text hover:bg-panel2 disabled:opacity-40 disabled:cursor-not-allowed t-colors"
              >
                <Icon size={12} strokeWidth={2} />
                {mode.label}
              </button>
            )
          })}
        </div>

        {/* ── 8.3: Progress Display ── */}
        {isRunning && (
          <div className="flex items-center gap-3 rounded-sm border border-edge bg-panel p-2.5">
            <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              {state.phase}
            </span>
            <span className="num text-xs text-muted">
              Step {state.currentStep}/{state.totalSteps}
            </span>
            {state.iteration > 1 && (
              <span className="num text-xs text-muted">
                Iteration {state.iteration}/{state.maxIterations}
              </span>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="ml-auto rounded p-1 text-muted hover:text-down t-colors"
              title="Cancel"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ── Error display ── */}
        {state.phase === 'error' && state.error && (
          <div className="rounded-sm border border-down/30 bg-down/5 p-2.5 text-xs text-down">
            {state.error}
          </div>
        )}

        {/* ── Timeout / Cancelled ── */}
        {state.phase === 'timeout' && (
          <div className="rounded-sm border border-warn/30 bg-warn/5 p-2.5 text-xs text-warn">
            Analysis timed out (60s). Partial results may be shown below.
          </div>
        )}
        {state.phase === 'cancelled' && (
          <div className="rounded-sm border border-edge bg-panel p-2.5 text-xs text-muted">
            Analysis cancelled.
          </div>
        )}

        {/* ── 8.4: Structured Verdict Rendering ── */}
        {state.phase === 'done' && state.verdict && (
          <VerdictDisplay verdict={state.verdict} />
        )}
      </div>
    </div>
  )
}

// ─── Verdict Sub-Component ───────────────────────────────────────────────────

function VerdictDisplay({ verdict }: { verdict: Verdict }): React.JSX.Element {
  const recColor =
    verdict.recommendation === 'YES'
      ? 'text-up'
      : verdict.recommendation === 'NO'
        ? 'text-down'
        : 'text-warn'

  return (
    <div className="space-y-2">
      {/* Recommendation badge */}
      <div className="rounded-sm border border-edge bg-panel p-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Recommendation
        </span>
        <p className={`mt-1 text-lg font-bold ${recColor}`}>
          {verdict.recommendation}
        </p>
      </div>

      {/* Score / Grade / Confidence row */}
      <div className="flex gap-3 rounded-sm border border-edge bg-panel p-2.5">
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">Score</span>
          <p className="num text-sm font-semibold text-text">{verdict.score}/100</p>
        </div>
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">Grade</span>
          <p className="num text-sm font-semibold text-text">{verdict.grade}</p>
        </div>
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">Confidence</span>
          <p className="num text-sm font-semibold text-text">{verdict.confidence}%</p>
        </div>
      </div>

      {/* Trade Plan */}
      {verdict.plan && (
        <div className="rounded-sm border border-edge bg-panel p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Trade Plan
          </span>
          <div className="mt-1 grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-muted">Entry</span>
              <p className="num font-medium text-text">
                {verdict.plan.entry?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-muted">Stop</span>
              <p className="num font-medium text-down">
                {verdict.plan.stop?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-muted">Target</span>
              <p className="num font-medium text-up">
                {verdict.plan.target?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-muted">R:R</span>
              <p className="num font-medium text-text">
                {verdict.plan.rr != null ? `${verdict.plan.rr.toFixed(1)}R` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Factors */}
      {(verdict.factors.bullish.length > 0 || verdict.factors.bearish.length > 0) && (
        <div className="rounded-sm border border-edge bg-panel p-2.5 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Factors
          </span>
          {verdict.factors.bullish.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-up">Bullish</span>
              <ul className="mt-0.5 space-y-0.5">
                {verdict.factors.bullish.map((f, i) => (
                  <li key={i} className="text-xs text-text">
                    • {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {verdict.factors.bearish.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-down">Bearish</span>
              <ul className="mt-0.5 space-y-0.5">
                {verdict.factors.bearish.map((f, i) => (
                  <li key={i} className="text-xs text-text">
                    • {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Risks */}
      {verdict.risks.length > 0 && (
        <div className="rounded-sm border border-edge bg-panel p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Risks
          </span>
          <ul className="mt-1 space-y-0.5">
            {verdict.risks.map((r, i) => (
              <li key={i} className="text-xs text-text">
                • {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verdict text */}
      <div className="rounded-sm border border-edge bg-panel p-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Verdict
        </span>
        <p className="num mt-1 text-xs leading-relaxed text-text whitespace-pre-wrap">
          {verdict.verdict}
        </p>
      </div>
    </div>
  )
}
