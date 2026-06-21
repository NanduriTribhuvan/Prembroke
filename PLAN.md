# Prembroke — Master Plan (v3, all-asset edition)

> **One terminal for every market.** Stocks, ETFs, options, futures, crypto (spot · derivatives · on-chain · DEX · DeFi), forex, commodities, and macro — unified by a **Conviction Engine** and an **AI brain**, in one dense desktop workstation. Free to start, institutional-grade at the ceiling.
>
> This document is the product/strategy source of truth. `BONDA1.md` is the engineering build/handoff spec (code conventions, module patterns, IPC). When they disagree on *what to build*, this file wins; on *how the codebase works*, BONDA1 wins.
>
> Supersedes the previous crypto+forex-only plan. Status as of writing: working Electron app, v0.3.0, ~30 modules, 121 tests green (passes 0–18). Pricing/figures below are approximate and as-of-2026.

---

## 0. The one question

> **"Should I take this trade — and how confident should I be?"**

TradingView gives you charts. Bloomberg gives you data. OpenBB gives you an empty framework. **Nobody gives you conviction.** That gap is the entire company. Every feature below earns its place by feeding one number: a **Conviction Score (0–100)** with a grade and a ready trade plan, explained factor by factor.

**What we are / are not**

| WE ARE | WE ARE NOT |
|---|---|
| Analysis, data, news, conviction & risk tooling | A broker, exchange, or wallet |
| A decision-support workstation for every asset class | A source of "signals to copy" — it grades, it doesn't advise |
| Desktop, dense, keyboard-driven, AI-native | A place where money moves — zero execution risk |
| Free to start, premium data/AI as the paid moat | A black box — every score is explainable and clickable |

---

## 1. The trader's real problems

The market is not short on data. It is short on **synthesis, discipline, and trust**. Real pain, segmented:

**Workflow pain**
- **15-tab sprawl.** A single decision spans TradingView + Finviz + Coinglass + CoinGecko + DeFiLlama + X/Twitter + an economic calendar + a journal + a broker. Context is lost in the switching.
- **Data without meaning.** Everyone shows numbers; nobody says what they *mean* for *this* trade right now.
- **No learning loop.** Journaling is manual, so it gets abandoned. The trader never compounds their own edge.

**Money pain**
- **Cost stacking.** Bloomberg is ~$2,000/mo. Retail stacks $40–200/mo across 4–6 tools and still has gaps.
- **Paywalled essentials.** Real-time data, options flow, on-chain analytics, and good alerts each live behind a separate subscription.

**Psychology pain**
- **Decision paralysis & FOMO.** Too many signals, no way to know which align. So traders chase or freeze.
- **No discipline by design.** Nothing stops revenge trading, oversizing, or breaking the rules at 2am.

**Asset-specific pain**
- **Crypto is fragmented.** Spot, perps/funding/OI, liquidations, options/IV, on-chain flows, DEX pairs, DeFi yields, unlocks — ten sites, no unified read.
- **Equities/options are gated.** Real-time quotes, fundamentals, options chains, dark-pool/flow, transcripts — all paywalled and scattered.
- **Macro/forex is scattered.** Rate-hike odds, COT positioning, currency strength, yields, DXY, the calendar — never in one place tied to a setup.

**AI pain**
- **Generic LLMs hallucinate.** ChatGPT doesn't see live prices, can't read your chart, and isn't trader-aware. AI "signal" services are prediction-framed and untrustworthy.

**The thesis:** win by collapsing all of this into one workstation that turns scattered data into a single, explainable conviction read — and remembers what worked.

---

## 2. What the trader actually needs next — the 8-stage loop

Build the product along the trader's real journey. Each stage is served by modules; stage 8 feeds back into stage 1.

