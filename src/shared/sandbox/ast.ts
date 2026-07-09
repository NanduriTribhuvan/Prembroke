/**
 * Whitelisted expression AST for the Indicator_Sandbox.
 *
 * This module defines the **only** node shapes and primitive functions the sandbox
 * interpreter will ever accept. A Custom_Indicator is pure data — there are no code
 * strings, no function bodies, and no ambient identifiers. Because computation is
 * expressed as a closed, discriminated union of {@link Expr} nodes, there is no
 * surface for `eval`, `Function`, network, DOM, or file-system capabilities to appear
 * (Requirements 10.2, 10.3).
 *
 * This module contains **no DOM, canvas, or React references** and performs no IO.
 *
 * @module sandbox/ast
 */

/**
 * A minimal, dependency-free result type used across the sandbox module.
 *
 * The codebase had no shared `Result` type at the time this module was written, so a
 * small tagged union is defined here and reused by {@link module:sandbox/schema} and
 * the interpreter. `ok: true` carries a `value`; `ok: false` carries an `error`.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

/** Construct a successful {@link Result}. */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value }
}

/** Construct a failed {@link Result}. */
export function err<E, T = never>(error: E): Result<T, E> {
  return { ok: false, error }
}

/**
 * The named OHLCV-derived input series a definition may reference.
 *
 * `hlc3` = `(high + low + close) / 3`; `ohlc4` = `(open + high + low + close) / 4`.
 * These are the only series identifiers the interpreter resolves.
 */
export type SeriesName = 'open' | 'high' | 'low' | 'close' | 'volume' | 'hlc3' | 'ohlc4'

/**
 * The fixed set of composable primitive functions. Each maps to a pure
 * `@shared/indicators` (or arithmetic) operation in the interpreter's lookup table.
 * No other function name is accepted.
 */
export type PrimitiveFn =
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'atr'
  | 'stdev'
  | 'highest'
  | 'lowest'
  | 'abs'
  | 'max'
  | 'min'
  | 'clamp'
  | 'shift'

/** The binary arithmetic operators permitted in an {@link Expr}. */
export type BinaryOp = '+' | '-' | '*' | '/'

/**
 * The whitelisted expression node union — the ONLY shapes the interpreter accepts.
 *
 * - `num`    — a numeric literal.
 * - `param`  — resolves to a declared parameter's value by name.
 * - `series` — resolves to a named OHLCV-derived input series.
 * - `op`     — a binary arithmetic operation over two sub-expressions.
 * - `call`   — an application of a whitelisted {@link PrimitiveFn} to argument expressions.
 */
export type Expr =
  | { t: 'num'; value: number }
  | { t: 'param'; name: string }
  | { t: 'series'; name: SeriesName }
  | { t: 'op'; op: BinaryOp; a: Expr; b: Expr }
  | { t: 'call'; fn: PrimitiveFn; args: Expr[] }

/** The set of valid {@link SeriesName} values, for runtime membership checks. */
export const SERIES_NAMES: ReadonlySet<SeriesName> = new Set<SeriesName>([
  'open',
  'high',
  'low',
  'close',
  'volume',
  'hlc3',
  'ohlc4'
])

/** The set of valid {@link PrimitiveFn} values, for runtime membership checks. */
export const PRIMITIVE_FNS: ReadonlySet<PrimitiveFn> = new Set<PrimitiveFn>([
  'sma',
  'ema',
  'rsi',
  'atr',
  'stdev',
  'highest',
  'lowest',
  'abs',
  'max',
  'min',
  'clamp',
  'shift'
])

/** The set of valid {@link BinaryOp} values, for runtime membership checks. */
export const BINARY_OPS: ReadonlySet<BinaryOp> = new Set<BinaryOp>(['+', '-', '*', '/'])
