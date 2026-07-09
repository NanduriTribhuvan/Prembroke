/**
 * The Indicator_Definition schema and its validating parser.
 *
 * An {@link IndicatorDefinition} is a JSON, data-only specification of a Custom_Indicator
 * — no code strings, no function bodies. {@link parseIndicatorDefinition} narrows an
 * untrusted `unknown` value (for example, a parsed AI_Router response) into a fully
 * typed definition, rejecting any object whose expression tree contains a node shape,
 * series name, operator, or primitive function outside the closed whitelist defined in
 * {@link module:sandbox/ast}. This validation is the sandbox's security boundary: a value
 * that survives it cannot reference `eval`, `Function`, network, DOM, or file-system
 * capabilities, because none of those shapes exist in the accepted union
 * (Requirements 9.2, 10.2, 10.3).
 *
 * This module contains **no DOM, canvas, or React references** and performs no IO.
 *
 * @module sandbox/schema
 */

import {
  BINARY_OPS,
  PRIMITIVE_FNS,
  SERIES_NAMES,
  err,
  ok,
  type BinaryOp,
  type Expr,
  type PrimitiveFn,
  type Result,
  type SeriesName
} from './ast'

/** Where an indicator's output is drawn: over the price pane or in its own sub-pane. */
export type RenderTarget = 'overlay' | 'subpane'

/** A declared numeric parameter with a default and optional inclusive bounds. */
export interface IndicatorParam {
  /** Parameter name, referenced by `{ t: 'param'; name }` expression nodes. */
  name: string
  /** Default value used when the user does not override it. */
  default: number
  /** Optional inclusive lower bound. */
  min?: number
  /** Optional inclusive upper bound. */
  max?: number
}

/** One output line: a label, optional color, and the expression that computes it. */
export interface IndicatorOutput {
  /** Human-readable label for the output line. */
  label: string
  /** Optional CSS color for rendering the line. */
  color?: string
  /** The whitelisted expression tree computing this line's values. */
  expr: Expr
}

/**
 * A serializable, data-only Custom_Indicator specification.
 *
 * Computation lives entirely in the {@link IndicatorOutput.expr} trees, expressed with
 * the whitelisted {@link Expr} union. The definition itself carries no executable code.
 */
export interface IndicatorDefinition {
  /** Schema version discriminator; currently always `1`. */
  schemaVersion: 1
  /** Display name of the indicator. */
  name: string
  /** Whether the indicator draws as a price-pane overlay or in a sub-pane. */
  target: RenderTarget
  /** Declared numeric parameters with defaults and optional bounds. */
  params: IndicatorParam[]
  /** One or more output lines, each an expression over inputs/params/primitives. */
  outputs: IndicatorOutput[]
}

/** Narrow an `unknown` to a non-null, non-array plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Narrow an `unknown` to a finite number (rejects `NaN`, `Infinity`, and non-numbers). */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Recursively validate and narrow an untrusted value into an {@link Expr}.
 *
 * Every node is checked against the closed whitelist: the discriminant `t`, the set of
 * required fields for that variant, and — for `series`, `op`, and `call` — membership in
 * {@link SERIES_NAMES}, {@link BINARY_OPS}, and {@link PRIMITIVE_FNS} respectively. Any
 * unexpected field shape, extra discriminant, or non-whitelisted identifier is rejected.
 *
 * @param raw   the untrusted value to validate
 * @param path  a human-readable location used in error messages
 */
function parseExpr(raw: unknown, path: string): Result<Expr, string> {
  if (!isRecord(raw)) {
    return err(`${path}: expected an expression object`)
  }

  const t = raw.t
  if (typeof t !== 'string') {
    return err(`${path}: expression is missing a string "t" discriminant`)
  }

  switch (t) {
    case 'num': {
      if (!isFiniteNumber(raw.value)) {
        return err(`${path}: "num" node requires a finite numeric "value"`)
      }
      return ok({ t: 'num', value: raw.value })
    }

    case 'param': {
      if (typeof raw.name !== 'string' || raw.name.length === 0) {
        return err(`${path}: "param" node requires a non-empty string "name"`)
      }
      return ok({ t: 'param', name: raw.name })
    }

    case 'series': {
      if (typeof raw.name !== 'string' || !SERIES_NAMES.has(raw.name as SeriesName)) {
        return err(`${path}: "series" node has an unknown series name`)
      }
      return ok({ t: 'series', name: raw.name as SeriesName })
    }

    case 'op': {
      if (typeof raw.op !== 'string' || !BINARY_OPS.has(raw.op as BinaryOp)) {
        return err(`${path}: "op" node has an unsupported operator`)
      }
      const a = parseExpr(raw.a, `${path}.a`)
      if (!a.ok) return a
      const b = parseExpr(raw.b, `${path}.b`)
      if (!b.ok) return b
      return ok({ t: 'op', op: raw.op as BinaryOp, a: a.value, b: b.value })
    }

    case 'call': {
      if (typeof raw.fn !== 'string' || !PRIMITIVE_FNS.has(raw.fn as PrimitiveFn)) {
        return err(`${path}: "call" node references a non-whitelisted function`)
      }
      if (!Array.isArray(raw.args)) {
        return err(`${path}: "call" node requires an "args" array`)
      }
      const args: Expr[] = []
      for (let i = 0; i < raw.args.length; i++) {
        const arg = parseExpr(raw.args[i], `${path}.args[${i}]`)
        if (!arg.ok) return arg
        args.push(arg.value)
      }
      return ok({ t: 'call', fn: raw.fn as PrimitiveFn, args })
    }

    default:
      return err(`${path}: unknown expression node type "${t}"`)
  }
}

