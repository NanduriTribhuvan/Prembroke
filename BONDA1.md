# BONDA1 — Prembroke Build & Handoff Spec (for Kiro)

> **Read this top-to-bottom before writing code.** It documents the whole codebase,
> the conventions, the contracts you must not break, and your concrete next tasks.
> Prembroke is a working, green (typecheck + 203 tests + build) Electron desktop
> terminal. Don't rewrite what works — extend it following the patterns below.

---

## 1. What Prembroke is

A **desktop "AI Chief Investment Officer" terminal** for crypto + forex + (US) equities.
Positioning: **don't compete with Bloomberg on data — compete on synthesis.** The
front door is **Alpha Radar** (a morning brief: "I found N opportunities, M risks, K
narratives"), powered by a proprietary **Conviction Engine** (ICT/Smart-Money-Concepts
confluence → 0–100 score + reasons) and an **AI Mentor** that *explains* data instead
of just showing it.

- **Not** a broker / wallet / exchange. Analysis & decision-support only.
- Brand: **Prembroke** (note spelling), leaf logo, green→gold palette.
- Free/own-key data only (Binance, SEC EDGAR, DeFiLlama, CoinGecko, Finnhub, etc.).

---

## 2. Quick start

```bash
npm install
npm run dev         # electron-vite dev (HMR) — opens the app
npm run typecheck   # tsc -p tsconfig.node.json && tsc   (MUST stay green)
npm test            # vitest (src/shared) — 89 tests, MUST stay green
npm run build       # electron-vite build → out/  (MUST stay green)
npm run dist        # electron-builder win installer + portable (see Gotchas)
npm run dist:dir    # unpacked build only
```

- **App PIN:** `8835` (PinGate; per-session, resets each launch).
- **Launch the built app without packaging:** `npm run build` then run
  `node_modules\electron\dist\electron.exe .` from the repo root (loads `out/`).
- **Definition of done for ANY change:** `npm run typecheck && npm test && npm run build` all green.

---

## 3. Tech stack & hard conventions

- Electron 42 · electron-vite 5 · Vite 7 (NOT 8) · React 19 · **TypeScript 6 strict, no `any`** · Tailwind v4 (`@tailwindcss/vite`) · Zustand · TanStack Query · lucide-react · vitest.
- Aliases: `@` → `src/renderer/src`, `@shared` → `src/shared`.
- **Design tokens** (Tailwind theme in `src/renderer/src/assets/main.css`): legacy `bg, panel, panel2, edge, muted, text, accent, accent2, leaf, olive, gold, up, down, warn` **plus** a semantic layer `surface, elevated, overlay, border-subtle, border-strong, text-secondary, text-tertiary, accent-strong, accent-soft, ring`. Class `.num` = mono tabular numerals. Base 13px, dense.
  - Use `text-gold` for accents, `text-up`/`text-down` for green/red, `text-muted` for secondary. Cards: `rounded-lg border border-edge bg-panel`.
  - `.brandmark` = the green→gold gradient wordmark.
  - **Theme is data**: every token value is resolved by the pure `src/shared/theme/**` resolver and written to the DOM by the single seam `applyTheme()` in `stores/settings.ts`. Don't hardcode hexes in components — use the token utilities (they recolour with the accent/mode). See §18.
- **Strict TS:** every function typed, no unused vars/imports (it fails the build), no `any`. Use `unknown` + narrowing for API JSON.
- **Sentence case** in UI. No emoji in code/UI. Icons from `lucide-react`.
- Money/number formatting helpers live per-module (keep `Math.round`/`toFixed` — no raw float leaks).

---

## 4. Zone split (IMPORTANT — avoid merge conflicts)

This repo is co-built by **Claude Code** and **Kiro**. Historically:

| Owner | Zone |
|---|---|
| **Kiro (you)** | `src/shared/**` (pure domain logic: calc, indicators, markets, analysis, config — Ui-free, unit-tested) **and** `src/renderer/src/modules/{toolkit,tv,social}/**` |
| **Claude** | scaffold, `src/main/**`, `src/preload/**`, shell (`components/shell`, `App.tsx`, `main.tsx`), all stores, and the analysis modules (alpha, conviction, scanner, heatmap, correlation, dashboard, markets, coins, stocks, fundamentals, financials, options, filings, derivatives, flow, orderbook, onchain, news, calendar, alerts, playbook, ai, settings) |

**Rules:**
1. Prefer adding **pure logic to `src/shared`** (your zone) + **unit tests** — that's the cleanest contribution and raises "maturity".
2. If you build a **new renderer module**, follow §7 exactly and only touch: your new `modules/<name>/` folder + the 4 wiring points (listed in §7). Don't refactor existing modules.
3. **Never** change `package.json`, configs, design tokens, the Conviction engine public API, or store shapes without noting it here.
4. Each new public function in `src/shared` needs JSDoc + a vitest test.

---

## 5. Architecture & data flow

```
Electron main  (src/main)      — windows, pop-outs, and IPC services that need
                                 no-CORS / secrets / Node: hermes, ollama, news,
                                 calendar, edgar, options.  Registered in index.ts.
Electron preload (src/preload) — typed contextBridge → window.api.* (the ONLY
                                 bridge renderer↔main). Mirror every IPC here.
Renderer (React)               — shell + modules. Binance WS connects directly
                                 from the renderer. CoinGecko/DeFiLlama/Finnhub/
                                 Etherscan/Tradier-via-main fetched per module.
src/shared                     — pure TS (no DOM), unit-tested. (Kiro zone)
```

- **State:** Zustand stores in `src/renderer/src/stores/`. Persisted ones use `persist` middleware with a `prembroke.*` localStorage key.
- **Server state:** TanStack Query (`useQuery`) for all remote data; `refetchInterval` for live polling.
- **CSP** (`src/renderer/index.html`): allows `'self'`, TradingView, YouTube, X embeds, and `connect-src 'self' ws: wss: https:`. **Plain `http:` is blocked** — anything on `http://localhost` (e.g. Ollama) MUST be proxied through main.

---

## 6. File map (current)

