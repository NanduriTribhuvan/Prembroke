# Prembroke

**The AI-Powered Conviction Terminal for Crypto, Forex & Equities Traders**

> One terminal for every market. Don't compete on data — compete on synthesis.

Prembroke is a desktop trading workstation that collapses 15-tab sprawl into a single, dense, keyboard-driven terminal. It answers the one question no tool answers today: **"Should I take this trade — and how confident should I be?"**

---

## What It Does

- **Conviction Engine** — scores every setup 0–100 with explainable ICT/Smart-Money-Concepts confluence (structure, FVGs, order blocks, liquidity sweeps, killzones, displacement) and generates a ready trade plan (entry/stop/targets/R:R)
- **AI Brain** — unified multi-provider router (Groq, Gemini, Cerebras, OpenRouter, Ollama, Hermes) powering an AI Mentor, Research Team (multi-agent synthesis), and "Explain with AI" on every widget
- **All-Asset Coverage** — crypto (spot, derivatives, options, DEX, DeFi, on-chain), forex, indices, commodities, futures, ETFs, equities
- **Live Data** — real-time via Binance/Bybit/OKX/Coinbase WebSocket with multi-venue failover; free API integrations (CoinGecko, Finnhub, FRED, SEC EDGAR, DeFiLlama, Deribit, DexScreener)
- **Widget Canvas** — draggable, resizable widget grid with parameter-linking, saved workspaces, and one-click App templates per trading persona
- **Native Charting** (in progress) — first-party canvas engine with pan/zoom/crosshair, built-in indicators, AI-generated custom indicators, and expanded SMC/ICT overlays

---

## Screenshots

*Coming soon — the UI follows an "institutional weapon" design language: dense, cold monochrome + signal color, hairline grid, mono tabular numerals. Bloomberg's density with Linear's craft.*

---

## Quick Start

```bash
# Install dependencies
npm install

# Run in development (opens the Electron app with HMR)
npm run dev

# Typecheck
npm run typecheck

# Run tests
npm test

# Build for production
npm run build

# Package Windows installer
npm run dist
```

**App PIN:** `8835` (per-session, resets each launch)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Electron 42 + electron-vite 5 |
| Frontend | React 19 + TypeScript 6 (strict) |
| Styling | Tailwind CSS v4 |
| State | Zustand + TanStack Query |
| Icons | lucide-react |
| Build | Vite 7 |
| Tests | Vitest + fast-check (property-based) |

---

## Architecture

```
src/
├── main/           # Electron main process (IPC services, proxies, AI cloud)
├── preload/        # contextBridge (typed window.api.*)
├── renderer/       # React app (modules, stores, components, shell)
│   └── src/
│       ├── modules/      # ~40 feature modules (conviction, charts, markets, ai, etc.)
│       ├── stores/       # Zustand stores (persisted)
│       ├── components/   # Shell (sidebar, command bar, ticker) + reusable UI
│       └── lib/          # Utilities (AI router, exchange transport)
└── shared/         # Pure, UI-free domain logic (Kiro zone, unit-tested)
    ├── calc/       # Position size, pip, risk-reward, margin, compound, kelly
    ├── indicators/ # Moving averages, oscillators, volatility, volume, pivots
    ├── markets/    # Sessions, currency strength, multi-exchange adapters
    ├── chart/      # Chart math core (scales, projection, hit-testing, layout)
    ├── sandbox/    # Safe indicator evaluator (whitelisted AST interpreter)
    ├── smc/        # Smart Money Concepts detectors (breaker/mitigation blocks)
    ├── options/    # Black-Scholes greeks + chain analytics
    └── canvas/     # Widget canvas domain (layout, linking, templates)
```

---

## Modules (40+)

| Category | Modules |
|---|---|
| **Command & Overview** | Alpha Radar, Dashboard, Heatmap, Correlation, Scanner |
| **Charts & Conviction** | Charts, Conviction Engine, Backtest, Journal, Playbook |
| **Markets** | Markets, FX Desk, Indices, Commodities, Futures, ETFs, Coins, Stocks |
| **Fundamentals** | Fundamentals, Financials, SEC Filings |
| **Derivatives & Flow** | Derivatives, Crypto Options (Deribit), Options, Liquidations, Order Book |
| **On-chain & DeFi** | On-chain, DEX Screener, DeFi Desk |
| **Intel** | News, Calendar, Live TV, X Pulse |
| **AI** | AI Mentor, Research Team |
| **Discipline** | Alerts, Toolkit (16 calculators) |
| **Platform** | Widget Canvas, Apps Gallery, Settings |

---

## The Conviction Engine

For any symbol, the engine auto-runs a confluence checklist and outputs:

```
BTC/USDT — LONG setup                    CONVICTION 82 / 100   GRADE: A
─────────────────────────────────────────────────────────────────────────
✓ HTF bias bullish — 4H BOS confirmed                              +20
✓ Price in discount — below 50% equilibrium                        +15
✓ Sell-side liquidity swept — stop-hunt below                      +15
✓ Bullish FVG + Order Block confluence                             +15
✓ NY killzone active                                               +10
✓ RSI bullish divergence                                           +10
✓ Funding negative — shorts pay longs                               +7
✗ News risk — FOMC in 2h                                           -10
─────────────────────────────────────────────────────────────────────────
PLAN  entry 64,200 · stop 63,400 · TP 66,800 · R:R 3.2
```

---

## AI Integration

One unified router — paste any free key and every AI feature lights up:

| Provider | Model | Use |
|---|---|---|
| Groq | llama-3.3-70b | Main analyst chat, explain |
| Gemini | gemini-2.0-flash | Bulk sentiment, scoring |
| Cerebras | llama-3.3-70b | Fast alternative |
| OpenRouter | various:free | Fallback |
| Ollama | llama3.2 (local) | Offline / private |
| Hermes | nous-hermes | Local alternative |

Fallback chain: Groq → Cerebras → Gemini → OpenRouter → Ollama → Hermes

---

## API Keys (all free tier)

Configure in the app at **Settings → API Keys**, or edit `src/renderer/src/config/keys.local.ts` (git-ignored):

- CoinGecko, CryptoCompare, Finnhub, Twelve Data, Etherscan, Polygon, Tradier, FMP, Benzinga, FRED
- AI: Groq, Gemini, Cerebras, OpenRouter

---

## Development

```bash
# Full quality gate (must pass before any commit)
npm run typecheck && npm test && npm run build

# Run a specific test file
npx vitest run src/shared/__tests__/chart-scale.test.ts

# Build without packaging (run with Electron directly)
npm run build
node_modules\electron\dist\electron.exe .
```

**Conventions:**
- Strict TypeScript — no `any`, all exports typed
- Pure domain logic in `src/shared/` with vitest tests
- Bloomberg-style command bar function codes (e.g. `CONV BTC`, `CHART ETH 4H`, `SCAN`)
- Sentence case UI, lucide icons, monospace tabular numerals for data

---

## Command Bar (Bloomberg-style)

Type function codes to navigate instantly:

| Code | Opens |
|---|---|
| `ALPHA` | Alpha Radar (AI CIO) |
| `CONV <SYM>` | Conviction Engine |
| `CHART <SYM>` | Charts |
| `SCAN` | Scanner |
| `DEX` | DEX Screener |
| `MENTOR` | AI Mentor |
| `TOOLS` | Toolkit |
| `FX` | FX Desk |
| `VOL` | Crypto Options (Deribit) |

Or just type a symbol (e.g. `ETH`) to open its Conviction read.

---

## License

Private. All rights reserved.

---

## Author

Built by [NanduriTribhuvan](https://github.com/NanduriTribhuvan)
