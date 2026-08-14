import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, sql, desc, ilike, or, gte, lte, asc } from "drizzle-orm";
import {
	reits,
	invits,
	reitInvitOrders,
	reitInvitHoldings,
	users,
	userProfiles,
	unlistedCompanies,
} from "@shared/schema";
import { z } from "zod";
import { reitInvitDataService } from "../services/reit-invit-data-service";
import {
	aiReitInvitService,
	ReitInvitAsset,
} from "../services/ai-reit-invit-service";
import { unifiedStockPriceService } from "../services/unified-stock-price-service";

const router = Router();

const SAMPLE_REITS = [
	{
		id: "reit-1",
		symbol: "EMBASSY",
		name: "Embassy Office Parks REIT",
		sponsor: "Embassy Group & Blackstone",
		manager: "Embassy Office Parks Management Services",
		sector: "office",
		propertyType: "commercial",
		geography: "Bangalore, Mumbai, Pune, Noida",
		totalProperties: 14,
		totalLeasableArea: "45000000",
		occupancyRate: "89.5",
		currentPrice: "362.45",
		nav: "395.20",
		premiumToNav: "-8.28",
		weekHigh52: "425.00",
		weekLow52: "298.50",
		marketCap: "34500000000",
		distributionYield: "6.85",
		dividendFrequency: "quarterly",
		lastDividend: "6.21",
		returns1M: "2.5",
		returns3M: "5.8",
		returns6M: "8.2",
		returns1Y: "12.5",
		returns3Y: "28.4",
		debtToEquity: "0.45",
		interestCoverageRatio: "3.2",
		minimumInvestment: "362.45",
		lotSize: 1,
		riskLevel: "moderate",
		creditRating: "AAA",
		ratingAgency: "CRISIL",
		aiSignal: "buy",
		aiConfidence: "82.5",
		aiRationale:
			"Strong occupancy rates with premium Grade-A office properties. Attractive yield compared to government bonds. Potential NAV re-rating as office demand recovers post-pandemic.",
		aiTargetPrice: "410.00",
		isActive: true,
	},
	{
		id: "reit-2",
		symbol: "MINDSPACE",
		name: "Mindspace Business Parks REIT",
		sponsor: "K Raheja Corp & Blackstone",
		manager: "Mindspace Business Parks REIT Management",
		sector: "office",
		propertyType: "commercial",
		geography: "Hyderabad, Mumbai, Pune, Chennai",
		totalProperties: 5,
		totalLeasableArea: "32000000",
		occupancyRate: "91.2",
		currentPrice: "328.90",
		nav: "348.50",
		premiumToNav: "-5.62",
		weekHigh52: "385.00",
		weekLow52: "275.00",
		marketCap: "19500000000",
		distributionYield: "7.12",
		dividendFrequency: "quarterly",
		lastDividend: "5.85",
		returns1M: "1.8",
		returns3M: "4.5",
		returns6M: "7.8",
		returns1Y: "15.2",
		returns3Y: "32.1",
		debtToEquity: "0.38",
		interestCoverageRatio: "3.8",
		minimumInvestment: "328.90",
		lotSize: 1,
		riskLevel: "moderate",
		creditRating: "AAA",
		ratingAgency: "ICRA",
		aiSignal: "buy",
		aiConfidence: "78.3",
		aiRationale:
			"Higher distribution yield with improving occupancy. Strong tenant base of IT/ITeS companies. Well-positioned for hybrid work trend with quality infrastructure.",
		aiTargetPrice: "375.00",
		isActive: true,
	},
	{
		id: "reit-3",
		symbol: "BROOKFIELD",
		name: "Brookfield India Real Estate Trust",
		sponsor: "Brookfield Asset Management",
		manager: "Brookprop Management Services",
		sector: "office",
		propertyType: "commercial",
		geography: "Noida, Gurugram, Mumbai, Kolkata",
		totalProperties: 4,
		totalLeasableArea: "18500000",
		occupancyRate: "85.8",
		currentPrice: "285.60",
		nav: "312.40",
		premiumToNav: "-8.58",
		weekHigh52: "345.00",
		weekLow52: "240.00",
		marketCap: "12800000000",
		distributionYield: "7.45",
		dividendFrequency: "quarterly",
		lastDividend: "5.32",
		returns1M: "0.8",
		returns3M: "3.2",
		returns6M: "5.5",
		returns1Y: "8.9",
		returns3Y: "18.5",
		debtToEquity: "0.52",
		interestCoverageRatio: "2.9",
		minimumInvestment: "285.60",
		lotSize: 1,
		riskLevel: "moderate",
		creditRating: "AA+",
		ratingAgency: "CRISIL",
		aiSignal: "hold",
		aiConfidence: "65.2",
		aiRationale:
			"Attractive valuation with highest yield among listed REITs. However, occupancy improvement needed in NCR assets. Wait for better entry point or signs of occupancy recovery.",
		aiTargetPrice: "310.00",
		isActive: true,
	},
	{
		id: "reit-4",
		symbol: "NEXUS",
		name: "Nexus Select Trust",
		sponsor: "Blackstone",
		manager: "Nexus Select Mall Management",
		sector: "retail",
		propertyType: "commercial",
		geography: "Bangalore, Mumbai, Delhi, Hyderabad, Chandigarh",
		totalProperties: 17,
		totalLeasableArea: "9800000",
		occupancyRate: "96.5",
		currentPrice: "142.80",
		nav: "138.90",
		premiumToNav: "2.81",
		weekHigh52: "165.00",
		weekLow52: "118.00",
		marketCap: "21500000000",
		distributionYield: "5.85",
		dividendFrequency: "quarterly",
		lastDividend: "2.09",
		returns1M: "3.2",
		returns3M: "8.5",
		returns6M: "15.2",
		returns1Y: "22.8",
		returns3Y: null,
		debtToEquity: "0.28",
		interestCoverageRatio: "4.5",
		minimumInvestment: "142.80",
		lotSize: 1,
		riskLevel: "moderate",
		creditRating: "AAA",
		ratingAgency: "CRISIL",
		aiSignal: "buy",
		aiConfidence: "85.0",
		aiRationale:
			"Premium retail REIT with highest occupancy. Benefiting from strong consumption recovery. Premium malls in metro cities command pricing power. Good capital appreciation potential.",
		aiTargetPrice: "165.00",
		isActive: true,
	},
];

