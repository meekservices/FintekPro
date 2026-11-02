/* eslint-disable no-console */
import { Router } from "express";
import { aiInvestmentService } from "../services/ai-investment-service";
import { db } from "../db";
import {
	portfolios,
	portfolioHoldings,
	aiProfitPicks,
	portfolioAlerts,
	aiPortfolioAnalysis,
	aiTalkingPoints,
	marketData,
	prospectClients,
	users,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { prospectPortfolioSyncService } from "../services/prospect-portfolio-sync-service";
import { requireRole } from "../middleware/roleMiddleware";
import { requireAuth } from "../middleware/auth";
import { unifiedPortfolioImportService } from "../services/unified-portfolio-import-service";
import { wrapAdvisoryResponse } from "../utils/fasp-ai-response";
import { resolveClientType } from "../utils/client-resolver";
import { errorResponse } from "../utils/error-response";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const manualEntrySchema = z.object({
	clientId: z.string(),
	holdings: z.array(
		z.object({
			symbol: z.string(),
			stockName: z.string().optional(),
			quantity: z.number().positive(),
			avgPrice: z.number().positive(),
			assetType: z.string().default("equity"),
			sector: z.string().optional(),
			purchaseDate: z.string().optional(), // ISO date string for exit load & capital gains calculation
		}),
	),
});

const csvUploadSchema = z.object({
	clientId: z.string(),
});

router.put("/ai/alert/:alertId/action", requireAuth, async (req, res) => {
	try {
		const { alertId } = req.params;
		const { action, notes, agentId } = req.body;

		const [updated] = await db
			.update(portfolioAlerts)
			.set({
				agentViewed: true,
				agentViewedAt: new Date(),
				agentAction: action,
				agentActionAt: new Date(),
				agentNotes: notes,
				status:
					action === "dismissed"
						? "resolved"
						: action === "acted"
							? "resolved"
							: "active",
				updatedAt: new Date(),
			})
			.where(eq(portfolioAlerts.id, alertId))
			.returning();

		res.json(wrapAdvisoryResponse({
			success: true,
			alert: updated,
		}));
	} catch (error) {
		console.error("Error updating alert:", error);
		res.status(500).json({
			success: false,
			error: "Failed to update alert",
		});
	}
});

router.post("/proposals/from-ai-stocks", requireAuth, async (req, res) => {
	try {
		const { clientId, agentId, pickIds, title } = req.body;

		if (!clientId || !agentId || !pickIds?.length) {
			return res.status(400).json({
				success: false,
				error: "Client ID, Agent ID, and Pick IDs are required",
			});
		}

		const result = await aiInvestmentService.createProposalFromPicks(
			clientId,
			agentId,
			pickIds,
			title,
		);

		res.json(wrapAdvisoryResponse({
			success: true,
			...result,
			message: `Created proposal with ${result.itemCount} items`,
		}));
	} catch (error) {
		console.error("Error creating proposal from AI stocks:", error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to create proposal",
		});
	}
});

router.get("/ai/analysis/:clientId", requireAuth, async (req, res) => {
	try {
		const { clientId } = req.params;
		const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
		const limit = Math.min(parseInt(String(req.query.limit ?? "10")), 100);
		const offset = (page - 1) * limit;

		const [countRow, analyses] = await Promise.all([
			db
				.select({ total: count() })
				.from(aiPortfolioAnalysis)
				.where(eq(aiPortfolioAnalysis.clientId, clientId)),
			db
				.select()
				.from(aiPortfolioAnalysis)
				.where(eq(aiPortfolioAnalysis.clientId, clientId))
				.orderBy(desc(aiPortfolioAnalysis.createdAt))
				.limit(limit)
				.offset(offset),
		]);

		const total = countRow[0]?.total ?? 0;

		res.json(wrapAdvisoryResponse({
			success: true,
			analyses,
			count: analyses.length,
			meta: { page, limit, total, totalPages: Math.ceil(Number(total) / limit) },
		}));
	} catch (error) {
		console.error("Error fetching analyses:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch analyses",
		});
	}
});

router.get("/ai/analysis/detail/:analysisId", requireAuth, async (req, res) => {
	try {
		const { analysisId } = req.params;

		const [analysis] = await db
			.select()
			.from(aiPortfolioAnalysis)
			.where(eq(aiPortfolioAnalysis.id, analysisId))
			.limit(1);

		if (!analysis) {
			return res.status(404).json({
				success: false,
				error: "Analysis not found",
			});
		}

		res.json(wrapAdvisoryResponse({
			success: true,
			analysis,
		}));
	} catch (error) {
		console.error("Error fetching analysis:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch analysis",
		});
	}
});

// ============================================
// Frontend-compatible wrapper routes
// ============================================

