/**
 * The Indicator_Sandbox evaluator — a bounded, capability-free tree-walking interpreter.
 *
 * {@link evaluate} walks the whitelisted {@link Expr} union of a validated
 * {@link IndicatorDefinition} and produces one index-aligned `number[]` per output line.
 * It is the runtime half of the sandbox's security boundary (Requirement 10):
 *
 * - **No arbitrary code (10.2):** evaluation is a `switch` over `Expr.t`. There is no path
 *   that builds or invokes a function from a string — no `eval`, no `new Function`, no
 *   dynamic `import`. Each `call` node dispatches a {@link PrimitiveFn} union member to a
 *   fixed table of pure numeric operations.
 * - **No network / DOM / fs (10.3):** the evaluator closes over only the numeric
 *   {@link Ohlcv} arrays, the resolved parameter values, and its own primitive table. It
 *   references no `window`, `fetch`, `document`, `process`, or Node built-in.
 * - **Operates only on OHLCV (10.1):** all inputs are numeric arrays derived from
 *   `Candle[]`; the interpreter never touches the original candle objects' non-numeric fields.
 * - **Bounded and total (10.4):** a step counter increments per node-visit × element and a
 *   recursion-depth guard bounds nesting. Exceeding either aborts with a typed
 *   {@link SandboxError}. Division by zero and any non-finite intermediate collapse to `NaN`
 *   in that element (surfaced by the renderer as a warmup/omitted point) rather than throwing.
 *   {@link evaluate} **never throws**; every failure is returned as a `Result` error.
 *
 * This module contains **no DOM, canvas, or React references** and performs no IO.
 *
 * @module sandbox/interpreter
 */

import { ema, sma } from '../indicators/moving-averages'
import { rsi } from '../indicators/oscillators'
import { atr } from '../indicators/volatility'
import type { Candle } from '../indicators/types'
import { err, ok, type Expr, type PrimitiveFn, type Result, type SeriesName } from './ast'
import type { IndicatorDefinition } from './schema'

/** Numeric OHLCV input series, each index-aligned and derived from `Candle[]` (Req 10.1). */
export interface Ohlcv {
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: number[]
}

/** Bounds that keep evaluation total and cheap regardless of the definition (Req 10.4). */
export interface SandboxLimits {
  /** Max evaluation steps (node visits × series length) before aborting. */
  maxSteps: number
  /** Max output lines and max primitive/operator nesting depth. */
  maxDepth: number
}

/** Default bounds applied when the caller does not supply {@link SandboxLimits}. */
export const DEFAULT_LIMITS: SandboxLimits = {
  maxSteps: 5_000_000,
  maxDepth: 32
}

/**
 * A typed evaluation failure. The renderer omits the offending indicator's output and shows
 * an inline note; other indicators are unaffected.
 *
 * - `step-limit` — the step budget was exhausted.
 * - `depth-limit` — nesting depth or output count exceeded {@link SandboxLimits.maxDepth}.
 * - `bad-node` — a structurally invalid node (e.g. primitive arity mismatch). Should be
 *   unreachable for definitions that passed `parseIndicatorDefinition`.
 * - `math` — a scalar argument (such as a lookback period) was non-finite or out of range.
 */
export type SandboxError =
  | { code: 'step-limit' }
  | { code: 'depth-limit' }
  | { code: 'bad-node' }
  | { code: 'math'; detail: string }

/** Internal control-flow signal used to abort evaluation; never escapes {@link evaluate}. */
class SandboxAbort extends Error {
  constructor(readonly error: SandboxError) {
    super(error.code)
    this.name = 'SandboxAbort'
  }
}

/** Mutable evaluation context shared across every output line of a single definition. */
interface Context {
  readonly ohlcv: Ohlcv
  readonly n: number
  readonly params: Record<string, number>
  readonly limits: SandboxLimits
  /** Remaining step budget; decremented as nodes are visited. */
  steps: number
}

