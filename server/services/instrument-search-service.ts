import { db } from "../db";
import {
	mutualFunds,
	listedStocks,
	corporateBonds,
	governmentSecurities,
} from "@shared/schema";
import { sql, or, ilike } from "drizzle-orm";

export interface InstrumentSearchResult {
	id: string;
	name: string;
	symbol?: string;
	isin?: string;
	assetType: "EQUITY" | "MUTUAL_FUND" | "BOND" | "ETF" | "GOVERNMENT_SECURITY";
	category?: string;
	subCategory?: string;
	currentPrice?: number;
	currentNav?: number;
	fundHouse?: string;
	exchange?: string;
	sector?: string;
	riskLevel?: string;
	returns1y?: number;
	matchScore: number;
	matchField: "isin" | "symbol" | "name";
}

class InstrumentSearchService {
	private validateIsin(isin: string): boolean {
		const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
		return isinRegex.test(isin.toUpperCase());
	}

	async search(
		query: string,
		limit: number = 20,
	): Promise<InstrumentSearchResult[]> {
		if (!query || query.trim().length < 2) {
			return [];
		}

		const searchTerm = query.trim().toUpperCase();
		const isIsinSearch = this.validateIsin(searchTerm);
		const results: InstrumentSearchResult[] = [];

		try {
			const [mfResults, stockResults, bondResults] = await Promise.all([
				this.searchMutualFunds(searchTerm, isIsinSearch, limit),
				this.searchStocks(searchTerm, isIsinSearch, limit),
				this.searchBonds(searchTerm, isIsinSearch, limit),
			]);

			results.push(...mfResults, ...stockResults, ...bondResults);

			results.sort((a, b) => {
				if (isIsinSearch) {
					if (a.matchField === "isin" && b.matchField !== "isin") return -1;
					if (a.matchField !== "isin" && b.matchField === "isin") return 1;
				}
				return b.matchScore - a.matchScore;
			});

			return results.slice(0, limit);
		} catch (error) {
			console.error("[InstrumentSearch] Error searching instruments:", error);
			return [];
		}
	}

	async searchByIsin(isin: string): Promise<InstrumentSearchResult | null> {
		if (!this.validateIsin(isin)) {
			return null;
		}

		const results = await this.search(isin.toUpperCase(), 1);
		return (
			results.find((r) => r.isin?.toUpperCase() === isin.toUpperCase()) || null
		);
	}

	private async searchMutualFunds(
		searchTerm: string,
		isIsinSearch: boolean,
		limit: number,
	): Promise<InstrumentSearchResult[]> {
		try {
			const searchPattern = `%${searchTerm}%`;

			const funds = await db
				.select({
					id: mutualFunds.id,
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					category: mutualFunds.category,
					fundHouse: mutualFunds.fundHouse,
					nav: mutualFunds.nav,
					riskLevel: mutualFunds.riskLevel,
					returns1y: mutualFunds.returns1y,
					isin: mutualFunds.isin,
					isinGrowth: mutualFunds.isinGrowth,
					isinDividendPayout: mutualFunds.isinDividendPayout,
					isinDividendReinvest: mutualFunds.isinDividendReinvest,
				})
				.from(mutualFunds)
				.where(
					or(
						ilike(mutualFunds.schemeName, searchPattern),
						ilike(mutualFunds.schemeCode, searchPattern),
						sql`${mutualFunds.isin} ILIKE ${searchPattern}`,
						sql`${mutualFunds.isinGrowth} ILIKE ${searchPattern}`,
						sql`${mutualFunds.isinDividendPayout} ILIKE ${searchPattern}`,
						sql`${mutualFunds.isinDividendReinvest} ILIKE ${searchPattern}`,
					),
				)
				.limit(limit);

			return funds.map((fund) => {
				let matchField: "isin" | "symbol" | "name" = "name";
				let matchScore = 0;

				const isinMatch = [
					fund.isin,
					fund.isinGrowth,
					fund.isinDividendPayout,
					fund.isinDividendReinvest,
				]
					.filter(Boolean)
					.find((i) => i?.toUpperCase().includes(searchTerm));

				if (isinMatch) {
					matchField = "isin";
					matchScore = isinMatch.toUpperCase() === searchTerm ? 100 : 90;
				} else if (fund.schemeCode?.toUpperCase().includes(searchTerm)) {
					matchField = "symbol";
					matchScore = fund.schemeCode.toUpperCase() === searchTerm ? 95 : 80;
				} else {
					matchScore = fund.schemeName?.toUpperCase().startsWith(searchTerm)
						? 85
						: 70;
				}

				const isEtf =
					fund.category?.toLowerCase().includes("etf") ||
					fund.schemeName?.toLowerCase().includes("etf");

				return {
					id: fund.id,
					name: fund.schemeName || "",
					symbol: fund.schemeCode || undefined,
					isin: fund.isinGrowth || fund.isin || undefined,
					assetType: isEtf ? ("ETF" as const) : ("MUTUAL_FUND" as const),
					category: fund.category || undefined,
					fundHouse: fund.fundHouse || undefined,
					currentNav: fund.nav ? Number.parseFloat(fund.nav) : undefined,
					riskLevel: fund.riskLevel || undefined,
					returns1y: fund.returns1y
						? Number.parseFloat(fund.returns1y)
						: undefined,
					matchScore,
					matchField,
				};
			});
		} catch (error) {
			console.error("[InstrumentSearch] Error searching mutual funds:", error);
			return [];
		}
	}

