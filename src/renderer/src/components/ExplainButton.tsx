import { useState } from 'react'
import clsx from 'clsx'
import { Sparkles, Loader2 } from 'lucide-react'
import { findConcepts } from '@/modules/playbook/concepts'
import { useAiLimit } from '@/stores/ailimit'
import { askAI, providerLabel, type AiProviderId } from '@/lib/ai'

/**
 * The "explain, don't just show" feature. Sends a compact data context to the
 * unified AI router (free cloud models or a local engine) with a hedge-fund
 * analyst prompt and renders the interpretation. Reused across modules
 * (fundamentals, financials, conviction…).
 */
export default function ExplainButton({
  title,
  context,
  question,
  className
}: {
  title: string
  /** Plain-text data context (the numbers to interpret). */
  context: string
  /** What to ask about it. */
  question: string
  className?: string
}): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const [via, setVia] = useState<AiProviderId | 'none' | null>(null)

  const run = async (): Promise<void> => {
    setLoading(true)
    setText(null)
    setErr(false)
    setVia(null)
    if (!useAiLimit.getState().canAsk()) {
      setErr(true)
      setText('Hourly AI limit reached — raise it in Settings → AI usage.')
      setLoading(false)
      return
    }
    try {
      const kb = findConcepts(`${title} ${question}`, 2)
      const knowledge = kb.length
        ? `Reference:\n${kb.map((c) => `• ${c.name}: ${c.summary}`).join('\n')}\n\n`
        : ''
      const system =
        'You are a senior buy-side analyst inside Prembroke. Interpret the data for a trader — ' +
        'explain what it MEANS, how it compares to typical/historical norms, the bull and bear read, ' +
        'and what to watch. Be specific and concise (no generic definitions, no disclaimers).'
      const prompt = `${knowledge}${title}\n${context}\n\nQuestion: ${question}`
      useAiLimit.getState().record()
      const res = await askAI({ system, prompt })
      setText(res.text)
      setErr(!res.ok)
      setVia(res.ok ? res.provider : null)
    } catch (e) {
      setErr(true)
      setText((e as Error).message)
    }
    setLoading(false)
  }

  return (
    <div className={className}>
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-sm bg-gold/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-gold/30 disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? 'Analysing…' : 'Explain with AI'}
      </button>
      {text && (
        <div
          className={clsx(
            'mt-2 whitespace-pre-wrap rounded-sm border p-3 text-[13px] leading-relaxed',
            err ? 'border-warn/30 bg-warn/10 text-warn' : 'border-edge bg-panel text-text'
          )}
        >
          {text}
          {via && via !== 'none' && (
            <div className="mt-2 text-[10px] uppercase tracking-wider text-muted">via {providerLabel(via)}</div>
          )}
        </div>
      )}
    </div>
  )
}
