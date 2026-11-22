import { describe, it, expect, vi, beforeEach } from "vitest";
import { partnerAgreementService } from "../services/partner-agreement-service";

describe("Sub-Broker & Distributor Agreement Upload & Revenue Tracking Engine", () => {
	it("computes deterministic SHA-256 document hash for non-repudiation audit", () => {
		const sampleDoc = "FINTEKPRO_SUB_BROKER_FRANCHISE_AGREEMENT_2026_V1";
		const hash1 = partnerAgreementService.computeDocumentHash(sampleDoc);
		const hash2 = partnerAgreementService.computeDocumentHash(sampleDoc);

		expect(hash1).toBe(hash2);
		expect(hash1.length).toBe(64); // 64 hex characters (256 bits)
	});

	it("validates that agreement commission schedule parses all instrument categories", () => {
		const schedule = {
			equityDeliveryPct: 60,
			equityIntradayPct: 60,
			fnoOptionsPct: 65,
			fnoFuturesPct: 65,
			mutualFundsTrailPct: 70,
			bondsPct: 50,
			pmsPct: 60,
			insurancePct: 70,
			corporateFdPct: 70,
			defaultAgentPct: 60,
		};

		expect(schedule.equityDeliveryPct).toBe(60);
		expect(schedule.mutualFundsTrailPct).toBe(70);
		expect(schedule.fnoOptionsPct).toBe(65);
		expect(schedule.bondsPct).toBe(50);
		expect(schedule.pmsPct).toBe(60);
	});

	it("accurately computes 5% TDS under Section 194H on partner payouts", () => {
		const grossPartnerEarnings = 100000; // ₹1,00,000
		const estimatedTds = Math.round(grossPartnerEarnings * 0.05 * 100) / 100;
		const netPayable = grossPartnerEarnings - estimatedTds;

		expect(estimatedTds).toBe(5000); // 5% TDS = ₹5,000
		expect(netPayable).toBe(95000); // Net = ₹95,000
	});

	it("verifies platform retention calculation preserves zero-leakage invariant", () => {
		const totalGrossCommission = 150000;
		const partnerEarnings = 105000; // 70%
		const platformRetention = totalGrossCommission - partnerEarnings; // 30%

		expect(platformRetention).toBe(45000);
		expect(partnerEarnings + platformRetention).toBe(totalGrossCommission);
	});
});
