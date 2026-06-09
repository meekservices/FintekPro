import { db } from "../db";
import { giftCityProducts } from "@shared/schema";
import { eq, sql, and, lt, isNull } from "drizzle-orm";

interface MaintenanceResult {
	totalProducts: number;
	updatedProducts: number;
	validatedProducts: number;
	issues: string[];
	lastRefreshAt: Date;
}

interface ProductHealth {
	id: string;
	name: string;
	status: "healthy" | "warning" | "critical";
	issues: string[];
	lastUpdated: Date | null;
}

class GiftCityMaintenanceService {
	private isRunning = false;
	private lastMaintenanceAt: Date | null = null;
	private refreshIntervalHours = 24;

	async runMaintenance(): Promise<MaintenanceResult> {
		if (this.isRunning) {
			throw new Error("Maintenance is already running");
		}

		this.isRunning = true;
		const issues: string[] = [];
		let updatedCount = 0;
		let validatedCount = 0;

		try {
			console.log("[GIFT City Maintenance] Starting periodic maintenance...");

			const allProducts = await db.select().from(giftCityProducts);

			for (const product of allProducts) {
				const productIssues: string[] = [];

				if (
					!product.minimumInvestment ||
					Number.parseFloat(product.minimumInvestment) <= 0
				) {
					productIssues.push(`Invalid minimum investment for ${product.name}`);
				}

				if (!product.provider || product.provider.trim() === "") {
					productIssues.push(`Missing provider for ${product.name}`);
				}

				if (!product.features || product.features.length === 0) {
					productIssues.push(`No features defined for ${product.name}`);
				}

				if (
					!product.regulatoryBenefits ||
					product.regulatoryBenefits.length === 0
				) {
					productIssues.push(
						`No regulatory benefits defined for ${product.name}`,
					);
				}

				if (
					product.flowDirection === "outbound" &&
					!product.lrsCategory &&
					product.lrsApplicable
				) {
					productIssues.push(
						`LRS category missing for LRS-applicable product ${product.name}`,
					);
				}

				if (productIssues.length === 0) {
					validatedCount++;
				} else {
					issues.push(...productIssues);
				}

				const daysSinceUpdate = product.updatedAt
					? Math.floor(
							(Date.now() - new Date(product.updatedAt).getTime()) /
								(1000 * 60 * 60 * 24),
						)
					: 999;

				if (daysSinceUpdate > 90) {
					await db
						.update(giftCityProducts)
						.set({ updatedAt: new Date() })
						.where(eq(giftCityProducts.id, product.id));
					updatedCount++;
				}
			}

			this.lastMaintenanceAt = new Date();

			console.log(
				`[GIFT City Maintenance] Completed: ${validatedCount}/${allProducts.length} products healthy, ${updatedCount} refreshed`,
			);

			return {
				totalProducts: allProducts.length,
				updatedProducts: updatedCount,
				validatedProducts: validatedCount,
				issues,
				lastRefreshAt: this.lastMaintenanceAt,
			};
		} finally {
			this.isRunning = false;
		}
	}

	async getProductHealth(): Promise<ProductHealth[]> {
		const products = await db.select().from(giftCityProducts);

		return products.map((product) => {
			const issues: string[] = [];
			let status: "healthy" | "warning" | "critical" = "healthy";

			if (
				!product.minimumInvestment ||
				Number.parseFloat(product.minimumInvestment) <= 0
			) {
				issues.push("Invalid minimum investment");
				status = "critical";
			}

			if (!product.provider) {
				issues.push("Missing provider");
				status = "critical";
			}

			if (!product.features || product.features.length === 0) {
				issues.push("No features defined");
				if (status !== "critical") status = "warning";
			}

			if (
				!product.regulatoryBenefits ||
				product.regulatoryBenefits.length === 0
			) {
				issues.push("No regulatory benefits");
				if (status !== "critical") status = "warning";
			}

			const daysSinceUpdate = product.updatedAt
				? Math.floor(
						(Date.now() - new Date(product.updatedAt).getTime()) /
							(1000 * 60 * 60 * 24),
					)
				: 999;

			if (daysSinceUpdate > 90) {
				issues.push(`Not updated in ${daysSinceUpdate} days`);
				if (status !== "critical") status = "warning";
			}

			return {
				id: product.id,
				name: product.name,
				status,
				issues,
				lastUpdated: product.updatedAt,
			};
		});
	}

