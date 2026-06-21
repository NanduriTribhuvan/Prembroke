/**
 * News aggregation in the Electron main process — RSS/Atom feeds fetched here
 * (no renderer CORS limits), parsed without a dependency, deduped and sorted.
 */
import { ipcMain } from 'electron'

export interface NewsItem {
  title: string
  link: string
  source: string
  category: 'crypto' | 'forex' | 'macro'
  ts: number
}

const FEEDS: { source: string; url: string; category: NewsItem['category'] }[] = [
  { source: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'crypto' },
  { source: 'Cointelegraph', url: 'https://cointelegraph.com/rss', category: 'crypto' },
  { source: 'Decrypt', url: 'https://decrypt.co/feed', category: 'crypto' },
  { source: 'CoinJournal', url: 'https://coinjournal.net/feed/', category: 'crypto' },
  { source: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', category: 'crypto' },
  { source: 'FXStreet', url: 'https://www.fxstreet.com/rss/news', category: 'forex' },
  { source: 'Investing Economy', url: 'https://www.investing.com/rss/news_25.rss', category: 'macro' }
]

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parse(xml: string, source: string, category: NewsItem['category']): NewsItem[] {
  const out: NewsItem[] = []
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  for (const b of blocks) {
    const title = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
    let link = b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? ''
    if (!link.trim()) link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? ''
    const dateStr =
      b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
      b.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1] ??
      ''
    const t = decode(title)
    const l = decode(link)
    if (!t || !l) continue
    const parsed = dateStr ? Date.parse(dateStr.trim()) : NaN
    out.push({ title: t, link: l, source, category, ts: Number.isFinite(parsed) ? parsed : Date.now() })
  }
  return out.slice(0, 25)
}

async function fetchFeed(f: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(f.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (PrembrokeTerminal)' }
    })
    clearTimeout(to)
    if (!res.ok) return []
    return parse(await res.text(), f.source, f.category)
  } catch {
    return []
  }
}

/** CryptoCompare aggregated crypto news — free; key raises rate limits. */
async function fetchCryptoCompare(apiKey?: string): Promise<NewsItem[]> {
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 8000)
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ''
    const res = await fetch(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN${keyParam}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (PrembrokeTerminal)' }
    })
    clearTimeout(to)
    if (!res.ok) return []
    const j = (await res.json()) as {
      Data?: { title: string; url: string; source_info?: { name?: string }; source?: string; published_on: number }[]
    }
    return (j.Data ?? []).map((d) => ({
      title: d.title,
      link: d.url,
      source: d.source_info?.name ?? d.source ?? 'CryptoCompare',
      category: 'crypto' as const,
      ts: d.published_on * 1000
    }))
  } catch {
    return []
  }
}

export function registerNewsIpc(): void {
  ipcMain.handle('news:fetch', async (_e, cryptoCompareKey?: string): Promise<NewsItem[]> => {
    const all = (await Promise.all([...FEEDS.map(fetchFeed), fetchCryptoCompare(cryptoCompareKey)])).flat()
    const seen = new Set<string>()
    const dedup = all.filter((i) => {
      const k = i.title.toLowerCase().slice(0, 60)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    return dedup.sort((a, b) => b.ts - a.ts).slice(0, 80)
  })
}
