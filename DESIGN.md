# Prembroke — Design System (Institutional Weapon)

> The visual source of truth for the full UI redesign. Direction: **institutional weapon.**
> The most information-dense, mechanically-precise, keyboard-native screen a trader has
> ever seen. It should feel like a $2,000/mo hedge-fund instrument — not an app, a
> **terminal**. The flex is power and discipline, never decoration.
>
> Governs *what it looks like*. `BONDA1.md` governs *how the code works*. Look conflicts →
> this wins; architecture conflicts → BONDA1 wins.
>
> **Hard constraints from the theme engine (`src/shared/theme`), enforced by tests:**
> - Up = `#16c784`, down = `#ea3943`. Never recolored.
> - Body text AAA (≥7:1) on bg; secondary/tertiary AA (≥4.5:1) on panel; accent ≥3:1 — both modes, all accents.
> - `resolveTheme()` stays pure; theme reaches the DOM only via `applyTheme()`.

---

## 0. The thesis

**Density is the product. Color is information. Discipline is the flex.**

An institutional weapon does not decorate. Every pixel is instrumentation. The screen is
near-black, the type is mechanical and ice-white, the structure is drawn in hairlines.
Color appears *only* where it means something: green/red for direction, one electric
accent for the single live/active object. The result reads as expensive precisely because
it refuses to be pretty. Bloomberg's information theater with Linear's craft and
Palantir's seriousness.

Three words: **dense · precise · cold.**

What we are NOT: glassmorphism, soft cards, warm cozy gold, rounded SaaS, gradients for
their own sake, motion for delight. If it looks like a Dribbble shot, it's wrong.

---

## 1. References (the bar)

- **Bloomberg Terminal** — the density and information-theater ceiling. Function codes, every cell live, monospace data, the tape. We keep its density; we kill its 1990s ugliness.
- **Palantir Foundry / Gotham** — the modern institutional-weapon look: dark, surgical, data-dense but *designed*. This is the actual $100M reference.
- **Jane Street / Citadel / a16z internal tools** — restraint, precision, zero consumer fluff. Tools for people who move money.
- **Linear** — the craft bar: perfect hairlines, perfect mono rhythm, not one wasted pixel, never sloppy even at high density.

---

## 2. Color — ruthless discipline

The whole system is **monochrome by default + signal color on demand.** 90% of the screen
is five grays and ice-white. Color is an event.

### 2.1 The monochrome spine (new `DARK_BASE`)

A cold neutral ramp with a faint blue-steel undertone (never warm). This is the entire
canvas.

| Token | Value | Role |
|---|---|---|
| `bg` | `#08090c` | the void — app floor |
| `panel` | `#0d0f13` | base panel surface |
| `panel2` | `#13161c` | raised panel / row hover / header |
| `edge` | `#1c212b` | **the hairline** — the most-used token in the whole UI |
| `muted` | `#6b7382` | tertiary / de-emphasized data |
| `text` | `#f4f6fa` | primary ice-white data (AAA on bg) |
| `accent2` | `#42506a` | structural steel (axis lines, inactive ticks) |
| `leaf` | `#0e1620` | faint panel tint variation |
| `olive` | `#1a2738` | faint secondary tint |

Plus the tested semantic layer (`text-secondary #c5ccd9`, `text-tertiary #6b7382`,
`border-subtle rgba(120,140,170,0.10)`, `border-strong rgba(120,140,170,0.22)`, etc.) — all
cold, all AA/AAA-safe.

### 2.2 Signal colors — the ONLY color on screen

| Signal | Value | Means |
|---|---|---|
| **up** | `#16c784` | price up / long / positive PnL / pass — **invariant** |
| **down** | `#ea3943` | price down / short / negative PnL / fail — **invariant** |
| **accent** | `#f5a524` (electric amber) | **the live/active/selected object, and only that.** The "powered-up" signal. Replaces brand gold; cold-amber reads as instrumentation, not warmth. |
| **warn** | `#f0b90b` | caution / pending / catalyst risk |
| **info** | `#3aa3ff` | (sparingly) neutral reference lines, links |

> Default accent stays in the gold/amber family so the brand survives, but pushed to a
> colder, more electric amber (`#f5a524`) and used as a **scalpel**: the active pane border,
> the selected row, the live conviction number, the command caret. Never a fill, never
> decoration. The other 5 accents (emerald/teal/azure/violet/rose) remain selectable for
> users who want a different signal hue — all read correctly on the cold spine.

### 2.3 The iron rules

