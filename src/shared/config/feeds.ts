/**
 * RSS news-feed registry grouped by category.
 *
 * URLs point at publicly available RSS endpoints. Macro feeds without a native
 * RSS endpoint are sourced via Google News topic/search RSS.
 *
 * @module config/feeds
 */

/** News category for a feed. */
export type FeedCategory = 'crypto' | 'forex' | 'macro'

/** A single RSS feed entry. */
export interface FeedSource {
  id: string
  name: string
  url: string
  category: FeedCategory
}

/** Curated RSS feeds across crypto, forex and macro categories. */
export const FEEDS: readonly FeedSource[] = [
  // Crypto
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'crypto' },
  { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', category: 'crypto' },
  { id: 'decrypt', name: 'Decrypt', url: 'https://decrypt.co/feed', category: 'crypto' },
  { id: 'theblock', name: 'The Block', url: 'https://www.theblock.co/rss.xml', category: 'crypto' },
  { id: 'bitcoinmagazine', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', category: 'crypto' },

  // Forex
  { id: 'forexlive', name: 'ForexLive', url: 'https://www.forexlive.com/feed/', category: 'forex' },
  { id: 'fxstreet', name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news', category: 'forex' },
  { id: 'dailyfx', name: 'DailyFX', url: 'https://www.dailyfx.com/feeds/market-news', category: 'forex' },
  {
    id: 'investing-forex',
    name: 'Investing.com — Forex',
    url: 'https://www.investing.com/rss/news_1.rss',
    category: 'forex'
  },

  // Macro
  { id: 'marketwatch', name: 'MarketWatch — Top Stories', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', category: 'macro' },
  {
    id: 'cnbc-finance',
    name: 'CNBC — Finance',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    category: 'macro'
  },
  {
    id: 'reuters-business',
    name: 'Reuters — Business (Google News)',
    url: 'https://news.google.com/rss/search?q=when:24h+site:reuters.com+business&hl=en-US&gl=US&ceid=US:en',
    category: 'macro'
  }
]

/**
 * Return all feeds in a given category.
 *
 * @param category Feed category.
 * @returns Matching {@link FeedSource}s in registry order.
 */
export function feedsByCategory(category: FeedCategory): FeedSource[] {
  return FEEDS.filter((f) => f.category === category)
}
