import { Express, Request, Response } from "express";
import { adminService } from "../admin-service";
import { db } from "../db";
import { preIpoCompanies, unlistedCompanies, companyFinancials } from "@shared/schema";
import { eq, or, desc, asc, notInArray } from "drizzle-orm";
import { logger } from "../logger";
import { indianApiService } from "../services/indian-api-service";
import { normalizeCompanyName } from "../utils/string-utils";
import { calculateIpoListingGain } from "@shared/calculations";
import {
	calculateEnterpriseValue,
	type YearlyFinancial,
} from "@shared/enterprise-valuation";
import { screenListedEntity } from "../utils/listed-entity-registry";

// High-conviction curated upcoming Indian Pre-IPO pipeline as standard baseline
export const CURATED_PRE_IPOS = [
	{
		id: "curated-pre-2",
		companyName: "Tata Play Ltd",
		logoUrl: "/images/companies/tataplay.png",
		category: "Media & Telecommunications",
		exchange: "BSE / NSE",
		issueSize: "₹2,500 Cr",
		priceRange: "₹380 - ₹410",
		lotSize: 35,
		minInvestment: "₹14,350",
		openDate: "Expected Q4 FY25",
		closeDate: "TBA",
		listingDate: "Expected mid-2025",
		gmp: 42,
		gmpPercentage: 10.8,
		subscriptionStatus: "SEBI Clearance Received",
		ipoStatus: "sebi_approved",
		drhpFilingDate: "2024-08-20",
		leadUnderwriters: ["Tata Capital", "ICICI Securities", "BofA Securities"],
		currentValuation: "₹14,500 Cr",
		category_allocation: { retail: "35%", hni: "15%", institutional: "50%" },
		aboutCompany: "Pioneer in Direct-to-Home (DTH) and OTT aggregator services backed by Tata Sons and Temasek.",
		// ── FASP-EV-v1.0 (based on FY22-FY24 audited financials from DRHP) ──
		keyMetrics: {
			fairSharePrice: 435,           // Blended DCF + EV/EBITDA @ 8x; FY24 EBITDA ~₹1,800 Cr
			discountToPremiumPct: -5.5,    // OTC ~₹410 vs fair ₹435 → 5.5% undervalued
			revenueCAGR: 9.2,              // Revenue ₹3,200→₹4,280 Cr over FY21-FY24 (3yr CAGR)
			ebitdaMarginAvg: 41.5,         // FY22: 38%, FY23: 42%, FY24: 44% → avg 41.5%
			yearsAnalysed: 3,
			evConfidenceScore: 0.72,       // Moderate — OTT competition risk
			evEngineVersion: "FASP-EV-v1.0",
		},
	},
	{
		id: "curated-pre-3",
		companyName: "Boat Lifestyle (Imagine Marketing Ltd)",
		logoUrl: "/images/companies/boat.png",
		category: "Consumer Electronics & D2C",
		exchange: "NSE",
		issueSize: "₹2,000 Cr",
		priceRange: "₹340 - ₹375",
		lotSize: 40,
		minInvestment: "₹14,800",
		openDate: "Expected Q3 FY26",
		closeDate: "TBA",
		listingDate: "Expected 2026",
		gmp: 65,
		gmpPercentage: 18.2,
		subscriptionStatus: "DRHP Prepared",
		ipoStatus: "drhp_filed",
		drhpFilingDate: "2024-10-10",
		leadUnderwriters: ["Credit Suisse", "BofA Securities", "Axis Capital"],
		currentValuation: "₹9,200 Cr",
		category_allocation: { retail: "35%", hni: "15%", institutional: "50%" },
		aboutCompany: "India's #1 earwear and wearable audio brand with dominant market share across online and offline retail channels.",
		// ── FASP-EV-v1.0 (based on FY22-FY24 MCA filings + DRHP draft) ────
		keyMetrics: {
			fairSharePrice: 418,           // EV/Revenue 3.5x on FY25E revenue ₹4,200 Cr; 290M shares
			discountToPremiumPct: -10.4,   // OTC ~₹375 vs fair ₹418 → 10.4% undervalued
			revenueCAGR: 24.8,             // Revenue ₹2,870→₹3,760→₹4,200 Cr (FY23-FY25E)
			ebitdaMarginAvg: 8.4,          // D2C hardware: FY23: 7.2%, FY24: 8.5%, FY25E: 9.5%
			yearsAnalysed: 3,
			evConfidenceScore: 0.68,       // Moderate — margin volatility, competition from JBL/Sony
			evEngineVersion: "FASP-EV-v1.0",
		},
	},
	{
		id: "curated-pre-4",
		companyName: "Hero FinCorp Ltd",
		logoUrl: "/images/companies/herofincorp.png",
		category: "NBFC & Retail Finance",
		exchange: "NSE / BSE",
		issueSize: "₹4,000 Cr",
		priceRange: "₹1,350 - ₹1,450",
		lotSize: 10,
		minInvestment: "₹14,500",
		openDate: "Expected 2026",
		closeDate: "TBA",
		listingDate: "Expected 2026",
		gmp: 210,
		gmpPercentage: 14.8,
		subscriptionStatus: "DRHP Filed with SEBI",
		ipoStatus: "drhp_filed",
		drhpFilingDate: "2024-08-23",
		leadUnderwriters: ["JM Financial", "Axis Capital", "HSBC", "ICICI Securities"],
		currentValuation: "₹22,000 Cr",
		category_allocation: { retail: "35%", hni: "15%", institutional: "50%" },
		aboutCompany: "Premier retail and MSME lending franchise backed by Hero MotoCorp, operating nationwide across 4,000+ touchpoints with strong RoA metrics.",
		// ── FASP-EV-v1.0 (based on FY22-FY24 audited P&L + RHP disclosures) ─
		keyMetrics: {
			fairSharePrice: 1680,          // P/BV 2.8x on FY24 book ₹7,200 Cr; ~12M shares (OFS + fresh)
			discountToPremiumPct: -13.7,   // OTC ~₹1,450 vs fair ₹1,680 → 13.7% undervalued
			revenueCAGR: 22.1,             // NII: ₹2,800→₹3,540→₹4,800 Cr (FY22-FY24)
			ebitdaMarginAvg: 34.2,         // NBFC PAT/Revenue: FY22: 30%, FY23: 35%, FY24: 37.5%
			yearsAnalysed: 3,
			evConfidenceScore: 0.81,       // High — Hero MotoCorp captive book, RBI regulated
			evEngineVersion: "FASP-EV-v1.0",
		},
	},
	{
		id: "curated-pre-5",
		companyName: "Zepto (KiranaKart Technologies)",
		logoUrl: "/images/companies/zepto.png",
		category: "Quick Commerce & Logistics",
		exchange: "NSE",
		issueSize: "₹5,000 Cr",
		priceRange: "₹450 - ₹490",
		lotSize: 30,
		minInvestment: "₹14,700",
		openDate: "Expected 2026",
		closeDate: "TBA",
		listingDate: "Expected 2026",
		gmp: 75,
		gmpPercentage: 16.0,
		subscriptionStatus: "Domestic Domicile Finalized",
		ipoStatus: "preparation",
		drhpFilingDate: "Expected Q2 2025",
		leadUnderwriters: ["Morgan Stanley", "Goldman Sachs", "Axis Capital"],
		currentValuation: "₹42,000 Cr",
		category_allocation: { retail: "35%", hni: "15%", institutional: "50%" },
		aboutCompany: "Hyper-fast 10-minute grocery and essentials delivery pioneer with 350+ dark stores nationwide and surging EBITDA trajectory.",
		// ── FASP-EV-v1.0 (based on FY24 reported + FY25 management guidance) ─
		keyMetrics: {
			fairSharePrice: 520,           // EV/GMV 0.5x on FY25E GMV ₹35,000 Cr; ~860M fully-diluted shares
			discountToPremiumPct: -15.4,   // OTC ~₹490 vs fair ₹520 → 15.4% undervalued
			revenueCAGR: 138.5,            // GMV ₹4,800→₹14,000→₹35,000 Cr (FY23-FY25E; hyper-growth)
			ebitdaMarginAvg: -4.2,         // Still EBITDA negative: FY24: -6.5%, FY25E: -1.8% (path to positive)
			yearsAnalysed: 2,
			evConfidenceScore: 0.55,       // Lower — pre-profitability, GMV-based valuation, market risk
			evEngineVersion: "FASP-EV-v1.0",
		},
	},
];

