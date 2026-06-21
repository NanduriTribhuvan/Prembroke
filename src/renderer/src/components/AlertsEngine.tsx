import { useEffect, useRef } from 'react'
import { useAlerts, type Alert } from '@/stores/alerts'
import { useToasts } from '@/stores/toasts'
import { fetchCandles, computeConviction } from '@/modules/conviction/engine'

/**
 * Headless global service: evaluates enabled alerts against live data every 30s,
 * regardless of which module is open. On trigger it disables the alert, logs it,
 * shows an in-app toast, and fires a native desktop notification.
 */
async function fetchPrices(symbols: string[]): Promise<Map<string, number>> {
  if (symbols.length === 0) return new Map()
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`
  const res = await fetch(url)
  if (!res.ok) return new Map()
  const rows = (await res.json()) as { symbol: string; price: string }[]
  return new Map(rows.map((r) => [r.symbol, parseFloat(r.price)]))
}

async function fetchFunding(): Promise<Map<string, number>> {
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex')
    if (!res.ok) return new Map()
    const rows = (await res.json()) as { symbol: string; lastFundingRate: string }[]
    return new Map(rows.map((r) => [r.symbol, parseFloat(r.lastFundingRate) * 100]))
  } catch {
    return new Map()
  }
}

function notify(title: string, body: string): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, silent: false })
    } catch {
      /* ignore */
    }
  }
}

export default function AlertsEngine(): null {
  const markTriggered = useAlerts((s) => s.markTriggered)
  const push = useToasts((s) => s.push)
  const running = useRef(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }

    const run = async (): Promise<void> => {
      if (running.current) return
      const active = useAlerts.getState().alerts.filter((a) => a.enabled && !a.triggeredAt)
      if (active.length === 0) return
      running.current = true
      try {
        const priceSyms = [
          ...new Set(active.filter((a) => a.kind.startsWith('price_')).map((a) => a.symbol))
        ]
        const convSyms = [
          ...new Set(active.filter((a) => a.kind === 'conviction_above').map((a) => a.symbol))
        ]
        const needFunding = active.some((a) => a.kind === 'funding_below')

        const [prices, funding] = await Promise.all([
          fetchPrices(priceSyms),
          needFunding ? fetchFunding() : Promise.resolve(new Map<string, number>())
        ])
        const convScores = new Map<string, number>()
        await Promise.all(
          convSyms.map(async (s) => {
            try {
              const candles = await fetchCandles(s, '4h', 250)
              convScores.set(s, computeConviction(s, '4h', candles).score)
            } catch {
              /* skip */
            }
          })
        )

        const fire = (a: Alert, message: string): void => {
          markTriggered(a.id, message)
          const tone = a.kind === 'price_above' ? 'up' : a.kind === 'price_below' ? 'down' : 'gold'
          push({ title: `${a.symbol} alert`, body: message, tone })
          notify(`Prembroke · ${a.symbol}`, message)
        }

        for (const a of active) {
          if (a.kind === 'price_above') {
            const p = prices.get(a.symbol)
            if (p !== undefined && p >= a.value) fire(a, `Price ${p.toLocaleString('en-US')} rose above ${a.value.toLocaleString('en-US')}`)
          } else if (a.kind === 'price_below') {
            const p = prices.get(a.symbol)
            if (p !== undefined && p <= a.value) fire(a, `Price ${p.toLocaleString('en-US')} fell below ${a.value.toLocaleString('en-US')}`)
          } else if (a.kind === 'conviction_above') {
            const sc = convScores.get(a.symbol)
            if (sc !== undefined && sc >= a.value) fire(a, `Conviction score ${sc} reached ≥ ${a.value} (4h)`)
          } else if (a.kind === 'funding_below') {
            const f = funding.get(a.symbol)
            if (f !== undefined && f <= a.value) fire(a, `Funding ${f.toFixed(4)}% dropped below ${a.value}%`)
          }
        }
      } finally {
        running.current = false
      }
    }

    void run()
    const timer = window.setInterval(() => void run(), 30_000)
    return () => window.clearInterval(timer)
  }, [markTriggered, push])

  return null
}
