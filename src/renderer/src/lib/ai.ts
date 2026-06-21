/**
 * Prembroke unified AI router — the single entry point every AI feature calls.
 *
 * One `askAI()` tries providers in a preferred order and returns the first
 * usable answer, so the "AI Chief Investment Officer" thesis works out of the
 * box: paste any one free key (Groq / Gemini / Cerebras / OpenRouter) OR run a
 * local model (Ollama / Hermes) and every Explain button, the Mentor, the
 * Conviction devil's-advocate and the Research Team light up.
 *
 * Local providers go through `window.api.ai.*`; cloud providers go through
 * `window.api.ai.cloud.ask` (main process — see src/main/cloudai.ts).
 */
import { useKeys, type ApiKeys } from '@/stores/keys'
import { useAiConfig } from '@/stores/ai'

export type CloudId = 'groq' | 'cerebras' | 'gemini' | 'openrouter'
export type AiProviderId = CloudId | 'ollama' | 'hermes'

export interface CloudMeta {
  id: CloudId
  label: string
  /** Where to get a free key. */
  url: string
  defaultModel: string
  note: string
}

/** Static metadata for the free cloud providers (order = default preference). */
export const CLOUD_PROVIDERS: CloudMeta[] = [
  {
    id: 'groq',
    label: 'Groq',
    url: 'https://console.groq.com/keys',
    defaultModel: 'llama-3.3-70b-versatile',
    note: 'Fastest free 70B'
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    url: 'https://cloud.cerebras.ai/',
    defaultModel: 'llama-3.3-70b',
    note: 'Ultra-fast inference'
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    url: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-2.0-flash',
    note: 'Generous free tier'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    url: 'https://openrouter.ai/keys',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    note: 'Many free models'
  }
]

const CLOUD_KEY_FIELD: Record<CloudId, keyof ApiKeys> = {
  groq: 'groq',
  cerebras: 'cerebras',
  gemini: 'gemini',
  openrouter: 'openrouter'
}

const PROVIDER_LABEL: Record<AiProviderId, string> = {
  groq: 'Groq',
  cerebras: 'Cerebras',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  hermes: 'Hermes'
}

/** Built-in fallback order: fast free cloud first, then private local engines. */
const DEFAULT_ORDER: AiProviderId[] = ['groq', 'cerebras', 'gemini', 'openrouter', 'ollama', 'hermes']

export interface ResolvedProvider {
  id: AiProviderId
  label: string
  kind: 'cloud' | 'local'
  model?: string
}

export interface AiRequest {
  /** System / role framing (sent as a true system message to cloud providers). */
  system?: string
  /** The user content. */
  prompt: string
}

export interface AiResult {
  ok: boolean
  text: string
  provider: AiProviderId | 'none'
}

// ---- local provider detection (cached briefly to avoid IPC spam) -----------

interface LocalStatus {
  ollama: { running: boolean; models: string[] }
  hermes: boolean
}
let localCache: { at: number; value: LocalStatus } | null = null

async function localStatus(): Promise<LocalStatus> {
  if (localCache && Date.now() - localCache.at < 15_000) return localCache.value
  const [hermes, ollama] = await Promise.all([
    window.api.ai.status().catch(() => ({ installed: false, path: null })),
    window.api.ai.ollama.status().catch(() => ({ running: false, models: [] as string[] }))
  ])
  const value: LocalStatus = { ollama, hermes: hermes.installed }
  localCache = { at: Date.now(), value }
  return value
}

/** Force re-detection of local engines (call after the user installs Ollama). */
export function invalidateAiCache(): void {
  localCache = null
}

function orderedIds(primaryOverride?: AiProviderId | 'auto'): AiProviderId[] {
  const primary = primaryOverride ?? useAiConfig.getState().primary
  if (!primary || primary === 'auto') return DEFAULT_ORDER
  return [primary, ...DEFAULT_ORDER.filter((x) => x !== primary)]
}

function modelFor(id: CloudId): string {
  const override = useAiConfig.getState().models[id]
  return override || CLOUD_PROVIDERS.find((p) => p.id === id)!.defaultModel
}

