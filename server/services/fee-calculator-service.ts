// @ts-nocheck
/* eslint-disable no-console */
/** GCR: bump when any fee structure, GST rate, or waiver logic changes */
export const FEE_CALCULATOR_ENGINE_VERSION = "2.0.0-SEBI-MASTER-CIRCULAR-2026";
import { db } from "../db";
import { platformFeeConfig, type PlatformFeeConfig } from "@shared/schema";
import { eq, and, isNull, lte, or, gte } from "drizzle-orm";

/**
 * SEBI Master Circular for Investment Advisers (effective Feb 6, 2026)
 * Fee Caps per individual client / family of clients across all services:
 * - Fixed Fee mode: Maximum ₹1,51,000 per annum per family across all schemes
 * - AUA-based mode: Maximum 2.5% of Assets Under Advice (AUA) per annum per family
 * - Advance fees: Maximum 1 year in advance (charging fees >1 year in advance prohibited)
 * - Supervisory body: BSE Administration & Supervision Ltd (BASL) / IAASB
 */
export const IA_FEE_CAPS_2026 = {
	CIRCULAR_REF: "SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2026/16",
	EFFECTIVE_DATE: "2026-02-06",
	SUPERVISORY_BODY: "BASL (BSE Administration & Supervision Ltd) / IAASB",
	FIXED_FEE_MAX_PER_ANNUM_INR: 151000,
	AUA_FEE_MAX_PERCENT: 2.5,
	MAX_ADVANCE_FEE_MONTHS: 12,
} as const;

export interface IAFeeComplianceCheck {
	compliant: boolean;
	feeMode: "fixed" | "aua";
	proposedFee: number;
	maxPermissibleFee: number;
	aua?: number;
	advanceMonths?: number;
	message: string;
	supervisoryBody: string;
	regulatoryRef: string;
}

export interface FeeCalculationInput {
	transactionAmount: number;
	productType: string; // equity, mutual_fund, bond, unlisted, ipo, derivatives, tax_services, advisory
	investorTier?: "retail" | "sHNI" | "bHNI" | "qib";
	includeGst?: boolean;
	applyWaivers?: boolean;
	waiverPercent?: number;
}

export interface CalculatedFee {
	feeCode: string;
	feeName: string;
	displayLabel: string;
	category: string;
	baseAmount: number;
	gstAmount: number;
	totalAmount: number;
	isRegulatory: boolean;
	isWaived: boolean;
	waiverAmount: number;
	rateApplied: string;
	chargeType: string;
}

export interface FeeBreakdown {
	transactionAmount: number;
	productType: string;
	investorTier: string;
	fees: CalculatedFee[];
	totalFees: number;
	totalGst: number;
	totalWaivers: number;
	grandTotal: number;
	breakdown: {
		regulatory: number;
		platform: number;
		advisory: number;
		document: number;
		convenience: number;
		valueAdded: number;
	};
	/** GCR Financial Logic Integrity */
	engine_version: string;
	calculation_timestamp: string;
}

class FeeCalculatorService {
	private feeCache: PlatformFeeConfig[] = [];
	private lastCacheTime: number = 0;
	private cacheTTL = 5 * 60 * 1000; // 5 minutes

	async getApplicableFees(productType: string): Promise<PlatformFeeConfig[]> {
		if (
			Date.now() - this.lastCacheTime > this.cacheTTL ||
			this.feeCache.length === 0
		) {
			this.feeCache = await db
				.select()
				.from(platformFeeConfig)
				.where(eq(platformFeeConfig.isActive, true));
			this.lastCacheTime = Date.now();
		}

		return this.feeCache.filter(
			(fee) => fee.applicableTo === "all" || fee.applicableTo === productType,
		);
	}

