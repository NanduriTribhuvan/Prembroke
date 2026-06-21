import { describe, it, expect } from 'vitest'
import {
  rectsOverlap,
  clampRect,
  findFreeSlot,
  moveWidget,
  resizeWidget,
  compactVertical,
  addWidget,
  removeWidget,
  setLinked,
  snapToGrid,
  pxToGrid,
  gridToPx,
  defaultCanvas,
  DEFAULT_COLS
} from '../canvas/layout'
import type { CanvasLayout, WidgetInstance } from '../canvas/types'

/** Build a widget with sensible defaults for tests. */
function w(id: string, x: number, y: number, ww: number, hh: number, linked = false): WidgetInstance {
  return { id, moduleId: 'conviction', x, y, w: ww, h: hh, linked }
}

/** Build a layout around a set of widgets. */
function layoutOf(widgets: WidgetInstance[], cols = DEFAULT_COLS): CanvasLayout {
  return { id: 'l', name: 'L', cols, rowH: 48, widgets }
}

describe('rectsOverlap', () => {
  it('adjacent (touching edge) rectangles do not overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false)
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false)
  })
  it('a one-cell overlap is detected', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true)
  })
  it('containment counts as overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 6, h: 6 }, { x: 2, y: 2, w: 1, h: 1 })).toBe(true)
  })
  it('fully separated rectangles do not overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 5, y: 5, w: 2, h: 2 })).toBe(false)
  })
})

