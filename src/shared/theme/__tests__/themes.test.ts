import { describe, it, expect } from 'vitest'
import {
  ACCENTS,
  DENSITIES,
  deriveAccentRamp,
  resolveDensity,
  resolveTheme,
  tokensToCssVars,
  type AccentId,
  type ThemeMode,
  type DensityId
} from '../themes'
import { contrastRatio, relativeLuminance } from '../palette'

const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[]
const MODES: ThemeMode[] = ['dark', 'light']

/** Every CSS var the renderer expects to write. */
const EXPECTED_VARS = [
  // legacy
  '--color-bg',
  '--color-panel',
  '--color-panel2',
  '--color-edge',
  '--color-muted',
  '--color-text',
  '--color-accent',
  '--color-accent2',
  '--color-leaf',
  '--color-olive',
  '--color-gold',
  '--color-up',
  '--color-down',
  '--color-warn',
  // semantic
  '--color-surface',
  '--color-elevated',
  '--color-overlay',
  '--color-border-subtle',
  '--color-border-strong',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-accent-strong',
  '--color-accent-soft',
  '--color-ring'
] as const

/** A hex string matcher. */
const HEX = /^#[0-9a-f]{6}$/
/** An rgba string matcher. */
const RGBA = /^rgba\(\d+, \d+, \d+, [\d.]+\)$/

describe('tokensToCssVars completeness', () => {
  it('emits every legacy + semantic var with a non-empty value', () => {
    for (const mode of MODES) {
      for (const accent of ACCENT_IDS) {
        const vars = tokensToCssVars(resolveTheme(mode, accent, 'cozy').tokens)
        for (const name of EXPECTED_VARS) {
          expect(vars[name], `${name} in ${mode}/${accent}`).toBeTruthy()
          expect(typeof vars[name]).toBe('string')
        }
        // No stray undefined values.
        for (const v of Object.values(vars)) expect(v).not.toBe('')
      }
    }
  })
})

describe('dark parity (regression lock)', () => {
  it('locks the legacy dark tokens to the exact main.css hexes', () => {
    const { tokens } = resolveTheme('dark', 'gold', 'cozy')
    expect(tokens.bg).toBe('#0d0e11')
    expect(tokens.panel).toBe('#15171c')
    expect(tokens.panel2).toBe('#1d2027')
    expect(tokens.edge).toBe('#2a2e37')
    expect(tokens.muted).toBe('#8e94a3')
    expect(tokens.text).toBe('#e7e9ee')
    expect(tokens.accent2).toBe('#6b93b8')
    expect(tokens.leaf).toBe('#15202c')
    expect(tokens.olive).toBe('#2b4a63')
    expect(tokens.up).toBe('#16c784')
    expect(tokens.down).toBe('#ea3943')
    expect(tokens.warn).toBe('#f0b90b')
  })

  it('locks the default Gold accent + gold highlight for dark', () => {
    const { tokens } = resolveTheme('dark', 'gold', 'cozy')
    // Default accent is the legacy bright gold; the text-gold highlight is its
    // lightened form. Both are pinned so dark never drifts.
    expect(tokens.accent).toBe('#d9a521')
    expect(tokens.gold).toBe('#e0b549')
  })
})

describe('distinct modes', () => {
  it('dark and light disagree on the base surfaces', () => {
    expect(resolveTheme('dark', 'gold', 'cozy').tokens.bg).not.toBe(
      resolveTheme('light', 'gold', 'cozy').tokens.bg
    )
    expect(resolveTheme('dark', 'gold', 'cozy').tokens.panel).not.toBe(
      resolveTheme('light', 'gold', 'cozy').tokens.panel
    )
  })

  it('light text is darker than its bg; dark text is lighter than its bg', () => {
    const light = resolveTheme('light', 'gold', 'cozy').tokens
    const dark = resolveTheme('dark', 'gold', 'cozy').tokens
    expect(relativeLuminance(light.text)).toBeLessThan(relativeLuminance(light.bg))
    expect(relativeLuminance(dark.text)).toBeGreaterThan(relativeLuminance(dark.bg))
  })
})

