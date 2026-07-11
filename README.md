<p align="center">
  <img src="assets/banner.png" alt="Prembroke — Conviction Terminal" width="100%" />
</p>

<h1 align="center">Prembroke</h1>

<p align="center">
  <strong>The AI-Powered Conviction Terminal for Crypto, Forex & Equities Traders</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0-f5a524?style=flat-square" />
  <img src="https://img.shields.io/badge/electron-42-47848f?style=flat-square&logo=electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/typescript-6-3178c6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/tests-420%20passing-16c784?style=flat-square" />
  <img src="https://img.shields.io/badge/license-private-ea3943?style=flat-square" />
</p>

<p align="center">
  One terminal for every market. Don't compete on data — compete on <em>synthesis</em>.
</p>

---

## The Problem

Traders live in a **15-tab sprawl** — TradingView, Finviz, Coinglass, CoinGecko, DeFiLlama, X, an economic calendar, a journal, and a broker. Context is lost in the switching. Everyone shows numbers; nobody says what they *mean* for *this* trade right now.

## The Solution

Prembroke collapses it all into one dense, keyboard-driven desktop terminal that answers: **"Should I take this trade — and how confident should I be?"**

Every feature feeds one number: a **Conviction Score (0–100)** with a grade and a ready trade plan, explained factor by factor.

---

## Core Features

### Conviction Engine
Scores every setup with explainable ICT/Smart-Money-Concepts confluence:
- Market structure (BOS/CHoCH), FVGs, order blocks, liquidity sweeps
- Killzones, displacement, premium/discount, breaker blocks
- Auto-generates entry/stop/targets/R:R trade plans

```
BTC/USDT — LONG                           CONVICTION 82 / 100   GRADE: A
─────────────────────────────────────────────────────────────────────────
✓ HTF bias bullish — 4H BOS confirmed                              +20
✓ Price in discount — below 50% equilibrium                        +15
✓ Sell-side liquidity swept                                        +15
✓ Bullish FVG + Order Block confluence                             +15
✓ NY killzone active                                               +10
✗ News risk — FOMC in 2h                                           -10
─────────────────────────────────────────────────────────────────────────
PLAN  entry 64,200 · stop 63,400 · TP 66,800 · R:R 3.2
```

### Native Charting Engine
First-party canvas chart — no TradingView dependency:
- Live tick-by-tick candle updates via Binance WebSocket
- Pan, zoom, crosshair with value-tick flash
- Built-in indicators (SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP, OBV)
- AI Indicator Builder — describe an indicator in chat and it builds it
- SMC/ICT overlay toggles (structure, liquidity, OBs, FVGs, killzones)

### AI Brain
Unified multi-provider router — paste one free key and everything lights up:

| Provider | Model | Fallback Order |
|---|---|---|
| Groq | llama-3.3-70b | 1st |
| Cerebras | llama-3.3-70b | 2nd |
| Gemini | gemini-2.0-flash | 3rd |
| OpenRouter | various:free | 4th |
| Ollama | llama3.2 (local) | 5th |
| Hermes | nous-hermes | 6th |

Powers: AI Mentor, Research Team (multi-agent synthesis), Explain button on every widget, AI custom indicator builder.

### All-Asset Coverage
Crypto (spot, perps, options, DEX, DeFi, on-chain) · Forex · Indices · Commodities · Futures · ETFs · Equities — unified by the Conviction Engine.

### Live Data (Free)
Real-time via Binance/Bybit/OKX/Coinbase WebSocket with multi-venue failover. Free API integrations: CoinGecko, Finnhub, FRED, SEC EDGAR, DeFiLlama, Deribit, DexScreener, Twelve Data.

---

## Quick Start

```bash
npm install
npm run dev          # Opens the Electron app with HMR
```

**App PIN:** `8835`

```bash
npm run typecheck    # Strict TS — must pass
npm test             # 420 tests (vitest + fast-check)
npm run build        # Production build
npm run dist         # Package Windows installer
```

---

## Tech Stack

| | Technology |
|---|---|
| **Runtime** | Electron 42 + electron-vite 5 |
| **UI** | React 19 + Tailwind CSS v4 |
| **Language** | TypeScript 6 (strict, no `any`) |
| **State** | Zustand + TanStack Query |
| **Build** | Vite 7 |
| **Tests** | Vitest + fast-check (property-based) |
| **Icons** | lucide-react |

