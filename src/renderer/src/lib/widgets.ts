import { MODULES, type ModuleDef } from '@/modules'

/**
 * Resolve a widget's `moduleId` to its registered {@link ModuleDef}.
 *
 * This is the single seam mapping a canvas `WidgetInstance.moduleId` (a plain
 * string in the shared zone) to a concrete component from `MODULES`. Unknown
 * ids fall back to the first registered module, mirroring the existing `Pane`
 * and `Popout` lookups.
 *
 * @param moduleId Module id stored on a widget.
 * @returns The matching {@link ModuleDef}, or `MODULES[0]` when none matches.
 */
export function resolveWidget(moduleId: string): ModuleDef {
  return MODULES.find((m) => m.id === moduleId) ?? MODULES[0]
}
