/**
 * @file multi-asset-custody-orchestrator.test.ts
 * @description Comprehensive unit tests for Multi-Asset Custody & Execution Orchestrator.
 *
 * Verifies:
 * 1. Mutual Funds order routing via Upstox MF / ICCL
 * 2. PMS SEBI Regulation 23(2) statutory minimum enforcement (₹50 Lakhs floor)
 * 3. PMS non-discretionary routing (Upstox direct segregated Demat with 0 bps custody fee)
 * 4. PMS discretionary routing (Hybrid Upstox execution + Orbis institutional CP clearing)
 * 5. AIF SEBI Regulation 10(c) statutory minimum enforcement (₹1 Crore floor)
 * 6. AIF Category III routing (Upstox institutional OMS + Orbis trust custody)
 * 7. AIF Category I/II routing (Trust Escrow & 4-tier waterfall tracking)
 * 8. Comparative Economics Engine (Upstox vs Orbis vs Tier-1 Bank Custodians)
 * 9. UpstoxAdapter expanded capabilities ("MF", "PMS")
 *
 * @compliance GCR v1.0 / FASP-AI v3.1
 */

import { describe, it, expect, vi } from "vitest";
import {
  multiAssetCustodyOrchestrator,
  CUSTODY_PROVIDERS,
} from "../services/multi-asset-custody-orchestrator";
import { upstoxAdapter } from "../services/mpal/adapters/upstoxAdapter";