	private async searchStocks(
		searchTerm: string,
		isIsinSearch: boolean,
		limit: number,
	): Promise<InstrumentSearchResult[]> {
		try {
			const searchPattern = `%${searchTerm}%`;

			const stocks = await db
				.select({
					id: listedStocks.id,
					symbol: listedStocks.symbol,
					companyName: listedStocks.companyName,
					isin: listedStocks.isin,
					sector: listedStocks.sector,
					broadSector: listedStocks.broadSector,
					currentPrice: listedStocks.currentPrice,
					marketCap: listedStocks.marketCap,
				})
				.from(listedStocks)
				.where(
					or(
						ilike(listedStocks.symbol, searchPattern),
						ilike(listedStocks.companyName, searchPattern),
						sql`${listedStocks.isin} ILIKE ${searchPattern}`,
					),
				)
				.limit(limit);

			return stocks.map((stock) => {
				let matchField: "isin" | "symbol" | "name" = "name";
				let matchScore = 0;

				if (stock.isin?.toUpperCase().includes(searchTerm)) {
					matchField = "isin";
					matchScore = stock.isin.toUpperCase() === searchTerm ? 100 : 90;
				} else if (stock.symbol?.toUpperCase().includes(searchTerm)) {
					matchField = "symbol";
					matchScore = stock.symbol.toUpperCase() === searchTerm ? 95 : 85;
				} else {
					matchScore = stock.companyName?.toUpperCase().startsWith(searchTerm)
						? 80
						: 65;
				}

				return {
					id: stock.id,
					name: stock.companyName || stock.symbol || "",
					symbol: stock.symbol || undefined,
					isin: stock.isin || undefined,
					assetType: "EQUITY" as const,
					category: stock.marketCap || undefined,
					sector: stock.broadSector || stock.sector || undefined,
					currentPrice: stock.currentPrice
						? Number.parseFloat(stock.currentPrice)
						: undefined,
					matchScore,
					matchField,
				};
			});
		} catch (error) {
			console.error("[InstrumentSearch] Error searching stocks:", error);
			return [];
		}
	}

	private async searchBonds(
		searchTerm: string,
		isIsinSearch: boolean,
		limit: number,
	): Promise<InstrumentSearchResult[]> {
		try {
			const searchPattern = `%${searchTerm}%`;

			const bonds = await db
				.select({
					id: corporateBonds.id,
					issuerName: corporateBonds.issuerName,
					isin: corporateBonds.isin,
					faceValue: corporateBonds.faceValue,
					couponRate: corporateBonds.couponRate,
					creditRating: corporateBonds.creditRating,
					maturityDate: corporateBonds.maturityDate,
				})
				.from(corporateBonds)
				.where(
					or(
						ilike(corporateBonds.issuerName, searchPattern),
						sql`${corporateBonds.isin} ILIKE ${searchPattern}`,
					),
				)
				.limit(limit);

			return bonds.map((bond) => {
				let matchField: "isin" | "symbol" | "name" = "name";
				let matchScore = 0;

				if (bond.isin?.toUpperCase().includes(searchTerm)) {
					matchField = "isin";
					matchScore = bond.isin.toUpperCase() === searchTerm ? 100 : 90;
				} else {
					matchScore = bond.issuerName?.toUpperCase().startsWith(searchTerm)
						? 80
						: 65;
				}

				return {
					id: bond.id,
					name: bond.issuerName || "",
					isin: bond.isin || undefined,
					assetType: "BOND" as const,
					category: bond.creditRating || undefined,
					subCategory: bond.maturityDate
						? `Maturity: ${bond.maturityDate}`
						: undefined,
					currentPrice: bond.faceValue
						? Number.parseFloat(bond.faceValue)
						: undefined,
					matchScore,
					matchField,
				};
			});
		} catch (error) {
			console.error("[InstrumentSearch] Error searching bonds:", error);
			return [];
		}
	}

	async getInstrumentDetails(
		isin: string,
	): Promise<InstrumentSearchResult | null> {
		return this.searchByIsin(isin);
	}

	async enrichHoldingWithInstrumentData(holding: {
		isin?: string;
		symbol?: string;
		name?: string;
	}): Promise<Partial<InstrumentSearchResult> | null> {
		if (holding.isin) {
			const result = await this.searchByIsin(holding.isin);
			if (result) return result;
		}

		if (holding.symbol) {
			const results = await this.search(holding.symbol, 5);
			const exactMatch = results.find(
				(r) => r.symbol?.toUpperCase() === holding.symbol?.toUpperCase(),
			);
			if (exactMatch) return exactMatch;
		}

		if (holding.name) {
			const results = await this.search(holding.name, 5);
			if (results.length > 0 && results[0].matchScore > 80) {
				return results[0];
			}
		}

		return null;
	}
}

export const instrumentSearchService = new InstrumentSearchService();
