/**
 * Loader for X (Twitter) widgets.js. The official embed script is loaded once
 * and shared across all timeline components. No X API keys are used — embeds
 * only, because the free X API cannot read tweets.
 */

interface TwitterWidgets {
  widgets: {
    createTimeline: (
      source: { sourceType: string; screenName: string },
      target: HTMLElement,
      options?: Record<string, unknown>
    ) => Promise<HTMLElement | undefined>
    load: (el?: HTMLElement) => void
  }
}

declare global {
  interface Window {
    twttr?: TwitterWidgets
  }
}

const SCRIPT_ID = 'twitter-wjs'
const SCRIPT_SRC = 'https://platform.twitter.com/widgets.js'

let loadPromise: Promise<TwitterWidgets | null> | null = null

/**
 * Load widgets.js (once) and resolve with the `twttr` object, or `null` if it
 * fails to load within `timeoutMs`.
 */
export function loadTwitterWidgets(timeoutMs = 5000): Promise<TwitterWidgets | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.twttr) return Promise.resolve(window.twttr)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<TwitterWidgets | null>((resolve) => {
    const done = (value: TwitterWidgets | null): void => resolve(value)
    const timer = window.setTimeout(() => done(window.twttr ?? null), timeoutMs)

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      document.body.appendChild(script)
    }
    script.addEventListener('load', () => {
      window.clearTimeout(timer)
      done(window.twttr ?? null)
    })
    script.addEventListener('error', () => {
      window.clearTimeout(timer)
      done(null)
    })
  })
  return loadPromise
}
