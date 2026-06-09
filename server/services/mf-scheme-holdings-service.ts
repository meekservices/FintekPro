import { db } from "../db";
import { mfSchemeStockHoldings, mutualFunds } from "../../shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

interface SchemeHolding {
	stockSymbol: string;
	stockName: string;
	stockIsin?: string;
	sector?: string;
	holdingPercentage: number;
}

interface HoldingsIngestionResult {
	mfIsin: string;
	holdingsCount: number;
	success: boolean;
	error?: string;
}

class MfSchemeHoldingsService {
	private static instance: MfSchemeHoldingsService;

	static getInstance(): MfSchemeHoldingsService {
		if (!MfSchemeHoldingsService.instance) {
			MfSchemeHoldingsService.instance = new MfSchemeHoldingsService();
		}
		return MfSchemeHoldingsService.instance;
	}

	async getHoldingsForScheme(mfIsin: string): Promise<SchemeHolding[]> {
		const holdings = await db
			.select()
			.from(mfSchemeStockHoldings)
			.where(eq(mfSchemeStockHoldings.mfIsin, mfIsin))
			.orderBy(desc(mfSchemeStockHoldings.holdingPercentage));

		return holdings.map((h) => ({
			stockSymbol: h.stockSymbol,
			stockName: h.stockName || h.stockSymbol,
			stockIsin: h.stockIsin || undefined,
			sector: h.sector || undefined,
			holdingPercentage: Number.parseFloat(String(h.holdingPercentage)),
		}));
	}

	async getHoldingsForMultipleSchemes(
		mfIsins: string[],
	): Promise<Map<string, SchemeHolding[]>> {
		if (mfIsins.length === 0) return new Map();

		const holdings = await db
			.select()
			.from(mfSchemeStockHoldings)
			.where(inArray(mfSchemeStockHoldings.mfIsin, mfIsins))
			.orderBy(
				mfSchemeStockHoldings.mfIsin,
				desc(mfSchemeStockHoldings.holdingPercentage),
			);

		const holdingsMap = new Map<string, SchemeHolding[]>();

		for (const h of holdings) {
			const existing = holdingsMap.get(h.mfIsin) || [];
			existing.push({
				stockSymbol: h.stockSymbol,
				stockName: h.stockName || h.stockSymbol,
				stockIsin: h.stockIsin || undefined,
				sector: h.sector || undefined,
				holdingPercentage: Number.parseFloat(String(h.holdingPercentage)),
			});
			holdingsMap.set(h.mfIsin, existing);
		}

		return holdingsMap;
	}

	async ingestHoldings(
		mfIsin: string,
		holdings: SchemeHolding[],
		holdingDate: Date,
		source: string = "amfi",
	): Promise<HoldingsIngestionResult> {
		try {
			const dateStr = holdingDate.toISOString().split("T")[0];

			await db
				.delete(mfSchemeStockHoldings)
				.where(
					and(
						eq(mfSchemeStockHoldings.mfIsin, mfIsin),
						eq(mfSchemeStockHoldings.holdingDate, dateStr),
					),
				);

			if (holdings.length === 0) {
				return { mfIsin, holdingsCount: 0, success: true };
			}

			const insertData = holdings.map((h) => ({
				mfIsin,
				stockSymbol: h.stockSymbol,
				stockName: h.stockName,
				stockIsin: h.stockIsin,
				sector: h.sector,
				holdingPercentage: String(h.holdingPercentage),
				holdingDate: dateStr,
				source,
			}));

			await db.insert(mfSchemeStockHoldings).values(insertData);

			return { mfIsin, holdingsCount: holdings.length, success: true };
		} catch (error: any) {
			console.error(
				`[MfSchemeHoldings] Error ingesting holdings for ${mfIsin}:`,
				error,
			);
			return { mfIsin, holdingsCount: 0, success: false, error: error.message };
		}
	}

	async getLatestHoldingDate(mfIsin: string): Promise<Date | null> {
		const result = await db
			.select({ maxDate: sql`MAX(holding_date)` })
			.from(mfSchemeStockHoldings)
			.where(eq(mfSchemeStockHoldings.mfIsin, mfIsin));

		return result[0]?.maxDate ? new Date(result[0].maxDate as string) : null;
	}

	async getSchemesCoverage(): Promise<{
		total: number;
		withHoldings: number;
		coverage: number;
	}> {
		const totalFunds = await db
			.select({ count: sql`COUNT(*)` })
			.from(mutualFunds);

		const fundsWithHoldings = await db
			.select({ count: sql`COUNT(DISTINCT mf_isin)` })
			.from(mfSchemeStockHoldings);

		const total = Number(totalFunds[0]?.count) || 0;
		const withHoldings = Number(fundsWithHoldings[0]?.count) || 0;

		return {
			total,
			withHoldings,
			coverage: total > 0 ? Math.round((withHoldings / total) * 100) : 0,
		};
	}

