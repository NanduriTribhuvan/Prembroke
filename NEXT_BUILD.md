# NEXT BUILD — Agentic AI Analysis System

> The trader says what they want. The AI loops until it's done.
> Not a chatbot — an autonomous analyst that uses every tool in the terminal.

---

## The Vision

**OpenBB's approach:** A "copilot" that can read dashboard widgets, fetch data from them, and pin results back. It's widget-aware but reactive — the user asks, it answers once. It needs external data backends, a Python setup, and enterprise pricing. It's built for buy-side research teams, not individual traders.

**Our approach:** An **autonomous analysis agent** that doesn't just answer — it **loops until the goal is satisfied**. The trader gives a high-level goal ("find me a long setup on BTC with at least 3:1 R:R" or "tell me if SOL is safe to buy right now"), and the agent:

1. Plans what it needs to check
2. Executes each step using the terminal's own tools (Conviction Engine, live pricing, indicators, news, fundamentals, derivatives data, on-chain, etc.)
3. Evaluates whether the goal is met
4. If not → refines, gathers more data, tries another angle
5. Loops until it has a confident, explainable answer — or explicitly says "insufficient evidence"

This is **CrewAI/AutoGPT for trading** — but embedded in a terminal that already has all the data, so there's zero setup. No Python, no API wiring, no external frameworks. Just paste a free AI key and ask.

---

## What OpenBB Has (that we should match or beat)

| OpenBB Feature | Their Implementation | Our Equivalent / Advantage |
|---|---|---|
| Widget-aware AI | Copilot reads dashboard metadata, fetches widget data | Our AI already has access to ALL module data via the unified router — deeper integration |
| Generative UI | AI pins outputs as new widgets on the dashboard | We can pin analysis results as widgets on the canvas (stretch) |
| Custom agents | Developers define agents with custom tools/prompts | We have specialist agents (Research Team) already; we make them goal-driven |
| MCP server | External agents can inspect/control the workspace | We can expose tools via MCP (future — we focus on embedded first) |
| App marketplace | Pre-built dashboard templates with linked widgets | We have Apps already (6 persona templates); marketplace is future |
| Parameter linking | Change one ticker, all linked widgets update | Already shipped in our widget canvas |
| BYO data/BYO LLM | Connect any backend, any AI model | Already shipped (multi-provider AI router + exchange adapters) |
| HTML widgets | Embed arbitrary web tools in sandboxed iframes | Doable but lower priority — our widgets are native React |

**Where they're weak and we're strong:**
- They ship NO data. You bring everything. We ship free live data out of the box.
- They have NO opinion. No Conviction Engine, no trade plans, no ICT/SMC detection.
- They're enterprise-priced. We're free to start.
- Their AI answers once. Ours LOOPS until the goal is met.

---

## The Agentic Analysis System — Architecture

### Core Concept: Goal → Plan → Execute → Evaluate → Loop

```
User Goal: "Is BTC safe to long here? I want 3:1 minimum."
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  PLANNER                                             │
│  Decomposes the goal into analysis steps:            │
│  1. Run Conviction Engine on BTC (4H + 1D)          │
│  2. Check derivatives (funding, OI, liquidations)    │
│  3. Check on-chain (exchange flows, whale moves)     │
│  4. Check news/catalyst risk (FOMC? CPI?)            │
│  5. Check correlation (DXY, SPX, ETH divergence)     │
│  6. Evaluate: does the evidence support a long       │
│     with 3:1 R:R? If not, what's missing?            │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  EXECUTOR (tool-calling loop)                        │
│  Calls internal tools sequentially:                  │
│  - computeConviction(BTC, 4h) → score 72, grade B   │
│  - fetchFunding(BTC) → -0.01% (shorts pay)         │
│  - fetchNews() → FOMC in 36h (medium risk)          │
│  - computeConviction(BTC, 1d) → score 65, grade B   │
│  Each step feeds into a running analysis context.    │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  EVALUATOR                                           │
│  "Is the goal satisfied?"                            │
│  - Conviction: 72 (B grade) — decent but not A      │
│  - R:R from trade plan: 2.8 — below 3:1 threshold   │
│  - Catalyst risk: FOMC in 36h — timing concern      │
│  → VERDICT: "Not yet. R:R is 2.8 < 3.0 target,     │
│     and FOMC risk in 36h. Suggest waiting for        │
│     post-FOMC structure to form. Alternative:        │
│     widen stop to 63,100 for 3.1 R:R but with       │
│     higher risk."                                    │
│  → If insufficient data: loop back to Planner       │
│     with "need more context on X"                    │
└─────────────────────────────────────────────────────┘
    │
    ▼
  RESPONSE: Structured, explainable, with conviction
  score, trade plan, risks, and clear YES/NO/WAIT.
```