/** Coerce any non-finite value (`NaN`, `±Infinity`) to `NaN` so arrays stay well-formed. */
function finite(x: number): number {
  return Number.isFinite(x) ? x : NaN
}

/** Charge `cost` steps against the budget, aborting with `step-limit` if exhausted (Req 10.4). */
function charge(ctx: Context, cost: number): void {
  ctx.steps -= cost
  if (ctx.steps < 0) {
    throw new SandboxAbort({ code: 'step-limit' })
  }
}

/** Build a constant series of length `n` filled with `value`. */
function constant(n: number, value: number): number[] {
  return new Array<number>(n).fill(value)
}

/** Resolve a named OHLCV-derived series into a fresh, index-aligned `number[]` (Req 10.1). */
function resolveSeries(ctx: Context, name: SeriesName): number[] {
  const { ohlcv, n } = ctx
  const out = new Array<number>(n)
  switch (name) {
    case 'open':
      for (let i = 0; i < n; i++) out[i] = finite(ohlcv.open[i])
      return out
    case 'high':
      for (let i = 0; i < n; i++) out[i] = finite(ohlcv.high[i])
      return out
    case 'low':
      for (let i = 0; i < n; i++) out[i] = finite(ohlcv.low[i])
      return out
    case 'close':
      for (let i = 0; i < n; i++) out[i] = finite(ohlcv.close[i])
      return out
    case 'volume':
      for (let i = 0; i < n; i++) out[i] = finite(ohlcv.volume[i])
      return out
    case 'hlc3':
      for (let i = 0; i < n; i++) out[i] = finite((ohlcv.high[i] + ohlcv.low[i] + ohlcv.close[i]) / 3)
      return out
    case 'ohlc4':
      for (let i = 0; i < n; i++) {
        out[i] = finite((ohlcv.open[i] + ohlcv.high[i] + ohlcv.low[i] + ohlcv.close[i]) / 4)
      }
      return out
    default:
      // Exhaustiveness guard: unreachable for a validated SeriesName.
      return assertNever(name)
  }
}

/** Extract a scalar from an argument series (constant nodes fill every index identically). */
function scalarOf(series: number[]): number {
  for (let i = 0; i < series.length; i++) {
    if (Number.isFinite(series[i])) return series[i]
  }
  return NaN
}

/** Read and validate an integer lookback period from an argument series. */
function periodOf(series: number[], fn: PrimitiveFn): number {
  const raw = scalarOf(series)
  if (!Number.isFinite(raw)) {
    throw new SandboxAbort({ code: 'math', detail: `${fn}: period is not a finite number` })
  }
  const period = Math.round(raw)
  if (period < 1) {
    throw new SandboxAbort({ code: 'math', detail: `${fn}: period must be >= 1` })
  }
  return period
}

/** Rolling population standard deviation over `period`; NaN-padded during warmup. */
function rollingStdev(values: number[], period: number): number[] {
  const n = values.length
  const out = new Array<number>(n).fill(NaN)
  for (let i = period - 1; i < n; i++) {
    let sum = 0
    let valid = true
    for (let j = i - period + 1; j <= i; j++) {
      if (!Number.isFinite(values[j])) {
        valid = false
        break
      }
      sum += values[j]
    }
    if (!valid) continue
    const mean = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean
      variance += d * d
    }
    out[i] = Math.sqrt(variance / period)
  }
  return out
}

/** Rolling extreme (`highest` or `lowest`) over `period`; NaN-padded during warmup. */
function rollingExtreme(values: number[], period: number, kind: 'highest' | 'lowest'): number[] {
  const n = values.length
  const out = new Array<number>(n).fill(NaN)
  for (let i = period - 1; i < n; i++) {
    let acc = kind === 'highest' ? -Infinity : Infinity
    let valid = true
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j]
      if (!Number.isFinite(v)) {
        valid = false
        break
      }
      if (kind === 'highest') {
        if (v > acc) acc = v
      } else if (v < acc) {
        acc = v
      }
    }
    out[i] = valid ? acc : NaN
  }
  return out
}

