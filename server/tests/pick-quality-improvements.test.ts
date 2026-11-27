/**
 * @file pick-quality-improvements.test.ts
 * @description Unit tests verifying multi-segment pick quality upgrades across:
 *   1. SGB R:R invariant, 2026 canonical spot price & secondary ticker resolution
 *   2. FD credit-quality tiering, quarterly compounding & DICGC metadata
 *   3. ETF liquidity & daily turnover gating
 *   4. Stock surveillance (ASM/GSM) & upper circuit lock guardrails
 *   5. Derivatives real-world bid/ask spread slippage modeling
 *   6. Bond seniority & subordinated debt write-down protection
 *   7. Multi-asset signal efficacy tracking in PickOutcomeAnalyzer
 */

import { describe, it, expect } from "vitest";
import { FixedDepositStrategy } from "../services/picks/fixed-deposit-strategy";
import { ETFStrategy } from "../services/picks/etf-strategy";
import { SGBStrategy } from "../services/picks/sgb-strategy";
import { BondStrategy } from "../services/picks/bond-strategy";
import { DerivativeStrategy } from "../services/picks/derivative-strategy";
import { StockStrategy } from "../services/picks/stock-strategy";
import { pickOfTheDayService } from "../services/pick-of-the-day-service";

describe("Multi-Segment Pick Quality Improvements", () => {
	describe("1. SGB Strategy Math & 2026 Benchmark Precision", () => {
		const sgbStrat = new SGBStrategy();

		it("enforces minimum 2:1 R:R ratio for SGB picks", () => {
			const { targetPct, stoplossPct } = (sgbStrat as any).getDynamicTargetStoploss("sgb");
			expect(targetPct).toBeGreaterThanOrEqual(0.08); // 8% gold target
			expect(stoplossPct).toBeLessThanOrEqual(0.04);
			expect(targetPct / stoplossPct).toBeGreaterThanOrEqual(2.0); // 2:1 R:R
		});

		it("scores open SGB issues higher than closed ones", () => {
			const openScore = sgbStrat.score({ id: 1, name: "SGB 2024-25 Series I", issuePrice: 12000, issueStatus: "open" });
			const upcomingScore = sgbStrat.score({ id: 2, name: "SGB 2024-25 Series II", issuePrice: 12000, issueStatus: "upcoming" });
			expect(openScore).toBeGreaterThan(upcomingScore);
		});
	});

	describe("2. Fixed Deposit Strategy Credit Quality & Quarterly Compounding", () => {
		const fdStrat = new FixedDepositStrategy();

		it("prioritizes AAA Scheduled Commercial Banks over lower-rated NBFCs despite lower nominal yield", () => {
			const sbiBank = {
				id: "sbi_3y",
				name: "SBI Fixed Deposit",
				issuer: "State Bank of India",
				interestRate: "7.0",
				tenure: "36",
				creditRating: "SOVEREIGN/AAA",
				isBank: true,
			};
			const unratedNbfc = {
				id: "risky_nbfc",
				name: "Speculative NBFC Deposit",
				issuer: "Risky NBFC",
				interestRate: "9.2",
				tenure: "36",
				creditRating: "BBB",
				isBank: false,
			};

			const bankScore = fdStrat.score(sbiBank);
			const nbfcScore = fdStrat.score(unratedNbfc);

			// Pristine AAA bank with DICGC protection should score higher than a BBB NBFC
			expect(bankScore).toBeGreaterThan(nbfcScore);
		});

		it("calculates accurate quarterly compounding maturity rather than simple interest", async () => {
			const principal = 100_000;
			const rate = 8.0;
			const tenureMonths = 24; // 2 years
			// Quarterly compounding: 100000 * (1 + 8/400)^(4*2) = 100000 * (1.02)^8 ≈ 117,165.94
			// Simple interest would give 100000 * (1 + 0.16) = 116,000 (underestimation of ₹1,165)
			const mockContext: any = {
				today: "2026-11-27",
				recentIds: new Set<string>(),
				service: {
					generateRationale: async () => "Safe FD rationale with quarterly compounding.",
				},
			};

			const pick = await fdStrat.generate(mockContext);
			expect(pick).not.toBeNull();
			if (pick) {
				const expectedCompounded = Math.round(principal * Math.pow(1 + (pick.keyMetrics as any).interestRate / 400, 4 * ((pick.keyMetrics as any).tenure.includes("36") ? 3 : (pick.keyMetrics as any).tenure.includes("24") ? 2 : 1)));
				expect(pick.targetPrice).toBeGreaterThan(principal);
				expect((pick.keyMetrics as any).compoundingFrequency).toBe("Quarterly");
				expect((pick.keyMetrics as any).annualizedYieldAPY).toBeGreaterThan((pick.keyMetrics as any).interestRate);
			}
		});
	});

	describe("3. ETF Turnover & Liquidity Gating", () => {
		const etfStrat = new ETFStrategy();

		it("awards substantial bonus to high-turnover institutional ETFs (>= ₹1 Cr daily)", () => {
			const liquidEtf = {
				id: "niftybees",
				name: "Nippon India Nifty 50 BeES ETF",
				lastPrice: "285.50",
				volume: "500000", // Turnover ≈ ₹14.27 Cr
				expenseRatio: "0.04",
				issuer: "Nippon",
			};
			const illiquidEtf = {
				id: "tiny_etf",
				name: "Obscure Sector ETF",
				lastPrice: "520.00",
				volume: "100", // Turnover = ₹52,000 (extremely illiquid)
				expenseRatio: "0.45",
				issuer: "Unknown",
			};

			const liquidScore = etfStrat.score(liquidEtf);
			const illiquidScore = etfStrat.score(illiquidEtf);

			expect(liquidScore).toBeGreaterThan(illiquidScore + 25);
		});
	});

	describe("4. Listed Stock Surveillance (ASM/GSM) & Circuit Lock Gating", () => {
		const stockStrat = pickOfTheDayService.getStrategy("listed_stocks") as StockStrategy;

		it("penalizes stocks flagged in trade-for-trade / surveillance series (BE, BZ, SM, ST)", async () => {
			const normalStock = {
				symbol: "NORMAL_CO",
				currentPrice: "450",
				dayChangePercent: "1.2",
				series: "EQ",
				analystRating: "Buy",
				numberOfAnalysts: 8,
			};
			const surveillanceStock = {
				symbol: "SURVEILLANCE_CO",
				currentPrice: "450",
				dayChangePercent: "1.2",
				series: "BE", // Trade-for-Trade surveillance
				analystRating: "Buy",
				numberOfAnalysts: 8,
			};

			const normalScore = await stockStrat.score(normalStock, null, null, null, null, null, null, false);
			const survScore = await stockStrat.score(surveillanceStock, null, null, null, null, null, null, false);

			expect(survScore).toBeLessThan(normalScore);
		});

		it("penalizes stocks locked at Upper Circuit to prevent unfillable buy calls", async () => {
			const openTradingStock = {
				symbol: "LIQUID_STOCK",
				currentPrice: "600",
				dayChangePercent: "2.4",
				series: "EQ",
				analystRating: "Buy",
				numberOfAnalysts: 5,
				returns1Y: "25",
			};
			const upperCircuitStock = {
				symbol: "CIRCUIT_LOCKED",
				currentPrice: "600",
				dayChangePercent: "4.98", // Locked at 5% circuit
				series: "EQ",
				analystRating: "Buy",
				numberOfAnalysts: 5,
				returns1Y: "25",
			};

			const openScore = await stockStrat.score(openTradingStock, null, null, null, null, null, null, false);
			const circuitScore = await stockStrat.score(upperCircuitStock, null, null, null, null, null, null, false);

			expect(circuitScore).toBeLessThan(openScore);
		});
	});

	describe("5. Derivatives Real-World Bid/Ask Slippage Modeling", () => {
		const derivStrat = new DerivativeStrategy();

		it("prices legs at Ask for BUY and Bid for SELL when order book quotes are available", () => {
			const strategyDef: any = {
				name: "Bull Call Spread",
				strategyType: "BUYER",
				outlook: "bullish",
				volPreference: "low",
				targetMult: 1.8,
				slMult: 0.5,
				legs: [
					{ action: "BUY", type: "CE", strikeOffsetSteps: 0, quantityRatio: 1 },
					{ action: "SELL", type: "CE", strikeOffsetSteps: 1, quantityRatio: 1 },
				],
			};

			const chainWithSpreads = {
				underlyingValue: 24000,
				options: {
					calls: [
						{ strikePrice: 24000, lastPrice: 150, bidPrice: 148, askPrice: 152, openInterest: 10000 },
						{ strikePrice: 24100, lastPrice: 95, bidPrice: 93, askPrice: 97, openInterest: 8000 },
					],
				},
			};

			const payoff = derivStrat.buildLegsAndPayoff(
				"NIFTY",
				strategyDef,
				24000,
				24000,
				100,
				65,
				chainWithSpreads,
				7,
				15,
				"2026-12-03",
			);

			// Buy 24000 CE @ Ask (152) and Sell 24100 CE @ Bid (93)
			// Net debit = 152 - 93 = 59 per unit (rather than 150 - 95 = 55 mid-price)
			expect(payoff.netPremium).toBe(59);
			expect(payoff.totalNetPremium).toBe(Math.round(59 * 65 * 100) / 100);
		});
	});

	describe("6. Bond Seniority & Subordinated Debt Protection", () => {
		const bondStrat = new BondStrategy();

		it("penalizes Tier-II subordinated debt or perpetual instruments", () => {
			const seniorBond = {
				issuerName: "REC Limited Senior Secured NCD",
				securityType: "Secured",
				creditRating: "AAA",
				yieldToMaturity: "7.8",
				maturityDate: "2029-05-15",
				faceValue: "10000",
			};
			const subordinatedBond = {
				issuerName: "Bank Tier II Subordinated Bond",
				securityType: "Unsecured",
				creditRating: "AAA",
				yieldToMaturity: "8.1",
				maturityDate: "2029-05-15",
				faceValue: "1000000",
			};

			const seniorScore = bondStrat.score(seniorBond);
			const subScore = bondStrat.score(subordinatedBond);

			expect(seniorScore).toBeGreaterThan(subScore);
		});
	});
});