// POST endpoint for adding holdings
router.post("/portfolio/:clientId/holdings", requireAuth, async (req, res) => {
	try {
		const { clientId } = req.params;
		const { symbol, name, quantity, averagePrice, assetType, purchaseDate } =
			req.body;

		// Resolve client type (prospect vs user)
		const clientInfo = await resolveClientType(clientId);
		if (!clientInfo.isProspect && !clientInfo.isUser) {
			return res.status(404).json({ error: "Client not found" });
		}

		// For prospects: use unified currentPortfolio storage
		if (clientInfo.isProspect) {
			const holdings = await prospectPortfolioSyncService.addHolding(clientId, {
				symbol: symbol?.toUpperCase(),
				name: name || symbol,
				quantity: Number.parseFloat(quantity) || 0,
				averageCost: Number.parseFloat(averagePrice) || 0,
				currentValue:
					(Number.parseFloat(quantity) || 0) *
					(Number.parseFloat(averagePrice) || 0),
				assetType: assetType || "equity",
				purchaseDate: purchaseDate || undefined,
			});

			return res.json({
				success: true,
				holding: holdings[holdings.length - 1],
				totalHoldings: holdings.length,
			});
		}

		// For registered users: use portfolioHoldings table
		let [portfolio] = await db
			.select()
			.from(portfolios)
			.where(clientInfo.portfolioWhereClause)
			.limit(1);

		if (!portfolio) {
			[portfolio] = await db
				.insert(portfolios)
				.values(
					clientInfo.getPortfolioCreateValues("Client Portfolio", "manual"),
				)
				.returning();
		}

		// Use provided purchaseDate or default to today
		const parsedPurchaseDate = purchaseDate
			? new Date(purchaseDate)
			: new Date();

		const [inserted] = await db
			.insert(portfolioHoldings)
			.values({
				portfolioId: portfolio.id,
				symbol: symbol.toUpperCase(),
				name: name || symbol,
				quantity: String(quantity),
				avgPrice: String(averagePrice),
				assetType: assetType || "EQUITY",
				purchaseDate: parsedPurchaseDate,
				source: "manual",
			})
			.returning();

		res.json({ success: true, holding: inserted });
	} catch (error) {
		console.error("Error adding holding:", error);
		res.status(500).json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : String(error), true));
	}
});

// POST endpoint for file upload (CSV, Excel) - for PDF/HTML use /prospects/:prospectId/portfolio/upload
router.post(
	"/portfolio/:clientId/upload",
	requireAuth,
	upload.single("file"),
	async (req, res) => {
		try {
			const { clientId } = req.params;

			if (!req.file) {
				return res.status(400).json({ error: "No file uploaded" });
			}

			// Resolve client type (prospect vs user)
			const clientInfo = await resolveClientType(clientId);
			if (!clientInfo.isProspect && !clientInfo.isUser) {
				return res.status(404).json({ error: "Client not found" });
			}

			// Determine file type and use appropriate parser
			const filename = req.file.originalname.toLowerCase();
			const isCSV = filename.endsWith(".csv");
			const isExcel = filename.endsWith(".xlsx") || filename.endsWith(".xls");

			let importResult;
			if (isCSV) {
				importResult = await unifiedPortfolioImportService.importFromCSV(
					req.file.buffer.toString("utf-8"),
					req.file.originalname,
				);
			} else if (isExcel) {
				importResult = await unifiedPortfolioImportService.importFromExcel(
					req.file.buffer,
					req.file.originalname,
				);
			} else {
				return res
					.status(400)
					.json({
						error:
							"Only CSV and Excel files are supported for this endpoint. For PDF/HTML, use /prospects/:prospectId/portfolio/upload",
					});
			}

			if (!importResult.success || importResult.holdings.length === 0) {
				return res.status(400).json({
					error: importResult.errors?.[0] || "No valid holdings found in file",
				});
			}

			// For prospects: use unified currentPortfolio storage via sync service
			if (clientInfo.isProspect) {
				const normalizedHoldings = importResult.holdings.map((h) => ({
					symbol: h.symbol || h.name,
					name: h.name || h.symbol || "Unknown",
					quantity: h.quantity,
					averageCost: h.avgCostPerUnit,
					currentValue: h.currentValue,
					assetType: h.assetType || "equity",
					isin: h.isin,
					folioNumber: h.folioNumber,
					purchaseDate: h.purchaseDate,
				}));

				await prospectPortfolioSyncService.addHoldings(
					clientId,
					normalizedHoldings,
				);
				return res.json({
					success: true,
					count: normalizedHoldings.length,
					storage: "prospect_currentPortfolio",
				});
			}

			// For registered users: use portfolioHoldings table
			let [portfolio] = await db
				.select()
				.from(portfolios)
				.where(clientInfo.portfolioWhereClause)
				.limit(1);

			if (!portfolio) {
				[portfolio] = await db
					.insert(portfolios)
					.values(
						clientInfo.getPortfolioCreateValues(
							"Uploaded Portfolio",
							"uploaded",
						),
					)
					.returning();
			}

			let count = 0;
			for (const h of importResult.holdings) {
				await db.insert(portfolioHoldings).values({
					portfolioId: portfolio.id,
					symbol: h.symbol || h.name,
					name: h.name,
					quantity: String(h.quantity),
					avgPrice: String(h.avgCostPerUnit || 0),
					assetType: h.assetType || "equity",
					isin: h.isin,
					folioNumber: h.folioNumber,
					purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : new Date(),
				});
				count++;
			}

			res.json({ success: true, count });
		} catch (error) {
			console.error("Error uploading file:", error);
			res.status(500).json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : String(error), true));
		}
	},
);

