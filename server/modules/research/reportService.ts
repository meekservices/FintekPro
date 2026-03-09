import PptxGenJS from "pptxgenjs";
import PDFDocument from "pdfkit";
import type { FinancialData } from "./dataService";
import type { RatingResult } from "./recommendationEngine";
import type { PriceLevels } from "./technicalEngine";
import type { PriceTarget } from "./pricingEngine";
import type { ShareholdingData, PeerData, SectorAverages } from "./ownershipService";
import type { CommentaryData } from "./aiCommentaryService";
import { formatMarketCap, formatPercent, formatPrice, formatNumber } from "./financialEngine";

const BRAND_COLOR = "1a56db";
const BRAND_DARK  = "0f3460";
const ACCENT_GREEN = "16a34a";
const ACCENT_RED   = "dc2626";
const ACCENT_AMBER = "d97706";
const DARK_TEXT    = "111827";
const MID_TEXT     = "374151";
const LIGHT_TEXT   = "64748B";
const LIGHT_BG     = "f8fafc";
const ALT_ROW      = "EFF6FF";
const WHITE        = "FFFFFF";

export interface ReportData {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  broadSector: string | null;
  financials: FinancialData;
  rating: RatingResult;
  levels: PriceLevels;
  weekRange52Position: string;
  valuationSummary: string;
  generatedAt: string;
  priceTarget: PriceTarget | null;
  peg: number | null;
  thesis: string[];
  risks: string[];
  shareholding: ShareholdingData | null;
  peers: PeerData[];
  sectorAvg: SectorAverages | null;
  commentary: CommentaryData | null;
  managementNote: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingColour(rating: string): string {
  if (rating.includes("STRONG BUY")) return "15803d";
  if (rating.includes("BUY")) return ACCENT_GREEN;
  if (rating === "HOLD") return ACCENT_AMBER;
  if (rating.includes("STRONG SELL")) return "7f1d1d";
  return ACCENT_RED;
}

function pct(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

function crFmt(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)} L Cr`;
  if (Math.abs(v) >= 1000)   return `₹${(v / 1000).toFixed(1)} K Cr`;
  return `₹${v.toFixed(0)} Cr`;
}

function signStr(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  const s = (v * 100).toFixed(1);
  return v > 0 ? `+${s}%` : `${s}%`;
}

function signColour(v: number | null): string {
  if (v === null) return MID_TEXT;
  return v >= 0 ? ACCENT_GREEN : ACCENT_RED;
}

function numFmt(v: number | null, dec = 2): string {
  if (v === null || v === undefined) return "N/A";
  return v.toFixed(dec);
}

function priceRs(v: number | null): string {
  if (v === null) return "N/A";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function displayTarget(data: ReportData): string {
  const ext = data.financials.targetMeanPrice;
  if (ext) return formatPrice(ext, data.financials.currency);
  if (data.priceTarget?.blended) return `${priceRs(data.priceTarget.blended)} (Est.)`;
  return "N/A";
}

function displayUpside(data: ReportData): string {
  const pt = data.priceTarget;
  if (!pt?.upside) return "N/A";
  return `${pt.upside > 0 ? "▲" : "▼"} ${Math.abs(pt.upside).toFixed(1)}%`;
}

// ─── PPT ──────────────────────────────────────────────────────────────────────

export async function generatePPT(data: ReportData): Promise<Buffer> {
  const PptxCtor = (PptxGenJS as any).default ?? PptxGenJS;
  const ppt = new PptxCtor();
  ppt.layout = "LAYOUT_WIDE";
  ppt.author = "FintekPro Research";
  ppt.company = "FintekPro Research";
  ppt.subject = `${data.companyName} Research Note`;

  const rc = ratingColour(data.rating.rating);
  const f  = data.financials;
  const pt = data.priceTarget;

  // ── Slide 1: Cover ────────────────────────────────────────────────────────
  const s1 = ppt.addSlide();
  s1.background = { color: BRAND_DARK };

  // Left dark panel
  s1.addShape(ppt.ShapeType.rect, { x: 0, y: 0, w: 7.5, h: 7.5, fill: { color: BRAND_DARK }, line: { color: BRAND_DARK } });
  s1.addText("FintekPro Research", { x: 0.4, y: 0.3, w: 7, h: 0.35, fontSize: 12, color: "94A3B8", italic: true });
  s1.addText(data.companyName, { x: 0.4, y: 0.9, w: 7, h: 1.8, fontSize: 30, bold: true, color: WHITE, wrap: true });
  s1.addShape(ppt.ShapeType.line, { x: 0.4, y: 2.85, w: 6.8, h: 0, line: { color: "1e40af", width: 1.5 } });
  s1.addText(`${data.symbol.replace(".NS","").replace(".BO","")}  ·  ${data.exchange}`, { x: 0.4, y: 3.0, w: 7, h: 0.35, fontSize: 13, color: "CBD5E1" });
  if (data.sector) s1.addText(data.sector, { x: 0.4, y: 3.45, w: 7, h: 0.3, fontSize: 11, color: "94A3B8" });
  if (data.industry && data.industry !== data.sector) s1.addText(data.industry, { x: 0.4, y: 3.8, w: 7, h: 0.28, fontSize: 10, color: "6B7280" });

  // Right white panel
  s1.addShape(ppt.ShapeType.rect, { x: 7.5, y: 0, w: 5.5, h: 7.5, fill: { color: WHITE }, line: { color: WHITE } });

  const rightItems = [
    ["Current Market Price", formatPrice(f.price, f.currency)],
    ["Price Target", displayTarget(data)],
    ["Upside / Downside", displayUpside(data)],
  ];
  rightItems.forEach(([label, value], i) => {
    const y = 1.0 + i * 1.45;
    s1.addText(label, { x: 7.7, y, w: 5, h: 0.3, fontSize: 10, color: LIGHT_TEXT });
    s1.addText(value, { x: 7.7, y: y + 0.3, w: 5, h: 0.7, fontSize: 22, bold: true, color: DARK_TEXT });
    if (i < 2) s1.addShape(ppt.ShapeType.line, { x: 7.7, y: y + 1.1, w: 4.8, h: 0, line: { color: "E2E8F0", width: 0.75 } });
  });

  // Rating badge
  s1.addShape(ppt.ShapeType.rect, { x: 7.7, y: 5.3, w: 4.8, h: 0.8, fill: { color: rc }, line: { color: rc } });
  s1.addText(data.rating.rating, { x: 7.7, y: 5.35, w: 4.8, h: 0.7, fontSize: 22, bold: true, color: WHITE, align: "center" });
  s1.addText(`Composite Score: ${data.rating.score}/100`, { x: 7.7, y: 6.2, w: 4.8, h: 0.3, fontSize: 11, color: MID_TEXT, align: "center" });

  // Bottom strip
  s1.addShape(ppt.ShapeType.rect, { x: 0, y: 7.0, w: 13, h: 0.5, fill: { color: "0a1628" }, line: { color: "0a1628" } });
  s1.addText(`Institutional Research Note  ·  For Professional Use  ·  ${data.generatedAt}`, { x: 0.4, y: 7.05, w: 12, h: 0.35, fontSize: 9, color: "94A3B8", italic: true });

  // ── Slide 2: Company & Sector Overview ────────────────────────────────────
  const s2 = ppt.addSlide();
  s2.background = { color: LIGHT_BG };
  s2.addText("Company & Sector Overview", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s2.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const leftInfo = [
    ["Sector",       data.sector ?? "N/A"],
    ["Industry",     data.industry ?? "N/A"],
    ["Sub-Sector",   data.broadSector ?? "N/A"],
    ["Exchange",     data.exchange],
    ["Symbol",       data.symbol.replace(".NS","").replace(".BO","")],
    ["Face Value",   formatPrice(f.faceValue, f.currency)],
  ];
  const rightInfo = [
    ["Market Cap",   formatMarketCap(f.marketCap, f.currency)],
    ["VWAP",         formatPrice(f.vwap, f.currency)],
    ["52W High",     formatPrice(f.fiftyTwoWeekHigh, f.currency)],
    ["52W Low",      formatPrice(f.fiftyTwoWeekLow, f.currency)],
    ["Dividend Yield", pct(f.dividendYield)],
    ["Beta",         numFmt(f.beta)],
  ];

  leftInfo.forEach(([label, value], i) => {
    const y = 0.9 + i * 0.7;
    const bg = i % 2 === 0 ? WHITE : ALT_ROW;
    s2.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 5.8, h: 0.65, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
    s2.addText(label, { x: 0.55, y: y + 0.12, w: 2.5, h: 0.38, fontSize: 10, color: LIGHT_TEXT });
    s2.addText(value, { x: 3.1, y: y + 0.12, w: 3, h: 0.38, fontSize: 11, bold: true, color: DARK_TEXT });
  });
  rightInfo.forEach(([label, value], i) => {
    const y = 0.9 + i * 0.7;
    const bg = i % 2 === 0 ? WHITE : ALT_ROW;
    s2.addShape(ppt.ShapeType.rect, { x: 6.8, y, w: 5.8, h: 0.65, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
    s2.addText(label, { x: 6.95, y: y + 0.12, w: 2.5, h: 0.38, fontSize: 10, color: LIGHT_TEXT });
    s2.addText(value, { x: 9.5, y: y + 0.12, w: 3, h: 0.38, fontSize: 11, bold: true, color: DARK_TEXT });
  });

  // ── Slide 3: Fundamentals ─────────────────────────────────────────────────
  const s3 = ppt.addSlide();
  s3.background = { color: LIGHT_BG };
  s3.addText("Fundamentals — Revenue, EPS & Cash Flows", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s3.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const fundRows: [string, string, string | null, number | null][] = [
    ["Revenue (Latest FY)",   crFmt(f.revenue),      null,             null],
    ["Revenue Growth (YoY)",  pct(f.revenueGrowth),  signStr(f.revenueGrowth), f.revenueGrowth],
    ["EPS",                   formatPrice(f.eps, f.currency), null,    null],
    ["Earnings Growth (YoY)", pct(f.earningsGrowth), signStr(f.earningsGrowth), f.earningsGrowth],
    ["Operating Cash Flow",   crFmt(f.operatingCashFlow), null,        null],
    ["Free Cash Flow",        crFmt(f.freeCashFlow),  null,            null],
    ["Operating Margin",      pct(f.operatingMargin), null,            null],
    ["Net Income",            crFmt(f.netIncome),     null,            null],
  ];

  // Header
  s3.addShape(ppt.ShapeType.rect, { x: 0.4, y: 0.82, w: 12, h: 0.42, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
  ["Metric", "Value", "YoY Change"].forEach((h, i) => {
    const x = i === 0 ? 0.55 : i === 1 ? 5.5 : 9.5;
    s3.addText(h, { x, y: 0.88, w: i === 0 ? 4.5 : 3.5, h: 0.3, fontSize: 10, bold: true, color: WHITE });
  });

  fundRows.forEach(([metric, value, change, chVal], i) => {
    const y = 1.28 + i * 0.54;
    const bg = i % 2 === 0 ? WHITE : ALT_ROW;
    s3.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 12, h: 0.5, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
    s3.addText(metric, { x: 0.55, y: y + 0.1, w: 4.5, h: 0.3, fontSize: 10, color: MID_TEXT });
    s3.addText(value, { x: 5.5, y: y + 0.1, w: 3.5, h: 0.3, fontSize: 11, bold: true, color: DARK_TEXT });
    if (change) {
      const col = chVal !== null && chVal >= 0 ? ACCENT_GREEN : ACCENT_RED;
      s3.addText(change, { x: 9.5, y: y + 0.1, w: 2.5, h: 0.3, fontSize: 11, bold: true, color: col });
    }
  });

  // ── Slide 4: Financial Ratios vs Sector ───────────────────────────────────
  const s4 = ppt.addSlide();
  s4.background = { color: LIGHT_BG };
  s4.addText("Financial Ratios vs Sector Average", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s4.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const sa = data.sectorAvg;
  type Signal = { label: string; company: string; sector: string; signal: string; signalCol: string };
  const ratioRows: Signal[] = [
    {
      label: "P/E Ratio",
      company: numFmt(f.pe),
      sector: numFmt(sa?.avgPE),
      signal: (f.pe && sa?.avgPE) ? (f.pe < sa.avgPE ? "Attractive" : f.pe > sa.avgPE * 1.15 ? "Premium" : "In-Line") : "N/A",
      signalCol: (f.pe && sa?.avgPE) ? (f.pe < sa.avgPE ? ACCENT_GREEN : f.pe > sa.avgPE * 1.15 ? ACCENT_RED : ACCENT_AMBER) : LIGHT_TEXT,
    },
    {
      label: "P/B Ratio",
      company: numFmt((f as any).pbRatio),
      sector: numFmt(sa?.avgPB),
      signal: ((f as any).pbRatio && sa?.avgPB) ? ((f as any).pbRatio < sa.avgPB ? "Attractive" : (f as any).pbRatio > sa.avgPB * 1.2 ? "Premium" : "In-Line") : "N/A",
      signalCol: ((f as any).pbRatio && sa?.avgPB) ? ((f as any).pbRatio < sa.avgPB ? ACCENT_GREEN : (f as any).pbRatio > sa.avgPB * 1.2 ? ACCENT_RED : ACCENT_AMBER) : LIGHT_TEXT,
    },
    {
      label: "PEG Ratio",
      company: (data.peg !== null && data.peg > 0) ? numFmt(data.peg) : (f.earningsGrowth !== null && f.earningsGrowth <= 0 ? "N/M" : "N/A"),
      sector: "—",
      signal: (data.peg !== null && data.peg > 0) ? (data.peg < 1 ? "Undervalued" : data.peg < 2 ? "Fair" : "Expensive") : (f.earningsGrowth !== null && f.earningsGrowth <= 0 ? "Neg. Growth" : "N/A"),
      signalCol: (data.peg !== null && data.peg > 0) ? (data.peg < 1 ? ACCENT_GREEN : data.peg < 2 ? ACCENT_AMBER : ACCENT_RED) : ACCENT_AMBER,
    },
    {
      label: "ROE",
      company: pct(f.roe),
      sector: pct(sa?.avgROE),
      signal: (f.roe && sa?.avgROE) ? (f.roe > sa.avgROE ? "Above Avg" : f.roe < sa.avgROE * 0.8 ? "Below Avg" : "In-Line") : "N/A",
      signalCol: (f.roe && sa?.avgROE) ? (f.roe > sa.avgROE ? ACCENT_GREEN : f.roe < sa.avgROE * 0.8 ? ACCENT_RED : ACCENT_AMBER) : LIGHT_TEXT,
    },
    {
      label: "ROCE",
      company: pct((f as any).roce),
      sector: pct(sa?.avgROCE),
      signal: ((f as any).roce && sa?.avgROCE) ? ((f as any).roce > sa.avgROCE ? "Above Avg" : "Below Avg") : "N/A",
      signalCol: ((f as any).roce && sa?.avgROCE) ? ((f as any).roce > sa.avgROCE ? ACCENT_GREEN : ACCENT_RED) : LIGHT_TEXT,
    },
    {
      label: "Debt / Equity",
      company: numFmt(f.debtToEquity),
      sector: numFmt(sa?.avgDE),
      signal: (f.debtToEquity !== null && sa?.avgDE !== null && sa?.avgDE !== undefined) ? (f.debtToEquity < (sa.avgDE ?? 999) ? "Conservative" : "Leveraged") : "N/A",
      signalCol: (f.debtToEquity !== null && sa?.avgDE !== null && sa?.avgDE !== undefined) ? (f.debtToEquity < (sa.avgDE ?? 999) ? ACCENT_GREEN : ACCENT_RED) : LIGHT_TEXT,
    },
  ];

  // Header
  s4.addShape(ppt.ShapeType.rect, { x: 0.4, y: 0.82, w: 12, h: 0.42, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
  [["Ratio", 0.55], ["Company", 5.0], ["Sector Avg", 8.0], ["Signal", 10.5]].forEach(([h, x]) => {
    s4.addText(String(h), { x: Number(x), y: 0.88, w: 2.8, h: 0.3, fontSize: 10, bold: true, color: WHITE });
  });

  ratioRows.forEach(({ label, company, sector: secVal, signal, signalCol }, i) => {
    const y = 1.28 + i * 0.72;
    const bg = i % 2 === 0 ? WHITE : ALT_ROW;
    s4.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 12, h: 0.65, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
    s4.addText(label, { x: 0.55, y: y + 0.15, w: 4.0, h: 0.35, fontSize: 11, color: MID_TEXT });
    s4.addText(company, { x: 5.0, y: y + 0.15, w: 2.5, h: 0.35, fontSize: 12, bold: true, color: DARK_TEXT });
    s4.addText(secVal, { x: 8.0, y: y + 0.15, w: 2.0, h: 0.35, fontSize: 11, color: LIGHT_TEXT });
    s4.addText(signal, { x: 10.5, y: y + 0.15, w: 2.0, h: 0.35, fontSize: 11, bold: true, color: signalCol });
  });

  if (sa?.stockCount) {
    s4.addText(`Sector average based on ${sa.stockCount} stocks in ${data.sector ?? "this sector"}`, { x: 0.4, y: 7.15, w: 12, h: 0.25, fontSize: 8, color: LIGHT_TEXT, italic: true });
  }

  // ── Slide 5: Peer Comparison ──────────────────────────────────────────────
  const s5 = ppt.addSlide();
  s5.background = { color: LIGHT_BG };
  s5.addText("Peer Comparison", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s5.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  // Header
  s5.addShape(ppt.ShapeType.rect, { x: 0.4, y: 0.82, w: 12, h: 0.42, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
  [["Company", 0.55, 3.2], ["Price", 3.85, 1.8], ["P/E", 5.75, 1.5], ["P/B", 7.35, 1.5], ["ROE", 8.95, 1.5], ["Market Cap", 10.55, 1.8]].forEach(([h, x, w]) => {
    s5.addText(String(h), { x: Number(x), y: 0.88, w: Number(w), h: 0.3, fontSize: 10, bold: true, color: WHITE });
  });

  // Target stock row (highlighted)
  const peerRows = [
    { symbol: data.symbol.replace(".NS","").replace(".BO",""), name: data.companyName, price: f.price, pe: f.pe, pb: (f as any).pbRatio, roe: f.roe, marketCap: f.marketCap, isTarget: true },
    ...data.peers.map(p => ({ ...p, isTarget: false })),
  ];

  peerRows.slice(0, 6).forEach(({ symbol, name, price, pe, pb, roe, marketCap, isTarget }, i) => {
    const y = 1.28 + i * 0.72;
    const bg = isTarget ? "EFF6FF" : (i % 2 === 0 ? WHITE : ALT_ROW);
    const border = isTarget ? BRAND_COLOR : "E2E8F0";
    const textCol = isTarget ? BRAND_COLOR : DARK_TEXT;
    s5.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 12, h: 0.65, fill: { color: bg }, line: { color: border, width: isTarget ? 1.5 : 0.5 } });
    if (isTarget) s5.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 0.08, h: 0.65, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
    s5.addText(name.length > 28 ? name.slice(0, 28) + "…" : name, { x: 0.6, y: y + 0.15, w: 3.0, h: 0.35, fontSize: 10, bold: isTarget, color: textCol });
    s5.addText(price ? `₹${Math.round(price).toLocaleString("en-IN")}` : "N/A", { x: 3.85, y: y + 0.15, w: 1.7, h: 0.35, fontSize: 11, bold: isTarget, color: textCol });
    s5.addText(numFmt(pe), { x: 5.75, y: y + 0.15, w: 1.4, h: 0.35, fontSize: 11, color: textCol });
    s5.addText(numFmt(pb), { x: 7.35, y: y + 0.15, w: 1.4, h: 0.35, fontSize: 11, color: textCol });
    s5.addText(pct(roe), { x: 8.95, y: y + 0.15, w: 1.4, h: 0.35, fontSize: 11, color: textCol });
    s5.addText(formatMarketCap(marketCap, "INR"), { x: 10.55, y: y + 0.15, w: 1.7, h: 0.35, fontSize: 10, color: textCol });
  });

  if (data.peers.length === 0) {
    s5.addText("Peer data unavailable for this sector.", { x: 0.4, y: 3.0, w: 12, h: 0.4, fontSize: 12, color: LIGHT_TEXT, italic: true, align: "center" });
  }

  // ── Slide 6: Shareholding & Governance ───────────────────────────────────
  const s6 = ppt.addSlide();
  s6.background = { color: LIGHT_BG };
  s6.addText("Shareholding Pattern & Corporate Governance", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s6.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const sh = data.shareholding;
  if (sh) {
    // Stacked bar visual
    const barItems = [
      { label: "Promoter", pct: sh.promoterPct, color: BRAND_COLOR },
      { label: "FII / FPI", pct: sh.fiiPct, color: "7c3aed" },
      { label: "DII / MF", pct: sh.diiPct, color: ACCENT_GREEN },
      { label: "Public", pct: sh.publicPct, color: ACCENT_AMBER },
    ].filter(b => b.pct !== null && b.pct !== undefined && b.pct > 0);

    const total = barItems.reduce((sum, b) => sum + (b.pct ?? 0), 0) || 100;
    let xCursor = 0.4;
    const BAR_W = 12;
    barItems.forEach(b => {
      const segW = (BAR_W * (b.pct! / total));
      s6.addShape(ppt.ShapeType.rect, { x: xCursor, y: 1.0, w: segW, h: 0.5, fill: { color: b.color }, line: { color: b.color } });
      if (segW > 0.8) s6.addText(`${b.pct!.toFixed(1)}%`, { x: xCursor + 0.05, y: 1.05, w: segW - 0.1, h: 0.38, fontSize: 9, color: WHITE, align: "center", bold: true });
      xCursor += segW;
    });

    // Legend
    barItems.forEach((b, i) => {
      const x = 0.4 + i * 3.0;
      s6.addShape(ppt.ShapeType.rect, { x, y: 1.65, w: 0.25, h: 0.25, fill: { color: b.color }, line: { color: b.color } });
      s6.addText(`${b.label}: ${b.pct!.toFixed(1)}%`, { x: x + 0.35, y: 1.65, w: 2.5, h: 0.25, fontSize: 9, color: MID_TEXT });
    });

    // QoQ table
    s6.addText("Quarterly Shareholding Trend", { x: 0.4, y: 2.15, w: 12, h: 0.35, fontSize: 13, bold: true, color: DARK_TEXT });
    const qRows = [
      ["", sh.prevQuarter ?? "Previous Q", sh.quarter ?? "Latest Q", "Change"],
      ["Promoter %", sh.promoterPrevPct !== null ? `${sh.promoterPrevPct.toFixed(2)}%` : "N/A", sh.promoterPct !== null ? `${sh.promoterPct.toFixed(2)}%` : "N/A", sh.promoterChange !== null ? (sh.promoterChange >= 0 ? `+${sh.promoterChange.toFixed(2)}%` : `${sh.promoterChange.toFixed(2)}%`) : "N/A"],
      ["FII / FPI %", "—", sh.fiiPct !== null ? `${sh.fiiPct.toFixed(2)}%` : "N/A", "—"],
      ["DII / MF %", "—", sh.diiPct !== null ? `${sh.diiPct.toFixed(2)}%` : "N/A", "—"],
    ];

    qRows.forEach((row, ri) => {
      const y = 2.6 + ri * 0.55;
      const bg = ri === 0 ? BRAND_COLOR : (ri % 2 === 0 ? ALT_ROW : WHITE);
      const textCol = ri === 0 ? WHITE : DARK_TEXT;
      s6.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 12, h: 0.48, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
      const widths = [3.5, 2.5, 2.5, 2.5];
      const xs = [0.55, 4.1, 6.7, 9.3];
      row.forEach((cell, ci) => {
        const changeColor = ri > 0 && ci === 3 && cell.startsWith("+") ? ACCENT_GREEN : (ri > 0 && ci === 3 && cell.startsWith("-") ? ACCENT_RED : textCol);
        s6.addText(cell, { x: xs[ci], y: y + 0.1, w: widths[ci], h: 0.3, fontSize: 10, bold: ri === 0, color: changeColor });
      });
    });

    if (sh.pledgedPct !== null && sh.pledgedPct > 0) {
      const pledgeCol = sh.pledgedPct > 10 ? ACCENT_RED : ACCENT_AMBER;
      s6.addText(`⚠ Pledged Shares: ${sh.pledgedPct.toFixed(1)}%`, { x: 0.4, y: 4.9, w: 6, h: 0.3, fontSize: 10, bold: true, color: pledgeCol });
    }

    if (sh.promoterChange !== null && sh.promoterChange < -1) {
      s6.addText(`⚠ Promoter holding declined by ${Math.abs(sh.promoterChange).toFixed(1)}% QoQ — monitor for further movement`, { x: 0.4, y: 5.25, w: 12, h: 0.3, fontSize: 10, color: ACCENT_RED, italic: true });
    }
  } else {
    s6.addText("Shareholding data unavailable for this stock.", { x: 0.4, y: 2.5, w: 12, h: 0.4, fontSize: 12, color: LIGHT_TEXT, italic: true, align: "center" });
  }

  s6.addText("Management & Governance Note", { x: 0.4, y: 5.75, w: 12, h: 0.3, fontSize: 11, bold: true, color: DARK_TEXT });
  s6.addText(data.managementNote, { x: 0.4, y: 6.1, w: 12, h: 0.7, fontSize: 10, color: MID_TEXT, italic: true, wrap: true });

  // ── Slide 7: Industry Trends & Outlook ───────────────────────────────────
  const s7 = ppt.addSlide();
  s7.background = { color: LIGHT_BG };
  s7.addText("Industry Trends & Sector Outlook", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s7.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const comm = data.commentary;
  const commItems = comm
    ? [
        { label: "Industry Trends & Tailwinds", text: comm.industryTrends },
        { label: "Expansion & Strategic Initiatives", text: comm.expansionPlans },
        { label: "Investor Outlook", text: comm.outlook },
      ]
    : [{ label: "Industry Outlook", text: "Sector commentary unavailable." }, { label: "", text: "" }, { label: "", text: "" }];

  commItems.forEach(({ label, text }, i) => {
    if (!label) return;
    const y = 0.9 + i * 1.9;
    s7.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 0.08, h: 1.6, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
    s7.addShape(ppt.ShapeType.rect, { x: 0.55, y, w: 12, h: 1.6, fill: { color: WHITE }, line: { color: "E2E8F0", width: 0.75 } });
    s7.addText(`${i + 1}. ${label}`, { x: 0.75, y: y + 0.12, w: 11.5, h: 0.35, fontSize: 12, bold: true, color: BRAND_COLOR });
    s7.addText(text, { x: 0.75, y: y + 0.5, w: 11.5, h: 1.0, fontSize: 10.5, color: MID_TEXT, wrap: true });
  });

  s7.addText("AI-generated overview based on sector dynamics, company financial profile, and market context.", { x: 0.4, y: 6.85, w: 12, h: 0.25, fontSize: 8, color: LIGHT_TEXT, italic: true });

  // ── Slide 8: Price Trend & Technical Analysis ─────────────────────────────
  const s8 = ppt.addSlide();
  s8.background = { color: LIGHT_BG };
  s8.addText("Price Trend & Technical Analysis", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s8.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  // 52W range bar
  const lo = f.fiftyTwoWeekLow, hi = f.fiftyTwoWeekHigh, cur = f.price;
  if (lo && hi && cur) {
    const pos = Math.max(0, Math.min(1, (cur - lo) / (hi - lo)));
    s8.addShape(ppt.ShapeType.rect, { x: 1.0, y: 1.0, w: 10, h: 0.3, fill: { color: "E2E8F0" }, line: { color: "CBD5E1", width: 1 } });
    s8.addShape(ppt.ShapeType.rect, { x: 1.0, y: 1.0, w: 10 * pos, h: 0.3, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
    s8.addShape(ppt.ShapeType.rect, { x: 1.0 + 10 * pos - 0.06, y: 0.85, w: 0.12, h: 0.6, fill: { color: BRAND_DARK }, line: { color: BRAND_DARK } });
    s8.addText(`₹${Math.round(lo).toLocaleString("en-IN")}`, { x: 0.4, y: 1.4, w: 1.5, h: 0.25, fontSize: 9, color: MID_TEXT });
    s8.addText(`CMP ₹${Math.round(cur).toLocaleString("en-IN")}`, { x: 1.0 + 10 * pos - 0.5, y: 0.62, w: 2.0, h: 0.25, fontSize: 9, bold: true, color: BRAND_DARK, align: "center" });
    s8.addText(`₹${Math.round(hi).toLocaleString("en-IN")}`, { x: 10.5, y: 1.4, w: 2, h: 0.25, fontSize: 9, color: MID_TEXT });
    s8.addText(data.weekRange52Position, { x: 0.4, y: 1.7, w: 12, h: 0.3, fontSize: 11, color: MID_TEXT, italic: true });
  }

  // Level boxes
  const levels = [
    { label: "Stop Loss", value: priceRs(data.levels.stopLoss), color: ACCENT_RED },
    { label: "Support", value: priceRs(data.levels.support), color: ACCENT_AMBER },
    { label: "CMP", value: priceRs(f.price), color: BRAND_COLOR },
    { label: "Target 1", value: priceRs(data.levels.target1), color: "4ade80" },
    { label: "Target 2", value: priceRs(data.levels.target2), color: ACCENT_GREEN },
  ];
  levels.forEach(({ label, value, color }, i) => {
    const x = 0.4 + i * 2.45;
    s8.addShape(ppt.ShapeType.rect, { x, y: 2.15, w: 2.3, h: 1.0, fill: { color }, line: { color } });
    s8.addText(label, { x, y: 2.25, w: 2.3, h: 0.3, fontSize: 9, color: WHITE, align: "center" });
    s8.addText(value, { x, y: 2.6, w: 2.3, h: 0.4, fontSize: 14, bold: true, color: WHITE, align: "center" });
  });

  // Returns table
  s8.addText("Price Returns", { x: 0.4, y: 3.4, w: 5, h: 0.35, fontSize: 13, bold: true, color: DARK_TEXT });
  const returns = [
    ["1 Month", f.returns1M],
    ["6 Months", f.returns6M],
    ["1 Year", f.returns1Y],
  ];
  returns.forEach(([label, val], i) => {
    const y = 3.85 + i * 0.55;
    const bg = i % 2 === 0 ? WHITE : ALT_ROW;
    s8.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 5.5, h: 0.48, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
    s8.addText(String(label), { x: 0.55, y: y + 0.1, w: 2.5, h: 0.28, fontSize: 10, color: MID_TEXT });
    const v = val as number | null;
    const col = v !== null ? (v >= 0 ? ACCENT_GREEN : ACCENT_RED) : LIGHT_TEXT;
    s8.addText(v !== null ? signStr(v) : "N/A", { x: 3.1, y: y + 0.1, w: 2.5, h: 0.28, fontSize: 11, bold: true, color: col });
  });

  // Valuation details
  if (pt?.blended) {
    s8.addText("Price Target Derivation", { x: 6.5, y: 3.4, w: 6, h: 0.35, fontSize: 13, bold: true, color: DARK_TEXT });
    const ptRows = [
      ["Method", pt.method],
      ["PE-Based Target", priceRs(pt.peBased)],
      ["PB-Based Target", priceRs(pt.pbBased)],
      ["Blended Target", priceRs(pt.blended)],
      ["Upside", `${pt.upside}%`],
    ];
    ptRows.forEach(([label, val], i) => {
      const y = 3.85 + i * 0.55;
      const bg = i % 2 === 0 ? WHITE : ALT_ROW;
      s8.addShape(ppt.ShapeType.rect, { x: 6.5, y, w: 5.9, h: 0.48, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 } });
      s8.addText(label, { x: 6.65, y: y + 0.1, w: 2.5, h: 0.28, fontSize: 10, color: MID_TEXT });
      s8.addText(val, { x: 9.2, y: y + 0.1, w: 3, h: 0.28, fontSize: 11, bold: true, color: i === 3 ? BRAND_COLOR : DARK_TEXT });
    });
  }

  // ── Slide 9: Investment Thesis, Risks & Recommendation ────────────────────
  const s9 = ppt.addSlide();
  s9.background = { color: LIGHT_BG };
  s9.addText("Investment Thesis, Risks & Recommendation", { x: 0.4, y: 0.2, w: 12, h: 0.45, fontSize: 20, bold: true, color: DARK_TEXT });
  s9.addShape(ppt.ShapeType.line, { x: 0.4, y: 0.7, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  // Rating + Score strip
  s9.addShape(ppt.ShapeType.rect, { x: 0.4, y: 0.85, w: 12, h: 0.75, fill: { color: rc }, line: { color: rc } });
  s9.addText(data.rating.rating, { x: 0.4, y: 0.9, w: 6, h: 0.65, fontSize: 24, bold: true, color: WHITE, align: "center" });
  s9.addText(`Score: ${data.rating.score}/100  ·  Fundamentals: ${data.rating.breakdown.fundamentals}  ·  Valuation: ${data.rating.breakdown.valuation}  ·  Momentum: ${data.rating.breakdown.momentum}`, { x: 6.5, y: 1.0, w: 5.8, h: 0.45, fontSize: 10, color: WHITE, align: "center" });

  // Thesis
  s9.addText("Why We Recommend — Investment Thesis", { x: 0.4, y: 1.75, w: 12, h: 0.3, fontSize: 12, bold: true, color: DARK_TEXT });
  data.thesis.slice(0, 4).forEach((bullet, i) => {
    const y = 2.1 + i * 0.88;
    s9.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 0.08, h: 0.75, fill: { color: BRAND_COLOR }, line: { color: BRAND_COLOR } });
    s9.addShape(ppt.ShapeType.rect, { x: 0.55, y, w: 11.85, h: 0.75, fill: { color: WHITE }, line: { color: "DBEAFE", width: 0.75 } });
    s9.addText(`${i + 1}`, { x: 0.6, y: y + 0.2, w: 0.4, h: 0.35, fontSize: 11, bold: true, color: BRAND_COLOR, align: "center" });
    s9.addText(bullet, { x: 1.1, y: y + 0.1, w: 11.1, h: 0.55, fontSize: 9.5, color: MID_TEXT, wrap: true });
  });

  // Risks
  const riskY = 2.1 + 4 * 0.88 + 0.1;
  s9.addText("Key Risk Factors", { x: 0.4, y: riskY, w: 12, h: 0.3, fontSize: 12, bold: true, color: DARK_TEXT });
  data.risks.slice(0, 3).forEach((risk, i) => {
    const y = riskY + 0.35 + i * 0.55;
    s9.addShape(ppt.ShapeType.rect, { x: 0.4, y, w: 0.08, h: 0.45, fill: { color: ACCENT_RED }, line: { color: ACCENT_RED } });
    s9.addText(`${i + 1}. ${risk}`, { x: 0.6, y: y + 0.05, w: 12, h: 0.38, fontSize: 9, color: MID_TEXT, wrap: true });
  });

  // ── Slide 10: Closing ─────────────────────────────────────────────────────
  const s10 = ppt.addSlide();
  s10.background = { color: BRAND_DARK };
  s10.addText("FintekPro Research", { x: 0.5, y: 2.2, w: 12, h: 0.6, fontSize: 28, bold: true, color: WHITE, align: "center" });
  s10.addText("Institutional Research  ·  Investment Advisory", { x: 0.5, y: 3.0, w: 12, h: 0.4, fontSize: 14, color: "CBD5E1", align: "center" });
  s10.addText(data.generatedAt, { x: 0.5, y: 3.5, w: 12, h: 0.3, fontSize: 11, color: "94A3B8", align: "center" });
  s10.addText(
    "Disclaimer: This research note is prepared by FintekPro Research for informational purposes only and does not constitute investment advice or a solicitation to buy or sell securities. Past performance is not indicative of future results. Investors must conduct their own due diligence and consult a SEBI-registered investment advisor before making investment decisions.",
    { x: 1.0, y: 5.5, w: 11, h: 1.2, fontSize: 8.5, color: "64748B", italic: true, wrap: true, align: "center" }
  );

  const buffer: Buffer = await (ppt as any).write({ outputType: "nodebuffer" });
  return buffer;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function generatePDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 45 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const PW = W - 90;
    const f  = data.financials;
    const rc = data.rating.rating.includes("BUY") ? "#16a34a" : data.rating.rating === "HOLD" ? "#d97706" : "#dc2626";

    // ── PAGE 1 ─────────────────────────────────────────────────────────────
    // Header strip
    doc.rect(0, 0, W, 72).fill("#0f3460");
    doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold").text("FintekPro Research", 45, 16);
    doc.fontSize(10).font("Helvetica").fillColor("#94A3B8").text("Institutional Research Note", 45, 42);
    doc.fontSize(9).fillColor("#64748B").text(data.generatedAt, W - 140, 42);

    // Company title
    doc.fillColor("#111827").fontSize(20).font("Helvetica-Bold").text(data.companyName, 45, 88);
    const sub = [data.symbol.replace(".NS","").replace(".BO",""), data.sector, data.industry, data.exchange].filter(Boolean).join("  ·  ");
    doc.fontSize(10).font("Helvetica").fillColor("#475569").text(sub, 45, 116);

    // Quick stats bar
    const stats = [
      { label: "Current Market Price", value: formatPrice(f.price, f.currency), isRating: false },
      { label: "Price Target", value: displayTarget(data), isRating: false },
      { label: "Upside / Downside", value: displayUpside(data), isRating: false },
      { label: "Rating", value: data.rating.rating, isRating: true },
    ];
    const bw = PW / 4;
    stats.forEach(({ label, value, isRating }, i) => {
      const bx = 45 + i * bw;
      const bg = isRating ? rc : "#F8FAFC";
      doc.rect(bx, 135, bw, 52).fill(bg).stroke("#E2E8F0");
      doc.fillColor(isRating ? "#FFFFFF" : "#64748B").fontSize(8).font("Helvetica").text(label, bx + 6, 142, { width: bw - 12 });
      doc.fillColor(isRating ? "#FFFFFF" : "#111827").fontSize(isRating ? 13 : 14).font("Helvetica-Bold").text(value, bx + 6, 157, { width: bw - 12 });
    });

    doc.moveTo(45, 197).lineTo(W - 45, 197).stroke("#1a56db");

    // Financial Highlights
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Financial Highlights", 45, 207);

    const leftRows = [
      ["Current Price",   formatPrice(f.price, f.currency)],
      ["Market Cap",      formatMarketCap(f.marketCap, f.currency)],
      ["P/E Ratio",       numFmt(f.pe)],
      ["EPS",             formatPrice(f.eps, f.currency)],
      ["ROE",             pct(f.roe)],
      ["ROCE",            pct((f as any).roce)],
    ];
    const rightRows = [
      ["P/B Ratio",       numFmt((f as any).pbRatio) + "x"],
      ["Debt / Equity",   numFmt(f.debtToEquity)],
      ["Revenue Growth",  pct(f.revenueGrowth)],
      ["Earnings Growth", pct(f.earningsGrowth)],
      ["Dividend Yield",  pct(f.dividendYield)],
      ["52W High / Low",  `${formatPrice(f.fiftyTwoWeekHigh, f.currency)} / ${formatPrice(f.fiftyTwoWeekLow, f.currency)}`],
    ];

    let ry = 228;
    leftRows.forEach(([label, value], i) => {
      const bg = i % 2 === 0 ? "#FFFFFF" : "#EFF6FF";
      doc.rect(45, ry, PW / 2, 19).fill(bg);
      doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(label, 50, ry + 5);
      doc.fillColor("#111827").fontSize(9.5).font("Helvetica-Bold").text(value, 45 + PW / 4, ry + 5, { width: PW / 4 - 5, align: "right" });
      const [rl, rv] = rightRows[i];
      doc.rect(45 + PW / 2, ry, PW / 2, 19).fill(bg);
      doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(rl, 50 + PW / 2, ry + 5);
      doc.fillColor("#111827").fontSize(9.5).font("Helvetica-Bold").text(rv, 45 + PW * 0.75, ry + 5, { width: PW / 4 - 5, align: "right" });
      ry += 19;
    });

    ry += 10;
    doc.moveTo(45, ry).lineTo(W - 45, ry).stroke("#E2E8F0");
    ry += 8;

    // Technical Levels
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Technical Levels", 45, ry);
    ry += 20;
    const lvls = [
      ["Stop Loss",   formatPrice(data.levels.stopLoss,   f.currency)],
      ["Support",     formatPrice(data.levels.support,    f.currency)],
      ["Resistance",  formatPrice(data.levels.resistance, f.currency)],
      ["Target 1",    formatPrice(data.levels.target1,    f.currency)],
      ["Target 2",    formatPrice(data.levels.target2,    f.currency)],
      ["Price Target",displayTarget(data)],
    ];
    const cw = PW / 3;
    lvls.forEach(([label, val], i) => {
      const cx = 45 + (i % 3) * cw;
      const cy = ry + Math.floor(i / 3) * 32;
      doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(label, cx, cy);
      doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text(val, cx, cy + 12);
    });

    // Price returns
    ry += 72;
    if (f.returns1M !== null || f.returns6M !== null || f.returns1Y !== null) {
      doc.fillColor("#1a56db").fontSize(11).font("Helvetica-Bold").text("Price Returns", 45, ry);
      ry += 16;
      [["1M", f.returns1M], ["6M", f.returns6M], ["1Y", f.returns1Y]].forEach(([label, val], i) => {
        const v = val as number | null;
        const col = v !== null ? (v >= 0 ? "#16a34a" : "#dc2626") : "#64748B";
        doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(String(label), 45 + i * 80, ry);
        doc.fillColor(col).fontSize(11).font("Helvetica-Bold").text(v !== null ? signStr(v) : "N/A", 45 + i * 80, ry + 12);
      });
      ry += 32;
    }

    // Footer page 1
    const fY1 = doc.page.height - 55;
    doc.rect(0, fY1, W, 55).fill("#F1F5F9");
    doc.fillColor("#1a56db").fontSize(10).font("Helvetica-Bold").text("FintekPro Research", 45, fY1 + 10);
    doc.fillColor("#475569").fontSize(8).font("Helvetica").text("Institutional Research  ·  Investment Advisory", 45, fY1 + 25);
    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica-Oblique").text("Page 1 of 3  ·  For Professional Use Only", W - 160, fY1 + 18);

    // ── PAGE 2 ─────────────────────────────────────────────────────────────
    doc.addPage();

    doc.rect(0, 0, W, 30).fill("#0f3460");
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold").text("FintekPro Research", 45, 9);
    doc.fillColor("#94A3B8").fontSize(9).font("Helvetica").text(`${data.companyName} — Valuation, Peers & Governance`, 170, 10);

    let y2 = 45;

    // Valuation Analysis
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Valuation Analysis — Price Target Derivation", 45, y2);
    y2 += 20;

    if (data.priceTarget?.blended) {
      const pt = data.priceTarget;
      // Method boxes
      const methods = [
        { label: "PE-Based", formula: `EPS (${formatPrice(f.eps, f.currency)}) × Target PE (${pt.targetPE?.toFixed(1)}x)`, result: priceRs(pt.peBased) },
        { label: "PB-Based", formula: `Book Value (${formatPrice((f as any).bookValue, f.currency)}) × Target PB (${pt.targetPB?.toFixed(1)}x)`, result: priceRs(pt.pbBased) },
      ].filter(m => m.result !== "N/A");

      methods.forEach(({ label, formula, result }, i) => {
        const bx = 45 + i * (PW / 2 + 5);
        doc.rect(bx, y2, PW / 2 - 2, 40).fill("#F8FAFC").stroke("#E2E8F0");
        doc.fillColor("#1a56db").fontSize(10).font("Helvetica-Bold").text(label, bx + 8, y2 + 5);
        doc.fillColor("#475569").fontSize(8.5).font("Helvetica").text(formula, bx + 8, y2 + 20, { width: PW / 2 - 16 });
        doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text(result, bx + PW / 2 - 60, y2 + 20, { width: 50, align: "right" });
      });
      y2 += 50;

      // Blended target highlight
      doc.rect(45, y2, PW, 32).fill("#1a56db");
      doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold").text(`Blended Price Target (${pt.method})`, 50, y2 + 5);
      doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold").text(priceRs(pt.blended), W - 130, y2 + 7, { width: 80, align: "right" });
      doc.fillColor("#CBD5E1").fontSize(10).font("Helvetica").text(`Upside: ${pt.upside}% from CMP`, 50, y2 + 19);
      y2 += 42;

      // Bear/Base/Bull table
      const scenarios = [
        { label: "Bear Case", val: priceRs(pt.bear), color: "#dc2626" },
        { label: "Base Case", val: priceRs(pt.base), color: "#1a56db" },
        { label: "Bull Case", val: priceRs(pt.bull), color: "#16a34a" },
      ];
      const sw = PW / 3;
      scenarios.forEach(({ label, val, color }, i) => {
        const sx = 45 + i * sw;
        doc.rect(sx, y2, sw, 36).fill(color);
        doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold").text(label, sx, y2 + 6, { width: sw, align: "center" });
        doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text(val, sx, y2 + 18, { width: sw, align: "center" });
      });
      y2 += 46;
    }

    y2 += 8;
    doc.moveTo(45, y2).lineTo(W - 45, y2).stroke("#E2E8F0");
    y2 += 10;

    // Ratios vs Sector
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Financial Ratios vs Sector Average", 45, y2);
    y2 += 18;

    const sa = data.sectorAvg;
    const ratioRowsPDF = [
      { label: "P/E Ratio", co: numFmt(f.pe), sec: numFmt(sa?.avgPE) },
      { label: "P/B Ratio", co: numFmt((f as any).pbRatio), sec: numFmt(sa?.avgPB) },
      { label: "PEG Ratio", co: numFmt(data.peg), sec: "—" },
      { label: "ROE", co: pct(f.roe), sec: pct(sa?.avgROE) },
      { label: "ROCE", co: pct((f as any).roce), sec: pct(sa?.avgROCE) },
      { label: "Debt / Equity", co: numFmt(f.debtToEquity), sec: numFmt(sa?.avgDE) },
    ];
    // Header
    doc.rect(45, y2, PW, 16).fill("#1a56db");
    doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold");
    ["Ratio", "Company", "Sector Avg"].forEach((h, i) => {
      doc.text(h, 50 + i * 140, y2 + 4, { width: 130 });
    });
    y2 += 16;
    ratioRowsPDF.forEach(({ label, co, sec }, i) => {
      const bg = i % 2 === 0 ? "#FFFFFF" : "#EFF6FF";
      doc.rect(45, y2, PW, 16).fill(bg);
      doc.fillColor("#374151").fontSize(8.5).font("Helvetica").text(label, 50, y2 + 4);
      doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold").text(co, 190, y2 + 4);
      doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(sec, 330, y2 + 4);
      y2 += 16;
    });

    y2 += 8;
    doc.moveTo(45, y2).lineTo(W - 45, y2).stroke("#E2E8F0");
    y2 += 10;

    // Peer Comparison
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Peer Comparison", 45, y2);
    y2 += 18;

    const peerRowsPDF = [
      { name: data.companyName, symbol: data.symbol.replace(".NS",""), price: f.price, pe: f.pe, roe: f.roe, mcap: f.marketCap, isTarget: true },
      ...data.peers.map(p => ({ name: p.name, symbol: p.symbol, price: p.price, pe: p.pe, roe: p.roe, mcap: p.marketCap, isTarget: false })),
    ];

    doc.rect(45, y2, PW, 16).fill("#1a56db");
    doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold");
    [["Company", 50], ["Sym", 220], ["Price", 270], ["P/E", 330], ["ROE", 385], ["Mkt Cap", 435]].forEach(([h, x]) => {
      doc.text(String(h), Number(x), y2 + 4, { width: 60 });
    });
    y2 += 16;

    peerRowsPDF.slice(0, 6).forEach(({ name, symbol, price, pe, roe, mcap, isTarget }, i) => {
      const bg = isTarget ? "#EFF6FF" : (i % 2 === 0 ? "#FFFFFF" : "#F9FAFB");
      doc.rect(45, y2, PW, 16).fill(bg);
      if (isTarget) { doc.rect(45, y2, 3, 16).fill("#1a56db"); }
      const col = isTarget ? "#1a56db" : "#111827";
      doc.fillColor(col).fontSize(isTarget ? 8.5 : 8).font(isTarget ? "Helvetica-Bold" : "Helvetica");
      doc.text(name.length > 22 ? name.slice(0, 22) + "…" : name, 50, y2 + 4, { width: 165 });
      doc.text(symbol, 220, y2 + 4, { width: 45 });
      doc.fillColor(col).fontSize(8.5).font("Helvetica-Bold").text(price ? `₹${Math.round(price).toLocaleString("en-IN")}` : "N/A", 270, y2 + 4, { width: 55 });
      doc.fillColor(col).fontSize(8).font("Helvetica").text(numFmt(pe), 330, y2 + 4, { width: 50 });
      doc.text(pct(roe), 385, y2 + 4, { width: 45 });
      doc.text(formatMarketCap(mcap, "INR"), 435, y2 + 4, { width: 70 });
      y2 += 16;
    });

    if (data.peers.length === 0) {
      doc.fillColor("#64748B").fontSize(9).font("Helvetica-Oblique").text("Peer data unavailable for this sector.", 45, y2 + 4);
      y2 += 20;
    }

    y2 += 8;
    doc.moveTo(45, y2).lineTo(W - 45, y2).stroke("#E2E8F0");
    y2 += 10;

    // Shareholding
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Shareholding Pattern & Governance", 45, y2);
    y2 += 18;
    const sh = data.shareholding;
    if (sh) {
      const shRows = [
        ["Promoter Holding", sh.promoterPct !== null ? `${sh.promoterPct.toFixed(2)}%` : "N/A", sh.promoterChange !== null ? (sh.promoterChange >= 0 ? `+${sh.promoterChange.toFixed(2)}% QoQ` : `${sh.promoterChange.toFixed(2)}% QoQ`) : ""],
        ["FII / FPI", sh.fiiPct !== null ? `${sh.fiiPct.toFixed(2)}%` : "N/A", ""],
        ["DII / Mutual Funds", sh.diiPct !== null ? `${sh.diiPct.toFixed(2)}%` : "N/A", sh.mutualFundPct !== null ? `MF: ${sh.mutualFundPct.toFixed(2)}%` : ""],
        ["Public", sh.publicPct !== null ? `${sh.publicPct.toFixed(2)}%` : "N/A", sh.pledgedPct !== null && sh.pledgedPct > 0 ? `Pledged: ${sh.pledgedPct.toFixed(2)}%` : ""],
      ];
      shRows.forEach(([label, val, note], i) => {
        const bg = i % 2 === 0 ? "#FFFFFF" : "#EFF6FF";
        doc.rect(45, y2, PW, 16).fill(bg);
        doc.fillColor("#374151").fontSize(8.5).font("Helvetica").text(label, 50, y2 + 4);
        doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold").text(val, 220, y2 + 4);
        if (note) {
          const noteCol = note.includes("-") ? "#dc2626" : "#64748B";
          doc.fillColor(noteCol).fontSize(8).font("Helvetica").text(note, 330, y2 + 4);
        }
        y2 += 16;
      });
    } else {
      doc.fillColor("#64748B").fontSize(9).font("Helvetica-Oblique").text("Shareholding data unavailable.", 50, y2);
      y2 += 16;
    }
    y2 += 4;
    doc.fillColor("#374151").fontSize(8.5).font("Helvetica-Oblique").text(data.managementNote, 45, y2, { width: PW });

    // Footer page 2
    const fY2 = doc.page.height - 40;
    doc.rect(0, fY2, W, 40).fill("#F1F5F9");
    doc.fillColor("#1a56db").fontSize(9).font("Helvetica-Bold").text("FintekPro Research", 45, fY2 + 10);
    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica-Oblique").text("Page 2 of 3  ·  For Professional Use Only", W - 160, fY2 + 12);

    // ── PAGE 3 ─────────────────────────────────────────────────────────────
    doc.addPage();

    doc.rect(0, 0, W, 30).fill("#0f3460");
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold").text("FintekPro Research", 45, 9);
    doc.fillColor("#94A3B8").fontSize(9).font("Helvetica").text(`${data.companyName} — Thesis, Industry & Recommendation`, 170, 10);

    let y3 = 45;

    // Industry Trends
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Industry Trends & Sector Outlook", 45, y3);
    y3 += 20;
    const comm = data.commentary;
    const commItems = comm
      ? [comm.industryTrends, comm.expansionPlans, comm.outlook]
      : ["Sector commentary is currently unavailable.", "", ""];

    commItems.filter(Boolean).forEach((text, i) => {
      const labels = ["Industry Trends & Tailwinds", "Expansion & Strategic Initiatives", "Investor Outlook"];
      doc.rect(45, y3, 3, 38).fill("#1a56db");
      doc.fillColor("#1a56db").fontSize(9.5).font("Helvetica-Bold").text(labels[i], 52, y3 + 2);
      doc.fillColor("#374151").fontSize(9).font("Helvetica").text(text, 52, y3 + 15, { width: PW - 8 });
      y3 += 45;
    });
    doc.fillColor("#94A3B8").fontSize(7.5).font("Helvetica-Oblique").text("AI-generated overview based on sector dynamics and company financial profile.", 45, y3);
    y3 += 18;

    doc.moveTo(45, y3).lineTo(W - 45, y3).stroke("#E2E8F0");
    y3 += 10;

    // Investment Thesis
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Investment Thesis", 45, y3);
    y3 += 18;
    data.thesis.forEach((bullet, i) => {
      doc.rect(45, y3, 2, 24).fill("#1a56db");
      doc.fillColor("#1a56db").fontSize(9).font("Helvetica-Bold").text(`${i + 1}.`, 52, y3 + 4);
      doc.fillColor("#374151").fontSize(9).font("Helvetica").text(bullet, 65, y3 + 4, { width: PW - 20 });
      y3 += 30;
    });

    y3 += 4;
    doc.moveTo(45, y3).lineTo(W - 45, y3).stroke("#E2E8F0");
    y3 += 10;

    // Risk Factors
    doc.fillColor("#dc2626").fontSize(13).font("Helvetica-Bold").text("Key Risk Factors", 45, y3);
    y3 += 18;
    data.risks.forEach((risk, i) => {
      doc.rect(45, y3, 2, 22).fill("#dc2626");
      doc.fillColor("#dc2626").fontSize(9).font("Helvetica-Bold").text(`${i + 1}.`, 52, y3 + 3);
      doc.fillColor("#374151").fontSize(9).font("Helvetica").text(risk, 65, y3 + 3, { width: PW - 20 });
      y3 += 28;
    });

    y3 += 4;
    doc.moveTo(45, y3).lineTo(W - 45, y3).stroke("#E2E8F0");
    y3 += 10;

    // Score breakdown
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Investment Recommendation & Score Breakdown", 45, y3);
    y3 += 18;

    doc.rect(45, y3, PW, 32).fill(rc);
    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold").text(data.rating.rating, 45, y3 + 7, { width: PW / 2, align: "center" });
    doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica").text(`Composite Score: ${data.rating.score}/100`, 45 + PW / 2, y3 + 10, { width: PW / 2, align: "center" });
    y3 += 40;

    const scores = [
      { label: "Fundamentals", score: data.rating.breakdown.fundamentals, weight: "40%" },
      { label: "Valuation", score: data.rating.breakdown.valuation, weight: "30%" },
      { label: "Momentum", score: data.rating.breakdown.momentum, weight: "30%" },
    ];
    const bw3 = PW / 3;
    scores.forEach(({ label, score, weight }, i) => {
      const bx = 45 + i * bw3;
      doc.rect(bx, y3, bw3 - 4, 42).fill("#F8FAFC").stroke("#E2E8F0");
      doc.fillColor("#64748B").fontSize(8.5).font("Helvetica").text(`${label} (${weight})`, bx + 4, y3 + 5, { width: bw3 - 10 });
      const scoreCol = score >= 65 ? "#16a34a" : score >= 45 ? "#d97706" : "#dc2626";
      doc.fillColor(scoreCol).fontSize(17).font("Helvetica-Bold").text(`${score}/100`, bx + 4, y3 + 20, { width: bw3 - 10, align: "center" });
    });
    y3 += 52;

    doc.moveTo(45, y3).lineTo(W - 45, y3).stroke("#E2E8F0");
    y3 += 8;

    // Disclaimer
    const disclaimer = "Disclaimer: This research note has been prepared by FintekPro Research for informational purposes only. It does not constitute investment advice, a solicitation, or an offer to buy or sell any security. The information herein is based on publicly available data and sources believed to be reliable, but no warranty is given as to its accuracy or completeness. Investors should conduct their own due diligence and consult a SEBI-registered investment adviser before making any investment decisions. Past performance is not indicative of future results. FintekPro Research shall not be liable for any loss arising from the use of this report.";
    doc.rect(45, y3, PW, 1).fill("#E2E8F0");
    y3 += 6;
    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica-Oblique").text(disclaimer, 45, y3, { width: PW });

    // Footer page 3
    const fY3 = doc.page.height - 40;
    doc.rect(0, fY3, W, 40).fill("#F1F5F9");
    doc.fillColor("#1a56db").fontSize(9).font("Helvetica-Bold").text("FintekPro Research", 45, fY3 + 10);
    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica-Oblique").text("Page 3 of 3  ·  For Professional Use Only", W - 160, fY3 + 12);

    doc.end();
  });
}

// ─── ONE PAGER ────────────────────────────────────────────────────────────────

export async function generateOnePager(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const PW = W - 80;
    const f = data.financials;
    const rc = data.rating.rating.includes("BUY") ? "#16a34a" : data.rating.rating === "HOLD" ? "#d97706" : "#dc2626";

    // Header
    doc.rect(0, 0, W, 58).fill("#0f3460");
    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold").text("FintekPro Research", 40, 10);
    doc.fontSize(10).font("Helvetica").fillColor("#CBD5E1").text("Quick Reference Note  ·  One Pager", 40, 32);
    doc.fillColor("#94A3B8").fontSize(8).font("Helvetica").text(data.generatedAt, W - 130, 32);

    // Company
    doc.fillColor("#111827").fontSize(17).font("Helvetica-Bold").text(data.companyName, 40, 72);
    doc.fillColor("#475569").fontSize(9).font("Helvetica").text(
      [data.symbol.replace(".NS",""), data.sector, data.exchange].filter(Boolean).join("  ·  "), 40, 94
    );

    // Quick stats bar
    const stats = [
      ["CMP", formatPrice(f.price, f.currency)],
      ["Target", displayTarget(data)],
      ["Upside", displayUpside(data)],
      ["Rating", data.rating.rating],
    ];
    const bw = PW / 4;
    stats.forEach(([label, value], i) => {
      const bx = 40 + i * bw;
      const isRating = i === 3;
      doc.rect(bx, 110, bw, 36).fill(isRating ? rc : "#F8FAFC").stroke("#E2E8F0");
      doc.fillColor(isRating ? "#FFFFFF" : "#64748B").fontSize(7.5).font("Helvetica").text(label, bx + 4, 116, { width: bw - 8 });
      doc.fillColor(isRating ? "#FFFFFF" : "#111827").fontSize(isRating ? 11 : 12).font("Helvetica-Bold").text(value, bx + 4, 126, { width: bw - 8 });
    });

    doc.moveTo(40, 156).lineTo(W - 40, 156).stroke("#1a56db");

    // Metrics grid (2 columns)
    const metrics = [
      ["P/E Ratio", numFmt(f.pe)],                         ["ROE", pct(f.roe)],
      ["P/B Ratio", numFmt((f as any).pbRatio) + "x"],     ["ROCE", pct((f as any).roce)],
      ["EPS", formatPrice(f.eps, f.currency)],              ["D/E Ratio", numFmt(f.debtToEquity)],
      ["Rev Growth", pct(f.revenueGrowth)],                 ["EPS Growth", pct(f.earningsGrowth)],
      ["52W High", formatPrice(f.fiftyTwoWeekHigh, f.currency)], ["Div Yield", pct(f.dividendYield)],
      ["52W Low", formatPrice(f.fiftyTwoWeekLow, f.currency)], ["Market Cap", formatMarketCap(f.marketCap, f.currency)],
    ];
    let my = 162;
    metrics.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const mx = 40 + col * (PW / 2);
      const myi = 162 + row * 17;
      const bg = Math.floor(i / 2) % 2 === 0 ? "#FFFFFF" : "#EFF6FF";
      doc.rect(mx, myi, PW / 2, 16).fill(bg);
      doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(label, mx + 4, myi + 4);
      doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold").text(value, mx + PW / 4, myi + 4, { width: PW / 4 - 4, align: "right" });
      if (col === 1) my = myi + 17;
    });

    doc.moveTo(40, my).lineTo(W - 40, my).stroke("#E2E8F0");
    let y = my + 8;

    // Bull/Base/Bear
    if (data.priceTarget?.blended) {
      const pt = data.priceTarget;
      [
        { label: "Bear", val: priceRs(pt.bear), color: "#dc2626" },
        { label: "Base Target", val: priceRs(pt.base), color: "#1a56db" },
        { label: "Bull", val: priceRs(pt.bull), color: "#16a34a" },
      ].forEach(({ label, val, color }, i) => {
        const sx = 40 + i * (PW / 3);
        doc.rect(sx, y, PW / 3, 28).fill(color);
        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold").text(label, sx, y + 5, { width: PW / 3, align: "center" });
        doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold").text(val, sx, y + 14, { width: PW / 3, align: "center" });
      });
      y += 36;
    }

    doc.moveTo(40, y).lineTo(W - 40, y).stroke("#E2E8F0");
    y += 8;

    // Thesis (2 bullets)
    doc.fillColor("#1a56db").fontSize(10).font("Helvetica-Bold").text("Investment Thesis", 40, y);
    y += 14;
    data.thesis.slice(0, 2).forEach((bullet, i) => {
      doc.rect(40, y, 2, 18).fill("#1a56db");
      doc.fillColor("#374151").fontSize(8.5).font("Helvetica").text(`${i + 1}. ${bullet}`, 48, y + 2, { width: PW - 8 });
      y += 24;
    });

    doc.moveTo(40, y).lineTo(W - 40, y).stroke("#E2E8F0");
    y += 8;

    // Risks (2 bullets)
    doc.fillColor("#dc2626").fontSize(10).font("Helvetica-Bold").text("Key Risks", 40, y);
    y += 14;
    data.risks.slice(0, 2).forEach((risk, i) => {
      doc.rect(40, y, 2, 18).fill("#dc2626");
      doc.fillColor("#374151").fontSize(8.5).font("Helvetica").text(`${i + 1}. ${risk}`, 48, y + 2, { width: PW - 8 });
      y += 24;
    });

    doc.moveTo(40, y).lineTo(W - 40, y).stroke("#E2E8F0");
    y += 8;

    // Price levels strip
    doc.fillColor("#1a56db").fontSize(9).font("Helvetica-Bold").text("Price Levels:", 40, y);
    const levelItems = [
      `Stop Loss: ${formatPrice(data.levels.stopLoss, f.currency)}`,
      `Support: ${formatPrice(data.levels.support, f.currency)}`,
      `Target 1: ${formatPrice(data.levels.target1, f.currency)}`,
      `Target 2: ${formatPrice(data.levels.target2, f.currency)}`,
    ];
    doc.fillColor("#374151").fontSize(9).font("Helvetica").text(levelItems.join("   ·   "), 40, y + 14, { width: PW });
    y += 32;

    // 52W position + Returns
    doc.fillColor("#475569").fontSize(9).font("Helvetica-Oblique").text(`52W Position: ${data.weekRange52Position}`, 40, y, { width: PW });
    if (f.returns1Y !== null) {
      const col = f.returns1Y >= 0 ? "#16a34a" : "#dc2626";
      doc.fillColor(col).fontSize(9).font("Helvetica-Bold").text(`1Y Return: ${signStr(f.returns1Y)}`, W - 130, y);
    }
    y += 18;

    // Footer
    const fY = doc.page.height - 38;
    doc.rect(0, fY, W, 38).fill("#F1F5F9");
    doc.fillColor("#1a56db").fontSize(9).font("Helvetica-Bold").text("FintekPro Research", 40, fY + 8);
    doc.fillColor("#94A3B8").fontSize(7).font("Helvetica-Oblique").text(
      "For informational use only. Not investment advice. Consult your financial advisor.", 40, fY + 22, { width: PW }
    );

    doc.end();
  });
}