| # | Stage | What the trader does | Modules that serve it |
|---|---|---|---|
| 1 | **Bias** | Form a directional read | Dashboard, HTF charts, macro/risk-on-off gauge, news, geopolitics |
| 2 | **Watch** | Narrow to candidates | Screeners, watchlists, currency strength, correlation, alerts firing |
| 3 | **Read** | Read the chart | Charts + ICT/SMC auto-detect (structure, OB, FVG, liquidity, premium/discount) |
| 4 | **Confluence** | Stack the reasons | Confluence engine collects every aligned factor across TA + fundamentals |
| 5 | **Conviction** | Score & grade | Conviction Score 0–100, grade A+/A/B/skip |
| 6 | **Plan** | Build the trade plan | Auto entry/stop/targets/R:R + position size from Toolkit |
| 7 | **Execute** | Place it (elsewhere) | Trader executes at their broker; app logs intended trade + arms alerts |
| 8 | **Review** | Journal & learn | Trade journal, edge analytics, replay — feeds back into stage 1 bias |

**The loop is the moat.** The trader's own stats sharpen the next bias. Competitors sell stages 1–3; nobody owns the full loop.

---

## 3. Why no one can compete

The moat is not one feature — it is the **stack** of five things no competitor does together:

1. **Conviction synthesis.** A single explainable score from stacked confluence. Everyone else stops at raw data.
2. **Detection quality.** Clean, defensible ICT/SMC + classic TA auto-detection. This is the trust we sell.
3. **The learning loop.** Journal → edge analytics → sharper bias. Retention lives here; their stats can't leave.
4. **All-asset, all-in-one.** One terminal replaces 6 subscriptions across every market.
5. **AI-native + free.** An opinionated, market-aware brain out of the box, free to start.

Per-segment, what we replace:

| Their tool | What it does well | What it can't do | Prembroke replaces it with |
|---|---|---|---|
| Bloomberg | Everything, institutional | ~$2k/mo, complex, not crypto-native, no conviction | All-in-one at free → accessible paid |
| TradingView | Charts, social, alerts | No synthesis, thin on-chain/derivs, no conviction | Charts + Conviction Engine + all data |
| Finviz | Equities screener, maps | Equities-only, 15-min delayed free, no AI | All-asset screener + AI + conviction |
| Koyfin | Fundamentals, macro dashboards | Not crypto-native, no trade setups | Fundamentals + setups + crypto depth |
| Coinglass | Crypto derivatives data | Crypto-only, no synthesis | Derivs *inside* the conviction read |
| OpenBB | BYO-data framework, AI agents | Ships no data/opinion, enterprise-tuned | Batteries-included + opinion + extensible |

---

## 4. OpenBB — parity and beyond

The user asked specifically: match OpenBB, then beat it. Here is the full read.

**What OpenBB is now (2026):** they dropped the old CLI terminal for two products.
- **Open Data Platform (ODP)** — open source, "connect once, consume everywhere": a data-provider abstraction with standardized models + extensions, exposed via ODP Desktop, ODP Python (SDK → REST + MCP), and ODP CLI (interactive charts/tables, scriptable routines). Surfaces to Python, Excel, MCP agents, and REST.
- **OpenBB Workspace** — enterprise web app: **Widgets** (data + metadata + table/chart/PDF + parameters), **Dashboards** (drag-drop canvas with **parameter-linking** so changing one ticker updates all linked widgets; pin notes/PDFs/AI artifacts; share firm-wide), **Apps** (pre-built dashboard templates with linked widgets + a pre-selected AI agent + prompts), **AI Agents + Copilot** (widget-aware, multi-step, reactive + proactive, artifacts back to dashboard), **MCP server**, **BYO-LLM**, **BYO-data backends + HTML widgets**, **Excel add-in + export**, an **App Marketplace** (Velo/Koinju crypto, Adanos sentiment, Financial Datasets, CFTC, EIA, BlueGamma rates, SuperQuant flow, Outsampler, VecViz, Open Portfolio), and enterprise (self-host/VPC, SOC2 II, SSO, MFA, RBAC, audit, Snowflake Native App).
- **Pricing:** Community free (20 Copilot queries/day, unlimited apps/dashboards, marketplace, MCP). Pro = "contact sales," one-time team license.

