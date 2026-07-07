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
import { NseIndia } from "stock-nse-india";
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
router.get("/api/instruments/search", async (req: Request, res: Response) => {
	try {
		const { q, assetClass, limit = 20 } = req.query;

		if (!q || String(q).length < 2) {
			return res.json({ instruments: [] });
		}

		const searchTerm = `%${String(q)}%`;
		const maxResults = Number(limit);

		let whereConditions = or(
			ilike(instrumentMaster.isin, searchTerm),
			ilike(instrumentMaster.name, searchTerm),
			ilike(instrumentMaster.symbol, searchTerm),
			ilike(instrumentMaster.shortName, searchTerm),
		);

		if (assetClass) {
			whereConditions = and(
				whereConditions,
				eq(instrumentMaster.assetClass, String(assetClass)),
			);
		}

		const instruments = await db
			.select({
				id: instrumentMaster.id,
				isin: instrumentMaster.isin,
				symbol: instrumentMaster.symbol,
				name: instrumentMaster.name,
				shortName: instrumentMaster.shortName,
				assetClass: instrumentMaster.assetClass,
				subType: instrumentMaster.subType,
				category: instrumentMaster.category,
				issuer: instrumentMaster.issuer,
				lastPrice: instrumentMaster.lastPrice,
				currency: instrumentMaster.currency,
				riskLevel: instrumentMaster.riskLevel,
				priceUpdatedAt: instrumentMaster.priceUpdatedAt,
			})
			.from(instrumentMaster)
			.where(and(whereConditions, eq(instrumentMaster.isActive, true)))
			.orderBy(instrumentMaster.name)
			.limit(maxResults);

		const existingIsins = new Set(
			instruments.map((i) => i.isin).filter(Boolean),
		);
		const assetClassStr = assetClass ? String(assetClass) : "";

		// Fallback: search mutualFunds table for mutual funds
		if (
			(!assetClassStr || assetClassStr === "mutual_fund") &&
			instruments.length < maxResults
		) {
			const remainingSlots = maxResults - instruments.length;
			const mfResults = await db
				.select({
					id: mutualFunds.id,
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					category: mutualFunds.category,
					fundHouse: mutualFunds.fundHouse,
					nav: mutualFunds.nav,
					riskLevel: mutualFunds.riskLevel,
				})
				.from(mutualFunds)
				.where(
					or(
						ilike(mutualFunds.schemeName, searchTerm),
						ilike(mutualFunds.schemeCode, searchTerm),
						ilike(mutualFunds.fundHouse, searchTerm),
					),
				)
				.orderBy(mutualFunds.schemeName)
				.limit(remainingSlots + 10);

			for (const mf of mfResults) {
				if (instruments.length >= maxResults) break;
				const mfIsin = `MF${mf.schemeCode}`;
				if (existingIsins.has(mfIsin)) continue;
				instruments.push({
					id: mf.id,
					isin: mfIsin,
					symbol: mf.schemeCode,
					name: mf.schemeName,
					shortName: mf.fundHouse || mf.schemeName,
					assetClass: "mutual_fund",
					subType: mf.category || null,
					category: mf.category || null,
					issuer: mf.fundHouse || null,
					lastPrice: mf.nav,
					currency: "INR",
					riskLevel: mf.riskLevel || null,
					priceUpdatedAt: null,
				});
				existingIsins.add(mfIsin);
			}
		}

		// Fallback: search mutualFunds table for ETFs (ETF schemes are stored in MF table)
		if (assetClassStr === "etf" && instruments.length < maxResults) {
			const remainingSlots = maxResults - instruments.length;
			const etfResults = await db
				.select({
					id: mutualFunds.id,
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					category: mutualFunds.category,
					fundHouse: mutualFunds.fundHouse,
					nav: mutualFunds.nav,
					riskLevel: mutualFunds.riskLevel,
				})
				.from(mutualFunds)
				.where(
					and(
						or(
							ilike(mutualFunds.schemeName, searchTerm),
							ilike(mutualFunds.schemeCode, searchTerm),
							ilike(mutualFunds.fundHouse, searchTerm),
						),
						or(
							ilike(mutualFunds.schemeName, "%ETF%"),
							ilike(mutualFunds.schemeName, "%Exchange Traded%"),
							ilike(mutualFunds.category, "%ETF%"),
						),
					),
				)
				.orderBy(mutualFunds.schemeName)
				.limit(remainingSlots + 10);

			for (const etf of etfResults) {
				if (instruments.length >= maxResults) break;
				const etfIsin = `ETF${etf.schemeCode}`;
				if (existingIsins.has(etfIsin)) continue;
				instruments.push({
					id: etf.id,
					isin: etfIsin,
					symbol: etf.schemeCode,
					name: etf.schemeName,
					shortName: etf.fundHouse || etf.schemeName,
					assetClass: "etf",
					subType: etf.category || null,
					category: etf.category || null,
					issuer: etf.fundHouse || null,
					lastPrice: etf.nav,
					currency: "INR",
					riskLevel: etf.riskLevel || null,
					priceUpdatedAt: null,
				});
				existingIsins.add(etfIsin);
			}
		}

		// Fallback: search bondCatalog table for bonds (3,020 bonds)
		if (assetClassStr === "bond" && instruments.length < maxResults) {
			const remainingSlots = maxResults - instruments.length;
			const bondResults = await db
				.select({
					id: bondCatalog.id,
					isin: bondCatalog.isin,
					bondName: bondCatalog.bondName,
					issuerName: bondCatalog.issuerName,
					instrumentType: bondCatalog.instrumentType,
					couponRate: bondCatalog.couponRate,
					maturityDate: bondCatalog.maturityDate,
					creditRating: bondCatalog.creditRating,
					faceValue: bondCatalog.faceValue,
					cleanPrice: bondCatalog.cleanPrice,
				})
				.from(bondCatalog)
				.where(
					or(
						ilike(bondCatalog.bondName, searchTerm),
						ilike(bondCatalog.issuerName, searchTerm),
						ilike(bondCatalog.isin, searchTerm),
					),
				)
				.orderBy(bondCatalog.bondName)
				.limit(remainingSlots + 10);

			for (const bond of bondResults) {
				if (instruments.length >= maxResults) break;
				const bondIsin = bond.isin || `BOND${bond.id}`;
				if (existingIsins.has(bondIsin)) continue;
				const price = bond.cleanPrice
					? String(bond.cleanPrice)
					: bond.faceValue
						? String(bond.faceValue)
						: null;
				instruments.push({
					id: bond.id,
					isin: bondIsin,
					symbol: bond.isin || "",
					name: bond.bondName || bond.issuerName || "",
					shortName: bond.issuerName || bond.bondName || "",
					assetClass: "bond",
					subType: bond.instrumentType || null,
					category: bond.instrumentType || null,
					issuer: bond.issuerName || null,
					lastPrice: price,
					currency: "INR",
					riskLevel: bond.creditRating || null,
					priceUpdatedAt: null,
				});
				existingIsins.add(bondIsin);
			}
		}

		// Fallback: search listed_stocks DB table for equity/stock or general searches
		const shouldSearchStocks =
			!assetClassStr || assetClassStr === "equity" || assetClassStr === "stock";
		if (shouldSearchStocks && instruments.length < maxResults) {
			const remainingSlots = maxResults - instruments.length;
			const stockResults = await db
				.select({
					id: listedStocks.id,
					symbol: listedStocks.symbol,
					isin: listedStocks.isin,
					companyName: listedStocks.companyName,
					sector: listedStocks.sector,
					industry: listedStocks.industry,
					currentPrice: listedStocks.currentPrice,
					marketCap: listedStocks.marketCap,
				})
				.from(listedStocks)
				.where(
					and(
						eq(listedStocks.isPublished, true),
						or(
							ilike(listedStocks.companyName, searchTerm),
							ilike(listedStocks.symbol, searchTerm),
							ilike(listedStocks.isin, searchTerm),
						),
					),
				)
				.orderBy(listedStocks.companyName)
				.limit(remainingSlots + 10);

			for (const stock of stockResults) {
				if (instruments.length >= maxResults) break;
				const stockIsin = stock.isin || `STOCK${stock.id}`;
				if (existingIsins.has(stockIsin)) continue;
				instruments.push({
					id: stock.id,
					isin: stockIsin,
					symbol: stock.symbol,
					name: stock.companyName,
					shortName: stock.symbol,
					assetClass: "equity",
					subType: stock.sector || null,
					category: stock.industry || null,
					issuer: null,
					lastPrice: stock.currentPrice ? String(stock.currentPrice) : null,
					currency: "INR",
					riskLevel: null,
					priceUpdatedAt: null,
				});
				existingIsins.add(stockIsin);
			}
		}

		// ── Live MFAPI fallback ─────────────────────────────────────────────────
		// When all DB tables are empty (fresh deploy, not yet seeded), fall back to
		// api.mfapi.in/mf/search so the proposal builder ISIN lookup always works.
		if (
			instruments.length === 0 &&
			(!assetClassStr || assetClassStr === "mutual_fund" || assetClassStr === "etf")
		) {
			try {
				const mfapiRes = await fetch(
					`https://api.mfapi.in/mf/search?q=${encodeURIComponent(String(q))}`,
					{ signal: AbortSignal.timeout(4000) },
				);
				if (mfapiRes.ok) {
					const mfapiData: Array<{ schemeCode: number; schemeName: string }> =
						await mfapiRes.json();
					for (const mf of mfapiData.slice(0, maxResults)) {
						instruments.push({
							id: mf.schemeCode,
							isin: `MF${mf.schemeCode}`,
							symbol: String(mf.schemeCode),
							name: mf.schemeName,
							shortName: mf.schemeName,
							assetClass: "mutual_fund",
							subType: null,
							category: null,
							issuer: null,
							lastPrice: null,
							currency: "INR",
							riskLevel: null,
							priceUpdatedAt: null,
						});
					}
				}
			} catch (_mfErr) {
				// non-fatal — DB results (even empty) are returned below
				logger.warn({ event: "mfapi_fallback_error", error: String(_mfErr) }, "MFAPI fallback failed");
			}
		}

		res.json({ instruments });
	} catch (error: any) {
			logger.error({ event: "instrument_search_error", error: String(error) }, "Instrument search error");

		res.status(500).json({ error: "Failed to search instruments" });
	}
});

// Get instrument by ISIN
router.get("/api/instruments/:isin", async (req: Request, res: Response) => {
	try {
		const { isin } = req.params;

		const [instrument] = await db
			.select()
			.from(instrumentMaster)
			.where(eq(instrumentMaster.isin, isin.toUpperCase()));

		if (!instrument) {
			return res.status(404).json({ error: "Instrument not found", isin });
		}

		res.json({ instrument });
	} catch (error: any) {
		logger.error({ event: "instrument_by_isin_error", error: String(error) }, "Get instrument by ISIN error");
		res.status(500).json({ error: "Failed to get instrument" });
	}
});

// Sync instrument master from existing data sources

export default router;
