import { db } from "../db";
import {
	holdingLotsV2,
	HoldingLotV2,
	InsertHoldingLotV2,
} from "@shared/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export interface LotStorageInput {
	portfolioId: string;
	holdingId?: string;
	userId: string;
	isin: string;
	folioNumber?: string;
	schemeName?: string;
	amcCode?: string;
	purchaseDate: string;
	purchaseDateSource?: string;
	purchaseDateConfidence?: number;
	transactionType: string;
	transactionId?: string;
	units: number;
	costPerUnit: number;
	totalCost: number;
	stampDuty?: number;
	purchaseNav?: number;
	balanceAfterTransaction?: number;
	transactionDescription?: string;
	exitLoadText?: string;
	advisorArn?: string;
	currentNav?: number;
	currentValue?: number;
	unrealizedGain?: number;
	unrealizedGainPercent?: number;
	holdingPeriod?: number;
	capitalGainsType?: string;
	taxRateApplicable?: number;
	sourcePdfId?: string;
	sourcePageNumber?: number;
	parsingConfidence?: number;
	status?: string;
	remainingUnits?: number;
}

export interface LotQueryResult {
	lots: HoldingLotV2[];
	totalUnits: number;
	totalCost: number;
	totalCurrentValue: number;
}

class HoldingLotsStorageService {
	private static instance: HoldingLotsStorageService;

	private constructor() {
		console.log("✅ Holding Lots Storage Service initialized");
	}

	static getInstance(): HoldingLotsStorageService {
		if (!HoldingLotsStorageService.instance) {
			HoldingLotsStorageService.instance = new HoldingLotsStorageService();
		}
		return HoldingLotsStorageService.instance;
	}

	async insertLots(
		lots: LotStorageInput[],
	): Promise<{ inserted: number; errors: string[] }> {
		const errors: string[] = [];
		let inserted = 0;

		for (const lot of lots) {
			try {
				const insertData: InsertHoldingLotV2 = {
					portfolioId: lot.portfolioId,
					holdingId: lot.holdingId,
					userId: lot.userId,
					isin: lot.isin,
					folioNumber: lot.folioNumber,
					schemeName: lot.schemeName,
					amcCode: lot.amcCode,
					purchaseDate: lot.purchaseDate,
					purchaseDateSource: lot.purchaseDateSource,
					purchaseDateConfidence: lot.purchaseDateConfidence?.toString(),
					transactionType: lot.transactionType,
					transactionId: lot.transactionId,
					units: lot.units.toString(),
					costPerUnit: lot.costPerUnit.toString(),
					totalCost: lot.totalCost.toString(),
					stampDuty: lot.stampDuty?.toString(),
					purchaseNav: lot.purchaseNav?.toString(),
					balanceAfterTransaction: lot.balanceAfterTransaction?.toString(),
					transactionDescription: lot.transactionDescription,
					exitLoadText: lot.exitLoadText,
					advisorArn: lot.advisorArn,
					currentNav: lot.currentNav?.toString(),
					currentValue: lot.currentValue?.toString(),
					unrealizedGain: lot.unrealizedGain?.toString(),
					unrealizedGainPercent: lot.unrealizedGainPercent?.toString(),
					holdingPeriod: lot.holdingPeriod,
					capitalGainsType: lot.capitalGainsType,
					taxRateApplicable: lot.taxRateApplicable?.toString(),
					sourcePdfId: lot.sourcePdfId,
					sourcePageNumber: lot.sourcePageNumber,
					parsingConfidence: lot.parsingConfidence?.toString(),
					status: lot.status || "active",
					remainingUnits: (lot.remainingUnits ?? lot.units).toString(),
				};

				await db.insert(holdingLotsV2).values(insertData);
				inserted++;
			} catch (error: any) {
				errors.push(`Failed to insert lot for ${lot.isin}: ${error.message}`);
			}
		}

		console.log(
			`[HoldingLotsStorage] Inserted ${inserted}/${lots.length} lots`,
		);
		return { inserted, errors };
	}

	async getLotsByUser(userId: string): Promise<LotQueryResult> {
		const lots = await db
			.select()
			.from(holdingLotsV2)
			.where(eq(holdingLotsV2.userId, userId))
			.orderBy(desc(holdingLotsV2.purchaseDate));

		return this.aggregateLots(lots);
	}

	async getLotsByIsin(userId: string, isin: string): Promise<LotQueryResult> {
		const lots = await db
			.select()
			.from(holdingLotsV2)
			.where(
				and(eq(holdingLotsV2.userId, userId), eq(holdingLotsV2.isin, isin)),
			)
			.orderBy(holdingLotsV2.purchaseDate);

		return this.aggregateLots(lots);
	}