**Their structural weakness:** OpenBB **ships no data and no opinion** (just an FMP sandbox). You bring data, you build dashboards, and it's tuned for enterprise buy-side research — not for a trader asking "should I take this trade?"

> **OpenBB makes you build the terminal. Prembroke *is* the terminal — and you can still extend it like OpenBB.**

**Adopt their best architecture (parity):**
1. Widget / dashboard / app framework — composable, draggable, resizable widget canvas with saved layouts.
2. **Parameter-linking groups** — global symbol/timeframe; change once, every linked widget re-queries.
3. **Apps** = one-click workflow templates (curated widgets + AI agent + starter prompts) per asset/persona.
4. Widget-aware AI agents that pin artifacts back into the dashboard; reactive + proactive monitoring.
5. **MCP server** — expose Prembroke's data/tools to any external AI agent, and consume external MCP tools.
6. **BYO-LLM** (your Claude/OpenAI/Gemini key) + **BYO-data backends** + HTML widgets.
7. Excel add-in + export; an extension/plugin SDK; later an app marketplace.
8. "Connect once, consume everywhere" provider-agnostic data layer (already seeded by our multi-exchange adapters).
9. Enterprise tier later (SSO, RBAC, audit, self-host) for the Desk/Team plan.

**Then beat them on what they refuse to do:**
- Batteries-included **free data across all assets** out of the box.
- The **Conviction Engine + auto trade plans + ICT/SMC** — opinion and setups they have nothing comparable to.
- **Trading-native modules** wired in: DOM/order book, liquidations, funding, killzones, alerts, journal.
- An **opinionated, market-aware AI brain** + multi-agent Research Team, not just a neutral data copilot.
- **No Python, no sales cycle, free → accessible paid** vs enterprise-quote.
- **Desktop-native speed** with the conviction front door.

---

## 5. The product — full module map (all-asset)

Grouped by the workflow. ✓ = already built (see BONDA1 §6 for code locations). Everything becomes a **widget** in the new canvas (§10).

**Command & overview**
- ✓ **Alpha Radar** — AI-CIO front door: "N opportunities, M risks, K narratives" morning brief
- ✓ **Dashboard / Command Center** — heatmaps, movers, Fear & Greed, risk-on/off gauge, global mcap, AI brief
- ✓ **Heatmap** · ✓ **Correlation matrix** · ✓ **Scanner**

**Charts & the flagship**
- ✓ **Charts** — multi-layout, all asset classes, SMC overlays
- ✓ **Conviction Engine** ★ — confluence → score → grade → trade plan (`modules/conviction/engine.ts`)
- ✓ **Playbook** — ICT/SMC knowledge base (~40 concepts) feeding the AI

**Markets — every asset class**
- ✓ **Markets** (watchlists, screeners, currency strength) · ✓ **Coins** · ✓ **Stocks**
- ✓ **DEX Screener** · ✓ **DeFi desk** (yields, TVL, exploits)
- ⏳ **ETFs · Futures · Commodities · FX desk · Indices** — all-asset expansion (new)

**Fundamentals & filings**
- ✓ **Fundamentals** · ✓ **Financials** · ✓ **Filings** (SEC EDGAR)
- ⏳ **Smart-money** (Form 4 insiders + 13F institutions) · ⏳ **Transcripts** (premium)

**Derivatives, flow & microstructure**
- ✓ **Derivatives desk** (funding, OI, long/short, liquidations) · ✓ **Flow** (live liquidations)
- ✓ **Options** (equity, Tradier) · ✓ **Crypto Options** (Deribit: IV, GEX, max pain, skew) · ✓ **Order book / DOM**
- ⏳ **Equity options flow / dark pool** (premium) · ⏳ **Level 2 full depth + time & sales** (premium)

