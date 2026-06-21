/**
 * Prembroke ICT / SMC / SMT knowledge base. Powers the Playbook encyclopedia
 * AND the Mentor AI (relevant entries are injected into the prompt). Educational
 * reference — not financial advice.
 */
export type ConceptCategory =
  | 'Market structure'
  | 'Liquidity'
  | 'Imbalance'
  | 'Zones'
  | 'Premium / discount'
  | 'Time & sessions'
  | 'Cross-asset'
  | 'Models'
  | 'Risk & psychology'

export interface Concept {
  id: string
  name: string
  abbrev?: string
  category: ConceptCategory
  summary: string
  howToTrade: string
  related: string[]
}

export const CONCEPTS: Concept[] = [
  // ── Market structure ─────────────────────────────────────────────
  {
    id: 'market-structure',
    name: 'Market structure',
    category: 'Market structure',
    summary:
      'The sequence of swing highs and lows that defines trend: higher highs & higher lows (bullish), lower highs & lower lows (bearish), or ranging. Everything in SMC is read relative to structure.',
    howToTrade:
      'Map valid swing points first. Trade with the prevailing structure: in an uptrend, look for longs at discount after a higher low forms; flip on a confirmed change of character.',
    related: ['bos', 'choch', 'mss', 'swing-points']
  },
  {
    id: 'swing-points',
    name: 'Swing highs & lows',
    category: 'Market structure',
    summary:
      'A swing high is a candle whose high is higher than the candles on both sides (and vice-versa for a swing low). They are the anchors for structure, liquidity and fibs.',
    howToTrade:
      'Use a consistent fractal (e.g. 3- or 5-bar) so your structure is objective. Prembroke auto-labels swings on the SMC chart.',
    related: ['market-structure', 'liquidity']
  },
  {
    id: 'bos',
    name: 'Break of Structure',
    abbrev: 'BOS',
    category: 'Market structure',
    summary:
      'A continuation signal: price breaks and closes beyond the most recent swing in the direction of the trend (breaks a prior high in an uptrend).',
    howToTrade:
      'A BOS confirms trend continuation. After a BOS, wait for a pullback into an order block or FVG in the direction of the break, ideally at discount/premium.',
    related: ['choch', 'mss', 'order-block', 'fvg']
  },
  {
    id: 'choch',
    name: 'Change of Character',
    abbrev: 'CHoCH',
    category: 'Market structure',
    summary:
      'The first break against the prevailing leg — an early reversal warning. In an uptrend, price breaking the most recent higher low is a bearish CHoCH.',
    howToTrade:
      'CHoCH = potential trend shift. It is the earliest structure-based reversal cue; confirm with displacement and a fresh FVG/order block before committing.',
    related: ['bos', 'mss', 'displacement']
  },
  {
    id: 'mss',
    name: 'Market Structure Shift',
    abbrev: 'MSS',
    category: 'Market structure',
    summary:
      'A decisive break of structure accompanied by displacement (an impulsive candle), signalling a genuine shift in order flow rather than a minor pullback.',
    howToTrade:
      'An MSS with a fair-value gap is the textbook reversal entry trigger: enter on the retrace into the FVG created by the shift.',
    related: ['choch', 'displacement', 'fvg']
  },
  {
    id: 'displacement',
    name: 'Displacement',
    category: 'Market structure',
    summary:
      'A strong, impulsive move (large-bodied candles) that signals institutional intent. Usually leaves a fair-value gap behind it.',
    howToTrade:
      'Displacement validates a structure break. The FVG inside the displacement leg is the highest-probability entry zone. Prembroke flags displacement > 1.8× ATR.',
    related: ['mss', 'fvg', 'order-block']
  },

  // ── Liquidity ────────────────────────────────────────────────────
  {
    id: 'liquidity',
    name: 'Liquidity',
    category: 'Liquidity',
    summary:
      'Resting orders (mostly stops) that price is drawn toward. Buy-side liquidity (BSL) sits above highs; sell-side liquidity (SSL) sits below lows. Markets move from one pool to the next.',
    howToTrade:
      'Identify the obvious pools (equal highs/lows, old highs/lows). Expect price to seek them. Trade the reaction after a pool is taken, not before.',
    related: ['bsl-ssl', 'liquidity-sweep', 'equal-highs-lows', 'draw-on-liquidity']
  },
  {
    id: 'bsl-ssl',
    name: 'Buy-side / Sell-side liquidity',
    abbrev: 'BSL / SSL',
    category: 'Liquidity',
    summary:
      'BSL = stop orders resting above swing highs (shorts’ stops, breakout buys). SSL = stops below swing lows. Smart money targets these to fill size.',
    howToTrade:
      'Mark BSL above and SSL below. A run into BSL then rejection is a short setup; a run into SSL then reclaim is a long setup.',
    related: ['liquidity', 'liquidity-sweep', 'draw-on-liquidity']
  },
  {
    id: 'liquidity-sweep',
    name: 'Liquidity sweep / stop hunt',
    category: 'Liquidity',
    summary:
      'Price spikes beyond a high/low to grab resting liquidity, then sharply reverses (a failed breakout). The engine of most reversals.',
    howToTrade:
      'Wait for the sweep + reclaim (close back inside). Enter on the reclaim with stop beyond the wick. Prembroke scores a recent sweep heavily.',
    related: ['liquidity', 'turtle-soup', 'judas-swing']
  },
  {
    id: 'equal-highs-lows',
    name: 'Equal highs / lows',
    abbrev: 'EQH / EQL',
    category: 'Liquidity',
    summary:
      'Two or more highs (or lows) at nearly the same price. They look like support/resistance to retail, which makes them magnets for liquidity.',
    howToTrade:
      'Treat equal highs as a draw on liquidity above (and equal lows below). Expect them to be swept before a real move.',
    related: ['liquidity', 'liquidity-sweep', 'inducement']
  },
  {
    id: 'inducement',
    name: 'Inducement',
    abbrev: 'IDM',
    category: 'Liquidity',
    summary:
      'A minor pool of liquidity that lures traders in before the real order block / point of interest, ensuring smart money has counterparties.',
    howToTrade:
      'Expect the obvious entry to be inducement. The valid order block is usually the one after the inducement is swept.',
    related: ['liquidity', 'order-block', 'liquidity-sweep']
  },
  {
    id: 'draw-on-liquidity',
    name: 'Draw on liquidity',
    abbrev: 'DOL',
    category: 'Liquidity',
    summary:
      'The liquidity pool price is most likely targeting next — the magnet that gives a trade its objective.',
    howToTrade:
      'Set your target at the draw on liquidity, not an arbitrary R multiple. Prembroke auto-targets the nearest opposing pool in the trade plan.',
    related: ['liquidity', 'bsl-ssl', 'equal-highs-lows']
  },
  {
    id: 'liquidity-void',
    name: 'Liquidity void',
    category: 'Liquidity',
    summary:
      'A price range crossed in a single impulsive move with little trading — a gap in delivery. Price often returns to rebalance it.',
    howToTrade:
      'Anticipate a retrace back through the void. Large voids act as targets; the FVG within is the entry.',
    related: ['fvg', 'displacement', 'imbalance']
  },

  // ── Imbalance ────────────────────────────────────────────────────
  {
    id: 'fvg',
    name: 'Fair Value Gap',
    abbrev: 'FVG',
    category: 'Imbalance',
    summary:
      'A 3-candle imbalance where the 1st and 3rd candles don’t overlap, leaving an inefficiency. Price tends to return to rebalance it.',
    howToTrade:
      'Enter on the retrace into an FVG aligned with your bias (bullish FVG in an uptrend). Stop beyond the gap. The 50% of the gap (consequent encroachment) is a refined entry.',
    related: ['imbalance', 'displacement', 'bpr', 'liquidity-void']
  },
  {
    id: 'imbalance',
    name: 'Imbalance',
    category: 'Imbalance',
    summary:
      'Any inefficiency between buy and sell delivery — FVGs, volume imbalances and voids. Markets seek to rebalance inefficiency over time.',
    howToTrade:
      'Use unfilled imbalances as targets and entries. Aligned imbalance + structure is a high-probability confluence.',
    related: ['fvg', 'bpr', 'liquidity-void']
  },
  {
    id: 'bpr',
    name: 'Balanced Price Range',
    abbrev: 'BPR',
    category: 'Imbalance',
    summary:
      'Where a bullish FVG and a bearish FVG overlap, creating a strong reaction zone (two imbalances in opposite directions at the same price).',
    howToTrade:
      'BPRs are potent reversal POIs. Treat the overlap as a single high-probability zone for entries.',
    related: ['fvg', 'imbalance', 'unicorn']
  },

  // ── Zones / POIs ─────────────────────────────────────────────────
  {
    id: 'order-block',
    name: 'Order block',
    abbrev: 'OB',
    category: 'Zones',
    summary:
      'The last opposing candle before a displacement that breaks structure — a footprint of institutional orders. Bullish OB = last down candle before a strong up-move.',
    howToTrade:
      'Enter on the retrace into an aligned, unmitigated order block. Best when it sits at discount (longs) and created the BOS. Stop below the OB low.',
    related: ['breaker-block', 'mitigation-block', 'displacement', 'bos']
  },
  {
    id: 'breaker-block',
    name: 'Breaker block',
    category: 'Zones',
    summary:
      'A failed order block that price breaks through, then returns to and respects from the other side — a flipped zone (support→resistance or vice-versa).',
    howToTrade:
      'After an OB fails and structure shifts, trade the retest of that broken block in the new direction. Breaker + FVG overlap is the "unicorn".',
    related: ['order-block', 'unicorn', 'mitigation-block']
  },
  {
    id: 'mitigation-block',
    name: 'Mitigation block',
    category: 'Zones',
    summary:
      'An order block formed where price returns to "mitigate" (offset) a prior unfilled position before continuing — similar to a breaker but without taking liquidity first.',
    howToTrade:
      'Use the mitigation block as a continuation entry after a pullback in trend.',
    related: ['order-block', 'breaker-block']
  },
  {
    id: 'rejection-block',
    name: 'Rejection block',
    category: 'Zones',
    summary:
      'A zone defined by long candle wicks (rejection) rather than bodies — where price was sharply refused. Marks aggressive supply/demand.',
    howToTrade:
      'Treat the wick zone as resistance/support; fade tests of it in line with structure.',
    related: ['order-block', 'supply-demand']
  },
  {
    id: 'supply-demand',
    name: 'Supply & demand zones',
    category: 'Zones',
    summary:
      'Areas where price previously moved away sharply, implying resting institutional interest. The classical cousin of order blocks.',
    howToTrade:
      'Mark fresh, unmitigated zones from strong moves. Trade the first retest with confluence from structure and liquidity.',
    related: ['order-block', 'rejection-block']
  },

  // ── Premium / discount ───────────────────────────────────────────
  {
    id: 'premium-discount',
    name: 'Premium & discount',
    category: 'Premium / discount',
    summary:
      'Split a dealing range at its 50% (equilibrium). Above 50% is premium (expensive — sell zone), below is discount (cheap — buy zone).',
    howToTrade:
      'Buy in discount, sell in premium. Avoid longs in premium even with a bullish bias. Prembroke shades the range and scores location.',
    related: ['equilibrium', 'ote', 'fibonacci']
  },
  {
    id: 'equilibrium',
    name: 'Equilibrium',
    category: 'Premium / discount',
    summary: 'The 50% of the current dealing range — the fair price that separates premium from discount.',
    howToTrade: 'Use equilibrium as a decision line and as a minimum target for retracements.',
    related: ['premium-discount', 'ote']
  },
  {
    id: 'ote',
    name: 'Optimal Trade Entry',
    abbrev: 'OTE',
    category: 'Premium / discount',
    summary:
      'The 0.62–0.79 retracement of an impulse leg (a deep discount/premium zone). The highest-probability pullback entry in ICT.',
    howToTrade:
      'Draw a fib on the impulse; enter in the 0.62–0.79 band aligned with structure, ideally where it overlaps an order block or FVG.',
    related: ['fibonacci', 'premium-discount', 'order-block']
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci (ICT usage)',
    category: 'Premium / discount',
    summary:
      'ICT uses fibs to define equilibrium (0.5), the OTE (0.62–0.79) and projections/targets (-0.27, -0.62 standard deviations).',
    howToTrade:
      'Anchor the fib low-to-high (or high-to-low) of the dealing range. Entries in OTE, targets at the negative extensions where liquidity rests.',
    related: ['ote', 'premium-discount', 'draw-on-liquidity']
  },

  // ── Time & sessions ──────────────────────────────────────────────
  {
    id: 'killzones',
    name: 'ICT Killzones',
    category: 'Time & sessions',
    summary:
      'High-probability windows: London (07–10 UTC), New York AM (12–15), NY PM (18–20), and the Asian range. Most A+ setups form inside killzones.',
    howToTrade:
      'Focus execution inside killzones; outside them, expectancy drops. Prembroke scores killzone timing.',
    related: ['silver-bullet', 'judas-swing', 'power-of-three']
  },
  {
    id: 'silver-bullet',
    name: 'Silver Bullet',
    category: 'Time & sessions',
    summary:
      'A specific 1-hour window (e.g. 10–11 ET) where ICT looks for a quick FVG-based continuation after the session’s manipulation.',
    howToTrade:
      'In the window, take the first FVG that forms after a liquidity grab in the direction of the daily bias.',
    related: ['killzones', 'fvg', 'judas-swing']
  },
  {
    id: 'judas-swing',
    name: 'Judas swing',
    category: 'Time & sessions',
    summary:
      'A false move at the session open that grabs liquidity in the wrong direction before the real move — the "manipulation" phase.',
    howToTrade:
      'Fade the Judas swing once it sweeps liquidity and shifts structure back toward the daily bias.',
    related: ['power-of-three', 'liquidity-sweep', 'killzones']
  },
  {
    id: 'power-of-three',
    name: 'Power of Three (AMD)',
    abbrev: 'AMD',
    category: 'Time & sessions',
    summary:
      'The daily cycle: Accumulation (range), Manipulation (Judas swing that grabs liquidity), Distribution (the real expansion). Opens often near the day’s extreme.',
    howToTrade:
      'Expect manipulation against bias early, then trade the distribution leg in the direction of the daily bias.',
    related: ['judas-swing', 'killzones', 'daily-bias']
  },
  {
    id: 'daily-bias',
    name: 'Daily / weekly bias',
    category: 'Time & sessions',
    summary:
      'A directional expectation for the day/week from HTF structure, draw on liquidity and PD arrays. Everything intraday is filtered through it.',
    howToTrade:
      'Set bias from the daily: which liquidity is likely targeted next? Only take intraday setups aligned with it. Prembroke’s MTF panel approximates this.',
    related: ['power-of-three', 'draw-on-liquidity', 'market-structure']
  },
  {
    id: 'ipda',
    name: 'IPDA / dealing ranges',
    category: 'Time & sessions',
    summary:
      'Interbank Price Delivery Algorithm — ICT’s model that price is delivered algorithmically across look-back ranges (20/40/60 days) between liquidity and imbalance.',
    howToTrade:
      'Use recent dealing ranges to define premium/discount and the next likely draw on liquidity.',
    related: ['premium-discount', 'draw-on-liquidity']
  },

  // ── Cross-asset ──────────────────────────────────────────────────
  {
    id: 'smt-divergence',
    name: 'SMT Divergence',
    abbrev: 'SMT',
    category: 'Cross-asset',
    summary:
      'Smart Money Technique: when two correlated assets disagree — one makes a higher high while the other fails to — revealing a liquidity grab and likely reversal. Classic pairs: BTC/ETH, ES/NQ, EURUSD/GBPUSD.',
    howToTrade:
      'At a key level, if BTC sweeps a high but ETH does not (bearish SMT), favour shorts. Prembroke computes BTC↔ETH SMT and scores it.',
    related: ['liquidity-sweep', 'correlation', 'market-structure']
  },
  {
    id: 'correlation',
    name: 'Correlation & DXY',
    category: 'Cross-asset',
    summary:
      'Related markets move together or inversely (BTC↔ETH positive; USD pairs vs DXY inverse). Divergences flag manipulation; alignment confirms risk-on/off.',
    howToTrade:
      'Confirm trades with correlated assets. Trade against the crowd when correlation breaks at a liquidity level (SMT).',
    related: ['smt-divergence']
  },

  // ── Models ───────────────────────────────────────────────────────
  {
    id: 'unicorn',
    name: 'Unicorn model',
    category: 'Models',
    summary:
      'A breaker block that overlaps a fair-value gap — two POIs at one price for an extra-high-probability entry.',
    howToTrade:
      'Find a breaker + FVG overlap after an MSS; enter the overlap with stop beyond the breaker.',
    related: ['breaker-block', 'fvg', 'bpr']
  },
  {
    id: '2022-model',
    name: 'ICT 2022 model',
    category: 'Models',
    summary:
      'A complete entry model: liquidity sweep → market structure shift with displacement → return to the FVG left by the shift → target opposing liquidity.',
    howToTrade:
      'Sequence: take sweep, confirm MSS+displacement, enter the FVG, target the next draw on liquidity. This is the backbone of Prembroke’s scoring.',
    related: ['liquidity-sweep', 'mss', 'fvg', 'draw-on-liquidity']
  },
  {
    id: 'turtle-soup',
    name: 'Turtle Soup',
    category: 'Models',
    summary:
      'A false-breakout reversal: price breaks a prior high/low (taking liquidity) then closes back inside, trapping breakout traders.',
    howToTrade:
      'Enter on the reclaim after the failed breakout, stop beyond the sweep, target the opposite side of the range.',
    related: ['liquidity-sweep', 'judas-swing']
  },
  {
    id: 'asian-range',
    name: 'Asian range',
    category: 'Models',
    summary:
      'The consolidation during the Asian session whose high/low seed the liquidity that London/NY then raid.',
    howToTrade:
      'Mark the Asian high/low; expect London to sweep one side (Judas) before the real move toward the daily bias.',
    related: ['judas-swing', 'power-of-three', 'killzones']
  },

  // ── Risk ─────────────────────────────────────────────────────────
  {
    id: 'r-multiple',
    name: 'R multiple & expectancy',
    category: 'Risk & psychology',
    summary:
      'R = reward relative to the risk on a trade (1R = your risk). Expectancy = avg R per trade; a positive-expectancy edge compounds even below 50% win-rate.',
    howToTrade:
      'Risk a fixed % per trade, target ≥ 2R toward real liquidity. Prembroke’s journal tracks your expectancy by setup grade.',
    related: ['risk-management', 'draw-on-liquidity']
  },
  {
    id: 'risk-management',
    name: 'Risk management',
    category: 'Risk & psychology',
    summary:
      'Position sizing, max daily loss, and correlation control. The discipline that keeps you in the game long enough for your edge to play out.',
    howToTrade:
      'Risk 0.5–1% per idea, cap daily drawdown, avoid stacking correlated trades. Use Prembroke’s position-size and alert tools.',
    related: ['r-multiple']
  }
]

const STOP = new Set([
  'the','a','an','of','to','in','is','it','and','or','for','on','at','how','do','i','what','when',
  'should','my','me','with','this','that','price','trade','trading','about','explain','tell'
])

/** Lightweight keyword retrieval: returns the best-matching concepts for a query. */
export function findConcepts(query: string, max = 3): Concept[] {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
  if (terms.length === 0) return []
  const scored = CONCEPTS.map((c) => {
    const hay = `${c.name} ${c.abbrev ?? ''} ${c.category} ${c.summary} ${c.howToTrade}`.toLowerCase()
    let score = 0
    for (const t of terms) {
      if ((c.abbrev ?? '').toLowerCase() === t) score += 6
      if (c.name.toLowerCase().includes(t)) score += 4
      if (hay.includes(t)) score += 1
    }
    return { c, score }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.c)
}

export const CATEGORIES: ConceptCategory[] = [
  'Market structure',
  'Liquidity',
  'Imbalance',
  'Zones',
  'Premium / discount',
  'Time & sessions',
  'Cross-asset',
  'Models',
  'Risk & psychology'
]
