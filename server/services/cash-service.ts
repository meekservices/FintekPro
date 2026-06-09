import { bankingService } from "./banking/banking-service";
import { db } from "../db";
import {
	treasuryAccounts,
	treasuryPositions,
	liquiditySnapshots,
} from "../../shared/schema/treasury";
import { eq } from "drizzle-orm";

export class CashService {
	async getConsolidatedPosition(entityId: string) {
		// 1. Get all accounts for the entity
		const accounts = await db
			.select()
			.from(treasuryAccounts)
			.where(eq(treasuryAccounts.entityId, entityId));

		// 2. Fetch latest balances from banking service
		// Note: We only have Cashfree provider now
		const balanceReqs = accounts
			.filter((acc) => acc.provider === "cashfree")
			.map((acc) => ({
				provider: acc.provider as string,
				accountId: acc.providerAccountId as string,
			}));

		if (balanceReqs.length === 0) {
			console.warn(
				`[CashService] No Cashfree accounts found for entity: ${entityId}`,
			);
			return [];
		}

		const latestBalances = await bankingService.getAllBalances(balanceReqs);

		// 3. Update positions in DB (idempotent)
		for (const balance of latestBalances) {
			const account = accounts.find(
				(a) => a.providerAccountId === balance.accountId,
			);
			if (account) {
				await db
					.insert(treasuryPositions)
					.values({
						accountId: account.id,
						ledgerBalance: balance.ledgerBalance,
						availableBalance: balance.availableBalance,
						currency: balance.currency,
						lastSyncedAt: balance.lastSyncedAt,
					})
					.onConflictDoUpdate({
						target: treasuryPositions.accountId,
						set: {
							ledgerBalance: balance.ledgerBalance,
							availableBalance: balance.availableBalance,
							lastSyncedAt: balance.lastSyncedAt,
							updatedAt: new Date(),
						},
					});
			}
		}

		// 4. Return consolidated view
		const positions = await db
			.select()
			.from(treasuryPositions)
			.innerJoin(
				treasuryAccounts,
				eq(treasuryPositions.accountId, treasuryAccounts.id),
			)
			.where(eq(treasuryAccounts.entityId, entityId));

		return positions.map((p) => ({
			accountName: p.treasury_accounts.accountName,
			bankName: p.treasury_accounts.bankName,
			accountNumber: p.treasury_accounts.accountNumber,
			availableBalance: p.treasury_positions.availableBalance,
			currency: p.treasury_positions.currency,
			lastSyncedAt: p.treasury_positions.lastSyncedAt,
		}));
	}

	async takeLiquiditySnapshot(entityId: string) {
		const position = await this.getConsolidatedPosition(entityId);

		const totalLiquidity = position.reduce(
			(sum, p) => sum + Number.parseFloat(p.availableBalance),
			0,
		);

		await db.insert(liquiditySnapshots).values({
			entityId,
			totalLiquidity: totalLiquidity.toString(),
			snapshotDate: new Date().toISOString().split("T")[0],
			breakdown: {
				bankBalances: position,
			},
		});

		return totalLiquidity;
	}
}

export const cashService = new CashService();
