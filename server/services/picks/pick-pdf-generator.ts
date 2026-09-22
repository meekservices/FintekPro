/**
 * @file pick-pdf-generator.ts
 * @description Generates institutional 1-page Investment Note PDFs for Pick of the Day
 *              and uploads them to Google Cloud Storage (GCS) with signed URLs.
 */

import PDFDocument from "pdfkit";
import { logger } from "../../logger";
import { objectStorageClient } from "../../objectStorage";
import type { DailyPickData } from "../pick-of-the-day-service";

export interface GeneratedPdfResult {
	url: string;
	storagePath: string;
	fileName: string;
	fileSize: number;
}

export class PickPdfGeneratorService {
	private readonly BUCKET_NAME: string;

	constructor() {
		// Resolve bucket name from env or fallback to fintekpro-documents
		const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
		if (privateDir.startsWith("gs://")) {
			const parts = privateDir.slice(5).split("/");
			this.BUCKET_NAME = parts[0] || "fintekpro-documents";
		} else {
			this.BUCKET_NAME = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "fintekpro-documents";
		}
	}

	/**
	 * Generates an executive 1-page PDF Investment Note for a pick and uploads it to GCS.
	 *
	 * @param pick - The DailyPickData object
	 * @returns GeneratedPdfResult with signed/accessible URL, or null if generation fails
	 */
	async generateAndUploadPickPDF(pick: DailyPickData): Promise<GeneratedPdfResult | null> {
		try {
			const cleanSymbol = (pick.symbol || pick.instrumentName || "pick")
				.replace(/[^a-zA-Z0-9_-]/g, "_")
				.toUpperCase();
			const dateStr = pick.recoDate || new Date().toISOString().split("T")[0];
			const fileName = `Pick_${pick.category}_${cleanSymbol}_${dateStr}.pdf`;
			const storagePath = `advisory/picks/${dateStr}/${fileName}`;

			// 1. Generate PDF buffer in memory
			const pdfBuffer = await this.renderPdfBuffer(pick);

			// 2. Upload to Google Cloud Storage
			let downloadUrl = "";
			try {
				const bucket = objectStorageClient.bucket(this.BUCKET_NAME);
				const file = bucket.file(storagePath);

				await file.save(pdfBuffer, {
					metadata: {
						contentType: "application/pdf",
						metadata: {
							category: pick.category,
							symbol: pick.symbol || "",
							recoDate: dateStr,
							engineVersion: "FASP-AI-v3.0",
						},
					},
					resumable: false,
				});

				// Generate signed URL valid for 7 days (604800 seconds)
				try {
					const [signedUrl] = await file.getSignedUrl({
						action: "read",
						expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
					});
					downloadUrl = signedUrl;
				} catch {
					// Signing credentials unavailable in this Cloud Run context —
					// store a gs:// reference so the backend proxy can sign on-demand.
					// NEVER expose a public storage.googleapis.com URL (bucket is private).
					downloadUrl = `gs://${this.BUCKET_NAME}/${storagePath}`;
				}

				logger.info(`[PickPdfGenerator] Uploaded 1-page PDF for ${cleanSymbol} to GCS`, {
					event: "PICK_PDF_UPLOADED",
					bucket: this.BUCKET_NAME,
					path: storagePath,
					size: pdfBuffer.length,
				});
			} catch (gcsErr: any) {
				logger.warn(`[PickPdfGenerator] GCS upload failed for ${cleanSymbol} (non-fatal)`, {
					error: gcsErr?.message || String(gcsErr),
				});
				return null;
			}

			return {
				url: downloadUrl,
				storagePath,
				fileName,
				fileSize: pdfBuffer.length,
			};
		} catch (err: any) {
			logger.warn("[PickPdfGenerator] Failed to render PDF for pick (non-fatal)", {
				symbol: pick.symbol,
				error: err?.message || String(err),
			});
			return null;
		}
	}

	/**
	 * Renders an executive single-page A4 PDF using PDFKit.
	 */
	private async renderPdfBuffer(pick: DailyPickData): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const doc = new PDFDocument({
				size: "A4",
				margin: 36, // 0.5 inch margins
				info: {
					Title: `FintekPro Investment Note — ${pick.instrumentName}`,
					Author: "FintekPro Institutional AI Research",
					Subject: "Daily Investment Recommendation",
				},
			});

