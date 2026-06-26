interface ScoreRingProps {
  score: number
  size?: number
  label?: string
}

function getStrokeVar(score: number): string {
  if (score >= 70) return 'var(--color-up)'
  if (score >= 40) return 'var(--color-warn)'
  return 'var(--color-down)'
}

export function ScoreRing({
  score,
  size = 64,
  label,
}: ScoreRingProps): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, score))
  const strokeWidth = 4
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        style={
          {
            '--motion-slow': 'var(--motion-slow)',
          } as React.CSSProperties
        }
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-panel2"
        />
        {/* Progress */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={getStrokeVar(clamped)}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: `stroke-dashoffset var(--motion-slow) var(--motion-ease)`,
          }}
        />
        {/* Center label */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="num fill-text"
          style={{ fontSize: 'var(--text-label)', fontWeight: 600 }}
        >
          {clamped}
        </text>
      </svg>
      {label !== undefined && (
        <span className="text-[length:var(--text-caption)] text-muted">{label}</span>
      )}
    </div>
  )
}
