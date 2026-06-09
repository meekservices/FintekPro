// @ts-nocheck
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

router.post("/store/invits", async (req: Request, res: Response) => {
	try {
		const data = req.body;
		const newInvit = await db
			.insert(invits)
			.values({
				id: `invit-${Date.now()}`,
				name: data.name,
				symbol: data.symbol,
				sector: data.sector,
				sponsor: data.sponsor,
				marketCap: data.marketCap,
				currentPrice: data.currentPrice,
				dividendYield: data.dividendYield,
				nav: data.nav,
				totalAssets: data.totalAssets,
				aiSignal: data.aiSignal,
				isPublished: data.isPublished || false,
				description: data.description,
			})
			.returning();

		res.json({ success: true, invit: newInvit[0] });
	} catch (error) {
		console.error("Error creating InvIT:", error);
		res.status(500).json({ error: "Failed to create InvIT" });
	}
});

// PATCH /store/reits/:id - Update REIT
router.patch("/store/reits/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		const updated = await db
			.update(reits)
			.set(updates)
			.where(eq(reits.id, id))
			.returning();

		if (updated.length === 0) {
			return res.status(404).json({ error: "REIT not found" });
		}

		res.json({ success: true, reit: updated[0] });
	} catch (error) {
		console.error("Error updating REIT:", error);
		res.status(500).json({ error: "Failed to update REIT" });
	}
});

// PATCH /store/invits/:id - Update InvIT
router.patch("/store/invits/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		const updated = await db
			.update(invits)
			.set(updates)
			.where(eq(invits.id, id))
			.returning();

		if (updated.length === 0) {
			return res.status(404).json({ error: "InvIT not found" });
		}

		res.json({ success: true, invit: updated[0] });
	} catch (error) {
		console.error("Error updating InvIT:", error);
		res.status(500).json({ error: "Failed to update InvIT" });
	}
});

// PATCH /store/reits/:id/publish - Toggle REIT publish status
router.patch(
	"/store/reits/:id/publish",
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const { isPublished } = req.body;

			const updated = await db
				.update(reits)
				.set({ isPublished })
				.where(eq(reits.id, id))
				.returning();

			if (updated.length === 0) {
				return res.status(404).json({ error: "REIT not found" });
			}

			res.json({ success: true, reit: updated[0] });
		} catch (error) {
			console.error("Error toggling REIT publish status:", error);
			res.status(500).json({ error: "Failed to update publish status" });
		}
	},
);

// PATCH /store/invits/:id/publish - Toggle InvIT publish status
router.patch(
	"/store/invits/:id/publish",
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const { isPublished } = req.body;

			const updated = await db
				.update(invits)
				.set({ isPublished })
				.where(eq(invits.id, id))
				.returning();

			if (updated.length === 0) {
				return res.status(404).json({ error: "InvIT not found" });
			}

			res.json({ success: true, invit: updated[0] });
		} catch (error) {
			console.error("Error toggling InvIT publish status:", error);
			res.status(500).json({ error: "Failed to update publish status" });
		}
	},
);

// ============================================
// DATA REFRESH ROUTES (NSE/BSE/Yahoo Integration)
// ============================================

// GET /data-refresh/status - Get refresh service status
router.get("/data-refresh/status", async (req: Request, res: Response) => {
	try {
		const status = reitInvitDataService.getStatus();
		res.json({
			success: true,
			status,
			knownReits: reitInvitDataService.getKnownReits(),
			knownInvits: reitInvitDataService.getKnownInvits(),
		});
	} catch (error) {
		console.error("Error getting refresh status:", error);
		res.status(500).json({ error: "Failed to get refresh status" });
	}
});

// POST /data-refresh/all - Trigger full refresh of all REITs and InvITs
router.post("/data-refresh/all", async (req: Request, res: Response) => {
	try {
		const result = await reitInvitDataService.refreshAll();
		res.json({ success: true, ...result });
	} catch (error: any) {
		console.error("Error refreshing all data:", error);
		res.status(500).json({ error: error.message || "Failed to refresh data" });
	}
});

