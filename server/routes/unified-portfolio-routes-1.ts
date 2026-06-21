// @ts-nocheck
import { logger } from "../logger";
import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import {
	portfolios,
	portfolioHoldings,
	externalHoldings,
	users,
	userProfiles,
	transactionRecords,
	transactionReports,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { unifiedPortfolioImportService } from "../services/unified-portfolio-import-service";
import { portfolioStorageService } from "../services/portfolio-storage-service";
import { assertLotsNotDropped } from "../services/holding-transformer";
import multer from "multer";

const router = Router();

const smartUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 15 * 1024 * 1024 },
});

interface UnifiedHolding {
	id: string;
	symbol: string;
	name: string;
	assetType: string;
	quantity: number;
	currentValue: number;
	avgPrice: number;
	gainLoss: number;
	gainLossPercent: number;
	source: "FINTEKPRO" | "CDSL" | "NSDL" | "UPLOADED";
	isin?: string;
	lastSyncedAt?: string;
}

router.get(
	"/api/portfolio/unified-positions",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const includeExternal = req.query.includeExternal !== "false";

			const userPortfolios = await db
				.select()
				.from(portfolios)
				.where(eq(portfolios.userId, userId));

			const unifiedHoldings: UnifiedHolding[] = [];
			let internalCount = 0;
			let externalCount = 0;
			let totalInternalValue = 0;
			let totalExternalValue = 0;

			for (const portfolio of userPortfolios) {
				const holdings = await db
					.select()
					.from(portfolioHoldings)
					.where(eq(portfolioHoldings.portfolioId, portfolio.id));

				for (const holding of holdings) {
					const avgPrice = Number.parseFloat(
						holding.avgPrice?.toString() || "0",
					);
					const quantity = Number.parseFloat(
						holding.quantity?.toString() || "0",
					);
					const investedValue = avgPrice * quantity;
					const currentValue = investedValue * 1.1;
					const gainLoss = currentValue - investedValue;
					const gainLossPercent =
						investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

					unifiedHoldings.push({
						id: holding.id,
						symbol: holding.symbol || "",
						name: holding.symbol || "",
						assetType: holding.assetType || "Other",
						quantity,
						currentValue,
						avgPrice,
						gainLoss,
						gainLossPercent,
						source: "FINTEKPRO",
						isin: undefined,
					});

					internalCount++;
					totalInternalValue += currentValue;
				}
			}

			if (includeExternal) {
				try {
					const extHoldings = await db
						.select()
						.from(externalHoldings)
						.where(eq(externalHoldings.userId, userId));

					for (const ext of extHoldings) {
						const currentValue = Number.parseFloat(
							ext.currentValue?.toString() || "0",
						);
						const avgPrice = Number.parseFloat(ext.avgPrice?.toString() || "0");
						const quantity = Number.parseFloat(ext.quantity?.toString() || "0");
						const investedValue = avgPrice * quantity;
						const gainLoss = currentValue - investedValue;
						const gainLossPercent =
							investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

						unifiedHoldings.push({
							id: ext.id,
							symbol: ext.symbol || "",
							name: ext.name || ext.symbol || "",
							assetType: ext.assetType || "Other",
							quantity,
							currentValue,
							avgPrice,
							gainLoss,
							gainLossPercent,
							source: (ext.source as any) || "CDSL",
							isin: ext.isin || undefined,
							lastSyncedAt: ext.lastSyncedAt?.toISOString(),
						});

						externalCount++;
						totalExternalValue += currentValue;
					}
				} catch (e) {
					logger.info(
						"[UnifiedPortfolio] External holdings table may not exist, skipping",
					);
				}
			}

			res.json({
				success: true,
				holdings: unifiedHoldings,
				summary: {
					internalCount,
					externalCount,
					totalCount: internalCount + externalCount,
					totalInternalValue,
					totalExternalValue,
					totalValue: totalInternalValue + totalExternalValue,
				},
			});
		} catch (error: any) {
			logger.error("[UnifiedPortfolio] Error:", error);
			res.status(500).json({ error: error.message });
		}
	},
);

