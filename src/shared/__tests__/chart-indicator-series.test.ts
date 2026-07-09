import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { computeIndicator, type BuiltinIndicatorSpec } from '../chart/indicator-series'
import {
  sma,
  ema,
  wma,
  rsi,
  macd,
  bollinger,
  atr,
  stochastic,
  donchian,
  supertrend,
  vwap,
  obv
} from '../indicators'
import type { Candle } from '../indicators/types'

/**
 * Feature: native-charting-pricing, Property 20
 *
 * Property 20: Indicator series equal their underlying pure function.
 *
 * For any candle series and built-in indicator spec, the series produced by
 * `computeIndicator` equals the corresponding `@shared/indicators` function
 * applied to the derived inputs (closes for close-based studies, whole candles
 * for OHLCV studies). Recomputing after appending a candle keeps every output
 * line index-aligned with the candles.
 *
 * Validates: Requirements 8.1, 8.4
 */

const NUM_RUNS = 150

/** Realistic positive price magnitudes; finite, no NaN/Infinity. */
const price = fc.double({ min: 0.01, max: 1e5, noNaN: true, noDefaultInfinity: true })

/** Non-negative traded volume. */
const volume = fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true })

/**
 * A well-formed OHLCV candle: `high` is at or above both open/close and `low`
 * is at or below both, matching what a real feed emits. `time` is filled in per
 * index when the series is assembled so timestamps stay strictly ascending.
 */
const candleShape = fc
  .record({
    open: price,
    close: price,
    hiPad: fc.double({ min: 0, max: 1e4, noNaN: true, noDefaultInfinity: true }),
    loPad: fc.double({ min: 0, max: 1e4, noNaN: true, noDefaultInfinity: true }),
    volume
  })
  .map(({ open, close, hiPad, loPad, volume }) => ({
    open,
    close,
    high: Math.max(open, close) + hiPad,
    low: Math.max(0, Math.min(open, close) - loPad),
    volume
  }))

/** A candle series long enough to exercise indicator warm-up. Times are ascending. */
const candleSeries = fc
  .array(candleShape, { minLength: 1, maxLength: 200 })
  .map((rows) =>
    rows.map((r, i) => ({ time: 1_700_000_000_000 + i * 60_000, ...r }) as Candle)
  )

/** Periods spanning below, at, and above typical warm-up windows. */
const period = fc.integer({ min: 1, max: 40 })

/** Extract closes exactly as the engine does. */
const closes = (candles: Candle[]): number[] => candles.map((c) => c.close)

/**
 * A built-in case: the spec to feed `computeIndicator`, and the expected output
 * lines derived by calling the underlying pure function(s) directly — mirroring
 * the engine's own routing so any drift is a genuine bug.
 */
interface BuiltinCase {
  spec: BuiltinIndicatorSpec
  expected: (candles: Candle[]) => number[][]
}