/** Shift a series by `k` (positive = lag/right, negative = lead/left); vacated slots are NaN. */
function shiftSeries(values: number[], k: number): number[] {
  const n = values.length
  const out = new Array<number>(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    const src = i - k
    if (src >= 0 && src < n) out[i] = values[src]
  }
  return out
}

/** Apply a binary operator element-wise, collapsing division-by-zero and overflow to NaN. */
function applyOp(op: '+' | '-' | '*' | '/', a: number[], b: number[], n: number): number[] {
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const x = a[i]
    const y = b[i]
    let r: number
    switch (op) {
      case '+':
        r = x + y
        break
      case '-':
        r = x - y
        break
      case '*':
        r = x * y
        break
      case '/':
        r = y === 0 ? NaN : x / y
        break
    }
    out[i] = finite(r)
  }
  return out
}

/** Reconstruct minimal `Candle[]` from the OHLCV arrays for `Candle`-based primitives (e.g. ATR). */
function toCandles(ohlcv: Ohlcv, n: number): Candle[] {
  const candles = new Array<Candle>(n)
  for (let i = 0; i < n; i++) {
    candles[i] = {
      time: i,
      open: ohlcv.open[i],
      high: ohlcv.high[i],
      low: ohlcv.low[i],
      close: ohlcv.close[i],
      volume: ohlcv.volume[i]
    }
  }
  return candles
}

/** Compile-time exhaustiveness guard that also aborts safely at runtime. */
function assertNever(_x: never): never {
  throw new SandboxAbort({ code: 'bad-node' })
}

/** Assert an exact argument count for a primitive, aborting with `bad-node` otherwise. */
function expectArity(args: number[][], count: number): void {
  if (args.length !== count) {
    throw new SandboxAbort({ code: 'bad-node' })
  }
}

/** Dispatch a whitelisted primitive over already-evaluated argument series. */
function dispatch(ctx: Context, fn: PrimitiveFn, args: number[][]): number[] {
  const n = ctx.n
  switch (fn) {
    case 'sma':
      expectArity(args, 2)
      return sma(args[0], periodOf(args[1], fn))
    case 'ema':
      expectArity(args, 2)
      return ema(args[0], periodOf(args[1], fn))
    case 'rsi':
      expectArity(args, 2)
      return rsi(args[0], periodOf(args[1], fn))
    case 'atr':
      expectArity(args, 1)
      return atr(toCandles(ctx.ohlcv, n), periodOf(args[0], fn))
    case 'stdev':
      expectArity(args, 2)
      return rollingStdev(args[0], periodOf(args[1], fn))
    case 'highest':
      expectArity(args, 2)
      return rollingExtreme(args[0], periodOf(args[1], fn), 'highest')
    case 'lowest':
      expectArity(args, 2)
      return rollingExtreme(args[0], periodOf(args[1], fn), 'lowest')
    case 'abs': {
      expectArity(args, 1)
      const out = new Array<number>(n)
      for (let i = 0; i < n; i++) out[i] = finite(Math.abs(args[0][i]))
      return out
    }
    case 'max': {
      expectArity(args, 2)
      const out = new Array<number>(n)
      for (let i = 0; i < n; i++) out[i] = finite(Math.max(args[0][i], args[1][i]))
      return out
    }
    case 'min': {
      expectArity(args, 2)
      const out = new Array<number>(n)
      for (let i = 0; i < n; i++) out[i] = finite(Math.min(args[0][i], args[1][i]))
      return out
    }
    case 'clamp': {
      expectArity(args, 3)
      const lo = scalarOf(args[1])
      const hi = scalarOf(args[2])
      const out = new Array<number>(n)
      for (let i = 0; i < n; i++) {
        const v = args[0][i]
        out[i] = finite(v < lo ? lo : v > hi ? hi : v)
      }
      return out
    }
    case 'shift':
      expectArity(args, 2)
      return shiftSeries(args[0], Math.round(scalarOf(args[1])))
    default:
      return assertNever(fn)
  }
}

