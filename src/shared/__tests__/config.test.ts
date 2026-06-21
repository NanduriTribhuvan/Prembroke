import { describe, it, expect } from 'vitest'
import { FEEDS, feedsByCategory } from '../config/feeds'
import { CHANNELS, channelById } from '../config/channels'
import { X_ACCOUNTS, X_CATEGORIES, accountsByCategory } from '../config/x-accounts'

describe('feeds registry', () => {
  it('covers all three categories with valid https URLs', () => {
    expect(feedsByCategory('crypto').length).toBeGreaterThanOrEqual(5)
    expect(feedsByCategory('forex').length).toBeGreaterThanOrEqual(4)
    expect(feedsByCategory('macro').length).toBeGreaterThanOrEqual(3)
    expect(FEEDS.every((f) => f.url.startsWith('https://'))).toBe(true)
  })
})

describe('channels registry', () => {
  it('uses the live_stream embed format', () => {
    expect(CHANNELS.length).toBeGreaterThanOrEqual(4)
    expect(
      CHANNELS.every((c) => c.embedUrl.includes('live_stream?channel=') && c.channelId.length > 0)
    ).toBe(true)
  })
  it('channelById finds CNBC', () => {
    expect(channelById('cnbc')?.label).toBe('CNBC')
    expect(channelById('missing')).toBeUndefined()
  })
})

describe('x-accounts registry', () => {
  it('has at least 10 handles per category, none prefixed with @', () => {
    for (const cat of X_CATEGORIES) {
      const accounts = X_ACCOUNTS[cat]
      expect(accounts.length).toBeGreaterThanOrEqual(10)
      expect(accounts.every((h) => !h.startsWith('@'))).toBe(true)
    }
  })
  it('accountsByCategory returns the curated list', () => {
    expect(accountsByCategory('cryptoAnalysts').length).toBeGreaterThanOrEqual(10)
    expect(accountsByCategory('institutions')).toContain('GoldmanSachs')
  })
})
