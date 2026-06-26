/**
 * Hermes bridge for the Electron main process.
 *
 * Prembroke's AI Analyst shells out to the locally-installed Hermes Agent
 * (Nous Research) in single-shot, non-interactive mode. We deliberately do NOT
 * pass --yolo: the agent can never auto-approve a tool/computer/shell action
 * from inside Prembroke. Worst case on a stuck call is a timeout-kill.
 */
import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface AiStatus {
  installed: boolean
  path: string | null
}

/** Resolve the installed hermes.exe, honouring HERMES_HOME if the user moved it. */
function resolveHermes(): string | null {
  const candidates: string[] = []
  if (process.env.HERMES_HOME) {
    candidates.push(join(process.env.HERMES_HOME, 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'))
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      join(process.env.LOCALAPPDATA, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe')
    )
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

// Strip ANSI colour/cursor sequences the CLI may emit.
// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;?]*[ -/]*[@-~]/g

function clean(text: string): string {
  return text
    .replace(ANSI, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => !/^\s*[⠁-⣿]/.test(l)) // drop braille spinner frames
    .join('\n')
    .trim()
}

export function registerHermesIpc(): void {
  ipcMain.handle('ai:status', (): AiStatus => {
    const path = resolveHermes()
    return { installed: Boolean(path), path }
  })

  ipcMain.handle('ai:ask', async (_e, prompt: string): Promise<{ ok: boolean; text: string }> => {
    const exe = resolveHermes()
    if (!exe) {
      return {
        ok: false,
        text: 'Hermes is not installed. Run the Nous Research installer, then `hermes setup`.'
      }
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { ok: false, text: 'Empty prompt.' }
    }

    return await new Promise((resolve) => {
      // -z: single-shot prompt, --cli: force non-TUI plain output.
      const child = spawn(exe, ['-z', prompt, '--cli'], {
        windowsHide: true,
        env: { ...process.env }
      })

      let out = ''
      let err = ''
      const timer = setTimeout(() => {
        child.kill()
        resolve({
          ok: false,
          text: 'Hermes timed out (90s). Try a shorter question, or run `hermes setup` to confirm a model/key is configured.'
        })
      }, 90_000)

      child.stdout.on('data', (d) => (out += d.toString()))
      child.stderr.on('data', (d) => (err += d.toString()))

      child.on('error', (e) => {
        clearTimeout(timer)
        const msg = e.message || String(e)
        // Windows Smart App Control / WDAC blocks unsigned executables (like the
        // Hermes Python venv exe). Spawn fails with EACCES / an Application
        // Control message. Surface a specific, actionable error instead of a
        // cryptic one so the user knows it's an OS policy, not a Prembroke bug.
        const blocked =
          /application control|EACCES|not permitted|blocked this file|EPERM/i.test(msg)
        if (blocked) {
          return resolve({
            ok: false,
            text:
              'Hermes is blocked by Windows Smart App Control. Either add a free cloud key ' +
              '(Settings → AI engine: Groq, Gemini, Cerebras or OpenRouter) to use AI without ' +
              'a local model, or turn off Smart App Control in Windows Security → App & browser ' +
              'control (note: that is permanent and cannot be re-enabled without resetting the PC).'
          })
        }
        resolve({ ok: false, text: `Could not start Hermes: ${msg}` })
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        const text = clean(out) || clean(err)
        if (code === 0 && text) return resolve({ ok: true, text })
        if (text) return resolve({ ok: false, text })
        resolve({
          ok: false,
          text: 'Hermes returned no output. Make sure a provider is configured with `hermes setup` (Nous Portal or an API key).'
        })
      })
    })
  })
}