### The Tool Set (what the agent can call)

These are ALL internal — no external API calls needed beyond what the terminal already does:

| Tool | What it does | Already built? |
|---|---|---|
| `conviction(symbol, interval)` | Run the Conviction Engine | ✅ Yes |
| `indicators(symbol, interval, list)` | Compute specific indicators | ✅ Yes |
| `price(symbol)` | Get live price + 24h change | ✅ Yes |
| `candles(symbol, interval, count)` | Get OHLCV history | ✅ Yes |
| `funding(symbol)` | Get funding rate + OI + long/short | ✅ Yes (derivatives module) |
| `news(filter?)` | Get recent news + sentiment | ✅ Yes |
| `calendar()` | Get upcoming economic events | ✅ Yes |
| `onchain(symbol)` | Get on-chain metrics (gas, flows) | ✅ Yes |
| `dex(symbol)` | Get DEX pair data | ✅ Yes |
| `options(symbol)` | Get options chain / IV / skew | ✅ Yes (Deribit) |
| `fundamentals(symbol)` | Get financials / filings | ✅ Yes (SEC) |
| `correlation(symbols)` | Cross-asset correlation | ✅ Yes |
| `scanner(filter)` | Find symbols matching criteria | ✅ Yes |
| `explain(context, question)` | Ask the AI a follow-up | ✅ Yes |

**Key insight: we already have ALL the tools.** The agent just needs to be able to call them in a loop with a plan. This is a thin orchestration layer on top of existing infrastructure.

---

## Implementation Plan

### Phase 1: Goal-Driven Analysis Agent (the core loop)

**New module:** `src/renderer/src/modules/analyst/`

1. **Goal parser** — takes natural language goal, classifies it:
   - Trade setup evaluation ("is X safe to long/short?")
   - Opportunity scan ("find me the best setup right now")
   - Risk assessment ("what are the risks for my BTC long?")
   - Market overview ("what's the macro picture today?")
   - Custom research ("compare SOL vs AVAX for a swing trade")

2. **Planner** — decomposes the goal into an ordered list of tool calls:
   - Uses `askAI` with a planning system prompt
   - Outputs a structured step list: `[{ tool, args, purpose }]`
   - Adapts based on goal type (trade eval needs conviction + derivs + news; scan needs scanner + conviction on top results)

3. **Executor** — runs each step, collecting results:
   - Calls the internal tool functions directly (no IPC needed — these are renderer-side)
   - Builds a running `AnalysisContext` that accumulates evidence
   - Streams progress to the UI as each step completes

4. **Evaluator** — checks if the goal is satisfied:
   - Sends the accumulated context + original goal to `askAI` with an evaluation prompt
   - AI returns a structured verdict: `{ satisfied: boolean, confidence, verdict, missingData?, nextSteps? }`
   - If not satisfied and max iterations not hit → feeds `nextSteps` back to Planner

5. **Loop controller** — manages the agent lifecycle:
   - Max iterations (default 3, configurable)
   - Timeout (60s total budget)
   - Progress streaming (each step shown live)
   - Cancellation (user can stop mid-loop)
   - Final output formatting (structured markdown with sections)

### Phase 2: Specialist Modes

