import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import {
	capitalGainsReports,
	insertCapitalGainsReportSchema,
	users,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { proposalCapitalGainsService } from "../services/proposal-capital-gains-service";
import { realizedGainsAggregationService } from "../services/realized-gains-aggregation-service";
import { capitalGainsCalculator } from "../services/capital-gains-calculator";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { z } from "zod";
import { sandboxITRService } from "../sandbox-itr-service";
import rateLimit from "express-rate-limit";

const taxRegimeComparisonSchema = z.object({
	fiscalYear: z
		.string()
		.regex(/^\d{4}-\d{2}$/)
		.optional(),
	salaryIncome: z.number().min(0).default(0),
	otherIncome: z.number().min(0).default(0),
	deductions80C: z.number().min(0).max(150000).default(0),
	deductions80D: z.number().min(0).max(100000).default(0),
	homeLoanInterest: z.number().min(0).default(0),
});

const itrAutoPopulateSchema = z.object({
	panNumber: z
		.string()
		.regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
	assessmentYear: z.string().regex(/^\d{4}-\d{2}$/),
	fiscalYear: z
		.string()
		.regex(/^\d{4}-\d{2}$/)
		.optional(),
});

const taxApiRateLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 20,
	message: {
		error: "Too many tax API requests. Please try again after a minute.",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

export function registerCapitalGainPart2Routes(app: Express): void {
	app.post("/api/capital-gains/exit-load-status", async (req, res) => {
		try {
			const { holdings } = req.body;

			if (!holdings || !Array.isArray(holdings)) {
				return res.status(400).json({ error: "Holdings array is required" });
			}

			/**
			 * EXIT LOAD APPLICABILITY FILTER
			 * Exit load is a SEBI-regulated charge that applies ONLY to open-ended Mutual Fund schemes.
			 * NOT applicable to: Stocks, ETFs, Bonds/NCDs, FDs, SGBs, PMS, AIF, Insurance/ULIPs, REITs, InvITs.
			 * See: shared/types/instrument-charges.ts for full charge taxonomy.
			 */
			const { isMutualFund } = await import(
				"../../shared/types/instrument-charges"
			);
			const mfOnly = holdings.filter((h: any) => {
				const pt = (h.productType || h.assetType || "").toLowerCase().trim();
				return isMutualFund(pt);
			});

			if (mfOnly.length === 0) {
				return res.json({
					holdings: [],
					summary: {
						totalHoldings: 0,
						exitLoadFree: 0,
						withinExitLoadPeriod: 0,
						totalExitLoadExposure: 0,
						holdingsNearExitLoadExpiry: 0,
					},
				});
			}

			const statusList = await Promise.all(
				mfOnly.map(async (holding: any) => {
					const taxDetails =
						await proposalCapitalGainsService.calculateHoldingTaxAsync(holding);
					const holdingPeriodDays = Math.floor(
						(Date.now() -
							new Date(holding.purchaseDate || Date.now()).getTime()) /
							(1000 * 60 * 60 * 24),
					);

					return {
						name: holding.name,
						isin: holding.isin,
						currentValue: holding.currentValue,
						holdingPeriodDays,
						exitLoadPercent:
							taxDetails.exitLoad > 0
								? (taxDetails.exitLoad / holding.currentValue) * 100
								: 0,
						exitLoadAmount: taxDetails.exitLoad,
						exitLoadSource: taxDetails.exitLoadSource,
						daysToExitLoadFree: taxDetails.daysToZeroExitLoad,
						exitLoadFreeDate:
							taxDetails.daysToZeroExitLoad !== null
								? new Date(
										Date.now() +
											taxDetails.daysToZeroExitLoad * 24 * 60 * 60 * 1000,
									)
										.toISOString()
										.split("T")[0]
								: null,
						isExitLoadFree: taxDetails.exitLoad === 0,
						taxType: taxDetails.taxType,
						unrealizedGain: taxDetails.unrealizedGain,
					};
				}),
			);

			// Sort by days to exit load free (soonest first)
			statusList.sort((a, b) => {
				if (a.daysToExitLoadFree === null) return 1;
				if (b.daysToExitLoadFree === null) return -1;
				return a.daysToExitLoadFree - b.daysToExitLoadFree;
			});

			const summary = {
				totalHoldings: statusList.length,
				exitLoadFree: statusList.filter((h) => h.isExitLoadFree).length,
				withinExitLoadPeriod: statusList.filter((h) => !h.isExitLoadFree)
					.length,
				totalExitLoadExposure: statusList.reduce(
					(sum, h) => sum + h.exitLoadAmount,
					0,
				),
				holdingsNearExitLoadExpiry: statusList.filter(
					(h) => h.daysToExitLoadFree !== null && h.daysToExitLoadFree <= 60,
				).length,
			};

			res.json({
				holdings: statusList,
				summary,
			});
		} catch (error) {
			console.error("Error getting exit load status:", error);
			res.status(500).json({ error: "Failed to get exit load status" });
		}
	});

	// ITR Schedule CG Export endpoint
	// Generates structured capital gains data for ITR Schedule CG filing
	// MODES:
	// - transactions: Use actual sale transactions with saleDate (for accurate ITR filing)
	// - holdings: Use current holdings with estimated gains (for planning/preview only)
	app.post("/api/capital-gains/itr-export", async (req, res) => {
		try {
			const { holdings, transactions, assessmentYear, panNumber } = req.body;

			if (!transactions && !holdings) {
				return res.status(400).json({
					error:
						"Either transactions (for actual ITR filing) or holdings (for estimates) is required",
					note: "For accurate ITR filing, use transactions array with saleDate for each item",
				});
			}

			const isEstimateMode = !transactions; // If using holdings, this is an estimate
			const assessYear = assessmentYear || getAssessmentYear();
			const source = transactions || holdings;

			// Categorize gains by asset type and term
			const equitySTCG: any[] = [];
			const equityLTCG: any[] = [];
			const debtSTCG: any[] = [];
			const debtLTCG: any[] = [];
			const otherAssets: any[] = [];

			for (const item of source) {
				const taxDetails =
					await proposalCapitalGainsService.calculateHoldingTaxAsync({
						name: item.name || item.schemeName,
						productType: item.productType || "MUTUAL_FUND",
						category: item.category,
						isin: item.isin,
						currentValue: item.saleValue || item.currentValue,
						investedAmount: item.purchaseValue || item.investedAmount,
						purchaseDate: item.purchaseDate,
						quantity: item.units || item.quantity,
					});

				const entry = {
					schemeName: item.name || item.schemeName,
					isin: item.isin,
					folioNumber: item.folioNumber,
					units: item.units || item.quantity,
					purchaseDate: item.purchaseDate,
					purchaseValue: item.purchaseValue || item.investedAmount,
					saleDate: item.saleDate || new Date().toISOString().split("T")[0],
					saleValue: item.saleValue || item.currentValue,
					capitalGain: taxDetails.unrealizedGain,
					holdingPeriodDays: taxDetails.holdingPeriodDays,
					taxType: taxDetails.taxType,
					taxAmount: taxDetails.estimatedTax,
					costOfAcquisition: item.purchaseValue || item.investedAmount,
					costOfImprovement: 0,
					exemptionClaimed: 0,
					netTaxableGain: taxDetails.unrealizedGain,
					grandfatheringApplied: taxDetails.grandfatheringApplied,
					grandfatheringBenefit: taxDetails.grandfatheringBenefit,
				};

				// Check if it's equity or debt
				const isEquity =
					["STOCK", "EQUITY", "ETF"].some((t) =>
						(item.productType || "").toUpperCase().includes(t),
					) ||
					[
						"equity",
						"large cap",
						"mid cap",
						"small cap",
						"flexi cap",
						"elss",
					].some((c) => (item.category || "").toLowerCase().includes(c));

				if (isEquity) {
					if (taxDetails.taxType === "STCG") {
						equitySTCG.push(entry);
					} else {
						equityLTCG.push(entry);
					}
				} else {
					if (taxDetails.taxType === "STCG" || taxDetails.taxType === "SLAB") {
						debtSTCG.push(entry);
					} else {
						debtLTCG.push(entry);
					}
				}
			}

			// Calculate totals
			const totalEquitySTCG = equitySTCG.reduce(
				(sum, e) => sum + e.capitalGain,
				0,
			);
			const totalEquityLTCG = equityLTCG.reduce(
				(sum, e) => sum + e.capitalGain,
				0,
			);
			const totalDebtSTCG = debtSTCG.reduce((sum, e) => sum + e.capitalGain, 0);
			const totalDebtLTCG = debtLTCG.reduce((sum, e) => sum + e.capitalGain, 0);

			// ITR Schedule CG format
			const scheduleCG = {
				assessmentYear: assessYear,
				panNumber: panNumber || "XXXPX0000X",
				generatedAt: new Date().toISOString(),
				mode: isEstimateMode ? "ESTIMATE" : "ACTUAL",
				modeNote: isEstimateMode
					? "This is an ESTIMATE based on current holdings. For actual ITR filing, provide transactions with saleDate."
					: "Based on actual sale transactions. Verify all values before filing.",

				// Section A1 - Short Term Capital Gain on equity shares (STT paid) - u/s 111A
				sectionA1_EquitySTCG: {
					description:
						"Short Term Capital Gain on equity shares/units of equity oriented fund on which STT is paid",
					applicableSection: "111A",
					taxRate: "20%",
					transactions: equitySTCG,
					totalCostOfAcquisition: equitySTCG.reduce(
						(sum, e) => sum + e.costOfAcquisition,
						0,
					),
					totalSaleConsideration: equitySTCG.reduce(
						(sum, e) => sum + e.saleValue,
						0,
					),
					totalCapitalGain: totalEquitySTCG,
					lossSetOff: 0,
					netTaxableGain: Math.max(0, totalEquitySTCG),
				},

				// Section A2 - Long Term Capital Gain on equity shares (STT paid) - u/s 112A
				sectionA2_EquityLTCG: {
					description:
						"Long Term Capital Gain on equity shares/units of equity oriented fund on which STT is paid",
					applicableSection: "112A",
					taxRate: "12.5%",
					exemptionLimit: 125000,
					transactions: equityLTCG,
					totalCostOfAcquisition: equityLTCG.reduce(
						(sum, e) => sum + e.costOfAcquisition,
						0,
					),
					totalSaleConsideration: equityLTCG.reduce(
						(sum, e) => sum + e.saleValue,
						0,
					),
					totalCapitalGain: totalEquityLTCG,
					exemptionClaimed: Math.min(125000, Math.max(0, totalEquityLTCG)),
					netTaxableGain: Math.max(0, totalEquityLTCG - 125000),
					grandfatheringBenefitApplied: equityLTCG.some(
						(e) => e.grandfatheringApplied,
					),
				},

				// Section B - STCG on assets other than above (debt, gold, etc.)
				sectionB_OtherSTCG: {
					description:
						"Short Term Capital Gain on assets other than those covered in Section A",
					applicableSection: "Slab Rate/Special Rates",
					transactions: debtSTCG,
					totalCostOfAcquisition: debtSTCG.reduce(
						(sum, e) => sum + e.costOfAcquisition,
						0,
					),
					totalSaleConsideration: debtSTCG.reduce(
						(sum, e) => sum + e.saleValue,
						0,
					),
					totalCapitalGain: totalDebtSTCG,
					netTaxableGain: Math.max(0, totalDebtSTCG),
				},

				// Section C - LTCG on assets other than equity (with/without indexation)
				sectionC_OtherLTCG: (() => {
					// Apply indexation for eligible holdings (purchased before April 2023, held 3+ years)
					const indexationResults = debtLTCG.map((e) => {
						const purchaseDate = new Date(e.purchaseDate);
						const isEligible =
							purchaseDate < new Date("2023-04-01") &&
							e.holdingPeriodDays >= 1095;

						if (isEligible) {
							// Calculate indexed cost
							const indexResult =
								proposalCapitalGainsService.calculateIndexationBenefit({
									purchaseDate: e.purchaseDate,
									saleDate: e.saleDate,
									purchaseCost: e.costOfAcquisition,
									saleValue: e.saleValue,
									productType: "DEBT",
									category: "debt",
								});

							return {
								...e,
								indexationApplied: true,
								indexedCost: indexResult.indexedCost,
								gainWithIndexation: indexResult.gainWithIndexation,
								taxWithIndexation: indexResult.taxWithIndexation,
							};
						}
						return {
							...e,
							indexationApplied: false,
							indexedCost: e.costOfAcquisition,
							gainWithIndexation: e.capitalGain,
							taxWithIndexation: Math.max(0, e.capitalGain) * 0.3, // Slab rate for non-eligible
						};
					});

					const eligibleCount = indexationResults.filter(
						(r) => r.indexationApplied,
					).length;
					const totalIndexedGain = indexationResults.reduce(
						(sum, r) => sum + r.gainWithIndexation,
						0,
					);
					const totalIndexedTax = indexationResults.reduce(
						(sum, r) => sum + r.taxWithIndexation,
						0,
					);

					return {
						description:
							"Long Term Capital Gain on assets other than those covered in Section A",
						applicableSection: "112/Slab Rate",
						transactions: indexationResults,
						totalCostOfAcquisition: debtLTCG.reduce(
							(sum, e) => sum + e.costOfAcquisition,
							0,
						),
						totalIndexedCost: indexationResults.reduce(
							(sum, r) => sum + r.indexedCost,
							0,
						),
						totalSaleConsideration: debtLTCG.reduce(
							(sum, e) => sum + e.saleValue,
							0,
						),
						totalCapitalGain: totalDebtLTCG,
						totalGainWithIndexation: totalIndexedGain,
						indexationEligible: eligibleCount,
						netTaxableGain: Math.max(0, totalIndexedGain),
						estimatedTax: totalIndexedTax,
					};
				})(),

				// Summary
				summary: (() => {
					// Recalculate debt LTCG with indexation
					let debtLTCGTaxableGain = 0;
					let debtLTCGTax = 0;

					for (const e of debtLTCG) {
						const purchaseDate = new Date(e.purchaseDate);
						const isEligible =
							purchaseDate < new Date("2023-04-01") &&
							e.holdingPeriodDays >= 1095;

						if (isEligible) {
							const indexResult =
								proposalCapitalGainsService.calculateIndexationBenefit({
									purchaseDate: e.purchaseDate,
									saleDate: e.saleDate,
									purchaseCost: e.costOfAcquisition,
									saleValue: e.saleValue,
									productType: "DEBT",
									category: "debt",
								});
							debtLTCGTaxableGain += indexResult.gainWithIndexation;
							debtLTCGTax += indexResult.taxWithIndexation;
						} else {
							debtLTCGTaxableGain += e.capitalGain;
							debtLTCGTax += Math.max(0, e.capitalGain) * 0.3;
						}
					}

					return {
						totalSTCG: totalEquitySTCG + totalDebtSTCG,
						totalLTCG: totalEquityLTCG + totalDebtLTCG,
						totalCapitalGains:
							totalEquitySTCG + totalDebtSTCG + totalEquityLTCG + totalDebtLTCG,
						equityLTCGExemption: Math.min(125000, Math.max(0, totalEquityLTCG)),
						netTaxableCapitalGains:
							Math.max(0, totalEquitySTCG) +
							Math.max(0, totalEquityLTCG - 125000) +
							Math.max(0, totalDebtSTCG) +
							Math.max(0, debtLTCGTaxableGain),
						estimatedTax: {
							onEquitySTCG: Math.max(0, totalEquitySTCG) * 0.2,
							onEquityLTCG: Math.max(0, totalEquityLTCG - 125000) * 0.125,
							onDebtSTCG: Math.max(0, totalDebtSTCG) * 0.3,
							onDebtLTCG: debtLTCGTax,
							total:
								Math.max(0, totalEquitySTCG) * 0.2 +
								Math.max(0, totalEquityLTCG - 125000) * 0.125 +
								Math.max(0, totalDebtSTCG) * 0.3 +
								debtLTCGTax,
						},
					};
				})(),
			};

			res.json(scheduleCG);
		} catch (error) {
			console.error("Error generating ITR Schedule CG export:", error);
			res
				.status(500)
				.json({ error: "Failed to generate ITR Schedule CG export" });
		}
	});

	// Helper function to get current assessment year
	function getAssessmentYear(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth();

		// If between April and December, assessment year is next year
		// If between January and March, assessment year is current year
		if (month >= 3) {
			// April onwards
			return `${year + 1}-${(year + 2).toString().slice(2)}`;
		}
		return `${year}-${(year + 1).toString().slice(2)}`;
	}

	// Indexation benefit calculator endpoint
	app.post("/api/capital-gains/indexation-benefit", async (req, res) => {
		try {
			const {
				purchaseDate,
				saleDate,
				purchaseCost,
				saleValue,
				productType,
				category,
			} = req.body;

			if (!purchaseDate || !purchaseCost || !saleValue || !productType) {
				return res.status(400).json({
					error:
						"purchaseDate, purchaseCost, saleValue, and productType are required",
				});
			}

			const result = proposalCapitalGainsService.calculateIndexationBenefit({
				purchaseDate,
				saleDate,
				purchaseCost,
				saleValue,
				productType,
				category,
			});

			res.json(result);
		} catch (error) {
			console.error("Error calculating indexation benefit:", error);
			res.status(500).json({ error: "Failed to calculate indexation benefit" });
		}
	});

	// Exit load calendar view endpoint
	// Shows timeline of when each holding becomes exit-load-free
	app.post("/api/capital-gains/exit-load-calendar", async (req, res) => {
		try {
			const { holdings, months = 12 } = req.body;

			if (!holdings || !Array.isArray(holdings)) {
				return res.status(400).json({ error: "Holdings array is required" });
			}

			/**
			 * EXIT LOAD APPLICABILITY FILTER
			 * Exit load is a SEBI-regulated charge that applies ONLY to open-ended Mutual Fund schemes.
			 * NOT applicable to: Stocks, ETFs, Bonds/NCDs, FDs, SGBs, PMS, AIF, Insurance/ULIPs, REITs, InvITs.
			 * See: shared/types/instrument-charges.ts for full charge taxonomy.
			 */
			const { isMutualFund } = await import(
				"../../shared/types/instrument-charges"
			);
			const mfHoldings = holdings.filter((h: any) => {
				const pt = (h.productType || h.assetType || "").toLowerCase().trim();
				return isMutualFund(pt);
			});

			if (mfHoldings.length === 0) {
				return res.json({
					holdings: [],
					calendar: {},
					summary: {
						totalHoldings: 0,
						alreadyExitLoadFree: 0,
						pendingExitLoadFree: 0,
						alreadyLTCGEligible: 0,
						pendingLTCGEligible: 0,
						totalPendingExitLoad: 0,
						upcomingEvents: 0,
					},
				});
			}

			// Calculate exit load status for each holding (MF only)
			const holdingsWithDates = await Promise.all(
				mfHoldings.map(async (holding: any) => {
					const taxDetails =
						await proposalCapitalGainsService.calculateHoldingTaxAsync(holding);
					const purchaseDate = new Date(holding.purchaseDate || Date.now());

					let exitLoadFreeDate: Date | null = null;
					if (
						taxDetails.daysToZeroExitLoad !== null &&
						taxDetails.daysToZeroExitLoad > 0
					) {
						exitLoadFreeDate = new Date(
							Date.now() + taxDetails.daysToZeroExitLoad * 24 * 60 * 60 * 1000,
						);
					} else if (taxDetails.exitLoad === 0) {
						// Already exit load free
						exitLoadFreeDate = null; // null means already free
					}

					// Calculate LTCG eligible date based on product type
					const holdingPeriodDays = Math.floor(
						(Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
					);

					// Determine LTCG threshold based on product type, purchase date, and regime
					// - Equity: Always 365 days (1 year)
					// - Debt purchased BEFORE April 2023: 1095 days (3 years) with indexation benefit
					// - Debt purchased AFTER April 2023: 730 days (2 years) under new rules, but taxed at slab
					// - Gold/Silver: 730 days (2 years) post-July 2024
					const isEquity =
						["STOCK", "EQUITY", "ETF"].some((t) =>
							(holding.productType || "").toUpperCase().includes(t),
						) ||
						[
							"equity",
							"large cap",
							"mid cap",
							"small cap",
							"flexi cap",
							"elss",
						].some((c) => (holding.category || "").toLowerCase().includes(c));

					const isDebt =
						["DEBT", "BOND", "LIQUID", "GILT"].some((t) =>
							(holding.productType || "").toUpperCase().includes(t),
						) ||
						[
							"debt",
							"bond",
							"liquid",
							"money market",
							"corporate",
							"banking psu",
						].some((c) => (holding.category || "").toLowerCase().includes(c));

					const isGold =
						["GOLD", "SILVER"].some((t) =>
							(holding.productType || "").toUpperCase().includes(t),
						) ||
						["gold", "silver", "commodity"].some((c) =>
							(holding.category || "").toLowerCase().includes(c),
						);

					const indexationCutoff = new Date("2023-04-01");
					let ltcgThreshold = 365; // Default for equity

					if (isDebt) {
						// Check if purchased before April 2023 (eligible for 3-year LTCG with indexation)
						if (purchaseDate < indexationCutoff) {
							ltcgThreshold = 1095; // 3 years for pre-April 2023 debt
						} else {
							ltcgThreshold = 730; // 2 years for post-April 2023 debt (but slab rate)
						}
					} else if (isGold) {
						ltcgThreshold = 730; // 2 years for gold/silver
					}

					let ltcgEligibleDate: Date | null = null;
					if (holdingPeriodDays < ltcgThreshold) {
						ltcgEligibleDate = new Date(
							purchaseDate.getTime() + ltcgThreshold * 24 * 60 * 60 * 1000,
						);
					}

					// Calculate exit load percent from amount
					// taxDetails.exitLoad is the amount, so we calculate percent as (amount / value * 100)
					const exitLoadPercent =
						holding.currentValue > 0
							? (taxDetails.exitLoad / holding.currentValue) * 100
							: 0;

					return {
						name: holding.name,
						isin: holding.isin,
						currentValue: holding.currentValue,
						purchaseDate: purchaseDate.toISOString().split("T")[0],
						productType: holding.productType,
						category: holding.category,
						isExitLoadFree: taxDetails.exitLoad === 0,
						exitLoadFreeDate: exitLoadFreeDate
							? exitLoadFreeDate.toISOString().split("T")[0]
							: null,
						daysToExitLoadFree: taxDetails.daysToZeroExitLoad,
						exitLoadPercent: Math.round(exitLoadPercent * 100) / 100, // Rounded to 2 decimals
						currentExitLoadAmount: taxDetails.exitLoad,
						exitLoadSource: taxDetails.exitLoadSource,
						isLTCGEligible: taxDetails.taxType === "LTCG",
						ltcgThresholdDays: ltcgThreshold,
						ltcgEligibleDate: ltcgEligibleDate
							? ltcgEligibleDate.toISOString().split("T")[0]
							: null,
						daysToLTCG: ltcgEligibleDate
							? Math.ceil(
									(ltcgEligibleDate.getTime() - Date.now()) /
										(1000 * 60 * 60 * 24),
								)
							: null,
						taxType: taxDetails.taxType,
					};
				}),
			);

			// Generate calendar view
			const today = new Date();
			const calendar: Record<string, any[]> = {};

			// Initialize months
			for (let i = 0; i < months; i++) {
				const monthDate = new Date(
					today.getFullYear(),
					today.getMonth() + i,
					1,
				);
				const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
				calendar[monthKey] = [];
			}

			// Add holdings to calendar based on their exit load free dates
			for (const holding of holdingsWithDates) {
				if (holding.exitLoadFreeDate) {
					const exitDate = new Date(holding.exitLoadFreeDate);
					const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, "0")}`;
					if (calendar[monthKey]) {
						calendar[monthKey].push({
							type: "exit_load_free",
							date: holding.exitLoadFreeDate,
							name: holding.name,
							isin: holding.isin,
							currentValue: holding.currentValue,
							exitLoadSaved: holding.currentExitLoadAmount,
						});
					}
				}

				if (holding.ltcgEligibleDate) {
					const ltcgDate = new Date(holding.ltcgEligibleDate);
					const monthKey = `${ltcgDate.getFullYear()}-${String(ltcgDate.getMonth() + 1).padStart(2, "0")}`;
					if (calendar[monthKey]) {
						calendar[monthKey].push({
							type: "ltcg_eligible",
							date: holding.ltcgEligibleDate,
							name: holding.name,
							isin: holding.isin,
							currentValue: holding.currentValue,
						});
					}
				}
			}

			// Sort events within each month by date
			for (const monthKey of Object.keys(calendar)) {
				calendar[monthKey].sort(
					(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
				);
			}

			// Summary
			const summary = {
				totalHoldings: mfHoldings.length,
				alreadyExitLoadFree: holdingsWithDates.filter((h) => h.isExitLoadFree)
					.length,
				pendingExitLoadFree: holdingsWithDates.filter((h) => !h.isExitLoadFree)
					.length,
				alreadyLTCGEligible: holdingsWithDates.filter((h) => h.isLTCGEligible)
					.length,
				pendingLTCGEligible: holdingsWithDates.filter((h) => !h.isLTCGEligible)
					.length,
				totalPendingExitLoad: holdingsWithDates.reduce(
					(sum, h) => sum + (h.currentExitLoadAmount || 0),
					0,
				),
				upcomingEvents: Object.values(calendar).flat().length,
			};

			res.json({
				holdings: holdingsWithDates,
				calendar,
				summary,
			});
		} catch (error) {
			console.error("Error generating exit load calendar:", error);
			res.status(500).json({ error: "Failed to generate exit load calendar" });
		}
	});

	// Batch indexation benefit calculator for multiple holdings
	app.post("/api/capital-gains/indexation-benefit/batch", async (req, res) => {
		try {
			const { holdings, saleDate } = req.body;

			if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
				return res.status(400).json({ error: "Holdings array is required" });
			}

			const results = holdings.map((holding: any) => ({
				name: holding.name,
				isin: holding.isin,
				...proposalCapitalGainsService.calculateIndexationBenefit({
					purchaseDate: holding.purchaseDate,
					saleDate: saleDate || new Date(),
					purchaseCost: holding.investedAmount || holding.purchaseCost,
					saleValue: holding.currentValue || holding.saleValue,
					productType: holding.productType,
					category: holding.category,
				}),
			}));

			const eligibleHoldings = results.filter((r: any) => r.eligible);
			const totalTaxSavings = eligibleHoldings.reduce(
				(sum: number, r: any) => sum + r.taxSavingsFromIndexation,
				0,
			);

			res.json({
				holdings: results,
				summary: {
					totalHoldings: results.length,
					eligibleForIndexation: eligibleHoldings.length,
					notEligible: results.length - eligibleHoldings.length,
					totalPotentialTaxSavings: Math.round(totalTaxSavings * 100) / 100,
				},
			});
		} catch (error) {
			console.error("Error calculating batch indexation benefit:", error);
			res.status(500).json({ error: "Failed to calculate indexation benefit" });
		}
	});

	app.get("/api/advance-tax/status", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const fiscalYear = req.query.fiscalYear as string | undefined;
			const status = await realizedGainsAggregationService.getAdvanceTaxStatus(
				req.user.id,
				fiscalYear,
			);

			res.json(status);
		} catch (error) {
			console.error("Error fetching advance tax status:", error);
			res.status(500).json({ error: "Failed to fetch advance tax status" });
		}
	});

	app.get("/api/capital-gains/realized", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const fiscalYear = req.query.fiscalYear as string | undefined;
			const gains =
				await realizedGainsAggregationService.aggregateRealizedGains(
					req.user.id,
					fiscalYear,
				);

			res.json(gains);
		} catch (error) {
			console.error("Error fetching realized gains:", error);
			res.status(500).json({ error: "Failed to fetch realized gains" });
		}
	});

	app.get("/api/capital-gains/combined", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const fiscalYear = req.query.fiscalYear as string | undefined;
			const combined = await capitalGainsCalculator.getCombinedGains(
				req.user.id,
				fiscalYear,
			);

			res.json(combined);
		} catch (error) {
			console.error("Error fetching combined gains:", error);
			res.status(500).json({ error: "Failed to fetch combined capital gains" });
		}
	});
}
