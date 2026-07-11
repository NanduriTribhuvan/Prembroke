/**
 * IndicatorBuilder — AI-powered custom indicator creation.
 *
 * The user describes an indicator in natural language; we route the description
 * through `askAI` with a schema-aware system prompt, then validate the response
 * with `parseIndicatorDefinition`. Valid definitions are persisted to the
 * indicators store and immediately available for rendering.
 *
 * @module charts/IndicatorBuilder
 */

import { useState, useCallback, useRef, type FormEvent } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { askAI } from '@/lib/ai'
import { parseIndicatorDefinition } from '@shared/sandbox/schema'
import { useIndicators } from '@/stores/indicators'

// ---------------------------------------------------------------------------
// System prompt — teaches the AI model the exact IndicatorDefinition schema
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an indicator definition generator for a trading terminal.
You MUST respond with ONLY a valid JSON object matching the IndicatorDefinition schema below. No explanation, no markdown fences, no commentary — just the JSON object.

## Schema (schemaVersion: 1)

\`\`\`
{
  "schemaVersion": 1,
  "name": string,            // display name
  "target": "overlay" | "subpane",  // overlay draws on price pane, subpane gets its own pane
  "params": [                // declared numeric parameters
    { "name": string, "default": number, "min"?: number, "max"?: number }
  ],
  "outputs": [               // one or more output lines
    { "label": string, "color"?: string, "expr": Expr }
  ]
}
\`\`\`

## Expr node types

- \`{ "t": "num", "value": <number> }\` — numeric literal
- \`{ "t": "param", "name": "<paramName>" }\` — references a declared parameter
- \`{ "t": "series", "name": "<seriesName>" }\` — an OHLCV input series
- \`{ "t": "op", "op": "<operator>", "a": Expr, "b": Expr }\` — binary arithmetic
- \`{ "t": "call", "fn": "<primitiveFn>", "args": [Expr, ...] }\` — primitive function call

## Available series names
open, high, low, close, volume, hlc3, ohlc4

## Available primitive functions
sma, ema, rsi, atr, stdev, highest, lowest, abs, max, min, clamp, shift

## Available binary operators
+, -, *, /

## Rules
- Return ONLY valid JSON. No text before or after.
- All numbers must be finite (no NaN, no Infinity).
- Parameter names must be unique.
- At least one output is required.
- Only use series names, primitives, and operators from the lists above.`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attempt to extract a JSON object from the AI response text. */
function extractJson(text: string): unknown {
  // Try parsing directly first
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Try extracting from markdown code fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim())
      } catch {
        // fall through
      }
    }
    // Try finding the first { ... } block
    const braceStart = trimmed.indexOf('{')
    const braceEnd = trimmed.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(trimmed.slice(braceStart, braceEnd + 1))
      } catch {
        // give up
      }
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FeedbackEntry {
  type: 'success' | 'error'
  message: string
}

export function IndicatorBuilder(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackEntry | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const add = useIndicators((s) => s.add)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const description = input.trim()
      if (!description || loading) return

      setLoading(true)
      setFeedback(null)
      setRawResponse(null)

      try {
        const result = await askAI({
          system: SYSTEM_PROMPT,
          prompt: description
        })

        if (!result.ok) {
          setFeedback({ type: 'error', message: `AI error: ${result.text}` })
          setLoading(false)
          return
        }

        setRawResponse(result.text)

        const parsed = extractJson(result.text)
        if (parsed === null) {
          setFeedback({
            type: 'error',
            message: 'AI returned invalid JSON. Try rephrasing your description.'
          })
          setLoading(false)
          return
        }

        const validated = parseIndicatorDefinition(parsed)
        if (!validated.ok) {
          setFeedback({ type: 'error', message: `Parse error: ${validated.error}` })
          setLoading(false)
          return
        }

        add(validated.value)
        setFeedback({
          type: 'success',
          message: `Added "${validated.value.name}" (${validated.value.target})`
        })
        setInput('')
      } catch (err) {
        setFeedback({
          type: 'error',
          message: `Unexpected error: ${(err as Error).message}`
        })
      } finally {
        setLoading(false)
      }
    },
    [input, loading, add]
  )

  return (
    <div className="flex flex-col gap-2 rounded border border-edge bg-panel p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[length:var(--text-caption)] text-muted">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span className="font-medium">AI Indicator Builder</span>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe an indicator… e.g. 'RSI with 14-period, overbought at 70'"
          disabled={loading}
          className="num flex-1 rounded border border-edge bg-bg px-2 py-1.5 text-[length:var(--text-caption)] text-text placeholder:text-muted/50 outline-none focus:border-accent/50 disabled:opacity-50 t-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-1 rounded border border-edge bg-bg px-3 py-1.5 text-[length:var(--text-caption)] text-accent hover:bg-panel2 disabled:opacity-40 disabled:cursor-not-allowed t-colors"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Build
        </button>
      </form>

      {/* Feedback */}
      {feedback && (
        <div
          className={
            feedback.type === 'success'
              ? 'flex items-start gap-1.5 rounded border border-green-800/30 bg-green-950/20 px-2 py-1.5 text-[length:var(--text-caption)] text-green-400'
              : 'flex items-start gap-1.5 rounded border border-red-800/30 bg-red-950/20 px-2 py-1.5 text-[length:var(--text-caption)] text-red-400'
          }
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="num break-all">{feedback.message}</span>
        </div>
      )}

      {/* Raw response (collapsed, monospace — useful for debugging) */}
      {rawResponse && feedback?.type === 'error' && (
        <details className="rounded border border-edge bg-bg">
          <summary className="cursor-pointer px-2 py-1 text-[length:var(--text-caption)] text-muted hover:text-text t-colors">
            Raw AI response
          </summary>
          <pre className="num max-h-32 overflow-auto whitespace-pre-wrap px-2 py-1.5 text-[length:var(--text-caption)] text-muted">
            {rawResponse}
          </pre>
        </details>
      )}
    </div>
  )
}
