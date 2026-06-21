import { describe, it, expect } from 'vitest'
import {
  classifyTermStructure,
  seasonalBias,
  SEASONAL_TABLE,
  type TermPoint
} from '../markets/seasonality'

describe('classifyTermStructure', () => {
  it('rising prices into the future are contango (positive slope)', () => {
    const pts: TermPoint[] = [
      { label: 'Front', months: 1, price: 100 },
      { label: 'M2', months: 2, price: 101 },
      { label: 'M3', months: 3, price: 102 }
    ]
    const r = classifyTermStructure(pts)
    expect(r.shape).toBe('contango')
    expect(r.slopePctPerMonth).toBeGreaterThan(0)
  })

  it('falling prices into the future are backwardation (negative slope)', () => {
    const pts: TermPoint[] = [
      { label: 'Front', months: 1, price: 100 },
      { label: 'M2', months: 2, price: 99 },
      { label: 'M3', months: 3, price: 98 }
    ]
    const r = classifyTermStructure(pts)
    expect(r.shape).toBe('backwardation')
    expect(r.slopePctPerMonth).toBeLessThan(0)
  })

  it('equal prices are flat', () => {
    const pts: TermPoint[] = [
      { label: 'Front', months: 1, price: 100 },
      { label: 'M2', months: 2, price: 100 }
    ]
    expect(classifyTermStructure(pts).shape).toBe('flat')
  })

  it('a single point (or fewer) is flat with zero slope', () => {
    expect(classifyTermStructure([{ label: 'Front', months: 1, price: 100 }])).toEqual({
      shape: 'flat',
      slopePctPerMonth: 0
    })
    expect(classifyTermStructure([])).toEqual({ shape: 'flat', slopePctPerMonth: 0 })
  })

  it('slope magnitude is sane on a known fixture (+1%/mo)', () => {
    const pts: TermPoint[] = [
      { label: 'Front', months: 1, price: 100 },
      { label: 'M2', months: 2, price: 101 }
    ]
    expect(classifyTermStructure(pts).slopePctPerMonth).toBeCloseTo(1, 6)
  })

  it('is deterministic across calls (deep-equal)', () => {
    const pts: TermPoint[] = [
      { label: 'Front', months: 1, price: 100 },
      { label: 'M2', months: 3, price: 103 }
    ]
    expect(classifyTermStructure(pts)).toEqual(classifyTermStructure(pts))
  })
})

describe('seasonalBias', () => {
  it('returns the table row for a known symbol/month', () => {
    const r = seasonalBias('CL', 2)
    expect(r).not.toBeNull()
    expect(r!.bias).toBe('long')
    expect(r!.month).toBe(2)
    expect(r!.note.length).toBeGreaterThan(0)
  })

  it('is case-insensitive on the symbol id', () => {
    expect(seasonalBias('cl', 9)?.bias).toBe('short')
  })

  it('returns a flat placeholder for a known symbol in an unlisted month', () => {
    const r = seasonalBias('ES', 1)
    expect(r).not.toBeNull()
    expect(r!.bias).toBe('flat')
  })

  it('returns null for an unknown symbol', () => {
    expect(seasonalBias('ZZ', 1)).toBeNull()
  })

  it('returns null for an out-of-range month', () => {
    expect(seasonalBias('CL', 0)).toBeNull()
    expect(seasonalBias('CL', 13)).toBeNull()
  })

  it('every table entry has a valid month and a non-empty note', () => {
    for (const rows of Object.values(SEASONAL_TABLE)) {
      for (const row of rows) {
        expect(row.month).toBeGreaterThanOrEqual(1)
        expect(row.month).toBeLessThanOrEqual(12)
        expect(row.note.length).toBeGreaterThan(0)
      }
    }
  })
})