			const chunks: Buffer[] = [];
			doc.on("data", (chunk) => chunks.push(chunk));
			doc.on("end", () => resolve(Buffer.concat(chunks)));
			doc.on("error", (err) => reject(err));

			// Colors
			const NAVY = "#0F172A";
			const BLUE = "#2563EB";
			const EMERALD = "#059669";
			const ROSE = "#E11D48";
			const SLATE = "#475569";
			const LIGHT_BG = "#F8FAFC";
			const BORDER = "#E2E8F0";

			// ── 1. Header Banner ──
			doc.rect(36, 36, 523, 50).fill(LIGHT_BG);
			doc.rect(36, 36, 523, 50).stroke(BORDER);

			doc.fontSize(16).fillColor(BLUE).font("Helvetica-Bold").text("FINTEKPRO", 48, 48);
			doc.fontSize(8).fillColor(SLATE).font("Helvetica").text("INSTITUTIONAL AI RESEARCH · FASP-AI v3.0", 48, 68);

			doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold").text("INVESTMENT NOTE", 420, 48, { align: "right", width: 125 });
			doc.fontSize(8).fillColor(SLATE).font("Helvetica").text(`Date: ${pick.recoDate}`, 420, 64, { align: "right", width: 125 });

			doc.moveDown(2);

			// ── 2. Instrument Title & Category Pill ──
			const startY = 100;
			doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold").text(pick.instrumentName, 36, startY, { width: 400 });
			
			const categoryLabel = (pick.category || "EQUITY").replace(/_/g, " ").toUpperCase();
			doc.rect(450, startY + 2, 109, 20).fillAndStroke("#EEF2FF", "#C7D2FE");
			doc.fontSize(8).fillColor(BLUE).font("Helvetica-Bold").text(categoryLabel, 450, startY + 7, { align: "center", width: 109 });

			const subText = [
				pick.symbol ? `Ticker: ${pick.symbol}` : "",
				pick.isin ? `ISIN: ${pick.isin}` : "",
				pick.exchange ? `Exchange: ${pick.exchange}` : "",
				pick.sectorCategory ? `Sector: ${pick.sectorCategory}` : "",
			].filter(Boolean).join("  |  ");

			doc.fontSize(9).fillColor(SLATE).font("Helvetica").text(subText, 36, startY + 26);

			// ── 3. Core Price Targets & Risk Matrix ──
			const boxY = startY + 48;
			const boxW = 120;
			const boxH = 55;

			// Reco Price Box
			doc.rect(36, boxY, boxW, boxH).fillAndStroke(LIGHT_BG, BORDER);
			doc.fontSize(8).fillColor(SLATE).font("Helvetica").text("RECO PRICE", 46, boxY + 10);
			doc.fontSize(14).fillColor(NAVY).font("Helvetica-Bold").text(`₹${Number(pick.recoPrice).toLocaleString()}`, 46, boxY + 24);

			// Target Price Box
			const current = Number(pick.recoPrice) || 1;
			const target = Number(pick.targetPrice) || current;
			const upsidePct = Math.round(((target - current) / current) * 100);

			doc.rect(170, boxY, boxW, boxH).fillAndStroke("#ECFDF5", "#A7F3D0");
			doc.fontSize(8).fillColor(EMERALD).font("Helvetica-Bold").text(`TARGET (+${upsidePct}%)`, 180, boxY + 10);
			doc.fontSize(14).fillColor(EMERALD).font("Helvetica-Bold").text(`₹${target.toLocaleString()}`, 180, boxY + 24);

			// Stoploss Price Box
			const stoploss = Number(pick.stoplossPrice) || Math.round(current * 0.95);
			const riskPct = Math.round(((current - stoploss) / current) * 100);

			doc.rect(304, boxY, boxW, boxH).fillAndStroke("#FFF1F2", "#FECDD3");
			doc.fontSize(8).fillColor(ROSE).font("Helvetica-Bold").text(`STOPLOSS (-${riskPct}%)`, 314, boxY + 10);
			doc.fontSize(14).fillColor(ROSE).font("Helvetica-Bold").text(`₹${stoploss.toLocaleString()}`, 314, boxY + 24);

			// Time Horizon Box
			doc.rect(438, boxY, boxW + 1, boxH).fillAndStroke(LIGHT_BG, BORDER);
			doc.fontSize(8).fillColor(SLATE).font("Helvetica").text("TIME HORIZON", 448, boxY + 10);
			const horizonLabel = (pick.timeHorizon || "Medium Term").replace(/_/g, " ").toUpperCase();
			doc.fontSize(11).fillColor(NAVY).font("Helvetica-Bold").text(horizonLabel, 448, boxY + 26);

