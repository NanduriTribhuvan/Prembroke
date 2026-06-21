/**
 * Curated, per-persona dashboard templates ("apps"). Each template is a complete
 * {@link CanvasLayout} of real modules plus an AI-context hint and starter
 * prompts, so loading one drops the user into a ready-to-trade workspace.
 *
 * Every function is pure and side-effect free (UI-free): the caller passes the
 * list of valid module ids into {@link validateTemplate}, and the renderer wires
 * loading into its workspace store. Module ids referenced here MUST exist in the
 * renderer's `MODULES[]`; `validateTemplate` is the test-time guarantee.
 *
 * @module canvas/templates
 */

import type { CanvasLayout, ViewModuleId, WidgetInstance } from './types'
import { isLinkable } from './link'
import { DEFAULT_COLS, DEFAULT_ROW_H } from './layout'

/** A persona-tagged, loadable dashboard preset. */
export interface AppTemplate {
  /** Stable unique id. */
  id: string
  /** Human-readable name shown on the gallery card. */
  name: string
  /** Short persona/use-case label (e.g. `Crypto · day-trade`). */
  persona: string
  /** Optional global symbol to focus when this template loads. */
  symbol?: string
  /** The full layout (widgets reference existing module ids). */
  layout: CanvasLayout
  /** A one-paragraph hint seeded into the AI context when loaded. */
  aiContext: string
  /** Ready-made questions the user can click to ask the AI Mentor. */
  starterPrompts: string[]
}

/** A widget spec before id assignment (positions are authored, ids are minted). */
interface WidgetSpec {
  moduleId: ViewModuleId
  x: number
  y: number
  w: number
  h: number
}

/**
 * Build a {@link WidgetInstance} from a spec, defaulting `linked` to `true` only
 * for modules that accept a symbol/timeframe ({@link isLinkable}).
 */
function widget(id: string, spec: WidgetSpec): WidgetInstance {
  return {
    id,
    moduleId: spec.moduleId,
    x: spec.x,
    y: spec.y,
    w: spec.w,
    h: spec.h,
    linked: isLinkable(spec.moduleId)
  }
}

let widgetSeq = 0

/**
 * Generate a unique widget id (renderer `crypto.randomUUID` else a counter).
 *
 * @returns A unique string id.
 */
function makeWidgetId(): string {
  const g: { crypto?: { randomUUID?: () => string } } = globalThis
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID()
  widgetSeq += 1
  return `tw_${Date.now().toString(36)}_${widgetSeq.toString(36)}`
}

/** A standard 2x2 grid of 6-wide x 8-tall cells, plus a full-width 5th row. */
const QUAD: WidgetSpec['x'][] = [0, 6, 0, 6]
const QUAD_Y = [0, 0, 8, 8]

/** Build the four-up quad layout specs for a list of four module ids. */
function quad(ids: [ViewModuleId, ViewModuleId, ViewModuleId, ViewModuleId]): WidgetSpec[] {
  return ids.map((moduleId, i) => ({ moduleId, x: QUAD[i], y: QUAD_Y[i], w: 6, h: 8 }))
}

/** Build a layout from authored widget specs (ids minted at definition time). */
function layoutFrom(id: string, name: string, specs: WidgetSpec[]): CanvasLayout {
  return {
    id,
    name,
    cols: DEFAULT_COLS,
    rowH: DEFAULT_ROW_H,
    widgets: specs.map((spec) => widget(makeWidgetId(), spec))
  }
}

/**
 * The built-in app templates. Each references only modules that exist in the
 * renderer registry (verified by {@link validateTemplate} in tests).
 */