const SAMPLE_INVITS = [
	{
		id: "invit-1",
		symbol: "POWERGRID",
		name: "PowerGrid Infrastructure Investment Trust",
		sponsor: "Power Grid Corporation of India",
		manager: "PowerGrid InvIT Management",
		sector: "power",
		infrastructureType: "transmission",
		geography: "Pan India - Multiple States",
		totalAssets: 11,
		assetDetails: "Interstate transmission lines and substations",
		concessionLife: "22.5",
		currentPrice: "118.50",
		nav: "125.80",
		premiumToNav: "-5.80",
		weekHigh52: "145.00",
		weekLow52: "98.00",
		marketCap: "18200000000",
		distributionYield: "11.25",
		dividendFrequency: "quarterly",
		lastDividend: "3.33",
		returns1M: "1.2",
		returns3M: "4.8",
		returns6M: "8.5",
		returns1Y: "14.2",
		returns3Y: "35.8",
		debtToEquity: "1.25",
		interestCoverageRatio: "2.1",
		ebitda: "4500000000",
		minimumInvestment: "118.50",
		lotSize: 1,
		riskLevel: "low",
		creditRating: "AAA",
		ratingAgency: "CRISIL",
		aiSignal: "buy",
		aiConfidence: "88.5",
		aiRationale:
			"Government-backed sponsor with regulated returns. Highest yield among InvITs with stable cash flows. Transmission assets have minimal operational risk and predictable revenues.",
		aiTargetPrice: "135.00",
		isActive: true,
	},
	{
		id: "invit-2",
		symbol: "INDIGRID",
		name: "India Grid Trust",
		sponsor: "KKR & Sterlite Power",
		manager: "Sterlite Investment Managers",
		sector: "power",
		infrastructureType: "transmission",
		geography: "Gujarat, Maharashtra, Rajasthan, MP, UP",
		totalAssets: 18,
		assetDetails: "Transmission lines, substations, and solar assets",
		concessionLife: "28.5",
		currentPrice: "142.30",
		nav: "152.60",
		premiumToNav: "-6.75",
		weekHigh52: "168.00",
		weekLow52: "115.00",
		marketCap: "15800000000",
		distributionYield: "10.85",
		dividendFrequency: "quarterly",
		lastDividend: "3.86",
		returns1M: "2.1",
		returns3M: "5.5",
		returns6M: "9.8",
		returns1Y: "18.5",
		returns3Y: "42.3",
		debtToEquity: "1.45",
		interestCoverageRatio: "1.9",
		ebitda: "3200000000",
		minimumInvestment: "142.30",
		lotSize: 1,
		riskLevel: "low",
		creditRating: "AAA",
		ratingAgency: "ICRA",
		aiSignal: "buy",
		aiConfidence: "82.0",
		aiRationale:
			"Diverse portfolio with growing renewable energy assets. Long concession life provides visibility. Active acquisition strategy for continued growth. Strong sponsor backing from KKR.",
		aiTargetPrice: "160.00",
		isActive: true,
	},
	{
		id: "invit-3",
		symbol: "IRB",
		name: "IRB InvIT Fund",
		sponsor: "IRB Infrastructure Developers",
		manager: "IRB Infrastructure Managers",
		sector: "roads",
		infrastructureType: "toll_roads",
		geography: "Maharashtra, Gujarat, Karnataka, Rajasthan",
		totalAssets: 7,
		assetDetails: "Toll road projects on national highways",
		concessionLife: "12.8",
		currentPrice: "58.20",
		nav: "65.40",
		premiumToNav: "-11.01",
		weekHigh52: "75.00",
		weekLow52: "45.00",
		marketCap: "8500000000",
		distributionYield: "8.95",
		dividendFrequency: "quarterly",
		lastDividend: "1.30",
		returns1M: "-1.5",
		returns3M: "2.8",
		returns6M: "5.2",
		returns1Y: "12.8",
		returns3Y: "25.5",
		debtToEquity: "1.85",
		interestCoverageRatio: "1.5",
		ebitda: "1800000000",
		minimumInvestment: "58.20",
		lotSize: 1,
		riskLevel: "moderate",
		creditRating: "AA",
		ratingAgency: "CRISIL",
		aiSignal: "hold",
		aiConfidence: "62.5",
		aiRationale:
			"Toll road InvIT with traffic volume sensitivity. Higher operational risk compared to transmission InvITs. Attractive yield but requires monitoring of traffic trends and economic conditions.",
		aiTargetPrice: "65.00",
		isActive: true,
	},
	{
		id: "invit-4",
		symbol: "NATIONALHI",
		name: "National Highways Infra Trust",
		sponsor: "NHAI",
		manager: "NH Infra Asset Managers",
		sector: "roads",
		infrastructureType: "toll_roads",
		geography: "Pan India National Highways",
		totalAssets: 5,
		assetDetails: "Toll-operate-transfer highway projects",
		concessionLife: "18.2",
		currentPrice: "45.80",
		nav: "52.30",
		premiumToNav: "-12.43",
		weekHigh52: "58.00",
		weekLow52: "38.00",
		marketCap: "6200000000",
		distributionYield: "9.85",
		dividendFrequency: "quarterly",
		lastDividend: "1.13",
		returns1M: "0.5",
		returns3M: "3.2",
		returns6M: "6.8",
		returns1Y: "10.5",
		returns3Y: null,
		debtToEquity: "1.65",
		interestCoverageRatio: "1.7",
		ebitda: "1200000000",
		minimumInvestment: "45.80",
		lotSize: 1,
		riskLevel: "moderate",
		creditRating: "AA+",
		ratingAgency: "ICRA",
		aiSignal: "hold",
		aiConfidence: "58.0",
		aiRationale:
			"Government-backed InvIT but with traffic volume risk. Suitable for income-focused investors comfortable with infrastructure sector. Monitor for potential NHAI asset additions.",
		aiTargetPrice: "50.00",
		isActive: true,
	},
	{
		id: "invit-5",
		symbol: "BHARATIHWI",
		name: "Bharti AirTel Infrastructure Trust",
		sponsor: "Bharti Infratel",
		manager: "Bharti Infra Asset Management",
		sector: "telecom",
		infrastructureType: "fiber",
		geography: "Pan India Metro Cities",
		totalAssets: 25000,
		assetDetails: "Telecom towers and fiber infrastructure",
		concessionLife: "30.0",
		currentPrice: "285.40",
		nav: "298.50",
		premiumToNav: "-4.39",
		weekHigh52: "325.00",
		weekLow52: "225.00",
		marketCap: "28500000000",
		distributionYield: "7.25",
		dividendFrequency: "quarterly",
		lastDividend: "5.18",
		returns1M: "2.8",
		returns3M: "7.5",
		returns6M: "12.2",
		returns1Y: "20.5",
		returns3Y: "45.8",
		debtToEquity: "0.95",
		interestCoverageRatio: "2.8",
		ebitda: "8500000000",
		minimumInvestment: "285.40",
		lotSize: 1,
		riskLevel: "low",
		creditRating: "AAA",
		ratingAgency: "CRISIL",
		aiSignal: "buy",
		aiConfidence: "79.5",
		aiRationale:
			"Digital infrastructure play with 5G tailwinds. Long tenure contracts with telecom operators. Growing data consumption drives tower and fiber demand. Strong sponsor in Bharti group.",
		aiTargetPrice: "320.00",
		isActive: true,
	},
];

