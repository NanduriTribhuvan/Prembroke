import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Grid2x2, Maximize2, ExternalLink, Radio, Volume2, VolumeX } from 'lucide-react'
import { CHANNELS } from '@shared/config/channels'
import type { LiveChannel } from '@shared/config/channels'

const ACTIVE_KEY = 'tdx.tv.channel'

/** Build a YouTube embed URL with autoplay/mute params. */
function embedSrc(channel: LiveChannel, muted: boolean): string {
  const sep = channel.embedUrl.includes('?') ? '&' : '?'
  return `${channel.embedUrl}${sep}autoplay=1&mute=${muted ? 1 : 0}`
}

function youtubeChannelUrl(channel: LiveChannel): string {
  return `https://www.youtube.com/channel/${channel.channelId}/live`
}

export default function TvModule(): React.JSX.Element {
  const [activeId, setActiveId] = useState<string>(
    () => localStorage.getItem(ACTIVE_KEY) ?? CHANNELS[0].id
  )
  const [multiview, setMultiview] = useState(false)
  const [muted, setMuted] = useState(true)

  const active = CHANNELS.find((c) => c.id === activeId) ?? CHANNELS[0]

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, active.id)
  }, [active.id])

  const selectSingle = useCallback((id: string) => {
    setActiveId(id)
    setMultiview(false)
    setMuted(false)
  }, [])

  // Number-key hotkeys (1–9) switch channels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const idx = Number(e.key) - 1
      if (Number.isInteger(idx) && idx >= 0 && idx < CHANNELS.length) {
        selectSingle(CHANNELS[idx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectSingle])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-edge px-6 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-down" />
          <h1 className="text-[15px] font-medium text-text">Live TV</h1>
          <span className="ml-2 rounded bg-down/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-down">
            Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!multiview && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="flex items-center gap-1.5 rounded border border-edge bg-panel px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {muted ? 'Muted' : 'Sound on'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMultiview((m) => !m)}
            className={clsx(
              'flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] transition-colors',
              multiview
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-edge bg-panel text-muted hover:border-accent hover:text-text'
            )}
          >
            {multiview ? <Maximize2 className="h-3.5 w-3.5" /> : <Grid2x2 className="h-3.5 w-3.5" />}
            {multiview ? 'Single view' : 'Multiview'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Player area */}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          {multiview ? (
            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
              {CHANNELS.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectSingle(c.id)}
                  className="group relative overflow-hidden rounded border border-edge bg-black text-left"
                >
                  <iframe
                    title={c.label}
                    src={embedSrc(c, true)}
                    className="pointer-events-none h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-text">
                    {c.label}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center bg-bg/0 opacity-0 transition-opacity group-hover:bg-bg/40 group-hover:opacity-100">
                    <span className="rounded bg-accent px-3 py-1 text-[11px] font-semibold text-bg">
                      Watch
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Player channel={active} muted={muted} />
          )}
        </div>

        {/* Channel sidebar */}
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-edge bg-panel/40 p-3">
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Channels
          </div>
          <div className="space-y-1.5">
            {CHANNELS.map((c, i) => {
              const isActive = c.id === active.id && !multiview
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectSingle(c.id)}
                  className={clsx(
                    'flex w-full items-center justify-between rounded border px-3 py-2.5 text-left transition-colors',
                    isActive
                      ? 'border-accent bg-accent/10'
                      : 'border-edge bg-panel hover:border-accent/50 hover:bg-panel2'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <kbd className="num shrink-0 rounded border border-edge bg-panel2 px-1 text-[9px] text-muted">
                      {i + 1}
                    </kbd>
                    <div className="min-w-0">
                      <div className={clsx('truncate text-[13px] font-medium', isActive ? 'text-accent' : 'text-text')}>
                        {c.label}
                      </div>
                      <div className="truncate text-[10px] text-muted">{c.category}</div>
                    </div>
                  </div>
                  <span className="ml-2 flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase text-down">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-down" />
                    Live
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-4 px-1 text-[10px] leading-relaxed text-muted/70">
            Streams are official free YouTube live channels. If a broadcaster is not currently live,
            the player shows a fallback link.
          </p>
        </aside>
      </div>
    </div>
  )
}

function Player({ channel, muted }: { channel: LiveChannel; muted: boolean }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const loadedRef = useRef(false)

  // Reset failure state when channel changes; assume offline only if nothing loads.
  useEffect(() => {
    setFailed(false)
    loadedRef.current = false
  }, [channel.id])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden rounded border border-edge bg-black">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Radio className="h-8 w-8 text-muted" />
            <div className="text-sm text-text">Stream offline</div>
            <div className="max-w-xs text-[12px] text-muted">
              {channel.label} doesn&apos;t appear to be live right now.
            </div>
            <button
              type="button"
              onClick={() => window.open(youtubeChannelUrl(channel), '_blank')}
              className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/25"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open on YouTube
            </button>
          </div>
        ) : (
          <iframe
            key={`${channel.id}-${muted ? 'm' : 's'}`}
            title={channel.label}
            src={embedSrc(channel, muted)}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => {
              loadedRef.current = true
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>

      {/* Info bar */}
      <div className="mt-2 flex items-center justify-between rounded border border-edge bg-panel px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-text">{channel.label}</span>
          <span className="text-[11px] text-muted">{channel.category}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted/70">Official free YouTube live channel</span>
          <button
            type="button"
            onClick={() => window.open(youtubeChannelUrl(channel), '_blank')}
            className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent"
          >
            <ExternalLink className="h-3 w-3" />
            YouTube
          </button>
          <button
            type="button"
            onClick={() => setFailed(true)}
            className="text-[11px] text-muted/60 transition-colors hover:text-text"
          >
            Stream not loading?
          </button>
        </div>
      </div>
    </div>
  )
}
