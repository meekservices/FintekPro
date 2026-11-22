import { describe, it, expect } from "vitest";
import {
	regulatoryProhibitionEngine,
	STATUTORY_PROHIBITION_REGISTRY,
} from "../services/regulatory-prohibition-engine";

describe("Regulatory Prohibition Engine (RPE v1.0: 'What CANNOT Be Done')", () => {
	it("exposes the full statutory prohibition catalog across all 5 regulatory domains", () => {
		const registry = regulatoryProhibitionEngine.getProhibitionRegistry();
		expect(Object.keys(registry).length).toBeGreaterThanOrEqual(15);
		expect(registry.PROHIBIT_RETURN_GUARANTEES.domain).toBe("SEBI");
		expect(registry.PROHIBIT_RAW_CARD_STORAGE.domain).toBe("RBI");
		expect(registry.PROHIBIT_DRIP_PRICING.domain).toBe("CCPA");
		expect(registry.PROHIBIT_RAW_PII_IN_LLM_PROMPT.domain).toBe("MEITY_DPDPA");
		expect(registry.PROHIBIT_DIRECT_INSURANCE_FEE.domain).toBe("IRDAI_PFRDA");
	});

	describe("CCPA & Consumer Protection: Anti-Drip Pricing & Dark Patterns", () => {
		it("detects and blocks sneaked drip charges at final checkout", () => {
			const verdict = regulatoryProhibitionEngine.checkPricingAndCheckout({
				baseAmount: 1000,
				totalPayable: 1280,
				dripChargesApplied: 100, // ₹100 sneaked fee
				convenienceFeeSneaked: true,
			});

			expect(verdict.passed).toBe(false);
			expect(verdict.violationsCount).toBeGreaterThanOrEqual(2);
			const ruleCodes = verdict.violations.map((v) => v.ruleCode);
			expect(ruleCodes).toContain("PROHIBIT_DRIP_PRICING");
		});

		it("detects and blocks pre-checked auto-renewal checkboxes (Forced Continuity)", () => {
			const verdict = regulatoryProhibitionEngine.checkPricingAndCheckout({
				baseAmount: 5000,
				totalPayable: 5900,
				autoRenewalPreChecked: true, // Forbidden pre-check
			});

			expect(verdict.passed).toBe(false);
			const forcedContinuity = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_FORCED_CONTINUITY_PRECHECK",
			);
			expect(forcedContinuity).toBeDefined();
			expect(forcedContinuity?.severity).toBe("CRITICAL_BLOCK");
		});

		it("passes transparent pricing with correct 18% GST and unselected checkboxes", () => {
			const verdict = regulatoryProhibitionEngine.checkPricingAndCheckout({
				baseAmount: 10000,
				gstAmount: 1800,
				totalPayable: 11800,
				autoRenewalPreChecked: false,
				convenienceFeeSneaked: false,
			});

			expect(verdict.passed).toBe(true);
			expect(verdict.violationsCount).toBe(0);
		});
	});

	describe("SEBI: Advisory Fee Caps, Advance Limits & Finfluencer Prohibition", () => {
		it("blocks fixed advisory fees exceeding statutory ₹1.25L/year cap", () => {
			const verdict = regulatoryProhibitionEngine.checkAdvisoryFee({
				feeMode: "fixed",
				proposedAnnualFee: 150000, // Exceeds ₹1,25,000
				advanceBillingMonths: 3,
				paymentChannel: "UPI",
			});

			expect(verdict.passed).toBe(false);
			const capBreach = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_EXCESSIVE_ADVISORY_FEE",
			);
			expect(capBreach).toBeDefined();
			expect(capBreach?.message).toContain("exceeds the statutory ceiling of ₹125000/year");
		});

		it("blocks AUA advisory fees exceeding 2.5% statutory cap", () => {
			const verdict = regulatoryProhibitionEngine.checkAdvisoryFee({
				feeMode: "aua",
				proposedAnnualFee: 30000,
				auaAmount: 1000000, // 30,000 / 1,000,000 = 3% > 2.5%
				advanceBillingMonths: 3,
				paymentChannel: "NET_BANKING",
			});

			expect(verdict.passed).toBe(false);
			const capBreach = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_EXCESSIVE_ADVISORY_FEE",
			);
			expect(capBreach).toBeDefined();
			expect(capBreach?.message).toContain("exceeds statutory cap of 2.5%");
		});

		it("blocks advance billing exceeding 6 months (2 quarters)", () => {
			const verdict = regulatoryProhibitionEngine.checkAdvisoryFee({
				feeMode: "fixed",
				proposedAnnualFee: 50000,
				advanceBillingMonths: 12, // Illegal 1-year advance
				paymentChannel: "CEFCOM",
			});

			expect(verdict.passed).toBe(false);
			const advanceBreach = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_ADVANCE_FEE_OVER_SIX_MONTHS",
			);
			expect(advanceBreach).toBeDefined();
		});

		it("blocks cash collections for advisory services", () => {
			const verdict = regulatoryProhibitionEngine.checkAdvisoryFee({
				feeMode: "fixed",
				proposedAnnualFee: 25000,
				advanceBillingMonths: 3,
				paymentChannel: "CASH", // Strictly illegal
			});

			expect(verdict.passed).toBe(false);
			const cashViolation = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_CASH_AND_UNTRACEABLE_COLLECTIONS",
			);
			expect(cashViolation).toBeDefined();
		});

		it("blocks simultaneous RIA advisory fee and distribution commission on same client (Reg 22)", () => {
			const verdict = regulatoryProhibitionEngine.checkAdvisoryFee({
				feeMode: "fixed",
				proposedAnnualFee: 25000,
				advanceBillingMonths: 3,
				paymentChannel: "NET_BANKING",
				alsoReceivesDistributionCommission: true, // Conflict of interest
			});

			expect(verdict.passed).toBe(false);
			const dualFeeViolation = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_DUAL_COMMISSION_ADVISORY_CONFLICT",
			);
			expect(dualFeeViolation).toBeDefined();
		});

		it("passes compliant advisory fee within statutory limits via CeFCoM", () => {
			const verdict = regulatoryProhibitionEngine.checkAdvisoryFee({
				feeMode: "fixed",
				proposedAnnualFee: 75000, // < ₹1,25,000
				advanceBillingMonths: 6, // <= 6 months
				paymentChannel: "CEFCOM",
				alsoReceivesDistributionCommission: false,
			});

			expect(verdict.passed).toBe(true);
			expect(verdict.violationsCount).toBe(0);
		});
	});

	describe("SEBI & CCPA: Marketing Claims & Trademark Protection", () => {
		it("detects and blocks guaranteed returns and sure-shot trading claims", () => {
			const verdict = regulatoryProhibitionEngine.checkMarketingContent({
				content: "Invest in our AI model portfolio for guaranteed 25% returns with sure-shot stock calls!",
				contentType: "PAGE_COPY",
			});

			expect(verdict.passed).toBe(false);
			const ruleCodes = verdict.violations.map((v) => v.ruleCode);
			expect(ruleCodes).toContain("PROHIBIT_RETURN_GUARANTEES");
		});

		it("detects and blocks unlicensed 'Bloomberg Terminal' claims", () => {
			const verdict = regulatoryProhibitionEngine.checkMarketingContent({
				content: "Access the Bloomberg Terminal for Indian retail investors at zero cost.",
				contentType: "CTA",
			});

			expect(verdict.passed).toBe(false);
			const trademarkViolation = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_DECEPTIVE_CLAIMS",
			);
			expect(trademarkViolation).toBeDefined();
			expect(trademarkViolation?.remediation).toContain("Wall Street Analytics, Built for Indian Investors");
		});

		it("passes approved institutional vocabulary with market risk warning", () => {
			const verdict = regulatoryProhibitionEngine.checkMarketingContent({
				content: "Wall Street Analytics, Built for Indian Investors. Quantitative decision terminal. Investments in securities are subject to market risks.",
				contentType: "PAGE_COPY",
			});

			expect(verdict.passed).toBe(true);
			expect(verdict.violationsCount).toBe(0);
		});
	});

	describe("SEBI August 2024 Finfluencer Ban: Partner Onboarding", () => {
		it("blocks revenue-sharing tie-ups with unregistered individual influencers", () => {
			const verdict = regulatoryProhibitionEngine.checkPartnerOnboarding({
				partnerName: "StockGuruSharma",
				partnerType: "INDIVIDUAL_INFLUENCER",
				hasSignedAntiTippingUndertaking: false,
				compensationModel: "REV_SHARE_PER_TRADE", // Prohibited
			});

			expect(verdict.passed).toBe(false);
			const finfluencerBreach = verdict.violations.find(
				(v) => v.ruleCode === "PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP",
			);
			expect(finfluencerBreach).toBeDefined();
		});

		it("passes compliant institutional RIA partner onboarding", () => {
			const verdict = regulatoryProhibitionEngine.checkPartnerOnboarding({
				partnerName: "Apex Wealth Partners RIA",
				partnerType: "REGISTERED_RIA",
				sebiRegistrationNumber: "INA000012345",
				hasSignedAntiTippingUndertaking: true,
				compensationModel: "FIXED_B2B",
			});

			expect(verdict.passed).toBe(true);
			expect(verdict.violationsCount).toBe(0);
		});
	});

	describe("CCPA E-Commerce Rules 2020: Website Footer Disclosures", () => {
		it("flags missing CIN and Grievance Officer disclosures", () => {
			const verdict = regulatoryProhibitionEngine.checkWebsiteFooterDisclosures({
				hasCin: false, // Missing
				hasRegisteredAddress: true,
				hasGrievanceOfficer: false, // Missing
				hasGrievanceEmail: false,
				hasScoresLink: true,
				hasSmartOdrLink: true,
				hasTermsAndPrivacy: true,
				hasRefundPolicy: true,
			});

			expect(verdict.passed).toBe(false);
			const cinBreach = verdict.violations.find((v) => v.message.includes("CIN"));
			expect(cinBreach).toBeDefined();
		});

		it("passes complete, compliant footer disclosures", () => {
			const verdict = regulatoryProhibitionEngine.checkWebsiteFooterDisclosures({
				hasCin: true,
				hasRegisteredAddress: true,
				hasGrievanceOfficer: true,
				hasGrievanceEmail: true,
				hasScoresLink: true,
				hasSmartOdrLink: true,
				hasTermsAndPrivacy: true,
				hasRefundPolicy: true,
			});

			expect(verdict.passed).toBe(true);
			expect(verdict.violationsCount).toBe(0);
		});
	});
});
