/**
 * SEC EDGAR filings — free, no key. Resolves ticker→CIK from the public
 * company_tickers map, then pulls recent filings from data.sec.gov. SEC requires
 * a descriptive User-Agent; done in main (no renderer CORS).
 */
import { ipcMain } from 'electron'

export interface Filing {
  form: string
  date: string
  description: string
  url: string
}
export interface FilingsResult {
  company: string
  cik: string
  filings: Filing[]
  error?: string
}

const UA = { 'User-Agent': 'Prembroke Terminal research@prembroke.app' }
let tickerMap: Record<string, string> | null = null // TICKER -> zero-padded CIK

async function loadTickers(): Promise<Record<string, string>> {
  if (tickerMap) return tickerMap
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: UA })
  const j = (await res.json()) as Record<string, { cik_str: number; ticker: string }>
  const map: Record<string, string> = {}
  for (const k of Object.keys(j)) {
    const row = j[k]
    map[row.ticker.toUpperCase()] = String(row.cik_str).padStart(10, '0')
  }
  tickerMap = map
  return map
}

export interface FinRow {
  label: string
  unit: string
  values: (number | null)[]
}
export interface FinancialsResult {
  company: string
  periods: number[]
  rows: FinRow[]
  error?: string
}

const FIN_CONCEPTS: { label: string; keys: string[]; unit: string }[] = [
  { label: 'Revenue', keys: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], unit: 'USD' },
  { label: 'Gross profit', keys: ['GrossProfit'], unit: 'USD' },
  { label: 'Operating income', keys: ['OperatingIncomeLoss'], unit: 'USD' },
  { label: 'Net income', keys: ['NetIncomeLoss'], unit: 'USD' },
  { label: 'EPS (diluted)', keys: ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], unit: 'USD/shares' },
  { label: 'Total assets', keys: ['Assets'], unit: 'USD' },
  { label: 'Total liabilities', keys: ['Liabilities'], unit: 'USD' },
  { label: "Shareholders' equity", keys: ['StockholdersEquity'], unit: 'USD' },
  { label: 'Cash & equivalents', keys: ['CashAndCashEquivalentsAtCarryingValue'], unit: 'USD' },
  { label: 'Operating cash flow', keys: ['NetCashProvidedByUsedInOperatingActivities'], unit: 'USD' }
]

interface XbrlEntry {
  val: number
  fy?: number
  fp?: string
  form?: string
  end?: string
}

export function registerEdgarIpc(): void {
  ipcMain.handle('edgar:financials', async (_e, ticker: string): Promise<FinancialsResult> => {
    const sym = String(ticker || '').toUpperCase().replace(/[^A-Z.]/g, '')
    try {
      const map = await loadTickers()
      const cik = map[sym]
      if (!cik) return { company: sym, periods: [], rows: [], error: `No SEC filer found for ${sym}` }
      const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: UA })
      if (!res.ok) return { company: sym, periods: [], rows: [], error: `SEC ${res.status}` }
      const j = (await res.json()) as {
        entityName: string
        facts: { 'us-gaap'?: Record<string, { units: Record<string, XbrlEntry[]> }> }
      }
      const gaap = j.facts['us-gaap'] ?? {}
      const years = new Set<number>()
      const rows = FIN_CONCEPTS.map((c) => {
        const key = c.keys.find((k) => gaap[k]?.units?.[c.unit])
        const byYear: Record<number, number> = {}
        if (key) {
          for (const e of gaap[key].units[c.unit]) {
            if (e.form === '10-K' && e.fp === 'FY' && typeof e.fy === 'number') byYear[e.fy] = e.val
          }
        }
        Object.keys(byYear).forEach((y) => years.add(Number(y)))
        return { label: c.label, unit: c.unit, byYear }
      })
      const periods = [...years].sort((a, b) => b - a).slice(0, 6).sort((a, b) => a - b)
      return {
        company: j.entityName || sym,
        periods,
        rows: rows.map((r) => ({ label: r.label, unit: r.unit, values: periods.map((p) => r.byYear[p] ?? null) }))
      }
    } catch (e) {
      return { company: sym, periods: [], rows: [], error: (e as Error).message }
    }
  })


  ipcMain.handle('edgar:filings', async (_e, ticker: string): Promise<FilingsResult> => {
    const sym = String(ticker || '').toUpperCase().replace(/[^A-Z.]/g, '')
    try {
      const map = await loadTickers()
      const cik = map[sym]
      if (!cik) return { company: sym, cik: '', filings: [], error: `No SEC filer found for ${sym}` }
      const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: UA })
      if (!res.ok) return { company: sym, cik, filings: [], error: `SEC ${res.status}` }
      const j = (await res.json()) as {
        name: string
        filings: {
          recent: {
            form: string[]
            filingDate: string[]
            accessionNumber: string[]
            primaryDocument: string[]
            primaryDocDescription: string[]
          }
        }
      }
      const r = j.filings.recent
      const cikNoPad = String(parseInt(cik, 10))
      const filings: Filing[] = []
      for (let i = 0; i < r.form.length && filings.length < 40; i++) {
        const acc = r.accessionNumber[i].replace(/-/g, '')
        const doc = r.primaryDocument[i]
        filings.push({
          form: r.form[i],
          date: r.filingDate[i],
          description: r.primaryDocDescription[i] || '',
          url: `https://www.sec.gov/Archives/edgar/data/${cikNoPad}/${acc}/${doc}`
        })
      }
      return { company: j.name, cik, filings }
    } catch (e) {
      return { company: sym, cik: '', filings: [], error: (e as Error).message }
    }
  })
}