---

## Architecture

```
src/
├── main/            # Electron main process — IPC services, pricing WS, AI cloud
├── preload/         # Typed contextBridge (window.api.*)
├── renderer/src/    # React app
│   ├── modules/     # 40+ feature modules
│   ├── stores/      # Zustand stores (persisted)
│   ├── components/  # Shell + reusable UI
│   └── lib/         # AI router, exchange transport
└── shared/          # Pure domain logic — unit-tested, no DOM
    ├── chart/       # Chart math (scales, projection, hit-testing, layout, flash)
    ├── sandbox/     # Safe indicator evaluator (whitelisted AST interpreter)
    ├── smc/         # SMC detectors (breaker blocks, mitigation blocks, overlays)
    ├── indicators/  # Moving averages, oscillators, volatility, volume, pivots
    ├── markets/     # Multi-exchange adapters + fallback orchestrator
    ├── calc/        # Position size, pip, R:R, margin, compound, kelly, fibonacci
    ├── options/     # Black-Scholes greeks + chain analytics
    └── canvas/      # Widget canvas domain (layout, linking, templates)
```

---

## Modules (40+)

| Category | Modules |
|---|---|
| **Command** | Alpha Radar (AI CIO), Dashboard, Heatmap, Correlation, Scanner |
| **Charts** | Native Charts, Conviction Engine, Backtest, Journal, Playbook |
| **Markets** | Markets, FX Desk, Indices, Commodities, Futures, ETFs, Coins, Stocks |
| **Fundamentals** | Fundamentals, Financials, SEC Filings |
| **Derivatives** | Derivatives, Crypto Options (Deribit), Options, Liquidations, Order Book |
| **On-chain** | On-chain, DEX Screener, DeFi Desk |
| **Intel** | News, Calendar, Live TV, X Pulse |
| **AI** | AI Mentor, Research Team |
| **Tools** | Alerts, Toolkit (16 calculators) |
| **Platform** | Widget Canvas, Apps Gallery, Settings |

---

## Command Bar

Bloomberg-style function codes — type and go:

| Code | Action |
|---|---|
| `CHART ETH 4H` | Open ETH chart on 4H timeframe |
| `CONV BTC` | Run BTC Conviction read |
| `SCAN` | Open Scanner |
| `ALPHA` | Alpha Radar (AI morning brief) |
| `DEX` | DEX Screener |
| `VOL` | Crypto Options (Deribit IV/GEX/skew) |
| `MENTOR` | AI Mentor chat |
| `TOOLS` | Toolkit (calculators) |
| `ETH` | Quick — opens Conviction for ETH |

---

## Native Pricing Layer

All market data streams through a consolidated main-process service:
- One WebSocket per venue (Binance at launch), shared across all charts/modules
- Refcounted subscriptions with automatic cleanup on window close
- Exponential backoff reconnection (capped at 30s)
- Coalesced updates for backpressure (latest-value-wins per stream)
- REST history seed on subscribe (300 candles)

---

## AI Indicator Builder

Describe any indicator in natural language and the AI builds it:

> "RSI with 21-period, overbought at 80, oversold at 20"

The system generates a safe, sandboxed indicator definition (whitelisted AST, no eval/Function, no network/DOM access) that renders like a built-in and persists across restarts.

---

## Development

```bash
# Quality gate (must pass before every commit)
npm run typecheck && npm test && npm run build

# Run a specific test
npx vitest run src/shared/__tests__/chart-scale.test.ts
```

**Conventions:**
- Strict TypeScript — no `any`, every export typed
- Pure logic in `src/shared/` with property-based tests
- Sentence case UI, lucide icons, monospace tabular numerals
- Canvas 2D only — no third-party charting libraries

---

## Roadmap

- [ ] Drawing tools (trendlines, fibs, levels)
- [ ] Trade Journal + edge analytics
- [ ] Live SMC overlays on native chart
- [ ] Chart-vision (AI reads your chart)
- [ ] NL Screener ("find oversold large-caps with a bullish FVG")
- [ ] Macro/Economy desk (FRED integration)
- [ ] Mobile companion

---

## License

Private. All rights reserved.

---

<p align="center">
  Built by <a href="https://github.com/NanduriTribhuvan">NanduriTribhuvan</a>
</p>
