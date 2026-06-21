import clsx from 'clsx'

interface SparklineProps {
  data: number[]
  tone?: 'up' | 'down' | 'muted'
  width?: number
  height?: number
}

export function Sparkline({
  data,
  tone = 'muted',
  width = 80,
  height = 24,
}: SparklineProps): React.JSX.Element {
  if (data.length < 2) {
    return <svg width={width} height={height} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={clsx(
        tone === 'up' && 'text-up',
        tone === 'down' && 'text-down',
        tone === 'muted' && 'text-muted',
      )}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
