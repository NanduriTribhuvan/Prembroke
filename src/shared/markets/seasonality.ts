/**
 * Pure seasonality and term-structure context for futures.
 *
 * Free data does not include a live futures curve, so this module ships two
 * honest, deterministic primitives:
 *
 * 1. {@link classifyTermStructure} — given whatever curve points are available
 *    (e.g. front vs next month), classify contango / backwardation and report a
 *    normalized slope. Returns a flat/zero read for fewer than two points.
 * 2. {@link seasonalBias} — a static, per-contract monthly bias table (genuinely
 *    free and useful), looked up by symbol id and calendar month.
 *
 * UI-free; every output is deterministic (deep-equal across calls).
 *
 * @module markets/seasonality
 */

/** One point on a futures curve. */
export interface TermPoint {
  /** Contract label, e.g. `"Front"`, `"M2"`. */
  label: string
  /** Months from now to the contract's expiry (front = 0 or 1). */
  months: number
  /** Contract price. */
  price: number
}

/** The shape of a futures term structure. */
export type TermShape = 'contango' | 'backwardation' | 'flat'

/** Result of classifying a term structure. */
export interface TermStructure {
  shape: TermShape
  /** Average price change per month as a percentage of the front price. */
  slopePctPerMonth: number
}

/** Directional seasonal bias for a contract in a given month. */
export type SeasonDirection = 'long' | 'short' | 'flat'

/** A per-month seasonal bias entry. */
export interface SeasonBias {
  /** Calendar month, 1 (January) – 12 (December). */
  month: number
  bias: SeasonDirection
  /** Short human-readable rationale. */
  note: string
}

/**
 * Classify a futures term structure from its available curve points.
 *
 * Points are sorted by `months`. A later contract priced above the front is
 * contango (positive slope); below is backwardation (negative). The slope is
 * the mean per-month price change expressed as a percentage of the front price.
 *
 * @param points Curve points (any order). Fewer than two → `flat`, slope `0`.
 * @returns The {@link TermStructure} classification.
 */
export function classifyTermStructure(points: TermPoint[]): TermStructure {
  const valid = points.filter((p) => Number.isFinite(p.months) && Number.isFinite(p.price))
  if (valid.length < 2) return { shape: 'flat', slopePctPerMonth: 0 }
  const sorted = [...valid].sort((a, b) => a.months - b.months)
  const front = sorted[0]
  if (front.price === 0) return { shape: 'flat', slopePctPerMonth: 0 }

  let slopeSum = 0
  let spans = 0
  for (let i = 1; i < sorted.length; i++) {
    const dMonths = sorted[i].months - sorted[0].months
    if (dMonths <= 0) continue
    const pctChange = ((sorted[i].price - front.price) / front.price) * 100
    slopeSum += pctChange / dMonths
    spans += 1
  }
  const slopePctPerMonth = spans === 0 ? 0 : Math.round((slopeSum / spans) * 1000) / 1000
  const shape: TermShape =
    slopePctPerMonth > 0.01 ? 'contango' : slopePctPerMonth < -0.01 ? 'backwardation' : 'flat'
  return { shape, slopePctPerMonth }
}

/**
 * A deterministic, static seasonal-bias table per futures contract id.
 *
 * Hand-curated, well-known commodity/index seasonal tendencies — point-in-time
 * reference data (not investment advice). Months not listed are treated as
 * `flat` by {@link seasonalBias}.
 */
export const SEASONAL_TABLE: Readonly<Record<string, readonly SeasonBias[]>> = {
  CL: [
    { month: 2, bias: 'long', note: 'Driving-season build into spring' },
    { month: 3, bias: 'long', note: 'Refinery demand ramp' },
    { month: 4, bias: 'long', note: 'Pre-summer strength' },
    { month: 9, bias: 'short', note: 'Post-summer demand fade' },
    { month: 10, bias: 'short', note: 'Shoulder-season softness' }
  ],
  GC: [
    { month: 1, bias: 'long', note: 'New-year allocation flows' },
    { month: 8, bias: 'long', note: 'Festival / wedding demand build' },
    { month: 9, bias: 'long', note: 'Seasonal physical demand peak' },
    { month: 3, bias: 'short', note: 'Post Q1 strength fades' }
  ],
  SI: [
    { month: 1, bias: 'long', note: 'Tracks gold new-year flows' },
    { month: 8, bias: 'long', note: 'Industrial + physical demand' },
    { month: 6, bias: 'short', note: 'Summer industrial lull' }
  ],
  ES: [
    { month: 11, bias: 'long', note: 'Seasonally strong Nov–Dec' },
    { month: 12, bias: 'long', note: 'Santa-rally tendency' },
    { month: 4, bias: 'long', note: 'Historically firm April' },
    { month: 9, bias: 'short', note: 'Historically weakest month' }
  ],
  NQ: [
    { month: 11, bias: 'long', note: 'Seasonal tech strength' },
    { month: 12, bias: 'long', note: 'Year-end momentum' },
    { month: 9, bias: 'short', note: 'Seasonal Q3 softness' }
  ],
  YM: [
    { month: 11, bias: 'long', note: 'Seasonally strong Nov–Dec' },
    { month: 12, bias: 'long', note: 'Year-end firmness' },
    { month: 9, bias: 'short', note: 'Historically weak September' }
  ]
}

/**
 * Look up the seasonal bias for a contract in a given calendar month.
 *
 * @param symbolId Futures contract id, e.g. `"CL"` (case-insensitive).
 * @param month Calendar month, 1–12.
 * @param table Bias table (defaults to {@link SEASONAL_TABLE}).
 * @returns The matching {@link SeasonBias}; a `flat` placeholder when the symbol
 *          is known but the month is unlisted; or `null` for an unknown symbol
 *          or an out-of-range month.
 */
export function seasonalBias(
  symbolId: string,
  month: number,
  table: Readonly<Record<string, readonly SeasonBias[]>> = SEASONAL_TABLE
): SeasonBias | null {
  if (typeof symbolId !== 'string') return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  const rows = table[symbolId.toUpperCase()]
  if (!rows) return null
  const hit = rows.find((r) => r.month === month)
  return hit ?? { month, bias: 'flat', note: 'No pronounced seasonal tendency' }
}