	calculateSingleFee(
		fee: PlatformFeeConfig,
		amount: number,
		investorTier: string = "retail",
		applyWaiver: boolean = false,
		waiverPercent: number = 0,
	): CalculatedFee {
		let baseAmount = 0;
		let rateApplied = "";

		const tierRates = fee.investorTierRates as
			| Record<string, number>
			| null
			| undefined;
		let rate = Number.parseFloat(fee.rateValue || "0");
		if (Number.isNaN(rate)) rate = 0;

		if (
			tierRates &&
			typeof tierRates === "object" &&
			tierRates[investorTier] !== undefined
		) {
			const tierRate = tierRates[investorTier];
			if (typeof tierRate === "number" && !Number.isNaN(tierRate)) {
				rate = tierRate;
			}
		}

		switch (fee.chargeType) {
			case "percentage":
				if (fee.rateUnit === "bps") {
					baseAmount = amount * (rate / 10000);
					rateApplied = `${rate} bps`;
				} else {
					baseAmount = amount * (rate / 100);
					rateApplied = `${rate}%`;
				}
				break;

			case "flat":
				baseAmount = rate;
				rateApplied = `₹${rate.toLocaleString("en-IN")}`;
				break;

			case "per_unit":
				baseAmount = rate;
				rateApplied = `₹${rate}/unit`;
				break;

			case "tiered": {
				const slabs = fee.tierSlabs as
					| Array<{ from: number; to: number; rate: number }>
					| null
					| undefined;
				if (slabs && Array.isArray(slabs) && slabs.length > 0) {
					const applicableSlab = slabs.find(
						(s) =>
							s &&
							typeof s.from === "number" &&
							typeof s.to === "number" &&
							typeof s.rate === "number" &&
							amount >= s.from &&
							amount <= s.to,
					);
					if (applicableSlab) {
						baseAmount = amount * (applicableSlab.rate / 100);
						rateApplied = `${applicableSlab.rate}% (tiered)`;
					}
				}
				break;
			}

			case "hybrid": {
				const flatPart = Number.parseFloat(fee.minAmount || "0") || 0;
				baseAmount = flatPart + amount * (rate / 100);
				rateApplied = `₹${flatPart} + ${rate}%`;
				break;
			}
		}

		const minAmount = Number.parseFloat(fee.minAmount || "0") || 0;
		const maxAmountStr = fee.maxAmount;
		const maxAmount = maxAmountStr ? Number.parseFloat(maxAmountStr) : null;

		if (baseAmount < minAmount) baseAmount = minAmount;
		if (
			maxAmount !== null &&
			!Number.isNaN(maxAmount) &&
			baseAmount > maxAmount
		)
			baseAmount = maxAmount;

		let waiverAmount = 0;
		let isWaived = false;
		if (applyWaiver && fee.isWaivable && waiverPercent > 0) {
			const maxWaiver = Number.parseFloat(fee.maxWaiverPercent || "0") || 0;
			const effectiveWaiver = Math.min(
				waiverPercent,
				maxWaiver > 0 ? maxWaiver : 100,
			);
			waiverAmount = baseAmount * (effectiveWaiver / 100);
			baseAmount -= waiverAmount;
			isWaived = waiverAmount > 0;
		}

		let gstAmount = 0;
		if (fee.isGstApplicable) {
			const gstRate = Number.parseFloat(fee.gstRate || "18") || 18;
			gstAmount = baseAmount * (gstRate / 100);
		}

		return {
			feeCode: fee.feeCode,
			feeName: fee.feeName,
			displayLabel: fee.displayLabel || fee.feeName,
			category: fee.category,
			baseAmount: Math.round(baseAmount * 100) / 100,
			gstAmount: Math.round(gstAmount * 100) / 100,
			totalAmount: Math.round((baseAmount + gstAmount) * 100) / 100,
			isRegulatory: fee.isRegulatory || false,
			isWaived,
			waiverAmount: Math.round(waiverAmount * 100) / 100,
			rateApplied,
			chargeType: fee.chargeType,
		};
	}

