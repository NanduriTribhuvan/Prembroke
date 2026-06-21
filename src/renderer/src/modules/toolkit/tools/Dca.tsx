import { Plus, Trash2 } from 'lucide-react'
import { averageEntry } from '@shared/calc/dca'
import type { DcaFill } from '@shared/calc/dca'
import { Panel, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, num } from '../lib'

interface Row {
  price: string
  qty: string
}

const DEFAULTS: Row[] = [
  { price: '65000', qty: '0.2' },
  { price: '62000', qty: '0.3' },
  { price: '60000', qty: '0.5' }
]

const inputClass =
  'num w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-[13px] text-text outline-none focus:border-accent'

export default function Dca(): React.JSX.Element {
  const [rows, setRows] = usePersistedState<Row[]>('dca-rows', DEFAULTS)

  const update = (i: number, patch: Partial<Row>): void => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  const add = (): void => setRows([...rows, { price: '', qty: '' }])
  const remove = (i: number): void => setRows(rows.filter((_, idx) => idx !== i))

  const fills: DcaFill[] = rows.map((r) => ({ price: num(r.price), qty: num(r.qty) }))
  const result = averageEntry(fills)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader>Entries</SectionHeader>
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 rounded border border-edge bg-panel2 px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        <div className="mb-1 grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted/60">
          <span>Price</span>
          <span>Quantity</span>
          <span className="w-7" />
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="number"
                className={inputClass}
                value={r.price}
                placeholder="0"
                onChange={(e) => update(i, { price: e.target.value })}
              />
              <input
                type="number"
                className={inputClass}
                value={r.qty}
                placeholder="0"
                onChange={(e) => update(i, { qty: e.target.value })}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex w-7 items-center justify-center rounded border border-edge text-muted transition-colors hover:border-down hover:text-down"
                aria-label="Remove entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <BigStat label="Average entry" value={fmtUsd(result.avgPrice)} />
        <div className="mb-4 mt-1 text-[11px] text-muted">volume-weighted across {rows.length} fills</div>
        <Breakdown
          rows={[
            { label: 'Total quantity', value: fmt(result.totalQty, 6) },
            { label: 'Total cost', value: fmtUsd(result.totalCost) },
            { label: 'Number of fills', value: `${rows.length}` }
          ]}
        />
      </Panel>
    </div>
  )
}
