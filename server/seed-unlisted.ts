import { db } from "./db";
import {
	unlistedCompanies,
	companyFinancials,
	companyRatios,
	unlistedPriceHistory,
	sellListings,
	buyRequests,
} from "@shared/schema";
import { sql } from "drizzle-orm";

const sampleCompanies = [
	{
		name: "National Stock Exchange of India Limited",
		cin: "U67120MH1992PLC069769",
		isin: "INE721I01024",
		sector: "Financial Services",
		industry: "Stock Exchanges",
		rocState: "Maharashtra",
		incorporationDate: "1992-11-27",
		paidUpCapital: "495000000",
		authorizedCapital: "1000000000",
		faceValue: "1.00",
		totalShares: 495000000,
		status: "active",
		listingStage: "pre_ipo",
		website: "https://www.nseindia.com",
		description:
			"National Stock Exchange of India Limited (NSE) is the leading stock exchange of India, located in Mumbai. NSE was established in 1992 as the first dematerialized electronic exchange in the country. It is the 4th largest stock exchange in the world by equity trading volume.",
		tags: ["pre-ipo", "stock-exchange", "fintech", "blue-chip"],
	},
	{
		name: "Tata Technologies Limited",
		cin: "U72200MH1994PLC083847",
		isin: "INE459J01021",
		sector: "Technology",
		industry: "IT Services & Consulting",
		rocState: "Maharashtra",
		incorporationDate: "1994-08-22",
		paidUpCapital: "4050000000",
		authorizedCapital: "5000000000",
		faceValue: "2.00",
		totalShares: 405000000,
		status: "active",
		listingStage: "pre_ipo",
		website: "https://www.tatatechnologies.com",
		description:
			"Tata Technologies Limited is a global engineering and digital services company, focused on automotive, aerospace, and industrial sectors. A subsidiary of Tata Motors.",
		tags: ["pre-ipo", "engineering", "automotive", "tata-group"],
	},
	{
		name: "HDB Financial Services Limited",
		cin: "U65990MH2007PLC173708",
		isin: "INE756I01025",
		sector: "Financial Services",
		industry: "Non-Banking Financial Company",
		rocState: "Maharashtra",
		incorporationDate: "2007-08-31",
		paidUpCapital: "7900000000",
		authorizedCapital: "10000000000",
		faceValue: "10.00",
		totalShares: 790000000,
		status: "active",
		listingStage: "pre_ipo",
		website: "https://www.hdbfs.com",
		description:
			"HDB Financial Services is a leading non-banking financial company (NBFC) and a subsidiary of HDFC Bank. It provides various loan products including vehicle loans, personal loans, and business loans.",
		tags: ["pre-ipo", "nbfc", "hdfc-group", "lending"],
	},
	{
		name: "Swiggy Private Limited",
		cin: "U74999KA2014PTC076184",
		isin: null,
		sector: "Consumer Services",
		industry: "Food Delivery & Quick Commerce",
		rocState: "Karnataka",
		incorporationDate: "2014-03-21",
		paidUpCapital: "520000000",
		authorizedCapital: "1000000000",
		faceValue: "1.00",
		totalShares: 520000000,
		status: "active",
		listingStage: "pre_ipo",
		website: "https://www.swiggy.com",
		description:
			"Swiggy is an Indian online food ordering and delivery platform founded in 2014. It also operates Instamart for quick commerce grocery delivery.",
		tags: ["pre-ipo", "food-tech", "unicorn", "quick-commerce"],
	},
	{
		name: "PhonePe Private Limited",
		cin: "U74999KA2015PTC082263",
		isin: null,
		sector: "Financial Services",
		industry: "Digital Payments",
		rocState: "Karnataka",
		incorporationDate: "2015-12-28",
		paidUpCapital: "350000000",
		authorizedCapital: "500000000",
		faceValue: "1.00",
		totalShares: 350000000,
		status: "active",
		listingStage: "pre_ipo",
		website: "https://www.phonepe.com",
		description:
			"PhonePe is a digital payments platform that provides UPI-based payments, mobile recharges, utility bill payments, and financial services. It is one of the largest digital payment platforms in India.",
		tags: ["pre-ipo", "fintech", "unicorn", "digital-payments"],
	},
];

