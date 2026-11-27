/**
 * @file portfolio.repository.ts
 * @description Foundation Data Access Layer (DAL) for Portfolios, Holdings, and Transactions.
 *
 * Adheres strictly to FintekPro GCR v1.0:
 * - Layered architecture: Encapsulates all Drizzle ORM operations on portfolio entities
 * - Strict typing with zero 'any' unless justified
 * - Telemetry tracking on all database queries
 */

import { eq, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
	portfolios,
	portfolioHoldings,
	portfolioTransactions,
	type Portfolio,
	type PortfolioHolding,
	type PortfolioTransaction,
	type InsertPortfolio,
	type InsertPortfolioHolding,
	type InsertPortfolioTransaction,
} from "@shared/schema/portfolio";

export class PortfolioRepository extends BaseRepository {
	private static instance: PortfolioRepository;

	public static getInstance(): PortfolioRepository {
		if (!PortfolioRepository.instance) {
			PortfolioRepository.instance = new PortfolioRepository();
		}
		return PortfolioRepository.instance;
	}

	async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
		return this.withTelemetry("PortfolioRepository.getPortfoliosByUserId", async () => {
			return this.db
				.select()
				.from(portfolios)
				.where(eq(portfolios.userId, userId))
				.orderBy(desc(portfolios.createdAt));
		});
	}

	async getPortfolioById(id: string): Promise<Portfolio | null> {
		return this.withTelemetry("PortfolioRepository.getPortfolioById", async () => {
			const rows = await this.db
				.select()
				.from(portfolios)
				.where(eq(portfolios.id, id))
				.limit(1);
			return rows[0] || null;
		});
	}

	async createPortfolio(data: InsertPortfolio): Promise<Portfolio> {
		return this.withTelemetry("PortfolioRepository.createPortfolio", async () => {
			const rows = await this.db.insert(portfolios).values(data).returning();
			return rows[0];
		});
	}

	async getHoldingsByPortfolioId(portfolioId: string): Promise<PortfolioHolding[]> {
		return this.withTelemetry("PortfolioRepository.getHoldingsByPortfolioId", async () => {
			return this.db
				.select()
				.from(portfolioHoldings)
				.where(eq(portfolioHoldings.portfolioId, portfolioId));
		});
	}

	async createHolding(data: InsertPortfolioHolding): Promise<PortfolioHolding> {
		return this.withTelemetry("PortfolioRepository.createHolding", async () => {
			const rows = await this.db.insert(portfolioHoldings).values(data).returning();
			return rows[0];
		});
	}

	async getTransactionsByClientId(clientId: string, limit = 100): Promise<PortfolioTransaction[]> {
		return this.withTelemetry("PortfolioRepository.getTransactionsByClientId", async () => {
			return this.db
				.select()
				.from(portfolioTransactions)
				.where(eq(portfolioTransactions.clientId, clientId))
				.orderBy(desc(portfolioTransactions.tradeDate))
				.limit(limit);
		});
	}

	async createTransaction(data: InsertPortfolioTransaction): Promise<PortfolioTransaction> {
		return this.withTelemetry("PortfolioRepository.createTransaction", async () => {
			const rows = await this.db.insert(portfolioTransactions).values(data).returning();
			return rows[0];
		});
	}
}
