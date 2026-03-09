import PptxGenJS from "pptxgenjs";
import PDFDocument from "pdfkit";
import { Writable } from "stream";
import type { FinancialData } from "./dataService";
import type { RatingResult } from "./recommendationEngine";
import type { PriceLevels } from "./technicalEngine";
import { formatMarketCap, formatPercent, formatPrice, formatNumber } from "./financialEngine";

const BRAND_COLOR = "1a56db";
const ACCENT_COLOR = "16a34a";
const WARNING_COLOR = "dc2626";
const DARK_TEXT = "111827";
const LIGHT_BG = "f8fafc";

export interface ReportData {
  symbol: string;
  companyName: string;
  exchange: string;
  financials: FinancialData;
  rating: RatingResult;
  levels: PriceLevels;
  weekRange52Position: string;
  valuationSummary: string;
  generatedAt: string;
}

export async function generatePPT(data: ReportData): Promise<Buffer> {
  const ppt = new PptxGenJS();
  ppt.layout = "LAYOUT_WIDE";
  ppt.author = "Sangram Kesari Mohanty";
  ppt.company = "FintekPro Research";
  ppt.subject = `${data.companyName} Research Note`;

  const ratingColor = data.rating.rating.includes("BUY")
    ? ACCENT_COLOR
    : data.rating.rating === "HOLD"
    ? "f59e0b"
    : WARNING_COLOR;

  const slide1 = ppt.addSlide();
  slide1.background = { color: BRAND_COLOR };
  slide1.addText("FintekPro Research", {
    x: 0.5, y: 0.3, w: 12, h: 0.4,
    fontSize: 14, color: "FFFFFF", bold: false, italic: true,
  });
  slide1.addText(data.companyName, {
    x: 0.5, y: 1.0, w: 12, h: 1.2,
    fontSize: 36, color: "FFFFFF", bold: true,
  });
  slide1.addText(`${data.symbol} | ${data.exchange}`, {
    x: 0.5, y: 2.2, w: 12, h: 0.4,
    fontSize: 18, color: "CBD5E1",
  });
  slide1.addText(`RECOMMENDATION: ${data.rating.rating}`, {
    x: 0.5, y: 2.9, w: 5, h: 0.6,
    fontSize: 22, color: "FFFFFF", bold: true,
    fill: { color: ratingColor },
    align: "center",
  });
  slide1.addText(`Score: ${data.rating.score}/100`, {
    x: 6.0, y: 2.9, w: 3, h: 0.6,
    fontSize: 18, color: "FFFFFF", bold: true,
    fill: { color: "334155" },
    align: "center",
  });
  slide1.addText(`Prepared by: Sangram Kesari Mohanty, CFP | FintekPro Research | ${data.generatedAt}`, {
    x: 0.5, y: 6.8, w: 12, h: 0.3,
    fontSize: 10, color: "94A3B8", italic: true,
  });

  const slide2 = ppt.addSlide();
  slide2.background = { color: LIGHT_BG };
  slide2.addText("Financial Snapshot", {
    x: 0.5, y: 0.2, w: 12, h: 0.5,
    fontSize: 22, bold: true, color: DARK_TEXT,
  });
  slide2.addShape(ppt.ShapeType.line, { x: 0.5, y: 0.75, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const f = data.financials as any;
  const metrics = [
    ["Current Price", formatPrice(data.financials.price, data.financials.currency)],
    ["Market Cap",    formatMarketCap(data.financials.marketCap, data.financials.currency)],
    ["P/E Ratio",     formatNumber(data.financials.pe)],
    ["EPS",           formatPrice(data.financials.eps, data.financials.currency)],
    ["ROE",           formatPercent(data.financials.roe)],
    ["ROCE",          formatPercent(f.roce)],
    ["P/B Ratio",     f.pbRatio != null ? `${Number(f.pbRatio).toFixed(2)}x` : "N/A"],
    ["Debt / Equity", formatNumber(data.financials.debtToEquity)],
    ["Dividend Yield",formatPercent(data.financials.dividendYield)],
    ["Revenue Growth",formatPercent(data.financials.revenueGrowth)],
    ["Earnings Growth",formatPercent(data.financials.earningsGrowth)],
    ["52W High",      formatPrice(data.financials.fiftyTwoWeekHigh, data.financials.currency)],
  ];

  metrics.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 4.2;
    const y = 1.1 + row * 1.2;
    slide2.addShape(ppt.ShapeType.rect, {
      x, y, w: 3.8, h: 1.0,
      fill: { color: "FFFFFF" },
      line: { color: "E2E8F0", width: 1 },
    });
    slide2.addText(label, { x: x + 0.15, y: y + 0.05, w: 3.5, h: 0.35, fontSize: 10, color: "64748B" });
    slide2.addText(value, { x: x + 0.15, y: y + 0.45, w: 3.5, h: 0.45, fontSize: 18, bold: true, color: DARK_TEXT });
  });

  const slide3 = ppt.addSlide();
  slide3.background = { color: LIGHT_BG };
  slide3.addText("Technical Levels & Valuation", {
    x: 0.5, y: 0.2, w: 12, h: 0.5,
    fontSize: 22, bold: true, color: DARK_TEXT,
  });
  slide3.addShape(ppt.ShapeType.line, { x: 0.5, y: 0.75, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  const techMetrics = [
    ["Support", formatPrice(data.levels.support, data.financials.currency)],
    ["Resistance", formatPrice(data.levels.resistance, data.financials.currency)],
    ["Stop Loss", formatPrice(data.levels.stopLoss, data.financials.currency)],
    ["Target 1", formatPrice(data.levels.target1, data.financials.currency)],
    ["Target 2", formatPrice(data.levels.target2, data.financials.currency)],
    ["Analyst Target", formatPrice(data.financials.targetMeanPrice, data.financials.currency)],
  ];
  techMetrics.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 4.2;
    const y = 1.1 + row * 1.2;
    slide3.addShape(ppt.ShapeType.rect, { x, y, w: 3.8, h: 1.0, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 } });
    slide3.addText(label, { x: x + 0.15, y: y + 0.05, w: 3.5, h: 0.35, fontSize: 10, color: "64748B" });
    slide3.addText(value, { x: x + 0.15, y: y + 0.45, w: 3.5, h: 0.45, fontSize: 18, bold: true, color: DARK_TEXT });
  });

  slide3.addText(`52W Position: ${data.weekRange52Position}`, { x: 0.5, y: 3.7, w: 12, h: 0.4, fontSize: 13, color: DARK_TEXT });
  slide3.addText(`Valuation: ${data.valuationSummary}`, { x: 0.5, y: 4.1, w: 12, h: 0.8, fontSize: 12, color: "475569", wrap: true });

  const slide4 = ppt.addSlide();
  slide4.background = { color: LIGHT_BG };
  slide4.addText("Investment Recommendation", {
    x: 0.5, y: 0.2, w: 12, h: 0.5,
    fontSize: 22, bold: true, color: DARK_TEXT,
  });
  slide4.addShape(ppt.ShapeType.line, { x: 0.5, y: 0.75, w: 12, h: 0, line: { color: BRAND_COLOR, width: 2 } });

  slide4.addShape(ppt.ShapeType.rect, { x: 0.5, y: 1.0, w: 12, h: 1.2, fill: { color: ratingColor }, line: { color: ratingColor, width: 0 } });
  slide4.addText(data.rating.rating, { x: 0.5, y: 1.1, w: 12, h: 0.6, fontSize: 36, bold: true, color: "FFFFFF", align: "center" });
  slide4.addText(`Composite Score: ${data.rating.score} / 100`, { x: 0.5, y: 1.7, w: 12, h: 0.4, fontSize: 14, color: "FFFFFF", align: "center" });

  const scores = [
    ["Fundamentals", data.rating.breakdown.fundamentals],
    ["Valuation", data.rating.breakdown.valuation],
    ["Momentum", data.rating.breakdown.momentum],
  ];
  scores.forEach(([label, score], i) => {
    const x = 0.5 + i * 4.2;
    slide4.addShape(ppt.ShapeType.rect, { x, y: 2.5, w: 3.8, h: 1.2, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 1 } });
    slide4.addText(String(label), { x: x + 0.1, y: 2.55, w: 3.6, h: 0.4, fontSize: 11, color: "64748B", align: "center" });
    slide4.addText(`${score}/100`, { x: x + 0.1, y: 2.95, w: 3.6, h: 0.5, fontSize: 22, bold: true, color: DARK_TEXT, align: "center" });
  });

  slide4.addText(data.rating.rationale, { x: 0.5, y: 3.9, w: 12, h: 0.8, fontSize: 13, color: DARK_TEXT, italic: true, wrap: true });
  slide4.addText(
    "Disclaimer: This research note is prepared by FintekPro Research for informational purposes only. It does not constitute investment advice. Past performance is not indicative of future results. Please consult your financial advisor before making investment decisions.",
    { x: 0.5, y: 6.0, w: 12, h: 0.7, fontSize: 9, color: "94A3B8", wrap: true, italic: true }
  );

  const slide5 = ppt.addSlide();
  slide5.background = { color: BRAND_COLOR };
  slide5.addText("FintekPro Research", { x: 0.5, y: 2.0, w: 12, h: 0.6, fontSize: 28, bold: true, color: "FFFFFF", align: "center" });
  slide5.addText("Prepared by", { x: 0.5, y: 2.8, w: 12, h: 0.4, fontSize: 14, color: "CBD5E1", align: "center" });
  slide5.addText("Sangram Kesari Mohanty", { x: 0.5, y: 3.2, w: 12, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", align: "center" });
  slide5.addText("Certified Financial Planner", { x: 0.5, y: 3.7, w: 12, h: 0.4, fontSize: 14, color: "CBD5E1", align: "center" });
  slide5.addText(data.generatedAt, { x: 0.5, y: 4.3, w: 12, h: 0.3, fontSize: 11, color: "94A3B8", align: "center" });

  const buffer: Buffer = await (ppt as any).write({ outputType: "nodebuffer" });
  return buffer;
}

export async function generatePDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100;

    doc.rect(0, 0, doc.page.width, 80).fill("#1a56db");
    doc.fillColor("#FFFFFF").fontSize(22).font("Helvetica-Bold").text("FintekPro Research", 50, 18);
    doc.fontSize(11).font("Helvetica").fillColor("#CBD5E1").text("Institutional Research Note", 50, 48);
    doc.moveDown(2);

    doc.fillColor("#111827").fontSize(24).font("Helvetica-Bold").text(data.companyName, 50, 100);
    doc.fontSize(13).font("Helvetica").fillColor("#475569").text(`${data.symbol} | ${data.exchange}`, 50, 130);

    const ratingColor = data.rating.rating.includes("BUY") ? "#16a34a" : data.rating.rating === "HOLD" ? "#f59e0b" : "#dc2626";
    doc.rect(50, 155, 160, 35).fill(ratingColor);
    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold").text(data.rating.rating, 50, 165, { width: 160, align: "center" });

    doc.fillColor("#111827").fontSize(11).font("Helvetica").text(`Score: ${data.rating.score}/100`, 230, 165);
    doc.fontSize(10).fillColor("#475569").text(`Generated: ${data.generatedAt}`, 400, 165);

    doc.moveTo(50, 200).lineTo(doc.page.width - 50, 200).stroke("#1a56db");

    doc.fillColor("#1a56db").fontSize(15).font("Helvetica-Bold").text("Financial Highlights", 50, 215);
    doc.fillColor("#111827").font("Helvetica").fontSize(10);

    const fp = data.financials as any;
    const left = [
      ["Current Price",  formatPrice(data.financials.price, data.financials.currency)],
      ["Market Cap",     formatMarketCap(data.financials.marketCap, data.financials.currency)],
      ["P/E Ratio",      formatNumber(data.financials.pe)],
      ["EPS",            formatPrice(data.financials.eps, data.financials.currency)],
      ["ROE",            formatPercent(data.financials.roe)],
      ["ROCE",           formatPercent(fp.roce)],
    ];
    const right = [
      ["Debt / Equity",  formatNumber(data.financials.debtToEquity)],
      ["Dividend Yield", formatPercent(data.financials.dividendYield)],
      ["Revenue Growth", formatPercent(data.financials.revenueGrowth)],
      ["Earnings Growth",formatPercent(data.financials.earningsGrowth)],
      ["52W High",       formatPrice(data.financials.fiftyTwoWeekHigh, data.financials.currency)],
      ["52W Low",        formatPrice(data.financials.fiftyTwoWeekLow, data.financials.currency)],
    ];

    let y = 240;
    left.forEach(([label, value], i) => {
      doc.fillColor("#64748B").fontSize(9).text(label, 50, y + i * 22);
      doc.fillColor("#111827").fontSize(11).font("Helvetica-Bold").text(value, 200, y + i * 22);
      doc.font("Helvetica");
      const [rl, rv] = right[i];
      doc.fillColor("#64748B").fontSize(9).text(rl, 310, y + i * 22);
      doc.fillColor("#111827").fontSize(11).font("Helvetica-Bold").text(rv, 460, y + i * 22);
      doc.font("Helvetica");
    });

    y = 380;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#E2E8F0");
    y += 15;

    doc.fillColor("#1a56db").fontSize(15).font("Helvetica-Bold").text("Technical Levels", 50, y);
    y += 25;
    const techData = [
      ["Support", formatPrice(data.levels.support, data.financials.currency)],
      ["Stop Loss", formatPrice(data.levels.stopLoss, data.financials.currency)],
      ["Resistance", formatPrice(data.levels.resistance, data.financials.currency)],
      ["Target 1", formatPrice(data.levels.target1, data.financials.currency)],
      ["Target 2", formatPrice(data.levels.target2, data.financials.currency)],
      ["Analyst Target", formatPrice(data.financials.targetMeanPrice, data.financials.currency)],
    ];
    techData.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const tx = 50 + col * 170;
      const ty = y + row * 35;
      doc.fillColor("#64748B").fontSize(9).font("Helvetica").text(label, tx, ty);
      doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text(value, tx, ty + 13);
    });

    y += 90;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#E2E8F0");
    y += 15;

    doc.fillColor("#1a56db").fontSize(15).font("Helvetica-Bold").text("Investment Case", 50, y);
    y += 25;
    doc.fillColor("#111827").fontSize(10).font("Helvetica").text(`52W Position: ${data.weekRange52Position}`, 50, y);
    y += 18;
    doc.text(`Valuation: ${data.valuationSummary}`, 50, y, { width: pageWidth });
    y += 35;
    doc.fillColor("#475569").fontSize(11).font("Helvetica-Oblique").text(data.rating.rationale, 50, y, { width: pageWidth });

    y += 55;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#E2E8F0");
    y += 15;
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Score Breakdown", 50, y);
    y += 20;
    const scores = [
      { label: "Fundamentals", score: data.rating.breakdown.fundamentals, weight: "40%" },
      { label: "Valuation", score: data.rating.breakdown.valuation, weight: "30%" },
      { label: "Momentum", score: data.rating.breakdown.momentum, weight: "30%" },
    ];
    scores.forEach(({ label, score, weight }, i) => {
      const sx = 50 + i * 170;
      doc.rect(sx, y, 150, 50).fill("#F8FAFC").stroke("#E2E8F0");
      doc.fillColor("#64748B").fontSize(9).font("Helvetica").text(`${label} (${weight})`, sx + 5, y + 5, { width: 140 });
      const scoreColor = score >= 65 ? "#16a34a" : score >= 45 ? "#f59e0b" : "#dc2626";
      doc.fillColor(scoreColor).fontSize(18).font("Helvetica-Bold").text(`${score}/100`, sx + 5, y + 22, { width: 140, align: "center" });
    });

    const bottomY = doc.page.height - 80;
    doc.rect(0, bottomY - 10, doc.page.width, 90).fill("#F1F5F9");
    doc.fillColor("#1a56db").fontSize(12).font("Helvetica-Bold").text("Prepared by: Sangram Kesari Mohanty, CFP", 50, bottomY);
    doc.fillColor("#475569").fontSize(10).font("Helvetica").text("FintekPro Research | Certified Financial Planner", 50, bottomY + 18);
    doc.fillColor("#94A3B8").fontSize(8).font("Helvetica-Oblique").text(
      "Disclaimer: This report is for informational purposes only and does not constitute investment advice. Please consult your financial advisor.",
      50, bottomY + 38, { width: pageWidth }
    );

    doc.end();
  });
}