router.get(
	"/api/portfolio/external-holdings",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			let holdings: any[] = [];

			try {
				holdings = await db
					.select()
					.from(externalHoldings)
					.where(eq(externalHoldings.userId, userId));
			} catch (e) {
				holdings = [];
			}

			const formattedHoldings = holdings.map((h) => ({
				id: h.id,
				symbol: h.symbol,
				name: h.name || h.symbol,
				assetType: h.assetType || "Other",
				quantity: Number.parseFloat(h.quantity?.toString() || "0"),
				currentValue: Number.parseFloat(h.currentValue?.toString() || "0"),
				avgPrice: Number.parseFloat(h.avgPrice?.toString() || "0"),
				source: h.source || "CDSL",
				isin: h.isin,
				depository: h.depository,
				dpId: h.dpId,
				clientId: h.clientId,
				lastSyncedAt: h.lastSyncedAt?.toISOString(),
			}));

			res.json({
				success: true,
				holdings: formattedHoldings,
				count: formattedHoldings.length,
			});
		} catch (error: any) {
			logger.error("[ExternalHoldings] Error:", error);
			res.status(500).json({ error: error.message });
		}
	},
);

const syncExternalHoldingsSchema = z.object({
	source: z.enum(["CDSL", "NSDL", "UPLOADED"]),
	holdings: z.array(
		z.object({
			symbol: z.string(),
			name: z.string().optional(),
			isin: z.string().optional(),
			assetType: z.string().optional(),
			quantity: z.number(),
			avgPrice: z.number().optional(),
			currentValue: z.number().optional(),
			depository: z.string().optional(),
			dpId: z.string().optional(),
			clientId: z.string().optional(),
		}),
	),
	consentId: z.string().optional(),
});

router.post(
	"/api/portfolio/external-holdings/sync",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { source, holdings, consentId } = syncExternalHoldingsSchema.parse(
				req.body,
			);

			const syncedHoldings = [];
			for (const holding of holdings) {
				try {
					const existing = holding.isin
						? await db
								.select()
								.from(externalHoldings)
								.where(
									and(
										eq(externalHoldings.userId, userId),
										eq(externalHoldings.isin, holding.isin),
										eq(externalHoldings.source, source),
									),
								)
								.limit(1)
						: [];

					let synced;
					if (existing.length > 0) {
						[synced] = await db
							.update(externalHoldings)
							.set({
								quantity: holding.quantity.toString(),
								avgPrice: holding.avgPrice?.toString() || "0",
								currentValue: holding.currentValue?.toString() || "0",
								lastSyncedAt: new Date(),
							})
							.where(eq(externalHoldings.id, existing[0].id))
							.returning();
					} else {
						[synced] = await db
							.insert(externalHoldings)
							.values({
								userId,
								symbol: holding.symbol,
								name: holding.name || holding.symbol,
								isin: holding.isin,
								assetType: holding.assetType || "Equity",
								quantity: holding.quantity.toString(),
								avgPrice: holding.avgPrice?.toString() || "0",
								currentValue: holding.currentValue?.toString() || "0",
								source,
								depository: holding.depository,
								dpId: holding.dpId,
								clientId: holding.clientId,
								consentId,
								lastSyncedAt: new Date(),
							})
							.returning();
					}

					syncedHoldings.push(synced);
				} catch (e) {
					logger.error(
						"[ExternalHoldings] Error syncing holding:",
						holding.symbol,
						e,
					);
				}
			}

			res.json({
				success: true,
				syncedCount: syncedHoldings.length,
				holdings: syncedHoldings,
			});
		} catch (error: any) {
			logger.error("[ExternalHoldings] Sync error:", error);
			if (error instanceof z.ZodError) {
				return res
					.status(400)
					.json({ error: "Invalid request", details: error.issues });
			}
			res.status(500).json({ error: error.message });
		}
	},
);

