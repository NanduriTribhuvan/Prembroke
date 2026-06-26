import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Send, Loader2, AlertCircle, Cpu, GraduationCap } from 'lucide-react'
import { useTickers } from '@/ws/binance'
import { findConcepts } from '@/modules/playbook/concepts'
import { useAiLimit } from '@/stores/ailimit'
import { useView } from '@/stores/view'
import { listProviders, askAIStream, type ResolvedProvider, type AiProviderId } from '@/lib/ai'
import { ModuleHeader, SectionCard } from '@/components/ui'

interface Msg {
  role: 'user' | 'ai'
  text: string
  error?: boolean
}

const MENTOR_SYSTEM =
  'You are the Prembroke Mentor — a master coach in ICT (Inner Circle Trader), Smart Money Concepts, ' +
  'SMT, market structure, liquidity, order flow and price action, for crypto and forex. Answer ANY trading ' +
  'question precisely with correct terminology and a concrete, applicable example. Be concise and practical. ' +
  'Use the supplied knowledge-base entries when relevant. You are an educator and analyst — never give ' +
  'financial advice or signals; frame everything as analysis and learning.'

const QUICK = [
  'What is the ICT 2022 model and how do I trade it step by step?',
  'How do I tell a real BOS from a liquidity sweep?',
  'Explain SMT divergence between BTC and ETH with an example.'
]

function marketContext(tickers: { label: string; price: number; changePct: number }[]): string {
  if (tickers.length === 0) return ''
  const rows = tickers
    .map((t) => `${t.label} $${t.price} (${t.changePct >= 0 ? '+' : ''}${t.changePct.toFixed(2)}%)`)
    .join(', ')
  return `Live market snapshot (Binance 24h): ${rows}.`
}

