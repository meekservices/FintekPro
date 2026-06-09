// @ts-nocheck
import { db } from "../db";
import {
	treasuryEntities,
	treasuryAccounts,
	treasuryPositions,
} from "../../shared/schema/treasury";
import { eq, and } from "drizzle-orm";

export class TreasuryService {
	async createEntity(data: {
		name: string;
		type: "subsidiary" | "parent" | "joint_venture" | "branch" | "associate";
		registrationNumber?: string;
		taxId?: string;
		country?: string;
		currency?: string;
		parentId?: string;
	}) {
		const [entity] = await db
			.insert(treasuryEntities)
			.values({
				name: data.name,
				type: data.type,
				parentId: data.parentId,
				registrationNumber: data.registrationNumber,
				taxId: data.taxId,
				country: data.country || "IN",
				currency: data.currency || "INR",
				isActive: true,
				metadata: {},
			})
			.returning();

		return entity;
	}

	async getEntities() {
		return db.select().from(treasuryEntities);
	}

	async getEntityById(id: string) {
		const [entity] = await db
			.select()
			.from(treasuryEntities)
			.where(eq(treasuryEntities.id, id));
		return entity;
	}

	async linkBankAccount(
		entityId: string,
		data: {
			accountName: string;
			accountNumber: string;
			ifscCode: string;
			bankName: string;
			branchName?: string;
			accountType:
				| "current"
				| "savings"
				| "escrow"
				| "virtual"
				| "investment"
				| "debt"
				| "collection"
				| "disbursement";
			currency: string;
			provider: string;
			providerAccountId: string;
		},
	) {
		const [account] = await db
			.insert(treasuryAccounts)
			.values({
				entityId,
				accountName: data.accountName,
				accountNumber: data.accountNumber,
				ifscCode: data.ifscCode,
				bankName: data.bankName,
				branchName: data.branchName,
				accountType: data.accountType,
				currency: data.currency || "INR",
				provider: data.provider,
				providerAccountId: data.providerAccountId,
				status: "active",
			})
			.returning();

		return account;
	}

	async getEntityAccounts(entityId: string) {
		return db
			.select()
			.from(treasuryAccounts)
			.where(eq(treasuryAccounts.entityId, entityId));
	}

	async getPositions(entityId: string) {
		return db
			.select({
				accountId: treasuryAccounts.id,
				accountName: treasuryAccounts.accountName,
				accountNumber: treasuryAccounts.accountNumber,
				bankName: treasuryAccounts.bankName,
				accountType: treasuryAccounts.accountType,
				currency: treasuryAccounts.currency,
				availableBalance: treasuryPositions.availableBalance,
				ledgerBalance: treasuryPositions.ledgerBalance,
				lastSyncedAt: treasuryPositions.lastSyncedAt,
			})
			.from(treasuryAccounts)
			.leftJoin(
				treasuryPositions,
				eq(treasuryAccounts.id, treasuryPositions.accountId),
			)
			.where(eq(treasuryAccounts.entityId, entityId));
	}

	async syncBalance(accountId: string) {
		const [account] = await db
			.select()
			.from(treasuryAccounts)
			.where(eq(treasuryAccounts.id, accountId));
		if (!account) throw new Error("Account not found");

		let balance = 0;
		let success = false;

		if (account.provider === "decentro") {
			const { decentroService } = await import("./decentro-service");
			const result = await decentroService.getBalance(account.accountNumber);
			if (result.success) {
				balance = result.balance;
				success = true;
			}
		} else if (account.provider === "setu") {
			// Setu balance sync usually happens via AA (Account Aggregator)
			// For now we placeholder or use a specific API if available
			success = false;
		}

		if (success) {
			await db
				.insert(treasuryPositions)
				.values({
					accountId,
					availableBalance: balance.toString(),
					ledgerBalance: balance.toString(),
					lastSyncedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: treasuryPositions.accountId,
					set: {
						availableBalance: balance.toString(),
						ledgerBalance: balance.toString(),
						lastSyncedAt: new Date(),
						updatedAt: new Date(),
					},
				});
		}

		return { success, balance };
	}

	async syncAllBalances(entityId: string) {
		const accounts = await this.getEntityAccounts(entityId);
		const results = await Promise.all(
			accounts.map((acc) => this.syncBalance(acc.id)),
		);

		return {
			totalSynced: results.filter((r) => r.success).length,
			totalFailed: results.filter((r) => !r.success).length,
			results,
		};
	}
}

export const treasuryService = new TreasuryService();
