import { describe, it, expect } from 'vitest'
import { positionSizeCrypto, positionSizeForex } from '../calc/position-size'
import { pipSize, pipValue, lotsToUnits, unitsToLots } from '../calc/pip'
import { rMultiple, breakevenWinRate, expectancy, profitFactor } from '../calc/risk-reward'
import { requiredMargin, liquidationPrice, effectiveLeverage } from '../calc/margin'
import { compoundProjection, drawdownRecovery } from '../calc/compound'
import { kellyFraction, fractionalKelly } from '../calc/kelly'

describe('position-size: crypto', () => {
  it('sizes by risk using linear-contract formula', () => {
    const r = positionSizeCrypto(10_000, 1, 100, 95)
    expect(r.riskAmount).toBe(100)
    expect(r.stopDistance).toBe(5)
    expect(r.qty).toBe(20)
    expect(r.notional).toBe(2000)
  })
  it('returns NaN when entry equals stop', () => {
    const r = positionSizeCrypto(10_000, 1, 100, 100)
    expect(r.qty).toBeNaN()
    expect(r.notional).toBeNaN()
  })
})

describe('position-size: forex', () => {
  it('computes lots and unit breakdown', () => {
    const r = positionSizeForex(10_000, 1, 'EURUSD', 20, 1)
    expect(r.riskAmount).toBe(100)
    expect(r.pipValuePerStandardLot).toBe(10)
    expect(r.standardLots).toBeCloseTo(0.5, 10)
    expect(r.miniLots).toBeCloseTo(5, 10)
    expect(r.microLots).toBeCloseTo(50, 10)
    expect(r.units).toBeCloseTo(50_000, 6)
  })
  it('returns NaN lots when pip stop is zero', () => {
    const r = positionSizeForex(10_000, 1, 'EURUSD', 0, 1)
    expect(r.standardLots).toBeNaN()
  })
})

describe('pip', () => {
  it('pipSize handles majors, JPY and metals', () => {
    expect(pipSize('EURUSD')).toBe(0.0001)
    expect(pipSize('USDJPY')).toBe(0.01)
    expect(pipSize('XAUUSD')).toBe(0.01)
    expect(pipSize('')).toBeNaN()
  })
  it('pipValue of one standard lot at rate 1', () => {
    expect(pipValue('EURUSD', 1, 1)).toBe(10)
    expect(pipValue('USDJPY', 1, 1)).toBe(1000)
  })
  it('lot/unit conversions', () => {
    expect(lotsToUnits(1)).toBe(100_000)
    expect(unitsToLots(50_000)).toBe(0.5)
    expect(unitsToLots(1, 0)).toBeNaN()
  })
})

describe('risk-reward', () => {
  it('rMultiple', () => {
    expect(rMultiple(100, 95, 110)).toBe(2)
    expect(rMultiple(100, 100, 110)).toBeNaN()
  })
  it('breakevenWinRate', () => {
    expect(breakevenWinRate(2)).toBeCloseTo(1 / 3, 10)
    expect(breakevenWinRate(1)).toBe(0.5)
    expect(breakevenWinRate(-1)).toBeNaN()
  })
  it('expectancy', () => {
    expect(expectancy(0.5, 200, 100)).toBe(50)
    expect(expectancy(0.4, 300, 100)).toBeCloseTo(60, 10)
  })
  it('profitFactor', () => {
    expect(profitFactor(300, 150)).toBe(2)
    expect(profitFactor(100, 0)).toBe(Infinity)
    expect(profitFactor(0, 0)).toBeNaN()
  })
})

describe('margin', () => {
  it('requiredMargin', () => {
    expect(requiredMargin(2000, 10)).toBe(200)
    expect(requiredMargin(2000, 0)).toBeNaN()
  })
  it('liquidationPrice isolated', () => {
    expect(liquidationPrice(100, 10, 'long')).toBeCloseTo(90, 10)
    expect(liquidationPrice(100, 10, 'short')).toBeCloseTo(110, 10)
    expect(liquidationPrice(100, 10, 'long', 0.005)).toBeCloseTo(90.5, 10)
  })
  it('effectiveLeverage', () => {
    expect(effectiveLeverage(2000, 1000)).toBe(2)
    expect(effectiveLeverage(2000, 0)).toBeNaN()
  })
})

describe('compound', () => {
  it('projects compounding series', () => {
    const s = compoundProjection(1000, 10, 3)
    expect(s).toHaveLength(3)
    expect(s[0].endBalance).toBeCloseTo(1100, 6)
    expect(s[1].endBalance).toBeCloseTo(1210, 6)
    expect(s[2].endBalance).toBeCloseTo(1331, 6)
  })
  it('adds contributions each period', () => {
    const s = compoundProjection(1000, 0, 2, 100)
    expect(s[0].endBalance).toBe(1100)
    expect(s[1].endBalance).toBe(1200)
  })
  it('drawdownRecovery', () => {
    expect(drawdownRecovery(50)).toBeCloseTo(100, 10)
    expect(drawdownRecovery(20)).toBeCloseTo(25, 10)
    expect(drawdownRecovery(100)).toBe(Infinity)
    expect(drawdownRecovery(-5)).toBeNaN()
  })
})

describe('kelly', () => {
  it('kellyFraction', () => {
    expect(kellyFraction(0.6, 2)).toBeCloseTo(0.4, 10)
    expect(kellyFraction(0.5, 0)).toBeNaN()
  })
  it('fractionalKelly', () => {
    expect(fractionalKelly(0.4, 0.5)).toBeCloseTo(0.2, 10)
  })
})