1. **A pixel may only be colored if it carries meaning.** Gray is the default. Color is earned.
2. **Green/red are literal and reserved** for direction/PnL/pass-fail. Never a brand color, never decorative.
3. **Exactly one accent object per view** ideally — the thing that is live/active. If everything glows, nothing does.
4. **No gradients as decoration.** The only gradients allowed: a sub-1% vignette on the field, and data-driven fills (heatmap cells, gauge bars, sparkline area).
5. **Contrast is tested, not vibes.** We do not lighten text to look "soft." The ramp is the ramp.

---

## 3. Typography — mechanical & tabular

The type *is* the instrument. Two faces, used with discipline.

- **Data / numerals — a precision mono.** Proposed: **`Geist Mono`** or keep **`JetBrains Mono`** (both excellent). Every price, %, size, score, time, ratio is mono + `tabular-nums`. This is ~70% of all text on screen. Non-negotiable.
- **Labels / UI / prose — a tight grotesk.** Proposed: **`Geist`** (precise, neutral-instrument) as the sans. Used for module titles, labels, sentences. Tracking near-zero; labels uppercase-tracked.
- **No display face, no flourish.** An institutional weapon has no hero font. The "display" moment is **big mono numbers** (the conviction score), not a typeface.

**Scale (`--text-*`, retuned tighter):**

