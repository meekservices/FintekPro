import { db } from "../db";
import {
	progressiveCommissionLedger,
	partnerWallets,
	reversalLedger,
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export class PartnerStatementService {
	private static instance: PartnerStatementService;

	static getInstance(): PartnerStatementService {
		if (!PartnerStatementService.instance) {
			PartnerStatementService.instance = new PartnerStatementService();
		}
		return PartnerStatementService.instance;
	}

	async getPayoutStatement(
		partnerId: string,
		options: {
			fromDate?: string;
			toDate?: string;
			groupBy?: "transaction" | "day" | "month";
		} = {},
	) {
		const { fromDate, toDate, groupBy = "transaction" } = options;

		const conditions: any[] = [
			eq(progressiveCommissionLedger.partnerId, partnerId),
		];
		if (fromDate) {
			conditions.push(
				gte(progressiveCommissionLedger.createdAt, new Date(fromDate)),
			);
		}
		if (toDate) {
			const end = new Date(toDate);
			end.setHours(23, 59, 59, 999);
			conditions.push(lte(progressiveCommissionLedger.createdAt, end));
		}

		const entries = await db
			.select()
			.from(progressiveCommissionLedger)
			.where(and(...conditions))
			.orderBy(desc(progressiveCommissionLedger.createdAt));

		const reversals = await db
			.select()
			.from(reversalLedger)
			.where(eq(reversalLedger.partnerId, partnerId));

		const reversalMap = new Map<string, number>();
		for (const r of reversals) {
			const existing = reversalMap.get(r.originalLedgerId) || 0;
			reversalMap.set(
				r.originalLedgerId,
				existing + Number.parseFloat(r.reversalAmount?.toString() || "0"),
			);
		}

		const wallet = await db
			.select()
			.from(partnerWallets)
			.where(eq(partnerWallets.partnerId, partnerId))
			.limit(1);

		let agentIncome = 0;
		let uplineIncome = 0;
		let totalEarned = 0;
		let totalReversed = 0;

		const formattedEntries = entries.map((e) => {
			const amount = Number.parseFloat(e.amount?.toString() || "0");
			const reversed = reversalMap.get(e.ledgerId) || 0;
			const netAmount = amount - reversed;

			if (e.role === "AGENT") agentIncome += netAmount;
			else if (e.role === "UPLINE") uplineIncome += netAmount;
			totalEarned += netAmount;
			totalReversed += reversed;

			return {
				transaction_id: e.transactionId,
				ledger_id: e.ledgerId,
				role: e.role,
				level_offset: e.levelOffset,
				payout_amount: amount.toFixed(2),
				reversed_amount: reversed.toFixed(2),
				net_amount: netAmount.toFixed(2),
				payout_type: e.role === "AGENT" ? "FIXED" : "INCENTIVE",
				payout_status:
					reversed >= amount
						? "REVERSED"
						: reversed > 0
							? "PARTIALLY_REVERSED"
							: "CREDITED",
				created_at: e.createdAt,
			};
		});

		const walletBalance =
			wallet.length > 0
				? Number.parseFloat(wallet[0].balance?.toString() || "0")
				: 0;
		const totalDebited =
			wallet.length > 0
				? Number.parseFloat(wallet[0].totalDebited?.toString() || "0")
				: 0;

		let groupedEntries: any;
		if (groupBy === "day") {
			groupedEntries = this.groupByDate(formattedEntries, "day");
		} else if (groupBy === "month") {
			groupedEntries = this.groupByDate(formattedEntries, "month");
		} else {
			groupedEntries = formattedEntries;
		}

		return {
			partner_id: partnerId,
			period: {
				from: fromDate || "all-time",
				to: toDate || "current",
			},
			summary: {
				total_earned: totalEarned.toFixed(2),
				agent_income: agentIncome.toFixed(2),
				upline_income: uplineIncome.toFixed(2),
				incentives_income: uplineIncome.toFixed(2),
				total_reversed: totalReversed.toFixed(2),
				paid_amount: totalDebited.toFixed(2),
				pending_amount: walletBalance.toFixed(2),
			},
			entries: groupedEntries,
		};
	}

	private groupByDate(entries: any[], mode: "day" | "month") {
		const groups: Record<
			string,
			{ date: string; entries: any[]; total: number }
		> = {};
		for (const entry of entries) {
			const d = new Date(entry.created_at);
			const key =
				mode === "day"
					? d.toISOString().split("T")[0]
					: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

			if (!groups[key]) {
				groups[key] = { date: key, entries: [], total: 0 };
			}
			groups[key].entries.push(entry);
			groups[key].total += Number.parseFloat(entry.net_amount);
		}
		return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
	}
}

export const partnerStatementService = PartnerStatementService.getInstance();