	async calculateFees(input: FeeCalculationInput): Promise<FeeBreakdown> {
		const {
			transactionAmount,
			productType,
			investorTier = "retail",
			includeGst = true,
			applyWaivers = false,
			waiverPercent = 0,
		} = input;

		const applicableFees = await this.getApplicableFees(productType);
		const calculatedFees: CalculatedFee[] = [];

		for (const fee of applicableFees) {
			const calculated = this.calculateSingleFee(
				fee,
				transactionAmount,
				investorTier,
				applyWaivers,
				waiverPercent,
			);

			if (calculated.baseAmount > 0 || calculated.isRegulatory) {
				if (!includeGst) {
					calculated.gstAmount = 0;
					calculated.totalAmount = calculated.baseAmount;
				}
				calculatedFees.push(calculated);
			}
		}

		calculatedFees.sort((a, b) => {
			const categoryOrder = [
				"regulatory",
				"platform",
				"advisory",
				"document",
				"convenience",
				"value_added",
			];
			return (
				categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
			);
		});

		const breakdown = {
			regulatory: 0,
			platform: 0,
			advisory: 0,
			document: 0,
			convenience: 0,
			valueAdded: 0,
		};

		let totalFees = 0;
		let totalGst = 0;
		let totalWaivers = 0;

		for (const fee of calculatedFees) {
			totalFees += fee.baseAmount;
			totalGst += fee.gstAmount;
			totalWaivers += fee.waiverAmount;

			switch (fee.category) {
				case "regulatory":
					breakdown.regulatory += fee.totalAmount;
					break;
				case "platform":
					breakdown.platform += fee.totalAmount;
					break;
				case "advisory":
					breakdown.advisory += fee.totalAmount;
					break;
				case "document":
					breakdown.document += fee.totalAmount;
					break;
				case "convenience":
					breakdown.convenience += fee.totalAmount;
					break;
				case "value_added":
					breakdown.valueAdded += fee.totalAmount;
					break;
			}
		}

		return {
			transactionAmount,
			productType,
			investorTier,
			fees: calculatedFees,
			totalFees: Math.round(totalFees * 100) / 100,
			totalGst: Math.round(totalGst * 100) / 100,
			totalWaivers: Math.round(totalWaivers * 100) / 100,
			grandTotal: Math.round((totalFees + totalGst) * 100) / 100,
			breakdown,
			engine_version: FEE_CALCULATOR_ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	async getStampDuty(productType: string, amount: number): Promise<number> {
		const fees = await this.getApplicableFees(productType);
		const stampDutyFee = fees.find((f) => f.feeCode.includes("STAMP_DUTY"));

		if (!stampDutyFee) return 0;

		const calculated = this.calculateSingleFee(stampDutyFee, amount);
		return calculated.baseAmount;
	}

	async getSTT(
		productType: string,
		amount: number,
		side: "buy" | "sell" = "both",
	): Promise<number> {
		const fees = await this.getApplicableFees(productType);
		const sttFees = fees.filter((f) => f.feeCode.startsWith("STT_"));

		let totalSTT = 0;
		for (const fee of sttFees) {
			const payer = (fee as any).payer;
			if (payer === "both" || payer === side || payer === "client") {
				const calculated = this.calculateSingleFee(fee, amount);
				totalSTT += calculated.baseAmount;
			}
		}
		return totalSTT;
	}

	async getBrokerage(
		productType: string,
		amount: number,
		investorTier: string = "retail",
	): Promise<number> {
		const fees = await this.getApplicableFees(productType);
		const brokerageFee = fees.find((f) => f.feeCode.startsWith("BROKERAGE_"));

		if (!brokerageFee) return 0;

		const calculated = this.calculateSingleFee(
			brokerageFee,
			amount,
			investorTier,
		);
		return calculated.baseAmount;
	}

	clearCache(): void {
		this.feeCache = [];
		this.lastCacheTime = 0;
	}

	/**
	 * Calculate aggregated fees for mixed-category baskets.
	 * Calculates fees per product type and merges results, avoiding duplicate platform-wide fees.
	 */
	async calculateAggregatedFees(input: {
		items: Array<{ productType: string; amount: number }>;
		investorTier?: "retail" | "sHNI" | "bHNI" | "qib";
		includeGst?: boolean;
		applyWaivers?: boolean;
		waiverPercent?: number;
	}): Promise<FeeBreakdown> {
		const {
			items,
			investorTier = "retail",
			includeGst = true,
			applyWaivers = false,
			waiverPercent = 0,
		} = input;

		// Get all applicable fees from cache
		if (
			Date.now() - this.lastCacheTime > this.cacheTTL ||
			this.feeCache.length === 0
		) {
			this.feeCache = await db
				.select()
				.from(platformFeeConfig)
				.where(eq(platformFeeConfig.isActive, true));
			this.lastCacheTime = Date.now();
		}

		// Calculate total amount for platform-wide fees
		const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

		// Get unique product types
		const productTypes = [...new Set(items.map((i) => i.productType))];

		// Track which fees have been applied (to avoid duplicates for 'all' fees)
		const appliedFeeCodes = new Set<string>();
		const calculatedFees: CalculatedFee[] = [];

		// First, calculate category-specific fees for each product type
		for (const productType of productTypes) {
			const itemsOfType = items.filter((i) => i.productType === productType);
			const typeAmount = itemsOfType.reduce((sum, i) => sum + i.amount, 0);

			// Get category-specific fees (not 'all')
			const categoryFees = this.feeCache.filter(
				(fee) => fee.applicableTo === productType,
			);

			for (const fee of categoryFees) {
				if (appliedFeeCodes.has(fee.feeCode)) continue;

				const calculated = this.calculateSingleFee(
					fee,
					typeAmount,
					investorTier,
					applyWaivers,
					waiverPercent,
				);

				if (calculated.baseAmount > 0 || calculated.isRegulatory) {
					if (!includeGst) {
						calculated.gstAmount = 0;
						calculated.totalAmount = calculated.baseAmount;
					}
					// Add source product type for display
					(calculated as any).sourceProductType = productType;
					calculatedFees.push(calculated);
					appliedFeeCodes.add(fee.feeCode);
				}
			}
		}

		// Then, calculate platform-wide fees ('all') on total amount
		const platformWideFees = this.feeCache.filter(
			(fee) => fee.applicableTo === "all",
		);

		for (const fee of platformWideFees) {
			if (appliedFeeCodes.has(fee.feeCode)) continue;

			const calculated = this.calculateSingleFee(
				fee,
				totalAmount,
				investorTier,
				applyWaivers,
				waiverPercent,
			);

			if (calculated.baseAmount > 0 || calculated.isRegulatory) {
				if (!includeGst) {
					calculated.gstAmount = 0;
					calculated.totalAmount = calculated.baseAmount;
				}
				(calculated as any).sourceProductType = "all";
				calculatedFees.push(calculated);
				appliedFeeCodes.add(fee.feeCode);
			}
		}

		// Sort by category order
		calculatedFees.sort((a, b) => {
			const categoryOrder = [
				"regulatory",
				"platform",
				"advisory",
				"document",
				"convenience",
				"value_added",
			];
			return (
				categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
			);
		});

		// Calculate totals
		const breakdown = {
			regulatory: 0,
			platform: 0,
			advisory: 0,
			document: 0,
			convenience: 0,
			valueAdded: 0,
		};

		let totalFees = 0;
		let totalGst = 0;
		let totalWaivers = 0;

		for (const fee of calculatedFees) {
			totalFees += fee.baseAmount;
			totalGst += fee.gstAmount;
			totalWaivers += fee.waiverAmount;

			switch (fee.category) {
				case "regulatory":
					breakdown.regulatory += fee.totalAmount;
					break;
				case "platform":
					breakdown.platform += fee.totalAmount;
					break;
				case "advisory":
					breakdown.advisory += fee.totalAmount;
					break;
				case "document":
					breakdown.document += fee.totalAmount;
					break;
				case "convenience":
					breakdown.convenience += fee.totalAmount;
					break;
				case "value_added":
					breakdown.valueAdded += fee.totalAmount;
					break;
			}
		}

		return {
			transactionAmount: totalAmount,
			productType: productTypes.length === 1 ? productTypes[0] : "mixed",
			investorTier,
			fees: calculatedFees,
			totalFees: Math.round(totalFees * 100) / 100,
			totalGst: Math.round(totalGst * 100) / 100,
			totalWaivers: Math.round(totalWaivers * 100) / 100,
			grandTotal: Math.round((totalFees + totalGst) * 100) / 100,
			breakdown,
		};
	}

	/**
	 * Validates proposed Investment Adviser fees against SEBI Master Circular 2026 statutory ceilings.
	 * Mandates fixed fee <= ₹1,51,000 p.a. per family OR AUA fee <= 2.5% of AUA, and advance <= 12 months.
	 */
	validateIAFeeCompliance(input: {
		feeMode: "fixed" | "aua";
		proposedFeePerAnnum: number;
		aua?: number;
		advanceMonths?: number;
	}): IAFeeComplianceCheck {
		return validateIAFeeCompliance(input);
	}
}

/**
 * Validates proposed Investment Adviser fees against SEBI Master Circular 2026 statutory ceilings.
 */
export function validateIAFeeCompliance(input: {
	feeMode: "fixed" | "aua";
	proposedFeePerAnnum: number;
	aua?: number;
	advanceMonths?: number;
}): IAFeeComplianceCheck {
	const { feeMode, proposedFeePerAnnum, aua = 0, advanceMonths = 12 } = input;
	const ref = IA_FEE_CAPS_2026.CIRCULAR_REF;
	const body = IA_FEE_CAPS_2026.SUPERVISORY_BODY;

	// Check advance payment duration
	if (advanceMonths > IA_FEE_CAPS_2026.MAX_ADVANCE_FEE_MONTHS) {
		const maxPermissible =
			feeMode === "fixed"
				? IA_FEE_CAPS_2026.FIXED_FEE_MAX_PER_ANNUM_INR
				: (aua * IA_FEE_CAPS_2026.AUA_FEE_MAX_PERCENT) / 100;
		return {
			compliant: false,
			feeMode,
			proposedFee: proposedFeePerAnnum,
			maxPermissibleFee: maxPermissible,
			aua,
			advanceMonths,
			message: `Prohibited advance fee duration: SEBI caps advance advisory fees to a maximum of ${IA_FEE_CAPS_2026.MAX_ADVANCE_FEE_MONTHS} months (${advanceMonths} requested).`,
			supervisoryBody: body,
			regulatoryRef: ref,
		};
	}

	if (feeMode === "fixed") {
		const maxFee = IA_FEE_CAPS_2026.FIXED_FEE_MAX_PER_ANNUM_INR;
		const compliant = proposedFeePerAnnum <= maxFee;
		return {
			compliant,
			feeMode,
			proposedFee: proposedFeePerAnnum,
			maxPermissibleFee: maxFee,
			advanceMonths,
			message: compliant
				? `Fixed IA fee of ₹${proposedFeePerAnnum.toLocaleString("en-IN")}/yr complies with SEBI ceiling (max ₹${maxFee.toLocaleString("en-IN")}/yr per family).`
				: `Fixed IA fee breach: Proposed ₹${proposedFeePerAnnum.toLocaleString("en-IN")}/yr exceeds SEBI statutory ceiling of ₹${maxFee.toLocaleString("en-IN")}/yr per family.`,
			supervisoryBody: body,
			regulatoryRef: ref,
		};
	} else {
		// AUA mode
		const maxFee = (aua * IA_FEE_CAPS_2026.AUA_FEE_MAX_PERCENT) / 100;
		const effectiveRatePct = aua > 0 ? (proposedFeePerAnnum / aua) * 100 : 0;
		const compliant = effectiveRatePct <= IA_FEE_CAPS_2026.AUA_FEE_MAX_PERCENT;
		return {
			compliant,
			feeMode,
			proposedFee: proposedFeePerAnnum,
			maxPermissibleFee: Math.round(maxFee * 100) / 100,
			aua,
			advanceMonths,
			message: compliant
				? `AUA-based IA fee (${effectiveRatePct.toFixed(2)}%) complies with SEBI cap (max ${IA_FEE_CAPS_2026.AUA_FEE_MAX_PERCENT}% of AUA).`
				: `AUA-based IA fee breach: ${effectiveRatePct.toFixed(2)}% exceeds SEBI statutory ceiling of ${IA_FEE_CAPS_2026.AUA_FEE_MAX_PERCENT}% of AUA. Max permissible is ₹${Math.round(maxFee).toLocaleString("en-IN")}.`,
			supervisoryBody: body,
			regulatoryRef: ref,
		};
	}
}

export const feeCalculatorService = new FeeCalculatorService();
console.log("✅ Fee Calculator Service initialized");
