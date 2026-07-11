import type { ToolCall, ToolResult, ToolRegistry, AnalysisContext } from './types'

export interface ExecutorDeps {
  registry: ToolRegistry
}

/**
 * Invokes each ToolCall sequentially via the registry, accumulating results.
 * Error handling per-step: catch + record error, continue to next step.
 * Respects AbortSignal for cancellation.
 */
export async function execute(
  plan: ToolCall[],
  context: AnalysisContext,
  deps: ExecutorDeps,
  signal: AbortSignal,
  onStep?: (stepIndex: number, total: number) => void
): Promise<AnalysisContext> {
  for (let i = 0; i < plan.length; i++) {
    if (signal.aborted) break

    const call = plan[i]
    onStep?.(i + 1, plan.length)
    const start = Date.now()

    let result: ToolResult
    try {
      const adapter = deps.registry[call.tool]
      result = await adapter(call.args)
    } catch (e) {
      result = { ok: false, data: null, error: (e as Error).message }
    }

    context.steps.push({
      tool: call.tool,
      args: call.args,
      purpose: call.purpose,
      result,
      durationMs: Date.now() - start
    })
  }
  return context
}
