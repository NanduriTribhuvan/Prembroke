import { describe, it, expect } from 'vitest'
import {
  APP_TEMPLATES,
  getTemplate,
  templateToDashboard,
  validateTemplate
} from '../canvas/templates'
import { isLinkable } from '../canvas/link'

/**
 * The module ids that actually exist in the renderer's `MODULES[]`. Mirrored
 * here because the shared zone (and its node-env tests) cannot import the
 * renderer registry. If a module is added/removed, update this list.
 */
const VALID_IDS = [
  'alpha',
  'dashboard',
  'conviction',
  'scanner',
  'heatmap',
  'correlation',
  'backtest',
  'journal',
  'charts',
  'markets',
  'coins',
  'stocks',
  'fundamentals',
  'financials',
  'options',
  'cryptooptions',
  'filings',
  'derivatives',
  'flow',
  'orderbook',
  'onchain',
  'dex',
  'defi',
  'news',
  'tv',
  'social',
  'ai',
  'research',
  'playbook',
  'alerts',
  'toolkit',
  'calendar',
  'settings'
] as const

describe('APP_TEMPLATES', () => {
  it('has at least one template', () => {
    expect(APP_TEMPLATES.length).toBeGreaterThan(0)
  })

  it('every template has a unique id', () => {
    const ids = APP_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every template is non-empty, in-bounds, and references only real modules', () => {
    for (const t of APP_TEMPLATES) {
      const v = validateTemplate(t, VALID_IDS)
      expect(v.problems).toEqual([])
      expect(v.ok).toBe(true)
      expect(t.layout.widgets.length).toBeGreaterThan(0)
      expect(t.starterPrompts.length).toBeGreaterThanOrEqual(1)
      for (const w of t.layout.widgets) {
        expect(VALID_IDS).toContain(w.moduleId)
        expect(w.x).toBeGreaterThanOrEqual(0)
        expect(w.y).toBeGreaterThanOrEqual(0)
        expect(w.x + w.w).toBeLessThanOrEqual(t.layout.cols)
      }
    }
  })

  it('defaults linked only where the module is linkable', () => {
    for (const t of APP_TEMPLATES) {
      for (const w of t.layout.widgets) {
        expect(w.linked).toBe(isLinkable(w.moduleId))
      }
    }
  })
})

describe('validateTemplate', () => {
  it('flags an unknown module id', () => {
    const bad = {
      ...APP_TEMPLATES[0],
      layout: {
        ...APP_TEMPLATES[0].layout,
        widgets: [{ id: 'x', moduleId: 'not-a-real-module', x: 0, y: 0, w: 4, h: 4, linked: false }]
      }
    }
    const v = validateTemplate(bad, VALID_IDS)
    expect(v.ok).toBe(false)
    expect(v.problems.join(' ')).toContain('not-a-real-module')
  })

  it('flags an out-of-bounds widget', () => {
    const bad = {
      ...APP_TEMPLATES[0],
      layout: {
        ...APP_TEMPLATES[0].layout,
        widgets: [{ id: 'x', moduleId: 'conviction', x: 10, y: 0, w: 6, h: 4, linked: true }]
      }
    }
    const v = validateTemplate(bad, VALID_IDS)
    expect(v.ok).toBe(false)
    expect(v.problems.join(' ')).toContain('out of bounds')
  })
})

describe('getTemplate', () => {
  it('returns a template by id', () => {
    const t = getTemplate('crypto-day-trade')
    expect(t).toBeDefined()
    expect(t?.name).toBe('Crypto day-trade')
  })
  it('returns undefined for an unknown id', () => {
    expect(getTemplate('nope')).toBeUndefined()
  })
})

describe('templateToDashboard', () => {
  it('mints fresh, unique widget ids while preserving positions', () => {
    const t = APP_TEMPLATES[0]
    const d = templateToDashboard(t)
    // Fresh dashboard + widget ids.
    expect(d.id).not.toBe(t.layout.id)
    const ids = d.widgets.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toEqual(t.layout.widgets.map((w) => w.id))
    // Positions / sizes / linked preserved 1:1.
    d.widgets.forEach((w, i) => {
      const src = t.layout.widgets[i]
      expect(w).toMatchObject({
        moduleId: src.moduleId,
        x: src.x,
        y: src.y,
        w: src.w,
        h: src.h,
        linked: src.linked
      })
    })
  })

  it('produces an independent copy (mutating the clone does not touch the template)', () => {
    const t = APP_TEMPLATES[0]
    const d = templateToDashboard(t)
    d.widgets[0].x = 99
    expect(t.layout.widgets[0].x).not.toBe(99)
  })

  it('keeps linked only where isLinkable', () => {
    for (const t of APP_TEMPLATES) {
      const d = templateToDashboard(t)
      for (const w of d.widgets) {
        expect(w.linked).toBe(isLinkable(w.moduleId))
      }
    }
  })
})