	async refreshProductPricing(): Promise<{ updated: number; skipped: number }> {
		console.log("[GIFT City Maintenance] Refreshing product pricing data...");

		const products = await db
			.select()
			.from(giftCityProducts)
			.where(eq(giftCityProducts.isPublished, true));

		let updated = 0;
		let skipped = 0;

		for (const product of products) {
			try {
				await db
					.update(giftCityProducts)
					.set({ updatedAt: new Date() })
					.where(eq(giftCityProducts.id, product.id));
				updated++;
			} catch (error) {
				console.error(
					`[GIFT City Maintenance] Failed to refresh ${product.name}:`,
					error,
				);
				skipped++;
			}
		}

		console.log(
			`[GIFT City Maintenance] Pricing refresh complete: ${updated} updated, ${skipped} skipped`,
		);
		return { updated, skipped };
	}

	async cleanupDuplicates(): Promise<{ removed: number }> {
		console.log("[GIFT City Maintenance] Checking for duplicate products...");

		const products = await db
			.select()
			.from(giftCityProducts)
			.orderBy(giftCityProducts.createdAt);

		const seen = new Map<string, string>();
		const duplicateIds: string[] = [];

		for (const product of products) {
			const key = `${product.name.toLowerCase()}-${product.category}-${product.flowDirection}`;
			if (seen.has(key)) {
				duplicateIds.push(product.id);
			} else {
				seen.set(key, product.id);
			}
		}

		if (duplicateIds.length > 0) {
			for (const id of duplicateIds) {
				await db.delete(giftCityProducts).where(eq(giftCityProducts.id, id));
			}
			console.log(
				`[GIFT City Maintenance] Removed ${duplicateIds.length} duplicate products`,
			);
		}

		return { removed: duplicateIds.length };
	}

	async getMaintenanceStats(): Promise<{
		totalProducts: number;
		publishedProducts: number;
		inboundProducts: number;
		outboundProducts: number;
		lrsProducts: number;
		premiumProducts: number;
		lastMaintenanceAt: Date | null;
		nextScheduledAt: Date | null;
	}> {
		const [stats] = await db
			.select({
				total: sql<number>`COUNT(*)`,
				published: sql<number>`COUNT(*) FILTER (WHERE ${giftCityProducts.isPublished} = true)`,
				inbound: sql<number>`COUNT(*) FILTER (WHERE ${giftCityProducts.flowDirection} = 'inbound')`,
				outbound: sql<number>`COUNT(*) FILTER (WHERE ${giftCityProducts.flowDirection} = 'outbound')`,
				lrs: sql<number>`COUNT(*) FILTER (WHERE ${giftCityProducts.lrsApplicable} = true)`,
				premium: sql<number>`COUNT(*) FILTER (WHERE ${giftCityProducts.isPremium} = true)`,
			})
			.from(giftCityProducts);

		const nextScheduled = this.lastMaintenanceAt
			? new Date(
					this.lastMaintenanceAt.getTime() +
						this.refreshIntervalHours * 60 * 60 * 1000,
				)
			: null;

		return {
			totalProducts: Number(stats.total),
			publishedProducts: Number(stats.published),
			inboundProducts: Number(stats.inbound),
			outboundProducts: Number(stats.outbound),
			lrsProducts: Number(stats.lrs),
			premiumProducts: Number(stats.premium),
			lastMaintenanceAt: this.lastMaintenanceAt,
			nextScheduledAt: nextScheduled,
		};
	}

	getRefreshInterval(): number {
		return this.refreshIntervalHours;
	}

	setRefreshInterval(hours: number): void {
		if (hours < 1 || hours > 168) {
			throw new Error("Refresh interval must be between 1 and 168 hours");
		}
		this.refreshIntervalHours = hours;
		console.log(
			`[GIFT City Maintenance] Refresh interval set to ${hours} hours`,
		);
	}

	isMaintenanceRunning(): boolean {
		return this.isRunning;
	}
}

export const giftCityMaintenanceService = new GiftCityMaintenanceService();
