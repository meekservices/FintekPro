import { describe, it, expect } from "vitest";

describe("Lead MCA & Corporate Intelligence Enrichment", () => {
	// CIN Validation
	function isValidCin(cin?: string | null): boolean {
		if (!cin) return false;
		const trimmed = cin.trim().toUpperCase();
		const isCorporateCin = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(trimmed);
		const isLlpin = /^[A-Z]{3}-[0-9]{4,5}$/.test(trimmed);
		return isCorporateCin || isLlpin;
	}

	function cleanCompanyNameForSearch(rawName: string): string {
		let name = rawName.trim();
		name = name.replace(/^[A-Z0-9\-_]{2,6}\s*:\s*/i, "");
		name = name.replace(/\b(Pvt\.?\s*Ltd\.?|Private\s*Limited|Limited|LLP|Inc\.?|Corp\.?)\b/gi, "").trim();
		return name;
	}

	function calculateDynamicDataQuality(lead: {
		companyName?: string | null;
		cin?: string | null;
		primaryContactName?: string | null;
		primaryEmail?: string | null;
		primaryMobile?: string | null;
		annualRevenue?: string | null;
		paidUpCapital?: string | null;
		netProfit?: string | null;
		gstStatus?: string | null;
		directors?: unknown;
		creditRating?: string | null;
	}): number {
		let score = 0;
		if (lead.companyName) score += 10;
		if (isValidCin(lead.cin)) score += 15;
		if (lead.primaryContactName) score += 10;
		if (lead.primaryEmail) score += 10;
		if (lead.primaryMobile) score += 5;
		if (lead.annualRevenue && lead.annualRevenue !== "0") score += 15;
		if (lead.paidUpCapital && lead.paidUpCapital !== "0") score += 10;
		if (lead.netProfit) score += 5;
		if (Array.isArray(lead.directors) && lead.directors.length > 0) score += 10;
		if (lead.gstStatus && lead.gstStatus !== "Unknown") score += 5;
		if (lead.creditRating && lead.creditRating !== "Unknown") score += 5;
		return Math.min(100, Math.max(10, score));
	}

	describe("CIN Validation", () => {
		it("accepts valid 21-character MCA Corporate CINs", () => {
			expect(isValidCin("U72900KA2015PTC081234")).toBe(true);
			expect(isValidCin("L29100MH1945PLC004599")).toBe(true); // Listed
		});

		it("accepts valid LLP Identification Numbers (LLPIN)", () => {
			expect(isValidCin("AAA-1234")).toBe(true);
			expect(isValidCin("AAB-56789")).toBe(true);
		});

		it("rejects invalid or empty CIN strings", () => {
			expect(isValidCin("")).toBe(false);
			expect(isValidCin(null)).toBe(false);
			expect(isValidCin("N/A")).toBe(false);
			expect(isValidCin("12345")).toBe(false);
			expect(isValidCin("BENGALURU")).toBe(false);
		});
	});

	describe("Company Name Normalization for Registry Search", () => {
		it("strips acronym prefixes such as 'DMA: '", () => {
			expect(cleanCompanyNameForSearch("DMA: Design Matters Architects")).toBe("Design Matters Architects");
			expect(cleanCompanyNameForSearch("ABC: Alpha Beta Consultants")).toBe("Alpha Beta Consultants");
		});

		it("strips trailing legal company type qualifiers", () => {
			expect(cleanCompanyNameForSearch("Altigreen Propulsion Labs Pvt Ltd")).toBe("Altigreen Propulsion Labs");
			expect(cleanCompanyNameForSearch("Modutec Ready Panels Private Limited")).toBe("Modutec Ready Panels");
			expect(cleanCompanyNameForSearch("Tech Innovations LLP")).toBe("Tech Innovations");
		});
	});

	describe("Dynamic Data Quality Score Calculation", () => {
		it("calculates realistic score (~35-40%) for contact-only leads without MCA data", () => {
			const contactOnlyLead = {
				companyName: "Altigreen Propulsion Labs",
				cin: null,
				primaryContactName: "Amit Gupta",
				primaryEmail: "amit@altigreen.com",
				primaryMobile: "+919876543210",
				annualRevenue: null,
				paidUpCapital: null,
				netProfit: null,
				gstStatus: null,
				directors: null,
				creditRating: null,
			};

			const score = calculateDynamicDataQuality(contactOnlyLead);
			// 10 (company) + 10 (name) + 10 (email) + 5 (mobile) = 35
			expect(score).toBe(35);
		});

		it("calculates high score (>= 85%) for fully enriched leads with audited balance sheet & CIN", () => {
			const fullyEnrichedLead = {
				companyName: "Altigreen Propulsion Labs Private Limited",
				cin: "U34100KA2012PTC062534",
				primaryContactName: "Amit Gupta",
				primaryEmail: "amit@altigreen.com",
				primaryMobile: "+919876543210",
				annualRevenue: "1250000000",
				paidUpCapital: "85000000",
				netProfit: "140000000",
				gstStatus: "Active",
				directors: [
					{ name: "Amit Gupta", din: "01234567" },
					{ name: "John Doe", din: "07654321" },
				],
				creditRating: "CRISIL A+",
			};

			const score = calculateDynamicDataQuality(fullyEnrichedLead);
			// All fields populated -> 100
			expect(score).toBe(100);
		});
	});
});