/** Generator over every built-in id, paired with its reference computation. */
const builtinCase: fc.Arbitrary<BuiltinCase> = fc.oneof(
  period.map((p) => ({
    spec: { kind: 'builtin', id: 'sma', params: { period: p }, target: 'overlay' } as const,
    expected: (c: Candle[]) => [sma(closes(c), p)]
  })),
  period.map((p) => ({
    spec: { kind: 'builtin', id: 'ema', params: { period: p }, target: 'overlay' } as const,
    expected: (c: Candle[]) => [ema(closes(c), p)]
  })),
  period.map((p) => ({
    spec: { kind: 'builtin', id: 'wma', params: { period: p }, target: 'overlay' } as const,
    expected: (c: Candle[]) => [wma(closes(c), p)]
  })),
  period.map((p) => ({
    spec: { kind: 'builtin', id: 'rsi', params: { period: p }, target: 'subpane' } as const,
    expected: (c: Candle[]) => [rsi(closes(c), p)]
  })),
  fc
    .tuple(period, period, period)
    .map(([fastPeriod, slowPeriod, signalPeriod]) => ({
      spec: {
        kind: 'builtin',
        id: 'macd',
        params: { fastPeriod, slowPeriod, signalPeriod },
        target: 'subpane'
      } as const,
      expected: (c: Candle[]) => {
        const r = macd(closes(c), fastPeriod, slowPeriod, signalPeriod)
        return [r.macd, r.signal, r.histogram]
      }
    })),
  fc.tuple(period, fc.double({ min: 0.5, max: 4, noNaN: true, noDefaultInfinity: true })).map(
    ([p, mult]) => ({
      spec: {
        kind: 'builtin',
        id: 'bollinger',
        params: { period: p, mult },
        target: 'overlay'
      } as const,
      expected: (c: Candle[]) => {
        const r = bollinger(closes(c), p, mult)
        return [r.upper, r.middle, r.lower]
      }
    })
  ),
  period.map((p) => ({
    spec: { kind: 'builtin', id: 'atr', params: { period: p }, target: 'subpane' } as const,
    expected: (c: Candle[]) => [atr(c.slice(), p)]
  })),
  fc.tuple(period, period).map(([kPeriod, dPeriod]) => ({
    spec: {
      kind: 'builtin',
      id: 'stochastic',
      params: { kPeriod, dPeriod },
      target: 'subpane'
    } as const,
    expected: (c: Candle[]) => {
      const r = stochastic(c.slice(), kPeriod, dPeriod)
      return [r.k, r.d]
    }
  })),
  period.map((p) => ({
    spec: { kind: 'builtin', id: 'donchian', params: { period: p }, target: 'overlay' } as const,
    expected: (c: Candle[]) => {
      const r = donchian(c.slice(), p)
      return [r.upper, r.middle, r.lower]
    }
  })),
  fc
    .tuple(period, fc.double({ min: 0.5, max: 6, noNaN: true, noDefaultInfinity: true }))
    .map(([p, multiplier]) => ({
      spec: {
        kind: 'builtin',
        id: 'supertrend',
        params: { period: p, multiplier },
        target: 'overlay'
      } as const,
      expected: (c: Candle[]) => [supertrend(c.slice(), p, multiplier).supertrend]
    })),
  fc.constant({
    spec: { kind: 'builtin', id: 'vwap', params: {}, target: 'overlay' } as const,
    expected: (c: Candle[]) => [vwap(c.slice())]
  }),
  fc.constant({
    spec: { kind: 'builtin', id: 'obv', params: {}, target: 'subpane' } as const,
    expected: (c: Candle[]) => [obv(c.slice())]
  })
)

describe('computeIndicator — Property 20: series equal their underlying pure function', () => {
  it('built-in series deep-equal the corresponding @shared/indicators output', () => {
    fc.assert(
      fc.property(candleSeries, builtinCase, (candles, { spec, expected }) => {
        const series = computeIndicator(spec, candles)
        const got = series.lines.map((l) => l.values)

        // Same render target the spec declared.
        expect(series.target).toBe(spec.target)

        // Same number of lines, each deep-equal to the reference computation
        // (NaN warm-up values compare equal under toEqual).
        expect(got).toEqual(expected(candles))
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('recomputing after appending a candle keeps every line aligned with the candles', () => {
    fc.assert(
      fc.property(candleSeries, candleShape, builtinCase, (candles, extra, { spec }) => {
        const appended: Candle[] = [
          ...candles,
          { time: candles[candles.length - 1].time + 60_000, ...extra } as Candle
        ]

        const before = computeIndicator(spec, candles)
        const after = computeIndicator(spec, appended)

        // Every output line stays index-aligned with its source candles.
        for (const line of before.lines) {
          expect(line.values).toHaveLength(candles.length)
        }
        for (const line of after.lines) {
          expect(line.values).toHaveLength(appended.length)
        }

        // Line count (shape) is stable across the append.
        expect(after.lines.length).toBe(before.lines.length)
      }),
      { numRuns: NUM_RUNS }
    )
  })
})