describe("Multi-Asset Custody & Execution Orchestrator", () => {
  describe("Provider Profiles & Capabilities", () => {
    it("should register Upstox with 0 bps custody fee and active primary status", () => {
      const upstox = CUSTODY_PROVIDERS.UPSTOX;
      expect(upstox).toBeDefined();
      expect(upstox.assetBasedFeeBps).toBe(0);
      expect(upstox.minimumAnnualFeeInr).toBe(0);
      expect(upstox.brokeragePerOrderInr).toBe(20);
      expect(upstox.fintekProStatus).toBe("ACTIVE_PRIMARY");
    });

    it("should register Orbis Financial with 4 bps custody fee and low annual floor", () => {
      const orbis = CUSTODY_PROVIDERS.ORBIS_FINANCIAL;
      expect(orbis).toBeDefined();
      expect(orbis.assetBasedFeeBps).toBe(4);
      expect(orbis.minimumAnnualFeeInr).toBe(250_000);
      expect(orbis.role).toBe("INSTITUTIONAL_CUSTODIAN");
    });

    it("should verify UpstoxAdapter includes MF and PMS capabilities", () => {
      expect(upstoxAdapter.capabilities).toContain("MF");
      expect(upstoxAdapter.capabilities).toContain("PMS");
      expect(upstoxAdapter.capabilities).toContain("EQUITY_IN");
      expect(upstoxAdapter.capabilities).toContain("FNO");
    });
  });

  describe("Mutual Funds Routing Desk", () => {
    it("should route MF orders to ICCL settlement when requested", async () => {
      const result = await multiAssetCustodyOrchestrator.routeMutualFundOrder({
        userId: "test_user_01",
        isin: "INF200K01RK2",
        fundName: "SBI Nifty 50 Index Fund Direct-Growth",
        amount: 25000,
        transactionType: "BUY",
        preferredGateway: "ICCL",
      });

      expect(result.success).toBe(true);
      expect(result.route).toBe("ICCL_SETTLEMENT");
      expect(result.custodyFeeBps).toBe(0);
      expect(result.message).toContain("Zero intermediary pooling");
    });

    it("should strictly reject MF redemption when 2FA OTP is not verified (SEBI Mandate)", async () => {
      const result = await multiAssetCustodyOrchestrator.routeMutualFundOrder({
        userId: "test_user_02a",
        isin: "INF109K012R6",
        fundName: "ICICI Prudential Bluechip Fund Direct-Growth",
        amount: 50000,
        transactionType: "SELL",
        twoFactorOtpVerified: false, // 2FA not verified!
      });

      expect(result.success).toBe(false);
      expect(result.twoFactorVerified).toBe(false);
      expect(result.message).toContain("SEBI 2FA Mandate Breach");
    });

    it("should assign T+1 next day NAV realization when order timestamp is past cut-off", async () => {
      // 16:30 IST (4:30 PM) is past the 3:00 PM equity cut-off
      const pastCutoffTime = new Date("2026-11-10T11:00:00.000Z"); // 16:30 IST
      const result = await multiAssetCustodyOrchestrator.routeMutualFundOrder({
        userId: "test_user_02b",
        isin: "INF109K012R6",
        fundName: "ICICI Prudential Bluechip Fund Direct-Growth",
        amount: 25000,
        transactionType: "BUY",
        orderTimestamp: pastCutoffTime,
      });

      expect(result.success).toBe(true);
      expect(result.cutOffStatus).toBe("PAST_CUTOFF");
      expect(result.navRealizationExpected).toBe("T+1_NEXT_DAY");
      expect(result.message).toContain("T+1 business day");
    });
  });

  describe("PMS Routing Desk (SEBI Regulation 23(2))", () => {
    it("should strictly reject PMS orders below statutory minimum of ₹50 Lakhs", async () => {
      const result = await multiAssetCustodyOrchestrator.routePmsOrder({
        userId: "test_user_03",
        pmsName: "FintekPro Alpha Momentum PMS",
        investmentAmount: 45_00_000, // ₹45L - Under the ₹50L floor!
        executionModel: "non_discretionary",
        formCAcknowledged: true,
      });

      expect(result.success).toBe(false);
      expect(result.statutoryMinSatisfied).toBe(false);
      expect(result.message).toContain("Breach of SEBI (Portfolio Managers) Regulations, 2020 Reg 23(2)");
      expect(result.message).toContain("₹50,00,000");
    });

    it("should route compliant Non-Discretionary PMS to Upstox Direct Segregated Demat (0 bps custody)", async () => {
      const result = await multiAssetCustodyOrchestrator.routePmsOrder({
        userId: "test_user_04",
        pmsName: "FintekPro Bluechip Yield PMS",
        investmentAmount: 50_00_000, // Exactly ₹50L statutory floor
        executionModel: "non_discretionary",
        formCAcknowledged: true,
      });

      expect(result.success).toBe(true);
      expect(result.statutoryMinSatisfied).toBe(true);
      expect(result.route).toBe("UPSTOX_DIRECT_DEMAT");
      expect(result.annualCustodyFeeBps).toBe(0);
      expect(result.executingBroker).toContain("Upstox");
      expect(result.custodian).toContain("Upstox CDSL");
    });

    it("should route Discretionary PMS to Hybrid Upstox Execution + Orbis Custody (CP Code)", async () => {
      const result = await multiAssetCustodyOrchestrator.routePmsOrder({
        userId: "test_user_05",
        pmsName: "FintekPro High Alpha Multi-Cap PMS",
        investmentAmount: 1_00_00_000, // ₹1 Crore
        executionModel: "discretionary",
        formCAcknowledged: true,
      });

      expect(result.success).toBe(true);
      expect(result.statutoryMinSatisfied).toBe(true);
      expect(result.route).toBe("HYBRID_UPSTOX_ORBIS");
      expect(result.annualCustodyFeeBps).toBe(4);
      expect(result.executingBroker).toContain("Upstox API v2");
      expect(result.custodian).toContain("Orbis Financial");
    });
  });

  describe("AIF Routing Desk (SEBI Regulation 10(c))", () => {
    it("should reject AIF allocations below statutory commitment of ₹1 Crore for standard investors", async () => {
      const result = await multiAssetCustodyOrchestrator.routeAifOrder({
        userId: "test_user_06",
        aifCategory: "CAT_II",
        fundName: "FintekPro Private Credit Fund II",
        committedCapital: 75_00_000, // ₹75 Lakhs - Under ₹1 Cr floor!
        initialDrawdownAmount: 15_00_000,
        isAccreditedInvestor: false,
      });

      expect(result.success).toBe(false);
      expect(result.statutoryCommitmentSatisfied).toBe(false);
      expect(result.message).toContain("Breach of SEBI (AIF) Regulations, 2012 Reg 10(c)");
      expect(result.message).toContain("100 Lakhs");
    });

    it("should permit lower commitment if investor is certified Accredited Investor", async () => {
      const result = await multiAssetCustodyOrchestrator.routeAifOrder({
        userId: "test_user_07",
        aifCategory: "CAT_II",
        fundName: "FintekPro Private Credit Fund II",
        committedCapital: 50_00_000,
        initialDrawdownAmount: 10_00_000,
        isAccreditedInvestor: true,
      });

      expect(result.success).toBe(true);
      expect(result.statutoryCommitmentSatisfied).toBe(true);
      expect(result.route).toBe("AIF_CAT1_CAT2_ESCROW");
    });

    it("should route Category III AIF to Upstox Institutional OMS + Orbis Trust Units", async () => {
      const result = await multiAssetCustodyOrchestrator.routeAifOrder({
        userId: "test_user_08",
        aifCategory: "CAT_III",
        fundName: "FintekPro Market Neutral Long-Short AIF",
        committedCapital: 2_00_00_000, // ₹2 Crores
        initialDrawdownAmount: 50_00_000,
      });

      expect(result.success).toBe(true);
      expect(result.statutoryCommitmentSatisfied).toBe(true);
      expect(result.route).toBe("AIF_CAT3_UPSTOX_ORBIS");
      expect(result.executingBroker).toContain("Upstox Institutional");
      expect(result.custodian).toContain("Orbis Financial");
    });

    it("should reject AIF concession if Accredited Investor certificate has expired", async () => {
      const expiredDate = new Date("2025-01-01"); // Expired in past
      const result = await multiAssetCustodyOrchestrator.routeAifOrder({
        userId: "test_user_08a",
        aifCategory: "CAT_II",
        fundName: "FintekPro Private Credit Fund II",
        committedCapital: 50_00_000,
        initialDrawdownAmount: 10_00_000,
        isAccreditedInvestor: true,
        accreditationValidUntil: expiredDate,
      });

      expect(result.success).toBe(false);
      expect(result.statutoryCommitmentSatisfied).toBe(false);
      expect(result.message).toContain("Accredited Investor certification expired");
    });

    it("should reject Category III AIF order if gross leverage exceeds statutory 200% NAV (2.0x)", async () => {
      const result = await multiAssetCustodyOrchestrator.routeAifOrder({
        userId: "test_user_08b",
        aifCategory: "CAT_III",
        fundName: "FintekPro Market Neutral Long-Short AIF",
        committedCapital: 2_00_00_000,
        initialDrawdownAmount: 50_00_000,
        grossLeverageRatio: 2.25, // 225% leverage breaches 200% ceiling!
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("breaching the statutory ceiling of 200% NAV (2.0x)");
    });
  });

  describe("PMLA Third-Party Payment Prevention Engine", () => {
    it("should reject payments originating from non-whitelisted bank accounts", async () => {
      const check = await multiAssetCustodyOrchestrator.validateRemitterAccount({
        userId: "test_user_09",
        remitterAccountNumber: "987654321099",
        remitterIfsc: "HDFC0001234",
        whitelistedAccounts: [
          {
            accountNumberMasked: "XXXXXXXX1234",
            ifscCode: "HDFC0001234",
            isVerified: true,
          },
        ],
      });

      expect(check.isWhitelisted).toBe(false);
      expect(check.reason).toContain("PMLA Third-Party Payment Breach");
    });

    it("should pass when remitting bank account matches client's verified whitelisted account", async () => {
      const check = await multiAssetCustodyOrchestrator.validateRemitterAccount({
        userId: "test_user_09",
        remitterAccountNumber: "987654321234",
        remitterIfsc: "HDFC0001234",
        whitelistedAccounts: [
          {
            accountNumberMasked: "XXXXXXXX1234",
            ifscCode: "HDFC0001234",
            isVerified: true,
          },
        ],
      });

      expect(check.isWhitelisted).toBe(true);
      expect(check.reason).toBeUndefined();
    });
  });

  describe("Custody & Execution Economics Comparison Engine", () => {
    it("should calculate exact savings and alpha boost for ₹1 Cr PMS account", () => {
      const economics = multiAssetCustodyOrchestrator.calculateCustodyAndExecutionEconomics({
        product: "PMS",
        aum: 1_00_00_000, // ₹1 Crore
        annualTrades: 100,
      });

      expect(economics.aum).toBe(10_000_000);
      expect(economics.options).toHaveLength(3);

      const upstoxOption = economics.options.find((o) => o.providerId === "UPSTOX_DIRECT");
      const orbisOption = economics.options.find((o) => o.providerId === "ORBIS_FINANCIAL");
      const bankOption = economics.options.find((o) => o.providerId === "TIER1_BANK_CUSTODIAN");

      expect(upstoxOption).toBeDefined();
      expect(upstoxOption!.assetBasedFee).toBe(0);
      expect(upstoxOption!.transactionCosts).toBe(2000); // 100 * ₹20
      expect(upstoxOption!.totalAnnualCost).toBe(2000);

      expect(orbisOption).toBeDefined();
      expect(orbisOption!.assetBasedFee).toBe(250_000); // Max(250k, 4bps of 1Cr = 40k) -> 250,000 floor

      expect(bankOption).toBeDefined();
      expect(bankOption!.assetBasedFee).toBe(1_000_000); // ₹10L floor

      // Upstox saves over Tier-1 Bank
      expect(economics.annualSavingsWithUpstoxOrbis).toBeGreaterThan(500_000);
      expect(economics.alphaBoostBps).toBeGreaterThan(50);
      expect(economics.recommendation).toContain("Upstox Direct Segregated Demat");
    });
  });
});