router.get("/reits", async (req: Request, res: Response) => {
	try {
		const {
			sector,
			riskLevel,
			minYield,
			maxYield,
			aiSignal,
			sortBy,
			sortOrder,
		} = req.query;

		let filteredReits = [...SAMPLE_REITS];

		if (sector && sector !== "all") {
			filteredReits = filteredReits.filter((r) => r.sector === sector);
		}
		if (riskLevel && riskLevel !== "all") {
			filteredReits = filteredReits.filter((r) => r.riskLevel === riskLevel);
		}
		if (aiSignal && aiSignal !== "all") {
			filteredReits = filteredReits.filter((r) => r.aiSignal === aiSignal);
		}
		if (minYield) {
			filteredReits = filteredReits.filter(
				(r) =>
					Number.parseFloat(r.distributionYield) >=
					Number.parseFloat(minYield as string),
			);
		}
		if (maxYield) {
			filteredReits = filteredReits.filter(
				(r) =>
					Number.parseFloat(r.distributionYield) <=
					Number.parseFloat(maxYield as string),
			);
		}

		if (sortBy) {
			const order = sortOrder === "asc" ? 1 : -1;
			filteredReits.sort((a: any, b: any) => {
				const aVal = Number.parseFloat(a[sortBy as string]) || 0;
				const bVal = Number.parseFloat(b[sortBy as string]) || 0;
				return (aVal - bVal) * order;
			});
		}

		res.json({
			success: true,
			data: filteredReits,
			total: filteredReits.length,
		});
	} catch (error) {
		console.error("Error fetching REITs:", error);
		res.status(500).json({ success: false, error: "Failed to fetch REITs" });
	}
});

