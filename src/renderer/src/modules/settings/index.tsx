import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Settings as SettingsIcon,
  Wifi,
  Sparkles,
  Database,
  Trash2,
  Activity,
  KeyRound,
  ExternalLink,
  BrainCircuit,
  Sun,
  Moon,
  Monitor,
  Rows3
} from 'lucide-react'
import { useFeedStatus } from '@/ws/binance'
import {
  useSettings,
  ACCENTS,
  ZOOM_LEVELS,
  DENSITY_OPTIONS,
  type AccentId,
  type AppThemeMode
} from '@/stores/settings'
import { useWorkspace } from '@/stores/workspace'
import { useAlerts } from '@/stores/alerts'
import { useKeys, KEY_META } from '@/stores/keys'
import { useAiLimit } from '@/stores/ailimit'
import { useAiConfig } from '@/stores/ai'
import { CLOUD_PROVIDERS, type AiProviderId } from '@/lib/ai'

const INTERVALS = ['15m', '1h', '4h', '1d']

/** Appearance modes for the picker (sentence case, lucide icons). */
const MODE_OPTIONS: { id: AppThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'system', label: 'System', Icon: Monitor }
]

/**
 * A small live composition that reads the live theme CSS vars, so it re-renders
 * instantly as the user flips mode / accent / density. Demonstrates the surface
 * elevation, accent fill, focus ring, up/down, and a `text-accent` highlight.
 */
function ThemePreview(): React.JSX.Element {
  return (
    <div className="rounded-sm border border-edge bg-panel p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <Sparkles size={13} className="text-accent" /> Live preview
      </div>
      <div className="rounded-sm border border-border-subtle bg-elevated p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-text">BTCUSDT</span>
          <span className="text-accent text-[11px] font-medium">Conviction A+</span>
        </div>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="num text-up text-lg">64,820.50</span>
          <span className="num text-up text-xs">+2.41%</span>
          <span className="num text-down text-xs">−1.07%</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded bg-accent px-3 py-1 text-xs font-medium text-bg hover:bg-accent-strong">
            Load
          </button>
          <button className="rounded bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            Linked
          </button>
          <input
            defaultValue="ETH 4H"
            className="num focus-ring w-24 rounded border border-edge bg-panel px-2 py-1 text-xs text-text outline-none"
          />
        </div>
        <div className="mt-2 text-[10px] text-text-secondary">
          Secondary text · borders · elevation all follow the theme
        </div>
      </div>
    </div>
  )
}


function StatusRow({
  label,
  ok,
  detail
}: {
  label: string
  ok: boolean | null
  detail: string
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-edge/40 py-2 last:border-0">
      <span className="text-[13px] text-text">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted">{detail}</span>
        <span
          className={clsx(
            'h-2 w-2 rounded-full',
            ok === null ? 'bg-muted' : ok ? 'bg-up' : 'bg-down'
          )}
        />
      </div>
    </div>
  )
}

/** Free-AI setup: cloud keys + local engines + primary-engine preference. */
function AiEngineCard(): React.JSX.Element {
  const keys = useKeys()
  const primary = useAiConfig((s) => s.primary)
  const setPrimary = useAiConfig((s) => s.setPrimary)
  const [local, setLocal] = useState<{ ollama: boolean; hermes: boolean }>({ ollama: false, hermes: false })

  useEffect(() => {
    Promise.all([window.api.ai.status(), window.api.ai.ollama.status()])
      .then(([h, o]) => setLocal({ ollama: o.running && o.models.length > 0, hermes: h.installed }))
      .catch(() => undefined)
  }, [])

  const options: { id: AiProviderId | 'auto'; label: string }[] = [
    { id: 'auto', label: 'Auto (fastest available)' },
    ...CLOUD_PROVIDERS.map((p) => ({ id: p.id as AiProviderId, label: p.label })),
    { id: 'ollama', label: 'Ollama (local)' },
    { id: 'hermes', label: 'Hermes (local)' }
  ]

  return (
    <div className="col-span-2 rounded-sm border border-edge bg-panel p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <BrainCircuit size={13} className="text-accent" /> AI engine (free)
      </div>
      <div className="mb-3 text-[11px] text-muted">
        Paste any one free key and the AI Mentor, Explain buttons, Conviction critique and Research Team turn
        on. Engines are tried in order — the first to answer wins.
      </div>

      <div className="mb-3 flex items-center justify-between border-b border-edge/40 pb-3">
        <div>
          <div className="text-[13px] text-text">Primary engine</div>
          <div className="text-[11px] text-muted">Which provider to try first</div>
        </div>
        <select
          value={primary}
          onChange={(e) => setPrimary(e.target.value as AiProviderId | 'auto')}
          className="rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {CLOUD_PROVIDERS.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-32 shrink-0">
              <a
                href={p.url}
                onClick={(e) => {
                  e.preventDefault()
                  window.open(p.url, '_blank')
                }}
                className="flex items-center gap-1 text-[13px] text-text hover:text-accent"
              >
                {p.label} <ExternalLink size={11} />
              </a>
              <div className="text-[10px] text-muted">{p.note}</div>
            </div>
            <input
              type="password"
              value={keys[p.id]}
              onChange={(e) => keys.setKey(p.id, e.target.value.trim())}
              placeholder="paste free key…"
              className="num flex-1 rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
            />
            <span className={clsx('h-2 w-2 shrink-0 rounded-full', keys[p.id] ? 'bg-up' : 'bg-edge')} />
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-edge/40 pt-1">
        <StatusRow
          label="Ollama (local · private)"
          ok={local.ollama}
          detail={local.ollama ? 'running' : 'not detected'}
        />
        <StatusRow label="Hermes (local)" ok={local.hermes} detail={local.hermes ? 'installed' : 'not found'} />
      </div>
    </div>
  )
}

