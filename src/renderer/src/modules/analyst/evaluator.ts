// ─── Evaluator ────────────────────────────────────────────────────────────────
// Takes gathered evidence (AnalysisContext) and the original goal, sends to AI,
// and parses the structured verdict.

import type { AnalysisContext, TradePlanVerdict, Verdict } from './types'

// ─── AI Request/Result interfaces ────────────────────────────────────────────

export interface AiRequest {
  system: string
  prompt: string
}

export interface AiResult {
  ok: boolean
  text: string
}

// ─── Deps ────────────────────────────────────────────────────────────────────

export interface EvaluatorDeps {
  askAI: (req: AiRequest) => Promise<AiResult>
  canAsk: () => boolean
  record: () => void
}

// ─── System Prompt ───────────────────────────────────────────────────────────

export const EVALUATION_SYSTEM = `You are the Evaluator for an autonomous trading analysis agent.
Given the original goal and gathered evidence, determine if the goal is satisfied.

Respond with ONLY valid JSON in this exact shape:
{
  "satisfied": true/false,
  "confidence": 0-100,
  "recommendation": "YES" | "NO" | "WAIT",
  "score": 0-100,
  "grade": "A+" | "A" | "B" | "C" | "skip",
  "verdict": "your synthesis text",
  "plan": { "entry": number|null, "stop": number|null, "target": number|null, "rr": number|null } | null,
  "factors": { "bullish": ["..."], "bearish": ["..."] },
  "risks": ["..."],
  "missingData": ["..."] | null,
  "nextSteps": ["..."] | null
}

Rules:
- recommendation is YES (take the trade), NO (avoid), or WAIT (not yet / insufficient).
- If not satisfied, provide nextSteps describing what additional data would help.
- confidence is your certainty in the verdict (0-100).
- score is the conviction score for the setup (0-100).
- Be decisive. Traders need clear signals, not hedging.`

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_RECOMMENDATIONS = ['YES', 'NO', 'WAIT'] as const
const VALID_GRADES = ['A+', 'A', 'B', 'C', 'skip'] as const

// ─── Helper Functions ────────────────────────────────────────────────────────

export function parseTradePlan(val: unknown): TradePlanVerdict | null {
  if (val === null || val === undefined) return null
  if (typeof val !== 'object') return null

  const obj = val as Record<string, unknown>

  const entry = typeof obj.entry === 'number' ? obj.entry : null
  const stop = typeof obj.stop === 'number' ? obj.stop : null
  const target = typeof obj.target === 'number' ? obj.target : null
  const rr = typeof obj.rr === 'number' ? obj.rr : null

  // If all fields are null, treat as no plan
  if (entry === null && stop === null && target === null && rr === null) return null

  return { entry, stop, target, rr }
}

export function parseFactors(val: unknown): { bullish: string[]; bearish: string[] } {
  const empty = { bullish: [] as string[], bearish: [] as string[] }
  if (val === null || val === undefined || typeof val !== 'object') return empty

  const obj = val as Record<string, unknown>
  const bullish = Array.isArray(obj.bullish)
    ? obj.bullish.filter((x): x is string => typeof x === 'string')
    : []
  const bearish = Array.isArray(obj.bearish)
    ? obj.bearish.filter((x): x is string => typeof x === 'string')
    : []

  return { bullish, bearish }
}

export function parseOptionalStringArray(val: unknown): string[] | null {
  if (val === null || val === undefined) return null
  if (!Array.isArray(val)) return null
  const filtered = val.filter((x): x is string => typeof x === 'string')
  return filtered.length > 0 ? filtered : null
}

// ─── Verdict Parser ──────────────────────────────────────────────────────────

export function parseVerdict(raw: string): Verdict | null {
  let parsed: unknown
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>

  // Validate required fields
  if (typeof obj.satisfied !== 'boolean') return null
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) return null
  if (!(VALID_RECOMMENDATIONS as readonly string[]).includes(String(obj.recommendation))) return null
  if (typeof obj.score !== 'number' || obj.score < 0 || obj.score > 100) return null
  if (!(VALID_GRADES as readonly string[]).includes(String(obj.grade))) return null
  if (typeof obj.verdict !== 'string') return null

  return {
    satisfied: obj.satisfied,
    confidence: obj.confidence,
    recommendation: obj.recommendation as Verdict['recommendation'],
    score: obj.score,
    grade: obj.grade as Verdict['grade'],
    verdict: obj.verdict,
    plan: parseTradePlan(obj.plan),
    factors: parseFactors(obj.factors),
    risks: Array.isArray(obj.risks)
      ? obj.risks.filter((r): r is string => typeof r === 'string')
      : [],
    missingData: parseOptionalStringArray(obj.missingData),
    nextSteps: parseOptionalStringArray(obj.nextSteps)
  }
}

// ─── Evaluate Function ───────────────────────────────────────────────────────

export async function evaluate(
  goal: string,
  context: AnalysisContext,
  deps: EvaluatorDeps,
  signal: AbortSignal
): Promise<{ ok: true; verdict: Verdict } | { ok: false; error: string }> {
  if (signal.aborted) return { ok: false, error: 'Cancelled.' }
  if (!deps.canAsk()) return { ok: false, error: 'AI rate limit reached.' }

  const evidence = context.steps
    .map(
      (s) =>
        `[${s.tool}] ${s.purpose}: ${s.result.ok ? JSON.stringify(s.result.data) : `ERROR: ${s.result.error}`}`
    )
    .join('\n')

  deps.record()
  const res = await deps.askAI({
    system: EVALUATION_SYSTEM,
    prompt: `GOAL: ${goal}\n\nEVIDENCE:\n${evidence}`
  })

  if (!res.ok || !res.text.trim()) return { ok: false, error: 'Evaluation failed: no AI response.' }

  const verdict = parseVerdict(res.text)
  if (!verdict) return { ok: false, error: 'Evaluation failed: invalid verdict structure.' }

  return { ok: true, verdict }
}