router.get("/reits/:symbol", async (req: Request, res: Response) => {
	try {
		const { symbol } = req.params;
		const reit = SAMPLE_REITS.find(
			(r) => r.symbol.toLowerCase() === symbol.toLowerCase(),
		);

		if (!reit) {
			return res.status(404).json({ success: false, error: "REIT not found" });
		}

		res.json({ success: true, data: reit });
	} catch (error) {
		console.error("Error fetching REIT:", error);
		res.status(500).json({ success: false, error: "Failed to fetch REIT" });
	}
});

router.get("/invits", async (req: Request, res: Response) => {
	try {
		const {
			sector,
			riskLevel,
			minYield,
			maxYield,
			aiSignal,
			sortBy,
			sortOrder,
		} = req.query;

		let filteredInvits = [...SAMPLE_INVITS];

		if (sector && sector !== "all") {
			filteredInvits = filteredInvits.filter((i) => i.sector === sector);
		}
		if (riskLevel && riskLevel !== "all") {
			filteredInvits = filteredInvits.filter((i) => i.riskLevel === riskLevel);
		}
		if (aiSignal && aiSignal !== "all") {
			filteredInvits = filteredInvits.filter((i) => i.aiSignal === aiSignal);
		}
		if (minYield) {
			filteredInvits = filteredInvits.filter(
				(i) =>
					Number.parseFloat(i.distributionYield) >=
					Number.parseFloat(minYield as string),
			);
		}
		if (maxYield) {
			filteredInvits = filteredInvits.filter(
				(i) =>
					Number.parseFloat(i.distributionYield) <=
					Number.parseFloat(maxYield as string),
			);
		}

		if (sortBy) {
			const order = sortOrder === "asc" ? 1 : -1;
			filteredInvits.sort((a: any, b: any) => {
				const aVal = Number.parseFloat(a[sortBy as string]) || 0;
				const bVal = Number.parseFloat(b[sortBy as string]) || 0;
				return (aVal - bVal) * order;
			});
		}

		res.json({
			success: true,
			data: filteredInvits,
			total: filteredInvits.length,
		});
	} catch (error) {
		console.error("Error fetching InvITs:", error);
		res.status(500).json({ success: false, error: "Failed to fetch InvITs" });
	}
});