describe('coherent accent ramp', () => {
  it('produces five well-formed, distinct members per accent (both modes)', () => {
    for (const mode of MODES) {
      for (const id of ACCENT_IDS) {
        const ramp = deriveAccentRamp(ACCENTS[id].base, mode)
        expect(ramp.accent).toMatch(HEX)
        expect(ramp.strong).toMatch(HEX)
        expect(ramp.gold).toMatch(HEX)
        expect(ramp.soft).toMatch(RGBA)
        expect(ramp.ring).toMatch(RGBA)
        // strong is a darker emphasis than the primary accent.
        expect(relativeLuminance(ramp.strong)).toBeLessThan(relativeLuminance(ramp.accent))
      }
    }
  })

  it('non-gold accents are not green (the accent reflects the base hue)', () => {
    // Azure/violet/rose should keep a non-green channel dominance in dark mode.
    const azure = deriveAccentRamp(ACCENTS.azure.base, 'dark').accent
    expect(azure).toBe('#3b9ef5')
    const rose = deriveAccentRamp(ACCENTS.rose.base, 'dark').accent
    expect(rose).toBe('#f43f5e')
  })

  it('dark gold highlight is brighter than the base accent; light is contrast-safe', () => {
    const darkRamp = deriveAccentRamp(ACCENTS.azure.base, 'dark')
    expect(relativeLuminance(darkRamp.gold)).toBeGreaterThan(relativeLuminance(darkRamp.accent))
    const lightRamp = deriveAccentRamp(ACCENTS.azure.base, 'light')
    // In light mode the highlight equals the contrast-safe accent.
    expect(lightRamp.gold).toBe(lightRamp.accent)
  })
})

describe('up/down invariant', () => {
  it('stays green/red across all accents and modes', () => {
    for (const mode of MODES) {
      for (const accent of ACCENT_IDS) {
        const { tokens } = resolveTheme(mode, accent, 'cozy')
        expect(tokens.up).toBe('#16c784')
        expect(tokens.down).toBe('#ea3943')
      }
    }
  })
})

describe('WCAG contrast thresholds', () => {
  it('body text clears AAA (>=7) on bg in both modes', () => {
    for (const mode of MODES) {
      const { tokens } = resolveTheme(mode, 'gold', 'cozy')
      expect(contrastRatio(tokens.text, tokens.bg)).toBeGreaterThanOrEqual(7)
    }
  })

  it('secondary + tertiary text clear AA (>=4.5) on panel in both modes', () => {
    for (const mode of MODES) {
      const { tokens } = resolveTheme(mode, 'gold', 'cozy')
      expect(contrastRatio(tokens.textSecondary, tokens.panel)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(tokens.textTertiary, tokens.panel)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the accent reads (>=3) on surfaces for every accent + mode (text-gold usage)', () => {
    for (const mode of MODES) {
      for (const accent of ACCENT_IDS) {
        const { tokens } = resolveTheme(mode, accent, 'cozy')
        expect(contrastRatio(tokens.accent, tokens.panel)).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(tokens.gold, tokens.panel)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('the focus accent reads (>=3) on the panel as a non-text UI cue', () => {
    for (const mode of MODES) {
      for (const accent of ACCENT_IDS) {
        const { tokens } = resolveTheme(mode, accent, 'cozy')
        // The ring is an rgba of the accent; the underlying accent gates >=3.
        expect(contrastRatio(tokens.accent, tokens.panel)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('density mapping', () => {
  it('orders compact < cozy < comfortable on the row unit', () => {
    expect(resolveDensity('compact').rowH).toBeLessThan(resolveDensity('cozy').rowH)
    expect(resolveDensity('cozy').rowH).toBeLessThan(resolveDensity('comfortable').rowH)
  })

  it('every metric is positive', () => {
    for (const id of Object.keys(DENSITIES) as DensityId[]) {
      const m = resolveDensity(id)
      expect(m.rowH).toBeGreaterThan(0)
      expect(m.cardPadding).toBeGreaterThan(0)
      expect(m.gap).toBeGreaterThan(0)
      expect(m.controlH).toBeGreaterThan(0)
      expect(m.fontBase).toBeGreaterThan(0)
    }
  })

  it('cozy maps to today\'s metrics (no change for existing users)', () => {
    expect(resolveDensity('cozy')).toEqual({
      rowH: 26,
      cardPadding: 12,
      gap: 4,
      controlH: 28,
      fontBase: 13
    })
  })

  it('falls back to cozy for an unknown id', () => {
    expect(resolveDensity('nope' as DensityId)).toEqual(resolveDensity('cozy'))
  })
})

describe('purity', () => {
  it('returns deep-equal results across repeated calls', () => {
    const a = resolveTheme('light', 'violet', 'compact')
    const b = resolveTheme('light', 'violet', 'compact')
    expect(a).toEqual(b)
    // Mutating one result must not affect a fresh call.
    a.tokens.bg = '#deadbe'
    expect(resolveTheme('light', 'violet', 'compact').tokens.bg).not.toBe('#deadbe')
  })

  it('falls back to the Gold accent for an unknown accent id', () => {
    const fallback = resolveTheme('dark', 'nope' as AccentId, 'cozy')
    const gold = resolveTheme('dark', 'gold', 'cozy')
    expect(fallback.tokens.accent).toBe(gold.tokens.accent)
  })
})
