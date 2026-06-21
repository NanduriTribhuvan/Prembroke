import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { FileUp, Link2, FileText, X, ExternalLink } from 'lucide-react'
import { usePersistedState } from '../lib'

interface Doc {
  name: string
  /** Either a blob: URL (local file) or an https URL. */
  url: string
  /** True when this came from a picked file (blob URL, not persistable). */
  local: boolean
}

export default function ResearchReader(): React.JSX.Element {
  const [doc, setDoc] = useState<Doc | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [recent, setRecent] = usePersistedState<string[]>('pdf-recent', [])
  const fileRef = useRef<HTMLInputElement>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Revoke any outstanding blob URL when it changes or on unmount.
  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])
  useEffect(() => revokeBlob, [revokeBlob])

  const openFile = useCallback(
    (file: File) => {
      revokeBlob()
      const url = URL.createObjectURL(file)
      blobUrlRef.current = url
      setDoc({ name: file.name, url, local: true })
    },
    [revokeBlob]
  )

  const openUrl = useCallback(
    (raw: string) => {
      const url = raw.trim()
      if (!/^https:\/\/.+/i.test(url)) return
      revokeBlob()
      const name = url.split('/').pop() || url
      setDoc({ name, url, local: false })
      setRecent([url, ...recent.filter((u) => u !== url)].slice(0, 6))
    },
    [recent, revokeBlob, setRecent]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file && file.type === 'application/pdf') openFile(file)
    },
    [openFile]
  )

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[480px] flex-col">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded border border-edge bg-panel px-3 py-1.5 text-[12px] text-text transition-colors hover:border-accent"
        >
          <FileUp className="h-3.5 w-3.5 text-accent" />
          Open PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) openFile(f)
            e.target.value = ''
          }}
        />
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            openUrl(urlInput)
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…/report.pdf"
              className="w-full rounded border border-edge bg-panel2 py-1.5 pl-7 pr-2 text-[12px] text-text outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            Load
          </button>
        </form>
        {doc && (
          <button
            type="button"
            onClick={() => {
              revokeBlob()
              setDoc(null)
            }}
            className="flex items-center gap-1 rounded border border-edge bg-panel px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:border-down hover:text-down"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        )}
      </div>

      {/* Viewer / dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'relative flex-1 overflow-hidden rounded border bg-panel',
          dragging ? 'border-accent' : 'border-edge'
        )}
      >
        {doc ? (
          <>
            <div className="flex items-center justify-between border-b border-edge px-3 py-1.5">
              <span className="flex items-center gap-1.5 truncate text-[11px] text-muted">
                <FileText className="h-3.5 w-3.5 text-accent" />
                {doc.name}
              </span>
              {!doc.local && (
                <button
                  type="button"
                  onClick={() => window.open(doc.url, '_blank')}
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-accent"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open externally
                </button>
              )}
            </div>
            <iframe title={doc.name} src={doc.url} className="h-[calc(100%-32px)] w-full bg-white" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <FileText className="h-10 w-10 text-muted/50" />
            <div>
              <div className="text-[14px] text-text">Drop a PDF here</div>
              <div className="mt-1 text-[12px] text-muted">
                or use “Open PDF” / paste a URL above. Research reports, earnings decks, whitepapers.
              </div>
            </div>
            {recent.length > 0 && (
              <div className="w-full max-w-md">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted/60">Recent URLs</div>
                <div className="space-y-1">
                  {recent.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => openUrl(u)}
                      className="block w-full truncate rounded border border-edge bg-panel2 px-2 py-1 text-left text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