export default function AiModule(): React.JSX.Element {
  const tickers = useTickers()
  const [providers, setProviders] = useState<ResolvedProvider[] | null>(null)
  const [selected, setSelected] = useState<AiProviderId | ''>('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const remaining = useAiLimit((s) => s.remaining())
  const perHour = useAiLimit((s) => s.perHour)
  const mentorSeed = useView((s) => s.mentorSeed)
  const clearMentorSeed = useView((s) => s.clearMentorSeed)
  const seededRef = useRef(false)

  useEffect(() => {
    listProviders().then((list) => {
      setProviders(list)
      setSelected(list[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const current = providers?.find((p) => p.id === selected)

  const ask = async (question: string): Promise<void> => {
    if (!question.trim() || busy || !current) return
    setInput('')
    if (!useAiLimit.getState().canAsk()) {
      setMessages((m) => [
        ...m,
        { role: 'user', text: question },
        {
          role: 'ai',
          text: `Hourly AI limit reached (${perHour}/hr). It refills within the hour, or raise the cap in Settings → AI usage.`,
          error: true
        }
      ])
      return
    }
    useAiLimit.getState().record()
    setMessages((m) => [...m, { role: 'user', text: question }])
    setBusy(true)
    const ctx = findConcepts(question, 3)
    const knowledge = ctx.length
      ? `Knowledge base (use if relevant):\n${ctx
          .map((c) => `• ${c.name}${c.abbrev ? ` (${c.abbrev})` : ''}: ${c.summary} How to trade: ${c.howToTrade}`)
          .join('\n')}\n\n`
      : ''
    const prompt = `${knowledge}${marketContext(tickers)}\n\nTrader question: ${question}`
    try {
      let acc = ''
      const res = await askAIStream(
        { system: MENTOR_SYSTEM, prompt },
        (delta) => {
          const first = acc === ''
          acc += delta
          setMessages((m) => {
            const copy = m.slice()
            if (first) copy.push({ role: 'ai', text: acc, error: false })
            else copy[copy.length - 1] = { role: 'ai', text: acc, error: false }
            return copy
          })
        },
        { primary: current.id }
      )
      setMessages((m) => {
        const copy = m.slice()
        if (acc === '') copy.push({ role: 'ai', text: res.text, error: !res.ok })
        else copy[copy.length - 1] = { role: 'ai', text: res.ok ? acc : res.text, error: !res.ok }
        return copy
      })
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: `Bridge error: ${(e as Error).message}`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  // Consume a question deep-linked from the Playbook ("Ask the Mentor").
  useEffect(() => {
    if (mentorSeed && current && !seededRef.current) {
      seededRef.current = true
      const q = mentorSeed
      clearMentorSeed()
      void ask(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorSeed, current])

  const noProviders = providers !== null && providers.length === 0

  return (
    <div className="flex h-full flex-col module-enter">
      <ModuleHeader
        icon={GraduationCap}
        title="AI Mentor"
        badge="ICT / SMC expert"
        actions={
          <div className="flex items-center gap-3">
            {current && (
              <div className="flex items-center gap-1.5 rounded bg-panel2 px-2 py-1">
                <Cpu size={12} className="text-accent" />
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value as AiProviderId)}
                  className="bg-transparent text-[length:var(--text-caption)] text-text outline-none"
                >
                  {providers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span
              className={clsx(
                'num text-[length:var(--text-caption)]',
                remaining > 5 ? 'text-muted' : remaining > 0 ? 'text-warn' : 'text-down'
              )}
              title="AI requests left this hour"
            >
              {remaining}/{perHour} left
            </span>
            {noProviders ? (
              <span className="flex items-center gap-1 text-[length:var(--text-caption)] text-warn">
                <AlertCircle size={12} /> No AI provider
              </span>
            ) : current ? (
              <span className="flex items-center gap-1 text-[length:var(--text-caption)] text-up">
                <span className="h-1.5 w-1.5 rounded-full bg-up" />{' '}
                {current.kind === 'local' ? 'local · free' : 'cloud · free'}
              </span>
            ) : null}
          </div>
        }
      />

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl pt-6 text-center">
            <GraduationCap size={28} className="mx-auto mb-3 text-accent/60" />
            <p className="text-sm text-muted">
              Ask anything about ICT, Smart Money Concepts, SMT, structure, liquidity, or the live
              tape. The Mentor pulls the relevant Playbook concepts into its answer.
            </p>
            {noProviders && (
              <div className="mt-4">
                <SectionCard title="No AI engine yet — pick any free option">
                  <div className="text-[length:var(--text-caption)] text-muted">
                    <b>Cloud (fastest, free):</b> grab a free key from Groq, Google Gemini, Cerebras
                    or OpenRouter and paste it in Settings → AI engine.
                    <br />
                    <b>Local (private, free):</b> install Ollama from ollama.com, run{' '}
                    <code className="num">ollama pull llama3.2:3b</code>, reopen Prembroke.
                  </div>
                </SectionCard>
              </div>
            )}
            <div className="mt-5 space-y-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={busy || !current}
                  className="t-colors block w-full rounded-sm border border-edge bg-panel px-3 py-2 text-left text-xs text-text hover:border-gold/40 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={clsx(
                'max-w-[80%] whitespace-pre-wrap rounded-sm px-3 py-2 text-[13px] leading-relaxed',
                m.role === 'user'
                  ? 'bg-accent-soft text-text'
                  : m.error
                    ? 'border border-down/30 bg-down/10 text-down'
                    : 'border border-edge bg-panel text-text'
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && messages[messages.length - 1]?.role !== 'ai' && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-sm border border-edge bg-panel px-3 py-2 text-[13px] text-muted">
              <Loader2 size={14} className="animate-spin text-accent" /> Mentor is thinking…
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="flex items-center gap-2 border-t border-edge p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={noProviders ? 'Set up a free AI provider to chat…' : 'Ask the Mentor anything…'}
          disabled={busy || !current}
          className="flex-1 rounded-sm border border-edge bg-panel px-3 py-2 text-[13px] text-text outline-none focus:border-gold/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || !current}
          className="t-colors flex items-center gap-1.5 rounded-sm bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent hover:bg-gold/30 disabled:opacity-40"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  )
}
