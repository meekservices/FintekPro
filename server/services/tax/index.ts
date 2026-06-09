export interface TaxEstimationContext {
	action: "BUY" | "SELL";
	asset: string;
	quantity: number;
	estimated_gain_val: number; // Positive = gain, Negative = loss harvest
	is_long_term: boolean;
}

export interface TaxImpactReport {
	total_projected_liability: number;
	long_term_gains: number;
	short_term_gains: number;
	harvested_losses: number;
	net_tax_impact_score: number; // 0-100 severity indicator
}

export class TaxEstimationEngine {
	// Current Indian Market Standard Tax Brackets (Muted/Mocked for Phase 1 context)
	private readonly STCG_RATE = 0.15; // 15% Short Term
	private readonly LTCG_RATE = 0.1; // 10% Long term (often with exemption, ignored here for conservative buffer)

	/**
	 * 4.4 Tax-Aware Rebalancing computations
	 * Models the tax impact of pending trades dynamically to map onto the Advisor Approval screen context.
	 */
	public estimateRebalanceImpact(
		actions: TaxEstimationContext[],
	): TaxImpactReport {
		let ltcg = 0;
		let stcg = 0;
		let losses = 0;

		for (const trade of actions) {
			if (trade.action === "SELL") {
				if (trade.estimated_gain_val < 0) {
					losses += Math.abs(trade.estimated_gain_val);
				} else {
					if (trade.is_long_term) {
						ltcg += trade.estimated_gain_val;
					} else {
						stcg += trade.estimated_gain_val;
					}
				}
			}
		}

		// Rough Net Liability Calculation (Offsetting STCG with Harvested Losses if applicable)
		// Advanced tax-loss harvesting offsets would natively occur here
		const effectiveStcg = Math.max(0, stcg - losses);
		const remainingLosses = Math.max(0, losses - stcg);

		const effectiveLtcg = Math.max(0, ltcg - remainingLosses);

		const projectedTax =
			effectiveStcg * this.STCG_RATE + effectiveLtcg * this.LTCG_RATE;

		// Compute a pseudo-severity score to warn end-users.
		// If tax hit is massive compared to the overall trace, trigger red UI flags.
		const severityScore =
			projectedTax > 10000 ? 80 : projectedTax > 1000 ? 40 : 10;

		return {
			total_projected_liability: projectedTax,
			long_term_gains: ltcg,
			short_term_gains: stcg,
			harvested_losses: losses,
			net_tax_impact_score: severityScore,
		};
	}
}

export const taxEstimationEngine = new TaxEstimationEngine();