export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'crypto-day-trade',
    name: 'Crypto day-trade',
    persona: 'Crypto · intraday',
    symbol: 'BTCUSDT',
    layout: layoutFrom(
      'crypto-day-trade',
      'Crypto day-trade',
      quad(['conviction', 'orderbook', 'flow', 'derivatives'])
    ),
    aiContext:
      'You are assisting an intraday crypto trader. Focus on market structure, order-book imbalance, liquidations, and funding/open-interest shifts on the active symbol.',
    starterPrompts: [
      'What is the current market structure and bias?',
      'Is the order book leaning bid or offer right now?',
      'Are funding and open interest confirming the move?'
    ]
  },
  {
    id: 'options-vol',
    name: 'Options & volatility',
    persona: 'Crypto · options/vol',
    symbol: 'BTCUSDT',
    layout: layoutFrom(
      'options-vol',
      'Options & volatility',
      quad(['cryptooptions', 'options', 'derivatives', 'charts'])
    ),
    aiContext:
      'You are assisting an options and volatility trader. Focus on implied-volatility term structure, skew, dealer gamma, and how spot positioning interacts with options flow.',
    starterPrompts: [
      'What does the IV term structure imply about expected moves?',
      'Where is dealer gamma positioned and what is the flip level?',
      'Is skew signalling downside or upside demand?'
    ]
  },
  {
    id: 'onchain-defi',
    name: 'On-chain & DeFi',
    persona: 'Crypto · on-chain',
    layout: layoutFrom(
      'onchain-defi',
      'On-chain & DeFi',
      quad(['onchain', 'dex', 'defi', 'news'])
    ),
    aiContext:
      'You are assisting an on-chain and DeFi analyst. Focus on chain activity, trending DEX pairs, yields and TVL shifts, and protocol or bridge risk.',
    starterPrompts: [
      'Which trending pairs show unusual volume versus liquidity?',
      'Where are the best risk-adjusted yields right now?',
      'Any recent exploits or TVL outflows worth flagging?'
    ]
  },
  {
    id: 'fx-desk',
    name: 'FX desk',
    persona: 'Forex · macro',
    symbol: 'EURUSD',
    layout: layoutFrom('fx-desk', 'FX desk', quad(['markets', 'charts', 'calendar', 'news'])),
    aiContext:
      'You are assisting an FX trader. Focus on cross-pair strength, technical levels, upcoming economic events, and headline risk around the active pair.',
    starterPrompts: [
      'Which currencies are strongest and weakest today?',
      'What high-impact events are due in the next session?',
      'What are the key technical levels on the active pair?'
    ]
  },
  {
    id: 'macro-rates',
    name: 'Macro & rates',
    persona: 'Macro · cross-asset',
    layout: layoutFrom(
      'macro-rates',
      'Macro & rates',
      quad(['dashboard', 'calendar', 'onchain', 'news'])
    ),
    aiContext:
      'You are assisting a macro analyst. Focus on cross-asset dashboards, the economic calendar, liquidity conditions, and how macro catalysts map to risk assets.',
    starterPrompts: [
      'What is the macro setup into this week?',
      'Which calendar events could move risk assets?',
      'How are liquidity conditions trending?'
    ]
  },
  {
    id: 'swing-equities',
    name: 'Swing equities',
    persona: 'Equities · swing',
    symbol: 'AAPL',
    layout: layoutFrom(
      'swing-equities',
      'Swing equities',
      quad(['stocks', 'fundamentals', 'financials', 'filings'])
    ),
    aiContext:
      'You are assisting a swing equity trader. Focus on price trend, fundamentals, financial statements, and recent SEC filings for the active ticker.',
    starterPrompts: [
      'Summarise the fundamental picture for this name.',
      'What stands out in the latest financials?',
      'Any recent filings that change the thesis?'
    ]
  }
]

/**
 * Look up a template by id.
 *
 * @param id Template id.
 * @returns The matching {@link AppTemplate}, or `undefined`.
 */
export function getTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find((t) => t.id === id)
}

/**
 * Materialize a template into a loadable dashboard with fresh widget ids.
 *
 * The template's authored positions/sizes and per-widget `linked` flags are
 * preserved; only the widget ids (and the layout id) are regenerated so the new
 * dashboard is independent of the static template and of any other clone.
 *
 * @param t Template to load.
 * @returns A fresh {@link CanvasLayout} ready to push into the dashboards list.
 */
export function templateToDashboard(t: AppTemplate): CanvasLayout {
  const g: { crypto?: { randomUUID?: () => string } } = globalThis
  const id =
    g.crypto && typeof g.crypto.randomUUID === 'function'
      ? g.crypto.randomUUID()
      : `dash_${t.id}_${Date.now().toString(36)}`
  return {
    ...t.layout,
    id,
    name: t.name,
    widgets: t.layout.widgets.map((w) => ({ ...w, id: makeWidgetId() }))
  }
}

/** Outcome of validating one template against the registry. */
export interface TemplateValidation {
  /** `true` when the template is internally consistent and in-bounds. */
  ok: boolean
  /** Human-readable problems (empty when `ok`). */
  problems: string[]
}

/**
 * Validate a template: non-empty widgets, every `moduleId` present in the passed
 * `validIds`, and every widget within the layout's column bounds.
 *
 * UI-free by design — the caller supplies the valid id list (the renderer passes
 * its `MODULES[]` ids), so the shared zone never imports the registry.
 *
 * @param t Template to check.
 * @param validIds The set/array of module ids that actually exist.
 * @returns A {@link TemplateValidation}.
 */
export function validateTemplate(t: AppTemplate, validIds: readonly string[]): TemplateValidation {
  const valid = new Set(validIds)
  const problems: string[] = []
  if (t.layout.widgets.length === 0) problems.push(`template "${t.id}" has no widgets`)
  if (t.starterPrompts.length === 0) problems.push(`template "${t.id}" has no starter prompts`)
  for (const w of t.layout.widgets) {
    if (!valid.has(w.moduleId)) {
      problems.push(`template "${t.id}" references unknown module "${w.moduleId}"`)
    }
    if (w.x < 0 || w.y < 0 || w.w < 1 || w.h < 1 || w.x + w.w > t.layout.cols) {
      problems.push(`template "${t.id}" widget "${w.moduleId}" is out of bounds`)
    }
  }
  return { ok: problems.length === 0, problems }
}