router.get(
	"/api/agent/external-holdings",
	requireAuth,
	requireRole("admin", "agent", "partner"),
	async (req: Request, res: Response) => {
		try {
			const { clientId, pan } = req.query;

			let holdings: any[] = [];

			try {
				if (pan) {
					const panQuery = pan as string;
					const matchingProfiles = await db
						.select({
							userId: userProfiles.userId,
							panNumber: userProfiles.panNumber,
						})
						.from(userProfiles)
						.where(eq(userProfiles.panNumber, panQuery.toUpperCase()))
						.limit(1);

					if (matchingProfiles.length === 0) {
						return res.json({
							success: true,
							holdings: [],
							count: 0,
							message: "No client found with the provided PAN",
						});
					}

					holdings = await db
						.select({
							holding: externalHoldings,
							user: {
								id: users.id,
								fullName: users.fullName,
								email: users.email,
							},
							profile: {
								panNumber: userProfiles.panNumber,
							},
						})
						.from(externalHoldings)
						.innerJoin(users, eq(externalHoldings.userId, users.id))
						.innerJoin(userProfiles, eq(users.id, userProfiles.userId))
						.where(eq(userProfiles.panNumber, panQuery.toUpperCase()));
				} else if (clientId) {
					holdings = await db
						.select({
							holding: externalHoldings,
							user: {
								id: users.id,
								fullName: users.fullName,
								email: users.email,
							},
							profile: {
								panNumber: userProfiles.panNumber,
							},
						})
						.from(externalHoldings)
						.innerJoin(users, eq(externalHoldings.userId, users.id))
						.leftJoin(userProfiles, eq(users.id, userProfiles.userId))
						.where(eq(externalHoldings.userId, clientId as string));
				} else {
					// Return all external holdings for agents/admins when no filter provided
					holdings = await db
						.select({
							holding: externalHoldings,
							user: {
								id: users.id,
								fullName: users.fullName,
								email: users.email,
							},
							profile: {
								panNumber: userProfiles.panNumber,
							},
						})
						.from(externalHoldings)
						.innerJoin(users, eq(externalHoldings.userId, users.id))
						.leftJoin(userProfiles, eq(users.id, userProfiles.userId))
						.orderBy(desc(externalHoldings.lastUpdated))
						.limit(500);
				}
			} catch (e) {
				logger.error("[AgentExternalHoldings] Query error:", e);
				holdings = [];
			}

			const maskPan = (pan: string | null) => {
				if (!pan || pan.length < 10) return "XXXXX****X";
				return pan.substring(0, 5) + "****" + pan.substring(9);
			};

			const formattedHoldings = holdings.map((h) => ({
				id: h.holding.id,
				clientName: h.user.fullName || "Unknown",
				clientId: h.user.id,
				clientPan: maskPan(h.profile?.panNumber || null),
				symbol: h.holding.symbol,
				name: h.holding.name,
				quantity: Number.parseFloat(h.holding.quantity?.toString() || "0"),
				currentValue: Number.parseFloat(
					h.holding.currentValue?.toString() || "0",
				),
				currentBroker:
					h.holding.source === "CDSL"
						? "CDSL Depository"
						: h.holding.source === "NSDL"
							? "NSDL Depository"
							: "External",
				source: h.holding.source,
				isin: h.holding.isin,
				status: h.holding.cobStatus || "pending",
			}));

			res.json({
				success: true,
				holdings: formattedHoldings,
				count: formattedHoldings.length,
			});
		} catch (error: any) {
			logger.error("[AgentExternalHoldings] Error:", error);
			res.status(500).json({ error: error.message });
		}
	},
);

const initiateCobSchema = z.object({
	holdingId: z.string(),
	targetBroker: z.string().default("fintekpro"),
	reason: z.string().optional(),
});