/** Recursively evaluate an {@link Expr} into an index-aligned series, bounding steps and depth. */
function evalExpr(ctx: Context, expr: Expr, depth: number): number[] {
  if (depth > ctx.limits.maxDepth) {
    throw new SandboxAbort({ code: 'depth-limit' })
  }
  // Every node visit costs one step per element (Req 10.4).
  charge(ctx, ctx.n)

  switch (expr.t) {
    case 'num':
      return constant(ctx.n, finite(expr.value))
    case 'param': {
      const value = ctx.params[expr.name]
      return constant(ctx.n, Number.isFinite(value) ? value : NaN)
    }
    case 'series':
      return resolveSeries(ctx, expr.name)
    case 'op': {
      const a = evalExpr(ctx, expr.a, depth + 1)
      const b = evalExpr(ctx, expr.b, depth + 1)
      return applyOp(expr.op, a, b, ctx.n)
    }
    case 'call': {
      const args = new Array<number[]>(expr.args.length)
      for (let i = 0; i < expr.args.length; i++) {
        args[i] = evalExpr(ctx, expr.args[i], depth + 1)
      }
      return dispatch(ctx, expr.fn, args)
    }
    default:
      // Exhaustiveness guard: unreachable for a validated Expr.
      return assertNever(expr)
  }
}

/**
 * Resolve effective parameter values: start from each declared default, override with any
 * finite caller-supplied value, then clamp to declared inclusive `[min, max]` bounds.
 */
function resolveParams(def: IndicatorDefinition, provided: Record<string, number>): Record<string, number> {
  const eff: Record<string, number> = {}
  for (const p of def.params) {
    let v = provided[p.name]
    if (!Number.isFinite(v)) v = p.default
    if (p.min !== undefined && v < p.min) v = p.min
    if (p.max !== undefined && v > p.max) v = p.max
    eff[p.name] = v
  }
  // Preserve any extra finite values the caller passed for undeclared names.
  for (const key of Object.keys(provided)) {
    if (!(key in eff) && Number.isFinite(provided[key])) eff[key] = provided[key]
  }
  return eff
}

/**
 * Evaluate a validated {@link IndicatorDefinition} over numeric OHLCV arrays.
 *
 * Produces one index-aligned `number[]` per {@link IndicatorDefinition.outputs} entry, in
 * declaration order. The evaluation is bounded by {@link SandboxLimits} and **never throws**:
 * every failure — exhausted step budget, excessive nesting, structural anomaly, or an invalid
 * scalar argument — is returned as a `Result` error (Req 10.4). Division by zero and non-finite
 * intermediates collapse to `NaN` within the affected element rather than aborting.
 *
 * @param def    a definition already narrowed by `parseIndicatorDefinition`
 * @param ohlcv  numeric input series derived from `Candle[]` (Req 10.1)
 * @param params caller-supplied parameter overrides, merged over declared defaults
 * @param limits optional bounds; defaults to {@link DEFAULT_LIMITS}
 */
export function evaluate(
  def: IndicatorDefinition,
  ohlcv: Ohlcv,
  params: Record<string, number>,
  limits: SandboxLimits = DEFAULT_LIMITS
): Result<number[][], SandboxError> {
  try {
    // Guard output count against the depth/breadth budget (Req 10.4).
    if (def.outputs.length > limits.maxDepth) {
      return err({ code: 'depth-limit' })
    }

    const n = ohlcv.close.length
    const ctx: Context = {
      ohlcv,
      n,
      params: resolveParams(def, params),
      limits,
      steps: limits.maxSteps
    }

    const results: number[][] = new Array<number[]>(def.outputs.length)
    for (let i = 0; i < def.outputs.length; i++) {
      results[i] = evalExpr(ctx, def.outputs[i].expr, 1)
    }
    return ok(results)
  } catch (e) {
    if (e instanceof SandboxAbort) {
      return err(e.error)
    }
    // Any unexpected throw is contained as a structural failure — evaluate() never throws.
    return err({ code: 'bad-node' })
  }
}
