import { describe, it, expect } from 'vitest'
import {
  rewardRisk,
  evaluateDayState,
  evaluateTrade,
  riskVerdict,
  DEFAULT_RISK_LIMITS,
  type RiskState,
  type ProposedTrade
} from '../risk/gate'

const baseState: RiskState = { realisedTodayR: 0, consecutiveLosses: 0, openPositions: 0 }

describe('rewardRisk', () => {
  it('computes R:R from entry/stop/target', () => {
    expect(rewardRisk(100, 95, 115)).toBeCloseTo(3, 10)
    expect(rewardRisk(100, 90, 110)).toBeCloseTo(1, 10)
  })
  it('returns 0 when stop is at entry (undefined risk)', () => {
    expect(rewardRisk(100, 100, 110)).toBe(0)
  })
  it('works for shorts', () => {
    expect(rewardRisk(100, 105, 90)).toBeCloseTo(2, 10)
  })
})

describe('evaluateDayState — daily loss lockout', () => {
  it('blocks at or beyond the daily loss limit', () => {
    const c = evaluateDayState({ ...baseState, realisedTodayR: -3 }, DEFAULT_RISK_LIMITS)
    const maxLoss = c.find((x) => x.id === 'maxLoss')!
    expect(maxLoss.severity).toBe('block')
  })
  it('warns when approaching the limit', () => {
    const c = evaluateDayState({ ...baseState, realisedTodayR: -2.2 }, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'maxLoss')!.severity).toBe('warn')
  })
  it('is ok when comfortably within the limit', () => {
    const c = evaluateDayState({ ...baseState, realisedTodayR: -1 }, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'maxLoss')!.severity).toBe('ok')
  })
  it('is ok when up on the day', () => {
    const c = evaluateDayState({ ...baseState, realisedTodayR: 4 }, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'maxLoss')!.severity).toBe('ok')
  })
})

describe('evaluateDayState — loss streak', () => {
  it('blocks at the consecutive-loss limit', () => {
    const c = evaluateDayState({ ...baseState, consecutiveLosses: 3 }, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'streak')!.severity).toBe('block')
  })
  it('warns one before the limit', () => {
    const c = evaluateDayState({ ...baseState, consecutiveLosses: 2 }, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'streak')!.severity).toBe('warn')
  })
})

describe('evaluateTrade — R:R gate', () => {
  it('passes a trade meeting the minimum R:R', () => {
    const trade: ProposedTrade = { entry: 100, stop: 95, target: 115 } // 3R
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'rrGate')!.severity).toBe('ok')
  })
  it('warns on a sub-minimum R:R', () => {
    const trade: ProposedTrade = { entry: 100, stop: 95, target: 105 } // 1R, min 2
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'rrGate')!.severity).toBe('warn')
  })
  it('blocks when the stop is at entry', () => {
    const trade: ProposedTrade = { entry: 100, stop: 100, target: 110 }
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'rrGate')!.severity).toBe('block')
  })
})

describe('evaluateTrade — risk per trade cap', () => {
  it('warns when risk exceeds the cap', () => {
    // risk = |100-95| * 100 = 500 on 10k equity = 5% > 1% cap
    const trade: ProposedTrade = {
      entry: 100,
      stop: 95,
      target: 115,
      accountEquity: 10_000,
      quantity: 100
    }
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'sizeCap')!.severity).toBe('warn')
  })
  it('is ok when within the cap', () => {
    // risk = |100-95| * 10 = 50 on 10k = 0.5% < 1%
    const trade: ProposedTrade = {
      entry: 100,
      stop: 95,
      target: 115,
      accountEquity: 10_000,
      quantity: 10
    }
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'sizeCap')!.severity).toBe('ok')
  })
  it('omits the size check when equity/quantity are absent', () => {
    const trade: ProposedTrade = { entry: 100, stop: 95, target: 115 }
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'sizeCap')).toBeUndefined()
  })
})

describe('evaluateTrade — open positions + correlation', () => {
  it('warns at the open-position cap', () => {
    const trade: ProposedTrade = { entry: 100, stop: 95, target: 115 }
    const c = evaluateTrade(trade, { ...baseState, openPositions: 5 }, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'maxOpen')!.severity).toBe('warn')
  })
  it('warns on a highly-correlated open position', () => {
    const trade: ProposedTrade = {
      entry: 100,
      stop: 95,
      target: 115,
      openCorrelations: [{ symbol: 'ETHUSDT', correlation: 0.92 }]
    }
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'correlation')!.severity).toBe('warn')
  })
  it('ignores low-correlation open positions', () => {
    const trade: ProposedTrade = {
      entry: 100,
      stop: 95,
      target: 115,
      openCorrelations: [{ symbol: 'XAUUSD', correlation: 0.2 }]
    }
    const c = evaluateTrade(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(c.find((x) => x.id === 'correlation')).toBeUndefined()
  })
})

describe('riskVerdict', () => {
  it('locks when any rule blocks', () => {
    const v = riskVerdict(null, { ...baseState, realisedTodayR: -3 }, DEFAULT_RISK_LIMITS)
    expect(v.locked).toBe(true)
    expect(v.severity).toBe('block')
  })
  it('is warn when the worst is a warning', () => {
    const trade: ProposedTrade = { entry: 100, stop: 95, target: 105 } // 1R warn
    const v = riskVerdict(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(v.severity).toBe('warn')
    expect(v.locked).toBe(false)
  })
  it('is ok for a clean trade in a clean day', () => {
    const trade: ProposedTrade = { entry: 100, stop: 95, target: 115 } // 3R
    const v = riskVerdict(trade, baseState, DEFAULT_RISK_LIMITS)
    expect(v.severity).toBe('ok')
    expect(v.locked).toBe(false)
  })
  it('evaluates day-state only when no trade is supplied', () => {
    const v = riskVerdict(null, baseState, DEFAULT_RISK_LIMITS)
    // Only the two standing checks.
    expect(v.checks.map((c) => c.id).sort()).toEqual(['maxLoss', 'streak'])
  })
})
