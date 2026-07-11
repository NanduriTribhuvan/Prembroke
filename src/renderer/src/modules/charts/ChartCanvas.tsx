/**
 * ChartCanvas — the native canvas chart renderer.
 *
 * DPR-aware canvas with:
 * - Candles projected via `projectCandles`
 * - Price/time axes from `niceTicks`/`timeTicks`
 * - Hairline grid in `edge` token color
 * - Mono tabular numerals for axis text
 * - Pan (drag → panBy), zoom (wheel → zoomAbout), crosshair (pixelToCandleIndex/pixelToPrice)
 * - Left-edge pan triggers `onRequestHistory`
 * - Value-tick flash on last-price label
 * - Live candle appended for drawing without persisting
 * - Indicator overlays (SMA, EMA, Bollinger) drawn on the price pane as colored lines
 * - Sub-pane indicators (RSI, MACD, etc.) drawn in a band below the chart
 * - SMC drawables (zones, lines, markers, labels) projected via Chart_Math_Core
 *
 * @module charts/ChartCanvas
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Candle } from '@shared/indicators'
import {
  backingStoreSize,
  clampViewport,
  computeIndicator,
  flashIntensity,
  makeIndexScale,
  makePriceScale,
  niceTicks,
  panBy,
  pixelToPrice,
  pixelToTime,
  projectCandles,
  timeTicks,
  visibleRange,
  zoomAbout
} from '@shared/chart'
import type { BuiltinIndicatorSpec, IndicatorSeries } from '@shared/chart/indicator-series'
import type { Viewport } from '@shared/chart'
import type { Drawable } from '@shared/smc'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const PANEL_BG = '#0d0f13'
const GRID_COLOR = '#1c212b'
const MUTED_TEXT = '#6b7382'
const ACCENT = '#f5a524'
const UP_COLOR = '#16c784'
const DOWN_COLOR = '#ea3943'
const CROSSHAIR_COLOR = 'rgba(245, 165, 36, 0.5)'
const AXIS_FONT = '10px "JetBrains Mono", "SF Mono", "Fira Code", monospace'
const PRICE_AXIS_WIDTH = 64
const TIME_AXIS_HEIGHT = 22

/** Default line colors for overlay indicators when the indicator doesn't specify one. */
const INDICATOR_COLORS: readonly string[] = [
  '#3b82f6', '#22d3ee', '#eab308', '#a855f7', '#f97316',
  '#06b6d4', '#ec4899', '#84cc16', '#14b8a6', '#f43f5e'
]