router.get("/invits/:symbol", async (req: Request, res: Response) => {
	try {
		const { symbol } = req.params;
		const invit = SAMPLE_INVITS.find(
			(i) => i.symbol.toLowerCase() === symbol.toLowerCase(),
		);

		if (!invit) {
			return res.status(404).json({ success: false, error: "InvIT not found" });
		}

		res.json({ success: true, data: invit });
	} catch (error) {
		console.error("Error fetching InvIT:", error);
		res.status(500).json({ success: false, error: "Failed to fetch InvIT" });
	}
});

router.get("/ai-recommendations", async (req: Request, res: Response) => {
	try {
		const { riskProfile, investmentHorizon, investmentGoal, investmentAmount } =
			req.query;

		// Fetch live prices for all REIT/InvIT symbols (NSE listed) in one batch
		const allSymbols = [
			...SAMPLE_REITS.map((r) => r.symbol),
			...SAMPLE_INVITS.map((i) => i.symbol),
		];
		const livePriceMap = new Map<string, number>();
		try {
			const batchResult = await unifiedStockPriceService.getBatchPrices(
				allSymbols,
				"NSE",
			);
			for (const [symbol, data] of batchResult.prices.entries()) {
				if (data?.price > 0) livePriceMap.set(symbol.toUpperCase(), data.price);
			}
		} catch (_) {
			/* non-blocking — fall back to sample prices */
		}

		const resolvePrice = (symbol: string, fallback: string): string => {
			const live = livePriceMap.get(symbol.toUpperCase());
			return live ? live.toFixed(2) : fallback;
		};

		const allAssets: ReitInvitAsset[] = [
			...SAMPLE_REITS.map((r) => ({
				type: "reit" as const,
				symbol: r.symbol,
				name: r.name,
				sector: r.sector,
				currentPrice: resolvePrice(r.symbol, r.currentPrice),
				distributionYield: r.distributionYield,
				returns1Y: r.returns1Y,
				riskLevel: r.riskLevel,
				creditRating: r.creditRating,
				occupancyRate: r.occupancyRate,
				premiumToNav: r.premiumToNav,
				sponsor: r.sponsor,
			})),
			...SAMPLE_INVITS.map((i) => ({
				type: "invit" as const,
				symbol: i.symbol,
				name: i.name,
				sector: i.sector,
				currentPrice: resolvePrice(i.symbol, i.currentPrice),
				distributionYield: i.distributionYield,
				returns1Y: i.returns1Y,
				riskLevel: i.riskLevel,
				creditRating: i.creditRating,
				concessionLife: i.concessionLife,
				premiumToNav: i.premiumToNav,
				sponsor: i.sponsor,
			})),
		];

		const userProfile = {
			riskProfile:
				(riskProfile as "conservative" | "moderate" | "aggressive") ||
				"moderate",
			investmentHorizon: investmentHorizon as
				| "short_term"
				| "medium_term"
				| "long_term"
				| undefined,
			investmentGoal: investmentGoal as
				| "income"
				| "growth"
				| "balanced"
				| "capital_preservation"
				| undefined,
			investmentAmount: investmentAmount
				? Number.parseFloat(investmentAmount as string)
				: undefined,
		};

		const recommendations =
			await aiReitInvitService.generatePersonalizedRecommendations(
				allAssets,
				userProfile,
			);

		const avgYield =
			recommendations.length > 0
				? (
						recommendations.reduce(
							(sum, r) => sum + Number.parseFloat(r.distributionYield),
							0,
						) / recommendations.length
					).toFixed(2)
				: "0";
		const avgConfidence =
			recommendations.length > 0
				? (
						recommendations.reduce(
							(sum, r) => sum + Number.parseFloat(r.aiConfidence),
							0,
						) / recommendations.length
					).toFixed(1)
				: "0";

		res.json({
			success: true,
			recommendations,
			summary: {
				totalRecommendations: recommendations.length,
				avgYield,
				avgConfidence,
				riskProfile: userProfile.riskProfile,
				investmentGoal: userProfile.investmentGoal || "balanced",
			},
		});
	} catch (error) {
		console.error("Error fetching AI recommendations:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch recommendations" });
	}
});

