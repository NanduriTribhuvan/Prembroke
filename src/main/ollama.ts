/**
 * Local free-AI provider via Ollama (https://ollama.com). Fully offline, no key,
 * no cost. If the user has Ollama running on the default port with any model
 * pulled, Prembroke's AI Analyst can use it. Routed through main so the renderer
 * CSP (which blocks plain http) isn't in the way.
 */
import { ipcMain } from 'electron'

const OLLAMA = 'http://127.0.0.1:11434'

export interface OllamaStatus {
  running: boolean
  models: string[]
}

export function registerOllamaIpc(): void {
  ipcMain.handle('ai:ollama:status', async (): Promise<OllamaStatus> => {
    try {
      const ctrl = new AbortController()
      const to = setTimeout(() => ctrl.abort(), 2500)
      const res = await fetch(`${OLLAMA}/api/tags`, { signal: ctrl.signal })
      clearTimeout(to)
      if (!res.ok) return { running: false, models: [] }
      const j = (await res.json()) as { models?: { name: string }[] }
      return { running: true, models: (j.models ?? []).map((m) => m.name) }
    } catch {
      return { running: false, models: [] }
    }
  })

  ipcMain.handle(
    'ai:ollama:ask',
    async (_e, arg: { prompt: string; model: string }): Promise<{ ok: boolean; text: string }> => {
      if (!arg?.prompt?.trim() || !arg?.model) return { ok: false, text: 'Missing prompt or model.' }
      try {
        const ctrl = new AbortController()
        const to = setTimeout(() => ctrl.abort(), 120_000)
        const res = await fetch(`${OLLAMA}/api/chat`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: arg.model,
            messages: [{ role: 'user', content: arg.prompt }],
            stream: false
          })
        })
        clearTimeout(to)
        if (!res.ok) return { ok: false, text: `Ollama error ${res.status}` }
        const j = (await res.json()) as { message?: { content?: string } }
        const text = j.message?.content?.trim() ?? ''
        return text ? { ok: true, text } : { ok: false, text: 'Ollama returned no content.' }
      } catch (e) {
        return { ok: false, text: `Ollama unreachable: ${(e as Error).message}` }
      }
    }
  )
}