**On-chain & crypto-native**
- ✓ **On-chain desk** (gas, flows) · ⏳ **Whale/exchange-flow alerts, MVRV/SOPR/NUPL, token unlocks** (deeper)

**Intel & context**
- ✓ **News** (RSS + aggregation, AI sentiment) · ✓ **Economic Calendar** · ✓ **Live TV** · ✓ **Social / X Pulse**
- ⏳ **Macro / Economy desk** (FRED: rates, CPI, jobs, yields) · ⏳ **Geopolitics desk**

**AI**
- ✓ **AI Mentor** (streaming, market-aware chat) · ✓ **Research Team** (multi-agent CIO synthesis)
- ⏳ **Chart-vision · NL screener · AI Portfolio Manager** (next)

**Discipline & the loop**
- ✓ **Alerts Engine** · ✓ **Toolkit** (16 calculators: position size, pip, R:R, margin/liq, Kelly, DCA, Fib, pivots…)
- ⏳ **Trade Journal + edge analytics** · ⏳ **Risk & Discipline gate** (max-loss lockout, R:R gate, correlation warnings) · ⏳ **Backtester / replay**

**Platform**
- ✓ **Settings** (AI engine, API keys, theme) · ⏳ **Widget canvas, Apps/templates, MCP server, Excel add-in, plugin SDK** (§10, §4)

---

## 6. The flagship — the Conviction Engine

For any symbol, the engine auto-runs a confluence checklist, weights each factor, and outputs a single score, a grade, and a ready trade plan. This screen *is* "take a trade with confidence."

```
BTC/USDT — LONG setup                         CONVICTION 82 / 100   GRADE: A
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
✓ HTF bias bullish — 4H BOS confirmed                                   +20
✓ Price in discount — below 50% equilibrium                            +15
✓ Sell-side liquidity swept — stop-hunt below                          +15
✓ Bullish FVG + Order Block confluence                                 +15
✓ NY killzone active                                                   +10
✓ RSI bullish divergence                                               +10
✓ Funding negative — shorts pay longs                                   +7
✗ News risk — FOMC in 2h                                               -10
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
PLAN  entry 64,200 · stop 63,400 · TP 66,800 · R:R 3.2
```

- **Detectors** (already shipped, pure functions over `Candle[]`): swings → BOS/CHoCH structure, FVG, order blocks, EQH/EQL, liquidity sweep, premium/discount, OTE band, displacement, draw-on-liquidity; plus EMA50/200, RSI, ATR, killzones, MTF, SMT divergence.
- **Grading** A+/A/B/skip with **customizable factor weights** — pros tune their own model.
- **Auto trade plan**: entry/stop/targets/R:R, position size pulled from the Toolkit.
- **Explainable**: every factor is clickable and teaches. It grades; it does not advise.
- **All-asset generalization (next):** the engine is asset-agnostic over OHLCV. Extend factor inputs per class — funding/OI/skew (crypto), COT/rate-differentials/DXY (FX), earnings-proximity/short-interest/options-skew (equities), term-structure/seasonality (futures).
- **Build discipline:** ship a few concepts done right (structure + FVG + liquidity sweep) before 30 sloppy ones. Detection quality is the trust.

---

## 7. The AI brain — best free now, premium as a paid upgrade

The keystone differentiator. One **unified router** (`src/renderer/src/lib/ai.ts`, already shipped) every feature calls — never the raw providers.

**A. Free tier (default, works out of the box)**

| Job | Model (free) | Why |
|---|---|---|
| Main analyst chat, explain-this-move, briefs | Groq / Cerebras `llama-3.3-70b` | Fast, free, strong reasoning |
| Bulk: sentiment tags, news dedup, scoring | Gemini Flash | Pennies/free at volume |
| Fully local / offline | Ollama (`llama3.2`), Hermes | Zero key, private |
| Fallback chain | Groq → Cerebras → Gemini → OpenRouter → Ollama → Hermes | Always-on resilience |

**B. Premium tier (the paid upgrade — bring-your-own-key or Elite)**

