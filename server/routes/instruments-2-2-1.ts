// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import { logger } from "../logger";
import {
	instrumentMaster,
	proposalHoldings,
	mutualFunds,
	bondCatalog,
	unlistedCompanies,
	listedStocks,
} from "@shared/schema";
import { eq, ilike, or, and, sql, desc, inArray } from "drizzle-orm";
import { unifiedStockPriceService } from "../services/unified-stock-price-service";

const router = Router();

// NIFTY 50 + Additional Major Stocks with ISINs
const LISTED_STOCKS = [
	{
		isin: "INE002A01018",
		symbol: "RELIANCE",
		name: "Reliance Industries Ltd",
		sector: "Energy",
		industry: "Oil & Gas",
	},
	{
		isin: "INE040A01034",
		symbol: "HDFCBANK",
		name: "HDFC Bank Ltd",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE090A01021",
		symbol: "ICICIBANK",
		name: "ICICI Bank Ltd",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE009A01021",
		symbol: "INFY",
		name: "Infosys Ltd",
		sector: "Information Technology",
		industry: "IT Services",
	},
	{
		isin: "INE467B01029",
		symbol: "TCS",
		name: "Tata Consultancy Services Ltd",
		sector: "Information Technology",
		industry: "IT Services",
	},
	{
		isin: "INE176A01028",
		symbol: "SBIN",
		name: "State Bank of India",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE585B01010",
		symbol: "MARUTI",
		name: "Maruti Suzuki India Ltd",
		sector: "Automobile",
		industry: "Auto Manufacturers",
	},
	{
		isin: "INE018A01030",
		symbol: "HCLTECH",
		name: "HCL Technologies Ltd",
		sector: "Information Technology",
		industry: "IT Services",
	},
	{
		isin: "INE030A01027",
		symbol: "AXISBANK",
		name: "Axis Bank Ltd",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE019A01038",
		symbol: "ITC",
		name: "ITC Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE881D01027",
		symbol: "BAJFINANCE",
		name: "Bajaj Finance Ltd",
		sector: "Financial Services",
		industry: "NBFC",
	},
	{
		isin: "INE296A01024",
		symbol: "BHARTIARTL",
		name: "Bharti Airtel Ltd",
		sector: "Telecommunication",
		industry: "Telecom Services",
	},
	{
		isin: "INE406A01037",
		symbol: "WIPRO",
		name: "Wipro Ltd",
		sector: "Information Technology",
		industry: "IT Services",
	},
	{
		isin: "INE154A01025",
		symbol: "LT",
		name: "Larsen & Toubro Ltd",
		sector: "Construction",
		industry: "Engineering",
	},
	{
		isin: "INE267A01025",
		symbol: "NESTLEIND",
		name: "Nestle India Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE628A01036",
		symbol: "HINDUNILVR",
		name: "Hindustan Unilever Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE001A01036",
		symbol: "TATAMOTORS",
		name: "Tata Motors Ltd",
		sector: "Automobile",
		industry: "Auto Manufacturers",
	},
	{
		isin: "INE028A01039",
		symbol: "SUNPHARMA",
		name: "Sun Pharmaceutical Industries Ltd",
		sector: "Healthcare",
		industry: "Pharmaceuticals",
	},
	{
		isin: "INE121A01024",
		symbol: "KOTAKBANK",
		name: "Kotak Mahindra Bank Ltd",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE021A01026",
		symbol: "ADANIENT",
		name: "Adani Enterprises Ltd",
		sector: "Diversified",
		industry: "Conglomerate",
	},
	{
		isin: "INE079A01024",
		symbol: "TATASTEEL",
		name: "Tata Steel Ltd",
		sector: "Metals & Mining",
		industry: "Steel",
	},
	{
		isin: "INE216A01030",
		symbol: "POWERGRID",
		name: "Power Grid Corporation of India Ltd",
		sector: "Utilities",
		industry: "Power",
	},
	{
		isin: "INE081A01012",
		symbol: "DRREDDY",
		name: "Dr. Reddy's Laboratories Ltd",
		sector: "Healthcare",
		industry: "Pharmaceuticals",
	},
	{
		isin: "INE437A01024",
		symbol: "ASIANPAINT",
		name: "Asian Paints Ltd",
		sector: "Consumer Goods",
		industry: "Paints",
	},
	{
		isin: "INE213A01029",
		symbol: "M&M",
		name: "Mahindra & Mahindra Ltd",
		sector: "Automobile",
		industry: "Auto Manufacturers",
	},
	{
		isin: "INE066A01020",
		symbol: "NTPC",
		name: "NTPC Ltd",
		sector: "Utilities",
		industry: "Power",
	},
	{
		isin: "INE245A01021",
		symbol: "HINDALCO",
		name: "Hindalco Industries Ltd",
		sector: "Metals & Mining",
		industry: "Aluminium",
	},
	{
		isin: "INE238A01034",
		symbol: "ULTRACEMCO",
		name: "UltraTech Cement Ltd",
		sector: "Cement",
		industry: "Building Materials",
	},
	{
		isin: "INE182A01018",
		symbol: "ONGC",
		name: "Oil & Natural Gas Corporation Ltd",
		sector: "Energy",
		industry: "Oil & Gas",
	},
	{
		isin: "INE115A01026",
		symbol: "JSWSTEEL",
		name: "JSW Steel Ltd",
		sector: "Metals & Mining",
		industry: "Steel",
	},
	{
		isin: "INE103A01014",
		symbol: "BPCL",
		name: "Bharat Petroleum Corporation Ltd",
		sector: "Energy",
		industry: "Oil & Gas",
	},
	{
		isin: "INE208A01029",
		symbol: "TATACONSUM",
		name: "Tata Consumer Products Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE759A01021",
		symbol: "COALINDIA",
		name: "Coal India Ltd",
		sector: "Metals & Mining",
		industry: "Mining",
	},
	{
		isin: "INE101A01026",
		symbol: "GRASIM",
		name: "Grasim Industries Ltd",
		sector: "Cement",
		industry: "Diversified",
	},
	{
		isin: "INE192A01025",
		symbol: "BAJAJ-AUTO",
		name: "Bajaj Auto Ltd",
		sector: "Automobile",
		industry: "Two Wheelers",
	},
	{
		isin: "INE226A01021",
		symbol: "CIPLA",
		name: "Cipla Ltd",
		sector: "Healthcare",
		industry: "Pharmaceuticals",
	},
	{
		isin: "INE917I01010",
		symbol: "ADANIPORTS",
		name: "Adani Ports & SEZ Ltd",
		sector: "Infrastructure",
		industry: "Ports",
	},
	{
		isin: "INE848E01016",
		symbol: "DIVISLAB",
		name: "Divi's Laboratories Ltd",
		sector: "Healthcare",
		industry: "Pharmaceuticals",
	},
	{
		isin: "INE117A01022",
		symbol: "INDUSINDBK",
		name: "IndusInd Bank Ltd",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE024A01023",
		symbol: "TECHM",
		name: "Tech Mahindra Ltd",
		sector: "Information Technology",
		industry: "IT Services",
	},
	{
		isin: "INE076A01028",
		symbol: "SBILIFE",
		name: "SBI Life Insurance Company Ltd",
		sector: "Financial Services",
		industry: "Insurance",
	},
	{
		isin: "INE239A01016",
		symbol: "TITAN",
		name: "Titan Company Ltd",
		sector: "Consumer Goods",
		industry: "Retail",
	},
	{
		isin: "INE733E01010",
		symbol: "HDFCLIFE",
		name: "HDFC Life Insurance Company Ltd",
		sector: "Financial Services",
		industry: "Insurance",
	},
	{
		isin: "INE129A01019",
		symbol: "EICHERMOT",
		name: "Eicher Motors Ltd",
		sector: "Automobile",
		industry: "Two Wheelers",
	},
	{
		isin: "INE152A01027",
		symbol: "HEROMOTOCO",
		name: "Hero MotoCorp Ltd",
		sector: "Automobile",
		industry: "Two Wheelers",
	},
	{
		isin: "INE010A01015",
		symbol: "APOLLOHOSP",
		name: "Apollo Hospitals Enterprise Ltd",
		sector: "Healthcare",
		industry: "Hospitals",
	},
	{
		isin: "INE128A01017",
		symbol: "BRITANNIA",
		name: "Britannia Industries Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE274J01014",
		symbol: "BAJAJFINSV",
		name: "Bajaj Finserv Ltd",
		sector: "Financial Services",
		industry: "NBFC",
	},
	{
		isin: "INE726G01019",
		symbol: "SHREECEM",
		name: "Shree Cement Ltd",
		sector: "Cement",
		industry: "Building Materials",
	},
	// Additional NIFTY Next 50 and popular stocks
	{
		isin: "INE669E01016",
		symbol: "VEDL",
		name: "Vedanta Ltd",
		sector: "Metals & Mining",
		industry: "Diversified Mining",
	},
	{
		isin: "INE752E01010",
		symbol: "PIDILITIND",
		name: "Pidilite Industries Ltd",
		sector: "Chemicals",
		industry: "Specialty Chemicals",
	},
	{
		isin: "INE003A01024",
		symbol: "SIEMENS",
		name: "Siemens Ltd",
		sector: "Capital Goods",
		industry: "Industrial Manufacturing",
	},
	{
		isin: "INE860A01027",
		symbol: "HAVELLS",
		name: "Havells India Ltd",
		sector: "Consumer Durables",
		industry: "Electricals",
	},
	{
		isin: "INE016A01026",
		symbol: "DABUR",
		name: "Dabur India Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE329A01031",
		symbol: "GODREJCP",
		name: "Godrej Consumer Products Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE111A01025",
		symbol: "ICICIPRULI",
		name: "ICICI Prudential Life Insurance Company Ltd",
		sector: "Financial Services",
		industry: "Insurance",
	},
	{
		isin: "INE066F01012",
		symbol: "BANDHANBNK",
		name: "Bandhan Bank Ltd",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE361B01024",
		symbol: "DLF",
		name: "DLF Ltd",
		sector: "Real Estate",
		industry: "Real Estate Development",
	},
	{
		isin: "INE795G01014",
		symbol: "IIFL",
		name: "IIFL Finance Ltd",
		sector: "Financial Services",
		industry: "NBFC",
	},
	{
		isin: "INE883A01011",
		symbol: "VOLTAS",
		name: "Voltas Ltd",
		sector: "Consumer Durables",
		industry: "Air Conditioning",
	},
	{
		isin: "INE484C01026",
		symbol: "LUPIN",
		name: "Lupin Ltd",
		sector: "Healthcare",
		industry: "Pharmaceuticals",
	},
	{
		isin: "INE918I01018",
		symbol: "JUBLFOOD",
		name: "Jubilant Foodworks Ltd",
		sector: "Consumer Services",
		industry: "Restaurants",
	},
	{
		isin: "INE326A01037",
		symbol: "POLYCAB",
		name: "Polycab India Ltd",
		sector: "Capital Goods",
		industry: "Cables & Wires",
	},
	{
		isin: "INE059A01026",
		symbol: "ABB",
		name: "ABB India Ltd",
		sector: "Capital Goods",
		industry: "Industrial Manufacturing",
	},
	{
		isin: "INE042A01014",
		symbol: "AMBUJACEM",
		name: "Ambuja Cements Ltd",
		sector: "Cement",
		industry: "Building Materials",
	},
	{
		isin: "INE121J01017",
		symbol: "PGHH",
		name: "Procter & Gamble Hygiene and Health Care Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE475B01022",
		symbol: "BERGEPAINT",
		name: "Berger Paints India Ltd",
		sector: "Consumer Goods",
		industry: "Paints",
	},
	{
		isin: "INE038A01020",
		symbol: "PNB",
		name: "Punjab National Bank",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE062A01020",
		symbol: "BANKBARODA",
		name: "Bank of Baroda",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE084A01016",
		symbol: "CANBK",
		name: "Canara Bank",
		sector: "Financial Services",
		industry: "Banking",
	},
	{
		isin: "INE148A01019",
		symbol: "IOC",
		name: "Indian Oil Corporation Ltd",
		sector: "Energy",
		industry: "Oil & Gas",
	},
	{
		isin: "INE256A01028",
		symbol: "GAIL",
		name: "GAIL (India) Ltd",
		sector: "Energy",
		industry: "Natural Gas",
	},
	{
		isin: "INE773I01017",
		symbol: "COLPAL",
		name: "Colgate-Palmolive (India) Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE199A01012",
		symbol: "MARICO",
		name: "Marico Ltd",
		sector: "Consumer Goods",
		industry: "FMCG",
	},
	{
		isin: "INE585A01012",
		symbol: "BOSCHLTD",
		name: "Bosch Ltd",
		sector: "Automobile",
		industry: "Auto Components",
	},
	{
		isin: "INE761H01022",
		symbol: "PAGEIND",
		name: "Page Industries Ltd",
		sector: "Consumer Goods",
		industry: "Apparel",
	},
	{
		isin: "INE140A01024",
		symbol: "ACC",
		name: "ACC Ltd",
		sector: "Cement",
		industry: "Building Materials",
	},
	{
		isin: "INE018E01016",
		symbol: "SBICARD",
		name: "SBI Cards and Payment Services Ltd",
		sector: "Financial Services",
		industry: "Credit Cards",
	},
	{
		isin: "INE477B01010",
		symbol: "MUTHOOTFIN",
		name: "Muthoot Finance Ltd",
		sector: "Financial Services",
		industry: "Gold Loans",
	},
	{
		isin: "INE101J01011",
		symbol: "CHOLAFIN",
		name: "Cholamandalam Investment and Finance Company Ltd",
		sector: "Financial Services",
		industry: "NBFC",
	},
];

