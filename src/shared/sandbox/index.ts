/**
 * Public surface of the Indicator_Sandbox.
 *
 * The Chart_Renderer and AI custom-indicator builder import from this single module rather
 * than reaching into individual files. It re-exports, in one place (Req 10.5):
 *
 * - the whitelisted expression AST and its runtime membership sets ({@link module:sandbox/ast});
 * - the {@link IndicatorDefinition} schema and its validating parser
 *   ({@link module:sandbox/schema});
 * - the bounded, capability-free {@link evaluate} interpreter and its supporting types
 *   ({@link module:sandbox/interpreter}).
 *
 * This module contains **no DOM, canvas, or React references** and performs no IO.
 *
 * @module sandbox
 */

export * from './ast'
export * from './schema'
export * from './interpreter'
