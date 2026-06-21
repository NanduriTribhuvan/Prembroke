import clsx from 'clsx'

interface SkeletonProps {
  width?: string
  height?: string
  rounded?: boolean
  className?: string
}

export function Skeleton({
  width,
  height,
  rounded = false,
  className,
}: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={clsx('animate-pulse bg-panel2', rounded && 'rounded', className)}
      style={{ width, height }}
    />
  )
}
