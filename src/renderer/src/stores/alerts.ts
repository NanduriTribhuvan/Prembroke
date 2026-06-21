import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AlertKind = 'price_above' | 'price_below' | 'conviction_above' | 'funding_below'

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  price_above: 'Price rises above',
  price_below: 'Price falls below',
  conviction_above: 'Conviction score ≥',
  funding_below: 'Funding rate below (%)'
}

export interface Alert {
  id: string
  symbol: string
  kind: AlertKind
  value: number
  note?: string
  enabled: boolean
  createdAt: number
  triggeredAt?: number
}

export interface TriggerLog {
  id: string
  symbol: string
  message: string
  at: number
}

interface AlertsState {
  alerts: Alert[]
  log: TriggerLog[]
  add: (a: Pick<Alert, 'symbol' | 'kind' | 'value' | 'note'>) => void
  remove: (id: string) => void
  toggle: (id: string) => void
  rearm: (id: string) => void
  markTriggered: (id: string, message: string) => void
  clearLog: () => void
}

const uid = (): string => Math.random().toString(36).slice(2, 10)

export const useAlerts = create<AlertsState>()(
  persist(
    (set) => ({
      alerts: [],
      log: [],
      add: (a) =>
        set((s) => ({
          alerts: [
            { ...a, id: uid(), enabled: true, createdAt: Date.now() },
            ...s.alerts
          ]
        })),
      remove: (id) => set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),
      toggle: (id) =>
        set((s) => ({
          alerts: s.alerts.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
        })),
      rearm: (id) =>
        set((s) => ({
          alerts: s.alerts.map((x) =>
            x.id === id ? { ...x, enabled: true, triggeredAt: undefined } : x
          )
        })),
      markTriggered: (id, message) =>
        set((s) => {
          const a = s.alerts.find((x) => x.id === id)
          return {
            alerts: s.alerts.map((x) =>
              x.id === id ? { ...x, enabled: false, triggeredAt: Date.now() } : x
            ),
            log: [
              { id: uid(), symbol: a?.symbol ?? '', message, at: Date.now() },
              ...s.log
            ].slice(0, 50)
          }
        }),
      clearLog: () => set({ log: [] })
    }),
    { name: 'prembroke.alerts' }
  )
)
