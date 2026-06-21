/**
 * Curated X / Twitter accounts grouped by category, for use with official
 * embedded timelines.
 *
 * IMPORTANT: X's free API cannot fetch tweets programmatically. Consumers must
 * use official embeds (widgets.js / syndication timelines) only — no API keys,
 * no scrapers. Handles are stored WITHOUT the leading `@`.
 *
 * @module config/x-accounts
 */

/** Category of an X account group. */
export type XCategory = 'cryptoAnalysts' | 'forexAnalysts' | 'breakingNews' | 'institutions'

/** Curated X handles grouped by category (no leading `@`). */
export const X_ACCOUNTS: Record<XCategory, readonly string[]> = {
  cryptoAnalysts: [
    'APompliano',
    'CryptoCred',
    'AltcoinGordon',
    'rektcapital',
    'CryptoKaleo',
    'inversebrah',
    'cz_binance',
    'VitalikButerin',
    'woonomic',
    'PeterLBrandt',
    'CryptoDonAlt',
    'TheCryptoLark'
  ],
  forexAnalysts: [
    'FXStreetNews',
    'ForexLive',
    'DailyFX',
    'KathyLienFX',
    'Boris_Schlossberg',
    'financialjuice',
    'ForexFactory',
    'JamieSaettele',
    'RaoulGMI',
    'SantiagoAuFund',
    'ForexComUS',
    'OANDA'
  ],
  breakingNews: [
    'DeItaone',
    'FirstSquawk',
    'LiveSquawk',
    'business',
    'Reuters',
    'CNBC',
    'markets',
    'WSJmarkets',
    'financialtimes',
    'breakingbusiness',
    'zerohedge',
    'unusual_whales'
  ],
  institutions: [
    'GoldmanSachs',
    'jpmorgan',
    'Morgan_Stanley',
    'BlackRock',
    'Vanguard_Group',
    'federalreserve',
    'ecb',
    'bankofengland',
    'IMFNews',
    'WorldBank',
    'BIS_org',
    'SECGov'
  ]
}

/** All X categories in display order. */
export const X_CATEGORIES: readonly XCategory[] = [
  'cryptoAnalysts',
  'forexAnalysts',
  'breakingNews',
  'institutions'
]

/**
 * Return the curated handles for a category.
 *
 * @param category One of the {@link XCategory} values.
 * @returns Array of handles (without `@`); empty for an unknown category.
 */
export function accountsByCategory(category: XCategory): readonly string[] {
  return X_ACCOUNTS[category] ?? []
}