### `src/main/` (Electron main — Claude zone; needs full app restart to reload)
- `index.ts` — window creation, `createPopout(moduleId)` (loads renderer with `?popout=`), `window:popout` IPC, registers all IPC services.
- `hermes.ts` — `ai:status`, `ai:ask` (spawns `hermes.exe -z <prompt> --cli`, no `--yolo`, 90s timeout, ANSI-stripped).
- `ollama.ts` — `ai:ollama:status` (GET 127.0.0.1:11434/api/tags), `ai:ollama:ask` (POST /api/chat). Local free LLM.
- `news.ts` — `news:fetch(cryptoCompareKey?)` — RSS (CoinDesk/CT/Decrypt/CoinJournal/BitcoinMag/FXStreet/Investing) + CryptoCompare, parsed/deduped.
- `calendar.ts` — `calendar:fetch` — faireconomy weekly economic-calendar JSON.
- `edgar.ts` — `edgar:filings(ticker)` + `edgar:financials(ticker)` — SEC EDGAR (ticker→CIK map cached, submissions, XBRL companyfacts). Free, needs `User-Agent`.
- `options.ts` — `options:chain({symbol,token})` — Tradier expirations + nearest chain (CORS-blocked in browser → must be here).
- `exchange.ts` — `exchange:get(url)` — host-allow-listed REST proxy (Binance/Bybit/OKX/Coinbase) so the renderer's multi-venue fallback survives CORS + geo-blocks. No open proxy: only the five exchange hosts are reachable.
- `deribit.ts` — `deribit:chain(currency)` — joins Deribit `get_instruments` + `get_book_summary_by_currency` into a normalized options chain (strike/type/expiry + OI/volume/mark/mark-IV/underlying). Free, no key.

### `src/preload/index.ts` (contextBridge → `window.api`)
Exposes: `platform`, `versions`, `ai{status,ask,ollama{status,ask}}`, `popout{open}`,
`edgar{filings,financials}`, `options{chain}`, `news{fetch}`, `calendar{fetch}`,
`exchange{get}`, `deribit{chain}`.
**Every IPC must be mirrored here AND typed in `src/renderer/src/env.d.ts`.**

### `src/renderer/src/` shell
- `main.tsx` — root render; reads `?popout=<id>` → renders chromeless `Popout`, else `PinGate > App`.
- `App.tsx` — TickerTape + **CommandBar** + Sidebar + tiled **workspace panes** + StatusBar + CommandPalette + Toaster + AlertsEngine. Renders 1/2/4 `Pane`s (each a module with header + pop-out button).
- `components/PinGate.tsx` (PIN 8835), `components/Popout.tsx` (single-module window), `components/AlertsEngine.tsx` (headless 30s alert evaluator), `components/Toaster.tsx`, `components/ExplainButton.tsx` (**reusable "Explain with AI"** — use this anywhere you want AI interpretation).
- `components/shell/`: `TickerTape.tsx`, `CommandBar.tsx` (function codes + autocomplete + layout + workspaces), `CommandPalette.tsx` (Ctrl+K), `Sidebar.tsx` (grouped nav), `StatusBar.tsx`, `LeafLogo.tsx`.

### `src/renderer/src/stores/`
- `view.ts` — `ViewId` union (every module id), `convictionSymbol` (global active symbol), `mentorSeed` (Playbook→Mentor deep-link), `focusConviction`, `askMentor`. Navigation now delegates to `workspace.openInActive`.
- `workspace.ts` — `layout 1/2/4`, `panes[4]`, `active`, `presets[]` (named saved layouts), `openInActive`. **This drives what renders.**
- `keys.ts` — `ApiKeys` (coingecko, cryptocompare, finnhub, twelvedata, etherscan, polygon, unusualwhales, tradier, fmp, benzinga), `KEY_META`, persist+merge from `config/keys.local.ts`.
- `settings.ts` (defaultInterval, reduceMotion, **accent, mode, density, zoom** — see §18; `applyTheme()` is the single theme-application seam for every window), `alerts.ts`, `toasts.ts`, `ailimit.ts` (rolling-hour AI cap), `journal.ts`, `market.ts` (Kiro: crypto/forex mode).
- `config/keys.local.ts` — **git-ignored** real API keys; imported as store defaults.

### `src/renderer/src/modules/` (registered in `modules/index.tsx` → `MODULES[]`)
`alpha` (Alpha Radar / AI CIO front door), `dashboard`, `conviction` (+ `engine.ts`, `SmcChart.tsx`), `scanner`, `heatmap`, `correlation`, `charts`, `markets`, `coins`, `stocks`, `fundamentals`, `financials`, `options`, `filings`, `derivatives`, `flow` (liquidations), `orderbook` (DOM), `onchain`, `news`, `tv` (Kiro), `social` (Kiro), `ai` (AI Mentor), `playbook` (+ `concepts.ts` knowledge base), `alerts`, `toolkit` (Kiro — many tools), `calendar`, `settings`.