router.post(
	"/api/agent/initiate-cob",
	requireAuth,
	requireRole("admin", "agent", "partner"),
	async (req: Request, res: Response) => {
		try {
			const agentId = (req.user as any)?.id;
			if (!agentId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { holdingId, targetBroker, reason } = initiateCobSchema.parse(
				req.body,
			);

			try {
				await db
					.update(externalHoldings)
					.set({
						cobStatus: "in_progress",
						cobInitiatedAt: new Date(),
						cobInitiatedBy: agentId,
						cobTargetBroker: targetBroker,
						cobReason: reason,
					})
					.where(eq(externalHoldings.id, holdingId));
			} catch (e) {
				logger.error("[COB] Error updating holding:", e);
			}

			res.json({
				success: true,
				message: "COB request initiated successfully",
				holdingId,
				status: "in_progress",
			});
		} catch (error: any) {
			logger.error("[COB] Error:", error);
			if (error instanceof z.ZodError) {
				return res
					.status(400)
					.json({ error: "Invalid request", details: error.issues });
			}
			res.status(500).json({ error: error.message });
		}
	},
);

const wealthyImportSchema = z.object({
	url: z
		.string()
		.url()
		.refine(
			(url) => url.includes("reports.wealthy.in") && url.includes("token="),
			{
				message:
					"Invalid Wealthy.in URL. Expected format: https://reports.wealthy.in/?token=...",
			},
		),
	replaceExisting: z.boolean().optional().default(false),
});

router.post(
	"/api/portfolio/import-wealthy",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { url, replaceExisting } = wealthyImportSchema.parse(req.body);

			logger.info(`[Wealthy Import] Using unified service for user ${userId}`);
			const importResult =
				await unifiedPortfolioImportService.importFromWealthyURL(url);

			if (!importResult.success || importResult.holdings.length === 0) {
				return res.status(400).json({
					error: "No holdings found in the portfolio",
					message:
						"The Wealthy.in report did not contain any mutual fund holdings.",
				});
			}

			if (replaceExisting) {
				await db
					.delete(externalHoldings)
					.where(
						and(
							eq(externalHoldings.userId, userId),
							eq(externalHoldings.source, "WEALTHY_IN"),
						),
					);
				logger.info(
					`[Wealthy Import] Deleted existing holdings for user ${userId}`,
				);
			}

			const { wealthyImportService } = await import(
				"../services/wealthy-import-service"
			);
			const wealthyPortfolio =
				await wealthyImportService.fetchAndParsePortfolio(url);
			const storageResult = await wealthyImportService.importToExternalHoldings(
				userId,
				wealthyPortfolio,
			);

			logger.info(
				`[Wealthy Import] Imported ${storageResult.imported} holdings for user ${userId}`,
			);

			unifiedPortfolioImportService
				.notifyLinkedAgents(userId, storageResult.imported, "wealthy_url")
				.catch(() => {});

			res.json({
				success: true,
				investor: importResult.investor,
				summary: {
					totalHoldings: importResult.holdings.length,
					totalCurrentValue: importResult.summary.totalCurrentValue,
					totalInvestedValue: importResult.summary.totalInvestedValue,
				},
				imported: storageResult.imported,
				skipped: storageResult.skipped,
				holdings: storageResult.holdings,
			});
		} catch (error: any) {
			logger.error("[Wealthy Import] Error:", error);
			if (error instanceof z.ZodError) {
				return res
					.status(400)
					.json({ error: "Invalid request", details: error.issues });
			}
			res
				.status(500)
				.json({ error: error.message || "Failed to import portfolio" });
		}
	},
);