| Job | Model (premium) | Why |
|---|---|---|
| Deep multi-agent research, weekly thesis | Claude Opus / Sonnet 4.x | Best reasoning |
| Chart-vision (read a chart screenshot) | Claude / GPT / Gemini Pro vision | Multimodal markup |
| Long-context cross-asset synthesis | Gemini Pro, GPT | Big context windows |
| Higher rate caps, voice, priority | — | Premium SLAs |

**C. Specialist quant / ML — analysis assistance, not prediction**
- **FinBERT** — financial-news sentiment (better than generic LLM for bulk tagging)
- **GARCH** — volatility forecasting · **HMM / clustering** — market-regime detection (trend vs chop vs volatile)
- **Anomaly detection** (isolation forest / z-score) — unusual volume, whale moves, vol spikes
- **Correlation & PCA** — what's driving the market today

**D. AI surfaces (built + planned)**
- ✓ Unified router, streaming, **Research Team** (multi-agent CIO synthesis), **ExplainButton** on any widget, AI rate-limit governor
- ⏳ Chart-vision, NL screener ("find large-cap miners with a bullish FVG"), AI Portfolio Manager, devil's-advocate stress test, MCP server (expose tools to external agents), BYO-LLM key UI

**Positioning & liability (non-negotiable):** never market "AI predicts the price." Every model is **AI-assisted analysis**; the Conviction Score is a **decision aid**. A "not financial advice" line sits on every analytical surface. This is legally safer and what serious traders actually want.

---

## 8. The data layer — free engine + premium power tier

