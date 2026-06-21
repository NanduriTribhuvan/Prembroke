import type { ReactNode } from 'react'
import clsx from 'clsx'

/** Uppercase, letter-spaced section header used across tools. */
export function SectionHeader({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </div>
  )
}

/** A bordered panel block. */
export function Panel({
  children,
  className
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={clsx('rounded border border-edge bg-panel p-4', className)}>{children}</div>
  )
}

/** Labeled field wrapper with an optional inline unit suffix. */
export function Field({
  label,
  unit,
  children
}: {
  label: string
  unit?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] text-muted">
        {label}
        {unit ? <span className="text-[10px] text-muted/70">{unit}</span> : null}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'num w-full rounded border border-edge bg-panel2 px-2.5 py-1.5 text-[13px] text-text outline-none transition-colors focus:border-accent placeholder:text-muted/40'

/** Controlled numeric text input (kept as a string for free editing). */
export function NumberInput({
  value,
  onChange,
  placeholder,
  step
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  step?: string
}): React.JSX.Element {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      className={inputClass}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Styled select input. */
export function SelectInput({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}): React.JSX.Element {
  return (
    <select
      className={clsx(inputClass, 'cursor-pointer appearance-none')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-panel2 text-text">
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** A small segmented control (e.g. long/short). */
export function Segmented<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; tone?: 'up' | 'down' | 'accent' }[]
}): React.JSX.Element {
  return (
    <div className="inline-flex rounded border border-edge bg-panel2 p-0.5">
      {options.map((o) => {
        const active = o.value === value
        const tone = o.tone ?? 'accent'
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors',
              active
                ? tone === 'up'
                  ? 'bg-up/20 text-up'
                  : tone === 'down'
                    ? 'bg-down/20 text-down'
                    : 'bg-accent/20 text-accent'
                : 'text-muted hover:text-text'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** The hero result number, large and accent-coloured. */
export function BigStat({
  label,
  value,
  tone = 'accent'
}: {
  label: string
  value: string
  tone?: 'accent' | 'up' | 'down' | 'text'
}): React.JSX.Element {
  return (
    <div>
      <SectionHeader>{label}</SectionHeader>
      <div
        className={clsx(
          'num text-3xl font-semibold leading-none',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'accent' && 'text-accent',
          tone === 'text' && 'text-text'
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Key/value breakdown table for intermediate values. */
export function Breakdown({
  rows
}: {
  rows: { label: string; value: string; tone?: 'up' | 'down' | 'muted' }[]
}): React.JSX.Element {
  return (
    <div className="divide-y divide-edge/60 overflow-hidden rounded border border-edge">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[12px] text-muted">{r.label}</span>
          <span
            className={clsx(
              'num text-[12px]',
              r.tone === 'up' && 'text-up',
              r.tone === 'down' && 'text-down',
              r.tone === 'muted' ? 'text-muted' : 'text-text'
            )}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