	async getLotsByPortfolio(portfolioId: string): Promise<LotQueryResult> {
		const lots = await db
			.select()
			.from(holdingLotsV2)
			.where(eq(holdingLotsV2.portfolioId, portfolioId))
			.orderBy(holdingLotsV2.purchaseDate);

		return this.aggregateLots(lots);
	}

	async getActiveLotsByIsin(
		userId: string,
		isin: string,
	): Promise<HoldingLotV2[]> {
		return db
			.select()
			.from(holdingLotsV2)
			.where(
				and(
					eq(holdingLotsV2.userId, userId),
					eq(holdingLotsV2.isin, isin),
					inArray(holdingLotsV2.status, ["active", "partial"]),
				),
			)
			.orderBy(holdingLotsV2.purchaseDate);
	}

	async updateLotStatus(
		lotId: string,
		status: "active" | "partial" | "fully_sold" | "blocked",
		remainingUnits?: number,
	): Promise<boolean> {
		try {
			const updateData: Partial<HoldingLotV2> = {
				status,
				updatedAt: new Date(),
			};

			if (remainingUnits !== undefined) {
				updateData.remainingUnits = remainingUnits.toString();
			}

			await db
				.update(holdingLotsV2)
				.set(updateData)
				.where(eq(holdingLotsV2.id, lotId));

			return true;
		} catch (error) {
			console.error("[HoldingLotsStorage] Failed to update lot status:", error);
			return false;
		}
	}

	async updateCurrentValuation(
		lotId: string,
		currentNav: number,
		currentValue: number,
		unrealizedGain: number,
		unrealizedGainPercent: number,
		holdingPeriod: number,
		capitalGainsType: "stcg" | "ltcg",
	): Promise<boolean> {
		try {
			await db
				.update(holdingLotsV2)
				.set({
					currentNav: currentNav.toString(),
					currentValue: currentValue.toString(),
					unrealizedGain: unrealizedGain.toString(),
					unrealizedGainPercent: unrealizedGainPercent.toString(),
					holdingPeriod,
					capitalGainsType,
					updatedAt: new Date(),
				})
				.where(eq(holdingLotsV2.id, lotId));

			return true;
		} catch (error) {
			console.error("[HoldingLotsStorage] Failed to update valuation:", error);
			return false;
		}
	}

	async processRedemption(
		userId: string,
		isin: string,
		unitsToRedeem: number,
		redemptionDate: string,
	): Promise<{
		processedLots: { lotId: string; unitsRedeemed: number }[];
		remainingUnits: number;
	}> {
		const activeLots = await this.getActiveLotsByIsin(userId, isin);
		const processedLots: { lotId: string; unitsRedeemed: number }[] = [];
		let remaining = unitsToRedeem;

		for (const lot of activeLots) {
			if (remaining <= 0) break;

			const lotRemainingUnits = Number.parseFloat(
				lot.remainingUnits || lot.units,
			);

			if (lotRemainingUnits <= remaining) {
				remaining -= lotRemainingUnits;
				await this.updateLotStatus(lot.id, "fully_sold", 0);
				processedLots.push({ lotId: lot.id, unitsRedeemed: lotRemainingUnits });
			} else {
				const newRemaining = lotRemainingUnits - remaining;
				await this.updateLotStatus(lot.id, "partial", newRemaining);
				processedLots.push({ lotId: lot.id, unitsRedeemed: remaining });
				remaining = 0;
			}
		}

		return { processedLots, remainingUnits: remaining };
	}

	async deleteLotsByPortfolio(portfolioId: string): Promise<number> {
		const result = await db
			.delete(holdingLotsV2)
			.where(eq(holdingLotsV2.portfolioId, portfolioId));

		return result.rowCount || 0;
	}

	async deleteLotsByUser(userId: string): Promise<number> {
		const result = await db
			.delete(holdingLotsV2)
			.where(eq(holdingLotsV2.userId, userId));

		return result.rowCount || 0;
	}

	private aggregateLots(lots: HoldingLotV2[]): LotQueryResult {
		let totalUnits = 0;
		let totalCost = 0;
		let totalCurrentValue = 0;

		for (const lot of lots) {
			if (lot.status === "active" || lot.status === "partial") {
				const units = Number.parseFloat(lot.remainingUnits || lot.units);
				totalUnits += units;
				totalCost +=
					Number.parseFloat(lot.totalCost) *
					(units / Number.parseFloat(lot.units));
				if (lot.currentValue) {
					totalCurrentValue +=
						Number.parseFloat(lot.currentValue) *
						(units / Number.parseFloat(lot.units));
				}
			}
		}

		return { lots, totalUnits, totalCost, totalCurrentValue };
	}
}

export const holdingLotsStorageService =
	HoldingLotsStorageService.getInstance();