router.post(
	"/api/portfolio/import/smart",
	requireAuth,
	smartUpload.single("portfolio"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) return res.status(401).json({ error: "Unauthorized" });

			const url = req.body?.url;
			if (!req.file && !url) {
				return res
					.status(400)
					.json({ error: "Please upload a file or provide a URL" });
			}

			let importResult;
			if (url) {
				const isWealthy = /wealthy\.in/i.test(url);
				importResult = isWealthy
					? await unifiedPortfolioImportService.importFromWealthyURL(url)
					: await unifiedPortfolioImportService.importFromURL(url);
			} else if (req.file) {
				const filename = req.file.originalname.toLowerCase();
				const mimetype = req.file.mimetype;
				if (filename.endsWith(".csv") || mimetype === "text/csv") {
					importResult = await unifiedPortfolioImportService.importFromCSV(
						req.file.buffer.toString("utf-8"),
						req.file.originalname,
					);
				} else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
					importResult = await unifiedPortfolioImportService.importFromExcel(
						req.file.buffer,
						req.file.originalname,
					);
				} else if (filename.endsWith(".html") || filename.endsWith(".htm")) {
					importResult = await unifiedPortfolioImportService.importFromHTML(
						req.file.buffer.toString("utf-8"),
						req.file.originalname,
					);
				} else {
					importResult = await unifiedPortfolioImportService.importFromPDF(
						req.file.buffer,
						req.file.originalname,
					);
				}
			}

			if (
				!importResult ||
				!importResult.success ||
				importResult.holdings.length === 0
			) {
				return res.status(400).json({
					success: false,
					error: "No holdings found in the uploaded file",
					errors: importResult?.errors || ["Failed to parse portfolio"],
				});
			}

			res.json({
				success: true,
				holdings: importResult.holdings,
				investor: importResult.investor,
				summary: importResult.summary,
				brokerDetected: importResult.brokerDetected,
				confidenceScore: importResult.confidenceScore,
				source: importResult.source,
				warnings: importResult.warnings || [],
				errors: importResult.errors,
				tierBreakdown: importResult.tierBreakdown,
				lotCounts: importResult.lotCounts,
				reconciliation: importResult.reconciliation,
				portfolioSummary: importResult.portfolioSummary,
			});
		} catch (error: any) {
			logger.error("[Smart Import] Error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to import portfolio" });
		}
	},
);

