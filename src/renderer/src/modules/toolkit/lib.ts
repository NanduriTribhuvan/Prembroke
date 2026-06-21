import { useCallback, useState } from 'react'

/**
 * Format a number for display in the terminal. Non-finite values render as an
 * em-dash so partial/invalid input stays readable while typing.
 */
export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

/** Format a value as USD currency. */
export function fmtUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  return `$${fmt(n, digits)}`
}

/** Format a fraction (0..1) as a percentage string. */
export function fmtPct(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return '—'
  return `${fmt(fraction * 100, digits)}%`
}

/** Parse a free-text field into a number; blank/invalid yields NaN. */
export function num(value: string): number {
  if (value.trim() === '') return NaN
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

/**
 * State persisted to localStorage under the `tdx.toolkit.` namespace.
 * Falls back to the initial value when storage is empty or corrupt.
 */
export function usePersistedState<T>(key: string, initial: T): [T, (next: T) => void] {
  const storageKey = `tdx.toolkit.${key}`
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (next: T) => {
      setState(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore quota / serialization errors */
      }
    },
    [storageKey]
  )
  return [state, set]
}

/** Escape a single CSV cell (quote if it contains a comma, quote or newline). */
function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Build a CSV string from a header row and data rows.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return lines.join('\n')
}

/**
 * Trigger a browser download of text content as a file.
 */
export function downloadText(filename: string, content: string, mime = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