Two tiers. The free engine wins users; the premium tier is the moat they pay for. (On monetization, most free tiers become non-commercial and TradingView free widgets aren't licensed for paid products — budget for real data, see §12.)

**Free engine (live, no/own key)**

| Need | Source |
|---|---|
| Crypto real-time | Binance/Bybit/OKX/Coinbase public WS/REST (cross-venue fallback) |
| Crypto derivs/options | Binance/Bybit futures, Deribit (free) |
| DEX / DeFi | DexScreener, DeFiLlama |
| Equities/fundamentals/filings | SEC EDGAR (free), Finnhub/FMP free tiers |
| Forex/metals | TradingView widgets, Frankfurter/exchangerate.host, Twelve Data free |
| Macro | FRED (free key) |
| News / sentiment | RSS, CryptoPanic, StockTwits, alternative.me (Fear & Greed) |
| TV / social | YouTube live embeds, official X timelines |

**Premium power tier (paid / bring-your-own-key)**

- **Equities/options:** Polygon.io, Databento, Intrinio (real-time trades/quotes); Financial Modeling Prep, Visible Alpha (fundamentals/estimates); ORATS, Unusual Whales, Cheddar Flow (options chains/greeks/vol/flow/dark-pool); Quartr, AlphaSense (transcripts/filings intel); Benzinga Pro, RavenPack, Dow Jones (low-latency machine news).
- **Crypto:** Kaiko, Amberdata, CoinAPI (institutional market data); Glassnode Pro, Nansen, Arkham, Dune, Santiment (on-chain); Velo, Coinglass Pro, Laevitas (derivs/options/vol); Allium, Bitquery, Blocknative (DEX/mempool).
- **Forex/macro/rates/futures:** OANDA, Polygon FX, TraderMade (FX ticks); Trading Economics (macro); COT, CME FedWatch (positioning/rate odds); CME/ICE, Databento, Barchart (futures/commodities); real-time treasury/credit (bonds).
- **Cross-cutting power:** Level 2 / full DOM + time & sales; alt-data (Sensor Tower, Similarweb, card-spend, jobs/satellite); sentiment firehose (RavenPack, LunarCrush Pro).
- **Architecture:** provider-agnostic "connect once, consume everywhere" data models; main-process REST proxies (no CORS / secrets); host-allowlisted; TTL cache. BYO-data backends + HTML widgets (OpenBB-style) so users plug in anything.

---

## 9. UI/UX — the full rewrite (the widget-canvas everything-app)

This is what turns ~30 siloed module screens into **one composable everything-app**. Adopts OpenBB's best framework ideas, Bloomberg's density/keyboard speed, and a modern dark aesthetic.

**Design language** — dark-first terminal aesthetic, green→gold brand, dense 13px tabular numerals, modern-but-pro. Theme engine (6 accent presets, density/zoom, light/dark), minimal motion, sentence case, lucide icons. Up/down stay green/red.

**Layout = widget canvas (the core rewrite)** — evolve today's 1/2/4 tiled panes into a full **draggable, resizable widget grid**:
- Saved **workspaces/layouts** + multi-monitor pop-out windows (pop-out already exists)
- **Parameter-linking groups** — a global active symbol + timeframe; change once, all linked widgets re-query
- Every existing module becomes a **widget** that can live on any dashboard

**Apps / templates** — pre-built dashboards per persona, one click to load curated widgets + the right AI agent + starter prompts: Crypto Day-Trade desk · Swing Equities · Macro/Rates · Options/Vol desk · On-chain/DeFi · FX desk.

**Navigation** — Bloomberg-style command bar (function codes, already shipped) + Ctrl+K palette + grouped sidebar + global symbol box + **NL command** ("show me oversold large-cap miners with a bullish FVG").

**AI-native surfaces** — persistent Copilot side panel (streaming), "Explain with AI" on every widget, chart-vision, the Research Team, NL screener, and **AI artifacts pinned back onto the dashboard**.

**Charts** — pro charting with drawing tools, replay, multi-chart linked crosshair, full indicator library + SMC overlays. **Decision:** free tier on open-source lightweight-charts; **TradingView Advanced Charts license as a premium upgrade** (consistent with free-now/paid-later).

**Tables/grids** — virtualized, sortable, conditional formatting, sparklines, one-click CSV/Excel export everywhere.

**Extensibility** — widget SDK + plugin system + **MCP server** + BYO-data/BYO-LLM, so power users extend it the way OpenBB allows. Later: an app marketplace.

**Onboarding & performance** — guided tour, sensible default workspace, no-Python. Virtualized rendering, web-workers for indicators/quant, local cache for instant loads.

---

## 10. Roadmap — what to add next (prioritized)

**Now (free, highest impact)**
1. **Widget canvas + parameter-linking + Apps/templates** — the UI rewrite that unifies everything (§9).
2. **All-asset expansion** — ETFs, futures, commodities, FX desk, indices as first-class.
3. **Macro / Economy desk** (FRED) + **Smart-money** (Form 4 + 13F) + deeper on-chain (MVRV/SOPR, unlocks, whale alerts).
4. **NL screener** + **chart-vision** + **devil's-advocate** — the AI flex.
5. **Trade Journal + edge analytics + Risk gate** — close the loop (retention).
6. **MCP server + BYO-LLM/BYO-data** — OpenBB-grade extensibility.

**Next**
7. **AI Portfolio Manager** (capital + risk + themes → monitored allocation).
8. **Backtester / replay** for the Conviction Engine; feed Deribit 25Δ skew into the score.
9. **Volume Profile / VPVR, anchored VWAP, Ichimoku** and the "add-for-pro" indicator set.

**Later (premium / harder)**
10. Equity options flow + dark pool, Level 2 depth, alt-data, transcripts intelligence.
11. Future-revenue predictor (GitHub/app/jobs signals), CEO "guidance vs actuals" reliability score.
12. Mobile/PWA companion, voice, app marketplace, enterprise (SSO/RBAC/audit/self-host).

---

## 11. Free now → paid later (business model)

**Strategy:** launch a genuinely generous **free public product** to win traders, then monetize the premium data + premium AI ceiling.

**Free (own-key/public data):** full Conviction Engine, all-asset screeners, charts, news, calendar, crypto real-time (genuinely live and free), toolkit, journal, free AI brain (Groq/Gemini/Ollama), widget canvas, apps. This alone beats most paid competitors.

**The data reality (be honest about it):** when you charge, most free tiers (CoinGecko, CryptoPanic, Finnhub, Twelve Data) go non-commercial and TradingView free widgets aren't licensed for paid use. Budget **$500–2,000/mo** in real data + the TradingView Charting Library license. At ~$200/user you break even on data around 5–15 subscribers — then high margin.

**Suggested tiers (approximate)**

| Tier | Price | For |
|---|---|---|
| **Free** | $0 | All-asset analysis, conviction, free AI, own-key data |
| **Pro** | ~$49–79/mo | Real-time data, premium AI (Claude/GPT/vision), unlimited alerts, journal+edge |
| **Elite** | ~$149–199/mo | Full AI Research Team, options flow + on-chain pro, backtester, NL screener |
| **Desk / Team** | ~$499+/mo | Multi-seat, API/MCP access, SSO/RBAC/audit, self-host |

Wedge marketing: **Bloomberg is ~$2,000/mo; OpenBB makes you build it yourself. Prembroke is free to start and AI-native.**

---

## 12. Build order & phases

**Done (passes 0–18):** Electron shell, theme, command bar/palette, live ticker, ~30 modules, Conviction Engine, multi-exchange resilience, crypto options (Deribit), unified AI router + streaming + Research Team, DEX + DeFi desks, theme engine. 121 tests green.

**Phase A — the unifier (now):** widget canvas + parameter-linking + Apps/templates (§9). This is the rewrite that makes it "everything in one."

**Phase B — all-asset depth:** ETFs/futures/commodities/FX/indices first-class; Macro desk; Smart-money; deeper on-chain. Generalize the Conviction Engine per asset class.

**Phase C — the loop:** Journal + edge analytics + Risk gate + backtester.

**Phase D — AI flex:** NL screener, chart-vision, AI Portfolio Manager, MCP server, BYO-LLM/BYO-data.

**Phase E — monetize:** premium data wiring (Polygon/Unusual Whales/Kaiko/Glassnode…), TradingView license, tiers + billing, enterprise (SSO/RBAC/self-host).

**Phase F — reach:** mobile/PWA, voice, app marketplace.

Sequencing rule: each phase makes the eventual paywall more obviously worth it. Charts + conviction + alerts + the loop are the "I'll pay for this" core.

---

## 13. Non-negotiables, risks, success metrics

**Non-negotiables**
1. Frame everything as **conviction/confluence, never "signals to copy."** Legally safer, and what pros want.
2. **Detection quality before breadth.** A few ICT/SMC concepts done cleanly beats 30 sloppy ones.
3. **"Not financial advice"** on every analytical surface. AI is analysis, not prediction.
4. **Definition of done** for any change: `npm run typecheck && npm test && npm run build` all green (see BONDA1).

**Risks & mitigations**
- *Free-tier RPM caps* → cache briefs, batch sentiment, provider-fallback chain (shipped).
- *Geo-blocked exchanges* → cross-venue fallback + main-process proxy (shipped).
- *Real-time equities/options aren't free* → free tier uses delayed/own-key; real-time is the premium upgrade.
- *X API can't read tweets* → official embeds only.
- *Data licensing on monetization* → budget $500–2k/mo, license TradingView, re-paper non-commercial sources.
- *ICT/SMC subjectivity* → ship defensible logic, show the reasoning, let pros tune weights.

**Success metrics**
- Activation: % who load a default workspace and run their first Conviction read.
- Depth: widgets pinned, watchlists, alerts armed per active user.
- The loop: journaled trades / week, return visits, edge-analytics usage.
- Trust: Conviction grade vs realized outcome calibration over time.
- Conversion: free → Pro/Elite once premium data/AI is live.

---

_Master plan v3 (all-asset). Source of truth for product/strategy. Engineering details live in `BONDA1.md`. Keep this file current as direction evolves._