const sampleFinancials = [
	{
		companyIndex: 0, // NSE
		financialYear: "FY2023-24",
		revenue: "12500000000",
		ebitda: "7800000000",
		pat: "5600000000",
		netProfit: "5600000000",
		totalAssets: "45000000000",
		totalLiabilities: "15000000000",
		networth: "30000000000",
		totalDebt: "2000000000",
		freeCashFlow: "4500000000",
	},
	{
		companyIndex: 1, // Tata Technologies
		financialYear: "FY2023-24",
		revenue: "48500000000",
		ebitda: "9200000000",
		pat: "6800000000",
		netProfit: "6800000000",
		totalAssets: "35000000000",
		totalLiabilities: "12000000000",
		networth: "23000000000",
		totalDebt: "3500000000",
		freeCashFlow: "5200000000",
	},
	{
		companyIndex: 2, // HDB Financial
		financialYear: "FY2023-24",
		revenue: "95000000000",
		ebitda: "28000000000",
		pat: "18000000000",
		netProfit: "18000000000",
		totalAssets: "850000000000",
		totalLiabilities: "750000000000",
		networth: "100000000000",
		totalDebt: "650000000000",
		freeCashFlow: "12000000000",
	},
	{
		companyIndex: 3, // Swiggy
		financialYear: "FY2023-24",
		revenue: "110000000000",
		ebitda: "-15000000000",
		pat: "-22000000000",
		netProfit: "-22000000000",
		totalAssets: "85000000000",
		totalLiabilities: "45000000000",
		networth: "40000000000",
		totalDebt: "8000000000",
		freeCashFlow: "-18000000000",
	},
	{
		companyIndex: 4, // PhonePe
		financialYear: "FY2023-24",
		revenue: "52000000000",
		ebitda: "-8500000000",
		pat: "-12000000000",
		netProfit: "-12000000000",
		totalAssets: "120000000000",
		totalLiabilities: "35000000000",
		networth: "85000000000",
		totalDebt: "5000000000",
		freeCashFlow: "-6000000000",
	},
];

/**
 * Calculate financial ratios dynamically from financial data
 * Uses real formulas for regulatory compliance - no hardcoded values
 *
 * Formulas:
 * - ROE = (Net Profit / Networth) × 100
 * - ROCE = (EBITDA / Capital Employed) × 100, where Capital Employed = Networth + Total Debt
 * - Debt/Equity = Total Debt / Networth
 * - PAT Margin = (Net Profit / Revenue) × 100
 * - P/E and P/B require current price (calculated separately during enrichment)
 */
function calculateRatiosFromFinancials(
	financial: (typeof sampleFinancials)[0],
	company: (typeof sampleCompanies)[0],
): {
	companyIndex: number;
	financialYear: string;
	roe: string | null;
	roce: string | null;
	roa: string | null;
	debtEquity: string | null;
	marginPat: string | null;
	marginEbitda: string | null;
} {
	const netProfit = Number.parseFloat(financial.netProfit);
	const networth = Number.parseFloat(financial.networth);
	const totalDebt = Number.parseFloat(financial.totalDebt);
	const totalAssets = Number.parseFloat(financial.totalAssets);
	const revenue = Number.parseFloat(financial.revenue);
	const ebitda = Number.parseFloat(financial.ebitda);

	// Capital Employed = Networth + Long-term Debt (using Total Debt as approximation)
	const capitalEmployed = networth + totalDebt;

	// Calculate ratios using proper formulas
	const roe = networth > 0 ? (netProfit / networth) * 100 : null;
	const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : null;
	const roce =
		capitalEmployed > 0 && ebitda !== 0
			? (ebitda / capitalEmployed) * 100
			: null;
	const debtEquity = networth > 0 ? totalDebt / networth : null;
	const marginPat = revenue > 0 ? (netProfit / revenue) * 100 : null;
	const marginEbitda =
		revenue > 0 && ebitda !== 0 ? (ebitda / revenue) * 100 : null;

	return {
		companyIndex: financial.companyIndex,
		financialYear: financial.financialYear,
		roe: roe !== null ? roe.toFixed(2) : null,
		roa: roa !== null ? roa.toFixed(2) : null,
		roce: roce !== null ? roce.toFixed(2) : null,
		debtEquity: debtEquity !== null ? debtEquity.toFixed(2) : null,
		marginPat: marginPat !== null ? marginPat.toFixed(2) : null,
		marginEbitda: marginEbitda !== null ? marginEbitda.toFixed(2) : null,
	};
}