export default function SettingsModule(): React.JSX.Element {
  const feed = useFeedStatus()
  const qc = useQueryClient()
  const {
    defaultInterval,
    reduceMotion,
    accent,
    mode,
    density,
    zoom,
    setDefaultInterval,
    setReduceMotion,
    setAccent,
    setMode,
    setDensity,
    setZoom
  } = useSettings()
  const canvasEnabled = useWorkspace((s) => s.canvasEnabled)
  const setCanvasEnabled = useWorkspace((s) => s.setCanvasEnabled)
  const keys = useKeys()
  const perHour = useAiLimit((s) => s.perHour)
  const remaining = useAiLimit((s) => s.remaining())
  const setPerHour = useAiLimit((s) => s.setPerHour)
  const [hermes, setHermes] = useState<boolean | null>(null)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    window.api.ai.status().then((s) => setHermes(s.installed)).catch(() => setHermes(false))
  }, [])

  const versions = window.api.versions

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <SettingsIcon size={18} className="text-accent" />
        <h1 className="text-[15px] font-semibold text-text">Settings &amp; System</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid max-w-3xl grid-cols-2 gap-4">
          {/* status */}
          <div className="rounded-sm border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Activity size={13} className="text-accent" /> Data feeds
            </div>
            <StatusRow
              label="Binance WebSocket"
              ok={feed === 'live'}
              detail={feed.toUpperCase()}
            />
            <StatusRow
              label="Hermes AI"
              ok={hermes}
              detail={hermes === null ? 'checking…' : hermes ? 'installed' : 'not found'}
            />
            <StatusRow label="News & Calendar" ok={true} detail="main-process RSS/JSON" />
          </div>

          {/* about */}
          <div className="rounded-sm border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Wifi size={13} className="text-accent" /> About
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Product</span>
                <span className="brandmark">PREMBROKE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Version</span>
                <span className="num text-text">0.3 · Conviction Terminal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Electron</span>
                <span className="num text-text">{versions.electron}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Chromium</span>
                <span className="num text-text">{versions.chrome}</span>
              </div>
            </div>
          </div>

          {/* preferences */}
          <div className="col-span-2 rounded-sm border border-edge bg-panel p-3">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Sparkles size={13} className="text-accent" /> Preferences
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">Default timeframe</div>
                <div className="text-[11px] text-muted">Used by Scanner &amp; Conviction on launch</div>
              </div>
              <div className="flex gap-1">
                {INTERVALS.map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setDefaultInterval(iv)}
                    className={clsx(
                      'rounded px-2 py-1 text-xs',
                      defaultInterval === iv ? 'bg-gold/20 text-accent' : 'text-muted hover:bg-panel2'
                    )}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">Accent theme</div>
                <div className="text-[11px] text-muted">Recolours highlights across the terminal</div>
              </div>
              <div className="flex gap-1.5">
                {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setAccent(id)}
                    title={ACCENTS[id].label}
                    className={clsx(
                      'h-5 w-5 rounded-full border transition-transform hover:scale-110',
                      accent === id ? 'border-text' : 'border-edge'
                    )}
                    style={{ backgroundColor: ACCENTS[id].accent }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">Appearance</div>
                <div className="text-[11px] text-muted">Light or dark — or follow the system</div>
              </div>
              <div className="flex gap-1">
                {MODE_OPTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded px-2 py-1 text-xs',
                      mode === id ? 'bg-gold/20 text-accent' : 'text-muted hover:bg-panel2'
                    )}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">Density</div>
                <div className="text-[11px] text-muted">Spacing &amp; row height — independent of zoom</div>
              </div>
              <div className="flex gap-1">
                {DENSITY_OPTIONS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDensity(d.id)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded px-2 py-1 text-xs',
                      density === d.id ? 'bg-gold/20 text-accent' : 'text-muted hover:bg-panel2'
                    )}
                  >
                    {d.id === 'cozy' && <Rows3 size={13} />}
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">Zoom</div>
                <div className="text-[11px] text-muted">Scale the whole UI to fit more or less on screen</div>
              </div>
              <div className="flex gap-1">
                {ZOOM_LEVELS.map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={clsx(
                      'num rounded px-2 py-1 text-xs',
                      zoom === z ? 'bg-gold/20 text-accent' : 'text-muted hover:bg-panel2'
                    )}
                  >
                    {Math.round(z * 100)}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">AI usage limit</div>
                <div className="text-[11px] text-muted">
                  Cap AI requests per hour ({remaining} left now) — protects free models &amp; keys
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPerHour(perHour - 10)}
                  className="rounded border border-edge px-2 py-1 text-xs text-muted hover:text-text"
                >
                  −
                </button>
                <span className="num w-10 text-center text-sm text-text">{perHour}/hr</span>
                <button
                  onClick={() => setPerHour(perHour + 10)}
                  className="rounded border border-edge px-2 py-1 text-xs text-muted hover:text-text"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-edge/40 py-2">
              <div>
                <div className="text-[13px] text-text">Reduce motion</div>
                <div className="text-[11px] text-muted">Disable module transition animations</div>
              </div>
              <button
                onClick={() => setReduceMotion(!reduceMotion)}
                className={clsx(
                  'relative h-5 w-9 rounded-full transition-colors',
                  reduceMotion ? 'bg-gold/60' : 'bg-panel2'
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-text transition-all',
                    reduceMotion ? 'left-[18px]' : 'left-0.5'
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-[13px] text-text">Widget canvas</div>
                <div className="text-[11px] text-muted">
                  Replace the tiled panes with a draggable widget workspace
                </div>
              </div>
              <button
                onClick={() => setCanvasEnabled(!canvasEnabled)}
                className={clsx(
                  'relative h-5 w-9 rounded-full transition-colors',
                  canvasEnabled ? 'bg-gold/60' : 'bg-panel2'
                )}
              >
                <span
                  className={clsx(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-text transition-all',
                    canvasEnabled ? 'left-[18px]' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          </div>

          {/* AI engine */}
          <AiEngineCard />

          {/* live theme preview + appearance notes */}
          <ThemePreview />
          <div className="rounded-sm border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Sun size={13} className="text-accent" /> Appearance
            </div>
            <div className="space-y-1.5 text-[11px] text-muted">
              <p>
                <span className="text-text">Dark</span> is the default. <span className="text-text">Light</span>{' '}
                uses a warm-neutral palette tuned for AA-readable text.
              </p>
              <p>
                <span className="text-text">Accent</span> recolours buttons, links, focus rings and every{' '}
                <span className="text-accent">highlight</span> — up/down stay green/red.
              </p>
              <p>
                <span className="text-text">Density</span> changes spacing and the canvas row height;{' '}
                <span className="text-text">Zoom</span> scales the whole UI.
              </p>
              <p>
                <span className="text-text">Reduce motion</span> freezes every animation and transition.
              </p>
            </div>
          </div>


          {/* api keys */}
          <div className="col-span-2 rounded-sm border border-edge bg-panel p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <KeyRound size={13} className="text-accent" /> API keys (optional, free)
            </div>
            <div className="mb-3 text-[11px] text-muted">
              Paste any free key to unlock richer data. Stored locally on this machine only.
            </div>
            <div className="space-y-2">
              {KEY_META.map((k) => (
                <div key={k.id} className="flex items-center gap-2">
                  <div className="w-32 shrink-0">
                    <a
                      href={k.url}
                      onClick={(e) => {
                        e.preventDefault()
                        window.open(k.url, '_blank')
                      }}
                      className="flex items-center gap-1 text-[13px] text-text hover:text-accent"
                    >
                      {k.label} <ExternalLink size={11} />
                    </a>
                    <div className="text-[10px] text-muted">{k.unlocks}</div>
                  </div>
                  <input
                    type="password"
                    value={keys[k.id]}
                    onChange={(e) => keys.setKey(k.id, e.target.value.trim())}
                    placeholder="paste key…"
                    className="num flex-1 rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                  />
                  <span
                    className={clsx(
                      'h-2 w-2 shrink-0 rounded-full',
                      keys[k.id] ? 'bg-up' : 'bg-edge'
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* maintenance */}
          <div className="col-span-2 rounded-sm border border-edge bg-panel p-3">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Database size={13} className="text-accent" /> Maintenance
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  qc.clear()
                  setCleared(true)
                  setTimeout(() => setCleared(false), 1500)
                }}
                className="flex items-center gap-1.5 rounded border border-edge px-3 py-1.5 text-xs text-text hover:bg-panel2"
              >
                <Trash2 size={13} /> {cleared ? 'Cache cleared' : 'Clear data cache'}
              </button>
              <button
                onClick={() => useAlerts.setState({ alerts: [], log: [] })}
                className="flex items-center gap-1.5 rounded border border-edge px-3 py-1.5 text-xs text-text hover:bg-panel2"
              >
                <Trash2 size={13} /> Reset alerts
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-[10px] leading-relaxed text-muted">
          Prembroke is an analysis terminal — not a broker, wallet, or exchange. Nothing here is financial
          advice. Workspace, alerts, and preferences are stored locally on this machine.
        </p>
      </div>
    </div>
  )
}
