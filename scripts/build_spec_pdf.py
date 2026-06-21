# -*- coding: utf-8 -*-
"""Generate the TDX Terminal — Conviction Terminal product spec PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, ListFlowable, ListItem, KeepTogether,
)
from reportlab.pdfgen import canvas as canvaslib

# ---------------------------------------------------------------- palette
BG      = colors.HexColor("#0B0E11")  # terminal black
PANEL   = colors.HexColor("#13181D")
EDGE    = colors.HexColor("#222A31")
ACCENT  = colors.HexColor("#16C784")  # up green
ACCENT2 = colors.HexColor("#2FD9C5")  # teal
RED     = colors.HexColor("#EA3943")
WARN    = colors.HexColor("#F0B90B")
INK     = colors.HexColor("#15191E")
MUTED   = colors.HexColor("#6B7785")
LIGHT   = colors.HexColor("#F4F6F8")
LIGHT2  = colors.HexColor("#E9EEF2")
WHITE   = colors.white

OUT = r"C:\Users\TILAK CHILLARA\OneDrive\Desktop\Trading-DEX\TDX-Terminal-Conviction-Spec.pdf"

# ---------------------------------------------------------------- styles
ss = getSampleStyleSheet()
def st(name, **kw):
    base = kw.pop("parent", ss["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

H1   = st("H1", fontName="Helvetica-Bold", fontSize=18, textColor=INK, spaceBefore=2, spaceAfter=6, leading=22)
KICK = st("KICK", fontName="Helvetica-Bold", fontSize=9, textColor=ACCENT, spaceAfter=2, tracking=1)
H2   = st("H2", fontName="Helvetica-Bold", fontSize=12.5, textColor=INK, spaceBefore=10, spaceAfter=4, leading=15)
BODY = st("BODY", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=14, spaceAfter=4)
BODYM= st("BODYM", fontName="Helvetica", fontSize=9, textColor=MUTED, leading=13, spaceAfter=3)
LEDE = st("LEDE", fontName="Helvetica", fontSize=10.5, textColor=INK, leading=16, spaceAfter=6)
BULL = st("BULL", fontName="Helvetica", fontSize=9.3, textColor=INK, leading=13.5)
CELLH= st("CELLH", fontName="Helvetica-Bold", fontSize=8.5, textColor=WHITE, leading=11)
CELL = st("CELL", fontName="Helvetica", fontSize=8.6, textColor=INK, leading=11.5)
CELLB= st("CELLB", fontName="Helvetica-Bold", fontSize=8.6, textColor=INK, leading=11.5)
MONO = st("MONO", fontName="Courier", fontSize=8.2, textColor=colors.HexColor("#C8FFE6"), leading=12)
MONOH= st("MONOH", fontName="Courier-Bold", fontSize=8.6, textColor=ACCENT2, leading=12)
QUOTE= st("QUOTE", fontName="Helvetica-Oblique", fontSize=11, textColor=INK, leading=16)

def P(t, s=BODY): return Paragraph(t, s)

# ---------------------------------------------------------------- helpers
def chip_table(rows, col_widths, header=True):
    ts = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LINEBELOW", (0,0), (-1,-2), 0.4, LIGHT2),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 7),
        ("RIGHTPADDING", (0,0), (-1,-1), 7),
    ]
    if header:
        ts += [("BACKGROUND", (0,0), (-1,0), INK),
               ("LINEBELOW", (0,0), (-1,0), 0, INK),
               ("TOPPADDING",(0,0),(-1,0),6), ("BOTTOMPADDING",(0,0),(-1,0),6)]
        for r in range(1, len(rows)):
            if r % 2 == 0:
                ts.append(("BACKGROUND",(0,r),(-1,r), LIGHT))
    t = Table(rows, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle(ts))
    return t

def section(kicker, title):
    return KeepTogether([Paragraph(kicker.upper(), KICK), Paragraph(title, H1),
                         Spacer(1, 2),
                         Table([[ "" ]], colWidths=[170*mm], rowHeights=[2],
                               style=TableStyle([("BACKGROUND",(0,0),(-1,-1),ACCENT)])),
                         Spacer(1, 6)])

def bullets(items, style=BULL):
    return ListFlowable(
        [ListItem(Paragraph(i, style), leftIndent=6, value="•") for i in items],
        bulletType="bullet", bulletColor=ACCENT, bulletFontSize=8,
        leftIndent=10, spaceBefore=1, spaceAfter=2,
    )

def callout(title, body, accent=WARN):
    inner = [Paragraph(f'<font color="#15191E"><b>{title}</b></font>', BODY),
             Paragraph(body, BODYM)]
    t = Table([[inner]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#FFF8E6")),
        ("LINEBEFORE",(0,0),(0,-1), 3, accent),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ]))
    return t

# ---------------------------------------------------------------- page furniture
def cover(c, doc):
    c.saveState()
    w, h = A4
    c.setFillColor(BG); c.rect(0,0,w,h, fill=1, stroke=0)
    # accent bars
    c.setFillColor(ACCENT); c.rect(0, h-12*mm, w, 4, fill=1, stroke=0)
    # faux ticker row
    c.setFont("Courier", 8); c.setFillColor(MUTED)
    c.drawString(20*mm, h-20*mm, "BTC 64,210 +1.8%   ETH 3,420 +2.1%   EURUSD 1.0832 -0.1%   DXY 104.2   XAU 2,332   F&G 38")
    # title
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 40)
    c.drawString(20*mm, h-70*mm, "TDX TERMINAL")
    c.setFillColor(ACCENT2); c.setFont("Helvetica-Bold", 18)
    c.drawString(20*mm, h-82*mm, "The Conviction Terminal")
    c.setFillColor(colors.HexColor("#AEB9C4")); c.setFont("Helvetica", 12)
    c.drawString(20*mm, h-95*mm, "Product & Feature Map  ·  Technical · Fundamental · ICT / Smart Money Concepts · AI")
    # motto box
    c.setStrokeColor(EDGE); c.setLineWidth(1)
    c.roundRect(20*mm, h-150*mm, w-40*mm, 32*mm, 4, fill=0, stroke=1)
    c.setFillColor(WHITE); c.setFont("Helvetica-Oblique", 13)
    c.drawString(27*mm, h-130*mm, "“Help traders take a trade with confidence.”")
    c.setFillColor(MUTED); c.setFont("Helvetica", 9.5)
    c.drawString(27*mm, h-140*mm, "One question, answered: Should I take this trade — and how confident should I be?")
    # footer
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawString(20*mm, 15*mm, "Desktop analytics terminal for crypto & forex  ·  Not a broker · Not a wallet · Analysis only")
    c.drawRightString(w-20*mm, 15*mm, "Confidential product spec")
    c.setFillColor(ACCENT); c.rect(0, 11*mm, w, 3, fill=1, stroke=0)
    c.restoreState()

def later(c, doc):
    c.saveState()
    w, h = A4
    c.setFillColor(INK); c.rect(0, h-14*mm, w, 14*mm, fill=1, stroke=0)
    c.setFillColor(ACCENT); c.rect(0, h-14*mm, w, 1.5, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 8.5)
    c.drawString(20*mm, h-9.4*mm, "TDX TERMINAL")
    c.setFillColor(colors.HexColor("#9FB0BC")); c.setFont("Helvetica", 8)
    c.drawString(43*mm, h-9.4*mm, "— The Conviction Terminal")
    c.drawRightString(w-20*mm, h-9.4*mm, "Product & Feature Map")
    # footer
    c.setStrokeColor(LIGHT2); c.setLineWidth(0.6); c.line(20*mm, 13*mm, w-20*mm, 13*mm)
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawString(20*mm, 9*mm, "Confidential — internal product planning")
    c.drawRightString(w-20*mm, 9*mm, "Page %d" % doc.page)
    c.restoreState()

# ---------------------------------------------------------------- doc
doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=20*mm, rightMargin=20*mm,
                      topMargin=22*mm, bottomMargin=18*mm, title="TDX Terminal — Conviction Terminal Spec",
                      author="TDX")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover),
    PageTemplate(id="later", frames=[frame], onPage=later),
])

S = []
NEW = '<font color="#16C784"><b>NEW</b></font>'
def newtag(t): return f'{t} &nbsp;<font size=7 color="#16C784">● NEW</font>'

# cover page is blank frame
S.append(PageBreak())
S.append(Paragraph("later-template-anchor", st("hidden", fontSize=0.1, textColor=WHITE)))
# switch template
from reportlab.platypus import NextPageTemplate
S = [NextPageTemplate("later"), PageBreak()]

# ===== 1. The big idea
S.append(section("The thesis", "The job of this product"))
S.append(P("TradingView gives you charts. Bloomberg gives you data. <b>Nobody gives you conviction.</b> "
           "That gap is the entire opportunity. Every feature in this document earns its place by answering "
           "one trader question:", LEDE))
S.append(Spacer(1,2))
S.append(callout("Conviction = stacked confluence",
    "A real trader never enters on a single signal. They enter when multiple <i>independent</i> reasons line up at the "
    "same price and the same time — structure, liquidity, premium/discount, momentum, news, positioning. The "
    "central engine of this terminal auto-detects each reason and stacks them into one Conviction Score (0–100). "
    "Everything else in this map feeds that score.", ACCENT))
S.append(Spacer(1,6))
S.append(Paragraph("What we are / are not", H2))
S.append(chip_table([
    [Paragraph("WE ARE", CELLH), Paragraph("WE ARE NOT", CELLH)],
    [Paragraph("Analysis, data, news, conviction & risk tooling", CELL),
     Paragraph("A broker, exchange, or wallet", CELL)],
    [Paragraph("A decision-support workstation for crypto & forex", CELL),
     Paragraph("A source of “signals to copy” — it grades, it doesn’t advise", CELL)],
    [Paragraph("Desktop, dense, keyboard-driven (Electron)", CELL),
     Paragraph("A place where money moves — zero execution risk", CELL)],
], [85*mm, 85*mm]))

# ===== 2. Trader workflow (the spine of the user map)
S.append(PageBreak())
S.append(section("Use this for your user map", "The trader workflow (8 stages)"))
S.append(P("Build your user map along this top-down journey. Each stage is a screen / module, and the arrows "
           "are how a trader moves through the app from ‘what should I watch’ to ‘what did I learn’.", BODY))
wf = [
    ["1", "BIAS", "Form a directional bias", "Dashboard, HTF charts, macro / risk-on-off gauge, news, geopolitics"],
    ["2", "WATCH", "Narrow to candidates", "Screeners, watchlists, currency strength, correlation, alerts firing"],
    ["3", "READ", "Read the chart", "Charts + ICT/SMC auto-detect: structure, OB, FVG, liquidity, premium/discount"],
    ["4", "CONFLUENCE", "Stack the reasons", "Confluence Engine collects every aligned factor across TA + fundamentals"],
    ["5", "CONVICTION", "Score & grade", "Conviction Score 0–100, setup grade A+/A/B/skip"],
    ["6", "PLAN", "Build the trade plan", "Auto entry / stop / targets / R:R + position size from Toolkit"],
    ["7", "EXECUTE", "Place it (elsewhere)", "Trader executes at their broker; app logs intended trade + alerts"],
    ["8", "REVIEW", "Journal & learn", "Trade journal, edge analytics, replay — feeds back into stage 1 bias"],
]
rows = [[Paragraph("#", CELLH), Paragraph("STAGE", CELLH), Paragraph("WHAT THE TRADER DOES", CELLH), Paragraph("MODULES THAT SERVE IT", CELLH)]]
for r in wf:
    rows.append([Paragraph(f'<font color="#16C784"><b>{r[0]}</b></font>', CELL), Paragraph(f"<b>{r[1]}</b>", CELLB),
                 Paragraph(r[2], CELL), Paragraph(r[3], CELL)])
S.append(chip_table(rows, [9*mm, 30*mm, 41*mm, 90*mm]))
S.append(Spacer(1,4))
S.append(P("<font color='#6B7785'>The loop is the point: stage 8 feeds stage 1. The trader’s own stats sharpen the next bias.</font>", BODYM))

# ===== 3. Module map
S.append(PageBreak())
S.append(section("The terminal at a glance", "Module map"))
mods = [
    ["01", "Dashboard / Command Center", "Heatmaps, movers, F&G, risk-on/off gauge, AI morning brief, custom widget grid"],
    ["02", "Charts", "Multi-layout licensed charts, linked crosshair, replay mode, drawing sync"],
    ["03", "Markets / Screeners", "Watchlists, multi-filter screener, correlation matrix, relative strength"],
    ["04", "News", "RSS + aggregation, dedup/clustering, AI impact scoring, breaking alerts"],
    ["05", "Geopolitics desk", "Conflict tracker, central-bank watch, sanctions/commodity shocks, AI translation"],
    ["06", "Live TV", "CNBC/Bloomberg/Yahoo multiview + AI live-caption summariser"],
    ["07", "Social / X Pulse", "Curated X + StockTwits sentiment trend, influencer signal tracker"],
    ["08", "AI Analyst", "Market-aware chat, explain-this-move, chart-vision, natural-language alerts"],
    ["09", "Derivatives desk", "Funding, OI, long/short, liquidation heatmap, options flow, max pain"],
    ["10", "On-chain desk", "Exchange flows, whale alerts, stablecoin flows, MVRV/SOPR, token unlocks"],
    ["11", "Conviction Engine ★", "Confluence checklist → score → grade → auto trade plan (the core product)"],
    ["12", "Alerts Engine", "Structure / liquidity / zone / on-chain / NL alerts → desktop + push + email"],
    ["13", "Risk & Discipline", "Position sizer, daily-loss lockout, correlation warnings, R:R gate"],
    ["14", "Trade Journal", "Auto-screenshot, tagging, edge analytics, replay & review"],
    ["15", "Toolkit", "Position size, pip, R:R, margin/liq, compounding, Kelly, session clock (built)"],
    ["16", "Economic Calendar", "Events + countdowns + surprise index + AI impact notes"],
]
rows = [[Paragraph("#", CELLH), Paragraph("MODULE", CELLH), Paragraph("WHAT IT DELIVERS", CELLH)]]
for r in mods:
    rows.append([Paragraph(f'<font color="#16C784">{r[0]}</font>', CELL), Paragraph(f"<b>{r[1]}</b>", CELLB), Paragraph(r[2], CELL)])
S.append(chip_table(rows, [9*mm, 48*mm, 113*mm]))

# ===== 4. ICT / SMC flagship
S.append(PageBreak())
S.append(section("The flagship — your edge", "ICT / Smart Money Concepts toolkit"))
S.append(P("This is what makes TDX <i>not</i> just another charting app. Auto-detect and draw every concept below, "
           "each one a switchable layer that also feeds the Conviction Engine.", BODY))
def grp(title, items):
    S.append(Paragraph(title, H2))
    S.append(bullets(items))
grp("Market structure", [
    "<b>BOS</b> (Break of Structure), <b>CHoCH</b> (Change of Character), <b>MSS</b> (Market Structure Shift)",
    "Auto swing high/low labelling; internal vs external structure",
    "Multi-timeframe structure: HTF bias drives LTF entry",
])
grp("Zones &amp; imbalances", [
    "Order Blocks (bullish/bearish), Breaker Blocks, Mitigation Blocks",
    "Fair Value Gaps (FVG) / imbalances, BPR (balanced price range), liquidity voids",
    "‘Unicorn’ model: Breaker + FVG overlap",
])
grp("Liquidity — the heart of ICT", [
    "Buy-side / sell-side liquidity (BSL/SSL) auto-marked",
    "Equal highs/lows (EQH/EQL), liquidity pools, trendline liquidity",
    "<b>Liquidity sweep / stop-hunt detection</b> (a flagship alert)",
    "Inducement, internal vs external liquidity, draw-on-liquidity targets",
])
grp("Premium / discount &amp; time", [
    "Auto dealing-range with 50% equilibrium; premium/discount shading",
    "OTE zone (Optimal Trade Entry, 0.62–0.79)",
    "Killzones (London / NY AM / NY PM / Asia), Silver Bullet windows, Judas Swing",
    "Power of 3 / AMD (Accumulation–Manipulation–Distribution) daily model",
])
grp("Cross-asset confirmation (rare — a real differentiator)", [
    "<b>SMT Divergence</b> across correlated pairs (BTC/ETH, EURUSD/GBPUSD, ES/NQ)",
])
S.append(Spacer(1,4))
S.append(callout("Build discipline note",
    "ICT/SMC definitions are partly subjective. Ship clean, defensible logic for a few concepts done right "
    "(structure + FVG + liquidity sweep) before chasing 30 sloppy ones. Quality of detection is the trust you’re selling.",
    RED))

# ===== 5. Technical + Fundamental
S.append(PageBreak())
S.append(section("Supporting analysis", "Classic technical toolkit"))
S.append(bullets([
    "Multi-timeframe <b>confluence dashboard</b> — is every TF aligned, at a glance?",
    "<b>Volume Profile / VPVR</b> — POC, value area, HVN/LVN, naked POCs",
    "Auto support/resistance + <b>supply/demand zones</b>",
    "<b>Divergence scanner</b> (regular + hidden) on RSI / MACD / OBV",
    "Full <b>Fibonacci suite</b> — retracement, extension, projection, time fibs",
    "<b>Wyckoff</b> schematics (accumulation/distribution, springs, upthrusts)",
    "Pattern recognition — chart patterns (H&amp;S, triangles, flags) + candlesticks",
]))
S.append(Spacer(1,6))
S.append(Paragraph("Indicator library — have vs. add", H2))
ind = [
    ["Trend", "SMA, EMA, WMA, Supertrend, Donchian", "Ichimoku, Parabolic SAR, ADX/DMI, HMA, DEMA/TEMA, VWMA, Keltner"],
    ["Momentum", "RSI, MACD, Stochastic", "CCI, Williams %R, Stoch RSI, MFI, Awesome/Ultimate Osc, ROC"],
    ["Volume", "VWAP, OBV", "Volume Profile/VPVR, Anchored VWAP, CMF, A/D, Chaikin Osc"],
    ["Volatility", "Bollinger, ATR", "Std Dev, Choppiness, Vortex, Historical Volatility"],
    ["Pivots", "Classic, Fib, Camarilla, Woodie", "Auto-fib, session pivots"],
    ["SMC layer", "— (new module)", "Order blocks, FVG, liquidity, BOS/CHoCH, premium/discount"],
    ["Auto-detect", "— (the AI flex)", "Divergence, auto S/R, candlestick & chart patterns"],
]
rows = [[Paragraph("CATEGORY", CELLH), Paragraph("BUILT ✓", CELLH), Paragraph("ADD FOR PRO", CELLH)]]
for r in ind:
    rows.append([Paragraph(f"<b>{r[0]}</b>", CELLB), Paragraph(r[1], CELL), Paragraph(r[2], CELL)])
S.append(chip_table(rows, [26*mm, 56*mm, 88*mm]))

S.append(PageBreak())
S.append(section("So conviction isn’t just lines on a chart", "Fundamental layer"))
S.append(Paragraph("Crypto / on-chain", H2))
S.append(bullets([
    "Exchange in/outflows, whale-transaction alerts, stablecoin supply",
    "MVRV, SOPR, NUPL, realised cap, active addresses",
    "Funding rate, Open Interest, long/short ratio, liquidation heatmap",
    "<b>Token unlocks / vesting calendar</b> — supply-shock events traders crave",
    "Narrative / sector-rotation tracker (AI, RWA, memes, L2s…)",
]))
S.append(Paragraph("Forex / macro", H2))
S.append(bullets([
    "Economic calendar + <b>surprise index</b> (actual vs forecast)",
    "<b>Central-bank rate-hike probabilities</b> &amp; policy bias",
    "<b>COT positioning</b> (smart money vs retail)",
    "Interest-rate differentials / carry, bond yields, real yields, DXY",
    "Currency-strength meter (built) + risk-on/risk-off gauge",
]))

# ===== 6. Conviction engine mock
S.append(PageBreak())
S.append(section("The product, in one screen", "★ The Conviction Engine"))
S.append(P("For any symbol, the engine auto-runs a confluence checklist, weights each factor, and outputs a single "
           "score, a grade, and a ready trade plan. This screen <i>is</i> ‘take a trade with confidence’.", BODY))
mock_lines = [
    ("BTC/USDT — LONG setup", "CONVICTION  82 / 100   GRADE: A", True),
    ("- "*27, "", False),
    ("✓ HTF bias bullish — 4H BOS confirmed", "+20", False),
    ("✓ Price in discount — below 50% equilibrium", "+15", False),
    ("✓ Sell-side liquidity swept — stop-hunt below", "+15", False),
    ("✓ Bullish FVG + Order Block confluence", "+15", False),
    ("✓ NY killzone active", "+10", False),
    ("✓ RSI bullish divergence", "+10", False),
    ("✓ Funding negative — shorts pay longs", "+7", False),
    ("✗ News risk — FOMC in 2h", "-10", False),
    ("- "*27, "", False),
    ("PLAN  entry 64,200  ·  stop 63,400  ·  TP 66,800  ·  R:R 3.2", "", True),
]
mrows = []
for left, right, hd in mock_lines:
    ls = MONOH if hd else MONO
    rs = ParagraphStyle("r", parent=MONOH if hd else MONO, alignment=2)
    if not hd and right.startswith("+"):
        right = f'<font color="#16C784">{right}</font>'
    elif not hd and right.startswith("-"):
        right = f'<font color="#EA3943">{right}</font>'
    mrows.append([Paragraph(left, ls), Paragraph(right, rs)])
mt = Table(mrows, colWidths=[118*mm, 52*mm])
mt.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1), BG),
    ("TOPPADDING",(0,0),(-1,-1),2),("BOTTOMPADDING",(0,0),(-1,-1),2),
    ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
    ("LINEABOVE",(0,0),(-1,0),3,ACCENT),
    ("LINEBELOW",(0,-1),(-1,-1),3,ACCENT),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
]))
S.append(Spacer(1,2)); S.append(mt); S.append(Spacer(1,6))
S.append(bullets([
    "<b>Setup grading</b> A+ / A / B / skip, with customizable factor weights (pros tune their own model)",
    "<b>Auto trade plan</b>: entry, stop, targets, R:R — position size pulled straight from the Toolkit calculators",
    "<b>Pre-trade checklist gate</b> the trader can’t skip — discipline by design",
    "Every factor is explainable and clickable — it teaches, it doesn’t dictate",
]))

# ===== 7. Alerts / Risk / Journal / AI quad
S.append(PageBreak())
S.append(section("Conviction beyond the chart", "Alerts · Risk · Journal · AI"))
def quad(title, items, color=ACCENT):
    head = Paragraph(f'<font color="#FFFFFF"><b>{title}</b></font>', CELLH)
    body = bullets(items, style=st("q", parent=BULL, fontSize=8.6, leading=12.5))
    t = Table([[head],[body]], colWidths=[82*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(0,0), INK),
        ("BACKGROUND",(0,1),(0,1), LIGHT),
        ("TOPPADDING",(0,0),(0,0),6),("BOTTOMPADDING",(0,0),(0,0),6),
        ("TOPPADDING",(0,1),(0,1),7),("BOTTOMPADDING",(0,1),(0,1),7),
        ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
        ("LINEBELOW",(0,0),(0,0),2,color),
    ]))
    return t
alerts = quad("ALERTS ENGINE", [
    "BOS / CHoCH formed; liquidity sweep / stop-hunt",
    "Price tapped Order Block / FVG / S&amp;D zone",
    "Killzone open; SMT divergence appeared",
    "Whale move, exchange-outflow spike, funding flip",
    "Breaking news / economic surprise",
    "<b>Natural-language AI alerts</b> in plain English",
])
risk = quad("RISK &amp; DISCIPLINE", [
    "Position sizer + liquidation calc (built)",
    "<b>Max daily loss → lockout</b>",
    "<b>Correlation risk warning</b> (3 long USD pairs?)",
    "Minimum R:R gate, risk-per-trade enforcement",
    "Drawdown tracker + recovery math",
])
journal = quad("JOURNAL &amp; EDGE ANALYTICS", [
    "Auto-screenshot every trade with context",
    "Tag by setup / model / session / pair / emotion",
    "<b>Your edge</b>: win-rate by setup, killzone, R:R",
    "Replay mode for post-trade review",
])
ai = quad("AI LAYER (trader-specific)", [
    "<b>Chart vision</b> — mark up structure/OB/FVG/liquidity",
    "<b>Devil’s advocate</b> — stress-tests your bias",
    "News-to-price translation",
    "Trade-plan critique &amp; ‘are you forcing this?’ check",
])
g = Table([[alerts, risk],[Spacer(1,6),Spacer(1,6)],[journal, ai]], colWidths=[82*mm, 82*mm])
g.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),
                       ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(0,-1),6)]))
S.append(g)

# ===== 8. AI models
S.append(PageBreak())
S.append(section("What powers the intelligence", "AI &amp; model strategy"))
S.append(Paragraph("A. Language AI — routed by cost", H2))
rows = [[Paragraph("JOB", CELLH), Paragraph("MODEL", CELLH), Paragraph("WHY", CELLH)]]
for r in [
    ["Bulk: sentiment tags, news dedup, headline scoring", "Claude Haiku 4.5 / Gemini Flash", "Pennies at high volume"],
    ["Main analyst chat, explain-this-move, briefs", "Claude Sonnet 4.6", "Best quality/cost reasoning"],
    ["Deep weekly thesis, multi-asset reasoning", "Claude Opus 4.8", "Premium tier feature"],
    ["Chart-vision (read a chart screenshot)", "Claude Sonnet/Opus (vision)", "Multimodal markup"],
    ["Free fallback / cost control", "Groq (Llama), Gemini free", "Keep provider-fallback chain"],
]:
    rows.append([Paragraph(r[0], CELL), Paragraph(f"<b>{r[1]}</b>", CELLB), Paragraph(r[2], CELL)])
S.append(chip_table(rows, [70*mm, 52*mm, 48*mm]))
S.append(Spacer(1,6))
S.append(Paragraph("B. Quant / ML models — analysis assistance, not prediction", H2))
S.append(bullets([
    "<b>FinBERT</b> — purpose-built financial-news sentiment (better than generic LLM for bulk tagging)",
    "<b>GARCH</b> — volatility forecasting (legit, widely accepted)",
    "<b>Hidden Markov Models / clustering</b> — market regime detection (trend vs chop vs volatile)",
    "<b>Anomaly detection</b> (isolation forest / z-score) — unusual volume, whale moves, vol spikes",
    "<b>Correlation &amp; PCA</b> — what’s driving the market today",
]))
S.append(callout("Positioning &amp; liability",
    "Never market ‘AI predicts the price.’ Frame every model as AI-<i>assisted analysis</i> and the Conviction Score as a "
    "<i>decision aid</i>. Put a ‘not financial advice’ line on every analytical surface. This is both legally safer and what "
    "serious traders actually want.", RED))

# ===== 9. Business reality + pricing + roadmap
S.append(PageBreak())
S.append(section("Make the business real", "Data licensing, pricing &amp; build order"))
S.append(callout("The $200/mo reality — budget for data",
    "‘Free APIs only’ works for a free tool. The moment you charge, most free tiers (CoinGecko, CryptoPanic, "
    "Finnhub, Twelve Data) become non-commercial, and TradingView free widgets aren’t licensed for paid products. "
    "Budget $500–2,000/mo in real data costs and license the TradingView Charting Library. At $200/user you "
    "break even on data around 5–15 subscribers — then it’s high margin.", WARN))
S.append(Spacer(1,6))
S.append(Paragraph("Suggested pricing tiers", H2))
rows = [[Paragraph("TIER", CELLH), Paragraph("PRICE", CELLH), Paragraph("FOR", CELLH)]]
for r in [
    ["Pro", "$49–79/mo", "Serious retail — charts, screeners, alerts, basic AI"],
    ["Elite (flagship)", "$149–199/mo", "Full AI analyst, derivatives + on-chain, unlimited alerts, backtester, conviction engine"],
    ["Desk / Team", "$499+/mo", "Small funds / prop desks — multi-seat, API access"],
]:
    rows.append([Paragraph(f"<b>{r[0]}</b>", CELLB), Paragraph(f'<font color="#16C784"><b>{r[1]}</b></font>', CELL), Paragraph(r[2], CELL)])
S.append(chip_table(rows, [34*mm, 30*mm, 106*mm]))
S.append(Spacer(1,3))
S.append(P("<font color='#6B7785'>Lead the marketing with the wedge: Bloomberg is ~$2,000/mo — TDX is $200 and AI-native.</font>", BODYM))
S.append(Spacer(1,8))
S.append(Paragraph("Build order — what makes the paywall worth it", H2))
rows = [[Paragraph("#", CELLH), Paragraph("PHASE", CELLH), Paragraph("WHY FIRST", CELLH)]]
for r in [
    ["1", "Charts + ICT/SMC auto-detection", "Your identity — structure, OB, FVG, liquidity, premium/discount"],
    ["2", "Conviction Engine + auto trade plan", "The thing nobody else has — the whole pitch"],
    ["3", "Alerts (sweeps, zone taps, killzones, NL)", "Strongest ‘I’ll pay for this’ feature"],
    ["4", "On-chain + derivatives + macro feeds", "Feeds the score; crypto traders pay for this"],
    ["5", "Journal + edge analytics", "Retention — their stats live here"],
    ["6", "AI chart-vision + second opinion", "The wow layer; differentiator at the top tier"],
]:
    rows.append([Paragraph(f'<font color="#16C784"><b>{r[0]}</b></font>', CELL), Paragraph(f"<b>{r[1]}</b>", CELLB), Paragraph(r[2], CELL)])
S.append(chip_table(rows, [9*mm, 70*mm, 91*mm]))
S.append(Spacer(1,8))
S.append(callout("Two non-negotiables",
    "1) Frame everything as conviction/confluence, never ‘signals to copy’ — legally safe and what pros want.  "
    "2) Nail clean ICT/SMC detection on a few concepts before breadth — detection quality is the trust you sell.",
    ACCENT))

doc.build(S)
print("WROTE", OUT)