// Search instruments by ISIN or name (autocomplete)
router.post(
	"/api/instruments/sync-nse",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (
				!user ||
				!["admin", "superadmin"].some((r) => user.roles?.includes(r))
			) {
				return res.status(403).json({ error: "Admin access required" });
			}

			// Fetch NSE equity list from public CSV (no auth, no scraping, no 403 risk)
			const csvResp = await (await import("axios")).default.get(
				"https://archives.nseindia.com/content/equities/EQUITY_L.csv",
				{ timeout: 15_000, responseType: "text", headers: { "User-Agent": "FintekPro-NSESync/3.1" } },
			);
			const allStocks = csvResp.data.split("\n").slice(1)
				.map((l: string) => l.split(",")[0]?.trim())
				.filter((s: string) => Boolean(s) && s.length > 0);
   // eslint-disable-next-line no-console
			console.log(`Found ${allStocks.length} stock symbols from NSE EQUITY_L.csv`);

			let synced = 0;
			let errors = 0;
			let skipped = 0;
			const batchSize = 50;

			// Process stocks in batches to avoid overwhelming NSE API
			for (let i = 0; i < allStocks.length; i += batchSize) {
				const batch = allStocks.slice(i, i + batchSize);

				for (const symbol of batch) {
					try {
						// Get detailed equity info via IndianAPI
						const iApiModule = await import("../services/indian-api-service");
						const equityRes = await iApiModule.indianApiService.getStockQuote(symbol, "NSE");

						if (!equityRes.success || !equityRes.data) {
							skipped++;
							continue;
						}
						const equityDetails = equityRes.data;
						const info = { isin: equityDetails.isin, symbol: equityDetails.symbol, companyName: equityDetails.company_name };
						const priceInfo = { lastPrice: equityDetails.current_price, previousClose: equityDetails.previous_close, pChange: equityDetails.change_percent };

						// Extract ISIN - required field
						const isin = info.isin;
						if (!isin || isin.length !== 12) {
							skipped++;
							continue;
						}

						// Get sector/industry from industryInfo if available
						const industryInfo = (equityDetails as any).industryInfo || {};
						const infoAny = info as any;

						await db
							.insert(instrumentMaster)
							.values({
								isin: isin,
								symbol: symbol,
								name: info.companyName || symbol,
								shortName: (info.companyName || symbol).substring(0, 50),
								assetClass: "equity",
								subType: null,
								sector: industryInfo.sector || industryInfo.industry || null,
								category:
									industryInfo.basicIndustry || industryInfo.industry || null,
								issuer: info.companyName || symbol,
								lastPrice: priceInfo.lastPrice?.toString() || null,
								priceSource: "nse",
								priceUpdatedAt: new Date(),
								riskLevel: "high",
								currency: "INR",
								sourceTable: "nse_equity",
								sourceId: isin,
								metadata: {
									symbol: symbol,
									exchange: "NSE",
									series: infoAny.series,
									industry: industryInfo.industry,
									sector: industryInfo.sector,
									macroSector: industryInfo.macro,
									faceValue: infoAny.faceValue,
									isinDemat: infoAny.isinDemat,
								},
							})
							.onConflictDoUpdate({
								target: instrumentMaster.isin,
								set: {
									symbol: symbol,
									name: info.companyName || symbol,
									lastPrice: priceInfo.lastPrice?.toString() || null,
									sector: industryInfo.sector || industryInfo.industry || null,
									category:
										industryInfo.basicIndustry || industryInfo.industry || null,
									priceUpdatedAt: new Date(),
									updatedAt: new Date(),
									metadata: sql`${instrumentMaster.metadata}::jsonb || ${JSON.stringify(
										{
											symbol: symbol,
											exchange: "NSE",
											series: infoAny.series,
											industry: industryInfo.industry,
											sector: industryInfo.sector,
											macroSector: industryInfo.macro,
										},
									)}::jsonb`,
								},
							});

						synced++;

						// Add small delay to be respectful to NSE API
						await new Promise((resolve) => setTimeout(resolve, 100));
					} catch (e: any) {
      // eslint-disable-next-line no-console
						console.error(`Error syncing ${symbol}:`, e.message);
						errors++;
					}
				}

    // eslint-disable-next-line no-console
				console.log(
					`Progress: ${Math.min(i + batchSize, allStocks.length)}/${allStocks.length} stocks processed`,
				);
			}

			res.json({
				success: true,
				synced,
				errors,
				skipped,
				total: allStocks.length,
				message: `Synced ${synced} stocks from NSE India (${errors} errors, ${skipped} skipped)`,
			});
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("NSE sync error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to sync NSE stocks" });
		}
	},
);

