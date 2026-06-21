import { Skeleton } from './Skeleton'

interface SkeletonTableProps {
  cols: number
  rows?: number
}

export function SkeletonTable({
  cols,
  rows = 5,
}: SkeletonTableProps): React.JSX.Element {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-2 px-3 border-b border-edge"
          style={{ height: 'var(--row-h)' }}
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              height="10px"
              rounded
              className="flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  )
}
