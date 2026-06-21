import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { Candle } from '@shared/indicators/types'
import { seasonalityByWeekday, seasonalityByMonth } from '@shared/analysis/stats'
import type { SeasonalBucket } from '@shared/analysis/stats'
import { CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Field, SelectInput, SectionHeader } from '../ui'
import { usePersistedState, fmt } from '../lib'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SYMBOL_OPTIONS = CRYPTO_SYMBOLS.filter((s) => s.binance).map((s) => ({
  value: s.binance as string,
  label: s.label
}))

function BarRow({ label, bucket, max }: { label: string; bucket: SeasonalBucket; max: number }): React.JSX.Element {
  const v = bucket.avgReturnPct
  const pos = Number.isFinite(v) && v >= 0
  const width = Number.isFinite(v) && max > 0 ? (Math.abs(v) / max) * 50 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-[12px] text-muted">{label}</span>
      <div className="relative flex h-5 flex-1 items-center">
        <div className="absolute left-1/2 h-full w-px bg-edge" />
        <div
          className={clsx('absolute h-3 rounded', pos ? 'left-1/2 bg-up/70' : 'right-1/2 bg-down/70')}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={clsx('num w-16 text-right text-[12px]', pos ? 'text-up' : 'text-down')}>
        {Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${fmt(v, 2)}%` : '—'}
      </span>
    </div>
  )
}

export default function Seasonality(): React.JSX.Element {
  const [symbol, setSymbol] = usePersistedState<string>('season-symbol', 'BTCUSDT')
  const [weekday, setWeekday] = useState<SeasonalBucket[]>([])
  const [month, setMonth] = useState<SeasonalBucket[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async (sym: string) => {
    setStatus('loading')
    try {
      const res = await fetch(
        `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=1d&limit=1000`
      )
      if (!res.ok) throw new Error()
      const raw = (await res.json()) as unknown[][]
      const candles: Candle[] = raw.map((k) => ({
        time: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5])
      }))
      setWeekday(seasonalityByWeekday(candles))
      setMonth(seasonalityByMonth(candles))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(symbol)
  }, [symbol, load])

  const wdMax = Math.max(...weekday.map((b) => (Number.isFinite(b.avgReturnPct) ? Math.abs(b.avgReturnPct) : 0)), 0.0001)
  const moMax = Math.max(...month.map((b) => (Number.isFinite(b.avgReturnPct) ? Math.abs(b.avgReturnPct) : 0)), 0.0001)

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-end justify-between">
          <Field label="Symbol">
            <SelectInput value={symbol} onChange={setSymbol} options={SYMBOL_OPTIONS} />
          </Field>
          <button
            type="button"
            onClick={() => load(symbol)}
            className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </Panel>

      {status === 'loading' && (
        <Panel>
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading up to 1000 days…
          </div>
        </Panel>
      )}
      {status === 'error' && (
        <Panel>
          <div className="py-12 text-center text-[12px] text-muted">Couldn&apos;t load history.</div>
        </Panel>
      )}
      {status === 'ready' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel>
            <SectionHeader>Avg return by weekday (UTC)</SectionHeader>
            <div className="space-y-1.5">
              {weekday.map((b) => (
                <BarRow key={b.index} label={WEEKDAYS[b.index]} bucket={b} max={wdMax} />
              ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader>Avg return by month</SectionHeader>
            <div className="space-y-1.5">
              {month.map((b) => (
                <BarRow key={b.index} label={MONTHS[b.index]} bucket={b} max={moMax} />
              ))}
            </div>
          </Panel>
        </div>
      )}
      <p className="px-1 text-[10px] leading-relaxed text-muted/70">
        Mean close-to-close return per calendar bucket over the available daily history. Past
        seasonality is descriptive, not predictive.
      </p>
    </div>
  )
}