Pre-configured analysis flows that bypass the planner for common tasks:

| Mode | What it does automatically |
|---|---|
| **Quick Read** | Conviction + price + funding + news risk → 10-second verdict |
| **Deep Dive** | Full multi-agent research (already exists — wire into the loop) |
| **Opportunity Scan** | Scanner → top 5 → conviction on each → ranked results |
| **Risk Check** | Derivatives + correlation + calendar + news → risk report |
| **Comparative** | Run conviction + fundamentals on 2-5 symbols → side-by-side |

### Phase 3: Learning + Memory

- **Analysis history** — persist every completed analysis with timestamp, goal, verdict, tools used
- **Outcome tracking** — user can mark "took the trade" → later evaluate if the analysis was correct
- **Pattern recognition** — "your analysis is most accurate when conviction > 80 AND funding is negative"
- **Personalization** — learns which tools you trust most, which factors matter to your style

### Phase 4: Proactive Mode (the killer feature)

The agent doesn't just wait for you to ask — it **monitors and alerts**:

- "BTC just hit 85 conviction on 4H. Your threshold is 80. Here's the setup."
- "SOL funding just flipped negative while price is in discount. Checking conviction... 78, grade B+. Worth watching."
- "FOMC in 2h. Your open BTC analysis from this morning has a new risk factor."

This runs as a background loop (configurable interval, e.g. every 5 min) checking watched symbols against user-defined thresholds.

---

## UI Design

### Primary Surface: The Analyst Panel

A new module (`ANALYST` command code) with:

- **Goal input** — large text area at the top: "What do you want to know?"
- **Quick mode buttons** — "Quick Read", "Deep Dive", "Scan", "Risk Check"
- **Live progress** — steps appear as they execute, each with a status indicator
- **Final verdict** — structured output with:
  - Clear YES / NO / WAIT recommendation
  - Conviction score + grade
  - Trade plan (if applicable)
  - Key factors (bullish / bearish)
  - Risks identified
  - Confidence level
  - Supporting data (collapsible)

### Integration Points

- **Charts module** — "Analyze this chart" button → feeds the current symbol + timeframe to the Analyst
- **Conviction module** — "Go deeper" button → launches a Deep Dive from the conviction result
- **Alpha Radar** — each opportunity row gets an "Analyze" button → instant goal evaluation
- **Command bar** — `ANALYZE BTC` or `SCAN TOP SETUPS` function codes

---

## Technical Notes

- The agent runs ENTIRELY in the renderer process — all tools are renderer-accessible
- Uses the existing `askAI` router for all LLM calls (same fallback chain)
- Rate-limited by `useAiLimit` (same governor as Research Team)
- Streaming via `askAIStream` for the final synthesis step
- Results are persisted to a Zustand store (`prembroke.analyst`)
- Cancellation via AbortController
- No new dependencies needed

---

## Why This Beats Everything

| Competitor | What they do | Why we're better |
|---|---|---|
| OpenBB Copilot | Answers questions about widget data | We LOOP until the goal is met, using 14+ tools autonomously |
| ChatGPT / Claude | General chat, no live data | We have live prices, funding, OI, news, on-chain, all embedded |
| TradingView Pine | Static indicators | Our AI BUILDS indicators AND evaluates setups dynamously |
| Signal services | "Buy BTC now" — no reasoning | Every factor is explainable, scored, and the user decides |
| CrewAI / AutoGPT | Multi-agent frameworks, BYO everything | Zero setup — paste one key and the whole system works |

**The moat: data + tools + opinion + loop.** Nobody else has all four in one place, free.

---

## Build Order

1. ~~Native charting engine~~ ✅ Done
2. **Agentic Analysis System** ← NEXT (this document)
3. Drawing tools on chart
4. Trade Journal + edge analytics
5. Live SMC overlays
6. Proactive monitoring agent
7. Chart-vision (AI reads screenshots)

---

_This is the next-level feature. Everything else is incremental. This is the "holy shit" moment._
