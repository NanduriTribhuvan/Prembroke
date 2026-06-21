/**
 * Unified cloud AI providers for Prembroke — all have a genuinely free tier.
 *
 * Routed through the Electron main process on purpose so that: (1) the renderer
 * CSP / browser CORS never blocks the request, (2) API keys are not exposed to
 * page-context network inspectors, and (3) four different response shapes are
 * normalised to one `{ ok, text }` contract in a single place.
 *
 * Providers (OpenAI chat-completions compatible unless noted):
 *   groq       — api.groq.com        — fastest free 70B inference
 *   cerebras   — api.cerebras.ai     — ultra-fast wafer-scale inference
 *   openrouter — openrouter.ai       — aggregates many ':free' models
 *   gemini     — generativelanguage  — Google, bespoke request/response shape
 */
import { ipcMain } from 'electron'

type CloudProviderId = 'groq' | 'cerebras' | 'openrouter' | 'gemini'

interface AskArg {
  provider: CloudProviderId
  model: string
  key: string
  system?: string
  prompt: string
}

const DEFAULT_MODEL: Record<CloudProviderId, string> = {
  groq: 'llama-3.3-70b-versatile',
  cerebras: 'llama-3.3-70b',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  gemini: 'gemini-2.0-flash'
}

const OPENAI_BASE: Record<Exclude<CloudProviderId, 'gemini'>, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  cerebras: 'https://api.cerebras.ai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
}

const TIMEOUT_MS = 60_000

async function askOpenAiCompatible(arg: AskArg, base: string): Promise<{ ok: boolean; text: string }> {
  const messages: { role: string; content: string }[] = []
  if (arg.system) messages.push({ role: 'system', content: arg.system })
  messages.push({ role: 'user', content: arg.prompt })

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(base, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arg.key}`,
        // OpenRouter asks for these for free-tier attribution; harmless elsewhere.
        'HTTP-Referer': 'https://prembroke.app',
        'X-Title': 'Prembroke'
      },
      body: JSON.stringify({
        model: arg.model || DEFAULT_MODEL[arg.provider],
        messages,
        temperature: 0.4,
        max_tokens: 1500,
        stream: false
      })
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, text: `${arg.provider} error ${res.status}: ${detail.slice(0, 240)}` }
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = j.choices?.[0]?.message?.content?.trim() ?? ''
    return text ? { ok: true, text } : { ok: false, text: `${arg.provider} returned no content.` }
  } finally {
    clearTimeout(to)
  }
}

async function askGemini(arg: AskArg): Promise<{ ok: boolean; text: string }> {
  const model = arg.model || DEFAULT_MODEL.gemini
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    `:generateContent?key=${encodeURIComponent(arg.key)}`

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: arg.system ? { parts: [{ text: arg.system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: arg.prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
      })
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, text: `gemini error ${res.status}: ${detail.slice(0, 240)}` }
    }
    const j = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const parts = j.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .map((p) => p.text ?? '')
      .join('')
      .trim()
    return text ? { ok: true, text } : { ok: false, text: 'gemini returned no content (check safety filters / quota).' }
  } finally {
    clearTimeout(to)
  }
}

// ---- streaming -------------------------------------------------------------

const OLLAMA_LOCAL = 'http://127.0.0.1:11434'

type StreamProviderId = CloudProviderId | 'ollama'

interface StreamArg {
  id: string
  provider: StreamProviderId
  model: string
  key: string
  system?: string
  prompt: string
}

/** Read a web ReadableStream line-by-line, invoking `onLine` for each full line. */
async function readLines(body: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) onLine(line)
  }
  if (buf.trim()) onLine(buf)
}

async function streamOpenAiCompatible(
  arg: StreamArg,
  base: string,
  onDelta: (d: string) => void
): Promise<{ ok: boolean; text: string }> {
  const messages: { role: string; content: string }[] = []
  if (arg.system) messages.push({ role: 'system', content: arg.system })
  messages.push({ role: 'user', content: arg.prompt })
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 120_000)
  try {
    const res = await fetch(base, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${arg.key}`,
        'HTTP-Referer': 'https://prembroke.app',
        'X-Title': 'Prembroke'
      },
      body: JSON.stringify({
        model: arg.model || DEFAULT_MODEL[arg.provider as CloudProviderId],
        messages,
        temperature: 0.4,
        max_tokens: 1500,
        stream: true
      })
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, text: `${arg.provider} error ${res.status}: ${detail.slice(0, 240)}` }
    }
    if (!res.body) return { ok: false, text: `${arg.provider}: no response stream.` }
    let full = ''
    await readLines(res.body, (line) => {
      const t = line.trim()
      if (!t.startsWith('data:')) return
      const data = t.slice(5).trim()
      if (!data || data === '[DONE]') return
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
        const delta = j.choices?.[0]?.delta?.content
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        /* partial / keep-alive line */
      }
    })
    return full.trim() ? { ok: true, text: full } : { ok: false, text: `${arg.provider} returned no content.` }
  } finally {
    clearTimeout(to)
  }
}

