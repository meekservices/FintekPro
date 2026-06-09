// @ts-nocheck
import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middleware/roleMiddleware";
import { requireAdmin } from "../middleware/roleMiddleware";
import { unifiedOCRService } from "../services/unified-ocr-service";
import { ObjectStorageService } from "../objectStorage";
import { providerRegistry } from "../partner-application-adapters";
import {
	insertPartnerApplicationSchema,
	insertPartnerApplicationDocumentSchema,
} from "@shared/schema";
import { buildRequireOwnPortfolio } from "./portfolio-core";

export function registerRiskProfilesPartnerAppPart1Routes(app: Express): void {
	const requireOwnPortfolio = buildRequireOwnPortfolio(storage);
	app.get("/api/commodities/prices", async (req, res) => {
		try {
			const prices = await storage.getCommodityPrices();
			res.json(prices);
		} catch (error) {
			console.error("Error fetching commodity prices:", error);
			res.status(500).json({ error: "Failed to fetch commodity prices" });
		}
	});

	// Currency Exchange API endpoints
	app.get("/api/currencies/supported", async (req, res) => {
		try {
			const { CurrencyExchangeService } = await import(
				"../services/currency-exchange-service"
			);
			const currencyService = CurrencyExchangeService.getInstance();
			const currencies = currencyService.getSupportedCurrencies();
			res.json(currencies);
		} catch (error) {
			console.error("Error fetching supported currencies:", error);
			res.status(500).json({ error: "Failed to fetch supported currencies" });
		}
	});

	app.get("/api/currencies/rates", async (req, res) => {
		try {
			const { currencyRates } = await import("@shared/schema");
			const baseCurrency = (req.query.base as string) || "INR";
			const rates = await db.query.currencyRates.findMany({
				where: eq(currencyRates.baseCurrency, baseCurrency),
			});

			const ratesMap = rates.reduce(
				(acc, rate) => {
					acc[rate.targetCurrency] = Number.parseFloat(rate.exchangeRate);
					return acc;
				},
				{} as Record<string, number>,
			);

			res.json({
				base: baseCurrency,
				rates: ratesMap,
				lastUpdated: rates[0]?.lastUpdated || new Date(),
			});
		} catch (error) {
			console.error("Error fetching exchange rates:", error);
			res.status(500).json({ error: "Failed to fetch exchange rates" });
		}
	});

	app.post("/api/currencies/refresh", requireAuth, async (req: any, res) => {
		try {
			const { CurrencyExchangeService } = await import(
				"../services/currency-exchange-service"
			);
			const currencyService = CurrencyExchangeService.getInstance();

			const baseCurrency = req.body.baseCurrency || "INR";
			await currencyService.updateCurrencyRates(baseCurrency);

			res.json({
				success: true,
				message: `Exchange rates refreshed for ${baseCurrency}`,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error refreshing exchange rates:", error);
			res.status(500).json({ error: "Failed to refresh exchange rates" });
		}
	});

	app.get(
		"/api/portfolios/:id/convert",
		requireOwnPortfolio,
		async (req, res) => {
			try {
				const { id } = req.params;
				const targetCurrency = (req.query.targetCurrency as string) || "USD";

				const { CurrencyExchangeService } = await import(
					"../services/currency-exchange-service"
				);
				const currencyService = CurrencyExchangeService.getInstance();

				const portfolio = await storage.getPortfolio(id);
				if (!portfolio) {
					return res.status(404).json({ error: "Portfolio not found" });
				}

				const holdings = await storage.getPortfolioHoldings(id);
				const baseCurrency = portfolio.baseCurrency || "INR";

				const convertedHoldings = await Promise.all(
					holdings.map(async (holding) => {
						const originalValue =
							Number.parseFloat(holding.quantity) *
							Number.parseFloat(holding.avgPrice);
						const convertedValue = await currencyService.convertAmount(
							originalValue,
							baseCurrency,
							targetCurrency,
						);

						return {
							...holding,
							originalCurrency: baseCurrency,
							originalValue: originalValue,
							convertedCurrency: targetCurrency,
							convertedValue: convertedValue,
						};
					}),
				);

				const totalOriginalValue = holdings.reduce(
					(sum, h) =>
						sum + Number.parseFloat(h.quantity) * Number.parseFloat(h.avgPrice),
					0,
				);
				const totalConvertedValue = await currencyService.convertAmount(
					totalOriginalValue,
					baseCurrency,
					targetCurrency,
				);

				res.json({
					portfolioId: id,
					baseCurrency,
					targetCurrency,
					totalOriginalValue,
					totalConvertedValue,
					holdings: convertedHoldings,
				});
			} catch (error) {
				console.error("Error converting portfolio:", error);
				res.status(500).json({ error: "Failed to convert portfolio" });
			}
		},
	);

	// Risk Profiling API endpoints

	// Get all risk profiles (Admin/Support only)
	app.get("/api/risk-profiles", async (req, res) => {
		try {
			const profiles = await storage.getAllRiskProfiles();
			res.json(profiles);
		} catch (error) {
			console.error("Error fetching risk profiles:", error);
			res.status(500).json({ error: "Failed to fetch risk profiles" });
		}
	});

	// Get risk profile for a specific user
	app.get("/api/risk-profiles/user/:userId", async (req, res) => {
		try {
			const { userId } = req.params;
			const profile = await storage.getRiskProfile(userId);
			if (profile) {
				res.json(profile);
			} else {
				res.status(404).json({ error: "Risk profile not found" });
			}
		} catch (error) {
			console.error("Error fetching risk profile:", error);
			res.status(500).json({ error: "Failed to fetch risk profile" });
		}
	});

	// Create new risk profile
	app.post("/api/risk-profiles", async (req, res) => {
		try {
			const profile = await storage.createRiskProfile(req.body);
			res.status(201).json(profile);
		} catch (error) {
			console.error("Error creating risk profile:", error);
			res.status(500).json({ error: "Failed to create risk profile" });
		}
	});

	// Update risk profile
	app.put("/api/risk-profiles/:id", async (req, res) => {
		try {
			const { id } = req.params;
			const profile = await storage.updateRiskProfile(id, req.body);
			if (profile) {
				res.json(profile);
			} else {
				res.status(404).json({ error: "Risk profile not found" });
			}
		} catch (error) {
			console.error("Error updating risk profile:", error);
			res.status(500).json({ error: "Failed to update risk profile" });
		}
	});

	// Delete risk profile
	app.delete("/api/risk-profiles/:id", async (req, res) => {
		try {
			const { id } = req.params;
			await storage.deleteRiskProfile(id);
			res.status(204).send();
		} catch (error) {
			console.error("Error deleting risk profile:", error);
			res.status(500).json({ error: "Failed to delete risk profile" });
		}
	});

	// Risk Assessment Questions API

	// Get all assessment questions
	app.get("/api/risk-assessment-questions", async (req, res) => {
		try {
			const questions = await storage.getRiskAssessmentQuestions();
			res.json(questions);
		} catch (error) {
			console.error("Error fetching risk assessment questions:", error);
			res
				.status(500)
				.json({ error: "Failed to fetch risk assessment questions" });
		}
	});

	// Create new assessment question
	app.post("/api/risk-assessment-questions", async (req, res) => {
		try {
			const question = await storage.createRiskAssessmentQuestion(req.body);
			res.status(201).json(question);
		} catch (error) {
			console.error("Error creating risk assessment question:", error);
			res
				.status(500)
				.json({ error: "Failed to create risk assessment question" });
		}
	});

	// Update assessment question
	app.put("/api/risk-assessment-questions/:id", async (req, res) => {
		try {
			const { id } = req.params;
			const question = await storage.updateRiskAssessmentQuestion(id, req.body);
			if (question) {
				res.json(question);
			} else {
				res.status(404).json({ error: "Risk assessment question not found" });
			}
		} catch (error) {
			console.error("Error updating risk assessment question:", error);
			res
				.status(500)
				.json({ error: "Failed to update risk assessment question" });
		}
	});

	// Delete assessment question
	app.delete("/api/risk-assessment-questions/:id", async (req, res) => {
		try {
			const { id } = req.params;
			await storage.deleteRiskAssessmentQuestion(id);
			res.status(204).send();
		} catch (error) {
			console.error("Error deleting risk assessment question:", error);
			res
				.status(500)
				.json({ error: "Failed to delete risk assessment question" });
		}
	});

	// Get OCR service status (unified — covers Gemini Vision + Sandbox ITR)
	app.get("/api/ocr/status", async (req, res) => {
		try {
			const unified = unifiedOCRService.getStatus();
			const itr = sandboxITRService.getOCRStatus();
			res.json({
				success: true,
				available: unified.available || itr.available,
				message: unified.available
					? "Unified OCR service ready (Gemini Vision + Sandbox ITR)"
					: itr.available
						? "ITR-only OCR ready (Sandbox.co.in); Gemini Vision not configured"
						: "OCR service not configured — set GEMINI_API_KEY or SANDBOX_API_KEY",
				providers: unified.providers,
				capabilities: unified.capabilities,
				itr: { available: itr.available, endpoints: itr.endpoints },
			});
		} catch (error) {
			console.error("OCR status check error:", error);
			res
				.status(500)
				.json({ success: false, error: "OCR status check failed" });
		}
	});

	// ── NEW: General-purpose text extraction (scanned PDF or image) ─────
	// POST /api/ocr/extract-text
	// Body: { fileData: base64, mimeType?, hint?, fileName? }
	// mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'
	// hint: 'financial_statement' | 'tax_document' | 'kyc_document' | 'bank_statement' | 'invoice' | 'general'
	app.post("/api/ocr/extract-text", async (req, res) => {
		try {
			const {
				fileData,
				mimeType = "application/pdf",
				hint = "general",
				fileName,
			} = req.body;

			if (!fileData) {
				return res.status(400).json({
					success: false,
					error: "fileData is required (base64-encoded document)",
				});
			}

			const SUPPORTED_MIMES: DocumentMimeType[] = [
				"application/pdf",
				"image/jpeg",
				"image/png",
				"image/webp",
				"image/heic",
				"image/heif",
			];
			if (!SUPPORTED_MIMES.includes(mimeType)) {
				return res.status(400).json({
					success: false,
					error: `Unsupported mimeType. Allowed: ${SUPPORTED_MIMES.join(", ")}`,
				});
			}

			const SUPPORTED_HINTS: DocumentHint[] = [
				"financial_statement",
				"tax_document",
				"kyc_document",
				"bank_statement",
				"invoice",
				"general",
			];
			const resolvedHint: DocumentHint = SUPPORTED_HINTS.includes(hint)
				? hint
				: "general";

			const buffer = Buffer.from(fileData, "base64");
			const result = await unifiedOCRService.extractText(
				buffer,
				mimeType as DocumentMimeType,
				resolvedHint,
			);

			if (!result.success) {
				return res.status(422).json({
					success: false,
					error: result.error,
					provider: result.provider,
					processingTimeMs: result.processingTimeMs,
				});
			}

			res.json({
				success: true,
				text: result.text,
				provider: result.provider,
				confidence: result.confidence,
				processingTimeMs: result.processingTimeMs,
				wordCount: result.text.split(/\s+/).filter(Boolean).length,
				fileName,
			});
		} catch (error: any) {
			console.error("OCR extract-text error:", error);
			res.status(500).json({
				success: false,
				error: "OCR text extraction failed",
				message: error?.message || "Unknown error",
			});
		}
	});

	// Parse Form 16 document using OCR
	app.post("/api/ocr/form16", async (req, res) => {
		try {
			const { fileData, fileName } = req.body;

			if (!fileData) {
				return res.status(400).json({
					success: false,
					error: "File data is required (base64 encoded PDF)",
				});
			}

			// Convert base64 to buffer
			const fileBuffer = Buffer.from(fileData, "base64");
			const result = await sandboxITRService.parseForm16(
				fileBuffer,
				fileName || "form16.pdf",
			);

			res.json(result);
		} catch (error) {
			console.error("Form 16 OCR error:", error);
			res.status(500).json({
				success: false,
				error: "Form 16 OCR parsing failed",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// Parse Form 26AS document using OCR
}
