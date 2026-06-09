// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import {
	prospectProposals,
	prospectProposalEvents,
	onboardingInvitations,
	users,
	customerCareAgents,
	mutualFunds,
	mutualFundMetrics,
	corporateBonds,
	aifMaster,
	pmsMaster,
	mldMaster,
	listedStocks,
	aiRecommendationTracking,
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { aiRecommendationTrackingService } from "../services/ai-recommendation-tracking-service";
import { unifiedAIRecommendationEngine } from "../services/unified-ai-recommendation-engine";
import { riskSuitabilityEngine } from "../services/risk-suitability-engine";
import { returnForecastingEngine } from "../services/return-forecasting-engine";
import {
	resolveAgentName,
	getStoreEligibleMutualFunds,
	getStoreEligibleBonds,
	getStoreEligibleAIFs,
	getStoreEligiblePMS,
	getStoreEligibleMLDs,
	getStoreEligibleStocks,
	getExitLoadFromMetadata,
	deriveValuationMetrics,
	generateAIEnhancedRationale,
	generateAnalyticalRationale,
	buildMFRationale,
	buildStockRationale,
	buildPMSRationale,
	buildAIFRationale,
	buildDefaultRationale,
	calculateCapitalGainsTax,
	buildDynamicRecommendations,
} from "./prospect-proposals-helpers";