export async function seedUnlistedMarketplace(userId: string) {
	console.log("Seeding unlisted marketplace data...");

	const createdCompanyIds: string[] = [];

	// Insert companies
	for (const company of sampleCompanies) {
		try {
			// Check if company already exists
			const existing = await db
				.select()
				.from(unlistedCompanies)
				.where(sql`cin = ${company.cin}`);
			if (existing.length > 0) {
				console.log(`Company ${company.name} already exists, skipping...`);
				createdCompanyIds.push(existing[0].id);
				continue;
			}

			const [created] = await db
				.insert(unlistedCompanies)
				.values({
					name: company.name,
					cin: company.cin,
					isin: company.isin,
					sector: company.sector,
					industry: company.industry,
					rocState: company.rocState,
					incorporationDate: company.incorporationDate,
					paidUpCapital: company.paidUpCapital,
					authorizedCapital: company.authorizedCapital,
					faceValue: company.faceValue,
					totalShares: company.totalShares,
					status: company.status,
					listingStage: company.listingStage,
					website: company.website,
					description: company.description,
					tags: company.tags,
					createdBy: userId,
				})
				.returning();

			createdCompanyIds.push(created.id);
			console.log(`Created company: ${company.name}`);
		} catch (error) {
			console.error(`Error creating company ${company.name}:`, error);
		}
	}

	// Insert financials
	for (const financial of sampleFinancials) {
		const companyId = createdCompanyIds[financial.companyIndex];
		if (!companyId) continue;

		try {
			await db.insert(companyFinancials).values({
				companyId,
				financialYear: financial.financialYear,
				revenue: financial.revenue,
				ebitda: financial.ebitda,
				pat: financial.pat,
				netProfit: financial.netProfit,
				totalAssets: financial.totalAssets,
				totalLiabilities: financial.totalLiabilities,
				networth: financial.networth,
				totalDebt: financial.totalDebt,
				freeCashFlow: financial.freeCashFlow,
				dataSource: "manual",
				verified: true,
			});
			console.log(
				`Created financials for company index ${financial.companyIndex}`,
			);
		} catch (error) {
			console.error(`Error creating financials:`, error);
		}
	}

	// Calculate and insert ratios dynamically from financial data
	// Uses real formulas instead of hardcoded values for regulatory compliance
	for (const financial of sampleFinancials) {
		const companyId = createdCompanyIds[financial.companyIndex];
		if (!companyId) continue;

		const company = sampleCompanies[financial.companyIndex];
		const calculatedRatios = calculateRatiosFromFinancials(financial, company);

		try {
			await db.insert(companyRatios).values({
				companyId,
				financialYear: calculatedRatios.financialYear,
				// P/E and P/B are calculated dynamically during MCA enrichment
				// when current price is available (see credhive-service.ts)
				peRatio: null, // Will be calculated from: Price / (PAT / Shares Outstanding)
				pbRatio: null, // Will be calculated from: Price / (Networth / Shares Outstanding)
				roe: calculatedRatios.roe,
				roa: calculatedRatios.roa,
				roce: calculatedRatios.roce,
				debtEquity: calculatedRatios.debtEquity,
				marginPat: calculatedRatios.marginPat,
				marginEbitda: calculatedRatios.marginEbitda,
				dataSource: "calculated_from_financials",
			});
			console.log(
				`Created ratios for ${company.name}: ROE=${calculatedRatios.roe}%, ROCE=${calculatedRatios.roce}%, D/E=${calculatedRatios.debtEquity}`,
			);
		} catch (error) {
			console.error(`Error creating ratios:`, error);
		}
	}

	// Insert price history
	const priceData = [
		{ companyIndex: 0, price: "5450.00", date: new Date("2024-11-01") }, // NSE
		{ companyIndex: 0, price: "5520.00", date: new Date("2024-11-15") },
		{ companyIndex: 0, price: "5600.00", date: new Date("2024-11-28") },
		{ companyIndex: 1, price: "1180.00", date: new Date("2024-11-01") }, // Tata Tech
		{ companyIndex: 1, price: "1210.00", date: new Date("2024-11-15") },
		{ companyIndex: 1, price: "1250.00", date: new Date("2024-11-28") },
		{ companyIndex: 2, price: "1650.00", date: new Date("2024-11-01") }, // HDB
		{ companyIndex: 2, price: "1720.00", date: new Date("2024-11-15") },
		{ companyIndex: 2, price: "1780.00", date: new Date("2024-11-28") },
		{ companyIndex: 3, price: "380.00", date: new Date("2024-11-01") }, // Swiggy
		{ companyIndex: 3, price: "395.00", date: new Date("2024-11-15") },
		{ companyIndex: 3, price: "410.00", date: new Date("2024-11-28") },
		{ companyIndex: 4, price: "850.00", date: new Date("2024-11-01") }, // PhonePe
		{ companyIndex: 4, price: "880.00", date: new Date("2024-11-15") },
		{ companyIndex: 4, price: "920.00", date: new Date("2024-11-28") },
	];

	for (const price of priceData) {
		const companyId = createdCompanyIds[price.companyIndex];
		if (!companyId) continue;

		try {
			await db.insert(unlistedPriceHistory).values({
				companyId,
				price: price.price,
				date: price.date,
				sourceType: "ADMIN_INPUT",
				notes: "Seed data for testing",
			});
		} catch (error) {
			console.error(`Error creating price history:`, error);
		}
	}
	console.log("Created price history entries");

	// Create sell listings
	const sellListingData = [
		{
			companyIndex: 0,
			quantity: 500,
			askPrice: "5800",
			landingPrice: "5600",
			floorPrice: "5400",
		}, // NSE
		{
			companyIndex: 0,
			quantity: 1000,
			askPrice: "5750",
			landingPrice: "5550",
			floorPrice: "5350",
		},
		{
			companyIndex: 1,
			quantity: 2000,
			askPrice: "1300",
			landingPrice: "1250",
			floorPrice: "1200",
		}, // Tata Tech
		{
			companyIndex: 2,
			quantity: 1500,
			askPrice: "1850",
			landingPrice: "1780",
			floorPrice: "1700",
		}, // HDB
		{
			companyIndex: 3,
			quantity: 5000,
			askPrice: "450",
			landingPrice: "420",
			floorPrice: "390",
		}, // Swiggy
		{
			companyIndex: 4,
			quantity: 3000,
			askPrice: "980",
			landingPrice: "930",
			floorPrice: "880",
		}, // PhonePe
	];

	for (const listing of sellListingData) {
		const companyId = createdCompanyIds[listing.companyIndex];
		if (!companyId) continue;

		try {
			await db.insert(sellListings).values({
				sellerUserId: userId,
				companyId,
				quantity: listing.quantity,
				askPrice: listing.askPrice,
				landingPrice: listing.landingPrice,
				floorPrice: listing.floorPrice,
				status: "active",
				quantityRemaining: listing.quantity,
				validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
				kycVerified: true,
				dematVerified: true,
			});
			console.log(
				`Created sell listing for company index ${listing.companyIndex}`,
			);
		} catch (error) {
			console.error(`Error creating sell listing:`, error);
		}
	}

	// Create buy requests
	const buyRequestData = [
		{ companyIndex: 0, quantity: 300, maxPrice: "5550", targetPrice: "5400" }, // NSE
		{ companyIndex: 0, quantity: 800, maxPrice: "5500", targetPrice: "5350" },
		{ companyIndex: 1, quantity: 1500, maxPrice: "1220", targetPrice: "1180" }, // Tata Tech
		{ companyIndex: 1, quantity: 2500, maxPrice: "1200", targetPrice: "1150" },
		{ companyIndex: 2, quantity: 1000, maxPrice: "1750", targetPrice: "1680" }, // HDB
		{ companyIndex: 3, quantity: 4000, maxPrice: "400", targetPrice: "380" }, // Swiggy
		{ companyIndex: 3, quantity: 6000, maxPrice: "390", targetPrice: "370" },
		{ companyIndex: 4, quantity: 2000, maxPrice: "900", targetPrice: "860" }, // PhonePe
		{ companyIndex: 4, quantity: 4000, maxPrice: "880", targetPrice: "840" },
	];

	for (const request of buyRequestData) {
		const companyId = createdCompanyIds[request.companyIndex];
		if (!companyId) continue;

		try {
			await db.insert(buyRequests).values({
				buyerUserId: userId,
				companyId,
				quantity: request.quantity,
				maxPrice: request.maxPrice,
				targetPrice: request.targetPrice,
				status: "active",
				quantityFilled: 0,
				validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
				kycVerified: true,
				fundsVerified: true,
			});
			console.log(
				`Created buy request for company index ${request.companyIndex}`,
			);
		} catch (error) {
			console.error(`Error creating buy request:`, error);
		}
	}

	console.log("Unlisted marketplace seeding complete!");
	return { companiesCreated: createdCompanyIds.length };
}
