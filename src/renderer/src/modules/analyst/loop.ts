// ─── Loop Controller ──────────────────────────────────────────────────────────
// Orchestrates the plan→execute→evaluate cycle with max iterations, timeout,
// and cancellation support.

import type { ToolRegistry, AgentState } from './types'
import type { plan as planFn } from './planner'
import type { execute as executeFn } from './executor'
import type { evaluate as evaluateFn } from './evaluator'
import type { AiRequest, AiResult } from '@/lib/ai'

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_ITERATIONS = 3
export const TIMEOUT_MS = 60_000

// ─── Dependencies ────────────────────────────────────────────────────────────

export interface LoopDeps {
  plan: typeof planFn
  execute: typeof executeFn
  evaluate: typeof evaluateFn
  registry: ToolRegistry
  askAI: (req: AiRequest) => Promise<AiResult>
  askAIStream: (req: AiRequest, onDelta: (d: string) => void) => Promise<AiResult>
  canAsk: () => boolean
  record: () => void
  onStateChange: (state: AgentState) => void
}

// ─── Loop Runner ─────────────────────────────────────────────────────────────

export async function runLoop(goal: string, deps: LoopDeps): Promise<AgentState> {
  const controller = new AbortController()
  const { signal } = controller

  const state: AgentState = {
    phase: 'planning',
    goal,
    iteration: 1,
    maxIterations: MAX_ITERATIONS,
    currentStep: 0,
    totalSteps: 0,
    context: { goal, steps: [], iteration: 1, startedAt: Date.now() },
    verdict: null,
    error: null,
    startedAt: Date.now()
  }

  // Timeout guard
  const timeout = setTimeout(() => {
    controller.abort()
    state.phase = 'timeout'
    deps.onStateChange({ ...state })
  }, TIMEOUT_MS)

  try {
    let nextSteps: string[] | undefined

    for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
      if (signal.aborted) break
      state.iteration = iter
      state.phase = 'planning'
      deps.onStateChange({ ...state })

      // 1. Plan
      const planResult = await deps.plan(
        goal,
        { askAI: deps.askAI, canAsk: deps.canAsk, record: deps.record },
        nextSteps
      )
      if (!planResult.ok) {
        state.phase = 'error'
        state.error = planResult.error
        break
      }

      // 2. Execute
      state.phase = 'executing'
      state.totalSteps = planResult.plan.length
      deps.onStateChange({ ...state })

      state.context = await deps.execute(
        planResult.plan,
        state.context!,
        { registry: deps.registry },
        signal,
        (step: number, total: number) => {
          state.currentStep = step
          state.totalSteps = total
          deps.onStateChange({ ...state })
        }
      )

      if (signal.aborted) break

      // 3. Evaluate
      state.phase = 'evaluating'
      deps.onStateChange({ ...state })

      const evalResult = await deps.evaluate(
        goal,
        state.context,
        { askAI: deps.askAI, canAsk: deps.canAsk, record: deps.record },
        signal
      )
      if (!evalResult.ok) {
        state.phase = 'error'
        state.error = evalResult.error
        break
      }

      state.verdict = evalResult.verdict
      if (evalResult.verdict.satisfied || iter >= MAX_ITERATIONS) {
        state.phase = 'done'
        break
      }

      // Loop — feed nextSteps back into the planner
      nextSteps = evalResult.verdict.nextSteps ?? undefined
      state.phase = 'looping'
      deps.onStateChange({ ...state })
    }
  } finally {
    clearTimeout(timeout)
  }

  deps.onStateChange({ ...state })
  return state
}

// ─── External Cancellation ───────────────────────────────────────────────────

/** Returns a fresh AbortController for external cancellation of a loop. */
export function createLoopController(): AbortController {
  return new AbortController()
}
