import { describe, it, expect, beforeAll } from "vitest";
import { deskGatewayService } from "../services/desk-gateway-service";
import { db } from "../db";
import { deskOperationalConfigs, statutoryLicenses, licenseVerificationDocuments } from "@shared/schema";
import { eq } from "drizzle-orm";

describe("FintekPro Desk License Gateway & Progressive Capability Activator", () => {
  beforeAll(async () => {
    // Ensure clean bootstrap
    await deskGatewayService.ensureBootstrapped();
  });

  it("bootstraps FintekPro Financial Services LLP in TEST_SANDBOX mode by default", async () => {
    const summary = await deskGatewayService.getStatusSummary();
    expect(summary).toBeDefined();
    expect(summary.config.entityName).toBe("FintekPro Financial Services LLP");
    expect(summary.config.operatingMode).toBe("TEST_SANDBOX");
    expect(summary.config.capabilityTier).toBe("SANDBOX_TEST");

    // All 9 core desks should exist
    expect(summary.licenses.length).toBe(9);
    const deskTypes = summary.licenses.map((l) => l.deskType);
    expect(deskTypes).toContain("MFD_AMFI");
    expect(deskTypes).toContain("IRIS_KFINTECH");
    expect(deskTypes).toContain("UPSTOX_BROKER");
    expect(deskTypes).toContain("ALPACA_GLOBAL");
    expect(deskTypes).toContain("SEBI_RIA_ADVISORY");
    expect(deskTypes).toContain("BONDS_NCDS_DESK");
    expect(deskTypes).toContain("CORPORATE_FD_DESK");
    expect(deskTypes).toContain("LAMF_CREDIT_DESK");
    expect(deskTypes).toContain("SDI_ALTERNATIVE_DEBT_DESK");
  });

  it("resolves execution mode to SANDBOX_MOCK when in TEST_SANDBOX mode", async () => {
    const mfResolution = await deskGatewayService.resolveExecutionMode("MFD_AMFI");
    expect(mfResolution.mode).toBe("SANDBOX_MOCK");
    expect(mfResolution.isSimulated).toBe(true);
    expect(mfResolution.operatingMode).toBe("TEST_SANDBOX");
    expect(mfResolution.reason).toContain("TEST_SANDBOX");

    const upstoxResolution = await deskGatewayService.resolveExecutionMode("UPSTOX_BROKER");
    expect(upstoxResolution.mode).toBe("SANDBOX_MOCK");
    expect(upstoxResolution.isSimulated).toBe(true);
  });

  it("executes simulated transactions successfully under sandbox conditions", async () => {
    const simResult = await deskGatewayService.executeSimulatedOrder({
      deskType: "MFD_AMFI",
      symbolOrScheme: "HDFC-TOP-100-DIR-GROWTH",
      amount: 5000,
      action: "SIP",
    });

    expect(simResult.success).toBe(true);
    expect(simResult.simulatedOrderId).toMatch(/^SIM_MFD_AMFI_/);
    expect(simResult.executionSnapshot.mockExchangeResponse.status).toBe("COMPLETE");
    expect(simResult.details).toContain("Simulated order executed successfully");
  });

  it("progressively upgrades capabilities as documents are uploaded and verified", async () => {
    const adminId = "TEST_COMPLIANCE_OFFICER";

    // 1. Enter MFD License details
    await deskGatewayService.upsertLicense({
      deskType: "MFD_AMFI",
      licenseNumber: "ARN-182394",
      holderName: "FintekPro Financial Services LLP",
      adminId,
    });

    // 2. Upload mandatory documents for MFD
    const doc1 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_MFD_AMFI",
      documentType: "AMFI_CORPORATE_ARN_CARD",
      fileName: "arn_card_2026.pdf",
      fileUrl: "/docs/arn_card_2026.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      adminId,
    });
    const doc2 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_MFD_AMFI",
      documentType: "NISM_V_A_CERTIFICATE",
      fileName: "nism_cert.pdf",
      fileUrl: "/docs/nism_cert.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
      adminId,
    });
    const doc3 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_MFD_AMFI",
      documentType: "EUIN_ALLOTMENT_LETTER",
      fileName: "euin_letter.pdf",
      fileUrl: "/docs/euin_letter.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b857",
      adminId,
    });

    // Approve documents
    await deskGatewayService.verifyDocument({ documentId: doc1, status: "APPROVED", adminId });
    await deskGatewayService.verifyDocument({ documentId: doc2, status: "APPROVED", adminId });
    const verify3 = await deskGatewayService.verifyDocument({ documentId: doc3, status: "APPROVED", adminId });

    expect(verify3.licenseStatus).toBe("VERIFIED_ACTIVE");
    expect(verify3.capabilityTier).toBe("PARTIAL_DISTRIBUTION");

    // 3. Upload & Verify Upstox AP Agreement
    await deskGatewayService.upsertLicense({
      deskType: "UPSTOX_BROKER",
      licenseNumber: "AP-UPSTOX-789",
      adminId,
    });
    const upstoxDoc = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_UPSTOX_BROKER",
      documentType: "UPSTOX_AP_AGREEMENT",
      fileName: "upstox_ap_agmt.pdf",
      fileUrl: "/docs/upstox_ap_agmt.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b858",
      adminId,
    });
    await deskGatewayService.verifyDocument({ documentId: upstoxDoc, status: "APPROVED", adminId });

    // 4. Upload & Verify Alpaca Agreements
    await deskGatewayService.upsertLicense({
      deskType: "ALPACA_GLOBAL",
      licenseNumber: "ALPACA-PARTNER-001",
      adminId,
    });
    const alpacaDoc1 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_ALPACA_GLOBAL",
      documentType: "ALPACA_BROKER_PARTNER_AGREEMENT",
      fileName: "alpaca_broker_agmt.pdf",
      fileUrl: "/docs/alpaca_broker_agmt.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b859",
      adminId,
    });
    const alpacaDoc2 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_ALPACA_GLOBAL",
      documentType: "GST_EXPORT_LUT_CERTIFICATE",
      fileName: "gst_lut_2026.pdf",
      fileUrl: "/docs/gst_lut_2026.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b860",
      adminId,
    });
    await deskGatewayService.verifyDocument({ documentId: alpacaDoc1, status: "APPROVED", adminId });
    const verifyAlpaca = await deskGatewayService.verifyDocument({ documentId: alpacaDoc2, status: "APPROVED", adminId });

    // Both MFD, Upstox, and Alpaca verified -> FULL_DISTRIBUTION!
    expect(verifyAlpaca.capabilityTier).toBe("FULL_DISTRIBUTION");

    // 5. Upload & Verify SEBI RIA Certificate -> ADVISORY_UPGRADED!
    await deskGatewayService.upsertLicense({
      deskType: "SEBI_RIA_ADVISORY",
      licenseNumber: "INA000012345",
      adminId,
    });
    const riaDoc1 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_SEBI_RIA_ADVISORY",
      documentType: "SEBI_RIA_REGISTRATION_CERTIFICATE",
      fileName: "sebi_ria_cert.pdf",
      fileUrl: "/docs/sebi_ria_cert.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b861",
      adminId,
    });
    const riaDoc2 = await deskGatewayService.recordDocumentUpload({
      licenseId: "LIC_SEBI_RIA_ADVISORY",
      documentType: "CA_NET_WORTH_CERTIFICATE",
      fileName: "ca_net_worth_50l.pdf",
      fileUrl: "/docs/ca_net_worth_50l.pdf",
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b862",
      adminId,
    });
    await deskGatewayService.verifyDocument({ documentId: riaDoc1, status: "APPROVED", adminId });
    const verifyRia = await deskGatewayService.verifyDocument({ documentId: riaDoc2, status: "APPROVED", adminId });

    expect(verifyRia.capabilityTier).toBe("ADVISORY_UPGRADED");
  });

  it("switches to LIVE mode when operatingMode is PRODUCTION_LIVE and desk sandbox is disabled", async () => {
    const adminId = "TEST_COMPLIANCE_OFFICER";

    // Set desk to unsandboxed (live production)
    await deskGatewayService.upsertLicense({
      deskType: "MFD_AMFI",
      isSandboxed: false,
      adminId,
    });

    // Update global mode to PRODUCTION_LIVE
    await deskGatewayService.updateOperatingMode("PRODUCTION_LIVE", adminId);

    const resolution = await deskGatewayService.resolveExecutionMode("MFD_AMFI");
    expect(resolution.mode).toBe("LIVE");
    expect(resolution.isSimulated).toBe(false);
    expect(resolution.operatingMode).toBe("PRODUCTION_LIVE");

    // Reset back to TEST_SANDBOX for safe testing
    await deskGatewayService.updateOperatingMode("TEST_SANDBOX", adminId);
    const postReset = await deskGatewayService.resolveExecutionMode("MFD_AMFI");
    expect(postReset.mode).toBe("SANDBOX_MOCK");
    expect(postReset.isSimulated).toBe(true);
  });

  it("verifies Bonds & NCDs desk can be configured and simulated", async () => {
    const bondResolution = await deskGatewayService.resolveExecutionMode("BONDS_NCDS_DESK");
    expect(bondResolution.mode).toBe("SANDBOX_MOCK");
    expect(bondResolution.isSimulated).toBe(true);

    const simBond = await deskGatewayService.executeSimulatedOrder({
      deskType: "BONDS_NCDS_DESK",
      symbolOrScheme: "INE123A08012 (TATA MOTORS 9.25% NCD 2028)",
      amount: 100000,
      action: "BUY",
    });
    expect(simBond.success).toBe(true);
    expect(simBond.simulatedOrderId).toMatch(/^SIM_BONDS_NCDS_DESK_/);
  });

  it("validates Partner Circuit Breaker resilient fallback and tri-state recovery", async () => {
    const { partnerCircuitBreaker } = await import("../services/partner-circuit-breaker");

    // 1. Initial successful call
    const successResult = await partnerCircuitBreaker.execute(
      "UPSTOX",
      "test_quote_nifty",
      async () => ({ tick: 24500, status: "SUCCESS" }),
    );
    expect(successResult.isCached).toBe(false);
    expect(successResult.circuitState).toBe("CLOSED");

    // 2. Simulate 5 consecutive upstream partner errors to trip circuit
    for (let i = 0; i < 5; i++) {
      try {
        await partnerCircuitBreaker.execute(
          "UPSTOX",
          "test_failing_key",
          async () => {
            throw new Error("HTTP 503 Upstream Gateway Timeout");
          },
        );
      } catch (err: any) {
        expect(err.message).toContain("HTTP 503");
      }
    }

    const statuses = partnerCircuitBreaker.getCircuitStatuses();
    expect(statuses.UPSTOX.state).toBe("OPEN");
    expect(statuses.UPSTOX.consecutiveFailures).toBeGreaterThanOrEqual(5);

    // 3. While OPEN, call with cached key serves stale cache without throwing!
    const staleResult = await partnerCircuitBreaker.execute(
      "UPSTOX",
      "test_quote_nifty",
      async () => ({ tick: 24500, status: "SUCCESS" }),
    );
    expect(staleResult.isCached).toBe(true);
    expect(staleResult.circuitState).toBe("OPEN");

    // 4. Manual reset restores health
    partnerCircuitBreaker.resetCircuit("UPSTOX");
    expect(partnerCircuitBreaker.getCircuitStatuses().UPSTOX.state).toBe("CLOSED");
  });

  it("validates Dual-RTA WBR2 feed parsing and transaction reconciliation", async () => {
    const { dualRtaReconciliationService } = await import("../services/dual-rta-reconciliation-service");
    const sampleFeed = `
AMC_HDFC|HDFC101|F1234567|ABCDE1234F|PURCHASE|2026-11-20|50000|500.00|100.00|TX_REF_001
AMC_ICICI|ICICI202|F7654321|BCDEF2345G|SIP|2026-11-20|10000|100.00|100.00|TX_REF_002
    `.trim();

    const records = dualRtaReconciliationService.parseWbr2Feed("CAMS", sampleFeed);
    expect(records.length).toBe(2);
    expect(records[0].grossAmount).toBe(50000);
    expect(records[0].units).toBe(500);

    const recon = dualRtaReconciliationService.reconcileTransactions(records, [
      { ref: "TX_REF_001", amount: 50000, schemeCode: "HDFC101" },
      { ref: "TX_REF_002", amount: 10000, schemeCode: "ICICI202" },
    ]);
    expect(recon.matchedCount).toBe(2);
    expect(recon.unmatchedCount).toBe(0);
    expect(recon.matchRatePercent).toBe(100);
  });

  it("validates CA SaaS transparent invoicing with 18% GST and anti-drip pricing", async () => {
    const { caSaasSubscriptionService } = await import("../services/ca-saas-subscription-service");

    const tiers = caSaasSubscriptionService.getAvailableTiers();
    expect(tiers.length).toBe(3);

    // Intra-state (Maharashtra to Maharashtra): CGST 9% + SGST 9%
    const monthlyInvoice = caSaasSubscriptionService.calculateInvoice({
      tierKey: "CA_PROFESSIONAL",
      billingCycle: "MONTHLY",
      supplierStateCode: "27",
      clientStateCode: "27",
    });
    expect(monthlyInvoice.baseAmountInr).toBe(3499);
    expect(monthlyInvoice.taxableAmountInr).toBe(3499);
    expect(monthlyInvoice.gstRatePercent).toBe(18);
    expect(monthlyInvoice.cgstAmountInr).toBeCloseTo(314.91, 1);
    expect(monthlyInvoice.sgstAmountInr).toBeCloseTo(314.91, 1);
    expect(monthlyInvoice.igstAmountInr).toBe(0);
    expect(monthlyInvoice.totalPayableInr).toBeCloseTo(4128.82, 1);

    // Inter-state: IGST 18%
    const interstateInvoice = caSaasSubscriptionService.calculateInvoice({
      tierKey: "CA_STARTER",
      billingCycle: "ANNUAL",
      supplierStateCode: "27",
      clientStateCode: "07", // Delhi
    });
    expect(interstateInvoice.isInterstate).toBe(true);
    expect(interstateInvoice.igstAmountInr).toBeCloseTo(2590.2, 1);
    expect(interstateInvoice.cgstAmountInr).toBe(0);
  });

  it("validates multi-partner per product architecture and automatic failover", async () => {
    const { multiPartnerRouterService } = await import("../services/multi-partner-router-service");
    const { partnerCircuitBreaker } = await import("../services/partner-circuit-breaker");

    // 1. Verify multiple partners are configured per product
    const eqPartners = multiPartnerRouterService.getPartnersForProduct("EQUITY_BROKERAGE");
    expect(eqPartners.length).toBeGreaterThanOrEqual(3);
    expect(eqPartners.map((p) => p.providerKey)).toContain("UPSTOX");
    expect(eqPartners.map((p) => p.providerKey)).toContain("ANGEL_ONE");
    expect(eqPartners.map((p) => p.providerKey)).toContain("DHAN");

    const fdPartners = multiPartnerRouterService.getPartnersForProduct("CORPORATE_FIXED_DEPOSITS");
    expect(fdPartners.length).toBeGreaterThanOrEqual(4);
    expect(fdPartners.map((p) => p.providerKey)).toContain("BAJAJ_FINANCE");
    expect(fdPartners.map((p) => p.providerKey)).toContain("SHRIRAM_FINANCE");

    // 2. Normal routing routes to Priority 1 (Upstox)
    partnerCircuitBreaker.resetCircuit("UPSTOX");
    const normalRoute = multiPartnerRouterService.resolveActivePartner("EQUITY_BROKERAGE");
    expect(normalRoute.selectedProviderKey).toBe("UPSTOX");
    expect(normalRoute.priorityOrder).toBe(1);
    expect(normalRoute.isFailover).toBe(false);

    // 3. Trip Upstox circuit with 5 consecutive failures
    for (let i = 0; i < 5; i++) {
      partnerCircuitBreaker.recordFailure("UPSTOX", new Error("503 Service Unavailable"));
    }
    expect(partnerCircuitBreaker.getCircuitStatus("UPSTOX").state).toBe("OPEN");

    // 4. Multi-partner router must automatically fail over to Priority 2 (Angel One)!
    const failoverRoute = multiPartnerRouterService.resolveActivePartner("EQUITY_BROKERAGE");
    expect(failoverRoute.selectedProviderKey).toBe("ANGEL_ONE");
    expect(failoverRoute.priorityOrder).toBe(2);
    expect(failoverRoute.isFailover).toBe(true);
    expect(failoverRoute.failoverReason).toContain("Primary partner unavailable");

    // Cleanup: reset circuit
    partnerCircuitBreaker.resetCircuit("UPSTOX");
  });

  it("validates Corporate FD calculations, maturity values, and Section 194A TDS", async () => {
    const { corporateFdService } = await import("../services/corporate-fd-service");

    const schemes = corporateFdService.getAvailableSchemes();
    expect(schemes.length).toBeGreaterThanOrEqual(4);

    // Bajaj Finance: ₹1,00,000 for 36 months cumulative
    const bajajCalc = corporateFdService.calculateMaturity({
      schemeKey: "BAJAJ_FINANCE",
      principalAmount: 100000,
      tenureMonths: 36,
      isSeniorCitizen: false,
    });
    expect(bajajCalc.baseRatePercent).toBe(8.10);
    expect(bajajCalc.effectiveRatePercent).toBe(8.10);
    expect(bajajCalc.maturityValue).toBeGreaterThan(120000);
    expect(bajajCalc.partnerCommissionEstimate).toBe(1750); // 1.75% of 1L

    // Shriram Finance with Senior Citizen bonus (+0.50%)
    const shriramCalc = corporateFdService.calculateMaturity({
      schemeKey: "SHRIRAM_FINANCE",
      principalAmount: 200000,
      tenureMonths: 36,
      isSeniorCitizen: true,
    });
    expect(shriramCalc.seniorBonusPercent).toBe(0.50);
    expect(shriramCalc.effectiveRatePercent).toBe(9.20); // 8.70 + 0.50
    expect(shriramCalc.partnerCommissionEstimate).toBe(4400); // 2.20% of 2L
  });

  it("validates LAMF Credit LTV caps and capital gains tax savings", async () => {
    const { lamfCreditService } = await import("../services/lamf-credit-service");

    const mockHoldings = [
      {
        schemeCode: "HDFC_TOP100",
        schemeName: "HDFC Top 100 Fund",
        category: "EQUITY" as const,
        currentNav: 1000,
        units: 500,
        currentValue: 500000,
        costValue: 350000,
        folioNumber: "F123",
        rta: "CAMS" as const,
      },
      {
        schemeCode: "ICICI_LIQUID",
        schemeName: "ICICI Liquid Fund",
        category: "LIQUID" as const,
        currentNav: 350,
        units: 1000,
        currentValue: 350000,
        costValue: 340000,
        folioNumber: "F456",
        rta: "KFINTECH" as const,
      },
    ];

    const eligibility = lamfCreditService.evaluatePortfolio(mockHoldings);
    expect(eligibility.totalPortfolioValue).toBe(850000);

    // Equity @ 50% LTV = ₹2,50,000; Liquid @ 80% LTV = ₹2,80,000 => Total = ₹5,30,000
    expect(eligibility.totalEligibleCreditLimit).toBe(530000);

    // Tax avoidance savings: ₹2,00,000 withdrawal for 12 months
    const taxSavings = lamfCreditService.calculateTaxSavings({
      withdrawalAmount: 200000,
      tenureMonths: 12,
      holdingPeriodIsLongTerm: true,
    });
    expect(taxSavings.scenarioRedemption.capitalGainsTaxPayable).toBeGreaterThan(0);
    expect(taxSavings.scenarioLamf.portfolioGrownValue).toBeGreaterThan(200000);
    expect(taxSavings.scenarioLamf.netBenefitOfLamf).toBeGreaterThan(0);
  });
});
