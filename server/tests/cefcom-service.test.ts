import { describe, it, expect } from "vitest";
import { cefcomService, CeFCoMInvoiceInput } from "../services/cefcom-service";

describe("CeFCoM Service (Central Fee Collection Mechanism)", () => {
	it("validates compliant fixed advisory fee within ₹1,25,000 p.a. and <= 6 months advance", () => {
		const invoice: CeFCoMInvoiceInput = {
			clientPan: "ABCDE1234F",
			clientName: "Ramesh Sharma",
			agreementRefId: "AGR-IA-2026-001",
			agreementDate: "2026-01-15",
			feeType: "FIXED",
			billingPeriodStart: "2026-04-01",
			billingPeriodEnd: "2026-09-30",
			advanceMonths: 6,
			baseAmountInr: 60000, // ₹60k for 6 months <= ₹62,500 limit
		};

		const check = cefcomService.validateInvoice(invoice);
		expect(check.isValid).toBe(true);

		const record = cefcomService.createRecord(invoice);
		expect(record.validationStatus).toBe("VALID");
		expect(record.baseAmountInr).toBe(60000);
		expect(record.gstAmountInr).toBe(10800);
		expect(record.totalAmountInr).toBe(70800);
		expect(record.clientPanMasked).toBe("ABCDE4F".length === 7 ? "ABCDEXXXXF" : "ABCDEXXXXF");
		expect(record.iaRegNo).toBe("INA000017842");
		expect(record.recordHash).toBeDefined();
	});

	it("rejects advance billing exceeding 2 quarters (> 6 months)", () => {
		const invoice: CeFCoMInvoiceInput = {
			clientPan: "ABCDE1234F",
			clientName: "Ramesh Sharma",
			agreementRefId: "AGR-IA-2026-001",
			agreementDate: "2026-01-15",
			feeType: "FIXED",
			billingPeriodStart: "2026-04-01",
			billingPeriodEnd: "2027-03-31",
			advanceMonths: 12, // Illegal: SEBI allows max 6 months advance
			baseAmountInr: 100000,
		};

		const check = cefcomService.validateInvoice(invoice);
		expect(check.isValid).toBe(false);
		expect(check.error).toContain("exceeds SEBI limit of 2 quarters");

		const record = cefcomService.createRecord(invoice);
		expect(record.validationStatus).toBe("REJECTED");
	});

	it("rejects fixed advisory fee exceeding ₹1.25L annual pro-rated cap", () => {
		const invoice: CeFCoMInvoiceInput = {
			clientPan: "ABCDE1234F",
			clientName: "Ramesh Sharma",
			agreementRefId: "AGR-IA-2026-001",
			agreementDate: "2026-01-15",
			feeType: "FIXED",
			billingPeriodStart: "2026-04-01",
			billingPeriodEnd: "2026-06-30",
			advanceMonths: 3,
			baseAmountInr: 45000, // 3-month cap is ₹31,250
		};

		const check = cefcomService.validateInvoice(invoice);
		expect(check.isValid).toBe(false);
		expect(check.error).toContain("exceeds statutory limit");
	});

	it("validates and generates a compliant batch export with SHA-256 checksum", () => {
		const invoices: CeFCoMInvoiceInput[] = [
			{
				clientPan: "ABCDE1234F",
				clientName: "Ramesh Sharma",
				agreementRefId: "AGR-IA-2026-001",
				agreementDate: "2026-01-15",
				feeType: "FIXED",
				billingPeriodStart: "2026-04-01",
				billingPeriodEnd: "2026-06-30",
				advanceMonths: 3,
				baseAmountInr: 30000,
			},
			{
				clientPan: "XYZPK9876Q",
				clientName: "Priya Nair",
				agreementRefId: "AGR-IA-2026-002",
				agreementDate: "2026-02-01",
				feeType: "AUA_BASED",
				billingPeriodStart: "2026-04-01",
				billingPeriodEnd: "2026-06-30",
				advanceMonths: 3,
				baseAmountInr: 25000,
				auaInr: 5000000, // 2.5% p.a. on 50L for 3 mos is max ₹31,250 => ₹25k is valid
			},
		];

		const batch = cefcomService.generateBatchExport(invoices);
		expect(batch.totalRecords).toBe(2);
		expect(batch.totalGrossAmountInr).toBe(55000);
		expect(batch.totalGstAmountInr).toBe(9900);
		expect(batch.batchChecksumSha256).toBeDefined();
		expect(batch.csvPayload).toContain("IA_Reg_No");
		expect(batch.csvPayload).toContain("INA000017842");
		expect(batch.csvPayload).toContain("ABCDEXXXXF");
		expect(batch.csvPayload).toContain("XYZPKXXXXQ");
	});
});
