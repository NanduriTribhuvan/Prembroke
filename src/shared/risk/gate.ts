/**
 * Risk & discipline gate — the rules that stop a trader from blowing up: a
 * daily max-loss lockout, a minimum reward:risk gate, a per-trade risk cap, and
 * concentration/correlation warnings. Pure + UI-free and deterministic so it can
 * run in the conviction plan, the alerts engine, and (eventually) a pre-trade
 * checklist without touching the DOM.
 *
 * The philosophy: never *block* a human from their own decision, but make every
 * rule violation loud and explicit. Each check returns a severity so the UI can
 * show a hard "locked" state, a "warn" nudge, or an "ok" tick.
 *
 * @module risk/gate
 */

/** Severity of a single discipline check. */
export type RiskSeverity = 'ok' | 'warn' | 'block'

/** One evaluated discipline rule. */
export interface RiskCheck {
  /** Stable rule id (e.g. `maxLoss`, `rrGate`). */
  id: string
  /** Human label. */
  label: string
  severity: RiskSeverity
  /** One-line explanation of the current state. */
  detail: string
}

/** The trader's configurable discipline limits. */
export interface RiskLimits {
  /** Max realised loss allowed in one day, in R. Lockout triggers at/under `-maxDailyLossR`. */
  maxDailyLossR: number
  /** Max consecutive losses before a cool-down warning. */
  maxConsecutiveLosses: number
  /** Minimum acceptable reward:risk for a new trade. */
  minRR: number
  /** Max fraction of account to risk on a single trade (e.g. 0.01 = 1%). */
  maxRiskPerTradePct: number
  /** Max number of concurrently open positions. */
  maxOpenPositions: number
  /** Correlation above which two open symbols count as "the same bet". */
  correlationWarn: number
}

/** Sensible defaults — conservative, prop-firm-style discipline. */
export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxDailyLossR: 3,
  maxConsecutiveLosses: 3,
  minRR: 2,
  maxRiskPerTradePct: 0.01,
  maxOpenPositions: 5,
  correlationWarn: 0.8
}

/** A snapshot of the trader's current day/session state. */
export interface RiskState {
  /** Realised R so far today (negative = down). */
  realisedTodayR: number
  /** Consecutive losing trades immediately preceding now. */
  consecutiveLosses: number
  /** Number of positions currently open. */
  openPositions: number
}

/** A proposed new trade to validate against the limits. */
export interface ProposedTrade {
  entry: number
  stop: number
  target: number
  /** Account equity (for the risk-per-trade sizing check). */
  accountEquity?: number
  /** Intended quantity/units (for the risk-per-trade sizing check). */
  quantity?: number
  /** Symbols already open, with their correlation to this trade's symbol in `[-1,1]`. */
  openCorrelations?: { symbol: string; correlation: number }[]
}

/** Reward:risk of a trade. `0` when the stop is at entry (undefined risk). */
export function rewardRisk(entry: number, stop: number, target: number): number {
  const risk = Math.abs(entry - stop)
  if (risk === 0) return 0
  return Math.abs(target - entry) / risk
}

/** The worst severity wins. */
function worst(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  const rank: Record<RiskSeverity, number> = { ok: 0, warn: 1, block: 2 }
  return rank[a] >= rank[b] ? a : b
}

/**
 * Evaluate the standing daily-discipline checks (independent of any new trade):
 * the daily max-loss lockout and the consecutive-loss cool-down.
 *
 * @param state Current day state.
 * @param limits Configured limits.
 * @returns One {@link RiskCheck} per standing rule.
 */
export function evaluateDayState(state: RiskState, limits: RiskLimits): RiskCheck[] {
  const checks: RiskCheck[] = []

  const lossR = state.realisedTodayR
  if (lossR <= -Math.abs(limits.maxDailyLossR)) {
    checks.push({
      id: 'maxLoss',
      label: 'Daily loss limit',
      severity: 'block',
      detail: `Down ${lossR.toFixed(1)}R today — at or beyond the ${limits.maxDailyLossR}R lockout. Stop trading.`
    })
  } else if (lossR <= -Math.abs(limits.maxDailyLossR) * 0.66) {
    checks.push({
      id: 'maxLoss',
      label: 'Daily loss limit',
      severity: 'warn',
      detail: `Down ${lossR.toFixed(1)}R today — approaching the ${limits.maxDailyLossR}R lockout.`
    })
  } else {
    checks.push({
      id: 'maxLoss',
      label: 'Daily loss limit',
      severity: 'ok',
      detail: `${lossR >= 0 ? '+' : ''}${lossR.toFixed(1)}R today · limit ${limits.maxDailyLossR}R.`
    })
  }

  if (state.consecutiveLosses >= limits.maxConsecutiveLosses) {
    checks.push({
      id: 'streak',
      label: 'Loss streak',
      severity: 'block',
      detail: `${state.consecutiveLosses} losses in a row — take a break before the next trade.`
    })
  } else if (state.consecutiveLosses === limits.maxConsecutiveLosses - 1) {
    checks.push({
      id: 'streak',
      label: 'Loss streak',
      severity: 'warn',
      detail: `${state.consecutiveLosses} losses in a row — one more hits the cool-down.`
    })
  } else {
    checks.push({
      id: 'streak',
      label: 'Loss streak',
      severity: 'ok',
      detail: `${state.consecutiveLosses} consecutive losses.`
    })
  }

  return checks
}

