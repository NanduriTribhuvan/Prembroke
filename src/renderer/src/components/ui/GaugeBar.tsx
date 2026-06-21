import clsx from 'clsx'

interface GaugeBarProps {
  value: number
  tone?: 'up' | 'down' | 'gold' | 'warn'
  label?: string
  height?: number
}

const toneVar: Record<NonNullable<GaugeBarProps['tone']>, string> = {
  up: 'var(--color-up)',
  down: 'var(--color-down)',
  gold: 'var(--color-gold)',
  warn: 'var(--color-warn)',
}

export function GaugeBar({
  value,
  tone = 'up',
  label,
  height = 6,
}: GaugeBarProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className="flex flex-col gap-1 w-full">
      {label !== undefined && (
        <span className="text-[length:var(--text-caption)] text-muted">{label}</span>
      )}
      <div
        className="w-full rounded-full overflow-hidden bg-panel2"
        style={{ height }}
      >
        <div
          className={clsx('h-full rounded-full t-colors')}
          style={{
            width: `${clamped}%`,
            backgroundColor: toneVar[tone],
          }}
        />
      </div>
    </div>
  )
}
