import type { AiRequest, AiResult } from '@/lib/ai'
import type { ToolCall } from './types'
import { isToolName } from './types'

// ─── Planning System Prompt ──────────────────────────────────────────────────

export const PLANNING_SYSTEM = `You are the Planner for an autonomous trading analysis agent.
Given a user goal, decompose it into an ordered list of tool calls.

Available tools: conviction, indicators, price, candles, funding, news, calendar, onchain, dex, options, fundamentals, correlation, scanner, explain.

Respond with ONLY a JSON array. Each element:
{ "tool": "<tool_name>", "args": { ... }, "purpose": "<why this step>" }

Rules:
- Use the minimum steps needed. Typical: 3–6 steps.
- Always include at least one conviction or price call for symbol-specific goals.
- For scan/discovery goals, start with scanner then conviction on top results.
- Do NOT include tools not in the list above.
- args must match the tool's expected parameters (symbol, interval, filter, etc).`

// ─── Plan Parser & Validator ─────────────────────────────────────────────────

/** Parse and validate raw AI response into ToolCall[]. Returns null on any failure. */
export function parsePlan(raw: string): ToolCall[] | null {
  let parsed: unknown
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return null

  const plan: ToolCall[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) return null
    const obj = item as Record<string, unknown>
    if (!isToolName(obj.tool)) return null
    if (typeof obj.args !== 'object' || obj.args === null) return null
    if (typeof obj.purpose !== 'string') return null
    plan.push({
      tool: obj.tool,
      args: obj.args as Record<string, unknown>,
      purpose: obj.purpose
    })
  }
  return plan
}

// ─── Planner Dependencies & Function ─────────────────────────────────────────

export interface PlannerDeps {
  askAI: (req: AiRequest) => Promise<AiResult>
  canAsk: () => boolean
  record: () => void
}

export async function plan(
  goal: string,
  deps: PlannerDeps,
  previousNextSteps?: string[]
): Promise<{ ok: true; plan: ToolCall[] } | { ok: false; error: string }> {
  if (!deps.canAsk()) return { ok: false, error: 'AI rate limit reached.' }

  const prompt = previousNextSteps
    ? `Goal: ${goal}\n\nPrevious iteration suggested: ${previousNextSteps.join(', ')}\nPlan additional steps to fill these gaps.`
    : `Goal: ${goal}`

  deps.record()
  const res = await deps.askAI({ system: PLANNING_SYSTEM, prompt })
  if (!res.ok || !res.text.trim()) return { ok: false, error: 'Planning failed: no response from AI.' }

  const parsed = parsePlan(res.text)
  if (!parsed) return { ok: false, error: 'Planning failed: invalid plan structure.' }

  return { ok: true, plan: parsed }
}