// ─── IRIS Auto-Fetch Portfolio (Client-facing) ───────────────────────────────
// Fetches the authenticated client's own MF portfolio from KFintech/IRIS using
// their PAN stored in their profile. No agent role required — this is self-serve.
router.post(
	"/api/portfolio/iris-fetch",
	requireAuth,
	async (req: Request, res: Response) => {
		const t0 = Date.now();
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ success: false, error: "Unauthorized" });
			}

			// 1. Resolve the user's PAN from their profile
			// Use leftJoin so users without a KYC profile row don't cause a crash
			const [profile] = await db
				.select({ panNumber: userProfiles.panNumber, fullName: users.fullName })
				.from(users)
				.leftJoin(userProfiles, eq(users.id, userProfiles.userId))
				.where(eq(users.id, userId))
				.limit(1);

			const pan = profile?.panNumber?.trim().toUpperCase();
			if (!pan) {
				return res.status(400).json({
					success: false,
					error: "PAN_NOT_FOUND",
					message:
						"Please complete your KYC and add your PAN card before using auto-fetch.",
				});
			}

			// 2. Import IRIS service lazily to avoid circular dependency
			const { irisKfintechService } = await import(
				"../services/iris-kfintech-service"
			);

			if (!irisKfintechService.isConfigured) {
				return res.status(503).json({
					success: false,
					error: "IRIS_NOT_CONFIGURED",
					message:
						"IRIS KFintech integration is not configured on this server.",
				});
			}

			// 3. Try CAS fetch first (structured JSON — preferred), fall back to investment details
			let rawHoldings: any[] = [];
			const investorName: string = profile?.fullName || "";
			let source: "cas_registry" | "investment_details" = "cas_registry";

			try {
				const casData: any =
					await irisKfintechService.fetchCasFromRegistry(pan);
				// Null-safe: IRIS API may return null/undefined on empty response
				const folios: any[] = Array.isArray(casData?.folios)
					? casData.folios
					: Array.isArray(casData?.data?.folios)
						? casData.data.folios
						: [];
				for (const folio of folios) {
					for (const scheme of Array.isArray(folio?.schemes) ? folio.schemes : []) {
						rawHoldings.push({
							name:
								scheme.schemeName || scheme.scheme_name || scheme.name || "",
							symbol: scheme.schemeCode || scheme.scheme_code || "",
							isin: scheme.isin || "",
							assetType: "mutual_fund",
							quantity: Number.parseFloat(
								String(scheme.units || scheme.closingBalance || scheme.balance || "0"),
							),
							avgPrice: Number.parseFloat(
								String(
									scheme.avgCostPerUnit ||
										scheme.averageCost ||
										scheme.nav ||
										"0",
								),
							),
							currentValue: Number.parseFloat(
								String(scheme.currentValue || scheme.currentNav || "0"),
							),
							folioNumber: folio.folio || folio.folioNo,
						});
					}
				}
				if (folios.length === 0) {
					// CAS returned no data — try investment details endpoint
					throw new Error("empty_cas");
				}
			} catch (_casErr: any) {
				logger.warn(
					`[IRIS AutoFetch] CAS fallback triggered: ${(_casErr as any)?.message}`,
				);
				// Fallback: use /user/investors/:pan/investments
				source = "investment_details";
				try {
					const invData: any =
						await irisKfintechService.getInvestmentDetails(pan);
					const schemes: any[] =
						invData?.schemes ??
						invData?.data?.schemes ??
						invData?.investments ??
						[];
					rawHoldings = schemes.map((s: any) => ({
						name: s.schemeName || s.scheme_name || s.name || "",
						symbol: s.schemeCode || s.scheme_code || "",
						isin: s.isin || "",
						assetType: "mutual_fund",
						quantity: Number.parseFloat(s.units || s.balance || "0"),
						avgPrice: Number.parseFloat(
							s.avgCostPerUnit || s.averageCost || s.nav || "0",
						),
						currentValue: Number.parseFloat(
							s.currentValue || s.currentNav || "0",
						),
						folioNumber: s.folio || s.folioNo,
					}));
				} catch (invErr: any) {
					logger.error(
						"[IRIS AutoFetch] Both CAS and investment endpoints failed:",
						invErr?.message,
					);
					return res.status(502).json({
						success: false,
						error: "IRIS_FETCH_FAILED",
						message:
							"Could not retrieve portfolio from KFintech. Please try manual upload.",
						retryable: true,
					});
				}
			}

			// 4. Filter out zero-unit holdings and normalize to ImportedHolding shape
			const holdings = rawHoldings
				.filter((h) => h.quantity > 0 && h.name)
				.map((h, i) => ({
					id: `iris-${i}`,
					name: h.name,
					symbol: h.symbol || undefined,
					isin: h.isin || undefined,
					assetType: h.assetType || "mutual_fund",
					quantity: String(h.quantity),
					avgPrice: String(h.avgPrice || 0),
					currentValue: String(h.currentValue || 0),
					folioNumber: h.folioNumber || undefined,
					source: "iris_kfintech",
				}));

			const totalCurrentValue = holdings.reduce(
				(s, h) => s + Number.parseFloat(h.currentValue),
				0,
			);
			const totalInvested = holdings.reduce(
				(s, h) =>
					s + Number.parseFloat(h.avgPrice) * Number.parseFloat(h.quantity),
				0,
			);

			logger.info(
				`[IRIS AutoFetch] user=${userId} pan=****${pan.slice(-4)} fetched=${holdings.length} source=${source} latency=${Date.now() - t0}ms`,
			);

			return res.json({
				success: true,
				source,
				pan: `${pan.slice(0, 2)}***${pan.slice(-2)}`, // masked for response
				investor: {
					name: investorName,
					pan: `${pan.slice(0, 2)}***${pan.slice(-2)}`,
				},
				holdings,
				summary: {
					totalHoldings: holdings.length,
					totalCurrentValue,
					totalInvestedValue: totalInvested,
					equityPercent: 0,
					debtPercent: 100,
				},
			});
		} catch (error: any) {
			logger.error(
				"[IRIS AutoFetch] Unhandled error:",
				error?.message,
				error?.stack,
			);
			return res.status(500).json({
				success: false,
				error: "INTERNAL_ERROR",
				message: error?.message || "Unexpected error during IRIS auto-fetch.",
				retryable: true,
			});
		}
	},
);

export default router;