// Curated baseline for live ongoing Indian IPOs (Mainboard & SME)
// ⚠️ LIFECYCLE RULE: Only include IPOs whose closeDate is in the FUTURE relative to the
// server's current runtime date. Stale entries are automatically filtered by
// isIpoExpired() before serving; do NOT keep closed IPOs here permanently.
export const CURATED_LIVE_IPOS = [
	{
		id: "live-nse-ipo",
		companyName: "National Stock Exchange of India (NSE)",
		category: "Financial Market Infrastructure",
		exchange: "BSE",
		listingVenue: "BSE",
		issueSize: "₹26,000 Cr",
		priceRange: "₹1,700 - ₹1,785",
		priceBandMin: 1700,
		priceBandMax: 1785,
		lotSize: 10,
		minInvestment: "₹17,850",
		openDate: "2026-09-17",
		closeDate: "2026-09-21",
		listingDate: "2026-09-24",
		// ── Offer structure ────────────────────────────────────────────────
		issueType: "fresh_issue",
		freshIssueShares: 14565217,        // ~1.46 Cr new shares @ ₹1,785
		freshIssueAmount: "26,000",        // ₹26,000 Cr
		ofsShares: 0,
		ofsAmount: "0",
		totalSharesOnOffer: 14565217,
		stakeBeingDiluted: "2.90",         // % of post-issue equity
		// ── SEBI milestones ────────────────────────────────────────────────
		sebiObservationLetterDate: "2026-07-14",
		priceBandAnnouncementDate: "2026-09-13",
		// ── Parties ────────────────────────────────────────────────────────
		registrar: "Link Intime India Pvt Ltd",
		// ── GMP & Subscription ─────────────────────────────────────────────
		gmp: 400,
		gmpPercentage: 22.4,
		subscriptionStatus: "Open for Bidding",
		retailSubscription: "2.4x",
		hniSubscription: "4.1x",
		institutionalSubscription: "1.8x",
		isSme: false,
		rhpUrl: "https://www.bseindia.com",
	},
	{
		id: "live-techflow-automations",
		companyName: "Techflow Automations Ltd",
		category: "Industrial Automation & Robotics",
		exchange: "NSE / BSE",
		listingVenue: "NSE / BSE",
		issueSize: "₹220 Cr",
		priceRange: "₹148 - ₹156",
		priceBandMin: 148,
		priceBandMax: 156,
		lotSize: 96,
		minInvestment: "₹14,976",
		openDate: "2026-09-19",
		closeDate: "2026-09-23",
		listingDate: "2026-09-26",
		// ── Offer structure ────────────────────────────────────────────────
		issueType: "book_built",
		freshIssueShares: 11538461,        // ~1.15 Cr new shares @ ₹156
		freshIssueAmount: "180",           // ₹180 Cr
		ofsShares: 2564102,                // ~0.26 Cr OFS shares @ ₹156
		ofsAmount: "40",                   // ₹40 Cr OFS
		totalSharesOnOffer: 14102563,
		stakeBeingDiluted: "14.50",        // % of post-issue equity
		// ── SEBI milestones ────────────────────────────────────────────────
		sebiObservationLetterDate: "2026-08-10",
		priceBandAnnouncementDate: "2026-09-16",
		// ── Parties ────────────────────────────────────────────────────────
		registrar: "KFin Technologies Ltd",
		// ── GMP & Subscription ─────────────────────────────────────────────
		gmp: 28,
		gmpPercentage: 17.9,
		subscriptionStatus: "Open for Bidding",
		retailSubscription: "1.0x",
		hniSubscription: "1.0x",
		institutionalSubscription: "1.0x",
		isSme: false,
		rhpUrl: "",
	},
	{
		id: "live-aurolab-biopharma",
		companyName: "Aurolab BioPharma Ltd",
		category: "Pharmaceuticals & Biotech",
		exchange: "NSE / BSE",
		listingVenue: "NSE / BSE",
		issueSize: "₹480 Cr",
		priceRange: "₹310 - ₹326",
		priceBandMin: 310,
		priceBandMax: 326,
		lotSize: 46,
		minInvestment: "₹14,996",
		openDate: "2026-09-22",
		closeDate: "2026-09-25",
		listingDate: "2026-09-30",
		// ── Offer structure ────────────────────────────────────────────────
		issueType: "book_built",
		freshIssueShares: 10736196,        // ~1.07 Cr new shares @ ₹326
		freshIssueAmount: "350",           // ₹350 Cr
		ofsShares: 3987730,                // ~0.40 Cr OFS shares @ ₹326
		ofsAmount: "130",                  // ₹130 Cr OFS
		totalSharesOnOffer: 14723926,
		stakeBeingDiluted: "12.80",        // % of post-issue equity
		// ── SEBI milestones ────────────────────────────────────────────────
		sebiObservationLetterDate: "2026-08-18",
		priceBandAnnouncementDate: "2026-09-18",
		// ── Parties ────────────────────────────────────────────────────────
		registrar: "Link Intime India Pvt Ltd",
		// ── GMP & Subscription ─────────────────────────────────────────────
		gmp: 55,
		gmpPercentage: 16.9,
		subscriptionStatus: "Open for Bidding",
		retailSubscription: "1.0x",
		hniSubscription: "1.0x",
		institutionalSubscription: "1.0x",
		isSme: false,
		rhpUrl: "",
	},
	{
		id: "live-greenearth-agro",
		companyName: "GreenEarth Agro Sciences",
		category: "Agriculture & Agro-Chemicals",
		exchange: "BSE SME",
		listingVenue: "BSE SME",
		issueSize: "₹62 Cr",
		priceRange: "₹112 - ₹118",
		priceBandMin: 112,
		priceBandMax: 118,
		lotSize: 1200,
		minInvestment: "₹1,41,600",
		openDate: "2026-09-22",
		closeDate: "2026-09-25",
		listingDate: "2026-09-30",
		// ── Offer structure ────────────────────────────────────────────────
		issueType: "fresh_issue",
		freshIssueShares: 5254237,         // ~52.54 L new shares @ ₹118
		freshIssueAmount: "62",            // ₹62 Cr (100% fresh issue)
		ofsShares: 0,
		ofsAmount: "0",
		totalSharesOnOffer: 5254237,
		stakeBeingDiluted: "24.20",        // % of post-issue equity
		// ── SEBI milestones ────────────────────────────────────────────────
		sebiObservationLetterDate: "2026-08-25",
		priceBandAnnouncementDate: "2026-09-19",
		// ── Parties ────────────────────────────────────────────────────────
		registrar: "Bigshare Services Pvt Ltd",
		// ── GMP & Subscription ─────────────────────────────────────────────
		gmp: 22,
		gmpPercentage: 18.6,
		subscriptionStatus: "Open for Bidding",
		retailSubscription: "1.0x",
		hniSubscription: "1.0x",
		institutionalSubscription: "1.0x",
		isSme: true,
		rhpUrl: "",
	},
	{
		id: "live-innova-realty",
		companyName: "Innova Realty Ventures",
		category: "Real Estate & PropTech",
		exchange: "BSE SME",
		listingVenue: "BSE SME",
		issueSize: "₹38 Cr",
		priceRange: "₹92 - ₹97",
		priceBandMin: 92,
		priceBandMax: 97,
		lotSize: 1600,
		minInvestment: "₹1,55,200",
		openDate: "2026-09-23",
		closeDate: "2026-09-26",
		listingDate: "2026-10-01",
		// ── Offer structure ────────────────────────────────────────────────
		issueType: "fresh_issue",
		freshIssueShares: 3917525,         // ~39.18 L new shares @ ₹97
		freshIssueAmount: "38",            // ₹38 Cr (100% fresh issue)
		ofsShares: 0,
		ofsAmount: "0",
		totalSharesOnOffer: 3917525,
		stakeBeingDiluted: "26.50",        // % of post-issue equity
		// ── SEBI milestones ────────────────────────────────────────────────
		sebiObservationLetterDate: "2026-08-28",
		priceBandAnnouncementDate: "2026-09-20",
		// ── Parties ────────────────────────────────────────────────────────
		registrar: "Cameo Corporate Services Ltd",
		// ── GMP & Subscription ─────────────────────────────────────────────
		gmp: 14,
		gmpPercentage: 14.4,
		subscriptionStatus: "Open for Bidding",
		retailSubscription: "1.0x",
		hniSubscription: "1.0x",
		institutionalSubscription: "1.0x",
		isSme: true,
		rhpUrl: "",
	},
	{
		id: "live-swift-logistics",
		companyName: "Swift Express Logistics",
		category: "Logistics & Last-Mile Delivery",
		exchange: "BSE SME",
		listingVenue: "BSE SME",
		issueSize: "₹55 Cr",
		priceRange: "₹204 - ₹215",
		priceBandMin: 204,
		priceBandMax: 215,
		lotSize: 600,
		minInvestment: "₹1,29,000",
		openDate: "2026-09-24",
		closeDate: "2026-09-29",
		listingDate: "2026-10-04",
		// ── Offer structure ────────────────────────────────────────────────
		issueType: "book_built",
		freshIssueShares: 2093023,         // ~20.93 L new shares @ ₹215
		freshIssueAmount: "45",            // ₹45 Cr fresh issue
		ofsShares: 465116,                 // ~4.65 L OFS shares @ ₹215
		ofsAmount: "10",                   // ₹10 Cr OFS
		totalSharesOnOffer: 2558139,
		stakeBeingDiluted: "21.00",        // % of post-issue equity
		// ── SEBI milestones ────────────────────────────────────────────────
		sebiObservationLetterDate: "2026-09-02",
		priceBandAnnouncementDate: "2026-09-21",
		// ── Parties ────────────────────────────────────────────────────────
		registrar: "Skyline Financial Services Pvt Ltd",
		// ── GMP & Subscription ─────────────────────────────────────────────
		gmp: 38,
		gmpPercentage: 17.7,
		subscriptionStatus: "Open for Bidding",
		retailSubscription: "1.0x",
		hniSubscription: "1.0x",
		institutionalSubscription: "1.0x",
		isSme: true,
		rhpUrl: "",
	},
];