const router = Router();
router.post(
	"/api/agent/prospect-proposals/generate",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const {
				proposalType,
				clientType = "individual",
				samplePortfolio,
				investmentGoals,
				selectedCategories,
				includeExistingPortfolio = false,
				prospectPan,
				prospectEmail,
			} = req.body;

			// Client type configurations for tailored recommendations
			const clientTypeConfig: Record<
				string,
				{
					minInvestment: number;
					eligibleProducts: string[];
					riskModifier: number;
					toneSuffix: string;
					premiumProducts: boolean;
				}
			> = {
				individual: {
					minInvestment: 5000,
					eligibleProducts: ["mutual_fund"],
					riskModifier: 1.0,
					toneSuffix: "for your personal financial goals",
					premiumProducts: false,
				},
				hni: {
					minInvestment: 5000000,
					eligibleProducts: ["mutual_fund", "pms", "aif"],
					riskModifier: 1.1,
					toneSuffix: "for your sophisticated investment requirements",
					premiumProducts: true,
				},
				ultra_hni: {
					minInvestment: 50000000,
					eligibleProducts: [
						"mutual_fund",
						"pms",
						"aif",
						"private_equity",
						"structured_products",
					],
					riskModifier: 1.15,
					toneSuffix: "for your ultra-high-net-worth portfolio",
					premiumProducts: true,
				},
				corporate: {
					minInvestment: 10000000,
					eligibleProducts: ["mutual_fund", "bonds", "fixed_deposits"],
					riskModifier: 0.85,
					toneSuffix: "for your corporate treasury requirements",
					premiumProducts: false,
				},
				nri: {
					minInvestment: 10000,
					eligibleProducts: ["mutual_fund", "bonds", "nri_fd"],
					riskModifier: 0.95,
					toneSuffix: "considering NRE/NRO account regulations",
					premiumProducts: false,
				},
				trust: {
					minInvestment: 25000000,
					eligibleProducts: ["mutual_fund", "pms", "aif", "bonds"],
					riskModifier: 0.9,
					toneSuffix: "for your family office/trust requirements",
					premiumProducts: true,
				},
				institutional: {
					minInvestment: 100000000,
					eligibleProducts: [
						"mutual_fund",
						"pms",
						"aif",
						"bonds",
						"structured_products",
					],
					riskModifier: 0.8,
					toneSuffix: "for your institutional investment mandate",
					premiumProducts: true,
				},
			};

			const config =
				clientTypeConfig[clientType] || clientTypeConfig.individual;

			// Generate recommendations based on proposal type
			let recommendations: any[] = [];
			let executiveSummary = "";
			let currentAnalysis = "";
			let targetAllocation: Record<string, number> = {};
			let projectedReturns = 12;
			let projectedValue = 0;

			if (proposalType === "sample_portfolio" && samplePortfolio) {
				// Analyze sample portfolio and suggest improvements
				const totalValue = Math.max(
					samplePortfolio.totalValue || 0,
					config.minInvestment,
				);
				const holdings = samplePortfolio.holdings || [];

				currentAnalysis = `Based on your current portfolio worth ₹${totalValue.toLocaleString("en-IN")}, we've analyzed ${holdings.length} holdings and identified opportunities for optimization ${config.toneSuffix}.`;

				executiveSummary = `Your portfolio shows potential for improved diversification and returns. We recommend rebalancing to achieve better risk-adjusted returns ${config.toneSuffix}.${config.premiumProducts ? " As a qualified investor, you have access to exclusive PMS and AIF products with higher return potential." : ""}`;

				// Generate client-type specific recommendations for sample portfolio
				if (
					config.premiumProducts &&
					(clientType === "hni" ||
						clientType === "ultra_hni" ||
						clientType === "trust" ||
						clientType === "institutional")
				) {
					// Premium rebalancing for HNI/Ultra HNI/Trust/Institutional - use actual store products
					targetAllocation =
						clientType === "ultra_hni"
							? { PMS: 35, AIF: 25, "Large Cap": 20, Debt: 15, Alternatives: 5 }
							: { PMS: 30, "Large Cap": 30, AIF: 15, Debt: 20, Bonds: 5 };

					// Fetch recommendations from store with premium products
					recommendations = await buildDynamicRecommendations({
						totalAmount: totalValue,
						clientType,
						riskTolerance: "aggressive",
						includePremium: true,
						selectedCategories,
						allocations: targetAllocation,
					});
					projectedReturns = Math.round(16.5 * config.riskModifier * 10) / 10;
				} else if (clientType === "corporate") {
					// Conservative treasury rebalancing for corporate - use actual store products
					targetAllocation = { Liquid: 30, Debt: 45, Bonds: 25 };

					// Fetch recommendations from store - Regular plan with treasury focus
					recommendations = await buildDynamicRecommendations({
						totalAmount: totalValue,
						clientType,
						riskTolerance: "conservative",
						includePremium: false,
						selectedCategories,
						allocations: targetAllocation,
					});
					projectedReturns = Math.round(7.5 * config.riskModifier * 10) / 10;
				} else if (clientType === "nri") {
					// NRI-compliant rebalancing - use actual store products
					targetAllocation = {
						"Flexi Cap": 40,
						Debt: 25,
						"Large Cap": 25,
						Bonds: 10,
					};

					// Fetch recommendations from store - Regular plan NRI-eligible
					recommendations = await buildDynamicRecommendations({
						totalAmount: totalValue,
						clientType,
						riskTolerance: "moderate",
						includePremium: false,
						selectedCategories,
						allocations: targetAllocation,
					});
					projectedReturns = Math.round(12.5 * config.riskModifier * 10) / 10;
				} else {
					// Standard retail investor rebalancing - use actual store-eligible products (Regular plan only)
					// Now includes listed stocks for diversified equity exposure
					targetAllocation = {
						"Large Cap": 20,
						"Mid Cap": 15,
						"Flexi Cap": 10,
						Stocks: 15, // Direct equity exposure via listed stocks
						Debt: 25,
						Bonds: 15,
					};

					// Fetch recommendations from store - Regular plan mutual funds + stocks
					recommendations = await buildDynamicRecommendations({
						totalAmount: totalValue,
						clientType,
						riskTolerance: "moderate",
						includePremium: false,
						includeStocks: true,
						selectedCategories,
						allocations: targetAllocation,
					});
					projectedReturns = Math.round(13.5 * config.riskModifier * 10) / 10;
				}

				const portfolioAsset = {
					assetId: "portfolio",
					assetType: "mutual_fund" as const,
					assetName: "Portfolio",
					currentValue: totalValue,
					investedAmount: totalValue,
					inceptionDate: new Date(),
				};
				const projections = await returnForecastingEngine.generateProjections(
					portfolioAsset,
					[5],
				);
				projectedValue =
					projections[0]?.projectedValue ||
					Math.round(totalValue * (1 + projectedReturns / 100) ** 5);
			} else if (proposalType === "fresh_investment" && investmentGoals) {
				// Generate recommendations for fresh investment
				const {
					goalType,
					targetAmount,
					timeHorizon,
					monthlyInvestment,
					lumpsum,
					riskTolerance,
				} = investmentGoals;
				const calculatedAmount = (lumpsum || 0) + (monthlyInvestment || 0) * 12;
				const totalAmount = Math.max(calculatedAmount, config.minInvestment);

				const goalLabels: Record<string, string> = {
					retirement: "Retirement Planning",
					child_education: "Child Education",
					wealth_creation: "Wealth Creation",
					home_purchase: "Home Purchase",
					emergency_fund: "Emergency Fund",
					tax_saving: "Tax Saving",
					regular_income: "Regular Income",
					custom: "Custom Goal",
				};

				executiveSummary = `Based on your ${goalLabels[goalType] || goalType} goal with a ${timeHorizon} investment horizon and ${riskTolerance} risk tolerance, we've curated a personalized investment portfolio ${config.toneSuffix}.${config.premiumProducts ? " Your profile qualifies you for premium investment products including PMS and AIFs." : ""}`;

				currentAnalysis = `For ${targetAmount ? `a target of ₹${targetAmount.toLocaleString("en-IN")}` : "your investment goal"}, we recommend a ${riskTolerance === "aggressive" ? "growth-oriented" : riskTolerance === "conservative" ? "stability-focused" : "balanced"} approach ${config.toneSuffix}. ${monthlyInvestment ? `Your monthly SIP of ₹${monthlyInvestment.toLocaleString("en-IN")} combined with ` : ""}${lumpsum ? `a lumpsum of ₹${lumpsum.toLocaleString("en-IN")}` : ""} positions you well for long-term wealth creation.`;

				const adjustedReturns = config.riskModifier;
				const riskScoreMap: Record<string, number> = {
					conservative: 20,
					moderate: 45,
					aggressive: 65,
					very_aggressive: 85,
				};
				const prospectRiskScore =
					riskScoreMap[riskTolerance || "moderate"] || 45;

				const allocationByRisk =
					riskSuitabilityEngine.getAssetAllocationForRiskScore(
						prospectRiskScore,
					);

				if (allocationByRisk) {
					targetAllocation = allocationByRisk;
					projectedReturns =
						Math.round(
							(riskTolerance === "aggressive"
								? 14
								: riskTolerance === "conservative"
									? 9
									: 11.5) *
								adjustedReturns *
								10,
						) / 10;
				} else if (riskTolerance === "aggressive") {
					targetAllocation = { Equity: 80, Debt: 15, Gold: 5 };
					projectedReturns = Math.round(14 * adjustedReturns * 10) / 10;
				} else if (riskTolerance === "conservative") {
					targetAllocation = { Equity: 40, Debt: 50, Gold: 10 };
					projectedReturns = Math.round(9 * adjustedReturns * 10) / 10;
				} else {
					targetAllocation = { Equity: 60, Debt: 30, Gold: 10 };
					projectedReturns = Math.round(11.5 * adjustedReturns * 10) / 10;
				}

				// Generate client-type specific recommendations - use actual store products
				if (
					config.premiumProducts &&
					(clientType === "hni" ||
						clientType === "ultra_hni" ||
						clientType === "trust" ||
						clientType === "institutional")
				) {
					// Premium products for HNI/Ultra HNI/Trust/Institutional clients
					targetAllocation =
						clientType === "ultra_hni"
							? { PMS: 35, AIF: 25, "Large Cap": 20, Debt: 15, Alternatives: 5 }
							: { PMS: 30, "Large Cap": 30, AIF: 15, Debt: 20, Bonds: 5 };

					// Fetch recommendations from store with premium products
					recommendations = await buildDynamicRecommendations({
						totalAmount,
						clientType,
						riskTolerance: "aggressive",
						includePremium: true,
						selectedCategories,
						allocations: targetAllocation,
						monthlyInvestment,
					});
					projectedReturns = Math.round(16.5 * adjustedReturns * 10) / 10;
				} else if (clientType === "corporate") {
					// Conservative treasury-focused products for corporate clients
					targetAllocation = { Liquid: 30, Debt: 45, Bonds: 25 };

					// Fetch recommendations from store - Regular plan treasury focus
					recommendations = await buildDynamicRecommendations({
						totalAmount,
						clientType,
						riskTolerance: "conservative",
						includePremium: false,
						selectedCategories,
						allocations: targetAllocation,
						monthlyInvestment,
					});
					projectedReturns = Math.round(7.5 * adjustedReturns * 10) / 10;
				} else if (clientType === "nri") {
					// NRI-compliant products
					targetAllocation = {
						"Flexi Cap": 40,
						Debt: 25,
						"Large Cap": 25,
						Bonds: 10,
					};

					// Fetch recommendations from store - Regular plan NRI-eligible
					recommendations = await buildDynamicRecommendations({
						totalAmount,
						clientType,
						riskTolerance: "moderate",
						includePremium: false,
						selectedCategories,
						allocations: targetAllocation,
						monthlyInvestment,
					});
					projectedReturns = Math.round(12.5 * adjustedReturns * 10) / 10;
				} else {
					// Standard retail investor recommendations - use actual store products (Regular plan only)
					// Now includes listed stocks for enhanced equity exposure
					targetAllocation =
						riskTolerance === "aggressive"
							? {
									"Large Cap": 30,
									"Mid Cap": 20,
									"Flexi Cap": 15,
									Stocks: 20,
									Debt: 10,
									Bonds: 5,
								}
							: riskTolerance === "conservative"
								? {
										"Large Cap": 15,
										Debt: 40,
										Bonds: 30,
										"Flexi Cap": 10,
										Stocks: 5,
									}
								: {
										"Large Cap": 25,
										"Mid Cap": 15,
										"Flexi Cap": 10,
										Stocks: 15,
										Debt: 25,
										Bonds: 10,
									};

					// Fetch recommendations from store - Regular plan mutual funds + listed stocks
					recommendations = await buildDynamicRecommendations({
						totalAmount,
						clientType,
						riskTolerance: riskTolerance || "moderate",
						includePremium: false,
						includeStocks: true,
						selectedCategories,
						allocations: targetAllocation,
						monthlyInvestment,
					});
					projectedReturns =
						Math.round(
							(riskTolerance === "aggressive"
								? 14
								: riskTolerance === "conservative"
									? 9
									: 11.5) *
								adjustedReturns *
								10,
						) / 10;
				}

				const yearsMap: Record<string, number> = {
					short_term: 3,
					medium_term: 5,
					long_term: 10,
				};
				const years = yearsMap[timeHorizon] || 5;
				const assetType =
					riskTolerance === "aggressive"
						? ("equity" as const)
						: riskTolerance === "conservative"
							? ("bond" as const)
							: ("mutual_fund" as const);
				const freshAsset = {
					assetId: "fresh",
					assetType,
					assetName: "Investment",
					currentValue: totalAmount,
					investedAmount: totalAmount,
					inceptionDate: new Date(),
				};
				const freshProjections =
					await returnForecastingEngine.generateProjections(freshAsset, [
						years,
					]);
				projectedValue =
					freshProjections[0]?.projectedValue ||
					Math.round(totalAmount * (1 + projectedReturns / 100) ** years);
			}

			// Generate existing portfolio analysis if requested
			let existingPortfolioAnalysis: any = null;
			if (includeExistingPortfolio) {
				existingPortfolioAnalysis = await generateExistingPortfolioAnalysis(
					prospectPan,
					prospectEmail,
					samplePortfolio,
				);
			}

			try {
				const enriched = await Promise.all(
					recommendations.slice(0, 5).map(async (rec: any) => {
						const enhanced = await generateAIEnhancedRationale(
							{
								schemeName: rec.productName,
								name: rec.productName,
								category: rec.category,
								returns1y: rec.returns1Y,
								returns3y: rec.returns3Y,
								ter: rec.expenseRatio,
							},
							rec.productType,
							rec.recommendationType || "BUY",
						);
						return {
							...rec,
							rationale: enhanced.rationale,
							aiModelUsed: enhanced.aiModelUsed,
						};
					}),
				);
				recommendations = [...enriched, ...recommendations.slice(5)];
			} catch {}

			res.json({
				success: true,
				generated: {
					executiveSummary,
					currentAnalysis,
					recommendations,
					targetAllocation,
					projectedReturns,
					projectedValue,
					totalInvestmentAmount: recommendations.reduce(
						(sum, r) => sum + r.recommendedAmount,
						0,
					),
					existingPortfolioAnalysis,
				},
			});
		} catch (error: any) {
			console.error("Generate proposal error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to generate proposal" });
		}
	},
);

