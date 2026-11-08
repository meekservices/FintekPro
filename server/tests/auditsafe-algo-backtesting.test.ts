/**
 * @file auditsafe-algo-backtesting.test.ts
 * @description Comprehensive test suite verifying that FintekPro's backtesting and algo trading engine
 * is production-ready, friction-aware, and audit-safe under SEBI and global regulatory standards.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	algoBacktestEngine,
	algoSignalEngine,
	type AlgoBacktestConfig,
} from "../services/algo-signal-engine";
import { riskEngine } from "../services/compliance/riskEngine";
import { upstoxReconciliationService } from "../services/upstox-reconciliation-service";

describe("Audit-Safe Algo Trading Backtesting Engine (SEBI Regulatory Compliance)", () => {
	const baseIndianConfig: AlgoBacktestConfig = {
		symbol: "RELIANCE",
		startDate: "2023-01-01",
		endDate: "2024-01-01",
		riskProfile: "moderate",
		initialCapital: 100000, // ₹1,00,000
		strategy: "composite",
		market: "IN",
		currency: "INR",
		includeFriction: true,
	};

	beforeEach(() => {
		// Reset kill switches before each test
		riskEngine.deactivateGlobalKillSwitch("test-reset");
		riskEngine.deactivateUserKillSwitch("user-test-1");
	});

	afterEach(() => {
		riskEngine.deactivateGlobalKillSwitch("test-reset");
		riskEngine.deactivateUserKillSwitch("user-test-1");
	});

	describe("1. Regulatory Friction-Aware Simulation (SEBI Code of Conduct Mandate)", () => {
		it("models statutory frictions (STT, GST, Exchange charges, Brokerage & Slippage) so Net Return reflects realistic costs", async () => {
			const report = await algoBacktestEngine.runBacktest({
				...baseIndianConfig,
				symbol: "TCS",
				includeFriction: true,
				slippagePct: 0.0005,
			});

			expect(report).toBeDefined();
			expect(report.symbol).toBe("TCS");
			expect(report.market).toBe("IN");
			expect(report.currency).toBe("INR");
			expect(report.summary.totalTrades).toBeGreaterThanOrEqual(1);

			// Friction breakdown must be itemized
			const frictions = report.summary.frictionBreakdown;
			expect(frictions).toBeDefined();
			expect(typeof frictions.totalBrokerage).toBe("number");
			expect(typeof frictions.totalStt).toBe("number");
			expect(typeof frictions.totalExchangeFees).toBe("number");
			expect(typeof frictions.totalGst).toBe("number");
			expect(typeof frictions.totalSlippage).toBe("number");
			expect(report.summary.totalFrictionDeducted).toBeGreaterThan(0);

			// Net total return must account for friction
			if (report.summary.totalTrades > 0) {
				expect(report.summary.totalReturn).toBeLessThanOrEqual(report.summary.grossTotalReturn);
			}

			// Individual trade ledger must contain statutory charges breakdown
			const firstTrade = report.trades[0];
			expect(firstTrade.chargesBreakdown).toBeDefined();
			expect(firstTrade.chargesBreakdown.stt).toBeGreaterThanOrEqual(0);
			expect(firstTrade.chargesBreakdown.slippage).toBeGreaterThanOrEqual(0);
		});

		it("correctly simulates US markets with USD currency and SEC/FINRA assumptions", async () => {
			const usReport = await algoBacktestEngine.runBacktest({
				symbol: "AAPL",
				startDate: "2023-01-01",
				endDate: "2024-01-01",
				riskProfile: "moderate",
				initialCapital: 10000, // $10,000
				strategy: "sma_crossover",
				market: "US",
				currency: "USD",
			});

			expect(usReport).toBeDefined();
			expect(usReport.market).toBe("US");
			expect(usReport.currency).toBe("USD");
			expect(usReport.summary.totalBars).toBeGreaterThan(100);
		});
	});

	describe("2. Financial Determinism & Cryptographic Traceability (GCR §3.2 Mandate)", () => {
		it("guarantees identical input parameters produce identical inputsHash and metrics every time", async () => {
			const runA = await algoBacktestEngine.runBacktest(baseIndianConfig);
			const runB = await algoBacktestEngine.runBacktest(baseIndianConfig);

			expect(runA.inputsHash).toBe(runB.inputsHash);
			expect(runA.summary.totalTrades).toBe(runB.summary.totalTrades);
			expect(runA.summary.winRate).toBe(runB.summary.winRate);
			expect(runA.summary.totalReturn).toBe(runB.summary.totalReturn);
			expect(runA.summary.cagr).toBe(runB.summary.cagr);
			expect(runA.summary.sharpeRatio).toBe(runB.summary.sharpeRatio);
			expect(runA.summary.maxDrawdown).toBe(runB.summary.maxDrawdown);
			expect(runA.equityCurve.length).toBe(runB.equityCurve.length);
		});

		it("generates a distinct inputsHash when any parameter changes", async () => {
			const runA = await algoBacktestEngine.runBacktest(baseIndianConfig);
			const runB = await algoBacktestEngine.runBacktest({
				...baseIndianConfig,
				initialCapital: 200000,
			});

			expect(runA.inputsHash).not.toBe(runB.inputsHash);
		});
	});

	describe("3. SEBI Statutory Disclaimers & Governance Standards", () => {
		it("attaches required regulatory disclaimers explicitly stating hypothetical nature and no return guarantee", async () => {
			const report = await algoBacktestEngine.runBacktest(baseIndianConfig);

			expect(report.engineVersion).toContain("FintekPro-AlgoBacktest");
			expect(report.regulatoryDisclaimers).toBeDefined();
			expect(report.regulatoryDisclaimers.length).toBeGreaterThanOrEqual(3);

			const allDisclaimers = report.regulatoryDisclaimers.join(" ");
			expect(allDisclaimers).toContain("HYPOTHETICAL");
			expect(allDisclaimers).toContain("NO GUARANTEE OF RETURNS");
			expect(allDisclaimers).toContain("DECISION SUPPORT SYSTEM");
			expect(allDisclaimers).toContain("STATUTORY FRICTION");
		});
	});

	describe("4. Pre-Trade Risk Management System (RMS) & Emergency Kill Switches", () => {
		it("passes pre-trade risk evaluation within normal boundaries", async () => {
			const res = await riskEngine.evaluatePreTradeRisk({
				userId: "user-test-1",
				symbol: "RELIANCE",
				notionalValue: 50000,
				currentPositionValue: 100000,
				dailyTradeCount: 5,
				currency: "INR",
				price: 2850,
				referencePrice: 2840,
			});

			expect(res.approved).toBe(true);
			expect(res.checksPassed).toContain("GLOBAL_KILL_SWITCH_CLEAR");
			expect(res.checksPassed).toContain("SINGLE_ORDER_VALUE_OK");
			expect(res.checksPassed).toContain("CIRCUIT_FILTER_OK");
		});

		it("blocks orders exceeding single order value limit (Fat-finger protection)", async () => {
			await expect(
				riskEngine.evaluatePreTradeRisk({
					userId: "user-test-1",
					symbol: "RELIANCE",
					notionalValue: 1500000, // ₹15,00,000 exceeds ₹10,00,000 limit
					currency: "INR",
				}),
			).rejects.toThrow("Single order notional of INR 1,500,000 exceeds maximum permitted order limit");
		});

		it("blocks orders violating circuit limit price deviation band", async () => {
			await expect(
				riskEngine.evaluatePreTradeRisk({
					userId: "user-test-1",
					symbol: "RELIANCE",
					notionalValue: 50000,
					currency: "INR",
					price: 3500, // +25% above 2800 reference price (>15% band)
					referencePrice: 2800,
				}),
			).rejects.toThrow("PRICE_BAND_VIOLATION");
		});

		it("enforces Global Emergency Kill Switch across all desks", async () => {
			riskEngine.activateGlobalKillSwitch("SEBI emergency market-wide volatility halt", "compliance-officer");
			expect(riskEngine.getGlobalKillSwitchStatus().active).toBe(true);

			await expect(
				riskEngine.evaluatePreTradeRisk({
					userId: "user-test-1",
					symbol: "INFY",
					notionalValue: 50000,
					currency: "INR",
				}),
			).rejects.toThrow("GLOBAL_KILL_SWITCH_ACTIVE");
		});

		it("enforces User-Level Emergency Kill Switch to immediately protect client capital", async () => {
			riskEngine.activateUserKillSwitch("user-test-1", "Client self-defense emergency pause");
			expect(riskEngine.getUserKillSwitchStatus("user-test-1").active).toBe(true);

			await expect(
				riskEngine.evaluatePreTradeRisk({
					userId: "user-test-1",
					symbol: "TCS",
					notionalValue: 20000,
					currency: "INR",
				}),
			).rejects.toThrow("USER_KILL_SWITCH_ACTIVE");

			// Deactivating user kill switch allows trading to resume
			riskEngine.deactivateUserKillSwitch("user-test-1");
			const retry = await riskEngine.evaluatePreTradeRisk({
				userId: "user-test-1",
				symbol: "TCS",
				notionalValue: 20000,
				currency: "INR",
			});
			expect(retry.approved).toBe(true);
		});

		it("provides full Regulatory Compliance Audit Manifest for SEBI inspection", () => {
			const manifest = riskEngine.getRegulatoryComplianceStatus();
			expect(manifest.framework).toBe("SEBI_ALGO_TRADING_CIRCULAR_2024");
			expect(manifest.decisionSupportOnly).toBe(true);
			expect(manifest.autonomousExecutionAllowed).toBe(false);
			expect(manifest.riskLimits.maxSingleOrderInr).toBe(1000000);
			expect(manifest.riskLimits.maxPriceDeviationBandPct).toBe(15);
		});

		it("enforces SEBI 365-day risk profile validity (rejects expired risk assessments)", async () => {
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 380); // 380 days ago (> 365 days)

			await expect(
				riskEngine.evaluatePreTradeRisk({
					userId: "user-test-1",
					symbol: "RELIANCE",
					notionalValue: 50000,
					currency: "INR",
					riskProfileAssessmentDate: expiredDate.toISOString(),
				}),
			).rejects.toThrow("SEBI_RISK_PROFILE_EXPIRED");

			// Valid recent assessment passes
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 30); // 30 days ago (< 365 days)
			const validCheck = await riskEngine.evaluatePreTradeRisk({
				userId: "user-test-1",
				symbol: "RELIANCE",
				notionalValue: 50000,
				currency: "INR",
				riskProfileAssessmentDate: recentDate.toISOString(),
			});
			expect(validCheck.approved).toBe(true);
			expect(validCheck.checksPassed).toContain("RISK_PROFILE_VALIDITY_OK");
		});
	});

	describe("5. Post-Trade Demat Reconciliation (Upstox EOD Order & Position Audit)", () => {
		it("runs End-of-Day trade reconciliation and produces a structured audit report", async () => {
			const eodReport = await upstoxReconciliationService.runEODReconciliation();
			expect(eodReport).toBeDefined();
			expect(eodReport.id).toContain("EOD-UPSTOX");
			expect(eodReport.exchange).toBe("NSE");
			expect(["SUCCESS", "WARNING", "FAILED"]).toContain(eodReport.status);
			expect(Array.isArray(eodReport.discrepancies)).toBe(true);
		});
	});
});

