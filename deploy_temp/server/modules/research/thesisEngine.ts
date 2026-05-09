import type { FinancialData } from "./dataService";
import type { PriceTarget } from "./pricingEngine";
import { formatPercent, formatPrice } from "./financialEngine";

function pct(v: number | null): string {
  if (v === null || v === undefined || typeof v !== "number" || !isFinite(v)) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

function num(v: number | null, dec = 2): string {
  if (v === null || v === undefined || typeof v !== "number" || !isFinite(v)) return "N/A";
  return v.toFixed(dec);
}

function priceStr(v: number | null): string {
  if (v === null) return "N/A";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

export function generateThesis(
  f: FinancialData,
  rating: string,
  pt: PriceTarget | null
): string[] {
  const bullets: string[] = [];
  const fp = f as any;
  const pos52W = (f.price && f.fiftyTwoWeekLow && f.fiftyTwoWeekHigh)
    ? ((f.price - f.fiftyTwoWeekLow) / (f.fiftyTwoWeekHigh - f.fiftyTwoWeekLow)) * 100
    : null;

  if (f.earningsGrowth !== null && f.earningsGrowth > 0.12) {
    bullets.push(`Earnings growing at ${pct(f.earningsGrowth)} YoY signals strong operational leverage and improving profitability trajectory.`);
  }
  if (f.revenueGrowth !== null && f.revenueGrowth > 0.06) {
    bullets.push(`Revenue expansion of ${pct(f.revenueGrowth)} YoY demonstrates healthy demand momentum across core business segments.`);
  }
  if (f.roe !== null && f.roe > 0.15) {
    bullets.push(`Capital efficiency is strong — ROE of ${pct(f.roe)} indicates superior returns on shareholder equity, well above sector norms.`);
  }
  if (fp.roce !== null && fp.roce > 0.12) {
    bullets.push(`ROCE of ${pct(fp.roce)} reflects effective deployment of total capital employed across the business.`);
  }
  if (f.debtToEquity !== null && f.debtToEquity < 0.35) {
    const deLabel = f.debtToEquity < 0.05 ? "Debt-free balance sheet" : `Conservative balance sheet (D/E: ${num(f.debtToEquity)})`;
    bullets.push(`${deLabel} provides significant financial flexibility for growth, acquisitions, or weathering downturns.`);
  }
  if (f.dividendYield !== null && f.dividendYield > 0.015) {
    bullets.push(`Dividend yield of ${pct(f.dividendYield)} offers income support alongside capital appreciation potential.`);
  }
  if (pos52W !== null && pos52W < 20) {
    bullets.push(`Stock is trading near its 52-week low (${priceStr(f.fiftyTwoWeekLow)}) — limited downside with technical reversion potential.`);
  } else if (pos52W !== null && pos52W < 35) {
    bullets.push(`At ${Math.round(pos52W)}% from its 52W low, the stock offers an attractive entry point relative to recent price history.`);
  }
  if (pt?.upside !== null && pt?.upside !== undefined && pt.upside > 10) {
    bullets.push(`FintekPro price target of ${priceStr(pt.blended)} implies ${pt.upside}% upside from CMP — compelling risk-reward at current levels.`);
  }
  if (f.earningsGrowth !== null && f.earningsGrowth > 0 && f.earningsGrowth <= 0.12) {
    bullets.push(`Positive earnings growth of ${pct(f.earningsGrowth)} YoY reflects a business on a recovery or steady-growth trajectory.`);
  }

  while (bullets.length < 4) {
    const fallbacks = [
      `Sector tailwinds and structural demand drivers support long-term earnings visibility for the business.`,
      `Valuation at ${num(f.pe)}x PE is ${f.pe && f.pe < 20 ? "attractive" : f.pe && f.pe < 30 ? "reasonable" : "premium"} relative to growth profile, offering ${rating.includes("BUY") ? "a favourable" : "a watchful"} entry.`,
      `Management track record in capital allocation and operational execution remains a key investment merit.`,
      `The company's financial profile suggests resilience through market cycles with an established business franchise.`,
    ];
    const next = fallbacks.find(fb => !bullets.includes(fb));
    if (next) bullets.push(next);
    else break;
  }

  return bullets.slice(0, 4);
}

export function generateRisks(f: FinancialData): string[] {
  const risks: string[] = [];
  const fp = f as any;

  if (f.pe !== null && f.pe > 30) {
    risks.push(`Premium valuation at ${num(f.pe)}x PE leaves limited margin of safety; any earnings miss could trigger a sharp correction.`);
  }
  if (fp.pbRatio !== null && fp.pbRatio > 4) {
    risks.push(`High P/B ratio of ${num(fp.pbRatio)}x indicates the market is pricing in significant growth; a slowdown could compress multiples sharply.`);
  }
  if (f.debtToEquity !== null && f.debtToEquity > 1.0) {
    risks.push(`Elevated leverage (D/E: ${num(f.debtToEquity)}) may constrain borrowing capacity and put pressure on free cash flow generation.`);
  }
  if (f.roe !== null && f.roe < 0.08) {
    risks.push(`Below-average ROE of ${pct(f.roe)} signals potential capital allocation inefficiency versus sector peers.`);
  }
  if (f.revenueGrowth !== null && f.revenueGrowth < 0) {
    risks.push(`Revenue contraction of ${pct(f.revenueGrowth)} YoY poses near-term earnings headwinds — recovery catalysts need monitoring.`);
  }
  if (f.earningsGrowth !== null && f.earningsGrowth < -0.08) {
    risks.push(`Earnings declined ${pct(f.earningsGrowth)} YoY — margin recovery visibility and volume growth are key re-rating triggers to watch.`);
  }

  risks.push(`Macro sensitivity — INR depreciation, rising interest rates, or global risk-off episodes could compress earnings multiples.`);
  risks.push(`Regulatory or policy changes within the sector may structurally impact business model economics and competitive dynamics.`);

  return risks.slice(0, 5);
}

export function generateManagementNote(
  companyName: string,
  promoterChange: number | null,
  pledgedPct: number | null
): string {
  const parts: string[] = [];

  if (promoterChange !== null && promoterChange < -1.5) {
    parts.push(`Promoter holding has declined by ${Math.abs(promoterChange).toFixed(1)}% QoQ — a trend worth monitoring for confidence signals.`);
  } else if (promoterChange !== null && promoterChange > 0.5) {
    parts.push(`Promoter holding increased by ${promoterChange.toFixed(1)}% QoQ, reflecting strong insider confidence in the business outlook.`);
  } else {
    parts.push(`Promoter holding has remained stable, indicating continued commitment to the company's long-term strategy.`);
  }

  if (pledgedPct !== null && pledgedPct > 20) {
    parts.push(`Pledged shareholding of ${pledgedPct.toFixed(1)}% is elevated and represents an overhang risk for minority shareholders.`);
  } else if (pledgedPct !== null && pledgedPct > 5) {
    parts.push(`Modest pledged shareholding of ${pledgedPct.toFixed(1)}% warrants watching but is not currently a material concern.`);
  } else {
    parts.push(`Minimal or nil pledged shareholding reflects a clean promoter holding structure with no overhang risk.`);
  }

  return parts.join(" ");
}