// Sync from NSE official equity list CSV (most reliable method)
router.post(
	"/api/instruments/sync-nse-csv",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (
				!user ||
				!["admin", "superadmin"].some((r) => user.roles?.includes(r))
			) {
				return res.status(403).json({ error: "Admin access required" });
			}

   // eslint-disable-next-line no-console
			console.log("Fetching NSE equity list from archives...");

			// Download the official NSE equity list CSV
			const response = await fetch(
				"https://archives.nseindia.com/content/equities/EQUITY_L.csv",
			);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch NSE equity list: ${response.statusText}`,
				);
			}

			const csvText = await response.text();
			const lines = csvText.split("\n").filter((line) => line.trim());

   // eslint-disable-next-line no-console
			console.log(`Processing ${lines.length - 1} stocks from NSE equity list`);

			let synced = 0;
			let errors = 0;

			// Skip header line
			for (let i = 1; i < lines.length; i++) {
				try {
					const line = lines[i];
					// Parse CSV: SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
					const parts = line.split(",");
					if (parts.length < 7) continue;

					const symbol = parts[0]?.trim();
					const name = parts[1]?.trim();
					const series = parts[2]?.trim();
					const isin = parts[6]?.trim();

					// Only process equity stocks (EQ series) with valid ISINs
					if (
						!symbol ||
						!isin ||
						!isin.startsWith("INE") ||
						isin.length !== 12
					) {
						continue;
					}

					// Skip non-EQ series (BE, BZ, etc. are less liquid)
					// But include EQ for main stocks

					await db
						.insert(instrumentMaster)
						.values({
							isin: isin,
							symbol: symbol,
							name: name || symbol,
							shortName: (name || symbol).substring(0, 50),
							assetClass: "equity",
							subType: null,
							sector: null,
							category: null,
							issuer: name || symbol,
							lastPrice: null,
							priceSource: "nse",
							riskLevel: "high",
							currency: "INR",
							sourceTable: "nse_equity_csv",
							sourceId: isin,
							metadata: {
								symbol: symbol,
								exchange: "NSE",
								series: series,
							},
						})
						.onConflictDoUpdate({
							target: instrumentMaster.isin,
							set: {
								symbol: symbol,
								name: name || symbol,
								shortName: (name || symbol).substring(0, 50),
								issuer: name || symbol,
								sourceTable: "nse_equity_csv",
								sourceId: isin,
								metadata: {
									symbol: symbol,
									exchange: "NSE",
									series: series,
								},
								updatedAt: new Date(),
							},
						});

					synced++;
				} catch (e: any) {
     // eslint-disable-next-line no-console
					console.error(`Error on line ${i}:`, e.message);
					errors++;
				}
			}

			res.json({
				success: true,
				synced,
				errors,
				total: lines.length - 1,
				message: `Synced ${synced} stocks from NSE equity list (${errors} errors)`,
			});
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("NSE CSV sync error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to sync NSE stocks from CSV" });
		}
	},
);

// Light sync - just fetch symbols and basic info without detailed API calls
router.post(
	"/api/instruments/sync-nse-light",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (
				!user ||
				!["admin", "superadmin"].some((r) => user.roles?.includes(r))
			) {
				return res.status(403).json({ error: "Admin access required" });
			}

			// Use IndianAPI getMostActive as alternative to NIFTY TOTAL MARKET index
			const { indianApiService } = await import("./indian-api-service");
			const activeRes = await indianApiService.getMostActive("NSE");
			const stocks = activeRes.success ? (activeRes.data ?? []) : [];

   // eslint-disable-next-line no-console
			console.log(`Found ${stocks.length} stocks from IndianAPI getMostActive`);

			let synced = 0;
			let errors = 0;

			for (const stock of stocks) {
				try {
					if (!stock.symbol) continue;

					// Generate ISIN if not available (use NSE symbol as identifier)
					const isin = stock.identifier?.startsWith("INE")
						? stock.identifier
						: `NSE${stock.symbol.padEnd(9, "0").substring(0, 9)}`;

					await db
						.insert(instrumentMaster)
						.values({
							isin: isin,
							symbol: stock.symbol,
							name: stock.meta?.companyName || stock.symbol,
							shortName: (stock.meta?.companyName || stock.symbol).substring(
								0,
								50,
							),
							assetClass: "equity",
							subType: null,
							sector: stock.meta?.industry || null,
							category: null,
							issuer: stock.meta?.companyName || stock.symbol,
							lastPrice: stock.lastPrice?.toString() || null,
							priceSource: "nse",
							priceUpdatedAt: new Date(),
							riskLevel: "high",
							currency: "INR",
							sourceTable: "nse_equity",
							sourceId: stock.symbol,
							metadata: {
								symbol: stock.symbol,
								exchange: "NSE",
								series: stock.series || "EQ",
								industry: stock.meta?.industry,
								dayHigh: stock.dayHigh,
								dayLow: stock.dayLow,
								open: stock.open,
								previousClose: stock.previousClose,
								change: stock.change,
								pChange: stock.pChange,
								yearHigh: stock.yearHigh,
								yearLow: stock.yearLow,
							},
						})
						.onConflictDoUpdate({
							target: instrumentMaster.isin,
							set: {
								symbol: stock.symbol,
								lastPrice: stock.lastPrice?.toString() || null,
								priceUpdatedAt: new Date(),
								updatedAt: new Date(),
							},
						});

					synced++;
				} catch (e: any) {
     // eslint-disable-next-line no-console
					console.error(`Error syncing ${stock.symbol}:`, e.message);
					errors++;
				}
			}

			res.json({
				success: true,
				synced,
				errors,
				total: stocks.length,
				message: `Synced ${synced} stocks from NIFTY Total Market (${errors} errors)`,
			});
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("NSE light sync error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to sync NSE stocks" });
		}
	},
);

// Get instrument master stats
router.get("/api/instruments/stats", async (req: Request, res: Response) => {
	try {
		const stats = await db
			.select({
				assetClass: instrumentMaster.assetClass,
				count: sql<number>`count(*)::int`,
			})
			.from(instrumentMaster)
			.where(eq(instrumentMaster.isActive, true))
			.groupBy(instrumentMaster.assetClass);

		const total = stats.reduce((sum, s) => sum + s.count, 0);

		res.json({ stats, total });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("Get instrument stats error:", error);
		res.status(500).json({ error: "Failed to get stats" });
	}
});

// ============ PROPOSAL HOLDINGS ============

// Get holdings for a proposal
router.get(
	"/api/proposals/:proposalId/holdings",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const holdings = await db
				.select()
				.from(proposalHoldings)
				.where(eq(proposalHoldings.proposalId, req.params.proposalId))
				.orderBy(proposalHoldings.sortOrder, proposalHoldings.createdAt);

			res.json({ holdings });
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("Get holdings error:", error);
			res.status(500).json({ error: "Failed to get holdings" });
		}
	},
);

// Batch save/update holdings for a proposal

export default router;
