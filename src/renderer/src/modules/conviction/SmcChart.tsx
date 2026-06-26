import { useEffect, useRef } from 'react'
import type { ConvictionResult } from './engine'

/**
 * Lightweight canvas candlestick chart that renders the Conviction Engine's
 * Smart-Money reads directly on price: dealing-range premium/discount band,
 * fair-value-gap zones, swing points, buy/sell-side liquidity, and the plan's
 * entry / stop / target. Pure presentation over data the engine already produced.
 */
export const SMC_COLORS = {
  up: '#16c784',
  down: '#ea3943',
  gold: '#d9a521',
  grid: 'rgba(52,44,28,0.55)',
  text: '#a99a7d',
  bullFvg: 'rgba(22,199,132,0.13)',
  bearFvg: 'rgba(234,57,67,0.13)',
  premium: 'rgba(234,57,67,0.06)',
  discount: 'rgba(22,199,132,0.06)',
  ob: 'rgba(217,165,33,0.16)',
  obEdge: 'rgba(217,165,33,0.5)',
  draw: '#2fd9c5'
}
const C = SMC_COLORS
const VISIBLE = 90

export default function SmcChart({ result }: { result: ConvictionResult }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const draw = (): void => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const cssW = wrap.clientWidth
      const cssH = wrap.clientHeight
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      const all = result.candles
      const start = Math.max(0, all.length - VISIBLE)
      const candles = all.slice(start)
      if (candles.length === 0) return

      const padR = 56
      const padT = 8
      const padB = 16
      const plotW = cssW - padR
      const plotH = cssH - padT - padB

      let hi = -Infinity
      let lo = Infinity
      for (const c of candles) {
        hi = Math.max(hi, c.high)
        lo = Math.min(lo, c.low)
      }
      if (result.plan) {
        hi = Math.max(hi, result.plan.entry, result.plan.stop, result.plan.target)
        lo = Math.min(lo, result.plan.entry, result.plan.stop, result.plan.target)
      }
      const span = hi - lo || 1
      hi += span * 0.06
      lo -= span * 0.06
      const range = hi - lo

      const colW = plotW / candles.length
      const cx = (i: number): number => i * colW + colW / 2
      const y = (p: number): number => padT + (hi - p) / range * plotH

      // grid + price axis
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = C.grid
      ctx.fillStyle = C.text
      ctx.lineWidth = 1
      for (let g = 0; g <= 4; g++) {
        const p = hi - (range * g) / 4
        const yy = y(p)
        ctx.globalAlpha = 0.5
        ctx.beginPath()
        ctx.moveTo(0, yy)
        ctx.lineTo(plotW, yy)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.fillText(p.toFixed(p > 100 ? 0 : 2), plotW + 6, yy)
      }

      // premium / discount band within dealing range
      const { high: rh, low: rl, eq } = result.range
      if (rh > rl) {
        ctx.fillStyle = C.premium
        ctx.fillRect(0, y(rh), plotW, y(eq) - y(rh))
        ctx.fillStyle = C.discount
        ctx.fillRect(0, y(eq), plotW, y(rl) - y(eq))
        ctx.strokeStyle = 'rgba(217,165,33,0.5)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(0, y(eq))
        ctx.lineTo(plotW, y(eq))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = C.text
        ctx.fillText('EQ', 4, y(eq) - 7)
      }

      // FVG zones (extend to right edge)
      for (const f of result.fvgs) {
        const idx = f.index - start
        if (idx < 0 || idx >= candles.length) continue
        ctx.fillStyle = f.dir === 'bull' ? C.bullFvg : C.bearFvg
        ctx.fillRect(cx(idx), y(f.top), plotW - cx(idx), y(f.bottom) - y(f.top))
      }

      // OTE band (0.62–0.79 deep discount/premium)
      if (result.ote) {
        ctx.fillStyle = 'rgba(47,125,79,0.16)'
        ctx.fillRect(0, y(result.ote.high), plotW, y(result.ote.low) - y(result.ote.high))
        ctx.fillStyle = 'rgba(120,180,140,0.9)'
        ctx.fillText('OTE', 26, y(result.ote.high) - 6)
      }

      // Order blocks (gold zones, extend right)
      for (const o of result.orderBlocks) {
        const idx = o.index - start
        if (idx < 0 || idx >= candles.length) continue
        ctx.fillStyle = C.ob
        ctx.fillRect(cx(idx), y(o.top), plotW - cx(idx), y(o.bottom) - y(o.top))
        ctx.strokeStyle = C.obEdge
        ctx.lineWidth = 0.8
        ctx.strokeRect(cx(idx), y(o.top), plotW - cx(idx), y(o.bottom) - y(o.top))
        ctx.fillStyle = C.obEdge
        ctx.fillText('OB', cx(idx) + 2, y(o.top) - 6)
      }

      // candles
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]
        const up = c.close >= c.open
        ctx.strokeStyle = up ? C.up : C.down
        ctx.fillStyle = up ? C.up : C.down
        const bx = cx(i)
        ctx.beginPath()
        ctx.moveTo(bx, y(c.high))
        ctx.lineTo(bx, y(c.low))
        ctx.stroke()
        const bw = Math.max(1, colW * 0.62)
        const yo = y(c.open)
        const yc = y(c.close)
        ctx.fillRect(bx - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)))
      }

      // swings
      for (const s of result.structure.swings) {
        const idx = s.index - start
        if (idx < 0 || idx >= candles.length) continue
        ctx.fillStyle = s.kind === 'high' ? 'rgba(234,57,67,0.9)' : 'rgba(22,199,132,0.9)'
        ctx.beginPath()
        ctx.arc(cx(idx), y(s.price), 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // equal highs/lows (resting liquidity)
      ctx.setLineDash([2, 3])
      for (const lvl of result.equalLevels) {
        ctx.strokeStyle = lvl.kind === 'EQH' ? 'rgba(234,57,67,0.6)' : 'rgba(22,199,132,0.6)'
        ctx.beginPath()
        ctx.moveTo(0, y(lvl.price))
        ctx.lineTo(plotW, y(lvl.price))
        ctx.stroke()
        ctx.fillStyle = ctx.strokeStyle
        ctx.fillText(lvl.kind, 4, y(lvl.price) - 6)
      }
      ctx.setLineDash([])

      // draw-on-liquidity target
      if (result.drawTarget != null) {
        ctx.strokeStyle = C.draw
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(0, y(result.drawTarget))
        ctx.lineTo(plotW, y(result.drawTarget))
        ctx.stroke()
        ctx.setLineDash([])
      }

      // plan lines
      const planLine = (price: number, color: string, label: string): void => {
        ctx.strokeStyle = color
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(0, y(price))
        ctx.lineTo(plotW, y(price))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.fillRect(plotW, y(price) - 7, padR, 14)
        ctx.fillStyle = '#0b0a07'
        ctx.fillText(label, plotW + 4, y(price))
      }
      if (result.plan) {
        planLine(result.plan.target, C.up, result.plan.target.toFixed(0))
        planLine(result.plan.entry, C.gold, result.plan.entry.toFixed(0))
        planLine(result.plan.stop, C.down, result.plan.stop.toFixed(0))
      }
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [result])

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