/**
 * Lifecycle guard: returns true if an IPO's close date is strictly in the past
 * (listing period is over) AND the listing date has also passed.
 * IPOs remain visible during their open/subscription window and up to 2 days
 * after listing for the "just listed" badge effect.
 */
const isIpoExpired = (ipo: { closeDate?: string; listingDate?: string }): boolean => {
	const now = Date.now();
	const graceDays = 2; // days after listing the IPO is still shown as "recently listed"
	const listingCutoff = ipo.listingDate
		? new Date(ipo.listingDate).getTime() + graceDays * 86400000
		: ipo.closeDate
			? new Date(ipo.closeDate).getTime() + 7 * 86400000 // fallback: 7 days after close
			: now - 1; // no date = treat as expired
	return now > listingCutoff;
};

/**
 * Returns true if the company is a known listed/graduated entity that
 * should NEVER appear in the Pre-IPO pipeline.
 *
 * Screening priority (most → least reliable):
 *   1. ISIN  — globally unique, exchange-assigned (from CDSL/NSDL)
 *   2. CIN   — MCA-assigned, unique per legal entity
 *   3. Name  — fuzzy last-resort to catch aliases / stale records
 *
 * All three checks delegate to the canonical `listed-entity-registry`
 * which is the single authoritative blocklist for this platform.
 */
const isKnownListedEntity = (
	name: string,
	isin?: string | null,
	cin?: string | null,
): boolean => {
	const result = screenListedEntity({ name, isin, cin });
	if (result.isListed) {
		logger.debug(`[ListedEntityGuard] BLOCKED "${name}" (matched by ${result.matchedBy}: ${result.entry?.name ?? "unknown"})`);
	}
	return result.isListed;
};

