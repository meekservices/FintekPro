/**
 * CeFCoM Service (Central Fee Collection Mechanism - BSE StAR / NSE)
 * 
 * Mandated by SEBI Circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2024/003.
 * Facilitates regulatory-compliant collection of Investment Advisory fees
 * through exchange clearing mechanisms to ensure transparent fee billing.
 */

import crypto from "crypto";
import { logger } from "../logger";

export interface CeFCoMInvoiceInput {
	clientPan: string;
	clientName: string;
	agreementRefId: string;
	agreementDate: string; // YYYY-MM-DD
	feeType: "FIXED" | "AUA_BASED";
	billingPeriodStart: string; // YYYY-MM-DD
	billingPeriodEnd: string;   // YYYY-MM-DD
	advanceMonths: number;      // Max 6 months (2 quarters)
	baseAmountInr: number;
	auaInr?: number;            // Required if feeType === "AUA_BASED"
}

export interface CeFCoMRecord {
	recordId: string;
	iaRegNo: string;
	clientPanMasked: string;
	agreementRefId: string;
	feeType: "FIXED" | "AUA_BASED";
	baseAmountInr: number;
	gstRatePercent: number;
	gstAmountInr: number;
	totalAmountInr: number;
	billingPeriod: string;
	validationStatus: "VALID" | "REJECTED";
	rejectionReason?: string;
	recordHash: string;
}

export interface CeFCoMBatchExport {
	batchId: string;
	iaRegNo: string;
	generatedAt: string;
	totalRecords: number;
	totalGrossAmountInr: number;
	totalGstAmountInr: number;
	csvPayload: string;
	batchChecksumSha256: string;
}

export class CeFCoMService {
	private readonly iaRegNo = "INA000017842";
	private readonly maxFixedAnnualFee = 125000;
	private readonly maxAuaFeePercent = 2.5;
	private readonly maxAdvanceMonths = 6; // SEBI max 2 quarters

	/**
	 * Validates a single CeFCoM invoice against statutory SEBI IA regulations
	 */
	public validateInvoice(input: CeFCoMInvoiceInput): { isValid: boolean; error?: string } {
		if (input.advanceMonths > this.maxAdvanceMonths) {
			return {
				isValid: false,
				error: `Advance billing exceeds SEBI limit of 2 quarters (requested: ${input.advanceMonths} months)`,
			};
		}

		if (input.feeType === "FIXED") {
			// Pro-rate annual cap for period
			const periodCap = (this.maxFixedAnnualFee * input.advanceMonths) / 12;
			if (input.baseAmountInr > periodCap) {
				return {
					isValid: false,
					error: `Fixed advisory fee ₹${input.baseAmountInr} exceeds statutory limit of ₹${periodCap} for ${input.advanceMonths} months (SEBI ₹1,25,000/yr cap)`,
				};
			}
		} else if (input.feeType === "AUA_BASED") {
			if (!input.auaInr || input.auaInr <= 0) {
				return {
					isValid: false,
					error: "AUA amount is required and must be greater than zero for AUA_BASED billing",
				};
			}
			const maxAllowed = (input.auaInr * (this.maxAuaFeePercent / 100) * input.advanceMonths) / 12;
			if (input.baseAmountInr > maxAllowed) {
				return {
					isValid: false,
					error: `AUA fee ₹${input.baseAmountInr} exceeds SEBI 2.5% cap (max allowed: ₹${Math.round(maxAllowed)} on AUA ₹${input.auaInr})`,
				};
			}
		}

		return { isValid: true };
	}

	/**
	 * Builds a validated CeFCoM record with GST and cryptographic hash
	 */
	public createRecord(input: CeFCoMInvoiceInput): CeFCoMRecord {
		const validation = this.validateInvoice(input);
		const baseAmount = Math.round(input.baseAmountInr * 100) / 100;
		const gstAmount = Math.round(baseAmount * 0.18 * 100) / 100;
		const totalAmount = Math.round((baseAmount + gstAmount) * 100) / 100;

		const panClean = input.clientPan.trim().toUpperCase();
		const maskedPan = panClean.length === 10
			? `${panClean.slice(0, 5)}XXXX${panClean.slice(9)}`
			: "INVALID_PAN";

		const recordId = `CEFCOM-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
		const hashPayload = `${recordId}|${this.iaRegNo}|${input.clientPan}|${input.agreementRefId}|${totalAmount}`;
		const recordHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

		return {
			recordId,
			iaRegNo: this.iaRegNo,
			clientPanMasked: maskedPan,
			agreementRefId: input.agreementRefId,
			feeType: input.feeType,
			baseAmountInr: baseAmount,
			gstRatePercent: 18,
			gstAmountInr: gstAmount,
			totalAmountInr: totalAmount,
			billingPeriod: `${input.billingPeriodStart}_to_${input.billingPeriodEnd}`,
			validationStatus: validation.isValid ? "VALID" : "REJECTED",
			rejectionReason: validation.error,
			recordHash,
		};
	}

	/**
	 * Generates a standardized batch export file conforming to Exchange CeFCoM specifications
	 */
	public generateBatchExport(invoices: CeFCoMInvoiceInput[]): CeFCoMBatchExport {
		const batchId = `BATCH-CEFCOM-${Date.now()}`;
		const records = invoices.map((inv) => this.createRecord(inv));
		
		const validRecords = records.filter((r) => r.validationStatus === "VALID");
		const totalGross = validRecords.reduce((sum, r) => sum + r.baseAmountInr, 0);
		const totalGst = validRecords.reduce((sum, r) => sum + r.gstAmountInr, 0);

		// CSV header matching Exchange CeFCoM format
		const headers = [
			"Record_ID",
			"IA_Reg_No",
			"Client_PAN_Masked",
			"Agreement_Ref",
			"Fee_Type",
			"Base_Amount_INR",
			"GST_Amount_INR",
			"Total_Amount_INR",
			"Billing_Period",
			"Record_Hash",
		];

		const rows = validRecords.map((r) => [
			r.recordId,
			r.iaRegNo,
			r.clientPanMasked,
			r.agreementRefId,
			r.feeType,
			r.baseAmountInr.toFixed(2),
			r.gstAmountInr.toFixed(2),
			r.totalAmountInr.toFixed(2),
			r.billingPeriod,
			r.recordHash,
		]);

		const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
		const batchChecksum = crypto.createHash("sha256").update(csvContent).digest("hex");

		logger.info("[CeFCoM] Batch generated", {
			batchId,
			totalRecords: validRecords.length,
			totalGross,
			totalGst,
		});

		return {
			batchId,
			iaRegNo: this.iaRegNo,
			generatedAt: new Date().toISOString(),
			totalRecords: validRecords.length,
			totalGrossAmountInr: Math.round(totalGross * 100) / 100,
			totalGstAmountInr: Math.round(totalGst * 100) / 100,
			csvPayload: csvContent,
			batchChecksumSha256: batchChecksum,
		};
	}
}

export const cefcomService = new CeFCoMService();
