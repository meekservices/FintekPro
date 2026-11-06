/**
 * @file distribution.repository.ts
 * @description Domain Repository for Financial Products Distribution, Store, and Proposals.
 *
 * Implements FintekPro GCR v1.0:
 * - Direct ORM operations via Drizzle
 * - Telemetry & execution tracing
 * - Strict type-safety
 */

import { eq, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { storeProducts } from "@shared/schema/products";
import { investmentProposals, investmentProposalItems } from "@shared/schema/proposals-base";
import { prospectProposals } from "@shared/schema/proposals";

export class DistributionRepository extends BaseRepository {
	/**
	 * Get all active store products
	 */
	async getActiveStoreProducts(limit = 100) {
		return this.withTelemetry("getActiveStoreProducts", async () => {
			return this.db
				.select()
				.from(storeProducts)
				.where(eq(storeProducts.isActive, true))
				.limit(limit);
		});
	}

	/**
	 * Get store product by ID
	 */
	async getStoreProductById(productId: string) {
		return this.withTelemetry("getStoreProductById", async () => {
			const rows = await this.db
				.select()
				.from(storeProducts)
				.where(eq(storeProducts.id, productId))
				.limit(1);
			return rows[0] || null;
		});
	}

	/**
	 * Get proposals created by an agent/partner
	 */
	async getProposalsByAgent(agentId: string, limit = 50) {
		return this.withTelemetry("getProposalsByAgent", async () => {
			return this.db
				.select()
				.from(investmentProposals)
				.where(eq(investmentProposals.agentId, agentId))
				.orderBy(desc(investmentProposals.createdAt))
				.limit(limit);
		});
	}

	/**
	 * Get items inside a proposal
	 */
	async getProposalItems(proposalId: string) {
		return this.withTelemetry("getProposalItems", async () => {
			return this.db
				.select()
				.from(investmentProposalItems)
				.where(eq(investmentProposalItems.proposalId, proposalId));
		});
	}

	/**
	 * Find prospect proposal by token
	 */
	async getProspectProposalByToken(shareToken: string) {
		return this.withTelemetry("getProspectProposalByToken", async () => {
			const rows = await this.db
				.select()
				.from(prospectProposals)
				.where(eq(prospectProposals.shareToken, shareToken))
				.limit(1);
			return rows[0] || null;
		});
	}
}

export const distributionRepository = new DistributionRepository();
