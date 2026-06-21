import { describe, it, expect } from 'vitest'
import { defaultCanvas } from '../canvas/layout'

describe('defaultCanvas (single-widget default)', () => {
  it('returns exactly one widget', () => {
    expect(defaultCanvas().widgets).toHaveLength(1)
  })
  it('uses a 12-column grid', () => {
    expect(defaultCanvas().cols).toBe(12)
  })
  it('places the widget within bounds', () => {
    const l = defaultCanvas()
    const g = l.widgets[0]
    expect(g.x).toBeGreaterThanOrEqual(0)
    expect(g.y).toBeGreaterThanOrEqual(0)
    expect(g.x + g.w).toBeLessThanOrEqual(l.cols)
    expect(g.w).toBeGreaterThan(0)
    expect(g.h).toBeGreaterThan(0)
  })
  it('links the default widget to the global group', () => {
    expect(defaultCanvas().widgets[0].linked).toBe(true)
  })
  it('gives each call a fresh widget id', () => {
    expect(defaultCanvas().widgets[0].id).not.toBe(defaultCanvas().widgets[0].id)
  })
})
