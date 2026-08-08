import { logger } from "../../logger";
import { db } from "../../db";
import { agentCommissions } from "../../../shared/schema/agents";

interface TradeData {
	agentId: string;
	clientId?: string;           // optional — may not always be known at call site
	amount: number;
	productClass: "MUTUAL_FUND" | "FIXED_DEPOSIT" | "PMS" | "AIF" | "US_STOCK";
	tradeType: "BUY" | "SELL";
}

// Map CommissionEngine productClass → DB productType column values
const PRODUCT_TYPE_MAP: Record<TradeData["productClass"], string> = {
	MUTUAL_FUND:    "mutual_funds",
	FIXED_DEPOSIT:  "fixed_deposit",
	PMS:            "pms",
	AIF:            "aif",
	US_STOCK:       "us_stock",
};

export class CommissionEngine {
	// Commission structure (bps - basis points, 100 bps = 1%)
	private commissionRates = {
		MUTUAL_FUND:    50,   // 0.5%
		FIXED_DEPOSIT:  100,  // 1%
		PMS:            200,  // 2%
		AIF:            250,  // 2.5%
		US_STOCK:       0,    // zero commission model
	};

	// Standard TDS on commission income: 10% above ₹15,000/yr (Section 194H)
	// This engine applies a flat 10% rate; advisor-level threshold tracking is handled by TDSWithholdingEngine.
	private readonly TDS_RATE = 0.10;

	/**
	 * Calculates the gross commission amount for a trade.
	 * Purpose: Deterministic commission calculation — same inputs always yield same output.
	 * Inputs: trade — TradeData with agentId, amount, productClass, tradeType
	 * Outputs: gross commission amount in INR (0 if SELL or productClass is zero-commission)
	 * Edge cases: SELL trades always return 0; unknown productClass defaults to 0 bps.
	 */
	calculateCommission(trade: TradeData): number {
		try {
			if (trade.tradeType === "SELL") {
				return 0; // No commission on redemptions
			}

			const bps = this.commissionRates[trade.productClass] || 0;
			const commissionAmount = (trade.amount * bps) / 10000;

			logger.debug("[CommissionEngine] Commission calculated", {
				event:     "COMMISSION_CALCULATED",
				agentId:   trade.agentId,
				product:   trade.productClass,
				amount:    trade.amount,
				bps,
				commission: commissionAmount,
			});

			return commissionAmount;
		} catch (error: any) {
			logger.error("[CommissionEngine] Calculation failed", {
				event:      "COMMISSION_CALC_FAILED",
				error_code: "COMMISSION_CALC_FAILED",
				retryable:  false,
				message:    error?.message,
			});
			return 0;
		}
	}

	/**
	 * Records a commission payout ledger entry in agentCommissions table.
	 *
	 * BUG-C FIX: Previously a STUB with a comment and no DB write.
	 * This caused ALL advisor commissions to be logged but never persisted,
	 * meaning agentCommissions table had zero rows despite real trades.
	 *
	 * Purpose: Persist commission due to advisor for a completed BUY trade.
	 * Inputs:  tradeId — the order/trade reference ID
	 *          trade   — TradeData with agentId, amount, productClass, tradeType
	 * Outputs: void (logs error if DB write fails)
	 * Edge cases: SELL trades skip (no commission). Commission = 0 also skips.
	 */
	async recordCommission(tradeId: string, trade: TradeData): Promise<void> {
		const grossCommission = this.calculateCommission(trade);
		if (grossCommission <= 0) return;

		const t0 = Date.now();
		try {
			const tdsAmount     = Math.round(grossCommission * this.TDS_RATE * 100) / 100;
			const netCommission = Math.round((grossCommission - tdsAmount) * 100) / 100;
			const bps           = this.commissionRates[trade.productClass] || 0;
			const ratePercent   = (bps / 100).toFixed(2);

			const now    = new Date();
			const month  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
			const fy     = now.getMonth() < 3
				? `FY${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`
				: `FY${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`;

			await db.insert(agentCommissions).values({
				agentId:               trade.agentId,
				clientId:              trade.clientId ?? "system",
				orderId:               tradeId,
				productType:           PRODUCT_TYPE_MAP[trade.productClass],
				transactionType:       "purchase",
				transactionAmount:     String(trade.amount),
				totalCommissionAmount: String(grossCommission),
				agentCommissionRate:   ratePercent,
				agentCommissionAmount: String(grossCommission),
				agentTdsAmount:        String(tdsAmount),
				agentNetCommission:    String(netCommission),
				agentSettlementStatus: "pending",
				transactionDate:       now,
				month,
				financialYear:         fy,
			});

			logger.info("[CommissionEngine] Commission recorded", {
				event:          "COMMISSION_RECORDED",
				agentId:        trade.agentId,
				tradeId,
				product:        trade.productClass,
				grossAmount:    grossCommission,
				tdsDeducted:    tdsAmount,
				netCommission,
				latency_ms:     Date.now() - t0,
				status:         "success",
			});
		} catch (error: any) {
			logger.error("[CommissionEngine] Failed to record commission", {
				event:      "COMMISSION_RECORD_FAILED",
				error_code: "COMMISSION_PERSIST_FAILED",
				retryable:  true,
				tradeId,
				agentId:    trade.agentId,
				message:    error?.message ?? String(error),
				latency_ms: Date.now() - t0,
			});
		}
	}
}

export const commissionEngine = new CommissionEngine();