/** Every provider currently usable, in the active preference order. */
export async function listProviders(): Promise<ResolvedProvider[]> {
  const keys = useKeys.getState()
  const local = await localStatus()
  const out: ResolvedProvider[] = []
  for (const id of orderedIds()) {
    if (id === 'ollama') {
      if (local.ollama.running && local.ollama.models[0]) {
        out.push({ id, label: `Ollama · ${local.ollama.models[0]}`, kind: 'local', model: local.ollama.models[0] })
      }
    } else if (id === 'hermes') {
      if (local.hermes) out.push({ id, label: 'Hermes (Nous)', kind: 'local' })
    } else if (keys[CLOUD_KEY_FIELD[id]]) {
      out.push({ id, label: PROVIDER_LABEL[id], kind: 'cloud', model: modelFor(id) })
    }
  }
  return out
}

async function callOne(
  id: AiProviderId,
  req: AiRequest,
  ctx: { ollamaModel?: string; key: string }
): Promise<{ ok: boolean; text: string }> {
  const joined = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt
  if (id === 'ollama') return window.api.ai.ollama.ask(joined, ctx.ollamaModel ?? '')
  if (id === 'hermes') return window.api.ai.ask(joined)
  return window.api.ai.cloud.ask({
    provider: id,
    model: modelFor(id),
    key: ctx.key,
    system: req.system,
    prompt: req.prompt
  })
}

/**
 * Ask the AI. Tries providers in the active order until one answers.
 * Does NOT enforce the hourly rate-limit — callers gate with `useAiLimit`.
 */
export async function askAI(req: AiRequest, opts?: { primary?: AiProviderId | 'auto' }): Promise<AiResult> {
  const keys = useKeys.getState()
  const local = await localStatus()
  let last: AiResult | null = null

  for (const id of orderedIds(opts?.primary)) {
    let key = ''
    if (id === 'ollama') {
      if (!(local.ollama.running && local.ollama.models[0])) continue
    } else if (id === 'hermes') {
      if (!local.hermes) continue
    } else {
      key = keys[CLOUD_KEY_FIELD[id]]
      if (!key) continue
    }

    try {
      const res = await callOne(id, req, { ollamaModel: local.ollama.models[0], key })
      if (res.ok && res.text.trim()) return { ok: true, text: res.text, provider: id }
      last = { ok: false, text: res.text, provider: id }
    } catch (e) {
      last = { ok: false, text: (e as Error).message, provider: id }
    }
  }

  if (last) return last
  return {
    ok: false,
    text: 'No AI engine available. Add a free key in Settings → AI engine (Groq, Gemini, Cerebras or OpenRouter), or install Ollama / Hermes.',
    provider: 'none'
  }
}

/**
 * Streaming variant of {@link askAI}. Invokes `onDelta` with each text chunk as
 * it arrives. Cloud providers + Ollama stream natively; Hermes (no stream
 * transport) falls back to a single final chunk. Same fallback chain as askAI.
 */
export async function askAIStream(
  req: AiRequest,
  onDelta: (delta: string) => void,
  opts?: { primary?: AiProviderId | 'auto' }
): Promise<AiResult> {
  const keys = useKeys.getState()
  const local = await localStatus()
  let last: AiResult | null = null

  for (const id of orderedIds(opts?.primary)) {
    let key = ''
    if (id === 'ollama') {
      if (!(local.ollama.running && local.ollama.models[0])) continue
    } else if (id === 'hermes') {
      if (!local.hermes) continue
    } else {
      key = keys[CLOUD_KEY_FIELD[id]]
      if (!key) continue
    }

    try {
      if (id === 'hermes') {
        const joined = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt
        const res = await window.api.ai.ask(joined)
        if (res.ok && res.text.trim()) {
          onDelta(res.text)
          return { ok: true, text: res.text, provider: id }
        }
        last = { ok: false, text: res.text, provider: id }
      } else {
        const model = id === 'ollama' ? (local.ollama.models[0] ?? '') : modelFor(id)
        const res = await window.api.ai.stream(
          { provider: id, model, key, system: req.system, prompt: req.prompt },
          onDelta
        )
        if (res.ok && res.text.trim()) return { ok: true, text: res.text, provider: id }
        last = { ok: false, text: res.text, provider: id }
      }
    } catch (e) {
      last = { ok: false, text: (e as Error).message, provider: id }
    }
  }

  if (last) return last
  return {
    ok: false,
    text: 'No AI engine available. Add a free key in Settings → AI engine, or install Ollama / Hermes.',
    provider: 'none'
  }
}

/** Human label for a provider id (for "via Groq" captions). */
export function providerLabel(id: AiProviderId | 'none'): string {
  return id === 'none' ? 'none' : PROVIDER_LABEL[id]
}
