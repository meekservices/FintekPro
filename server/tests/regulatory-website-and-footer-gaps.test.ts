import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Regulatory Disclosures, Footer & Checkout Gap Remediation Audit", () => {
	const rootDir = path.resolve(__dirname, "../..");
	const footerPath = path.join(rootDir, "client/src/components/layout/footer.tsx");
	const pricingPath = path.join(rootDir, "client/src/pages/pricing.tsx");
	const subscriptionServicePath = path.join(
		rootDir,
		"server/services/subscription-service.ts",
	);

	describe("Gap 1: Public Website Footer Statutory Disclosures (CCPA & SEBI)", () => {
		const footerContent = fs.readFileSync(footerPath, "utf-8");

		it("contains Corporate Identifier (LLPIN) and Registered Office Address", () => {
			expect(footerContent).toContain("FINTEKPRO FINANCIAL SERVICES LLP");
			expect(footerContent).toContain("LLPIN: </span>ACD-6942");
			expect(footerContent).toContain("Financial District, Gachibowli, Hyderabad, Telangana 500032");
		});

		it("contains SEBI IA, BASL and AMFI registration disclosures", () => {
			expect(footerContent).toContain("INA000017842");
			expect(footerContent).toContain("1982"); // BASL ID
			expect(footerContent).toContain("ARN-184920"); // AMFI ARN
		});

		it("contains Grievance Redressal Officer contact and 24h/15d SLA", () => {
			expect(footerContent).toContain("Grievance Redressal Officer");
			expect(footerContent).toContain("Ms. Ritu Verma");
			expect(footerContent).toContain("grievance@fintekpro.com");
			expect(footerContent).toContain("Acknowledgment within 24 hours; complete resolution within 15 calendar days");
		});

		it("contains active clickable links to SEBI SCORES, SMART ODR, and Consumer Helpline", () => {
			expect(footerContent).toContain("https://scores.sebi.gov.in");
			expect(footerContent).toContain("https://smartodr.in");
			expect(footerContent).toContain("https://consumerhelpline.gov.in");
		});

		it("contains full SEBI mandatory statutory risk warning", () => {
			expect(footerContent).toContain("Investment in securities market are subject to market risks. Read all scheme related documents carefully");
			expect(footerContent).toContain("Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantee performance");
		});
	});

	describe("Gap 2: Pricing Page & Checkout Anti-Dark-Pattern Compliance (CCPA & RBI)", () => {
		const pricingContent = fs.readFileSync(pricingPath, "utf-8");

		it("explicitly states 100% transparent pricing inclusive of 18% GST with zero surprise checkout fees", () => {
			expect(pricingContent).toContain("100% Transparent Pricing");
			expect(pricingContent).toContain("All plan prices are inclusive of 18% GST (SAC 998313)");
			expect(pricingContent).toContain("CCPA Dark Patterns Prevention Compliant");
		});

		it("renders transparent tax breakdown (base + 18% GST) in PaymentModal", () => {
			expect(pricingContent).toContain("Transparent Tax Breakdown (No Hidden Fees)");
			expect(pricingContent).toContain("Base Software Plan");
			expect(pricingContent).toContain("Standard GST (18% • SAC 998313)");
			expect(pricingContent).toContain("Total Payable Amount");
		});

		it("displays RBI e-mandate protection (24-hr pre-debit alert & 1-click cancel) notice", () => {
			expect(pricingContent).toContain("RBI e-Mandate Protection");
			expect(pricingContent).toContain("24-hour pre-debit alert");
			expect(pricingContent).toContain("cancelled anytime in 1 click");
		});

		it("avoids misleading return guarantee language in commercial ARPU section", () => {
			expect(pricingContent).not.toContain("Expected returns by tier");
			expect(pricingContent).toContain("Platform Commercial Value & Economics by Tier");
			expect(pricingContent).toContain("Not an investment return guarantee");
		});
	});

	describe("Gap 3: Server-side Pre-Flight Regulatory Prohibition Gate in Checkout", () => {
		const subServiceContent = fs.readFileSync(subscriptionServicePath, "utf-8");

		it("integrates regulatoryProhibitionEngine pre-flight verification in createCheckoutOrder", () => {
			expect(subServiceContent).toContain("regulatoryProhibitionEngine.checkPricingAndCheckout");
			expect(subServiceContent).toContain("Regulatory Prohibition Pre-Flight Failure");
		});

		it("records tax breakdown and RPE compliance audit metadata in subscription records", () => {
			expect(subServiceContent).toContain("rpeEngineVersion: RPE_ENGINE_VERSION");
			expect(subServiceContent).toContain("rpeVerified: true");
			expect(subServiceContent).toContain("sacCode: \"998313\"");
			expect(subServiceContent).toContain("coftCardTokenizationCompliant: true");
		});
	});
});