router.get("/market-overview", async (req: Request, res: Response) => {
	try {
		const reitStats = {
			totalMarketCap: SAMPLE_REITS.reduce(
				(sum, r) => sum + Number.parseFloat(r.marketCap),
				0,
			),
			avgYield: (
				SAMPLE_REITS.reduce(
					(sum, r) => sum + Number.parseFloat(r.distributionYield),
					0,
				) / SAMPLE_REITS.length
			).toFixed(2),
			avgOccupancy: (
				SAMPLE_REITS.reduce(
					(sum, r) => sum + Number.parseFloat(r.occupancyRate || "0"),
					0,
				) / SAMPLE_REITS.length
			).toFixed(1),
			topPerformer: SAMPLE_REITS.reduce((max, r) =>
				Number.parseFloat(r.returns1Y || "0") >
				Number.parseFloat(max.returns1Y || "0")
					? r
					: max,
			),
		};

		const invitStats = {
			totalMarketCap: SAMPLE_INVITS.reduce(
				(sum, i) => sum + Number.parseFloat(i.marketCap),
				0,
			),
			avgYield: (
				SAMPLE_INVITS.reduce(
					(sum, i) => sum + Number.parseFloat(i.distributionYield),
					0,
				) / SAMPLE_INVITS.length
			).toFixed(2),
			avgConcessionLife: (
				SAMPLE_INVITS.reduce(
					(sum, i) => sum + Number.parseFloat(i.concessionLife || "0"),
					0,
				) / SAMPLE_INVITS.length
			).toFixed(1),
			topPerformer: SAMPLE_INVITS.reduce((max, i) =>
				Number.parseFloat(i.returns1Y || "0") >
				Number.parseFloat(max.returns1Y || "0")
					? i
					: max,
			),
		};

		res.json({
			success: true,
			reits: {
				count: SAMPLE_REITS.length,
				...reitStats,
			},
			invits: {
				count: SAMPLE_INVITS.length,
				...invitStats,
			},
			sectors: {
				reits: [...new Set(SAMPLE_REITS.map((r) => r.sector))],
				invits: [...new Set(SAMPLE_INVITS.map((i) => i.sector))],
			},
		});
	} catch (error) {
		console.error("Error fetching market overview:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch market overview" });
	}
});