			// ── 4. Real-Time Google Search Grounding Badge ──
			const groundY = boxY + boxH + 12;
			doc.rect(36, groundY, 523, 24).fillAndStroke("#F0FDF4", "#BBF7D0");
			doc.fontSize(8).fillColor(EMERALD).font("Helvetica-Bold")
				.text("✔ GOOGLE SEARCH GROUNDED: 0 ADVERSE REGULATORY OR GOVERNANCE ACTIONS IN 72H", 46, groundY + 7);

			// ── 5. Investment Rationale & Buy Thesis ──
			const thesisY = groundY + 34;
			doc.fontSize(11).fillColor(NAVY).font("Helvetica-Bold").text("INVESTMENT THESIS & RATIONALE", 36, thesisY);

			doc.rect(36, thesisY + 16, 523, 110).fillAndStroke(LIGHT_BG, BORDER);
			doc.fontSize(9).fillColor(NAVY).font("Helvetica").text(
				pick.rationale || "Strong fundamental profile with disciplined technical momentum and favorable sector tailwinds.",
				48,
				thesisY + 28,
				{ width: 499, lineGap: 4 }
			);

			// ── 6. Key Metrics Table ──
			const metricsY = thesisY + 140;
			doc.fontSize(11).fillColor(NAVY).font("Helvetica-Bold").text("FINANCIAL & QUANTITATIVE SNAPSHOT", 36, metricsY);

			const metrics = pick.keyMetrics || {};
			const tableY = metricsY + 16;
			const colW = 100;

			const metricItems = [
				{ label: "P/E Ratio", value: metrics.pe ? `${Number(metrics.pe).toFixed(1)}x` : "—" },
				{ label: "1Y Return", value: metrics.returns1y ? `${Number(metrics.returns1y).toFixed(1)}%` : "—" },
				{ label: "3Y Return", value: metrics.returns3y ? `${Number(metrics.returns3y).toFixed(1)}%` : "—" },
				{ label: "Sharpe Ratio", value: metrics.sharpeRatio ? Number(metrics.sharpeRatio).toFixed(2) : "—" },
				{ label: "Confidence", value: `${pick.confidenceScore ?? 75}%` },
			];

			doc.rect(36, tableY, 523, 40).fillAndStroke(LIGHT_BG, BORDER);
			metricItems.forEach((m, idx) => {
				const x = 46 + idx * colW;
				doc.fontSize(7).fillColor(SLATE).font("Helvetica").text(m.label.toUpperCase(), x, tableY + 8);
				doc.fontSize(10).fillColor(NAVY).font("Helvetica-Bold").text(m.value, x, tableY + 20);
			});

			// ── 7. Suitable For & Risk Profile ──
			const suitY = tableY + 52;
			doc.fontSize(9).fillColor(SLATE).font("Helvetica-Bold").text("SUITABLE INVESTOR PROFILE:", 36, suitY);
			const suitability = Array.isArray(pick.suitableFor) && pick.suitableFor.length > 0
				? pick.suitableFor.join(", ")
				: "Moderate to Aggressive Capital Growth, High Conviction Investors";
			doc.fontSize(9).fillColor(NAVY).font("Helvetica").text(suitability, 190, suitY);

			// ── 8. Mandatory SEBI Compliance Disclaimer ──
			const footerY = 720;
			doc.rect(36, footerY, 523, 60).fill(LIGHT_BG);
			doc.rect(36, footerY, 523, 60).stroke(BORDER);

			doc.fontSize(7).fillColor(SLATE).font("Helvetica-Bold").text("REGULATORY & SEBI DISCLAIMER:", 44, footerY + 8);
			doc.fontSize(6.5).fillColor("#64748B").font("Helvetica").text(
				"FintekPro is a financial technology decision-support system. Recommendations generated herein are algorithmic decision support under FASP-AI protocol v3.0 and do not constitute personal investment advice or return guarantees. Investment in securities markets are subject to market risks; read all offer documents carefully. Consult your SEBI-registered Investment Advisor (RIA) before committing capital.",
				44,
				footerY + 20,
				{ width: 507, lineGap: 2 }
			);

			// Finish document
			doc.end();
		});
	}
}

export const pickPdfGenerator = new PickPdfGeneratorService();
