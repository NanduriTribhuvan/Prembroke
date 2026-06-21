# `src/shared` — TDX Terminal domain layer

Pure TypeScript. No external runtime dependencies. Strict mode, no `any`. Every
public function is a named export with JSDoc. Deterministic and side-effect free.
Edge cases (empty arrays, divide-by-zero, invalid input) return `NaN` / empty
arrays as documented. Indicator outputs are index-aligned with their input and
NaN-padded at the start. Import via the `@shared` alias (e.g. `@shared/calc`).

Run tests: `npm test` (vitest). Current suite: 52 tests, all green.

## calc/ — trading calculators

**position-size.ts**
- `positionSizeCrypto(accountBalance, riskPct, entry, stop)` — crypto linear-contract size; returns `{ riskAmount, stopDistance, qty, notional }`.
- `positionSizeForex(accountBalance, riskPct, pair, pipStop, conversionRate)` — forex size; returns lots (standard/mini/micro), units and pip value.

**pip.ts**
- `pipSize(pair)` — pip increment (`0.01` JPY/metals, `0.0001` otherwise).
- `pipValue(pair, lots, conversionRate)` — pip value in account currency.
- `lotsToUnits(lots, contractSize?)` / `unitsToLots(units, contractSize?)` — lot↔unit conversion.
- Constants: `STANDARD_LOT_UNITS`, `MINI_LOT_UNITS`, `MICRO_LOT_UNITS`.

**risk-reward.ts**
- `rMultiple(entry, stop, target)` — reward-to-risk multiple.
- `breakevenWinRate(rr)` — break-even win rate as a fraction.
- `expectancy(winRate, avgWin, avgLoss)` — expected value per trade.
- `profitFactor(grossWin, grossLoss)` — gross profit / gross loss.

**margin.ts**
- `requiredMargin(notional, leverage)` — margin to open a position.
- `liquidationPrice(entry, leverage, side, maintenanceMarginRate?)` — isolated liquidation estimate.
- `effectiveLeverage(notional, equity)` — leverage relative to equity.

**compound.ts**
- `compoundProjection(start, pctPerPeriod, periods, contributionPerPeriod?)` — full period-by-period series.
- `drawdownRecovery(drawdownPct)` — gain % needed to recover a drawdown.

**kelly.ts**
- `kellyFraction(winRate, winLossRatio)` — optimal Kelly stake fraction.
- `fractionalKelly(fullKelly, fraction)` — scaled (e.g. half-) Kelly.

**pnl.ts**
- `tradePnl(entry, exit, qty, side, feePct?, margin?)` — gross/net P&L, fees and ROI.
- `breakevenPrice(entry, side, feePct?)` — fee-aware breakeven exit price.

**fibonacci.ts**
- `fibRetracementLevels(high, low)` — retracement levels (0…1 of the swing).
- `fibExtensionLevels(high, low)` — extension/projection levels above the high.
- Constants: `RETRACEMENT_RATIOS`, `EXTENSION_RATIOS`.

**dca.ts**
- `averageEntry(fills)` — volume-weighted average entry across scale-in fills.

## indicators/ — technical analysis over candle/number arrays

**types.ts** — `Candle`, `MACDResult`, `BollingerResult`, `StochasticResult`, `DonchianResult`, `SupertrendResult`.

**moving-averages.ts** — `sma(values, period)`, `ema(values, period)`, `wma(values, period)`.

**oscillators.ts** — `rsi(values, period?)` (Wilder), `macd(values, fast?, slow?, signal?)`, `stochastic(candles, kPeriod?, dPeriod?)`.

**volatility.ts** — `bollinger(values, period?, mult?)`, `atr(candles, period?)` (Wilder), `donchian(candles, period?)`, `supertrend(candles, period?, multiplier?)`.

**volume.ts** — `vwap(candles)` (session), `obv(candles)`.

**pivots.ts** — `classicPivots(prior)`, `fibonacciPivots(prior)`, `camarillaPivots(prior)`, `woodiePivots(prior)`; types `PriorOHLC`, `PivotLevels`, `CamarillaLevels`.

## markets/

**sessions.ts** — `SESSIONS`; `isSessionOpen(session, date)`, `activeSessions(date)`, `nextSessionEvent(date)`, `sessionOverlaps(date)`. Fixed UTC windows; DST/weekends approximated.

**currency-strength.ts** — `computeCurrencyStrength(pairs)` → per-currency score `[-10, 10]`; `MAJOR_CURRENCIES`.

**symbols.ts** — `ALL_SYMBOLS`, `CRYPTO_SYMBOLS` (top-50 snapshot), `FOREX_SYMBOLS` (28 pairs), `METAL_SYMBOLS`, `INDEX_SYMBOLS`; `bySymbolId(id)`, `searchSymbols(query)`; type `SymbolInfo`.

## config/ — registries

**feeds.ts** — `FEEDS` (crypto/forex/macro RSS), `feedsByCategory(category)`.

**channels.ts** — `CHANNELS` (CNBC, Bloomberg TV, Yahoo Finance, Bloomberg Originals via YouTube `live_stream` embeds), `channelById(id)`.

**x-accounts.ts** — `X_ACCOUNTS` (curated handles by category), `X_CATEGORIES`, `accountsByCategory(category)`. Embed-only; no X API.

## index.ts
Barrel re-export of `calc`, `indicators`, `markets`, `config`.
