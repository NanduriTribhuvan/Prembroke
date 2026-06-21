/**
 * Pure operations over a list of named canvas dashboards: upsert (add or replace
 * by id), remove, rename, and clone (deep-copy with fresh widget ids and a
 * non-colliding name).
 *
 * Every function is pure (inputs are never mutated) and side-effect free, so the
 * whole module is unit-testable in a node environment. The renderer's workspace
 * store wires these; it holds no list math of its own.
 *
 * @module canvas/dashboards
 */

import type { CanvasLayout, WidgetInstance } from './types'

/**
 * Generate a unique id.
 *
 * Uses `crypto.randomUUID()` when available (renderer / modern node), else a
 * monotonic counter so the shared zone stays runtime-agnostic.
 *
 * @returns A unique string id.
 */
function makeId(): string {
  const g: { crypto?: { randomUUID?: () => string } } = globalThis
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID()
  idSeq += 1
  return `id_${Date.now().toString(36)}_${idSeq.toString(36)}`
}

let idSeq = 0

/**
 * Add a dashboard to the list, or replace the existing one with the same id.
 *
 * Matching is by `id`: a new id is appended; an existing id is replaced in
 * place, preserving list order.
 *
 * @param list Source list (not mutated).
 * @param layout Dashboard to insert or replace.
 * @returns A new list with `layout` upserted.
 */
export function upsertDashboard(list: CanvasLayout[], layout: CanvasLayout): CanvasLayout[] {
  const idx = list.findIndex((d) => d.id === layout.id)
  if (idx === -1) return [...list, layout]
  const next = [...list]
  next[idx] = layout
  return next
}

/**
 * Remove a dashboard by id.
 *
 * @param list Source list (not mutated).
 * @param id Id of the dashboard to drop.
 * @returns A new list without that dashboard; others are untouched.
 */
export function removeDashboard(list: CanvasLayout[], id: string): CanvasLayout[] {
  return list.filter((d) => d.id !== id)
}

/**
 * Rename a dashboard by id, leaving its widgets and everything else intact.
 *
 * @param list Source list (not mutated).
 * @param id Id of the dashboard to rename.
 * @param name New display name.
 * @returns A new list with only that dashboard's `name` changed.
 */
export function renameDashboard(list: CanvasLayout[], id: string, name: string): CanvasLayout[] {
  return list.map((d) => (d.id === id ? { ...d, name } : d))
}

/**
 * Pick a name for a copy of `base` that does not collide with any name in `list`.
 *
 * Appends ` copy`, then ` copy 2`, ` copy 3`, … until the name is unique.
 *
 * @param list Existing dashboards (their names are avoided).
 * @param baseName Name of the dashboard being copied.
 * @returns A unique, human-readable copy name.
 */
function uniqueCopyName(list: CanvasLayout[], baseName: string): string {
  const taken = new Set(list.map((d) => d.name))
  let candidate = `${baseName} copy`
  let n = 2
  while (taken.has(candidate)) {
    candidate = `${baseName} copy ${n}`
    n += 1
  }
  return candidate
}

/**
 * Deep-copy a dashboard, giving it a fresh id, fresh widget ids, and a
 * non-colliding name. The clone is appended to the returned list.
 *
 * Returns the list unchanged when `id` matches no dashboard.
 *
 * @param list Source list (not mutated).
 * @param id Id of the dashboard to clone.
 * @returns A new list with the clone appended (or the original list if not found).
 */
export function cloneDashboard(list: CanvasLayout[], id: string): CanvasLayout[] {
  const src = list.find((d) => d.id === id)
  if (!src) return list
  const widgets: WidgetInstance[] = src.widgets.map((g) => ({ ...g, id: makeId() }))
  const clone: CanvasLayout = {
    ...src,
    id: makeId(),
    name: uniqueCopyName(list, src.name),
    widgets
  }
  return [...list, clone]
}
