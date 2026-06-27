// @ts-nocheck
/** GCR: bump when any fee structure, GST rate, or waiver logic changes */
export const FEE_CALCULATOR_ENGINE_VERSION = "1.0.0-FASP";
import { db } from "../db";
import { platformFeeConfig, type PlatformFeeConfig } from "@shared/schema";
import { eq, and, isNull, lte, or, gte } from "drizzle-orm";

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
}

export const feeCalculatorService = new FeeCalculatorService();
console.log("✅ Fee Calculator Service initialized");