	async seedSampleHoldings(): Promise<void> {
		const sampleHoldings: Record<string, SchemeHolding[]> = {
			INF209K01UH6: [
				// HDFC Mid-Cap Opportunities Fund
				{
					stockSymbol: "RELIANCE",
					stockName: "Reliance Industries Ltd",
					sector: "Energy",
					holdingPercentage: 4.5,
				},
				{
					stockSymbol: "HDFCBANK",
					stockName: "HDFC Bank Ltd",
					sector: "Banking",
					holdingPercentage: 4.2,
				},
				{
					stockSymbol: "ICICIBANK",
					stockName: "ICICI Bank Ltd",
					sector: "Banking",
					holdingPercentage: 3.8,
				},
				{
					stockSymbol: "INFY",
					stockName: "Infosys Ltd",
					sector: "IT",
					holdingPercentage: 3.5,
				},
				{
					stockSymbol: "TCS",
					stockName: "Tata Consultancy Services",
					sector: "IT",
					holdingPercentage: 3.2,
				},
				{
					stockSymbol: "BAJFINANCE",
					stockName: "Bajaj Finance Ltd",
					sector: "Finance",
					holdingPercentage: 2.8,
				},
				{
					stockSymbol: "AXISBANK",
					stockName: "Axis Bank Ltd",
					sector: "Banking",
					holdingPercentage: 2.6,
				},
				{
					stockSymbol: "TATAMOTORS",
					stockName: "Tata Motors Ltd",
					sector: "Auto",
					holdingPercentage: 2.4,
				},
				{
					stockSymbol: "SUNPHARMA",
					stockName: "Sun Pharmaceutical",
					sector: "Pharma",
					holdingPercentage: 2.1,
				},
				{
					stockSymbol: "KOTAKBANK",
					stockName: "Kotak Mahindra Bank",
					sector: "Banking",
					holdingPercentage: 2.0,
				},
			],
			INF204K01HY3: [
				// Nippon India Small Cap Fund
				{
					stockSymbol: "RELIANCE",
					stockName: "Reliance Industries Ltd",
					sector: "Energy",
					holdingPercentage: 5.2,
				},
				{
					stockSymbol: "HDFCBANK",
					stockName: "HDFC Bank Ltd",
					sector: "Banking",
					holdingPercentage: 4.8,
				},
				{
					stockSymbol: "INFY",
					stockName: "Infosys Ltd",
					sector: "IT",
					holdingPercentage: 3.9,
				},
				{
					stockSymbol: "BHARTIARTL",
					stockName: "Bharti Airtel Ltd",
					sector: "Telecom",
					holdingPercentage: 3.1,
				},
				{
					stockSymbol: "LT",
					stockName: "Larsen & Toubro Ltd",
					sector: "Construction",
					holdingPercentage: 2.9,
				},
				{
					stockSymbol: "ADANIENT",
					stockName: "Adani Enterprises",
					sector: "Conglomerate",
					holdingPercentage: 2.5,
				},
				{
					stockSymbol: "MARUTI",
					stockName: "Maruti Suzuki India",
					sector: "Auto",
					holdingPercentage: 2.3,
				},
				{
					stockSymbol: "TITAN",
					stockName: "Titan Company Ltd",
					sector: "Consumer",
					holdingPercentage: 2.1,
				},
				{
					stockSymbol: "ULTRACEMCO",
					stockName: "UltraTech Cement",
					sector: "Cement",
					holdingPercentage: 1.9,
				},
				{
					stockSymbol: "NESTLEIND",
					stockName: "Nestle India Ltd",
					sector: "FMCG",
					holdingPercentage: 1.8,
				},
			],
			INF247L01411: [
				// Motilal Oswal Midcap Fund
				{
					stockSymbol: "HDFCBANK",
					stockName: "HDFC Bank Ltd",
					sector: "Banking",
					holdingPercentage: 5.5,
				},
				{
					stockSymbol: "RELIANCE",
					stockName: "Reliance Industries Ltd",
					sector: "Energy",
					holdingPercentage: 4.9,
				},
				{
					stockSymbol: "ICICIBANK",
					stockName: "ICICI Bank Ltd",
					sector: "Banking",
					holdingPercentage: 4.1,
				},
				{
					stockSymbol: "TCS",
					stockName: "Tata Consultancy Services",
					sector: "IT",
					holdingPercentage: 3.7,
				},
				{
					stockSymbol: "INFY",
					stockName: "Infosys Ltd",
					sector: "IT",
					holdingPercentage: 3.3,
				},
				{
					stockSymbol: "BAJFINANCE",
					stockName: "Bajaj Finance Ltd",
					sector: "Finance",
					holdingPercentage: 3.0,
				},
				{
					stockSymbol: "SBIN",
					stockName: "State Bank of India",
					sector: "Banking",
					holdingPercentage: 2.7,
				},
				{
					stockSymbol: "HINDUNILVR",
					stockName: "Hindustan Unilever",
					sector: "FMCG",
					holdingPercentage: 2.4,
				},
				{
					stockSymbol: "ITC",
					stockName: "ITC Ltd",
					sector: "FMCG",
					holdingPercentage: 2.2,
				},
				{
					stockSymbol: "ASIANPAINT",
					stockName: "Asian Paints Ltd",
					sector: "Consumer",
					holdingPercentage: 2.0,
				},
			],
			INF179KA1RT1: [
				// HDFC Large and Mid Cap Fund
				{
					stockSymbol: "RELIANCE",
					stockName: "Reliance Industries Ltd",
					sector: "Energy",
					holdingPercentage: 6.2,
				},
				{
					stockSymbol: "HDFCBANK",
					stockName: "HDFC Bank Ltd",
					sector: "Banking",
					holdingPercentage: 5.8,
				},
				{
					stockSymbol: "ICICIBANK",
					stockName: "ICICI Bank Ltd",
					sector: "Banking",
					holdingPercentage: 4.5,
				},
				{
					stockSymbol: "INFY",
					stockName: "Infosys Ltd",
					sector: "IT",
					holdingPercentage: 4.0,
				},
				{
					stockSymbol: "TCS",
					stockName: "Tata Consultancy Services",
					sector: "IT",
					holdingPercentage: 3.6,
				},
				{
					stockSymbol: "KOTAKBANK",
					stockName: "Kotak Mahindra Bank",
					sector: "Banking",
					holdingPercentage: 3.2,
				},
				{
					stockSymbol: "AXISBANK",
					stockName: "Axis Bank Ltd",
					sector: "Banking",
					holdingPercentage: 2.9,
				},
				{
					stockSymbol: "LT",
					stockName: "Larsen & Toubro Ltd",
					sector: "Construction",
					holdingPercentage: 2.6,
				},
				{
					stockSymbol: "BHARTIARTL",
					stockName: "Bharti Airtel Ltd",
					sector: "Telecom",
					holdingPercentage: 2.3,
				},
				{
					stockSymbol: "WIPRO",
					stockName: "Wipro Ltd",
					sector: "IT",
					holdingPercentage: 2.1,
				},
			],
			INF194K01524: [
				// Bandhan Large & Mid Cap Fund
				{
					stockSymbol: "HDFCBANK",
					stockName: "HDFC Bank Ltd",
					sector: "Banking",
					holdingPercentage: 5.4,
				},
				{
					stockSymbol: "RELIANCE",
					stockName: "Reliance Industries Ltd",
					sector: "Energy",
					holdingPercentage: 5.1,
				},
				{
					stockSymbol: "INFY",
					stockName: "Infosys Ltd",
					sector: "IT",
					holdingPercentage: 4.3,
				},
				{
					stockSymbol: "ICICIBANK",
					stockName: "ICICI Bank Ltd",
					sector: "Banking",
					holdingPercentage: 3.9,
				},
				{
					stockSymbol: "TCS",
					stockName: "Tata Consultancy Services",
					sector: "IT",
					holdingPercentage: 3.5,
				},
				{
					stockSymbol: "BAJFINANCE",
					stockName: "Bajaj Finance Ltd",
					sector: "Finance",
					holdingPercentage: 3.1,
				},
				{
					stockSymbol: "SBIN",
					stockName: "State Bank of India",
					sector: "Banking",
					holdingPercentage: 2.8,
				},
				{
					stockSymbol: "HINDUNILVR",
					stockName: "Hindustan Unilever",
					sector: "FMCG",
					holdingPercentage: 2.5,
				},
				{
					stockSymbol: "MARUTI",
					stockName: "Maruti Suzuki India",
					sector: "Auto",
					holdingPercentage: 2.2,
				},
				{
					stockSymbol: "TATAMOTORS",
					stockName: "Tata Motors Ltd",
					sector: "Auto",
					holdingPercentage: 2.0,
				},
			],
		};

		const holdingDate = new Date();
		holdingDate.setDate(1);

		for (const [isin, holdings] of Object.entries(sampleHoldings)) {
			await this.ingestHoldings(isin, holdings, holdingDate, "seed");
		}

		console.log(
			"[MfSchemeHoldings] Seeded sample holdings for",
			Object.keys(sampleHoldings).length,
			"funds",
		);
	}
}

export const mfSchemeHoldingsService = MfSchemeHoldingsService.getInstance();