describe('clampRect', () => {
  it('clamps a width beyond cols', () => {
    expect(clampRect({ x: 0, y: 0, w: 20, h: 4 }, 12)).toEqual({ x: 0, y: 0, w: 12, h: 4 })
  })
  it('pushes a negative x to 0', () => {
    expect(clampRect({ x: -3, y: 0, w: 4, h: 4 }, 12)).toEqual({ x: 0, y: 0, w: 4, h: 4 })
  })
  it('shifts an origin so the right edge stays in bounds', () => {
    expect(clampRect({ x: 11, y: 1, w: 4, h: 2 }, 12)).toEqual({ x: 8, y: 1, w: 4, h: 2 })
  })
  it('floors negative y at 0 and width/height at 1', () => {
    expect(clampRect({ x: 0, y: -2, w: 0, h: 0 }, 12)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})

describe('findFreeSlot', () => {
  it('returns (0,0) for an empty layout', () => {
    expect(findFreeSlot([], 4, 4, 12)).toEqual({ x: 0, y: 0 })
  })
  it('fills the first gap to the right', () => {
    const widgets = [w('a', 0, 0, 4, 4)]
    expect(findFreeSlot(widgets, 4, 4, 12)).toEqual({ x: 4, y: 0 })
  })
  it('wraps to the next row when the row is full', () => {
    const widgets = [w('a', 0, 0, 6, 4), w('b', 6, 0, 6, 4)]
    // No 6-wide gap remains on row 0; next free origin is row 4 (below).
    expect(findFreeSlot(widgets, 6, 4, 12)).toEqual({ x: 0, y: 4 })
  })
  it('places a 4th widget on row 2 when three fill row 1 (12 cols)', () => {
    const widgets = [w('a', 0, 0, 4, 4), w('b', 4, 0, 4, 4), w('c', 8, 0, 4, 4)]
    expect(findFreeSlot(widgets, 4, 4, 12)).toEqual({ x: 0, y: 4 })
  })
})

describe('moveWidget', () => {
  it('moves a widget and clamps at the right edge', () => {
    const l = layoutOf([w('a', 0, 0, 4, 4)])
    const r = moveWidget(l, 'a', 11, 2)
    expect(r.widgets[0]).toMatchObject({ x: 8, y: 2 })
  })
  it('is a no-op for an unknown id', () => {
    const l = layoutOf([w('a', 1, 1, 4, 4)])
    const r = moveWidget(l, 'zzz', 5, 5)
    expect(r.widgets[0]).toMatchObject({ x: 1, y: 1 })
  })
  it('does not mutate the source layout', () => {
    const l = layoutOf([w('a', 0, 0, 4, 4)])
    moveWidget(l, 'a', 5, 5)
    expect(l.widgets[0]).toMatchObject({ x: 0, y: 0 })
  })
})

describe('resizeWidget', () => {
  it('respects minW/minH', () => {
    const l = layoutOf([w('a', 0, 0, 4, 4)])
    const r = resizeWidget(l, 'a', 1, 1, 2, 2)
    expect(r.widgets[0]).toMatchObject({ w: 2, h: 2 })
  })
  it('floors a shrink-below-minimum at minW=2,minH=2 (resize-handle path)', () => {
    // The SE resize handle can request a 0x0 span; the floor must hold at 2x2.
    const l = layoutOf([w('a', 3, 1, 6, 6)])
    const r = resizeWidget(l, 'a', 0, 0, 2, 2)
    expect(r.widgets[0]).toMatchObject({ x: 3, y: 1, w: 2, h: 2 })
  })
  it('clamps the span at the right edge', () => {
    const l = layoutOf([w('a', 10, 0, 4, 4)])
    const r = resizeWidget(l, 'a', 6, 4, 2, 2)
    // width capped/shifted so it stays within 12 cols
    expect(r.widgets[0].x + r.widgets[0].w).toBeLessThanOrEqual(12)
  })
  it('is a no-op for an unknown id', () => {
    const l = layoutOf([w('a', 0, 0, 4, 4)])
    const r = resizeWidget(l, 'nope', 8, 8)
    expect(r.widgets[0]).toMatchObject({ w: 4, h: 4 })
  })
})

describe('drag math composition (useGridDrag)', () => {
  // The pointer hook converts a px delta -> grid delta via snapToGrid, then
  // hands the snapped origin to moveWidget. These cases lock that composition.
  it('snaps a fractional grid delta before moving (round-half-up)', () => {
    const l = layoutOf([w('a', 1, 1, 4, 4)])
    // A pointer drag that lands 2.5 cols right / 1.49 rows down from origin.
    const dx = snapToGrid(2.5) // -> 3
    const dy = snapToGrid(1.49) // -> 1
    const r = moveWidget(l, 'a', 1 + dx, 1 + dy)
    expect(r.widgets[0]).toMatchObject({ x: 4, y: 2 })
  })
  it('snaps a sub-half delta down to no movement', () => {
    const l = layoutOf([w('a', 2, 2, 3, 3)])
    const dx = snapToGrid(0.49) // -> 0
    const r = moveWidget(l, 'a', 2 + dx, 2)
    expect(r.widgets[0]).toMatchObject({ x: 2, y: 2 })
  })
  it('snaps a pixel delta to whole grid units via pxToGrid', () => {
    // 73px of horizontal drag at a 48px column width -> ~1.52 cols -> 2 cols.
    expect(pxToGrid(73, 48)).toBe(2)
  })
})

describe('compactVertical', () => {
  it('floats widgets up and removes vertical gaps', () => {
    const widgets = [w('a', 0, 5, 4, 2), w('b', 0, 10, 4, 2)]
    const r = compactVertical(widgets)
    expect(r.find((g) => g.id === 'a')).toMatchObject({ y: 0 })
    expect(r.find((g) => g.id === 'b')).toMatchObject({ y: 2 })
  })
  it('preserves order and stacks overlapping columns', () => {
    const widgets = [w('a', 0, 1, 6, 2), w('b', 0, 8, 6, 3), w('c', 6, 2, 6, 2)]
    const r = compactVertical(widgets)
    // a and b share column 0 -> b sits directly below a; c floats to top of its column
    expect(r.find((g) => g.id === 'a')).toMatchObject({ y: 0 })
    expect(r.find((g) => g.id === 'b')).toMatchObject({ y: 2 })
    expect(r.find((g) => g.id === 'c')).toMatchObject({ y: 0 })
  })
})

describe('addWidget', () => {
  it('assigns a non-overlapping slot and links by default', () => {
    const l = layoutOf([w('a', 0, 0, 12, 6)])
    const r = addWidget(l, 'charts')
    const added = r.widgets[r.widgets.length - 1]
    expect(added.moduleId).toBe('charts')
    expect(added.linked).toBe(true)
    expect(r.widgets.some((g) => g.id !== added.id && rectsOverlapWidgets(g, added))).toBe(false)
  })
  it('honors explicit size and linked:false', () => {
    const l = layoutOf([])
    const r = addWidget(l, 'news', { w: 3, h: 2, linked: false })
    expect(r.widgets[0]).toMatchObject({ w: 3, h: 2, linked: false, x: 0, y: 0 })
  })
})

describe('removeWidget', () => {
  it('drops the target and leaves others unchanged', () => {
    const l = layoutOf([w('a', 0, 0, 4, 4), w('b', 4, 0, 4, 4)])
    const r = removeWidget(l, 'a')
    expect(r.widgets).toHaveLength(1)
    expect(r.widgets[0].id).toBe('b')
    expect(r.widgets[0]).toMatchObject({ x: 4, y: 0 })
  })
})

describe('setLinked', () => {
  it('toggles only the target widget', () => {
    const l = layoutOf([w('a', 0, 0, 4, 4, true), w('b', 4, 0, 4, 4, true)])
    const r = setLinked(l, 'a', false)
    expect(r.widgets.find((g) => g.id === 'a')?.linked).toBe(false)
    expect(r.widgets.find((g) => g.id === 'b')?.linked).toBe(true)
  })
})

describe('snapToGrid', () => {
  it('rounds at the .49/.5/.51 boundaries', () => {
    expect(snapToGrid(0.49)).toBe(0)
    expect(snapToGrid(0.5)).toBe(1)
    expect(snapToGrid(0.51)).toBe(1)
  })
  it('snaps to a custom unit', () => {
    expect(snapToGrid(73, 48)).toBe(96)
    expect(snapToGrid(20, 48)).toBe(0)
  })
})

describe('pxToGrid / gridToPx', () => {
  it('round-trips whole grid units through pixels', () => {
    const unit = 48
    for (const units of [0, 1, 4, 8, 12]) {
      expect(pxToGrid(gridToPx(units, unit), unit)).toBe(units)
    }
  })
  it('gridToPx multiplies units by the pixel size', () => {
    expect(gridToPx(8, 48)).toBe(384)
  })
  it('pxToGrid rounds a pixel measurement to the nearest unit', () => {
    expect(pxToGrid(100, 48)).toBe(2)
    expect(pxToGrid(72, 48)).toBe(2)
    expect(pxToGrid(71, 48)).toBe(1)
  })
  it('guards against a non-positive unit', () => {
    expect(pxToGrid(100, 0)).toBe(0)
    expect(gridToPx(Number.NaN, 48)).toBe(0)
  })
})

describe('findFreeSlot (multi-widget wrap)', () => {
  it('lands the 4th of four equal widgets on row 2 across 12 cols', () => {
    const widgets = [
      w('a', 0, 0, 3, 4),
      w('b', 3, 0, 3, 4),
      w('c', 6, 0, 3, 4),
      w('d', 9, 0, 3, 4)
    ]
    // Row 0 is full for a 3-wide widget; the 5th must drop to row 4 (below).
    expect(findFreeSlot(widgets, 3, 4, 12)).toEqual({ x: 0, y: 4 })
  })
})

describe('compactVertical (multi-widget ordering)', () => {
  it('floats a staggered column up while preserving relative order', () => {
    const widgets = [
      w('top', 0, 3, 4, 2),
      w('mid', 0, 7, 4, 2),
      w('bot', 0, 12, 4, 3)
    ]
    const r = compactVertical(widgets)
    expect(r.find((g) => g.id === 'top')).toMatchObject({ y: 0 })
    expect(r.find((g) => g.id === 'mid')).toMatchObject({ y: 2 })
    expect(r.find((g) => g.id === 'bot')).toMatchObject({ y: 4 })
  })
})

describe('defaultCanvas', () => {
  it('returns a valid in-bounds single-widget layout', () => {
    const l = defaultCanvas()
    expect(l.cols).toBe(12)
    expect(l.widgets).toHaveLength(1)
    const g = l.widgets[0]
    expect(g.moduleId).toBe('conviction')
    expect(g.linked).toBe(true)
    expect(g.x).toBeGreaterThanOrEqual(0)
    expect(g.x + g.w).toBeLessThanOrEqual(l.cols)
    expect(g.y).toBeGreaterThanOrEqual(0)
    expect(g.h).toBeGreaterThan(0)
  })
})

/** Local overlap helper over full widgets (re-uses {@link rectsOverlap}). */
function rectsOverlapWidgets(a: WidgetInstance, b: WidgetInstance): boolean {
  return rectsOverlap(
    { x: a.x, y: a.y, w: a.w, h: a.h },
    { x: b.x, y: b.y, w: b.w, h: b.h }
  )
}
