import { describe, it, expect } from 'vitest'
import { defaultWorkspace, shouldSeedDefault } from '../canvas/onboarding'
import { isLinkable } from '../canvas/link'
import type { CanvasLayout } from '../canvas/types'

describe('defaultWorkspace', () => {
  it('returns a valid, in-bounds, non-empty layout', () => {
    const ws = defaultWorkspace()
    expect(ws.widgets.length).toBeGreaterThan(0)
    expect(ws.cols).toBeGreaterThan(0)
    for (const w of ws.widgets) {
      expect(w.x).toBeGreaterThanOrEqual(0)
      expect(w.y).toBeGreaterThanOrEqual(0)
      expect(w.w).toBeGreaterThanOrEqual(1)
      expect(w.h).toBeGreaterThanOrEqual(1)
      expect(w.x + w.w).toBeLessThanOrEqual(ws.cols)
    }
  })

  it('links exactly the linkable widgets', () => {
    const ws = defaultWorkspace()
    for (const w of ws.widgets) {
      expect(w.linked).toBe(isLinkable(w.moduleId))
    }
    // The curated default is crypto day-trade, which has at least one linkable.
    expect(ws.widgets.some((w) => w.linked)).toBe(true)
  })

  it('mints a fresh dashboard id and fresh widget ids each call', () => {
    const a = defaultWorkspace()
    const b = defaultWorkspace()
    expect(a.id).not.toBe(b.id)
    const aIds = a.widgets.map((w) => w.id)
    const bIds = b.widgets.map((w) => w.id)
    expect(aIds).not.toEqual(bIds)
    expect(new Set(aIds).size).toBe(aIds.length)
  })
})

describe('shouldSeedDefault', () => {
  it('is true for an empty dashboards list', () => {
    expect(shouldSeedDefault([])).toBe(true)
  })
  it('is false when at least one dashboard exists', () => {
    const one: CanvasLayout = { id: 'a', name: 'A', cols: 12, rowH: 48, widgets: [] }
    expect(shouldSeedDefault([one])).toBe(false)
  })
})