router.get("/compare", async (req: Request, res: Response) => {
	try {
		const { symbols } = req.query;

		if (!symbols) {
			return res
				.status(400)
				.json({ success: false, error: "Symbols required" });
		}

		const symbolList = (symbols as string)
			.split(",")
			.map((s) => s.trim().toUpperCase());

		const compareData = symbolList
			.map((symbol) => {
				const reit = SAMPLE_REITS.find((r) => r.symbol === symbol);
				const invit = SAMPLE_INVITS.find((i) => i.symbol === symbol);

				const asset = reit || invit;
				if (!asset) return null;

				return {
					type: reit ? "reit" : "invit",
					...asset,
				};
			})
			.filter(Boolean);

		res.json({
			success: true,
			data: compareData,
		});
	} catch (error) {
		console.error("Error comparing assets:", error);
		res.status(500).json({ success: false, error: "Failed to compare assets" });
	}
});

const KYC_TIER_REQUIREMENTS: Record<
	string,
	{ minTier: string; description: string }
> = {
	reit: {
		minTier: "tier_2",
		description: "Standard KYC (Tier 2) required for REIT investments",
	},
	invit: {
		minTier: "tier_2",
		description: "Standard KYC (Tier 2) required for InvIT investments",
	},
};

const KYC_TIER_LEVELS: Record<string, number> = {
	basic: 1,
	tier_1: 1,
	tier_2: 2,
	standard: 2,
	tier_3: 3,
	enhanced: 3,
	accredited_investor: 4,
};

function isKycSufficient(userTier: string, requiredTier: string): boolean {
	const userLevel = KYC_TIER_LEVELS[userTier?.toLowerCase()] || 0;
	const requiredLevel = KYC_TIER_LEVELS[requiredTier?.toLowerCase()] || 2;
	return userLevel >= requiredLevel;
}


/**
 * POST /api/reits-invits/admin/seed-all
 * Seeds the full REIT/InvIT catalog (listed + unlisted) into the DB,
 * then immediately enriches current prices via IndiaAPI → Yahoo Finance fallback.
 * Idempotent — existing records are skipped on conflict (upsert by symbol).
 */
router.post("/admin/seed-all", async (_req: Request, res: Response) => {
  const startMs = Date.now();
  try {
    const { seedAllReitsInvits } = await import("../seed-reit-invit");
    const seedResult = await seedAllReitsInvits();

    // Price enrichment — refresh live prices for all seeded instruments
    let priceResult = { reitsUpdated: 0, invitsUpdated: 0, errors: 0 };
    try {
      const refreshed = await reitInvitDataService.refreshAll();
      priceResult = {
        reitsUpdated:  refreshed.reits?.updated  ?? 0,
        invitsUpdated: refreshed.invits?.updated  ?? 0,
        errors:        (refreshed.reits?.errors?.length ?? 0) + (refreshed.invits?.errors?.length ?? 0),
      };
    } catch (priceErr) {
      // Non-fatal — seed already committed; price refresh can be retried
      console.warn("[REIT/InvIT] Price refresh failed (non-fatal):", priceErr);
    }

    return res.json({
      success: true,
      data: {
        seed: seedResult,
        prices: priceResult,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        latency_ms: Date.now() - startMs,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error_code: "REIT_INVIT_SEED_ERROR",
      message: msg,
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

/**
 * POST /api/reits-invits/admin/refresh-prices
 * Refreshes live prices for all existing REIT/InvIT records without re-seeding.
 */
router.post("/admin/refresh-prices", async (_req: Request, res: Response) => {
  const startMs = Date.now();
  try {
    const refreshed = await reitInvitDataService.refreshAll();
    return res.json({
      success: true,
      data: {
        reitsUpdated:  refreshed.reits?.updated  ?? 0,
        reitErrors:    refreshed.reits?.errors   ?? [],
        invitsUpdated: refreshed.invits?.updated  ?? 0,
        invitErrors:   refreshed.invits?.errors   ?? [],
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        latency_ms: Date.now() - startMs,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error_code: "REIT_INVIT_PRICE_REFRESH_ERROR",
      message: msg,
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

export default router;
