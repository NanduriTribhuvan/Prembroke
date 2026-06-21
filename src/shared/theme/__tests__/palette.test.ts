import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  rgbToHex,
  withAlpha,
  lighten,
  darken,
  mix,
  relativeLuminance,
  contrastRatio
} from '../palette'

describe('hexToRgb', () => {
  it('parses 6-digit hex with and without #', () => {
    expect(hexToRgb('#07100b')).toEqual({ r: 7, g: 16, b: 11 })
    expect(hexToRgb('07100b')).toEqual({ r: 7, g: 16, b: 11 })
  })
  it('parses 3-digit shorthand', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('000')).toEqual({ r: 0, g: 0, b: 0 })
  })
  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(hexToRgb('  #E8EFE9  ')).toEqual({ r: 232, g: 239, b: 233 })
    expect(hexToRgb('#Ea3943')).toEqual({ r: 234, g: 57, b: 67 })
  })
  it('returns null for malformed input', () => {
    expect(hexToRgb('zzz')).toBeNull()
    expect(hexToRgb('#12')).toBeNull()
    expect(hexToRgb('#1234')).toBeNull()
    expect(hexToRgb('#gggggg')).toBeNull()
    expect(hexToRgb('')).toBeNull()
  })
})

describe('rgbToHex', () => {
  it('round-trips known tokens', () => {
    expect(rgbToHex({ r: 7, g: 16, b: 11 })).toBe('#07100b')
    expect(rgbToHex({ r: 232, g: 239, b: 233 })).toBe('#e8efe9')
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
  })
  it('clamps out-of-range channels', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 0 })).toBe('#ff0000')
  })
  it('rounds fractional channels', () => {
    expect(rgbToHex({ r: 127.6, g: 0.4, b: 128.5 })).toBe('#800081')
  })
})

describe('withAlpha', () => {
  it('composes an rgba string', () => {
    expect(withAlpha('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
    expect(withAlpha('#e8efe9', 1)).toBe('rgba(232, 239, 233, 1)')
    expect(withAlpha('#fff', 0)).toBe('rgba(255, 255, 255, 0)')
  })
  it('returns transparent for bad hex or alpha', () => {
    expect(withAlpha('nope', 0.5)).toBe('transparent')
    expect(withAlpha('#000000', 1.5)).toBe('transparent')
    expect(withAlpha('#000000', -0.1)).toBe('transparent')
    expect(withAlpha('#000000', NaN)).toBe('transparent')
  })
})

describe('lighten / darken', () => {
  it('t=0 is identity (normalized to #rrggbb)', () => {
    expect(lighten('#3b82f6', 0)).toBe('#3b82f6')
    expect(darken('#3b82f6', 0)).toBe('#3b82f6')
  })
  it('t=1 reaches white / black', () => {
    expect(lighten('#3b82f6', 1)).toBe('#ffffff')
    expect(darken('#3b82f6', 1)).toBe('#000000')
  })
  it('lighten raises luminance, darken lowers it (monotonic)', () => {
    const base = '#5b7a1e'
    expect(relativeLuminance(lighten(base, 0.4))).toBeGreaterThan(relativeLuminance(base))
    expect(relativeLuminance(darken(base, 0.4))).toBeLessThan(relativeLuminance(base))
  })
  it('echoes the original string for unparseable input', () => {
    expect(lighten('bogus', 0.5)).toBe('bogus')
    expect(darken('bogus', 0.5)).toBe('bogus')
  })
})

describe('mix', () => {
  it('t=0 returns a, t=1 returns b', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
  })
  it('t=0.5 of black and white is mid-grey (±1 rounding)', () => {
    const rgb = hexToRgb(mix('#000000', '#ffffff', 0.5))
    expect(rgb).not.toBeNull()
    if (rgb) {
      expect(Math.abs(rgb.r - 128)).toBeLessThanOrEqual(1)
      expect(Math.abs(rgb.g - 128)).toBeLessThanOrEqual(1)
      expect(Math.abs(rgb.b - 128)).toBeLessThanOrEqual(1)
    }
  })
  it('returns #000000 on bad input', () => {
    expect(mix('nope', '#fff', 0.5)).toBe('#000000')
    expect(mix('#000', 'nope', 0.5)).toBe('#000000')
    expect(mix('#000', '#fff', NaN)).toBe('#000000')
  })
})

describe('relativeLuminance', () => {
  it('is ~1 for white and ~0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })
  it('orders sensibly: white > light text > dark bg', () => {
    const white = relativeLuminance('#ffffff')
    const text = relativeLuminance('#e8efe9')
    const bg = relativeLuminance('#07100b')
    expect(white).toBeGreaterThan(text)
    expect(text).toBeGreaterThan(bg)
  })
  it('returns NaN for unparseable input', () => {
    expect(relativeLuminance('nope')).toBeNaN()
  })
})

describe('contrastRatio', () => {
  it('white on black is ≈ 21', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
  })
  it('identical colours give a ratio of 1', () => {
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 5)
  })
  it('is symmetric', () => {
    expect(contrastRatio('#e8efe9', '#07100b')).toBeCloseTo(contrastRatio('#07100b', '#e8efe9'), 6)
  })
  it('returns NaN when either colour is unparseable', () => {
    expect(contrastRatio('nope', '#000000')).toBeNaN()
    expect(contrastRatio('#000000', 'nope')).toBeNaN()
  })
})