// POST endpoint for bulk import (paste from Excel)
router.post("/portfolio/:clientId/bulk-import", requireAuth, async (req, res) => {
	try {
		const { clientId } = req.params;
		const { holdings, skipValidation } = req.body;

		if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
			return res.status(400).json({ error: "No holdings provided" });
		}

		const validHoldings = holdings.filter((h: any) => {
			const symbol = h.symbol?.toString().trim();
			const quantity = Number.parseFloat(h.quantity);
			return symbol && symbol.length > 0 && quantity > 0;
		});

		if (validHoldings.length === 0) {
			return res
				.status(400)
				.json({
					error:
						"No valid holdings found. Each holding must have a symbol and quantity > 0.",
				});
		}

		const invalidCount = holdings.length - validHoldings.length;
		const missingPriceCount = validHoldings.filter(
			(h: any) => !h.averagePrice || Number.parseFloat(h.averagePrice) <= 0,
		).length;

		// Resolve client type (prospect vs user)
		const clientInfo = await resolveClientType(clientId);
		if (!clientInfo.isProspect && !clientInfo.isUser) {
			return res.status(404).json({ error: "Client not found" });
		}

		let [portfolio] = await db
			.select()
			.from(portfolios)
			.where(clientInfo.portfolioWhereClause)
			.limit(1);

		if (!portfolio) {
			[portfolio] = await db
				.insert(portfolios)
				.values(
					clientInfo.getPortfolioCreateValues("Imported Portfolio", "uploaded"),
				)
				.returning();
		}

		let imported = 0;

		// For prospects: use unified currentPortfolio storage via sync service
		if (clientInfo.isProspect) {
			for (const holding of validHoldings) {
				const {
					symbol,
					name,
					quantity,
					averagePrice,
					assetType,
					isin,
					folioNumber,
					purchaseDate,
				} = holding;
				const qty = Number.parseFloat(quantity) || 0;
				const price = Number.parseFloat(averagePrice) || 0;

				await prospectPortfolioSyncService.addHolding(clientId, {
					symbol: symbol
						?.toString()
						.toUpperCase()
						.replace(/[^A-Z0-9]/g, ""),
					name: name || symbol,
					quantity: qty,
					averageCost: price,
					currentValue: qty * price,
					assetType: assetType?.toLowerCase() || "equity",
					isin: isin,
					folioNumber: folioNumber,
					purchaseDate: purchaseDate
						? new Date(purchaseDate).toISOString().split("T")[0]
						: undefined,
				});
				imported++;
			}

			return res.json({
				success: true,
				imported,
				skipped: invalidCount,
				warnings:
					missingPriceCount > 0
						? [`${missingPriceCount} holdings imported with price = 0`]
						: [],
				storage: "prospect_currentPortfolio",
			});
		}

		// For registered users: use portfolioHoldings table
		for (const holding of validHoldings) {
			const { symbol, name, quantity, averagePrice, assetType } = holding;

			await db.insert(portfolioHoldings).values({
				portfolioId: portfolio.id,
				symbol: symbol
					.toString()
					.toUpperCase()
					.replace(/[^A-Z0-9]/g, ""),
				name: name || symbol,
				quantity: String(Number.parseFloat(quantity) || 0),
				avgPrice: String(Number.parseFloat(averagePrice) || 0),
				assetType: assetType || "EQUITY",
				purchaseDate: new Date(),
			});
			imported++;
		}

		res.json(wrapAdvisoryResponse({
			success: true,
			imported,
			skipped: invalidCount,
			warnings:
				missingPriceCount > 0
					? [`${missingPriceCount} holdings imported with price = 0`]
					: [],
		}));
	} catch (error) {
		console.error("Error bulk importing holdings:", error);
		res.status(500).json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : String(error), true));
	}
});

// POST endpoint for CAS PDF preview (parse only, no import) - Uses Unified Portfolio Import Service

export default router;