### `src/shared/` (Kiro zone — pure, tested)
`calc/` (position-size, pip, risk-reward, margin, compound, kelly, pnl, fibonacci, dca),
`indicators/` (moving-averages, oscillators, volatility, volume, pivots, signals, types),
`markets/` (sessions, currency-strength, **rate-context** — FX carry/rate-differential, **seasonality** — futures term-structure + per-contract seasonal table, symbols, **asset-class** — `SymbolKind`→`AssetClass` model + `symbolsForClass`, **exchanges/** — Binance/Bybit/OKX/Coinbase adapters + cross-venue fallback orchestrator), `analysis/` (brief, backtest, stats, optimize),
`options/` (Black-Scholes greeks + chain analytics: put/call ratio, max pain, ATM-IV term structure, 25Δ skew, dealer gamma exposure — imported via `@shared/options`, kept out of the root barrel),
`canvas/` (widget-canvas domain — pure, UI-free: `types`, `layout` grid math, `dashboards` list ops, `link` parameter-linking, `templates` per-persona apps, `onboarding` first-run; barrel `@shared/canvas`. See §17),
`theme/` (theme domain — pure, UI-free: `palette` colour math + `themes` dark/light/accent/density resolver → `resolveTheme` + `tokensToCssVars`; barrel `@shared/theme`. See §18),
`config/` (feeds, channels, x-accounts). Barrel `index.ts` per folder. Tests in `__tests__/`.

---

## 7. How to add a new module (the pattern — follow exactly)

1. Create `src/renderer/src/modules/<name>/index.tsx` exporting `default function XModule(): React.JSX.Element`.
   - Root: `<div className="flex h-full flex-col">` → header `border-b border-edge px-4 py-3` → body `min-h-0 flex-1 overflow-y-auto`.
   - Use `useQuery` for data; cards use `rounded-lg border border-edge bg-panel`.
2. Wire 4 points:
   - `stores/view.ts` → add the id to the `ViewId` union.
   - `modules/index.tsx` → import it, add a lucide icon to the import, add `{ id, label, icon, component }` to `MODULES`.
   - `components/shell/Sidebar.tsx` → add the id to a `GROUPS` row (Markets / Intel / Tools).
   - `components/shell/CommandBar.tsx` → add a function code to `FUNCS` (and optionally `CODE_SUGGEST`).
3. Cross-module nav: call `useView.focusConviction(sym)` or `useWorkspace.openInActive(id)`.
4. `npm run typecheck && npm test && npm run build` → must be green. Relaunch to view.

**To add an IPC-backed data source (no-CORS / secret):** add `src/main/<svc>.ts` exporting `register<Svc>Ipc()`, register it in `main/index.ts`, mirror in `preload/index.ts`, type in `env.d.ts`. (Remember: main changes need a full restart.)

**To add an API key:** add the field to `ApiKeys` + `KEY_META` (keys.ts), the initial value to `config/keys.local.ts`, and the id to `KEY_IDS`. Settings renders it automatically. Read via `useKeys(s => s.<id>)`.

---

## 8. The Conviction Engine (the crown jewel — `modules/conviction/engine.ts`)

Pure functions over `Candle[]`. **Do not break its public API** (alpha, scanner, heatmap, journal, alerts all call it).

- `computeConviction(symbol, interval, candles, opts?: ConvictionOpts): ConvictionResult`
  - `opts = { now?, mtf?, newsRisk?, smt? }` (all optional — 3-arg calls still valid).
  - Detects: swings → BOS/CHoCH structure, FVG, order blocks, equal highs/lows (EQH/EQL), liquidity sweep, premium/discount, OTE band, displacement, draw-on-liquidity; plus EMA50/200, RSI, ATR, killzones.
  - Factors (each signed pts + hit): structure, premdisc, sweep, fvg, trend, rsi, killzone, orderblock, displacement, ote, mtf, smt, newsrisk → summed onto base 50, clamped 0–100 → grade A+/A/B/C/skip.
  - Result: `{ score, grade, bias, factors[], plan{entry,stop,target,rr,sampleQty}, structure, fvgs, orderBlocks, equalLevels, displacement, drawTarget, mtf, smt, ote, range, candles }`.
- Helpers: `fetchCandles(symbol, interval, limit)` (Binance klines), `biasOf(candles)`, `computeSmt(main, correlate, name)`.
- `SmcChart.tsx` renders candles + all overlays (FVG, OB, EQH/EQL, OTE, draw target, plan lines) on canvas.

When you want a new signal, add a detector + a factor inside `computeConviction` (keep it deterministic & cheap — it runs ~16–40× in Alpha/Scanner/Heatmap).

---

## 9. The AI layer

- Providers: **Ollama** (local, free — `ollama pull llama3.2:3b`) preferred, else **Hermes** (Nous, via `hermes setup`). Detected by `window.api.ai.status()` + `window.api.ai.ollama.status()`.
- **`components/ExplainButton.tsx`** — reuse this for any "explain/interpret" feature: pass `{title, context, question}`; it injects matching Playbook concepts, respects `useAiLimit`, routes to the available provider. This is the "explain, don't just show" primitive.
- **Knowledge base:** `modules/playbook/concepts.ts` (~40 ICT/SMC/SMT concepts) + `findConcepts(query)`. The AI Mentor injects top matches so it answers any ICT question.
- **Rate limit:** `stores/ailimit.ts` (default 40/hr) — call `canAsk()`/`record()` before any AI call.

---

## 10. Gotchas (read before debugging)

- **Main-process edits need a full app restart** (HMR only reloads the renderer).
- **CSP blocks `http:`** — proxy localhost APIs through main.
- **SEC EDGAR** needs a descriptive `User-Agent` (set in `edgar.ts`).
- **Tradier / FRED** block browser CORS → must go through main.
- **electron-builder installer** fails on Windows extracting `winCodeSign` (symlink privilege) unless Developer Mode/admin is on; `dist:dir` (unpacked) works and `out/` always runs via electron directly.
- Tailwind v4: utilities reference CSS vars, so a runtime theme class overriding `--color-gold` recolors `text-gold` everywhere (useful for the pending theme picker).
- `src/renderer/src/config/keys.local.ts` is git-ignored — never commit keys.

---

## 11. Pending tasks (do these next)

### A. Quick wins (deferred, ready to build)
1. **Macro / Economy desk** — `main/macro.ts` FRED IPC (free key, add `fred` to ApiKeys). Series: Fed funds, CPI YoY, unemployment, 10Y, GDP. Module `modules/macro` with latest value + sparkline per series; graceful "add FRED key" state. Command `MACRO`/`ECON`.
2. **UI/UX: accent themes + density** — add `accent` (gold/teal/blue/violet) + `zoom` (0.9/1/1.1) to `settings.ts`; apply via a class on `<html>` overriding `--color-gold`/`--color-accent` and `document.documentElement.style.zoom`. Controls in Settings.
3. **More CSV export buttons** — Markets screener + Correlation matrix (use `@/lib/export`).

### B. The AI-CIO roadmap (the real differentiators — all free unless noted)
4. **Autonomous Research Team** (HIGHEST IMPACT) — new module `modules/research`. For a symbol, run N specialist AI prompts (Quant, Macro, Options, Insider, Valuation, Narrative) each over the data we already have (conviction result, fundamentals, financials, news, filings), then a final "synthesis" prompt merges them into one report with a verdict. Reuse `ExplainButton` plumbing + `ailimit` (these are several AI calls — gate hard). Add a "Deep dive" button on Alpha Radar opportunities → opens this.
5. **Hedge-Fund Reverse-Engineering** — `main/edgar.ts` add `edgar:form4(ticker)` (insider Form 4) and a 13F reader (EDGAR `13F-HR`); module `modules/smartmoney` showing insider buys/sells + top institutional holders. Free.
6. **Market-OS NL screener** — a command/box where the user asks "find companies benefiting from humanoid robots"; send to AI with our symbol universe + sectors → returns a ranked thesis list. Free.
7. **AI Portfolio Manager** — `modules/portfolio`: user states capital + risk + themes; AI proposes an allocation + thesis, persisted to a store, monitored daily vs live prices.
8. **Future-Revenue Predictor** — GitHub API (free, dev activity), app-store/job signals (partial) → a pre-earnings "beat probability" read. Start with GitHub (`api.github.com/repos/{org}/{repo}` commits/stars/releases).
9. **CEO Lie Detector** — compare guidance history vs actual results (SEC financials we already pull) → a "management reliability" score. Transcripts need a source (Quartr is paid).
10. **Market Digital Twin** (hard) — a relationship graph (companies↔suppliers↔patents↔funds) for impact simulation. Needs a relationship dataset; defer or approximate via SEC + news co-mention.

### C. Paid (only when the user provides a key — slots already in `keys.ts`)
Polygon (real-time equities/options), Unusual Whales (sweeps/dark-pool), Benzinga (pro news), Quartr (transcripts). Wire each as a main IPC reading the token from the renderer store (like `options.ts`).

---

## 12. Module registry order (current `MODULES[]`)
alpha · dashboard · conviction · scanner · heatmap · correlation · charts · markets · **fx (FX Desk)** · **indices (Indices)** · **commodities (Commodities)** · **futures (Futures)** · **etfs (ETFs)** · coins · stocks · fundamentals · financials · options · filings · derivatives · cryptooptions · flow · orderbook · onchain · news · tv · social · ai · playbook · alerts · toolkit · calendar · **canvas (Workspace)** · **apps (Apps)** · settings

---

## 13. Command-bar function codes (current)
`ALPHA/CIO/RADAR`, `CONV <SYM>`, `CHART <SYM>`, `SCAN`, `HEAT`, `CORR`, `DOM/DEPTH`, `MKT`, `FX/FOREX` (FX desk — carry + currency strength), `IDX/INDICES/SPX` (indices desk), `COMD/COMM/COMMOD/OIL/GOLD` (commodities desk), `FUT/FUTS/FUTURES/ES/NQ` (futures desk — **note `FUT` now opens the new Futures desk, not Derivatives; use `DERIV` for derivatives**), `ETF/ETFS` (ETFs desk), `COINS`, `EQ/STOCKS`, `FA/FUND`, `FIN/IS/BS`, `OPT/OPTIONS`, `VOL/IV/GEX/COPT` (crypto options · Deribit), `SEC/FILINGS`, `DERIV`, `LIQ/FLOW`, `GAS/CHAIN`, `NEWS`, `CAL/ECO`, `TV`, `X/SOCIAL`, `MENTOR/AI`, `PLAY/ICT`, `ALERT`, `JRNL`, `BT`, `TOOLS`, `SET`, `CANVAS/GRID/WORKSPACE/WS` (widget workspace), `APPS/APP` (curated app gallery). A bare `<SYM>` (e.g. `ETH`) sets the active symbol and opens Conviction. An optional timeframe token (e.g. `ETH 4H`) sets the global timeframe that linked canvas widgets adopt. Append `GO` allowed.

---

_Last updated by Claude (Opus 4.8) — Prembroke pass 16. Keep this file current as you build._

---

## 14. Pass 16 — Phase 1 (crypto/forex depth + resilience)

Direction locked with the user: **AI Chief Investment Officer for crypto + forex**, personal daily-driver, free data only. Compete on *synthesis*, and on crypto real-time depth (where free data is genuinely live). Deprioritized: the equities-heavy items in §11.B.

Shipped (all green: `typecheck` + **121 tests** + `build`; live-verified against the real APIs):

1. **Multi-exchange resilience** (`@shared/markets/exchanges`) — pure adapters for Binance/Bybit/OKX/Coinbase (URL building + response normalization to one canonical `BTCUSDT`-style symbol + OHLCV `Candle`), a fallback orchestrator (`fetchKlines`/`fetchTicker`/`fetchOrderBook` → first healthy venue, tagged with `source`). Transport injected as a `JsonFetcher` → fully unit-tested. The daily-driver fix for Binance geo-blocks.
   - `src/main/exchange.ts` — host-allow-listed REST proxy (solves CORS; not an open proxy).
   - `src/renderer/src/lib/exchange.ts` — `loadKlines/loadTicker/loadOrderBook`: direct browser fetch → main-proxy fallback. **Adoption seam: migrate existing Binance-only modules (conviction `fetchCandles`, derivatives, orderbook, markets) onto these incrementally — do NOT rewrite them all at once.**
2. **Crypto Options desk** (`cryptooptions` module · `VOL`/`IV`/`GEX`) — Deribit (free, no key), the institutional options data Bloomberg charges for. `@shared/options` = Black-Scholes greeks + analytics (put/call ratio, max pain, ATM-IV term structure, 25Δ skew, dealer GEX + zero-gamma flip). UI: BTC/ETH toggle, expiry rail, IV term structure, OI-by-strike, gamma-by-strike.

### Next (Phase 1 remainder → Phase 2)
- Feed Deribit **25Δ skew / IV regime** into `conviction/engine.ts` as a new factor.
- Alpha Radar as the true daily front door; position-/journal-aware AI memory.
- Optional: lazy-load modules + Vite `manualChunks` (deferred — single 1.3MB chunk parses instantly from local disk; lazy adds Suspense flashes for ~no desktop gain).

---

## 15. Pass 17 — AI everywhere + crypto-native data + theming (Opus 4.8)

Direction from the user: "make it the most powerful terminal — maxout, best UI/UX, powerful data, all free." Shipped (all green: `typecheck` + **121 tests** + `build`; every new external API live-verified):

### A. Unified AI engine (the keystone — local-only → works out of the box)
The whole "AI CIO" thesis was gated behind a local install. Now any **one free key** lights up every AI feature.
- `src/main/cloudai.ts` — IPC `ai:cloud:ask` for four free-tier cloud providers: **Groq** (`llama-3.3-70b-versatile`), **Cerebras** (`llama-3.3-70b`), **Google Gemini** (`gemini-2.0-flash`), **OpenRouter** (`…:free`). OpenAI-compatible except Gemini (bespoke). Routed through main (no CORS, keys off page context, 4 shapes → one `{ok,text}`).
- `src/renderer/src/lib/ai.ts` — **the single router** every feature now calls: `askAI({system,prompt}, {primary?})` tries providers in a preferred order (`groq→cerebras→gemini→openrouter→ollama→hermes`, or a user-chosen primary first) and returns the first usable answer. Also `listProviders()`, `providerLabel()`, 15s local-status cache. **Use this for any new AI feature — do not call `window.api.ai.*` directly.**
- `src/renderer/src/stores/ai.ts` — `useAiConfig` (persisted `prembroke.ai`): `primary` engine + per-provider model overrides.
- Keys: added `groq`/`gemini`/`cerebras`/`openrouter` to `ApiKeys` + `KEY_IDS` + `keys.local.ts` (kept OUT of `KEY_META`; they render in a dedicated card).
- Rewired consumers: `ExplainButton.tsx`, `modules/ai` (Mentor — cloud engines now appear in its picker), `modules/conviction` (devil's advocate). Settings has a new **AI engine** card (primary selector + per-provider key inputs + local Ollama/Hermes status).

### B. Autonomous Research Team (`modules/research` · `RT`/`DD`/`TEAM`)
The synthesis moat. For a symbol it gathers real data — Conviction engine (structure/score/plan/factors, MTF, SMT), Binance funding/OI/long-short, Fear & Greed, calendar catalysts, news — then runs **4 specialist AI agents** (Technical, Derivatives & Flow, Macro & Catalysts, Risk Manager) and a **CIO synthesis** that returns a structured `VERDICT / CONVICTION / PLAN / RISKS / EDGE`. Hard-gated by `useAiLimit` (≤5 calls/run, degrades gracefully when the cap hits).

### C. DEX Screener desk (`modules/dex` · `DEX`/`PAIRS`/`TRENDING`)
The crypto-native data Bloomberg has nothing comparable to. `src/main/dex.ts` (free, no key) wraps DexScreener: `dex:trending` (token-boosts → batched tokens join, server-side), `dex:new` (latest token-profiles → tokens), `dex:search` (full pair data for any name/symbol/contract). Renderer table: token icon, chain badge, price (sub-penny aware), 1h/24h, volume, liquidity, FDV, boost/age/txns, open-on-DexScreener. New pair shape `DexPair` mirrored in preload + `env.d.ts`.

### D. DeFi desk (`modules/defi` · `DEFI`/`YIELDS`/`TVL`/`HACKS`)
DeFiLlama (free, CORS-open, direct renderer `useQuery`): **Yields** (top APY across 16k pools, stablecoin + min-TVL filters, IL-risk flag), **Chains** (TVL ranking, top 50), **Exploits** (recent hacks with $ lost, technique, bridge flag).

### E. Theme engine (best-UI/UX quick win)
`stores/settings.ts` gained `accent` (6 presets: gold/emerald/teal/azure/violet/rose) + `zoom` (90/100/110/120%), applied app-wide (incl. pop-outs) via a module-level subscriber that sets `--color-accent`/`--color-gold` and root `zoom`. Controls live in Settings → Preferences. Up/down stay green/red.

### Registry / wiring updates
- `MODULES[]` now includes `research`, `dex`, `defi` (3 new). `ViewId` union + Sidebar (Intel: research; Markets: dex, defi) + CommandBar `FUNCS`/`CODE_SUGGEST`/`HELP_ROWS` updated.
- New main IPC: `cloudai.ts` (`ai:cloud:ask`), `dex.ts` (`dex:search|trending|new`) — both registered in `main/index.ts`, mirrored in `preload/index.ts` + `env.d.ts`.

_Last updated by Claude (Opus 4.8) — Prembroke pass 17. Keep this file current as you build._

---

## 16. Pass 18 — Research front door + streaming AI (Opus 4.8)

Both shipped green (`typecheck` + **121 tests** + `build`; app boots clean).

### A. Alpha Radar → Research Team deep-dive (the front door)
- `stores/view.ts` — added `researchSeed` + `runResearch(symbol)` (sets seed + `convictionSymbol`, opens `research`) + `clearResearchSeed`, mirroring the `mentorSeed` pattern. Not persisted.
- `modules/research` — consumes `researchSeed` via an effect: sets the symbol, clears the seed, and **auto-runs** the full multi-agent deep dive. `run()` now takes an optional `symbolArg` override (so the deep-link runs the seeded symbol immediately, not stale state).
- `modules/alpha` — each opportunity row is now a `div role="button"` (click → Conviction) with a hover **"Deep dive"** button (→ `runResearch(symbol)` → CIO research). Replaced the trailing arrow.

### B. Streaming AI (token-by-token)
The reusable primitive, not just the Mentor.
- `src/main/cloudai.ts` — new `ai:stream` IPC. Streams **OpenAI-compatible** (Groq/Cerebras/OpenRouter, SSE `data:` deltas), **Gemini** (`:streamGenerateContent?alt=sse`), and **Ollama** (`/api/chat` NDJSON). Shared `readLines()` web-stream line reader. Pushes `{ id, delta }` over the `ai:stream:chunk` channel to the calling renderer and resolves with the full text.
- `preload/index.ts` — `window.api.ai.stream(arg, onDelta)`: registers a per-request `ai:stream:chunk` listener keyed by a generated id, invokes `ai:stream`, and removes the listener on settle. Typed in `env.d.ts`.
- `src/renderer/src/lib/ai.ts` — `askAIStream(req, onDelta, opts?)`: same fallback chain as `askAI`; cloud + Ollama stream natively, **Hermes** falls back to one final chunk. **Use this for any live-typing AI UI.**
- `modules/ai` (Mentor) — now renders the reply token-by-token (placeholder appears on first delta; "thinking…" bubble hides once streaming starts). `askAI` is still the right call for batch/multi-agent flows (Research, Explain).

_Last updated by Claude (Opus 4.8) — Prembroke pass 18. Keep this file current as you build._

---

## 17. Pass 19 — Phase A: the widget canvas (everything-app workspace)

Shipped green at every step (`typecheck` + **203 tests** + `build`). **No new dependency** — the drag/resize grid is a custom CSS-grid + Pointer Events surface (zero libraries). The legacy 1/2/4 tiled `Pane` path in `App.tsx` is preserved byte-for-byte and selected whenever `canvasEnabled === false` (the default).

### New shared module: `src/shared/canvas/**` (pure, UI-free, unit-tested)
All canvas logic lives here with JSDoc + relative-path vitest in `src/shared/__tests__/`. `WidgetInstance.moduleId` is a plain `string` (`ViewModuleId`); the renderer narrows it to `ViewId` only at the `stores/workspace.ts` boundary, so shared never imports the renderer.
- `types.ts` — `WidgetInstance` (`id, moduleId, x, y, w, h, linked`, optional `symbol`/`timeframe` override), `CanvasLayout`, `GridRect`.
- `layout.ts` — pure grid math: `rectsOverlap`, `clampRect`, `findFreeSlot`, `moveWidget`, `resizeWidget` (honors `minW/minH`), `compactVertical`, `addWidget`/`removeWidget`, `setLinked`, `setWidgetModule`, `snapToGrid`, `pxToGrid`/`gridToPx`, `defaultCanvas`.
- `dashboards.ts` — list ops: `upsertDashboard`, `removeDashboard`, `renameDashboard`, `cloneDashboard` (deep-copy, fresh ids, non-colliding name).
- `link.ts` — parameter-linking: `resolveLinkedParams`, `isLinkable` (allow-set: conviction/charts/orderbook/derivatives/cryptooptions/options/flow), `normalizeSymbol` (mirrors `CommandBar.resolveSymbol`), `normalizeTimeframe` (`4H`→`4h`, invalid→`1h`), `isTimeframe`.
- `templates.ts` — `APP_TEMPLATES` (6 per-persona apps), `getTemplate`, `templateToDashboard` (fresh ids), `validateTemplate(t, validIds)` (UI-free — caller passes the valid module-id list).
- `onboarding.ts` — `defaultWorkspace()` (curated first-run = Crypto day-trade), `shouldSeedDefault(dashboards)`.
- Barrel `index.ts` re-exports all of the above; wired into the root `@shared` barrel.

### Renderer (wiring only): `src/renderer/src/components/canvas/**`
- `WidgetCanvas.tsx` — CSS-grid surface; renders each widget by `x/y/w/h`, shows a dashed drop-preview ghost during a gesture, commits final rects once via the store.
- `WidgetFrame.tsx` — cell chrome (module `<select>` swap, link badge, add/pop-out/close). Header is the move handle; S/E/SE grab zones resize. Resolves render params via `resolveLinkedParams` and shows the active symbol·timeframe for linkable widgets.
- `useGridDrag.ts` — Pointer-Events hook (`React.PointerEvent`, `setPointerCapture`, no `any`). Transient gesture kept in component state (no persist thrash); all math delegated to `layout.ts`.
- `LinkBadge.tsx` — `Link`/`Link2Off` toggle → `setCanvasWidgetLinked`.
- `AppsGallery.tsx` — template cards (persona, widget count, starter-prompt chips → `askMentor`, Load → `loadTemplate` + focus symbol + enable canvas).

### Stores
- `stores/workspace.ts` — `canvasEnabled` (flag, default **false**), `canvas` (active dashboard mirror), `dashboards: CanvasLayout[]`, `activeDashboardId`. Actions `setCanvas/addCanvasWidget/removeCanvasWidget/setCanvasWidgetModule/setCanvasWidgetLinked` (each upserts the active canvas back into `dashboards`), `saveDashboard/loadDashboard/deleteDashboard/newDashboard/loadTemplate`. `onRehydrateStorage` seeds `defaultWorkspace()` when no dashboards exist and reconciles legacy (Steps 1–3) profiles that persisted only `canvas`. All math delegates to the shared pure functions.
- `stores/view.ts` — added global `activeTimeframe` (seeded from `useSettings.defaultInterval`, persisted) + `setActiveTimeframe`. `convictionSymbol` stays the global symbol (no rename). `ViewId` union gained `'canvas'` + `'apps'`.

### The 4 §7 wiring points (Step 8)
1. `stores/view.ts` `ViewId` union → `+canvas, +apps`.
2. `modules/index.tsx` → `{ id:'canvas', label:'Workspace', icon: LayoutGrid, component: WidgetCanvas }` and `{ id:'apps', label:'Apps', icon: AppWindow, component: AppsGallery }`.
3. `components/shell/Sidebar.tsx` → new **Workspace** group (`canvas`, `apps`).
4. `components/shell/CommandBar.tsx` → `CANVAS/GRID/WORKSPACE/WS` + `APPS/APP` in `FUNCS`, `CODE_SUGGEST`, `HELP_ROWS`; optional timeframe token (`ETH 4H`) → `setActiveTimeframe`. `CommandPalette.tsx` auto-lists both (maps `MODULES`).

`App.tsx`: when `canvasEnabled`, the active view selects the surface (`apps` → gallery, else the grid). `modules/settings` gained a **Widget canvas** toggle mirroring **Reduce motion**.

### Default decision
`canvasEnabled` default is kept **false** — the legacy tiled workspace stays the first-run experience and is provably untouched; users opt in via Settings → Widget canvas or by loading an app from the gallery (which flips it on). The curated `defaultWorkspace()` is still seeded into `dashboards`, so flipping the flag on lands on a populated Crypto day-trade dashboard.

### Tests added (shared, node-env, +44 over the prior 159 → **203**)
`canvas-layout` (extended: resize floor at 2×2, drag-math composition via `snapToGrid`/`moveWidget`/`pxToGrid`), `canvas-dashboards`, `canvas-link`, `canvas-templates` (every template: unique id, non-empty, in-bounds, real module ids via `validateTemplate`, `linked` only where `isLinkable`), `canvas-onboarding`.

_Last updated by Claude (Opus 4.8) — Prembroke pass 19. Keep this file current as you build._

---

## 18. Pass 20 — Next-level UI/UX + design-system (theme engine 2.0, Opus 4.8)

Shipped green at every step (`typecheck` + **245 tests** + `build`). **No new dependency** — the colour math is ~50 lines of pure TS. Dark mode is provably unchanged (the legacy token hexes are extracted verbatim into the resolver and locked by a regression test); `mode` defaults to `'dark'` and `density` to `'cozy'`, so existing users see zero change on upgrade.

### New shared module: `src/shared/theme/**` (pure, UI-free, unit-tested)
The whole theme is now **data**, resolved purely and consumed by one renderer seam. JSDoc + relative-path vitest in `src/shared/theme/__tests__/`.
- `palette.ts` — colour math: `hexToRgb`, `rgbToHex`, `withAlpha`, `lighten`, `darken`, `mix`, `relativeLuminance`, `contrastRatio` (WCAG). Invalid input returns sentinels (`null`/`NaN`/`'transparent'`), mirroring the `calc/*` convention.
- `themes.ts` — `ThemeMode`/`AccentId`/`DensityId` types; `ThemeTokens` (the 14 legacy names **plus** the semantic layer `surface/elevated/overlay/borderSubtle/borderStrong/textPrimary/textSecondary/textTertiary/accentStrong/accentSoft/ring`); `ACCENTS` (6 base hexes) + `DENSITIES` (compact/cozy/comfortable metrics); `deriveAccentRamp(accentHex, mode)` (coherent `accent/strong/soft/ring/gold` per accent, mode-aware + contrast-safe); `resolveDensity`; `resolveTheme(mode, accent, density) → ResolvedTheme`; `tokensToCssVars(tokens) → Record<'--color-*', string>` (the single writer contract).
- Barrel `index.ts` re-exports both; wired into the root `@shared` barrel.
- **Locked design rules** (asserted by tests): dark legacy tokens == the exact `main.css` hexes; light is a hand-tuned warm-neutral palette (bg `#f7f8f6`, panel `#fff`, text `#0e1a12`, …) — **not** an inversion; body text clears WCAG **AAA (≥7)** on bg and AA (≥4.5) for secondary/tertiary on panel, in both modes; every accent reads ≥3 on surfaces; **`up`/`down` are always `#16c784`/`#ea3943`** across all 6 accents × 2 modes; `text-gold` (`--color-gold`) tracks the active accent's bright highlight; resolver is pure (deep-equal across calls).

### Settings (`stores/settings.ts`) + the single apply seam
- New persisted fields: **`mode`** (`'dark'|'light'|'system'`, default `'dark'`) + **`density`** (`'compact'|'cozy'|'comfortable'`, default `'cozy'`) + `setMode`/`setDensity`. `persist` merges the new keys, so old profiles upgrade silently.
- `applyTheme()` rewritten: maps `'system'` → the OS scheme (`matchMedia('(prefers-color-scheme: dark)')`, repaints live on change), calls `resolveTheme()`, writes `tokensToCssVars(...)` + density CSS vars (`--space-card/--space-gap/--control-h/--font-base/--row-h`) + a `theme-light` class + `data-mode`/`data-density` attrs + the **`reduce-motion`** root class. Still the only place that writes theme to the DOM, still runs at module-load + `useSettings.subscribe`, so **main window + pop-outs** are covered with no per-window code. `AccentId` now originates in `@shared/theme`; `settings.ts` re-exports it and a thin `ACCENTS` view (`{label, accent}`) so existing import sites are untouched.
- Settings UI: new **Appearance** (Dark/Light/System, lucide `Moon`/`Sun`/`Monitor`) + **Density** (compact/cozy/comfortable) controls; the old zoom buttons are relabelled **Zoom** (density and zoom are now distinct); a **live preview** card reads the live CSS vars so it re-themes instantly.

### CSS / motion (`assets/main.css`)
- The semantic tokens are declared in `@theme` with **dark defaults** (so the Tailwind utilities exist) and overridden at runtime by `applyTheme`. New utilities: `bg-surface/bg-elevated/bg-overlay`, `border-border-subtle/border-border-strong`, `text-text-secondary/text-text-tertiary`, `bg-accent-soft/text-accent/bg-accent-strong`, `ring-ring`.
- **Motion system**: `--motion-fast 150ms` + `--motion-ease`, opt-in helpers `.t-colors`/`.t-elevate`, and a `.focus-ring`/`:focus-visible` accent ring. **`reduceMotion` is now real**: the `.reduce-motion` root class (plus `@media (prefers-reduced-motion: reduce)`) hard-freezes every transition/animation (module-enter, `animate-pulse`, hover lifts) via `!important`.
- Scrollbar + `.grid-backdrop` corner-glow now derive from tokens (`--color-border-strong`/`--color-accent`/`--color-leaf` via `color-mix`), so they follow the accent/mode (identical to before in the default dark+gold theme).

### Shell + canvas adoption (token-driven, no module rewrites)
- Shell: `Sidebar` active rail → `bg-accent` + `bg-accent-soft` hover, headings `text-text-tertiary`; `StatusBar`/`TickerTape` dividers → `border-border-subtle`; `CommandBar` input gains a focus ring + popovers move to `bg-overlay`; `LeafLogo` accepts optional `blade`/`stroke`/`vein` props (defaults reproduce the brand exactly).
- Canvas (Phase A): `WidgetFrame` header → `bg-elevated`/`border-border-subtle` + a discoverable `GripVertical` drag handle + visible-on-hover resize grips + a live-gesture `ring-ring` highlight; `WidgetCanvas` drop-ghost → `border-accent`/`bg-accent-soft` (re-tints with the accent) + a premium empty state, and **density visually drives the grid row height/gap** (the persisted `CanvasLayout.rowH` is unchanged — `useGridDrag` takes an optional `GridMetrics` so pointer math stays calibrated); `AppsGallery` cards get a persona accent strip + icon chip, an `bg-accent-soft text-accent` widget-count chip, a `.t-elevate` hover lift, and a `bg-accent text-bg`/`hover:bg-accent-strong` Load button; `LinkBadge` → `text-accent`/`text-text-tertiary`. All motion auto-disables under reduce-motion. The legacy tiled `Pane` path (`canvasEnabled===false`) is visually unchanged apart from the global token polish.

### Tests added (shared, node-env, +42 over the prior 203 → **245**)
`theme/__tests__/palette.test.ts` (parse/format/alpha/lighten/darken/mix/luminance/contrast incl. sentinels) and `theme/__tests__/themes.test.ts` (var completeness, dark-parity regression lock, distinct modes, coherent per-accent ramp, up/down invariant across 6×2, WCAG contrast thresholds, density ordering, purity/deep-equal).

_Last updated by Claude (Opus 4.8) — Prembroke pass 20. Keep this file current as you build._

---

## 19. Pass 21 — Phase B Steps 1–6: all-asset expansion (5 new desks, Opus 4.8)

Shipped green at every step (`typecheck` + **281 tests** + `build`). **No new dependency** — Frankfurter (keyless), Twelve Data (own-key) and Finnhub (own-key) are all CORS-open https reached via direct renderer `fetch` (mirrors the existing `markets` `LiveFx` / `stocks` patterns; no new IPC). The crypto/forex market gate (`stores/market.ts`) is **untouched** — every asset class ships as a new **additive desk** per §7. Persisted state only gains `ViewId` values (no store-shape break).

### Honest free-data sourcing (real-time is the premium upgrade)
- **FX** = Frankfurter (currency strength, keyless) + Twelve Data (delayed quotes, own-key). Carry/rate-differential from a seeded static policy-rate map.
- **Indices / Commodities / Futures** quotes = Twelve Data **own-key, delayed**, with a graceful "add Twelve Data key" empty state; charts = the TradingView symbol on `SymbolInfo.tradingview`.
- **ETFs** = the existing Finnhub `/quote` equities path (own-key) + sector tags now; holdings deferred behind an "add FMP key" hint.
- Every desk that needs a key renders a clean lucide-icon "add &lt;provider&gt; key" state (never a crash/blank).

### Shared (Kiro zone — pure, UI-free, unit-tested) — `src/shared/markets/**`
- `symbols.ts` — `SymbolKind` gained `'etf' | 'future' | 'commodity'`; `SymbolInfo` gained optional `finnhub` / `twelvedata` / `underlying` / `expiryStyle` / `sector` (all additive — existing literals untouched). New registries: **`ETF_SYMBOLS`** (12: broad/sector/thematic, `finnhub`+`sector`), **`COMMODITY_SYMBOLS`** (7: energy/metals/ags, `twelvedata`), **`FUTURE_SYMBOLS`** (6: ES/NQ/YM/CL/GC/SI continuous front-month, `underlying`+`expiryStyle:'continuous'`). `INDEX_SYMBOLS` extended with DE40/UK100/JP225 and every index now carries a `twelvedata` symbol. All folded into `ALL_SYMBOLS`/`BY_ID`.
- `asset-class.ts` (NEW) — `AssetClass` model + `ASSET_CLASSES`, `kindToAssetClass` (metal→commodity, etc.), `assetClassOf(id)`, `symbolsForClass(cls)`.
- `rate-context.ts` (NEW) — pure FX carry: `rateDifferential(pair, rates)` + `rankByCarry(pairs, rates)` → `{ diffPct, carryBias }`.
- `seasonality.ts` (NEW) — pure futures context: `classifyTermStructure(points)` → contango/backwardation/flat + slope; `seasonalBias(symbolId, month)` over a deterministic static `SEASONAL_TABLE` (CL/GC/SI/ES/NQ/YM).
- Barrel `markets/index.ts` re-exports `asset-class`, `rate-context`, `seasonality`.

### Renderer (wiring only) — five new `src/renderer/src/modules/<name>/index.tsx`
- **`fx`** (FX Desk) — pair carry table (`rankByCarry` over `FOREX_SYMBOLS` + seed rates) + Twelve Data delayed quotes + Frankfurter currency-strength aside.
- **`indices`** — `INDEX_SYMBOLS` rail with Twelve Data delayed quotes + a TradingView advanced-chart for the selected index.
- **`commodities`** — `symbolsForClass('commodity')` grouped Energy/Metals/Agriculture + Twelve Data quotes + TradingView chart.
- **`futures`** — `FUTURE_SYMBOLS` continuous front-month (each linked to its `underlying`), keyless **seasonality** card (current-month `seasonalBias`) + a term-structure "add key" hint, Twelve Data quotes via the underlying, TradingView continuous chart.
- **`etfs`** — `ETF_SYMBOLS` sector-grouped tiles via the Finnhub `/quote` path + a deferred-holdings (FMP) hint.

### The 4 §7 wiring points (×5 desks)
1. `stores/view.ts` `ViewId` union → `+fx, +indices, +commodities, +futures, +etfs`.
2. `modules/index.tsx` → imports + `MODULES[]` entries (icons: `Banknote`, `Activity`, `Fuel`, `CandlestickChart`, `Layers`).
3. `components/shell/Sidebar.tsx` → all five added to the **Markets** `GROUPS` row (after `markets`).
4. `components/shell/CommandBar.tsx` → `FUNCS` (`FX/FOREX`, `IDX/INDICES/SPX`, `COMD/COMM/COMMOD/OIL/GOLD`, `FUT/FUTS/FUTURES/ES/NQ`, `ETF/ETFS`) + `CODE_SUGGEST` (`FX/IDX/COMD/FUT/ETF`) + `HELP_ROWS`. **`FUT` was repointed from `derivatives`→`futures`** (derivatives stays on `DERIV`). `CommandPalette` auto-lists the new desks from `MODULES`.

### Tests added (shared, node-env, +36 over the prior 245 → **281**)
`asset-class.test.ts` (new registries non-empty + unique ids + every symbol has a `tradingview`; ETF finnhub+sector; commodity twelvedata; future continuous + resolvable `underlying`; extended index registry; `searchSymbols` reaches new entries; `kindToAssetClass`/`assetClassOf`/`symbolsForClass` correctness; `ASSET_CLASSES` covers every kind), `rate-context.test.ts` (diff sign→carry bias, slashed/lowercase parsing, null on malformed/missing legs, `rankByCarry` ordering + drops), `seasonality.test.ts` (contango/backwardation/flat + slope sanity + &lt;2-point handling + purity; `seasonalBias` table hit / flat placeholder / null on unknown symbol or out-of-range month + table validity). The `markets.test.ts` crypto-50/forex-28 regression locks remain green (registries unchanged).

### Out of scope this run (separate later runs)
Steps 7–9 (Conviction per-asset-class generalization, all-asset screener surfacing, non-crypto candle seam) + the FRED/Macro desk are intentionally **not** started here.

_Last updated by Claude (Opus 4.8) — Prembroke pass 21. Keep this file current as you build._