export async function generateOnePager(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, 60).fill("#1a56db");
    doc.fillColor("#FFFFFF").fontSize(20).font("Helvetica-Bold").text("FintekPro Research — Client Note", 40, 12);
    doc.fontSize(10).font("Helvetica").fillColor("#CBD5E1").text("Quick Reference | One Pager", 40, 38);

    doc.fillColor("#111827").fontSize(20).font("Helvetica-Bold").text(data.companyName, 40, 80);
    doc.fontSize(11).font("Helvetica").fillColor("#475569").text(`${data.symbol} | ${data.exchange}`, 40, 105);

    const ratingColor = data.rating.rating.includes("BUY") ? "#16a34a" : data.rating.rating === "HOLD" ? "#f59e0b" : "#dc2626";
    doc.rect(40, 125, 140, 30).fill(ratingColor);
    doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text(data.rating.rating, 40, 134, { width: 140, align: "center" });
    doc.fillColor("#111827").fontSize(11).font("Helvetica").text(`Score: ${data.rating.score}/100`, 195, 134);

    doc.moveTo(40, 165).lineTo(doc.page.width - 40, 165).stroke("#1a56db");

    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Key Metrics", 40, 175);
    const fop = data.financials as any;
    const keyMetrics = [
      `Price: ${formatPrice(data.financials.price, data.financials.currency)}`,
      `Market Cap: ${formatMarketCap(data.financials.marketCap, data.financials.currency)}`,
      `P/E: ${formatNumber(data.financials.pe)} | P/B: ${fop.pbRatio != null ? Number(fop.pbRatio).toFixed(2) + "x" : "N/A"}`,
      `ROE: ${formatPercent(data.financials.roe)} | ROCE: ${formatPercent(fop.roce)}`,
      `D/E: ${formatNumber(data.financials.debtToEquity)} | Div.Yield: ${formatPercent(data.financials.dividendYield)}`,
      `Rev.Growth: ${formatPercent(data.financials.revenueGrowth)} | EPS Growth: ${formatPercent(data.financials.earningsGrowth)}`,
    ];
    doc.fillColor("#111827").fontSize(10).font("Helvetica");
    keyMetrics.forEach((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(`• ${m}`, 40 + col * 260, 198 + row * 18);
    });

    doc.moveTo(40, 265).lineTo(doc.page.width - 40, 265).stroke("#E2E8F0");
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Price Levels", 40, 275);
    const levels = [
      `Stop Loss: ${formatPrice(data.levels.stopLoss, data.financials.currency)}`,
      `Support: ${formatPrice(data.levels.support, data.financials.currency)}`,
      `Target 1: ${formatPrice(data.levels.target1, data.financials.currency)}`,
      `Target 2: ${formatPrice(data.levels.target2, data.financials.currency)}`,
    ];
    doc.fillColor("#111827").fontSize(10).font("Helvetica");
    levels.forEach((l, i) => {
      doc.text(`• ${l}`, 40 + (i % 2) * 260, 295 + Math.floor(i / 2) * 18);
    });

    doc.moveTo(40, 345).lineTo(doc.page.width - 40, 345).stroke("#E2E8F0");
    doc.fillColor("#1a56db").fontSize(13).font("Helvetica-Bold").text("Investment Rationale", 40, 355);
    doc.fillColor("#475569").fontSize(10).font("Helvetica-Oblique").text(data.rating.rationale, 40, 375, { width: doc.page.width - 80 });
    doc.font("Helvetica").fillColor("#111827").text(`52W Position: ${data.weekRange52Position}`, 40, 410);

    const bY = doc.page.height - 70;
    doc.rect(0, bY - 10, doc.page.width, 80).fill("#F1F5F9");
    doc.fillColor("#1a56db").fontSize(11).font("Helvetica-Bold").text("Sangram Kesari Mohanty, CFP | FintekPro Research", 40, bY);
    doc.fillColor("#94A3B8").fontSize(8).font("Helvetica-Oblique").text(
      "For informational use only. Not investment advice. Consult your financial advisor.", 40, bY + 18, { width: doc.page.width - 80 }
    );

    doc.end();
  });
}
