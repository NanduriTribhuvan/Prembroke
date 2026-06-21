/** Lightweight CSV/JSON export helpers for the data modules (programmability). */

function download(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Export an array of flat objects to CSV. Columns inferred from the first row (or `cols`). */
export function exportCsv(filename: string, rows: Record<string, unknown>[], cols?: string[]): void {
  if (rows.length === 0) return
  const headers = cols ?? Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map((h) => escapeCell(r[h])).join(','))
  download(filename.endsWith('.csv') ? filename : `${filename}.csv`, lines.join('\n'), 'text/csv')
}

export function exportJson(filename: string, data: unknown): void {
  download(
    filename.endsWith('.json') ? filename : `${filename}.json`,
    JSON.stringify(data, null, 2),
    'application/json'
  )
}
