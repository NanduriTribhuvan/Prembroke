import { type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { SkeletonTable } from './SkeletonTable'
import { EmptyState } from './EmptyState'
import { ErrorBanner } from './ErrorBanner'

interface ColDef<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
  sortable?: boolean
  render?: (row: T) => ReactNode
}

interface DataTableProps<T> {
  cols: ColDef<T>[]
  rows: T[]
  rowKey: (row: T) => string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onRowClick?: (row: T) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyTitle?: string
}

const alignClass: Record<NonNullable<ColDef<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export function DataTable<T>({
  cols,
  rows,
  rowKey,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  loading = false,
  error,
  onRetry,
  emptyTitle = 'No data',
}: DataTableProps<T>): React.JSX.Element {
  if (loading) {
    return <SkeletonTable cols={cols.length} />
  }

  if (error) {
    return (
      <div className="p-3">
        <ErrorBanner message={error} onRetry={onRetry} />
      </div>
    )
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} />
  }

  return (
    <div className="w-full overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-edge">
            {cols.map((col) => {
              const isActive = sortKey === col.key
              const canSort = col.sortable === true && onSort !== undefined
              return (
                <th
                  key={col.key}
                  className={clsx(
                    'text-[length:var(--text-label)] uppercase tracking-wider text-muted font-semibold px-3',
                    'whitespace-nowrap select-none',
                    alignClass[col.align ?? 'left'],
                    canSort && 'cursor-pointer hover:text-text t-colors',
                  )}
                  style={{
                    height: 'var(--row-h)',
                    width: col.width,
                  }}
                  onClick={canSort ? () => onSort!(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.header}
                    {canSort && isActive && (
                      <>
                        {sortDir === 'asc' ? (
                          <ChevronUp size={10} />
                        ) : (
                          <ChevronDown size={10} />
                        )}
                      </>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={clsx(
                'data-row border-b border-edge last:border-0',
                onRowClick !== undefined && 'cursor-pointer',
              )}
              onClick={onRowClick !== undefined ? () => onRowClick(row) : undefined}
            >
              {cols.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'px-3 text-[length:var(--text-body)] text-text',
                    alignClass[col.align ?? 'left'],
                  )}
                  style={{ height: 'var(--row-h)' }}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