/** Validate and narrow an untrusted value into an {@link IndicatorParam}. */
function parseParam(raw: unknown, path: string): Result<IndicatorParam, string> {
  if (!isRecord(raw)) {
    return err(`${path}: expected a parameter object`)
  }
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    return err(`${path}: parameter requires a non-empty string "name"`)
  }
  if (!isFiniteNumber(raw.default)) {
    return err(`${path}: parameter "${raw.name}" requires a finite "default"`)
  }
  const param: IndicatorParam = { name: raw.name, default: raw.default }
  if (raw.min !== undefined) {
    if (!isFiniteNumber(raw.min)) {
      return err(`${path}: parameter "${raw.name}" has a non-finite "min"`)
    }
    param.min = raw.min
  }
  if (raw.max !== undefined) {
    if (!isFiniteNumber(raw.max)) {
      return err(`${path}: parameter "${raw.name}" has a non-finite "max"`)
    }
    param.max = raw.max
  }
  if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
    return err(`${path}: parameter "${raw.name}" has min greater than max`)
  }
  return ok(param)
}

/** Validate and narrow an untrusted value into an {@link IndicatorOutput}. */
function parseOutput(raw: unknown, path: string): Result<IndicatorOutput, string> {
  if (!isRecord(raw)) {
    return err(`${path}: expected an output object`)
  }
  if (typeof raw.label !== 'string' || raw.label.length === 0) {
    return err(`${path}: output requires a non-empty string "label"`)
  }
  const exprResult = parseExpr(raw.expr, `${path}.expr`)
  if (!exprResult.ok) return exprResult
  const output: IndicatorOutput = { label: raw.label, expr: exprResult.value }
  if (raw.color !== undefined) {
    if (typeof raw.color !== 'string') {
      return err(`${path}: output "${raw.label}" has a non-string "color"`)
    }
    output.color = raw.color
  }
  return ok(output)
}

/**
 * Parse and validate an untrusted value into a typed {@link IndicatorDefinition}.
 *
 * The parser narrows from `unknown`, rejecting any value that does not conform exactly
 * to the schema — including definitions whose expression trees contain a node shape,
 * series name, operator, or primitive function outside the closed whitelist. On success
 * it returns `{ ok: true; value }`; on any violation it returns `{ ok: false; error }`
 * with a human-readable message pinpointing the offending field.
 *
 * @param raw an untrusted value, typically a JSON-parsed AI_Router response
 */
export function parseIndicatorDefinition(raw: unknown): Result<IndicatorDefinition, string> {
  if (!isRecord(raw)) {
    return err('definition: expected a JSON object')
  }

  if (raw.schemaVersion !== 1) {
    return err('definition: "schemaVersion" must be the literal 1')
  }

  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    return err('definition: requires a non-empty string "name"')
  }

  if (raw.target !== 'overlay' && raw.target !== 'subpane') {
    return err('definition: "target" must be "overlay" or "subpane"')
  }

  if (!Array.isArray(raw.params)) {
    return err('definition: "params" must be an array')
  }
  const params: IndicatorParam[] = []
  const seen = new Set<string>()
  for (let i = 0; i < raw.params.length; i++) {
    const parsed = parseParam(raw.params[i], `params[${i}]`)
    if (!parsed.ok) return parsed
    if (seen.has(parsed.value.name)) {
      return err(`params[${i}]: duplicate parameter name "${parsed.value.name}"`)
    }
    seen.add(parsed.value.name)
    params.push(parsed.value)
  }

  if (!Array.isArray(raw.outputs) || raw.outputs.length === 0) {
    return err('definition: "outputs" must be a non-empty array')
  }
  const outputs: IndicatorOutput[] = []
  for (let i = 0; i < raw.outputs.length; i++) {
    const parsed = parseOutput(raw.outputs[i], `outputs[${i}]`)
    if (!parsed.ok) return parsed
    outputs.push(parsed.value)
  }

  return ok({
    schemaVersion: 1,
    name: raw.name,
    target: raw.target,
    params,
    outputs
  })
}
