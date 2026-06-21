import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  addWidget,
  defaultCanvas,
  defaultWorkspace,
  getTemplate,
  removeWidget,
  setLinked,
  setWidgetModule,
  shouldSeedDefault,
  templateToDashboard,
  upsertDashboard,
  type CanvasLayout
} from '@shared/canvas'
import type { ViewId } from './view'

export type Layout = 1 | 2 | 4

export interface WorkspacePreset {
  name: string
  layout: Layout
  panes: ViewId[]
}

/** Build a fresh, empty-but-valid dashboard with the given name. */
function makeDashboard(name: string): CanvasLayout {
  const base = defaultCanvas()
  const g: { crypto?: { randomUUID?: () => string } } = globalThis
  const id =
    g.crypto && typeof g.crypto.randomUUID === 'function'
      ? g.crypto.randomUUID()
      : `dash_${Date.now().toString(36)}`
  return { ...base, id, name, widgets: [] }
}

interface WorkspaceState {
  layout: Layout
  /** Module shown in each pane (always length 4; first `layout` are visible). */
  panes: ViewId[]
  /** Index of the focused pane (0–3). */
  active: number
  /** Saved named layouts. */
  presets: WorkspacePreset[]
  /** Feature flag: render the widget canvas instead of the legacy tiled grid. */
  canvasEnabled: boolean
  /** The active widget-canvas layout (mirrors the active dashboard). */
  canvas: CanvasLayout
  /** All saved canvas dashboards. */
  dashboards: CanvasLayout[]
  /** Id of the currently-active dashboard within {@link dashboards}. */
  activeDashboardId: string
  setLayout: (n: Layout) => void
  setActive: (i: number) => void
  setPaneView: (i: number, v: ViewId) => void
  /** Open a module in the currently-focused pane (used by sidebar/command bar). */
  openInActive: (v: ViewId) => void
  savePreset: (name: string) => void
  loadPreset: (name: string) => void
  deletePreset: (name: string) => void
  /** Toggle the widget-canvas feature flag. */
  setCanvasEnabled: (v: boolean) => void
  /** Replace the active canvas layout wholesale. */
  setCanvas: (c: CanvasLayout) => void
  /** Add a widget for `moduleId` into the first free slot. */
  addCanvasWidget: (moduleId: ViewId) => void
  /** Remove a canvas widget by id. */
  removeCanvasWidget: (id: string) => void
  /** Swap the module a canvas widget renders. */
  setCanvasWidgetModule: (id: string, moduleId: ViewId) => void
  /** Toggle the link-group membership of a canvas widget. */
  setCanvasWidgetLinked: (id: string, linked: boolean) => void
  /** Save the current canvas as a new named dashboard and make it active. */
  saveDashboard: (name: string) => void
  /** Switch the active dashboard to `id` (no-op for an unknown id). */
  loadDashboard: (id: string) => void
  /** Delete a dashboard by id; falls back to another dashboard if it was active. */
  deleteDashboard: (id: string) => void
  /** Create a fresh empty dashboard named `name` and make it active. */
  newDashboard: (name: string) => void
  /** Load an app template into a fresh dashboard and make it active. */
  loadTemplate: (id: string) => void
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => {
      // First-run curated workspace; a returning profile's persisted dashboards
      // override this via the persist merge (and onRehydrateStorage reconciles).
      const seed = defaultWorkspace()
      return {
        layout: 1,
        panes: ['alpha', 'conviction', 'charts', 'news'],
        active: 0,
        presets: [
          { name: 'Crypto desk', layout: 4, panes: ['conviction', 'orderbook', 'flow', 'news'] },
          { name: 'Macro desk', layout: 4, panes: ['dashboard', 'calendar', 'onchain', 'news'] },
          { name: 'Scout', layout: 2, panes: ['scanner', 'heatmap', 'charts', 'news'] }
        ],
        canvasEnabled: false,
        canvas: seed,
        dashboards: [seed],
        activeDashboardId: seed.id,
        setLayout: (n) => set({ layout: n, active: Math.min(get().active, n - 1) }),
        setActive: (i) => set({ active: i }),
        setPaneView: (i, v) =>
          set((s) => {
            const panes = [...s.panes]
            panes[i] = v
            return { panes }
          }),
        openInActive: (v) =>
          set((s) => {
            const panes = [...s.panes]
            panes[s.active] = v
            return { panes }
          }),
        savePreset: (name) =>
          set((s) => ({
            presets: [
              ...s.presets.filter((p) => p.name !== name),
              { name, layout: s.layout, panes: [...s.panes] }
            ]
          })),
        loadPreset: (name) =>
          set((s) => {
            const p = s.presets.find((x) => x.name === name)
            if (!p) return {}
            return { layout: p.layout, panes: [...p.panes], active: 0 }
          }),
        deletePreset: (name) => set((s) => ({ presets: s.presets.filter((p) => p.name !== name) })),
        setCanvasEnabled: (v) => set({ canvasEnabled: v }),
        // The active dashboard and the `canvas` mirror move together: every edit
        // to `canvas` is written back into `dashboards` by id so switching away
        // and back preserves it. The pure layout functions own all the math.
        setCanvas: (c) =>
          set((s) => ({ canvas: c, dashboards: upsertDashboard(s.dashboards, c) })),
        addCanvasWidget: (moduleId) =>
          set((s) => {
            const c = addWidget(s.canvas, moduleId)
            return { canvas: c, dashboards: upsertDashboard(s.dashboards, c) }
          }),
        removeCanvasWidget: (id) =>
          set((s) => {
            const c = removeWidget(s.canvas, id)
            return { canvas: c, dashboards: upsertDashboard(s.dashboards, c) }
          }),
        setCanvasWidgetModule: (id, moduleId) =>
          set((s) => {
            const c = setWidgetModule(s.canvas, id, moduleId)
            return { canvas: c, dashboards: upsertDashboard(s.dashboards, c) }
          }),
        setCanvasWidgetLinked: (id, linked) =>
          set((s) => {
            const c = setLinked(s.canvas, id, linked)
            return { canvas: c, dashboards: upsertDashboard(s.dashboards, c) }
          }),
        saveDashboard: (name) =>
          set((s) => {
            // Snapshot the current canvas under a fresh dashboard id + name.
            const g: { crypto?: { randomUUID?: () => string } } = globalThis
            const id =
              g.crypto && typeof g.crypto.randomUUID === 'function'
                ? g.crypto.randomUUID()
                : `dash_${Date.now().toString(36)}`
            const snapshot: CanvasLayout = { ...s.canvas, id, name }
            return {
              canvas: snapshot,
              dashboards: upsertDashboard(s.dashboards, snapshot),
              activeDashboardId: id
            }
          }),
        loadDashboard: (id) =>
          set((s) => {
            const d = s.dashboards.find((x) => x.id === id)
            if (!d) return {}
            return { canvas: d, activeDashboardId: id }
          }),
        deleteDashboard: (id) =>
          set((s) => {
            const remaining = s.dashboards.filter((d) => d.id !== id)
            if (remaining.length === 0) {
              // Never leave the canvas empty: reseed a fresh default dashboard.
              const fresh = defaultCanvas()
              return { dashboards: [fresh], canvas: fresh, activeDashboardId: fresh.id }
            }
            if (id !== s.activeDashboardId) return { dashboards: remaining }
            const next = remaining[0]
            return { dashboards: remaining, canvas: next, activeDashboardId: next.id }
          }),
        newDashboard: (name) =>
          set((s) => {
            const fresh = makeDashboard(name)
            return {
              dashboards: upsertDashboard(s.dashboards, fresh),
              canvas: fresh,
              activeDashboardId: fresh.id
            }
          }),
        loadTemplate: (id) =>
          set((s) => {
            const t = getTemplate(id)
            if (!t) return {}
            const dash = templateToDashboard(t)
            return {
              dashboards: upsertDashboard(s.dashboards, dash),
              canvas: dash,
              activeDashboardId: dash.id
            }
          })
      }
    },
    {
      name: 'prembroke.workspace',
      partialize: (s) => ({
        layout: s.layout,
        panes: s.panes,
        presets: s.presets,
        canvas: s.canvas,
        canvasEnabled: s.canvasEnabled,
        dashboards: s.dashboards,
        activeDashboardId: s.activeDashboardId
      }),
      // After rehydration, reconcile the canvas/dashboards so a fresh or legacy
      // profile (Steps 1–3 persisted `canvas` only) always has a valid active
      // dashboard. Seeds the curated default when no dashboards exist.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (shouldSeedDefault(state.dashboards)) {
          const fresh = defaultWorkspace()
          state.dashboards = [fresh]
          state.canvas = fresh
          state.activeDashboardId = fresh.id
          return
        }
        // Ensure the active dashboard exists and the canvas mirrors it.
        const active = state.dashboards.find((d) => d.id === state.activeDashboardId)
        if (active) {
          state.canvas = active
        } else {
          // The persisted `canvas` (legacy) is not yet in the list — adopt it.
          state.dashboards = upsertDashboard(state.dashboards, state.canvas)
          state.activeDashboardId = state.canvas.id
        }
      }
    }
  )
)