// ============ PDF HOLDING REPORT PARSING ============

interface ParsedHolding {
	fundName: string;
	investedAmount: number;
	currentValue: number;
	units: number;
	nav: number;
	unrealizedGain: number;
	unrealizedGainPercent: number;
	xirr: number;
	holdingDays?: number;
	purchaseDate?: string;
	assetClass: string;
	category?: string;
}

interface ParsedClientInfo {
	name: string;
	crn?: string;
	pan?: string;
}

interface ParsedHoldingReport {
	clientInfo: ParsedClientInfo;
	summary: {
		totalInvested: number;
		currentValue: number;
		unrealizedGain: number;
		unrealizedGainPercent: number;
		xirr: number;
	};
	holdings: ParsedHolding[];
	reportDate?: string;
}

function parseAmountFromText(text: string): number {
	const cleaned = text.replace(/[₹,\s]/g, "");
	const num = Number.parseFloat(cleaned);
	return Number.isNaN(num) ? 0 : num;
}

function parsePercentFromText(text: string): number {
	const match = text.match(/-?\d+\.?\d*/);
	return match ? Number.parseFloat(match[0]) : 0;
}

function parseHoldingReportPdf(text: string): ParsedHoldingReport {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l);

	// Extract client info
	const clientInfo: ParsedClientInfo = { name: "" };

	// Look for client name and PAN
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// PAN pattern: AAAAA0000A
		const panMatch = line.match(/PAN:\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
		if (panMatch) {
			clientInfo.pan = panMatch[1].toUpperCase();
		}

		// CRN pattern
		const crnMatch = line.match(/CRN:\s*(\w+)/i);
		if (crnMatch) {
			clientInfo.crn = crnMatch[1];
		}

		// Look for name before CRN/PAN
		if (line.includes("Hello!")) {
			// Name is usually in the lines after Hello
			for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
				const nameLine = lines[j];
				if (
					nameLine.match(/^[A-Z\s]+,?$/) &&
					!nameLine.includes("CRN") &&
					!nameLine.includes("PAN")
				) {
					clientInfo.name = nameLine.replace(/,/g, "").trim();
					break;
				}
			}
		}
	}

	// Extract summary - look for "Total Invested", "Current Value", etc.
	let totalInvested = 0;
	let currentValue = 0;
	let totalUnrealizedGain = 0;
	let totalXirr = 0;

	const summaryPattern =
		/Total Invested.*?₹([\d,]+).*?Current Value.*?₹([\d,]+).*?Unrealised Gain.*?₹([\d,]+).*?\(([\d.-]+)%\).*?XIRR.*?([\d.-]+)%/is;
	const summaryMatch = text.match(summaryPattern);
	if (summaryMatch) {
		totalInvested = parseAmountFromText(summaryMatch[1]);
		currentValue = parseAmountFromText(summaryMatch[2]);
		totalUnrealizedGain = parseAmountFromText(summaryMatch[3]);
		totalXirr = Number.parseFloat(summaryMatch[5]) || 0;
	} else {
		// Alternative parsing - look for key-value pairs
		const investedMatch = text.match(/Total Invested\s*₹([\d,]+)/i);
		const valueMatch = text.match(/Current Value\s*₹([\d,]+)/i);
		const gainMatch = text.match(/Unrealised Gain\s*₹([\d,]+)/i);
		const xirrMatch = text.match(/XIRR\s*([\d.-]+)%/i);

		if (investedMatch) totalInvested = parseAmountFromText(investedMatch[1]);
		if (valueMatch) currentValue = parseAmountFromText(valueMatch[1]);
		if (gainMatch) totalUnrealizedGain = parseAmountFromText(gainMatch[1]);
		if (xirrMatch) totalXirr = Number.parseFloat(xirrMatch[1]) || 0;
	}

	// Extract individual holdings
	const holdings: ParsedHolding[] = [];

	// Pattern for mutual fund holdings: Fund Name (G) followed by amounts
	// Look for patterns like: "Invesco India Large & Mid Cap Fund (G)     ₹1,00,000           ₹1,12,521"
	const fundPatterns = [
		/([A-Za-z\s&]+Fund\s*\([GD]\))\s*₹([\d,]+)\s*₹([\d,]+)\s*₹?([\d,-]+)\s*\(([\d.-]+)%\)\s*([\d.-]+)%\s*([\d.]+)%/gi,
		/([A-Za-z\s&]+Fund\s*\([GD]\))\s*₹([\d,]+)\s*₹([\d,]+)\s*[₹\-]?([\d,]+)\s*\(?([+-]?[\d.]+)%?\)?\s*([+-]?[\d.]+)%/gi,
	];

	// Also try to find the table section with fund details
	const tableSection = text.match(/Equity Mutual Fund.*?Total\s*₹[\d,]+/is);
	if (tableSection) {
		const tableText = tableSection[0];

		// Match each fund entry with its details
		const fundRegex =
			/([A-Za-z][A-Za-z\s&]+(?:Fund|Cap Fund|Flexicap Fund)[^₹]*)\s*₹([\d,]+)\s*₹([\d,]+)\s*[₹]?([-\d,]+)\s*\(?([+-]?[\d.]+)%?\)?\s*([+-]?[\d.]+)%?\s*([\d.]+)%/gi;
		let match;

		while ((match = fundRegex.exec(tableText)) !== null) {
			const fundName = match[1].replace(/\s+/g, " ").trim();
			const invested = parseAmountFromText(match[2]);
			const current = parseAmountFromText(match[3]);
			const gainAmount = parseAmountFromText(match[4]);
			const gainPercent = parsePercentFromText(match[5]);
			const xirr = parsePercentFromText(match[6]);

			if (fundName && invested > 0) {
				holdings.push({
					fundName,
					investedAmount: invested,
					currentValue: current,
					units: 0,
					nav: 0,
					unrealizedGain: gainAmount,
					unrealizedGainPercent: gainPercent,
					xirr,
					assetClass: "Equity",
					category: "Mutual Fund",
				});
			}
		}
	}

	// If regex didn't work, try line-by-line parsing for known fund names
	if (holdings.length === 0) {
		const knownFundPatterns = [
			/Invesco India.*Fund/i,
			/Nippon India.*Fund/i,
			/Sundaram.*Fund/i,
			/JM.*Fund/i,
			/HDFC.*Fund/i,
			/ICICI.*Fund/i,
			/SBI.*Fund/i,
			/Axis.*Fund/i,
			/Kotak.*Fund/i,
		];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			for (const pattern of knownFundPatterns) {
				if (pattern.test(line)) {
					// Found a fund name, look for amounts in nearby lines
					const combinedText = lines
						.slice(i, Math.min(i + 5, lines.length))
						.join(" ");
					const amountMatch = combinedText.match(/₹([\d,]+).*?₹([\d,]+)/);
					const percentMatch = combinedText.match(/\(([\d.-]+)%\)/);
					const xirrMatch = combinedText.match(/([\d.-]+)%\s+[\d.]+%/);

					if (amountMatch) {
						const fundName =
							line
								.match(/([A-Za-z][A-Za-z\s&]+(?:Fund|Cap Fund)[^₹]*)/)?.[1]
								?.trim() || line;

						holdings.push({
							fundName: fundName.replace(/\s+/g, " ").trim(),
							investedAmount: parseAmountFromText(amountMatch[1]),
							currentValue: parseAmountFromText(amountMatch[2]),
							units: 0,
							nav: 0,
							unrealizedGain: 0,
							unrealizedGainPercent: percentMatch
								? Number.parseFloat(percentMatch[1])
								: 0,
							xirr: xirrMatch ? Number.parseFloat(xirrMatch[1]) : 0,
							assetClass: "Equity",
							category: "Mutual Fund",
						});
					}
					break;
				}
			}
		}
	}

	// Parse detailed holdings section to get units and NAV
	const detailPatterns =
		/Detailed Holdings Statement for ([^₹]+)\s+.*?Total\s+Invested.*?₹([\d,]+).*?Current.*?Value.*?₹([\d,]+).*?XIRR.*?([\d.-]+)%.*?Units:\s*([\d,.]+).*?NAV:\s*([\d,.]+)/gis;
	let detailMatch;
	while ((detailMatch = detailPatterns.exec(text)) !== null) {
		const fundName = detailMatch[1].replace(/\s+/g, " ").trim();
		const units = Number.parseFloat(detailMatch[5].replace(/,/g, "")) || 0;
		const nav = Number.parseFloat(detailMatch[6].replace(/,/g, "")) || 0;

		// Update existing holding with units and NAV
		const holding = holdings.find(
			(h) =>
				h.fundName
					.toLowerCase()
					.includes(fundName.toLowerCase().split(" ")[0]) ||
				fundName.toLowerCase().includes(h.fundName.toLowerCase().split(" ")[0]),
		);
		if (holding) {
			holding.units = units;
			holding.nav = nav;
		}
	}

	// Extract report date
	const dateMatch = text.match(
		/(\d{1,2}[-\/]?[A-Za-z]{3}[-\/]?\d{2,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
	);
	const reportDate = dateMatch ? dateMatch[1] : undefined;

	return {
		clientInfo,
		summary: {
			totalInvested,
			currentValue,
			unrealizedGain: totalUnrealizedGain,
			unrealizedGainPercent:
				totalInvested > 0
					? ((currentValue - totalInvested) / totalInvested) * 100
					: 0,
			xirr: totalXirr,
		},
		holdings,
		reportDate,
	};
}

// Parse holding report PDF

export default router;