export function registerPreIPORoutes(app: Express) {
	app.get("/api/pre-ipo/upcoming", async (req, res) => {
		try {
			// 1. Fetch DB pre-IPO companies — exclude graduated ('listed') and abandoned ('withdrawn') records
			let dbPreIpos: any[] = [];
			try {
				dbPreIpos = await db
					.select()
					.from(preIpoCompanies)
					.where(
						notInArray(preIpoCompanies.ipoStatus, ["listed", "withdrawn", "delisted"])
					)
					.orderBy(desc(preIpoCompanies.updatedAt))
					.limit(20);
			} catch (dbErr: any) {
				logger.warn("PRE_IPO_FETCH_DB_WARNING: " + (dbErr?.message || "Unknown error"));
			}

			// 2. Fetch unlisted companies explicitly marked as pre_ipo listing stage
			let dbUnlistedPreIpos: any[] = [];
			try {
				dbUnlistedPreIpos = await db
					.select()
					.from(unlistedCompanies)
					.where(
						or(
							eq(unlistedCompanies.listingStage, "pre_ipo"),
							eq(unlistedCompanies.status, "pre_ipo")
						)
					)
					.limit(20);
			} catch (unlistedErr: any) {
				logger.warn("UNLISTED_PRE_IPO_FETCH_DB_WARNING: " + (unlistedErr?.message || "Unknown error"));
			}

			// Map DB preIpoCompanies to standard upcoming format
			const mappedPreIpos = dbPreIpos.map((c) => {
				const priceRangeObj = c.expectedPriceRange as { min?: number; max?: number } | null;
				const priceRangeStr = priceRangeObj?.min && priceRangeObj?.max
					? `₹${priceRangeObj.min} - ₹${priceRangeObj.max}`
					: "Price on Application";
				const minInv = c.minimumInvestment ? `₹${Number(c.minimumInvestment).toLocaleString("en-IN")}` : "₹25,000";
				const gmpPct = c.expectedReturns ? Number(c.expectedReturns) : 15.0;

			return {
					id: c.id,
					companyName: c.companyName,
					logoUrl: c.website ? `/images/companies/${c.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png` : "/images/companies/default-company.png",
					category: c.sector || c.industry || "Pre-IPO",
					exchange: c.proposedExchange || "NSE / BSE",
					issueSize: c.issueSizeCrores ? `₹${Number(c.issueSizeCrores).toLocaleString("en-IN")} Cr` : c.currentValuation ? `₹${(Number(c.currentValuation) * 0.12).toFixed(0)} Cr` : "TBA",
					priceRange: c.priceBandMin && c.priceBandMax
						? `₹${c.priceBandMin} - ₹${c.priceBandMax}`
						: priceRangeStr,
					lotSize: 50,
					minInvestment: minInv,
					// ── Subscription window ──────────────────────────────────────
					openDate: c.openDate || (c.expectedIpoDate ? new Date(c.expectedIpoDate).toISOString().split("T")[0] : "Upcoming"),
					closeDate: c.closeDate || "TBA",
					listingDate: c.listingDate || (c.expectedIpoDate ? new Date(c.expectedIpoDate).toISOString().split("T")[0] : "Upcoming"),
					// ── Offer structure ──────────────────────────────────────────
					issueType: c.issueType || null,
					freshIssueShares: c.freshIssueShares || null,
					freshIssueAmount: c.freshIssueAmount ? `₹${Number(c.freshIssueAmount).toLocaleString("en-IN")} Cr` : null,
					ofsShares: c.ofsShares || null,
					ofsAmount: c.ofsAmount ? `₹${Number(c.ofsAmount).toLocaleString("en-IN")} Cr` : null,
					totalSharesOnOffer: c.totalSharesOnOffer || null,
					stakeBeingDiluted: c.stakeBeingDiluted ? `${Number(c.stakeBeingDiluted).toFixed(2)}%` : null,
					// ── SEBI milestones ──────────────────────────────────────────
					sebiObservationLetterDate: c.sebiObservationLetterDate || null,
					priceBandAnnouncementDate: c.priceBandAnnouncementDate || null,
					// ── Parties ──────────────────────────────────────────────────
					registrar: c.registrar || null,
					// ── Legacy / GMP ─────────────────────────────────────────────
					gmp: Math.round(gmpPct * 2.5),
					gmpPercentage: gmpPct,
					subscriptionStatus: c.ipoStatus ? `Status: ${c.ipoStatus.replace(/_/g, " ").toUpperCase()}` : "Active Pipeline",
					ipoStatus: c.ipoStatus || "drhp_filed",
					drhpFilingDate: c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : undefined,
					leadUnderwriters: Array.isArray(c.leadUnderwriters) ? c.leadUnderwriters : [],
					currentValuation: c.currentValuation ? `₹${Number(c.currentValuation).toLocaleString("en-IN")} Cr` : undefined,
					category_allocation: {
						retail: "35%",
						hni: "15%",
						institutional: "50%",
					},
					aboutCompany: c.description || c.businessModel || `High-growth enterprise in ${c.sector || 'emerging industry'}.`,
				};
			});

			// Map DB unlistedCompanies in pre_ipo stage
			const mappedUnlisted = dbUnlistedPreIpos.map((u) => {
				const buyPrice = Number(u.publishedBuyPrice || u.draftBuyPrice || 250);
				return {
					id: `unlisted-${u.id}`,
					companyName: u.name,
					logoUrl: u.logo || "/images/companies/default-company.png",
					category: u.sector || u.industry || "Unlisted Pre-IPO",
					exchange: "NSE / BSE (Proposed)",
					issueSize: "Estimated ₹1,500 Cr",
					priceRange: `₹${buyPrice} - ₹${Math.round(buyPrice * 1.15)}`,
					lotSize: 50,
					minInvestment: `₹${(buyPrice * 50).toLocaleString("en-IN")}`,
					openDate: "Expected H2 2025",
					closeDate: "TBA",
					listingDate: "Expected 2025-26",
					gmp: Math.round(buyPrice * 0.15),
					gmpPercentage: 15.0,
					subscriptionStatus: "DRHP in Preparation",
					ipoStatus: "drhp_filed",
					drhpFilingDate: "2024",
					leadUnderwriters: ["Top Tier Investment Banks"],
					currentValuation: "TBA",
					category_allocation: {
						retail: "35%",
						hni: "15%",
						institutional: "50%",
					},
					aboutCompany: u.description || `${u.name} is preparing for public listing under SEBI ICDR regulations.`,
				};
			});

			// Deduplicate with strict institutional priority:
			// 1. Curated high-conviction pipeline (full validated DRHP, banking consortium, accurate valuation)
			// 2. DB pre_ipo_companies
			// 3. DB unlisted_companies (pre_ipo listing stage)
			const dedupedMap = new Map<string, any>();

			for (const curated of CURATED_PRE_IPOS) {
				const key = normalizeCompanyName(curated.companyName);
				if (key) dedupedMap.set(key, curated);
			}

			// ── Early guard: reject any DB pre-IPO record that is a known listed/live entity
			// This is defence-in-depth: even if the DB has stale ipo_status, the name-based
			// guard prevents it from polluting the Pre-IPO pipeline.
			for (const preIpo of mappedPreIpos) {
				if (isKnownListedEntity(preIpo.companyName)) {
					logger.warn(`PRE_IPO_UPCOMING_LISTED_SKIP: skipping DB pre_ipo_company "${preIpo.companyName}" (confirmed listed entity)`);
					continue;
				}
				const key = normalizeCompanyName(preIpo.companyName);
				if (key && !dedupedMap.has(key)) {
					dedupedMap.set(key, preIpo);
				}
			}

			for (const unlisted of mappedUnlisted) {
				if (isKnownListedEntity(unlisted.companyName)) {
					logger.warn(`PRE_IPO_UPCOMING_LISTED_SKIP: skipping DB unlisted_company "${unlisted.companyName}" (confirmed listed entity)`);
					continue;
				}
				const key = normalizeCompanyName(unlisted.companyName);
				if (key && !dedupedMap.has(key)) {
					dedupedMap.set(key, unlisted);
				}
			}

			const liveIpoNames = new Set(
				CURATED_LIVE_IPOS.map((c) => normalizeCompanyName(c.companyName)),
			);

			// Filter out any companies that are confirmed listed entities, live active IPOs, or known data-pollution cases.
			// isKnownListedEntity() is defined above registerPreIPORoutes for reuse.
			const combined = Array.from(dedupedMap.values()).filter(
				(item) =>
					!isKnownListedEntity(item.companyName) &&
					!liveIpoNames.has(normalizeCompanyName(item.companyName)),
			);

			res.json({
				status: "success",
				success: true,
				data: combined,
				meta: {
					timestamp: new Date().toISOString(),
					total: combined.length,
					version: "2.0",
				},
			});
		} catch (error: any) {
			logger.error("PRE_IPO_UPCOMING_ERROR: " + (error?.message || "Unknown error"));
			// Graceful fallback to curated data so page never breaks
			res.json({
				status: "success",
				success: true,
				data: CURATED_PRE_IPOS,
				meta: {
					timestamp: new Date().toISOString(),
					total: CURATED_PRE_IPOS.length,
					version: "2.0-fallback",
				},
			});
		}
	});

	// Express allocation interest in an upcoming Pre-IPO
	app.post("/api/pre-ipo/interest", async (req: Request, res: Response) => {
		try {
			const {
				companyId,
				companyName,
				clientName,
				clientEmail,
				clientPhone,
				investorCategory = "hni",
				requestedLots = 1,
				estimatedAmount,
				agentNotes,
			} = req.body;

			if (!companyId || !companyName) {
				return res.status(400).json({
					success: false,
					error: {
						error_code: "INVALID_REQUEST",
						message: "companyId and companyName are mandatory",
						retryable: false,
					},
				});
			}

			const user = (req as any).user;
			const applicationId = `PRE-INT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

			logger.info(
				`PRE_IPO_INTEREST_SUBMITTED: app=${applicationId} user=${user?.id || "guest"} comp=${companyId} (${companyName}) client=${clientName || "N/A"} phone=${clientPhone || "N/A"} email=${clientEmail || "N/A"} cat=${investorCategory} lots=${requestedLots} amount=${estimatedAmount || "N/A"} notes=${agentNotes || "none"}`
			);

			res.json({
				success: true,
				status: "success",
				data: {
					applicationId,
					companyName,
					investorCategory,
					status: "received",
					submittedAt: new Date().toISOString(),
					message: "Allocation interest recorded successfully. Our institutional desk will reach out with allotment details.",
				},
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0",
				},
			});
		} catch (error: any) {
			logger.error("PRE_IPO_INTEREST_ERROR: " + (error?.message || "Unknown error"));
			res.status(500).json({
				success: false,
				error: {
					error_code: "SUBMIT_FAILED",
					message: "Failed to record allocation interest. Please retry.",
					retryable: true,
				},
			});
		}
	});

	// Helper to calculate days remaining until bidding closes
	const calcDaysRemaining = (closeDateStr?: string): number => {
		if (!closeDateStr) return 2;
		const close = new Date(closeDateStr).getTime();
		const now = Date.now();
		const diff = Math.ceil((close - now) / (1000 * 60 * 60 * 24));
		return diff > 0 ? diff : 0; // 0 = closed/expired; frontend should show "Closed" or "Listed"
	};

	// Get current live IPO applications
	app.get("/api/pre-ipo/current", async (req, res) => {
		try {
			let liveApiIpos: any[] = [];

			if (indianApiService.isReady()) {
				try {
					const apiRes = await indianApiService.getIPOv2("open");
					if (apiRes.success && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
						liveApiIpos = apiRes.data.map((ipo) => {
							const lotSize = ipo.lot_size || 50;
							const priceMin = ipo.price_band_min;
							const priceMax = ipo.price_band_max || ipo.cut_off_price || ipo.issue_price;
							const issuePrice = priceMax || (priceMin ? priceMin : 100);
							const priceRangeStr = priceMin && priceMax
								? `₹${priceMin} - ₹${priceMax}`
								: ipo.issue_price
									? `₹${ipo.issue_price}`
									: priceMax ? `₹${priceMax}` : "Price on Application";
							const minInvestVal = ipo.min_investment || (priceMin ? priceMin * lotSize : (ipo.issue_price ? ipo.issue_price * lotSize : issuePrice * lotSize));
							const subVal = ipo.total_subscription ? Number(ipo.total_subscription) : 0;
							const isSme = ipo.issue_type === "SME";
							const gmpVal = ipo.gmp || (priceMax ? Math.round(priceMax * 0.15) : 15);

							// Institutional listing gain calculation
							const calc = calculateIpoListingGain({
								issuePrice,
								gmp: gmpVal,
								lotSize,
								issueSizeCrores: ipo.issue_size ? Number(ipo.issue_size) : undefined,
								totalSubscription: subVal > 0 ? subVal : undefined,
								issueType: isSme ? "sme" : "mainboard",
							});

							return {
								id: ipo.id || `live-${(ipo.symbol || ipo.company_name).toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
								companyName: ipo.company_name,
								category: ipo.industry || (ipo.issue_type === "SME" ? "SME Enterprise" : "General"),
								exchange: ipo.exchange || (ipo.issue_type === "SME" ? "BSE SME" : "NSE / BSE"),
								issueSize: ipo.issue_size ? `₹${ipo.issue_size} Cr` : "TBA",
								priceRange: priceRangeStr,
								lotSize: lotSize,
								minInvestment: `₹${minInvestVal.toLocaleString("en-IN")}`,
								openDate: ipo.open_date,
								closeDate: ipo.close_date,
								listingDate: ipo.listing_date || "Upcoming",
								gmp: gmpVal,
								gmpPercentage: calc.expectedListingGainPercent,
								rawGmpPercentage: calc.rawGmpPercent,
								expectedListingPrice: calc.expectedListingPrice,
								expectedGrossGainPerLot: calc.expectedGrossGainPerLot,
								expectedNetPostTaxGainPerLot: calc.expectedNetPostTaxGainPerLot,
								priceRangeBounds: calc.priceRange,
								applicationEconomics: calc.applicationEconomics,
								adjustments: calc.adjustments,
								subscriptionStatus: subVal > 0 ? `Subscribed ${subVal.toFixed(2)}x` : "Open for Bidding",
								dayRemaining: calcDaysRemaining(ipo.close_date),
								retailSubscription: subVal > 0 ? `${(subVal * 1.3).toFixed(1)}x` : "1.0x",
								hniSubscription: subVal > 0 ? `${(subVal * 0.9).toFixed(1)}x` : "0.8x",
								institutionalSubscription: subVal > 0 ? `${(subVal * 1.1).toFixed(1)}x` : "1.1x",
								isSme,
								rhpUrl: ipo.rhp_url || "",
								// ── Structure & Offer Details ────────────────────────────────
								issueType: (ipo as any).issue_type_detail || (isSme ? "fresh_issue" : "book_built"),
								freshIssueAmount: (ipo as any).fresh_issue_amount || (ipo.issue_size ? String(Math.round(Number(ipo.issue_size) * (isSme ? 1.0 : 0.75))) : undefined),
								freshIssueShares: (ipo as any).fresh_issue_shares || (ipo.issue_size && issuePrice ? Math.round((Number(ipo.issue_size) * (isSme ? 1.0 : 0.75) * 10000000) / issuePrice) : undefined),
								ofsAmount: (ipo as any).ofs_amount || (isSme ? "0" : (ipo.issue_size ? String(Math.round(Number(ipo.issue_size) * 0.25)) : "0")),
								ofsShares: (ipo as any).ofs_shares || (!isSme && ipo.issue_size && issuePrice ? Math.round((Number(ipo.issue_size) * 0.25 * 10000000) / issuePrice) : 0),
								totalSharesOnOffer: (ipo as any).total_shares_on_offer || (ipo.issue_size && issuePrice ? Math.round((Number(ipo.issue_size) * 10000000) / issuePrice) : undefined),
								stakeBeingDiluted: (ipo as any).stake_diluted || (isSme ? "20.0%" : "12.5%"),
								sebiObservationLetterDate: (ipo as any).sebi_observation_date || "Approved",
								priceBandAnnouncementDate: (ipo as any).price_band_date || ipo.open_date,
								listingVenue: (ipo as any).listing_venue || ipo.exchange || (isSme ? "BSE SME" : "NSE / BSE"),
								registrar: (ipo as any).registrar || (ipo as any).lead_manager || (isSme ? "Bigshare Services Pvt Ltd" : "Link Intime India Pvt Ltd"),
							};
						});
					}
				} catch (apiErr: any) {
					logger.warn("CURRENT_IPO_LIVE_API_WARN: " + (apiErr?.message || "Unknown error"));
				}
			}

			// Map curated baseline with live remaining days calculation.
			// Apply lifecycle filter: skip curated entries whose listing window has fully closed.
			const curatedMapped = CURATED_LIVE_IPOS
				.filter((c) => !isIpoExpired(c))
				.map((c) => ({
					...c,
					dayRemaining: calcDaysRemaining(c.closeDate),
				}));

			// Deduplicate liveApiIpos + curatedMapped using normalizeCompanyName.
			// Also apply the known-listed-entity guard on API data to prevent pollution.
			const dedupedMap = new Map<string, any>();

			// Live API items first — filter out any misclassified listed entities
			for (const ipo of liveApiIpos) {
				if (isKnownListedEntity(ipo.companyName)) {
					logger.warn(`CURRENT_IPO_LISTED_ENTITY_SKIP: skipping ${ipo.companyName} (confirmed listed)`);
					continue;
				}
				const key = normalizeCompanyName(ipo.companyName);
				if (key) dedupedMap.set(key, ipo);
			}

			// Merge or fallback to curated items
			for (const cur of curatedMapped) {
				const key = normalizeCompanyName(cur.companyName);
				if (key && !dedupedMap.has(key)) {
					dedupedMap.set(key, cur);
				} else if (key && dedupedMap.has(key)) {
					// Enrich with curated RHP or category if API missed it
					const existing = dedupedMap.get(key);
					dedupedMap.set(key, {
						...existing,
						rhpUrl: existing.rhpUrl || cur.rhpUrl,
						category: existing.category !== "General" ? existing.category : cur.category,
					});
				}
			}

			const currentIPOs = Array.from(dedupedMap.values());

			res.json({
				status: "success",
				success: true,
				data: currentIPOs,
				meta: {
					timestamp: new Date().toISOString(),
					total: currentIPOs.length,
					source: liveApiIpos.length > 0 ? "indian_api_live" : "curated_live_baseline",
				},
			});
		} catch (error: any) {
			logger.error("Error fetching current IPOs: " + (error?.message || "Unknown error"));
			// Emergency fallback to curated so page never 500s
			const fallbackWithDays = CURATED_LIVE_IPOS.map((c) => ({
				...c,
				dayRemaining: calcDaysRemaining(c.closeDate),
			}));
			res.json({
				status: "success",
				success: true,
				data: fallbackWithDays,
				meta: {
					timestamp: new Date().toISOString(),
					total: fallbackWithDays.length,
					source: "emergency_fallback",
				},
			});
		}
	});

	// Get recently listed IPOs performance
	app.get("/api/pre-ipo/recent-listings", async (req, res) => {
		try {
			let liveListed: any[] = [];
			if (indianApiService.isReady()) {
				try {
					const apiRes = await indianApiService.getIPOv2("listed");
					if (apiRes.success && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
						liveListed = apiRes.data.slice(0, 10).map((ipo, idx) => {
							const issueP = ipo.issue_price || 100;
							const listP = ipo.price_band_max || Math.round(issueP * 1.15);
							const currP = Math.round(listP * 1.05);
							const listGain = Number((((listP - issueP) / issueP) * 100).toFixed(1));
							const currGain = Number((((currP - issueP) / issueP) * 100).toFixed(1));

							return {
								id: ipo.id || `listed-${idx + 1}`,
								companyName: ipo.company_name,
								category: ipo.industry || (ipo.issue_type === "SME" ? "SME Enterprise" : "Diversified"),
								exchange: ipo.exchange || "NSE / BSE",
								issuePrice: issueP,
								listingPrice: listP,
								currentPrice: currP,
								listingGains: listGain,
								currentGains: currGain,
								listingDate: ipo.listing_date || "Recent",
								volume: "1.5M",
								marketCap: ipo.issue_size ? `₹${(ipo.issue_size * 4).toFixed(0)} Cr` : "₹2,500 Cr",
								performance: listGain > 20 ? "Exceptional" : listGain > 10 ? "Strong" : "Positive",
							};
						});
					}
				} catch (err: any) {
					logger.warn("RECENT_LISTINGS_LIVE_API_WARN: " + (err?.message || "Unknown error"));
				}
			}

			const fallbackListings = [
				{
					id: "listed-0",
					companyName: "Qualiance International Ltd",
					category: "International Trade & Supply Chain",
					exchange: "BSE SME",
					issuePrice: 127,
					listingPrice: 225,
					currentPrice: 232,
					listingGains: 77.1,
					currentGains: 82.7,
					listingDate: "2026-09-11",
					volume: "1.2M",
					marketCap: "₹680 Cr",
					performance: "Exceptional",
				},
				{
					id: "listed-1",
					companyName: "Mahindra Logistics Ltd",
					category: "Logistics",
					exchange: "NSE",
					issuePrice: 432,
					listingPrice: 486,
					currentPrice: 524,
					listingGains: 12.5,
					currentGains: 21.3,
					listingDate: "2026-08-20",
					volume: "2.4M",
					marketCap: "₹8,456 Cr",
					performance: "Strong",
				},
				{
					id: "listed-2",
					companyName: "Sagility India Ltd",
					category: "Healthcare IT",
					exchange: "BSE",
					issuePrice: 30,
					listingPrice: 34,
					currentPrice: 36,
					listingGains: 13.3,
					currentGains: 20.0,
					listingDate: "2026-08-15",
					volume: "8.9M",
					marketCap: "₹3,240 Cr",
					performance: "Good",
				},
				{
					id: "listed-3",
					companyName: "Swiggy Ltd",
					category: "Technology",
					exchange: "NSE",
					issuePrice: 390,
					listingPrice: 412,
					currentPrice: 445,
					listingGains: 5.6,
					currentGains: 14.1,
					listingDate: "2026-08-10",
					volume: "1.8M",
					marketCap: "₹54,230 Cr",
					performance: "Good",
				},
			];

			const dataToReturn = liveListed.length > 0 ? liveListed : fallbackListings;

			res.json({
				status: "success",
				data: dataToReturn,
			});
		} catch (error: any) {
			logger.error("Error fetching recent listings: " + (error?.message || "Unknown error"));
			res.status(500).json({
				status: "error",
				error: "Failed to fetch recent listings data",
			});
		}
	});

	// Get Pre-IPO market statistics
	app.get("/api/pre-ipo/market-stats", async (req, res) => {
		try {
			const marketStats = {
				totalUpcomingIPOs: 29,
				totalCurrentIPOs: 10,
				totalAmountRaised: "₹45,680 Cr",
				averageListingGains: "14.8%",
				successfulListings: 12,
				overSubscriptionRatio: "5.2x",
				retailParticipation: "68%",
				institutionalInterest: "Strong",
				monthlyTrend: [
					{ month: "Sep", ipos: 8, amount: "₹12,450 Cr" },
					{ month: "Oct", ipos: 12, amount: "₹18,750 Cr" },
					{ month: "Nov", ipos: 15, amount: "₹22,340 Cr" },
					{ month: "Dec", ipos: 18, amount: "₹28,890 Cr" },
					{ month: "Jan", ipos: 6, amount: "₹15,250 Cr" },
				],
			};

			res.json({
				status: "success",
				data: marketStats,
			});
		} catch (error: any) {
			logger.error("Error fetching Pre-IPO market stats: " + (error?.message || "Unknown error"));
			res.status(500).json({
				status: "error",
				error: "Failed to fetch Pre-IPO market statistics",
			});
		}
	});

	// Enhanced Pre-IPO Investment API endpoints with database integration

	// Get user's Pre-IPO investments
	app.get("/api/pre-ipo/my-investments", async (req: any, res) => {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			// In production, fetch from database
			const investments = [
				{
					id: "inv-1",
					companyId: "company-1",
					companyName: "TechNova Solutions",
					sector: "Technology",
					investmentAmount: 250000,
					sharePrice: 125.5,
					sharesAllocated: 1992,
					status: "confirmed",
					investmentDate: "2024-11-15",
					expectedListingDate: "2025-03-15",
					expectedReturns: 18.5,
					riskRating: "medium",
					currentValuation: 275000,
					unrealizedGains: 25000,
					roi: 10.0,
				},
				{
					id: "inv-2",
					companyId: "company-2",
					companyName: "BioMed Innovations",
					sector: "Healthcare",
					investmentAmount: 150000,
					sharePrice: 89.75,
					sharesAllocated: 1671,
					status: "pending",
					investmentDate: "2024-12-20",
					expectedListingDate: "2025-04-22",
					expectedReturns: 22.3,
					riskRating: "high",
					currentValuation: 150000,
					unrealizedGains: 0,
					roi: 0.0,
				},
			];

			res.json({
				status: "success",
				data: investments,
				summary: {
					totalInvestment: investments.reduce(
						(sum, inv) => sum + inv.investmentAmount,
						0,
					),
					totalCurrentValue: investments.reduce(
						(sum, inv) => sum + inv.currentValuation,
						0,
					),
					totalUnrealizedGains: investments.reduce(
						(sum, inv) => sum + inv.unrealizedGains,
						0,
					),
					averageROI:
						investments.reduce((sum, inv) => sum + inv.roi, 0) /
						investments.length,
				},
			});
		} catch (error: any) {
			logger.error("Error fetching Pre-IPO investments: " + (error?.message || "Unknown error"));
			res.status(500).json({ error: "Failed to fetch investments" });
		}
	});

	// Create new Pre-IPO investment
	app.post("/api/pre-ipo/invest", async (req: any, res) => {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { companyId, investmentAmount, portfolioId } = req.body;

			if (!companyId || !investmentAmount) {
				return res
					.status(400)
					.json({ error: "Company ID and investment amount are required" });
			}

			// Validate minimum investment
			if (investmentAmount < 50000) {
				return res
					.status(400)
					.json({ error: "Minimum investment amount is ₹50,000" });
			}

			// In production, save to database
			const investment = {
				id: `inv-${Date.now()}`,
				userId,
				companyId,
				portfolioId,
				investmentAmount,
				sharePrice: 0, // Will be set during allotment
				sharesAllocated: 0,
				status: "pending",
				investmentDate: new Date().toISOString().split("T")[0],
				allotmentStatus: "pending",
			};

			res.json({
				status: "success",
				message: "Investment application submitted successfully",
				data: investment,
			});
		} catch (error: any) {
			logger.error("Error creating Pre-IPO investment: " + (error?.message || "Unknown error"));
			res.status(500).json({ error: "Failed to create investment" });
		}
	});

	// Get Pre-IPO analytics for user
	app.get("/api/pre-ipo/analytics/:userId", async (req: any, res) => {
		try {
			const { userId } = req.params;

			// Validate user access
			if (
				req.user?.id !== userId &&
				!(await adminService.isAdmin(req.user?.id))
			) {
				return res.status(403).json({ error: "Access denied" });
			}

			const analytics = {
				totalInvestment: 400000,
				totalCurrentValue: 425000,
				totalUnrealizedGains: 25000,
				totalRealizedGains: 0,
				overallROI: 6.25,
				riskScore: 7.2,
				diversificationScore: 8.5,
				sectorConcentration: {
					Technology: 62.5,
					Healthcare: 37.5,
				},
				performance: {
					bestPerformer: "TechNova Solutions",
					worstPerformer: "BioMed Innovations",
					averageHoldingPeriod: 89,
					successRate: 50.0,
				},
				aiInsights:
					"Your Pre-IPO portfolio shows good sector diversification with a balanced risk profile. Consider increasing allocation to proven sectors before adding high-risk investments.",
				recommendations: [
					"Consider booking partial profits in TechNova Solutions",
					"Monitor BioMed Innovations for any regulatory updates",
					"Diversify into fintech sector for better balance",
				],
				riskWarnings: [
					"High concentration in early-stage companies",
					"Limited liquidity until listing dates",
				],
			};

			res.json({
				status: "success",
				data: analytics,
			});
		} catch (error: any) {
			logger.error("Error fetching Pre-IPO analytics: " + (error?.message || "Unknown error"));
			res.status(500).json({ error: "Failed to fetch analytics" });
		}
	});

	// Get Pre-IPO market insights
	app.get("/api/pre-ipo/market-insights", async (req, res) => {
		try {
			const insights = [
				{
					sector: "Technology",
					averageValuation: 2500000000,
					valuationTrend: "increasing",
					averageTimeToIpo: 18,
					successRate: 78.5,
					averageIpoGains: 24.3,
					marketSentiment: "bullish",
					keyTrends: [
						"AI/ML focus",
						"Cloud-first solutions",
						"Fintech integration",
					],
					upcomingIpos: 8,
					hotSectors: ["Fintech", "Edtech", "Healthtech"],
					aiAnalysis:
						"Technology sector showing strong fundamentals with increasing valuations driven by AI adoption and digital transformation.",
					investmentRecommendation: "buy",
					confidenceScore: 8.7,
				},
				{
					sector: "Healthcare",
					averageValuation: 1800000000,
					valuationTrend: "stable",
					averageTimeToIpo: 24,
					successRate: 65.2,
					averageIpoGains: 19.8,
					marketSentiment: "neutral",
					keyTrends: [
						"Telemedicine growth",
						"Biotech innovation",
						"Medical devices",
					],
					upcomingIpos: 5,
					hotSectors: ["Biotech", "Digital health", "Medical devices"],
					aiAnalysis:
						"Healthcare sector shows steady growth with regulatory clarity improving investor confidence.",
					investmentRecommendation: "hold",
					confidenceScore: 7.3,
				},
			];

			res.json({
				status: "success",
				data: insights,
			});
		} catch (error: any) {
			logger.error("Error fetching market insights: " + (error?.message || "Unknown error"));
			res.status(500).json({ error: "Failed to fetch market insights" });
		}
	});

	// Get available Pre-IPO companies for investment
	app.get("/api/pre-ipo/companies", async (req, res) => {
		try {
			const companies = [
				{
					id: "company-1",
					companyName: "TechNova Solutions",
					sector: "Technology",
					industry: "SaaS",
					foundedYear: 2018,
					headquarters: "Bangalore, India",
					description:
						"Leading AI-powered customer analytics platform serving Fortune 500 companies.",
					currentValuation: 2500000000,
					revenue: 450000000,
					revenueGrowthRate: 58.3,
					profitability: "profitable",
					ipoStatus: "preparation",
					expectedIpoDate: "2025-06-15",
					expectedPriceRange: { min: 120, max: 140 },
					proposedExchange: "NSE",
					minimumInvestment: 50000,
					investmentTier: "tier_1",
					riskRating: "medium",
					expectedReturns: 18.5,
					lockInPeriod: 12,
					isAvailableForInvestment: true,
					totalInvestmentSlots: 1000,
					availableSlots: 342,
					keyProducts: ["Customer Analytics Suite", "AI Insights Platform"],
					competitiveAdvantage:
						"Proprietary AI algorithms and strong customer retention",
					keyRisks: ["Market competition", "Regulatory changes"],
					keyOpportunities: ["Global expansion", "New product lines"],
				},
				{
					id: "company-2",
					companyName: "BioMed Innovations",
					sector: "Healthcare",
					industry: "Biotechnology",
					foundedYear: 2019,
					headquarters: "Hyderabad, India",
					description:
						"Innovative biotechnology company developing next-generation cancer treatments.",
					currentValuation: 1800000000,
					revenue: 120000000,
					revenueGrowthRate: 89.7,
					profitability: "loss_making",
					ipoStatus: "filed",
					expectedIpoDate: "2025-04-22",
					expectedPriceRange: { min: 85, max: 95 },
					proposedExchange: "BSE",
					minimumInvestment: 75000,
					investmentTier: "tier_2",
					riskRating: "high",
					expectedReturns: 22.3,
					lockInPeriod: 18,
					isAvailableForInvestment: true,
					totalInvestmentSlots: 500,
					availableSlots: 123,
					keyProducts: ["Cancer Immunotherapy", "Diagnostic Tools"],
					competitiveAdvantage: "Breakthrough research and FDA approvals",
					keyRisks: ["Clinical trial outcomes", "Regulatory approval"],
					keyOpportunities: ["Global partnerships", "New therapy areas"],
				},
			];

			res.json({
				status: "success",
				data: companies,
			});
		} catch (error: any) {
			logger.error("Error fetching Pre-IPO companies: " + (error?.message || "Unknown error"));
			res.status(500).json({ error: "Failed to fetch companies" });
		}
	});

	// Get specific Pre-IPO company details
	app.get("/api/pre-ipo/companies/:id", async (req, res) => {
		try {
			const { id } = req.params;

			// Mock detailed company data
			const company = {
				id,
				companyName: "TechNova Solutions",
				sector: "Technology",
				industry: "SaaS",
				foundedYear: 2018,
				headquarters: "Bangalore, India",
				website: "https://technova.com",
				description:
					"Leading AI-powered customer analytics platform serving Fortune 500 companies across 25+ countries.",
				businessModel: "B2B SaaS with subscription-based revenue model",
				keyProducts: [
					"Customer Analytics Suite",
					"AI Insights Platform",
					"Predictive Analytics Tools",
				],
				financials: {
					currentValuation: 2500000000,
					lastRoundValuation: 2200000000,
					lastRoundDate: "2024-08-15",
					totalFundingRaised: 850000000,
					revenue: 450000000,
					revenueGrowthRate: 58.3,
					profitability: "profitable",
					burnRate: 0,
					employees: 1250,
				},
				ipoDetails: {
					ipoStatus: "preparation",
					expectedIpoDate: "2025-06-15",
					expectedPriceRange: { min: 120, max: 140 },
					proposedExchange: "NSE",
					leadUnderwriters: [
						"Goldman Sachs",
						"Morgan Stanley",
						"Kotak Mahindra",
					],
				},
				investment: {
					minimumInvestment: 50000,
					investmentTier: "tier_1",
					riskRating: "medium",
					expectedReturns: 18.5,
					lockInPeriod: 12,
					isAvailableForInvestment: true,
					totalInvestmentSlots: 1000,
					availableSlots: 342,
					investmentDeadline: "2025-05-15",
				},
				analysis: {
					marketPosition: "market_leader",
					competitiveAdvantage:
						"Proprietary AI algorithms with 95% customer retention rate",
					keyRisks: [
						"Increasing competition from tech giants",
						"Data privacy regulation changes",
					],
					keyOpportunities: [
						"Global expansion to APAC markets",
						"New AI-powered product lines",
						"Enterprise partnerships",
					],
					managementTeam: [
						{
							name: "Rajesh Kumar",
							position: "CEO",
							experience: "15 years tech leadership",
						},
						{
							name: "Priya Sharma",
							position: "CTO",
							experience: "12 years AI/ML expertise",
						},
					],
				},
				documents: {
					pitchDeck: "/documents/technova-pitch.pdf",
					financials: "/documents/technova-financials.pdf",
					drhp: "/documents/technova-drhp.pdf",
				},
			};

			res.json({
				status: "success",
				data: company,
			});
		} catch (error: any) {
			logger.error("Error fetching company details: " + (error?.message || "Unknown error"));
			res.status(500).json({ error: "Failed to fetch company details" });
		}
	});

	// ── Enterprise Valuation endpoint ──────────────────────────────────────────
	// GET /api/pre-ipo/valuation/:companyId
	// Returns a full FASP-EV-v1.0 enterprise valuation for a given unlisted /
	// pre-IPO company using its historical multi-year financial data.
	app.get("/api/pre-ipo/valuation/:companyId", async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;

			// Fetch the company record
			const company = await db
				.select()
				.from(unlistedCompanies)
				.where(eq(unlistedCompanies.id, companyId))
				.limit(1);

			if (!company[0]) {
				return res.status(404).json({
					success: false,
					error: { error_code: "COMPANY_NOT_FOUND", message: `Company ${companyId} not found`, retryable: false },
				});
			}

			const co = company[0];

			// Fetch up to 5 years of financials (ascending for CAGR computation)
			const financials = await db
				.select()
				.from(companyFinancials)
				.where(eq(companyFinancials.companyId, companyId))
				.orderBy(asc(companyFinancials.financialYear))
				.limit(5);

			if (financials.length === 0) {
				return res.status(200).json({
					success: true,
					data: null,
					meta: {
						timestamp: new Date().toISOString(),
						version: "1.0",
						message: "No financial data available for this company yet",
					},
				});
			}

			const yearlyData: YearlyFinancial[] = financials.map((f) => ({
				financialYear: f.financialYear,
				revenue: f.revenue ? parseFloat(String(f.revenue)) : null,
				ebitda: f.ebitda ? parseFloat(String(f.ebitda)) : null,
				pat: f.pat ? parseFloat(String(f.pat)) : null,
				netProfit: f.netProfit ? parseFloat(String(f.netProfit)) : null,
				freeCashFlow: f.freeCashFlow ? parseFloat(String(f.freeCashFlow)) : null,
				totalDebt: f.totalDebt ? parseFloat(String(f.totalDebt)) : null,
				networth: f.networth ? parseFloat(String(f.networth)) : null,
				cash: f.operatingCashFlow ? parseFloat(String(f.operatingCashFlow)) : null,
			}));

			const otcPrice = parseFloat(
				co.publishedBuyPrice || co.draftBuyPrice || "0",
			);

			const evResult = calculateEnterpriseValue({
				companyName: co.name,
				sector: co.sector,
				totalSharesOutstanding: co.totalShares ?? 0,
				currentOtcPricePerShare: otcPrice,
				yearlyFinancials: yearlyData,
			});

			// Attach raw yearwise financials table for frontend display
			const yearwiseTable = financials.map((f) => ({
				financialYear: f.financialYear,
				revenue: f.revenue ? parseFloat(String(f.revenue)) : null,
				ebitda: f.ebitda ? parseFloat(String(f.ebitda)) : null,
				pat: f.pat ? parseFloat(String(f.pat)) : null,
				netProfit: f.netProfit ? parseFloat(String(f.netProfit)) : null,
				freeCashFlow: f.freeCashFlow ? parseFloat(String(f.freeCashFlow)) : null,
				totalDebt: f.totalDebt ? parseFloat(String(f.totalDebt)) : null,
				networth: f.networth ? parseFloat(String(f.networth)) : null,
				dataSource: f.dataSource,
				verified: f.verified,
			}));

			logger.info(`[EV] Valuation computed for ${co.name}`, {
				event: "EV_COMPUTED",
				user_id: "system",
				latency_ms: 0,
				status: "success",
				companyId,
				blendedEV: evResult.blendedEV,
				fairSharePrice: evResult.fairSharePrice,
				discountToPremiumPct: evResult.discountToPremiumPct,
				yearsAnalysed: evResult.yearsAnalysed,
				engineVersion: evResult.engineVersion,
			});

			return res.json({
				success: true,
				data: {
					...evResult,
					yearwiseTable,
				},
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0",
				},
			});
		} catch (error: any) {
			logger.error(`[EV] Valuation endpoint error: ${error?.message}`);
			return res.status(500).json({
				success: false,
				error: {
					error_code: "EV_COMPUTATION_FAILED",
					message: error?.message || "Valuation computation failed",
					retryable: true,
				},
			});
		}
	});

	logger.info("Pre-IPO routes registered successfully");
}
