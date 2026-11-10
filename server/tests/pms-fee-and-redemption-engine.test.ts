/**
 * @file pms-fee-and-redemption-engine.test.ts
 * @description Comprehensive unit tests for PMS Multi-Option Fee Structures, High Water Mark (HWM)
 *              Crystallization, and SEBI Redemption Exit Load / Residual Floor Engine.
 *
 * @compliance GCR v1.0 / FASP-AI v3.1
 */

import { describe, it, expect } from "vitest";
import {
  pmsFeeAndRedemptionEngine,
  PMS_FEE_OPTIONS,
} from "../services/pms-fee-and-redemption-engine";
import { pmsComplianceService } from "../services/pms-compliance-service";

describe("PMS Fee Structures, HWM Crystallization & Redemption Engine", () => {
  describe("The 4 Regulatory Fee Options", () => {
    it("should provide profiles for all 4 distinct fee models", () => {
      const options = pmsFeeAndRedemptionEngine.getFeeOptions();
      expect(options).toHaveLength(4);

      const ids = options.map((o) => o.id);
      expect(ids).toContain("FIXED_ONLY");
      expect(ids).toContain("HYBRID_BALANCED");
      expect(ids).toContain("PURE_PERFORMANCE");
      expect(ids).toContain("ADVISORY_UPSTOX_DIRECT");
    });

    it("should configure Option 1 (Fixed Only) with 2% fixed and 0% carry", () => {
      const opt = PMS_FEE_OPTIONS.FIXED_ONLY;
      expect(opt.fixedManagementFeePct).toBe(2.0);
      expect(opt.performanceFeePct).toBe(0);
      expect(opt.hurdleRatePct).toBe(0);
      expect(opt.highWaterMarkMandatory).toBe(false);
    });

    it("should configure Option 2 (Hybrid) with 1% fixed, 10% hurdle, 15% carry, and HWM", () => {
      const opt = PMS_FEE_OPTIONS.HYBRID_BALANCED;
      expect(opt.fixedManagementFeePct).toBe(1.0);
      expect(opt.hurdleRatePct).toBe(10.0);
      expect(opt.performanceFeePct).toBe(15.0);
      expect(opt.highWaterMarkMandatory).toBe(true);
    });

    it("should configure Option 3 (Pure Performance) with 0% fixed, 8% hurdle, 20% carry, and HWM", () => {
      const opt = PMS_FEE_OPTIONS.PURE_PERFORMANCE;
      expect(opt.fixedManagementFeePct).toBe(0.0);
      expect(opt.hurdleRatePct).toBe(8.0);
      expect(opt.performanceFeePct).toBe(20.0);
      expect(opt.highWaterMarkMandatory).toBe(true);
    });

    it("should configure Option 4 (Upstox Direct Segregated Demat) with 2.0% management fee and 0 bps custody", () => {
      const opt = PMS_FEE_OPTIONS.ADVISORY_UPSTOX_DIRECT;
      expect(opt.fixedManagementFeePct).toBe(2.0);
      expect(opt.custodyModel).toBe("UPSTOX_DIRECT_0_BPS");
      expect(opt.brokerageModel).toBe("FLAT_20_INR");
      expect(opt.performanceFeePct).toBe(0);
    });
  });

  describe("High Water Mark (HWM) Performance Fee Crystallization", () => {
    it("should charge ZERO performance fee if current NAV is below historical HWM (Drawdown regime)", () => {
      const result = pmsFeeAndRedemptionEngine.calculateHwmPerformanceFee({
        startingNav: 100,
        currentNav: 110,
        highWaterMarkNav: 115, // Historical peak is 115, current is only 110
        hurdleRatePct: 10,
        performanceFeePct: 15,
        holdingPeriodDays: 365,
        portfolioAmount: 50_00_000,
      });

      expect(result.isEligibleForPerformanceFee).toBe(false);
      expect(result.hwmExceeded).toBe(false);
      expect(result.totalPerformanceFeeAmount).toBe(0);
      expect(result.newHighWaterMarkNav).toBe(115); // HWM remains at 115
    });

    it("should charge ZERO performance fee if current NAV is above HWM but below Hurdle Rate", () => {
      const result = pmsFeeAndRedemptionEngine.calculateHwmPerformanceFee({
        startingNav: 100,
        currentNav: 108, // 8% return
        highWaterMarkNav: 105, // Above HWM (105)
        hurdleRatePct: 10, // But below 10% Hurdle (110)
        performanceFeePct: 15,
        holdingPeriodDays: 365,
        portfolioAmount: 50_00_000,
      });

      expect(result.isEligibleForPerformanceFee).toBe(false);
      expect(result.hwmExceeded).toBe(true);
      expect(result.hurdleExceeded).toBe(false);
      expect(result.totalPerformanceFeeAmount).toBe(0);
    });

    it("should calculate exact performance fee and reset HWM when NAV exceeds both HWM and Hurdle", () => {
      // ₹50L starting at NAV 100 = 50,000 units. Current NAV 120 (20% return).
      // Hurdle is 10% (NAV 110). Historical HWM is 105.
      // Effective threshold = Max(105, 110) = 110.
      // Excess alpha = 120 - 110 = 10/unit.
      // Total excess gain = 10 * 50,000 units = ₹5,00,000.
      // Performance fee at 15% = 15% of ₹5,00,000 = ₹75,000.
      const result = pmsFeeAndRedemptionEngine.calculateHwmPerformanceFee({
        startingNav: 100,
        currentNav: 120,
        highWaterMarkNav: 105,
        hurdleRatePct: 10,
        performanceFeePct: 15,
        holdingPeriodDays: 365,
        portfolioAmount: 50_00_000,
      });

      expect(result.isEligibleForPerformanceFee).toBe(true);
      expect(result.hwmExceeded).toBe(true);
      expect(result.hurdleExceeded).toBe(true);
      expect(result.excessAlphaPerUnit).toBe(10);
      expect(result.totalPerformanceFeeAmount).toBe(75_000);
      expect(result.newHighWaterMarkNav).toBe(120); // Resets HWM to new peak of 120
      expect(result.netNavPostFee).toBeCloseTo(118.5, 1);
    });
  });

  describe("Fee Simulation Engine", () => {
    it("should simulate net returns across all 4 options for ₹50L portfolio with 20% gain", () => {
      const simulations = pmsFeeAndRedemptionEngine.simulateFeeOptions({
        portfolioAmount: 50_00_000,
        expectedGrossReturnPct: 20, // ₹10,00,000 gross gains
        holdingPeriodDays: 365,
        annualTrades: 60,
      });

      expect(simulations).toHaveLength(4);

      const fixedOpt = simulations.find((s) => s.optionId === "FIXED_ONLY");
      const hybridOpt = simulations.find((s) => s.optionId === "HYBRID_BALANCED");
      const pureOpt = simulations.find((s) => s.optionId === "PURE_PERFORMANCE");

      expect(fixedOpt!.fixedFee).toBe(100_000); // 2% of 50L
      expect(fixedOpt!.performanceFee).toBe(0);

      expect(hybridOpt!.fixedFee).toBe(50_000); // 1% of 50L
      expect(hybridOpt!.performanceFee).toBe(75_000); // 15% of (10L - 5L hurdle)

      expect(pureOpt!.fixedFee).toBe(0); // 0%
      expect(pureOpt!.performanceFee).toBe(120_000); // 20% of (10L - 4L hurdle)

      expect(simulations.every((s) => s.netProfitToInvestor > 0)).toBe(true);
    });
  });

  describe("Redemption Exit Load & Residual Floor Verification", () => {
    it("should strictly reject partial redemption if residual portfolio value drops below ₹50 Lakhs", () => {
      // Portfolio value is ₹60L, client requests ₹25L -> Residual is ₹35L (below ₹50L floor!)
      const quote = pmsFeeAndRedemptionEngine.calculateRedemptionQuote({
        currentPortfolioValue: 60_00_000,
        requestedWithdrawalAmount: 25_00_000,
        holdingPeriodDays: 180,
        settlementMode: "CASH_LIQUIDATION",
      });

      expect(quote.isPermitted).toBe(false);
      expect(quote.sebiResidualFloorSatisfied).toBe(false);
      expect(quote.residualPortfolioValue).toBe(35_00_000);
      expect(quote.rejectionReason).toContain("below the mandatory statutory floor of ₹50,00,000");
    });

    it("should permit partial redemption if residual portfolio value remains >= ₹50 Lakhs", () => {
      // Portfolio value is ₹80L, client requests ₹20L -> Residual is ₹60L (>= ₹50L)
      const quote = pmsFeeAndRedemptionEngine.calculateRedemptionQuote({
        currentPortfolioValue: 80_00_000,
        requestedWithdrawalAmount: 20_00_000,
        holdingPeriodDays: 200,
        settlementMode: "CASH_LIQUIDATION",
      });

      expect(quote.isPermitted).toBe(true);
      expect(quote.sebiResidualFloorSatisfied).toBe(true);
      expect(quote.residualPortfolioValue).toBe(60_00_000);
      expect(quote.exitLoadTier).toBe("YEAR_1");
      expect(quote.exitLoadPct).toBe(2.5); // Year 1 exit load
      expect(quote.exitLoadAmount).toBe(50_000); // 2.5% of 20L
      expect(quote.netPayoutAmount).toBe(19_50_000);
    });

    it("should permit FULL redemption even when residual value is 0", () => {
      // Client withdraws full ₹55 Lakhs
      const quote = pmsFeeAndRedemptionEngine.calculateRedemptionQuote({
        currentPortfolioValue: 55_00_000,
        requestedWithdrawalAmount: 55_00_000,
        holdingPeriodDays: 400, // Year 2
        settlementMode: "CASH_LIQUIDATION",
      });

      expect(quote.isPermitted).toBe(true);
      expect(quote.isPartialWithdrawal).toBe(false);
      expect(quote.residualPortfolioValue).toBe(0);
      expect(quote.exitLoadTier).toBe("YEAR_2");
      expect(quote.exitLoadPct).toBe(1.5); // Year 2 exit load
      expect(quote.exitLoadAmount).toBe(82_500); // 1.5% of 55L
    });

    it("should apply 0% exit load after 3 years (Day 1096+)", () => {
      const quote = pmsFeeAndRedemptionEngine.calculateRedemptionQuote({
        currentPortfolioValue: 70_00_000,
        requestedWithdrawalAmount: 15_00_000,
        holdingPeriodDays: 1200, // Year 4+
        settlementMode: "CASH_LIQUIDATION",
      });

      expect(quote.isPermitted).toBe(true);
      expect(quote.exitLoadTier).toBe("YEAR_4_PLUS");
      expect(quote.exitLoadPct).toBe(0.0);
      expect(quote.exitLoadAmount).toBe(0);
      expect(quote.netPayoutAmount).toBe(15_00_000);
    });
  });

  describe("SEBI Compliance Gate Remedies (Form C 48h Cooling Lock & Associate Caps)", () => {
    it("should breach Schedule V if Form C was delivered less than 48 hours ago", async () => {
      // Delivered 24 hours ago
      const delivered24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const report = await pmsComplianceService.auditPmsCompliance({
        userId: "test_pms_comp_01",
        investmentAmount: 50_00_000,
        pmsName: "FintekPro Multi-Cap PMS",
        executionType: "non_discretionary",
        formCAcknowledged: true,
        formCDeliveredAt: delivered24hAgo,
      });

      expect(report.isCompliant).toBe(false);
      expect(report.breaches.some((b) => b.includes("Form C 48-Hour Cooling Period Breach"))).toBe(true);
      const coolingCheck = report.checks.find((c) => c.ruleId === "SEBI-PMS-SCHED-V");
      expect(coolingCheck?.status).toBe("BREACH");
    });

    it("should pass Schedule V when Form C cooling period >= 48 hours is observed", async () => {
      // Delivered 72 hours ago
      const delivered72hAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const report = await pmsComplianceService.auditPmsCompliance({
        userId: "test_pms_comp_02",
        investmentAmount: 50_00_000,
        pmsName: "FintekPro Multi-Cap PMS",
        executionType: "non_discretionary",
        formCAcknowledged: true,
        formCDeliveredAt: delivered72hAgo,
      });

      const coolingCheck = report.checks.find((c) => c.ruleId === "SEBI-PMS-SCHED-V");
      expect(coolingCheck?.status).toBe("PASS");
    });

    it("should breach Regulation 24(4) if associate stock exposure exceeds 15% without client consent", async () => {
      const report = await pmsComplianceService.auditPmsCompliance({
        userId: "test_pms_comp_03",
        investmentAmount: 50_00_000,
        pmsName: "FintekPro Multi-Cap PMS",
        executionType: "non_discretionary",
        formCAcknowledged: true,
        associateSecuritiesExposurePct: 20, // 20% exposure
        priorWrittenConsentProvided: false, // No consent
      });

      expect(report.isCompliant).toBe(false);
      expect(report.breaches.some((b) => b.includes("requires prior written client consent"))).toBe(true);
    });

    it("should pass Regulation 24(4) if associate stock exposure is 20% with explicit prior written consent", async () => {
      const report = await pmsComplianceService.auditPmsCompliance({
        userId: "test_pms_comp_04",
        investmentAmount: 50_00_000,
        pmsName: "FintekPro Multi-Cap PMS",
        executionType: "non_discretionary",
        formCAcknowledged: true,
        associateSecuritiesExposurePct: 20,
        priorWrittenConsentProvided: true, // Has written consent
      });

      const assocCheck = report.checks.find((c) => c.ruleId === "SEBI-PMS-REG-24");
      expect(assocCheck?.status).toBe("PASS");
    });

    it("should strictly breach Regulation 24(4) if associate stock exposure exceeds absolute 25% statutory cap", async () => {
      const report = await pmsComplianceService.auditPmsCompliance({
        userId: "test_pms_comp_05",
        investmentAmount: 50_00_000,
        pmsName: "FintekPro Multi-Cap PMS",
        executionType: "non_discretionary",
        formCAcknowledged: true,
        associateSecuritiesExposurePct: 30, // 30% breaches 25% hard cap
        priorWrittenConsentProvided: true,
      });

      expect(report.isCompliant).toBe(false);
      expect(report.breaches.some((b) => b.includes("breaches the absolute statutory cap of 25%"))).toBe(true);
    });
  });
});

