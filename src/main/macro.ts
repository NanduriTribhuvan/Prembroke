/**
 * Macro / economy data in the main process via FRED (St. Louis Fed).
 *
 * FRED needs a free API key and blocks browser CORS, so it lives here. We pull a
 * curated set of headline series (policy rate, inflation, jobs, yields, growth),
 * return the latest observations + a small history for sparklines, and normalise
 * everything to one `{ id, label, latest, prev, history }` shape. The renderer
 * shows a clean "add FRED key" state when no key is configured.
 */
import { ipcMain } from 'electron'

/** One observation point. */
export interface MacroPoint {
  /** Observation date (YYYY-MM-DD). */
  date: string
  /** Value, or `null` when FRED reports a missing observation ("."). */
  value: number | null
}

/** A normalised macro series with recent history. */
export interface MacroSeries {
  id: string
  /** FRED series id (e.g. `FEDFUNDS`). */
  fredId: string
  label: string
  /** Unit suffix for display (e.g. `%`). */
  unit: string
  /** Latest non-null value, or `null`. */
  latest: number | null
  /** Previous non-null value (for the delta), or `null`. */
  prev: number | null
  /** Latest observation date. */
  date: string
  /** Recent history oldest→newest (for the sparkline). */
  history: MacroPoint[]
}

/** Curated headline series — the macro a trader actually reads. */
const SERIES: { id: string; fredId: string; label: string; unit: string }[] = [
  { id: 'fedfunds', fredId: 'FEDFUNDS', label: 'Fed funds rate', unit: '%' },
  { id: 'cpi', fredId: 'CPIAUCSL', label: 'CPI (YoY)', unit: '%' },
  { id: 'unemployment', fredId: 'UNRATE', label: 'Unemployment', unit: '%' },
  { id: 'us10y', fredId: 'DGS10', label: 'US 10Y yield', unit: '%' },
  { id: 'us2y', fredId: 'DGS2', label: 'US 2Y yield', unit: '%' },
  { id: 'gdp', fredId: 'A191RL1Q225SBEA', label: 'Real GDP (QoQ)', unit: '%' }
]

/** Series that FRED reports as an index level — we convert to YoY % change. */
const YOY_FROM_INDEX = new Set(['cpi'])

interface FredObs {
  date: string
  value: string
}
interface FredResponse {
  observations?: FredObs[]
}

async function fetchSeries(
  fredId: string,
  key: string,
  limit: number
): Promise<MacroPoint[]> {
  // Pull a generous tail; YoY needs ~13 monthly points, sparkline wants ~24.
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(fredId)}` +
    `&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=${limit}`
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return []
    const j = (await res.json()) as FredResponse
    const obs = j.observations ?? []
    // FRED returns newest-first here; flip to oldest→newest.
    return obs
      .slice()
      .reverse()
      .map((o) => ({
        date: o.date,
        value: o.value === '.' ? null : Number(o.value)
      }))
  } catch {
    return []
  } finally {
    clearTimeout(to)
  }
}

/** Convert an index-level history to a YoY %-change history (monthly → 12-step). */
function toYoY(points: MacroPoint[]): MacroPoint[] {
  const out: MacroPoint[] = []
  for (let i = 12; i < points.length; i++) {
    const now = points[i].value
    const year = points[i - 12].value
    out.push({
      date: points[i].date,
      value: now != null && year != null && year !== 0 ? ((now - year) / year) * 100 : null
    })
  }
  return out
}

function lastTwoNonNull(points: MacroPoint[]): { latest: number | null; prev: number | null; date: string } {
  let latest: number | null = null
  let prev: number | null = null
  let date = ''
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].value != null) {
      if (latest === null) {
        latest = points[i].value
        date = points[i].date
      } else {
        prev = points[i].value
        break
      }
    }
  }
  return { latest, prev, date }
}

export function registerMacroIpc(): void {
  ipcMain.handle(
    'macro:fetch',
    async (_e, key: string): Promise<{ ok: boolean; series: MacroSeries[]; error?: string }> => {
      if (typeof key !== 'string' || !key.trim()) {
        return { ok: false, series: [], error: 'no-key' }
      }

      const results = await Promise.all(
        SERIES.map(async (s): Promise<MacroSeries> => {
          const raw = await fetchSeries(s.fredId, key, 40)
          const hist = YOY_FROM_INDEX.has(s.id) ? toYoY(raw) : raw
          const tail = hist.slice(-24)
          const { latest, prev, date } = lastTwoNonNull(tail)
          return {
            id: s.id,
            fredId: s.fredId,
            label: s.label,
            unit: s.unit,
            latest,
            prev,
            date,
            history: tail
          }
        })
      )

      const anyData = results.some((r) => r.latest != null)
      if (!anyData) {
        return { ok: false, series: results, error: 'fetch-failed' }
      }
      return { ok: true, series: results }
    }
  )
}