async function streamGemini(arg: StreamArg, onDelta: (d: string) => void): Promise<{ ok: boolean; text: string }> {
  const model = arg.model || DEFAULT_MODEL.gemini
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    `:streamGenerateContent?alt=sse&key=${encodeURIComponent(arg.key)}`
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 120_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: arg.system ? { parts: [{ text: arg.system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: arg.prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
      })
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, text: `gemini error ${res.status}: ${detail.slice(0, 240)}` }
    }
    if (!res.body) return { ok: false, text: 'gemini: no response stream.' }
    let full = ''
    await readLines(res.body, (line) => {
      const t = line.trim()
      if (!t.startsWith('data:')) return
      const data = t.slice(5).trim()
      if (!data) return
      try {
        const j = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const parts = j.candidates?.[0]?.content?.parts ?? []
        const delta = parts.map((p) => p.text ?? '').join('')
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        /* ignore */
      }
    })
    return full.trim() ? { ok: true, text: full } : { ok: false, text: 'gemini returned no content.' }
  } finally {
    clearTimeout(to)
  }
}

async function streamOllama(arg: StreamArg, onDelta: (d: string) => void): Promise<{ ok: boolean; text: string }> {
  const messages: { role: string; content: string }[] = []
  if (arg.system) messages.push({ role: 'system', content: arg.system })
  messages.push({ role: 'user', content: arg.prompt })
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 180_000)
  try {
    const res = await fetch(`${OLLAMA_LOCAL}/api/chat`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: arg.model, messages, stream: true })
    })
    if (!res.ok) return { ok: false, text: `Ollama error ${res.status}` }
    if (!res.body) return { ok: false, text: 'Ollama: no response stream.' }
    let full = ''
    await readLines(res.body, (line) => {
      const t = line.trim()
      if (!t) return
      try {
        const j = JSON.parse(t) as { message?: { content?: string } }
        const delta = j.message?.content
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        /* ignore */
      }
    })
    return full.trim() ? { ok: true, text: full } : { ok: false, text: 'Ollama returned no content.' }
  } finally {
    clearTimeout(to)
  }
}

export function registerCloudAiIpc(): void {
  ipcMain.handle('ai:cloud:ask', async (_e, arg: AskArg): Promise<{ ok: boolean; text: string }> => {
    if (!arg || typeof arg.prompt !== 'string' || !arg.prompt.trim()) {
      return { ok: false, text: 'Empty prompt.' }
    }
    if (!arg.key) return { ok: false, text: `No API key configured for ${arg.provider}.` }
    try {
      if (arg.provider === 'gemini') return await askGemini(arg)
      const base = OPENAI_BASE[arg.provider]
      if (!base) return { ok: false, text: `Unknown AI provider "${arg.provider}".` }
      return await askOpenAiCompatible(arg, base)
    } catch (e) {
      const err = e as Error
      const text = err.name === 'AbortError' ? `${arg.provider} timed out (${TIMEOUT_MS / 1000}s).` : err.message
      return { ok: false, text }
    }
  })

  // Streaming variant — pushes `{ id, delta }` chunks back over 'ai:stream:chunk'
  // to the calling renderer, and resolves with the full accumulated text.
  ipcMain.handle('ai:stream', async (event, arg: StreamArg): Promise<{ ok: boolean; text: string }> => {
    if (!arg || typeof arg.prompt !== 'string' || !arg.prompt.trim()) return { ok: false, text: 'Empty prompt.' }
    const onDelta = (delta: string): void => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:stream:chunk', { id: arg.id, delta })
    }
    try {
      if (arg.provider === 'ollama') return await streamOllama(arg, onDelta)
      if (arg.provider === 'gemini') return await streamGemini(arg, onDelta)
      if (!arg.key) return { ok: false, text: `No API key configured for ${arg.provider}.` }
      const base = OPENAI_BASE[arg.provider]
      if (!base) return { ok: false, text: `Unknown AI provider "${arg.provider}".` }
      return await streamOpenAiCompatible(arg, base, onDelta)
    } catch (e) {
      const err = e as Error
      return { ok: false, text: err.name === 'AbortError' ? `${arg.provider} timed out.` : err.message }
    }
  })
}
