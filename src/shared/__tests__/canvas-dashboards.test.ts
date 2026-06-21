import { describe, it, expect } from 'vitest'
import {
  upsertDashboard,
  removeDashboard,
  renameDashboard,
  cloneDashboard
} from '../canvas/dashboards'
import type { CanvasLayout, WidgetInstance } from '../canvas/types'

/** Build a widget for tests. */
function w(id: string, moduleId = 'conviction'): WidgetInstance {
  return { id, moduleId, x: 0, y: 0, w: 4, h: 4, linked: true }
}

/** Build a dashboard layout for tests. */
function dash(id: string, name: string, widgets: WidgetInstance[] = []): CanvasLayout {
  return { id, name, cols: 12, rowH: 48, widgets }
}

describe('upsertDashboard', () => {
  it('appends a dashboard with a new id', () => {
    const list = [dash('a', 'A')]
    const r = upsertDashboard(list, dash('b', 'B'))
    expect(r).toHaveLength(2)
    expect(r.map((d) => d.id)).toEqual(['a', 'b'])
  })
  it('replaces an existing dashboard by id, preserving order', () => {
    const list = [dash('a', 'A'), dash('b', 'B')]
    const r = upsertDashboard(list, dash('a', 'A renamed', [w('x')]))
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ id: 'a', name: 'A renamed' })
    expect(r[0].widgets).toHaveLength(1)
    expect(r[1].id).toBe('b')
  })
  it('does not mutate the source list', () => {
    const list = [dash('a', 'A')]
    upsertDashboard(list, dash('b', 'B'))
    expect(list).toHaveLength(1)
  })
})

describe('removeDashboard', () => {
  it('drops the dashboard with the matching id', () => {
    const list = [dash('a', 'A'), dash('b', 'B')]
    const r = removeDashboard(list, 'a')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('b')
  })
  it('is a no-op for an unknown id', () => {
    const list = [dash('a', 'A')]
    const r = removeDashboard(list, 'zzz')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('a')
  })
})

describe('renameDashboard', () => {
  it('renames by id and keeps the widgets intact', () => {
    const widgets = [w('x'), w('y')]
    const list = [dash('a', 'A', widgets)]
    const r = renameDashboard(list, 'a', 'Renamed')
    expect(r[0].name).toBe('Renamed')
    expect(r[0].widgets).toHaveLength(2)
    expect(r[0].widgets.map((g) => g.id)).toEqual(['x', 'y'])
  })
  it('only touches the targeted dashboard', () => {
    const list = [dash('a', 'A'), dash('b', 'B')]
    const r = renameDashboard(list, 'b', 'Bee')
    expect(r[0].name).toBe('A')
    expect(r[1].name).toBe('Bee')
  })
})

describe('cloneDashboard', () => {
  it('deep-copies widgets with fresh ids and a non-colliding name', () => {
    const list = [dash('a', 'Crypto', [w('x'), w('y')])]
    const r = cloneDashboard(list, 'a')
    expect(r).toHaveLength(2)
    const clone = r[1]
    expect(clone.id).not.toBe('a')
    expect(clone.name).toBe('Crypto copy')
    // Fresh widget ids, but same positions/modules.
    expect(clone.widgets).toHaveLength(2)
    expect(clone.widgets.map((g) => g.id)).not.toEqual(['x', 'y'])
    expect(clone.widgets[0]).toMatchObject({ moduleId: 'conviction', x: 0, y: 0, w: 4, h: 4 })
    // Deep copy: mutating the clone's widget must not affect the source.
    clone.widgets[0].x = 9
    expect(list[0].widgets[0].x).toBe(0)
  })
  it('avoids an existing copy name by numbering', () => {
    const list = [dash('a', 'Crypto'), dash('b', 'Crypto copy')]
    const r = cloneDashboard(list, 'a')
    expect(r[r.length - 1].name).toBe('Crypto copy 2')
  })
  it('returns the list unchanged for an unknown id', () => {
    const list = [dash('a', 'A')]
    const r = cloneDashboard(list, 'zzz')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('a')
  })
})