// POST /data-refresh/reits - Refresh all REITs
router.post("/data-refresh/reits", async (req: Request, res: Response) => {
	try {
		const result = await reitInvitDataService.refreshAllReits();
		res.json({ success: true, ...result });
	} catch (error) {
		console.error("Error refreshing REITs:", error);
		res.status(500).json({ error: "Failed to refresh REITs" });
	}
});

// POST /data-refresh/invits - Refresh all InvITs
router.post("/data-refresh/invits", async (req: Request, res: Response) => {
	try {
		const result = await reitInvitDataService.refreshAllInvits();
		res.json({ success: true, ...result });
	} catch (error) {
		console.error("Error refreshing InvITs:", error);
		res.status(500).json({ error: "Failed to refresh InvITs" });
	}
});

// POST /data-refresh/reit/:symbol - Refresh single REIT
router.post(
	"/data-refresh/reit/:symbol",
	async (req: Request, res: Response) => {
		try {
			const { symbol } = req.params;
			const result = await reitInvitDataService.refreshReit(symbol);
			res.json(result);
		} catch (error) {
			console.error("Error refreshing REIT:", error);
			res.status(500).json({ error: "Failed to refresh REIT" });
		}
	},
);

// POST /data-refresh/invit/:symbol - Refresh single InvIT
router.post(
	"/data-refresh/invit/:symbol",
	async (req: Request, res: Response) => {
		try {
			const { symbol } = req.params;
			const result = await reitInvitDataService.refreshInvit(symbol);
			res.json(result);
		} catch (error) {
			console.error("Error refreshing InvIT:", error);
			res.status(500).json({ error: "Failed to refresh InvIT" });
		}
	},
);

// POST /data-refresh/scheduler/start - Start scheduled refresh
router.post(
	"/data-refresh/scheduler/start",
	async (req: Request, res: Response) => {
		try {
			const { intervalHours = 6 } = req.body;
			reitInvitDataService.startScheduledRefresh(intervalHours);
			res.json({
				success: true,
				message: `Scheduled refresh started (every ${intervalHours} hours)`,
				status: reitInvitDataService.getStatus(),
			});
		} catch (error) {
			console.error("Error starting scheduler:", error);
			res.status(500).json({ error: "Failed to start scheduler" });
		}
	},
);

// POST /data-refresh/scheduler/stop - Stop scheduled refresh
router.post(
	"/data-refresh/scheduler/stop",
	async (req: Request, res: Response) => {
		try {
			reitInvitDataService.stopScheduledRefresh();
			res.json({
				success: true,
				message: "Scheduled refresh stopped",
				status: reitInvitDataService.getStatus(),
			});
		} catch (error) {
			console.error("Error stopping scheduler:", error);
			res.status(500).json({ error: "Failed to stop scheduler" });
		}
	},
);

// Unlisted REITs — from unlisted_companies table
router.get("/unlisted-reits", async (req: Request, res: Response) => {
	try {
		const { search } = req.query;
		const query = db
			.select()
			.from(unlistedCompanies)
			.where(ilike(unlistedCompanies.industry, "%REIT%"))
			.orderBy(asc(unlistedCompanies.name));

		const rows = await query;
		const filtered = search
			? rows.filter((r) =>
					r.name.toLowerCase().includes((search as string).toLowerCase()),
				)
			: rows;

		res.json({ success: true, data: filtered, total: filtered.length });
	} catch (error) {
		console.error("Error fetching unlisted REITs:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch unlisted REITs" });
	}
});

// Unlisted InvITs — from unlisted_companies table
router.get("/unlisted-invits", async (req: Request, res: Response) => {
	try {
		const { search, industry } = req.query;
		const rows = await db
			.select()
			.from(unlistedCompanies)
			.where(ilike(unlistedCompanies.industry, "%InvIT%"))
			.orderBy(asc(unlistedCompanies.name));

		let filtered = rows;
		if (search) {
			filtered = filtered.filter((r) =>
				r.name.toLowerCase().includes((search as string).toLowerCase()),
			);
		}
		if (industry && industry !== "all") {
			filtered = filtered.filter((r) =>
				r.industry?.toLowerCase().includes((industry as string).toLowerCase()),
			);
		}

		res.json({ success: true, data: filtered, total: filtered.length });
	} catch (error) {
		console.error("Error fetching unlisted InvITs:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch unlisted InvITs" });
	}
});

export default router;
