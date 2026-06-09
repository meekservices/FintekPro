/**
 * Unlisted Pricing Workflow Service
 *
 * Handles pricing lifecycle for unlisted marketplace:
 * - Draft price management
 * - Price validation
 * - Price publishing
 * - Compliance integration
 * - Trading suspension
 */

import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import {
	unlistedCompanies,
	unlistedAuditLog,
	type UnlistedCompany,
	type UnlistedAuditLog,
} from "@shared/schema";
import { complianceService, type ComplianceFlag } from "./compliance-service";

export interface ValidationResult {
	valid: boolean;
	warnings: string[];
	errors: string[];
}

export interface PriceChangeResult {
	success: boolean;
	message: string;
	company?: UnlistedCompany;
	auditLogId?: string;
}

export interface ComplianceCheckResult {
	complianceStatus: string;
	complianceBlockReasons: ComplianceFlag[];
	complianceRiskScore: number;
	hasBlockingFlags: boolean;
}

export class UnlistedPricingWorkflowService {
	/**
	 * Save draft prices for a company
	 * Validates prices and sets status to 'pending_review'
	 */
	async saveDraftPrices(
		companyId: string,
		buyPrice: number,
		sellPrice: number,
		userId: string,
		ipAddress?: string,
		userAgent?: string,
	): Promise<PriceChangeResult> {
		if (buyPrice <= 0) {
			return { success: false, message: "Buy price must be greater than 0" };
		}

		if (sellPrice <= buyPrice) {
			return {
				success: false,
				message: "Sell price must be greater than buy price",
			};
		}

		const [company] = await db
			.select()
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, companyId))
			.limit(1);

		if (!company) {
			return { success: false, message: "Company not found" };
		}

		const previousBuyPrice = company.draftBuyPrice || company.publishedBuyPrice;
		const previousSellPrice =
			company.draftSellPrice || company.publishedSellPrice;

		const [updatedCompany] = await db
			.update(unlistedCompanies)
			.set({
				draftBuyPrice: buyPrice.toString(),
				draftSellPrice: sellPrice.toString(),
				pricingStatus: "pending_review",
				updatedAt: new Date(),
			})
			.where(eq(unlistedCompanies.id, companyId))
			.returning();

		const [auditLog] = await db
			.insert(unlistedAuditLog)
			.values({
				companyId,
				actionType: "price_saved",
				actionBy: userId,
				previousBuyPrice: previousBuyPrice,
				previousSellPrice: previousSellPrice,
				newBuyPrice: buyPrice.toString(),
				newSellPrice: sellPrice.toString(),
				ipAddress,
				userAgent,
				metadata: {
					pricingStatus: "pending_review",
					timestamp: new Date().toISOString(),
				},
			})
			.returning();

		return {
			success: true,
			message: "Draft prices saved successfully",
			company: updatedCompany,
			auditLogId: auditLog.id,
		};
	}

	/**
	 * Validate prices and return warnings/errors
	 */
	async validatePrices(
		companyId: string,
		buyPrice: number,
		sellPrice: number,
	): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (buyPrice <= 0) {
			errors.push("Buy price must be greater than 0");
		}

		if (sellPrice <= buyPrice) {
			errors.push("Sell price must be greater than buy price");
		}

		const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
		if (spread > 20) {
			warnings.push(
				`Spread of ${spread.toFixed(2)}% exceeds recommended 20% threshold`,
			);
		}

		const [company] = await db
			.select()
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, companyId))
			.limit(1);

		if (company?.publishedBuyPrice) {
			const publishedBuy = Number(company.publishedBuyPrice);
			const buyPriceChange =
				Math.abs((buyPrice - publishedBuy) / publishedBuy) * 100;

			if (buyPriceChange > 15) {
				warnings.push(
					`Buy price change of ${buyPriceChange.toFixed(2)}% exceeds 15% from published price (₹${publishedBuy})`,
				);
			}
		}

		if (company?.publishedSellPrice) {
			const publishedSell = Number(company.publishedSellPrice);
			const sellPriceChange =
				Math.abs((sellPrice - publishedSell) / publishedSell) * 100;

			if (sellPriceChange > 15) {
				warnings.push(
					`Sell price change of ${sellPriceChange.toFixed(2)}% exceeds 15% from published price (₹${publishedSell})`,
				);
			}
		}

		return {
			valid: errors.length === 0,
			warnings,
			errors,
		};
	}

	/**
	 * Publish draft prices to live
	 * Blocks if compliance status is 'blocked'
	 */
	async publishPrices(
		companyId: string,
		userId: string,
		ipAddress?: string,
		userAgent?: string,
	): Promise<PriceChangeResult> {
		const [company] = await db
			.select()
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, companyId))
			.limit(1);

		if (!company) {
			return { success: false, message: "Company not found" };
		}

		if (company.complianceStatus === "blocked") {
			return {
				success: false,
				message:
					"Cannot publish prices: Company has blocking compliance issues",
			};
		}

		if (!company.draftBuyPrice || !company.draftSellPrice) {
			return { success: false, message: "No draft prices to publish" };
		}

		const previousBuyPrice = company.publishedBuyPrice;
		const previousSellPrice = company.publishedSellPrice;

		let priceChangePercent: number | null = null;
		if (previousBuyPrice) {
			priceChangePercent =
				((Number(company.draftBuyPrice) - Number(previousBuyPrice)) /
					Number(previousBuyPrice)) *
				100;
		}

		const [updatedCompany] = await db
			.update(unlistedCompanies)
			.set({
				publishedBuyPrice: company.draftBuyPrice,
				publishedSellPrice: company.draftSellPrice,
				pricingStatus: "published",
				pricePublishedAt: new Date(),
				pricePublishedBy: userId,
				updatedAt: new Date(),
			})
			.where(eq(unlistedCompanies.id, companyId))
			.returning();

		const [auditLog] = await db
			.insert(unlistedAuditLog)
			.values({
				companyId,
				actionType: "price_published",
				actionBy: userId,
				previousBuyPrice,
				previousSellPrice,
				newBuyPrice: company.draftBuyPrice,
				newSellPrice: company.draftSellPrice,
				priceChangePercent: priceChangePercent?.toFixed(2),
				ipAddress,
				userAgent,
				metadata: {
					pricingStatus: "published",
					publishedAt: new Date().toISOString(),
				},
			})
			.returning();

		return {
			success: true,
			message: "Prices published successfully",
			company: updatedCompany,
			auditLogId: auditLog.id,
		};
	}

	/**
	 * Run compliance checks and update company status
	 */
	async checkComplianceAndUpdate(
		companyId: string,
	): Promise<ComplianceCheckResult> {
		const flags = await complianceService.checkComplianceFlags(companyId);
		const riskScore = await complianceService.getComplianceRiskScore(companyId);
		const hasBlockingFlags = flags.some((f) => f.blocksDeals);

		const complianceStatus = hasBlockingFlags
			? "blocked"
			: flags.length > 0
				? "flagged"
				: "cleared";

		await db
			.update(unlistedCompanies)
			.set({
				complianceStatus,
				complianceBlockReasons: flags,
				complianceRiskScore: riskScore,
				complianceLastCheckedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(unlistedCompanies.id, companyId));

		return {
			complianceStatus,
			complianceBlockReasons: flags,
			complianceRiskScore: riskScore,
			hasBlockingFlags,
		};
	}

	/**
	 * Suspend trading for a company
	 */
	async suspendTrading(
		companyId: string,
		reason: string,
		userId: string,
		ipAddress?: string,
		userAgent?: string,
	): Promise<PriceChangeResult> {
		const [company] = await db
			.select()
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, companyId))
			.limit(1);

		if (!company) {
			return { success: false, message: "Company not found" };
		}

		if (company.tradingSuspended) {
			return { success: false, message: "Trading is already suspended" };
		}

		const [updatedCompany] = await db
			.update(unlistedCompanies)
			.set({
				tradingSuspended: true,
				tradingSuspendedAt: new Date(),
				tradingSuspendedBy: userId,
				tradingSuspendedReason: reason,
				updatedAt: new Date(),
			})
			.where(eq(unlistedCompanies.id, companyId))
			.returning();

		await db.insert(unlistedAuditLog).values({
			companyId,
			actionType: "trading_suspended",
			actionBy: userId,
			overrideReason: reason,
			ipAddress,
			userAgent,
			metadata: {
				suspendedAt: new Date().toISOString(),
				reason,
			},
		});

		return {
			success: true,
			message: "Trading suspended successfully",
			company: updatedCompany,
		};
	}

	/**
	 * Resume trading for a company
	 */
	async resumeTrading(
		companyId: string,
		userId: string,
		ipAddress?: string,
		userAgent?: string,
	): Promise<PriceChangeResult> {
		const [company] = await db
			.select()
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, companyId))
			.limit(1);

		if (!company) {
			return { success: false, message: "Company not found" };
		}

		if (!company.tradingSuspended) {
			return { success: false, message: "Trading is not suspended" };
		}

		const [updatedCompany] = await db
			.update(unlistedCompanies)
			.set({
				tradingSuspended: false,
				tradingSuspendedAt: null,
				tradingSuspendedBy: null,
				tradingSuspendedReason: null,
				updatedAt: new Date(),
			})
			.where(eq(unlistedCompanies.id, companyId))
			.returning();

		await db.insert(unlistedAuditLog).values({
			companyId,
			actionType: "trading_resumed",
			actionBy: userId,
			ipAddress,
			userAgent,
			metadata: {
				resumedAt: new Date().toISOString(),
				previousSuspensionReason: company.tradingSuspendedReason,
			},
		});

		return {
			success: true,
			message: "Trading resumed successfully",
			company: updatedCompany,
		};
	}

	/**
	 * Get audit log for a company
	 */
	async getAuditLog(
		companyId: string,
		limit: number = 50,
	): Promise<UnlistedAuditLog[]> {
		const logs = await db
			.select()
			.from(unlistedAuditLog)
			.where(eq(unlistedAuditLog.companyId, companyId))
			.orderBy(desc(unlistedAuditLog.createdAt))
			.limit(limit);

		return logs;
	}
}

export const unlistedPricingWorkflowService =
	new UnlistedPricingWorkflowService();