| Token | px | Use |
|---|---|---|
| `--text-display` | 30 | the conviction score readout (mono) |
| `--text-heading` | 14 | module titles |
| `--text-subhead` | 12 | section labels |
| `--text-body` | 12 | default data/text (denser than today's 13) |
| `--text-label` | 10.5 | uppercase tracked field labels |
| `--text-caption` | 10 | dense table meta |
| `--text-micro` | 9 | tape, densest cells |

**Rules:**
- Labels: uppercase, `letter-spacing 0.09em`, `text-tertiary`, weight 600. The instrument-label convention.
- Numbers: always mono, tabular, right-aligned in columns. A price never renders in the sans.
- Titles: sentence case, weight 600, tight tracking.
- Line-height tight on data (1.2–1.35), comfortable only on prose.

---

## 4. Structure — hairlines, not boxes

The signature is **the grid drawn in 1px hairlines**, not floating cards. The screen is a
single dense instrument divided by lines, like a spreadsheet engineered by an architect.

### 4.1 The hairline system

- **Everything is bounded by 1px `edge` hairlines.** Panels, rows, columns, headers — divided by lines, not gaps + shadows. This is the core look.
- **Near-zero radius.** `--radius-sm: 2px`, `--radius-md: 4px`, `--radius-lg: 6px`. Sharp, machined corners. No soft cards. (Glass-era 10–14px radii are gone.)
- **Gaps are tiny.** `--space-gap: 1px` between panes (a hairline of void), so panes read as one continuous instrument, not scattered cards. Internal padding is tight and consistent (`--space-card` 8/10/12 by density).
- **No drop shadows as the primary depth cue.** Depth comes from *value* (panel vs panel2) and the hairline, not floating shadows. Shadows are reserved for true overlays (Tier-3 float only).

### 4.2 Three structural layers (not "glass tiers")

| Layer | Treatment | Used for |
|---|---|---|
| **Base** | `panel` fill, `edge` hairline border | every data panel, the default surface |
| **Header / chrome** | `panel2` fill, bottom `edge` hairline | module headers, ticker, command bar, fn-deck, sidebar, status bar |
| **Float** | `panel2` @ high opacity + `blur(20px)` + 1px `border-strong` + `shadow-lg` | ONLY command palette, dropdowns, modals, tooltips. This is the only place blur/shadow appears — so when it does, it means "this floats above the instrument." |

Glass is now a **single, rare, functional layer** (overlays only), exactly as you wanted —
it's structure, not personality.

### 4.3 The active object

The one live/active pane or row gets:
- A **1px `accent` border** (not a glow-bomb — a precise lit edge) + a subtle `accent` left-rail tick.
- Optionally a *very* faint accent wash on its header (`accent` @ 6%).
That's it. Restraint is what makes it read as expensive.

---

## 5. Density — the product is data-per-pixel

Three density tiers stay (compact/cozy/comfortable). For an institutional weapon, **compact
is the hero** and the design is tuned so compact is genuinely usable, not cramped.

- Row height: compact **20px**, cozy 24px, comfortable 28px. (Today's 22/26/30 → tighter.)
- Data tables are virtualized, right-aligned numerics, hairline row separators, hover = `panel2`, selected row = `accent` left tick + faint wash.
- A dense screen should comfortably show **hundreds of live cells** without feeling busy — because the monochrome discipline keeps color noise at zero.
- `cozy` stays the locked default (test constraint) but the whole system is designed so a user drops to compact and it looks *more* expensive, not worse.

---

## 6. Motion — mechanical, minimal, meaningful

An instrument doesn't bounce. It **ticks, flashes, and settles.**

| Motion | Spec | Where |
|---|---|---|
| Chrome transition | 120ms linear-ish (`cubic-bezier(0.2,0.6,0.2,1)`) | hover/active tint |
| Value tick | 1-frame up/down flash (cell briefly tints up/down), decays over 300ms | every live number on change — the heartbeat |
| Pane/row enter | 140ms fade only (no rise, no scale) | mounts |
| Float in | 120ms fade + 1% scale | overlays only |
| Accent settle | active border fades in 180ms | selecting a pane/row |

The **value-tick flash** is the one signature: a wall of numbers where cells flicker
green/red as they update reads as *alive and institutional* — like a real trading floor.
Everything respects the `reduce-motion` kill-switch (already wired).

---

## 7. The shell — a cockpit, not a website

Architecture stays (it's right). Restyle each strip to read as one continuous instrument
separated by hairlines.

- **Ticker tape** — `panel2`, micro mono, prices flash on tick, `LIVE` dot. A real tape.
- **Command bar** — the weapon's trigger. Mono, accent caret, function-code parsing. This is the most important UI element; it should feel like a Bloomberg command line that actually works. Big, confident, always focused.
- **Function-key deck** — F1–F10 as flat hairline-separated cells; active key = accent underline + accent text. No glow.
- **Sidebar** — hairline-divided nav; active item = accent left tick + `panel2` fill + accent text. Group labels uppercase tracked. Collapsible to icons.
- **Workspace** — panes separated by 1px void, each a Base surface, active pane gets the accent edge. The whole grid reads as one console.
- **Status bar** — feed dot, FX session ticks (lit when open), UTC/local clocks, all mono. Pure instrumentation.
- **Field (backdrop)** — NOT an aurora. A near-black void with an almost-invisible hairline grid (`edge` @ ~8%) and a faint top-down vignette. The grid says "engineered surface"; it never competes with data.

---

## 8. Components — cascade order

1. **`SectionCard` → hairline panel** (`panel`/`edge`, ~2px radius, tight header). Cascades to every data panel. Biggest win.
2. **`ModuleHeader` → instrument header** (`panel2`, bottom hairline, accent left-tick, uppercase tracked title + live badge). Cascades to every module.
3. **`DataTable`** → the crown component. Virtualized, mono right-aligned numerics, hairline rows, tick-flash on live cells, accent selected-row. Most of the app is tables; this one component carries the look.
4. **Shell chrome** → the cockpit strips.
5. **Conviction flagship** → the proof screen (§9).
6. **Float layer** (palette/dropdowns) → the one blur/shadow surface.

**Token hygiene:** normalize edited code on the semantic tokens (`border-subtle`, `text-tertiary`, etc.); migrate per-file as we touch, no big-bang.

---

## 9. The proof screen — Conviction as a weapon

The screenshot that sells it. A single Conviction read rendered as instrumentation:

- **Left rail:** the score as a huge mono readout (`82`, 30px+, ice-white with a thin accent ring), grade chip, bias — surgical, no decoration.
- **Center:** the **confluence matrix** — a dense hairline table of every factor, signed points right-aligned mono, pass/fail in green/red ticks. This is the data-theater hero: a wall of reasoning.
- **Right:** the trade plan as a 4-cell hairline readout (entry/stop/target/R:R), plus live context (funding, skew, OI) as mono rows.
- **Around it:** the tape flashing, the active pane wearing the accent edge.

If that screen looks like a hedge-fund weapon — dense, cold, precise, alive — the system
works and we cascade it. If it looks soft or decorative, we tighten before spreading.

---

## 10. Anti-slop checklist (institutional edition)

- ❌ Soft glass cards / heavy blur everywhere → ✅ hairline panels, blur only on float overlays.
- ❌ Warm cozy gold, gradients, glow-bombs → ✅ cold monochrome, electric accent as a scalpel.
- ❌ Big gaps + floating cards (SaaS dashboard) → ✅ 1px hairline grid, one continuous instrument.
- ❌ Rounded 12px corners → ✅ 2–4px machined corners.
- ❌ Color used decoratively → ✅ color is information, gray is default.
- ❌ Sparse, "breathable," low-density → ✅ dense, every pixel earns its place.
- ❌ Bouncy/springy motion → ✅ tick, flash, settle.
- ❌ Generic Inter for numbers → ✅ mono tabular everywhere.

---

_Design system v2 (institutional weapon). Source of truth for the UI redesign. The v1
glassmorphic direction is superseded. Implementation guardrails live in `BONDA1.md` §18._
