/**
 * Economic-calendar aggregation in the main process. Pulls the free weekly
 * Forex-Factory-style JSON (no key, no renderer CORS) and normalises it.
 */
import { ipcMain } from 'electron'

export type Impact = 'High' | 'Medium' | 'Low' | 'Holiday'

export interface EconEvent {
  title: string
  country: string
  ts: number
  impact: Impact
  forecast: string
  previous: string
}

interface RawEvent {
  title?: string
  country?: string
  date?: string
  impact?: string
  forecast?: string
  previous?: string
}

const URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'

function normImpact(v: string | undefined): Impact {
  const s = (v ?? '').toLowerCase()
  if (s.includes('high')) return 'High'
  if (s.includes('medium')) return 'Medium'
  if (s.includes('holiday')) return 'Holiday'
  return 'Low'
}

export function registerCalendarIpc(): void {
  ipcMain.handle('calendar:fetch', async (): Promise<EconEvent[]> => {
    try {
      const ctrl = new AbortController()
      const to = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(URL, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (PrembrokeTerminal)' }
      })
      clearTimeout(to)
      if (!res.ok) return []
      const rows = (await res.json()) as RawEvent[]
      return rows
        .map((r): EconEvent => {
          const ts = r.date ? Date.parse(r.date) : NaN
          return {
            title: r.title ?? '',
            country: (r.country ?? '').toUpperCase(),
            ts: Number.isFinite(ts) ? ts : 0,
            impact: normImpact(r.impact),
            forecast: r.forecast ?? '',
            previous: r.previous ?? ''
          }
        })
        .filter((e) => e.title && e.ts > 0)
        .sort((a, b) => a.ts - b.ts)
    } catch {
      return []
    }
  })
}