/** Sub-pane height ratio when sub-pane indicators are active. */
const SUBPANE_RATIO = 0.25

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChartCanvasProps {
  candles: Candle[]
  live: Candle | null
  lastPrice: number
  lastDir: 1 | -1 | 0
  reduceMotion: boolean
  onRequestHistory: () => void
  /** Built-in indicator specs to compute and draw (overlay + sub-pane). */
  indicators?: BuiltinIndicatorSpec[]
  /** Pre-computed SMC drawables to render on the price pane. */
  smcOverlays?: Drawable[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChartCanvas({
  candles,
  live,
  lastPrice,
  lastDir,
  reduceMotion,
  onRequestHistory,
  indicators = [],
  smcOverlays = []
}: ChartCanvasProps): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  // Viewport state — fractional bar-index window
  const [viewport, setViewport] = useState<Viewport>({ start: 0, end: 80 })

  // Pointer/interaction state
  const dragging = useRef(false)
  const dragStartX = useRef(0)
  const dragVpStart = useRef<Viewport>({ start: 0, end: 80 })

  // Crosshair state
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null)
  const pointerOver = useRef(false)

  // Flash state
  const flashStartRef = useRef<number>(0)
  const prevLastPriceRef = useRef<number>(0)

  // Track last price changes for flash
  useEffect(() => {
    if (lastPrice !== prevLastPriceRef.current && lastPrice > 0) {
      flashStartRef.current = performance.now()
      prevLastPriceRef.current = lastPrice
    }
  }, [lastPrice])

  // Build the full series (historical + live candle for drawing only)
  const allCandles = live ? [...candles, live] : candles

  // Compute indicator series from active specs
  const computedIndicators: IndicatorSeries[] = useMemo(() => {
    if (indicators.length === 0 || allCandles.length === 0) return []
    return indicators.map((spec) => computeIndicator(spec, allCandles))
  }, [indicators, allCandles])

  // Separate overlay vs sub-pane indicators
  const overlayIndicators = useMemo(
    () => computedIndicators.filter((s) => s.target === 'overlay' && s.lines.length > 0),
    [computedIndicators]
  )
  const subpaneIndicators = useMemo(
    () => computedIndicators.filter((s) => s.target === 'subpane' && s.lines.length > 0),
    [computedIndicators]
  )

  const hasSubpane = subpaneIndicators.length > 0

  // Auto-scroll viewport to show latest candle when new data arrives
  useEffect(() => {
    if (allCandles.length === 0) return
    const width = viewport.end - viewport.start
    // Auto-scroll only if the user was viewing the right edge
    if (viewport.end >= allCandles.length - 2) {
      const newEnd = allCandles.length
      const newStart = Math.max(0, newEnd - width)
      setViewport({ start: newStart, end: newEnd })
    }
  }, [allCandles.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = wrap.clientWidth
    const cssH = wrap.clientHeight
    if (cssW === 0 || cssH === 0) return

    // DPR-aware backing store
    const { w, h } = backingStoreSize(cssW, cssH, dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Clear
    ctx.fillStyle = PANEL_BG
    ctx.fillRect(0, 0, cssW, cssH)

    const series = allCandles
    if (series.length === 0) return

    // Plot area — if sub-pane indicators are active, reserve 25% of height for them
    const plotW = cssW - PRICE_AXIS_WIDTH
    const totalPlotH = cssH - TIME_AXIS_HEIGHT
    const pricePaneH = hasSubpane ? Math.floor(totalPlotH * (1 - SUBPANE_RATIO)) : totalPlotH
    const subpaneH = hasSubpane ? totalPlotH - pricePaneH : 0
    const subpaneTop = pricePaneH

    // Clamp viewport
    const vp = clampViewport(viewport, series.length)

    // Compute price domain from visible candles
    const [vLo, vHi] = visibleRange(vp, series.length)
    let priceHi = -Infinity
    let priceLo = Infinity
    for (let i = vLo; i < vHi; i++) {
      const c = series[i]
      priceHi = Math.max(priceHi, c.high)
      priceLo = Math.min(priceLo, c.low)
    }
    if (!Number.isFinite(priceHi) || !Number.isFinite(priceLo)) return
    // Add 5% padding
    const priceSpan = priceHi - priceLo || 1
    priceHi += priceSpan * 0.05
    priceLo -= priceSpan * 0.05

    // Build scales
    const priceScale = makePriceScale([priceLo, priceHi], [pricePaneH, 0])
    const indexScale = makeIndexScale([vp.start, vp.end], [0, plotW])

    // --- Grid (hairlines) ---
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1

    // Price grid
    const pTicks = niceTicks(priceLo, priceHi, 6, priceScale)
    for (const t of pTicks) {
      const y = Math.round(t.px) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(plotW, y)
      ctx.stroke()
    }

    // Time grid
    const times = series.map((c) => c.time)
    const tTicks = timeTicks(times, vp.start, vp.end, 6, indexScale)
    for (const t of tTicks) {
      const x = Math.round(t.px) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, pricePaneH)
      ctx.stroke()
    }

    // --- Candles ---
    const rects = projectCandles(series, vp, priceScale, indexScale, 0.7)
    for (const r of rects) {
      const color = r.up ? UP_COLOR : DOWN_COLOR
      ctx.strokeStyle = color
      ctx.fillStyle = color

      // Wick
      const wickX = Math.round(r.wickX) + 0.5
      ctx.beginPath()
      ctx.moveTo(wickX, r.yHigh)
      ctx.lineTo(wickX, r.yLow)
      ctx.stroke()

      // Body
      const bodyTop = Math.min(r.yOpen, r.yClose)
      const bodyHeight = Math.max(1, Math.abs(r.yClose - r.yOpen))
      const bodyWidth = Math.max(1, r.bodyRight - r.bodyLeft)
      ctx.fillRect(r.bodyLeft, bodyTop, bodyWidth, bodyHeight)
    }

    // --- Price axis ---
    ctx.fillStyle = PANEL_BG
    ctx.fillRect(plotW, 0, PRICE_AXIS_WIDTH, cssH)
    // Divider line
    ctx.strokeStyle = GRID_COLOR
    ctx.beginPath()
    ctx.moveTo(plotW + 0.5, 0)
    ctx.lineTo(plotW + 0.5, cssH)
    ctx.stroke()

    ctx.font = AXIS_FONT
    ctx.textBaseline = 'middle'
    ctx.fillStyle = MUTED_TEXT
    for (const t of pTicks) {
      ctx.fillText(t.label, plotW + 6, t.px)
    }

    // --- Time axis ---
    ctx.fillStyle = PANEL_BG
    ctx.fillRect(0, totalPlotH, plotW, TIME_AXIS_HEIGHT)
    // Divider line
    ctx.strokeStyle = GRID_COLOR
    ctx.beginPath()
    ctx.moveTo(0, totalPlotH + 0.5)
    ctx.lineTo(plotW, totalPlotH + 0.5)
    ctx.stroke()

    ctx.font = AXIS_FONT
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    ctx.fillStyle = MUTED_TEXT
    for (const t of tTicks) {
      ctx.fillText(t.label, t.px, totalPlotH + 4)
    }
    ctx.textAlign = 'left'

    // --- Last price flash label ---
    if (lastPrice > 0 && lastPrice >= priceLo && lastPrice <= priceHi) {
      const yLast = priceScale.toPx(lastPrice)
      const elapsed = performance.now() - flashStartRef.current
      const intensity = flashIntensity(elapsed, reduceMotion)
      const flashColor = lastDir >= 0 ? UP_COLOR : DOWN_COLOR

      // Dashed price line
      ctx.save()
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = flashColor
      ctx.globalAlpha = 0.5 + intensity * 0.5
      ctx.beginPath()
      ctx.moveTo(0, yLast)
      ctx.lineTo(plotW, yLast)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Flash label on price axis
      const labelY = yLast
      ctx.fillStyle = flashColor
      ctx.globalAlpha = 0.7 + intensity * 0.3
      ctx.fillRect(plotW + 1, labelY - 8, PRICE_AXIS_WIDTH - 2, 16)
      ctx.globalAlpha = 1
      ctx.fillStyle = PANEL_BG
      ctx.font = AXIS_FONT
      ctx.textBaseline = 'middle'
      ctx.fillText(formatPrice(lastPrice), plotW + 6, labelY)
    }

    // --- Indicator overlays (price pane) ---
    if (overlayIndicators.length > 0) {
      ctx.save()
      ctx.lineWidth = 1.5
      let colorIdx = 0
      for (const ind of overlayIndicators) {
        for (const line of ind.lines) {
          const color = line.color ?? INDICATOR_COLORS[colorIdx % INDICATOR_COLORS.length]
          ctx.strokeStyle = color
          ctx.beginPath()
          let moved = false
          for (let i = vLo; i < vHi; i++) {
            const val = line.values[i]
            if (val == null || !Number.isFinite(val)) {
              moved = false
              continue
            }
            const px = indexScale.toPx(i)
            const py = priceScale.toPx(val)
            if (!moved) {
              ctx.moveTo(px, py)
              moved = true
            } else {
              ctx.lineTo(px, py)
            }
          }
          ctx.stroke()
          colorIdx++
        }
      }
      ctx.restore()
    }

    // --- SMC Drawables (price pane) ---
    if (smcOverlays.length > 0) {
      ctx.save()
      for (const d of smcOverlays) {
        // Project data-space coordinates through scales
        const x1 = indexScale.toPx(d.fromIndex)
        const x2 = d.toIndex != null ? indexScale.toPx(d.toIndex) : x1
        const y1 = priceScale.toPx(d.priceTop)

        switch (d.kind) {
          case 'zone': {
            const y2 = d.priceBottom != null ? priceScale.toPx(d.priceBottom) : y1
            ctx.globalAlpha = 0.15
            ctx.fillStyle = d.color
            ctx.fillRect(x1, Math.min(y1, y2), Math.abs(x2 - x1) || 1, Math.abs(y2 - y1) || 1)
            ctx.globalAlpha = 1
            // Zone border
            ctx.strokeStyle = d.color
            ctx.lineWidth = 0.5
            ctx.strokeRect(x1, Math.min(y1, y2), Math.abs(x2 - x1) || 1, Math.abs(y2 - y1) || 1)
            // Label
            if (d.label) {
              ctx.font = '9px "JetBrains Mono", monospace'
              ctx.fillStyle = d.color
              ctx.globalAlpha = 0.8
              ctx.textBaseline = 'top'
              ctx.fillText(d.label, x1 + 2, Math.min(y1, y2) + 2)
              ctx.globalAlpha = 1
            }
            break
          }
          case 'line': {
            ctx.strokeStyle = d.color
            ctx.lineWidth = 1
            ctx.globalAlpha = 0.7
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y1)
            ctx.stroke()
            ctx.globalAlpha = 1
            if (d.label) {
              ctx.font = '9px "JetBrains Mono", monospace'
              ctx.fillStyle = d.color
              ctx.textBaseline = 'bottom'
              ctx.fillText(d.label, x2 - 30, y1 - 2)
            }
            break
          }
          case 'marker': {
            ctx.fillStyle = d.color
            ctx.globalAlpha = 0.9
            ctx.beginPath()
            ctx.arc(x1, y1, 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = 1
            if (d.label) {
              ctx.font = '9px "JetBrains Mono", monospace'
              ctx.fillStyle = d.color
              ctx.textBaseline = 'bottom'
              ctx.textAlign = 'center'
              ctx.fillText(d.label, x1, y1 - 5)
              ctx.textAlign = 'left'
            }
            break
          }
          case 'label': {
            if (d.label) {
              ctx.font = '9px "JetBrains Mono", monospace'
              ctx.fillStyle = d.color
              ctx.globalAlpha = 0.85
              ctx.textBaseline = 'bottom'
              ctx.textAlign = 'center'
              ctx.fillText(d.label, x1, y1 - 3)
              ctx.textAlign = 'left'
              ctx.globalAlpha = 1
            }
            break
          }
        }
      }
      ctx.restore()
    }

    // --- Sub-pane indicators ---
    if (hasSubpane && subpaneH > 0) {
      // Separator line between price pane and sub-pane
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, subpaneTop + 0.5)
      ctx.lineTo(plotW, subpaneTop + 0.5)
      ctx.stroke()

      // Draw each sub-pane indicator stacked within the sub-pane area
      const numSubIndicators = subpaneIndicators.length
      const perIndicatorH = Math.floor(subpaneH / numSubIndicators)

      let colorIdx = overlayIndicators.reduce((sum, ind) => sum + ind.lines.length, 0)

      for (let si = 0; si < numSubIndicators; si++) {
        const ind = subpaneIndicators[si]
        const spTop = subpaneTop + si * perIndicatorH
        const spBottom = spTop + perIndicatorH

        // Compute domain for this sub-indicator (min/max of visible values)
        let subMin = Infinity
        let subMax = -Infinity
        for (const line of ind.lines) {
          for (let i = vLo; i < vHi; i++) {
            const val = line.values[i]
            if (val != null && Number.isFinite(val)) {
              subMin = Math.min(subMin, val)
              subMax = Math.max(subMax, val)
            }
          }
        }
        if (!Number.isFinite(subMin) || !Number.isFinite(subMax)) continue
        const subSpan = subMax - subMin || 1
        subMax += subSpan * 0.05
        subMin -= subSpan * 0.05

        const subPriceScale = makePriceScale([subMin, subMax], [spBottom, spTop])

        // Draw lines
        ctx.save()
        ctx.lineWidth = 1.2
        for (const line of ind.lines) {
          const color = line.color ?? INDICATOR_COLORS[colorIdx % INDICATOR_COLORS.length]
          ctx.strokeStyle = color
          ctx.beginPath()
          let moved = false
          for (let i = vLo; i < vHi; i++) {
            const val = line.values[i]
            if (val == null || !Number.isFinite(val)) {
              moved = false
              continue
            }
            const px = indexScale.toPx(i)
            const py = subPriceScale.toPx(val)
            if (!moved) {
              ctx.moveTo(px, py)
              moved = true
            } else {
              ctx.lineTo(px, py)
            }
          }
          ctx.stroke()
          colorIdx++
        }
        ctx.restore()

        // Sub-pane label
        ctx.font = '9px "JetBrains Mono", monospace'
        ctx.fillStyle = MUTED_TEXT
        ctx.textBaseline = 'top'
        const subLabel = ind.lines[0]?.label ?? ''
        ctx.fillText(subLabel, 4, spTop + 3)

        // Separator between sub-indicators (if not last)
        if (si < numSubIndicators - 1) {
          ctx.strokeStyle = GRID_COLOR
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(0, spBottom + 0.5)
          ctx.lineTo(plotW, spBottom + 0.5)
          ctx.stroke()
        }
      }
    }

    // --- Crosshair ---
    if (crosshair && pointerOver.current) {
      const cx = crosshair.x
      const cy = crosshair.y

      if (cx >= 0 && cx <= plotW && cy >= 0 && cy <= pricePaneH) {
        ctx.strokeStyle = CROSSHAIR_COLOR
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])

        // Vertical line
        ctx.beginPath()
        ctx.moveTo(Math.round(cx) + 0.5, 0)
        ctx.lineTo(Math.round(cx) + 0.5, pricePaneH)
        ctx.stroke()

        // Horizontal line
        ctx.beginPath()
        ctx.moveTo(0, Math.round(cy) + 0.5)
        ctx.lineTo(plotW, Math.round(cy) + 0.5)
        ctx.stroke()

        ctx.setLineDash([])

        // Crosshair readouts
        const chPrice = pixelToPrice(cy, priceScale)
        const chTime = pixelToTime(cx, vp, indexScale, series)

        // Price readout on axis
        ctx.fillStyle = ACCENT
        ctx.fillRect(plotW + 1, cy - 8, PRICE_AXIS_WIDTH - 2, 16)
        ctx.fillStyle = PANEL_BG
        ctx.font = AXIS_FONT
        ctx.textBaseline = 'middle'
        ctx.fillText(formatPrice(chPrice), plotW + 6, cy)

        // Time readout on axis
        if (chTime !== undefined) {
          const timeLabel = formatTimeLabel(chTime)
          ctx.fillStyle = ACCENT
          const txMetric = ctx.measureText(timeLabel)
          const txW = txMetric.width + 8
          ctx.fillRect(cx - txW / 2, totalPlotH + 1, txW, TIME_AXIS_HEIGHT - 2)
          ctx.fillStyle = PANEL_BG
          ctx.font = AXIS_FONT
          ctx.textBaseline = 'top'
          ctx.textAlign = 'center'
          ctx.fillText(timeLabel, cx, totalPlotH + 4)
          ctx.textAlign = 'left'
        }
      }
    }
  }, [allCandles, viewport, crosshair, lastPrice, lastDir, reduceMotion, overlayIndicators, subpaneIndicators, hasSubpane, smcOverlays])

  // ---------------------------------------------------------------------------
  // Render loop — redraw on changes and for flash decay animation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let running = true
    const loop = (): void => {
      if (!running) return
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  // ResizeObserver to handle container resize
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [draw])

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  const getPlotWidth = (): number => {
    const wrap = wrapRef.current
    return wrap ? wrap.clientWidth - PRICE_AXIS_WIDTH : 1
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      dragging.current = true
      dragStartX.current = e.clientX
      dragVpStart.current = { ...viewport }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [viewport]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const wrap = wrapRef.current
      if (!wrap) return

      const rect = wrap.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setCrosshair({ x, y })

      if (dragging.current) {
        const plotW = getPlotWidth()
        const vpWidth = dragVpStart.current.end - dragVpStart.current.start
        const pxPerBar = plotW / vpWidth
        const deltaPx = dragStartX.current - e.clientX
        const deltaBars = deltaPx / pxPerBar

        const newVp = panBy(dragVpStart.current, deltaBars)
        const clamped = clampViewport(newVp, allCandles.length)
        setViewport(clamped)

        // Left-edge pan → request more history
        if (clamped.start <= 0) {
          onRequestHistory()
        }
      }
    },
    [allCandles.length, onRequestHistory]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  const handlePointerEnter = useCallback(() => {
    pointerOver.current = true
  }, [])

  const handlePointerLeave = useCallback(() => {
    pointerOver.current = false
    setCrosshair(null)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const wrap = wrapRef.current
      if (!wrap) return

      const rect = wrap.getBoundingClientRect()
      const anchorPx = e.clientX - rect.left

      // Zoom factor: scroll up → zoom in (narrower), scroll down → zoom out (wider)
      const factor = e.deltaY > 0 ? 1.1 : 0.9

      const plotW = getPlotWidth()
      const vp = viewport
      const indexScale = makeIndexScale([vp.start, vp.end], [0, plotW])

      const newVp = zoomAbout(vp, anchorPx, factor, indexScale)
      const clamped = clampViewport(newVp, allCandles.length)
      setViewport(clamped)
    },
    [viewport, allCandles.length]
  )

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: 'block' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a price for axis display — auto-detect decimals. */
function formatPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0)
  if (price >= 100) return price.toFixed(1)
  if (price >= 1) return price.toFixed(2)
  if (price >= 0.01) return price.toFixed(4)
  return price.toFixed(6)
}

/** Format a timestamp for crosshair time readout. */
function formatTimeLabel(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}