/**
 * Evaluate the pre-trade checks for a proposed trade: the R:R gate, the
 * per-trade risk cap, the open-position cap, and a correlation/concentration
 * warning. Combine with {@link evaluateDayState} for the full picture.
 *
 * @param trade The proposed trade.
 * @param state Current day state.
 * @param limits Configured limits.
 * @returns One {@link RiskCheck} per pre-trade rule.
 */
export function evaluateTrade(
  trade: ProposedTrade,
  state: RiskState,
  limits: RiskLimits
): RiskCheck[] {
  const checks: RiskCheck[] = []

  // R:R gate.
  const rr = rewardRisk(trade.entry, trade.stop, trade.target)
  if (rr === 0) {
    checks.push({
      id: 'rrGate',
      label: 'Reward : risk',
      severity: 'block',
      detail: 'Stop is at entry — undefined risk. Set a real stop.'
    })
  } else if (rr < limits.minRR) {
    checks.push({
      id: 'rrGate',
      label: 'Reward : risk',
      severity: 'warn',
      detail: `R:R ${rr.toFixed(2)} is below your ${limits.minRR.toFixed(1)} minimum.`
    })
  } else {
    checks.push({
      id: 'rrGate',
      label: 'Reward : risk',
      severity: 'ok',
      detail: `R:R ${rr.toFixed(2)} ≥ ${limits.minRR.toFixed(1)} minimum.`
    })
  }

  // Per-trade risk cap (only when we can size it).
  if (
    trade.accountEquity != null &&
    trade.quantity != null &&
    trade.accountEquity > 0
  ) {
    const riskAmount = Math.abs(trade.entry - trade.stop) * trade.quantity
    const riskPct = riskAmount / trade.accountEquity
    if (riskPct > limits.maxRiskPerTradePct) {
      checks.push({
        id: 'sizeCap',
        label: 'Risk per trade',
        severity: 'warn',
        detail: `Risking ${(riskPct * 100).toFixed(2)}% — over your ${(limits.maxRiskPerTradePct * 100).toFixed(2)}% cap. Size down.`
      })
    } else {
      checks.push({
        id: 'sizeCap',
        label: 'Risk per trade',
        severity: 'ok',
        detail: `Risking ${(riskPct * 100).toFixed(2)}% · cap ${(limits.maxRiskPerTradePct * 100).toFixed(2)}%.`
      })
    }
  }

  // Open-position cap.
  if (state.openPositions >= limits.maxOpenPositions) {
    checks.push({
      id: 'maxOpen',
      label: 'Open positions',
      severity: 'warn',
      detail: `${state.openPositions} open — at your ${limits.maxOpenPositions} cap. Avoid over-exposure.`
    })
  } else {
    checks.push({
      id: 'maxOpen',
      label: 'Open positions',
      severity: 'ok',
      detail: `${state.openPositions} open · cap ${limits.maxOpenPositions}.`
    })
  }

  // Correlation / concentration.
  const correlated = (trade.openCorrelations ?? []).filter(
    (c) => Math.abs(c.correlation) >= limits.correlationWarn
  )
  if (correlated.length > 0) {
    const names = correlated.map((c) => c.symbol).join(', ')
    checks.push({
      id: 'correlation',
      label: 'Correlation',
      severity: 'warn',
      detail: `Highly correlated with open ${names} — this is effectively the same bet, not diversification.`
    })
  }

  return checks
}

/** Overall gate verdict combining every check. */
export interface RiskVerdict {
  severity: RiskSeverity
  checks: RiskCheck[]
  /** True when any rule is a hard block (lockout). */
  locked: boolean
}

/**
 * Full pre-trade discipline verdict: day-state lockouts plus the proposed-trade
 * checks, reduced to a single worst-severity verdict.
 *
 * @param trade The proposed trade (omit to evaluate standing day state only).
 * @param state Current day state.
 * @param limits Configured limits (defaults to {@link DEFAULT_RISK_LIMITS}).
 * @returns The combined {@link RiskVerdict}.
 */
export function riskVerdict(
  trade: ProposedTrade | null,
  state: RiskState,
  limits: RiskLimits = DEFAULT_RISK_LIMITS
): RiskVerdict {
  const checks = [
    ...evaluateDayState(state, limits),
    ...(trade ? evaluateTrade(trade, state, limits) : [])
  ]
  const severity = checks.reduce<RiskSeverity>((acc, c) => worst(acc, c.severity), 'ok')
  return { severity, checks, locked: severity === 'block' }
}
