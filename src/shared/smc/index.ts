/**
 * Public surface for the pure SMC / ICT overlay module (`src/shared/smc`).
 *
 * Re-exports the new pure detectors (`detectBreakerBlocks`,
 * `detectMitigationBlocks`) and the overlay builder (`buildOverlays`) plus its
 * types.
 *
 * NOTE ON DEPENDENCY DIRECTION: the conviction-engine detectors (`detectSwings`,
 * `readStructure`, `detectFvgs`, `detectOrderBlocks`, `detectEqualLevels`,
 * `detectDisplacement`) live in the renderer zone
 * (`src/renderer/src/modules/conviction/engine.ts`) and CANNOT be re-exported
 * here — `src/shared` must never import from the renderer. The renderer instead
 * composes those engine detectors into a `ConvictionResult` (which is
 * structurally compatible with {@link SmcResult}) and passes it to
 * {@link buildOverlays}, which runs the breaker/mitigation detectors from this
 * module for the remaining overlays (Req 11.6).
 *
 * @module smc
 */

export {
  detectBreakerBlocks,
  detectMitigationBlocks,
  type ZoneDir,
  type OrderBlock,
  type BreakerBlock,
  type MitigationBlock
} from './breaker'

export {
  buildOverlays,
  ALL_OVERLAY_IDS,
  type SmcOverlayId,
  type SmcOverlayState,
  type SmcDir,
  type Drawable,
  type SmcSwing,
  type SmcFvg,
  type SmcOrderBlock,
  type SmcEqualLevel,
  type SmcDisplacement,
  type SmcRange,
  type SmcOteZone,
  type SmcResult
} from './overlays'
