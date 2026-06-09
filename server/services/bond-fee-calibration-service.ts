import { db } from "../db";
import {
	bondFeeProfiles,
	bondFeeOverrides,
	bondCatalog,
	type BondFeeProfile,
	type InsertBondFeeProfile,
} from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

// RBI/SEBI Regulatory Fee Caps per Instrument Type
export const REGULATORY_FEE_CAPS = {
	gsec: {
		maxBrokerage: 0.025, // 0.025% for G-Secs
		maxPlatformFee: 0.05, // 0.05% platform fee
		stampDuty: false,
		notes: "RBI Retail Direct Guidelines - Minimal fees for retail investors",
	},
	tbill: {
		maxBrokerage: 0.0125, // 0.0125% for T-Bills
		maxPlatformFee: 0.025, // 0.025% platform fee
		stampDuty: false,
		notes: "Treasury Bills - Lowest fee structure",
	},
	sdl: {
		maxBrokerage: 0.025, // 0.025% for SDLs
		maxPlatformFee: 0.05, // 0.05% platform fee
		stampDuty: false,
		notes: "State Development Loans - Same as G-Secs",
	},
	sgb: {
		maxBrokerage: 0.5, // 0.50% distribution commission
		maxPlatformFee: 0, // No platform fee (RBI subsidized)
		stampDuty: false,
		notes:
			"Sovereign Gold Bonds - Distribution commission allowed, no platform fee",
	},
	corporate_bond: {
		maxBrokerage: 0.5, // 0.50% for corporate bonds
		maxPlatformFee: 0.25, // 0.25% platform fee
		stampDuty: true,
		stampDutyRate: 0.0001, // 0.01% stamp duty
		notes: "SEBI NCS Regulations - Listed Corporate Bonds",
	},
	ncd: {
		maxBrokerage: 0.5, // 0.50% for NCDs
		maxPlatformFee: 0.25, // 0.25% platform fee
		stampDuty: true,
		stampDutyRate: 0.0001,
		notes: "SEBI NCS Regulations - Non-Convertible Debentures",
	},
	infrastructure_bond: {
		maxBrokerage: 0.5, // 0.50% for infra bonds
		maxPlatformFee: 0.25, // 0.25% platform fee
		stampDuty: true,
		stampDutyRate: 0.0001,
		notes: "Section 54EC and Tax-Free Infrastructure Bonds",
	},
	unlisted_bond: {
		maxBrokerage: 1.0, // 1.00% for unlisted bonds
		maxPlatformFee: 0.5, // 0.50% platform fee
		stampDuty: true,
		stampDutyRate: 0.00015, // 0.015% stamp duty
		notes: "Unlisted/Private Bonds - Higher risk, higher fees allowed",
	},
	tax_free_bond: {
		maxBrokerage: 0.5, // 0.50% for tax-free bonds
		maxPlatformFee: 0.25, // 0.25% platform fee
		stampDuty: false, // No stamp duty on tax-free bonds
		notes: "Tax-Free Bonds from PSUs",
	},
} as const;

export type InstrumentType = keyof typeof REGULATORY_FEE_CAPS;

// Fee Calculation Result
export interface FeeBreakdown {
	platformFee: number;
	brokerageFee: number;
	transactionCharges: number;
	gstOnBrokerage: number;
	gstOnPlatformFee: number;
	stampDuty: number;
	totalFees: number;
	totalFeesPercentage: number;
	grossYield: number;
	netYield: number;
	netYieldAfterTax: number;
	effectiveCostBps: number; // Basis points impact on yield
	holdingPeriodYears: number;
	regulatoryCompliant: boolean;
	violations: string[];
}

// Net Yield Calculation Input
export interface NetYieldCalculationInput {
	instrumentType: InstrumentType;
	grossYield: number; // YTM in percentage
	transactionAmount: number;
	holdingPeriodYears?: number; // Default to maturity
	investorSegment: "retail" | "hni" | "institutional";
	taxBracket?: number; // For after-tax yield
	feeProfileId?: string;
	feeOverrideId?: string;
}

// Net Yield Result
export interface NetYieldResult {
	grossYield: number;
	netYield: number;
	netYieldAfterTax: number;
	feeImpactBps: number;
	taxImpactBps: number;
	totalImpactBps: number;
	annualizedFeePercentage: number;
	breakdown: {
		platformFeeAnnualized: number;
		brokerageFeeAnnualized: number;
		transactionChargesAnnualized: number;
		gstAnnualized: number;
		stampDutyAnnualized: number;
	};
	regulatoryCompliant: boolean;
	violations: string[];
}

// Fee Calculation Input
export interface FeeCalculationInput {
	instrumentType: InstrumentType;
	transactionAmount: number;
	grossYield: number;
	investorSegment: "retail" | "hni" | "institutional";
	transactionType: "buy" | "sell";
	feeProfileId?: string;
	feeOverrideId?: string;
}

class BondFeeCalibrationService {
	// Initialize default fee profiles for all instrument types
	async initializeDefaultProfiles(): Promise<void> {
		for (const [instrumentType, caps] of Object.entries(REGULATORY_FEE_CAPS)) {
			const existing = await db
				.select()
				.from(bondFeeProfiles)
				.where(eq(bondFeeProfiles.instrumentType, instrumentType))
				.limit(1);

			if (existing.length === 0) {
				// Create default profile with conservative fees (50% of max)
				await db.insert(bondFeeProfiles).values({
					instrumentType,
					instrumentLabel: this.getInstrumentLabel(
						instrumentType as InstrumentType,
					),
					platformFeeType: "percentage",
					platformFeeValue: String(caps.maxPlatformFee * 0.5), // 50% of max
					brokerageFeeType: "percentage",
					brokerageFeeValue: String(caps.maxBrokerage * 0.5), // 50% of max
					transactionCharges: "0",
					transactionChargesType: "percentage",
					regulatoryMaxBrokerage: String(caps.maxBrokerage),
					regulatoryMaxPlatformFee: String(caps.maxPlatformFee),
					gstApplicable: true,
					gstRate: "18",
					stampDutyApplicable: caps.stampDuty,
					stampDutyRate: caps.stampDuty
						? String((caps as any).stampDutyRate || 0)
						: "0",
					retailMultiplier: "1.00",
					hniMultiplier: "1.00",
					institutionalMultiplier: "0.50",
					buyFeeMultiplier: "1.00",
					sellFeeMultiplier: "1.00",
					regulatoryReference: this.getRegulatoryReference(
						instrumentType as InstrumentType,
					),
					regulatoryNotes: caps.notes,
					isActive: true,
				});
			}
		}
	}

	// Get all fee profiles
	async getAllProfiles(): Promise<BondFeeProfile[]> {
		return await db
			.select()
			.from(bondFeeProfiles)
			.orderBy(bondFeeProfiles.instrumentType);
	}

	// Get fee profile by instrument type
	async getProfileByInstrumentType(
		instrumentType: string,
	): Promise<BondFeeProfile | null> {
		const result = await db
			.select()
			.from(bondFeeProfiles)
			.where(
				and(
					eq(bondFeeProfiles.instrumentType, instrumentType),
					eq(bondFeeProfiles.isActive, true),
				),
			)
			.limit(1);
		return result[0] || null;
	}

	// Update fee profile
	async updateProfile(
		id: string,
		updates: Partial<InsertBondFeeProfile>,
		updatedBy?: string,
	): Promise<BondFeeProfile | null> {
		// Validate against regulatory caps
		if (updates.brokerageFeeValue || updates.platformFeeValue) {
			const profile = await db
				.select()
				.from(bondFeeProfiles)
				.where(eq(bondFeeProfiles.id, id))
				.limit(1);
			if (profile[0]) {
				const caps =
					REGULATORY_FEE_CAPS[profile[0].instrumentType as InstrumentType];
				if (caps) {
					if (
						updates.brokerageFeeValue &&
						Number.parseFloat(updates.brokerageFeeValue) > caps.maxBrokerage
					) {
						throw new Error(
							`Brokerage fee exceeds regulatory cap of ${caps.maxBrokerage}% for ${profile[0].instrumentType}`,
						);
					}
					if (
						updates.platformFeeValue &&
						Number.parseFloat(updates.platformFeeValue) > caps.maxPlatformFee
					) {
						throw new Error(
							`Platform fee exceeds regulatory cap of ${caps.maxPlatformFee}% for ${profile[0].instrumentType}`,
						);
					}
				}
			}
		}

		const result = await db
			.update(bondFeeProfiles)
			.set({ ...updates, updatedAt: new Date(), updatedBy })
			.where(eq(bondFeeProfiles.id, id))
			.returning();
		return result[0] || null;
	}

	// Calculate fees for a transaction
	async calculateFees(input: FeeCalculationInput): Promise<FeeBreakdown> {
		const {
			instrumentType,
			transactionAmount,
			grossYield,
			investorSegment,
			transactionType,
			feeProfileId,
			feeOverrideId,
		} = input;

		// Get fee profile
		let profile: BondFeeProfile | null = null;
		if (feeProfileId) {
			const profiles = await db
				.select()
				.from(bondFeeProfiles)
				.where(eq(bondFeeProfiles.id, feeProfileId))
				.limit(1);
			profile = profiles[0] || null;
		}
		if (!profile) {
			profile = await this.getProfileByInstrumentType(instrumentType);
		}

		// Get regulatory caps
		const caps = REGULATORY_FEE_CAPS[instrumentType];
		const violations: string[] = [];

		// Base fee rates
		let platformFeeRate = profile
			? Number.parseFloat(profile.platformFeeValue || "0")
			: caps.maxPlatformFee * 0.5;
		let brokerageRate = profile
			? Number.parseFloat(profile.brokerageFeeValue || "0")
			: caps.maxBrokerage * 0.5;
		let transactionChargesRate = profile
			? Number.parseFloat(profile.transactionCharges || "0")
			: 0;

		// Apply overrides if present
		if (feeOverrideId) {
			const overrides = await db
				.select()
				.from(bondFeeOverrides)
				.where(eq(bondFeeOverrides.id, feeOverrideId))
				.limit(1);
			if (overrides[0]) {
				if (overrides[0].platformFeeOverride)
					platformFeeRate = Number.parseFloat(overrides[0].platformFeeOverride);
				if (overrides[0].brokerageFeeOverride)
					brokerageRate = Number.parseFloat(overrides[0].brokerageFeeOverride);
				if (overrides[0].transactionChargesOverride)
					transactionChargesRate = Number.parseFloat(
						overrides[0].transactionChargesOverride,
					);
			}
		}

		// Apply investor segment multiplier
		let segmentMultiplier = 1.0;
		if (profile) {
			switch (investorSegment) {
				case "retail":
					segmentMultiplier = Number.parseFloat(
						profile.retailMultiplier || "1.00",
					);
					break;
				case "hni":
					segmentMultiplier = Number.parseFloat(
						profile.hniMultiplier || "1.00",
					);
					break;
				case "institutional":
					segmentMultiplier = Number.parseFloat(
						profile.institutionalMultiplier || "0.50",
					);
					break;
			}
		}

		// Apply transaction type multiplier
		let txnMultiplier = 1.0;
		if (profile) {
			txnMultiplier =
				transactionType === "buy"
					? Number.parseFloat(profile.buyFeeMultiplier || "1.00")
					: Number.parseFloat(profile.sellFeeMultiplier || "1.00");
		}

		// Apply multipliers
		platformFeeRate *= segmentMultiplier * txnMultiplier;
		brokerageRate *= segmentMultiplier * txnMultiplier;

		// Validate against regulatory caps
		if (brokerageRate > caps.maxBrokerage) {
			violations.push(
				`Brokerage ${brokerageRate}% exceeds regulatory cap of ${caps.maxBrokerage}%`,
			);
			brokerageRate = caps.maxBrokerage;
		}
		if (platformFeeRate > caps.maxPlatformFee) {
			violations.push(
				`Platform fee ${platformFeeRate}% exceeds regulatory cap of ${caps.maxPlatformFee}%`,
			);
			platformFeeRate = caps.maxPlatformFee;
		}

		// Calculate fee amounts
		const platformFee = (transactionAmount * platformFeeRate) / 100;
		const brokerageFee = (transactionAmount * brokerageRate) / 100;
		const transactionCharges =
			(transactionAmount * transactionChargesRate) / 100;

		// GST on fees (18%)
		const gstRate = profile ? Number.parseFloat(profile.gstRate || "18") : 18;
		const gstOnBrokerage = (brokerageFee * gstRate) / 100;
		const gstOnPlatformFee = (platformFee * gstRate) / 100;

		// Stamp duty
		let stampDuty = 0;
		if (caps.stampDuty && transactionType === "buy") {
			const stampDutyRate = profile
				? Number.parseFloat(profile.stampDutyRate || "0")
				: (caps as any).stampDutyRate || 0;
			stampDuty = transactionAmount * stampDutyRate;
		}

		// Total fees
		const totalFees =
			platformFee +
			brokerageFee +
			transactionCharges +
			gstOnBrokerage +
			gstOnPlatformFee +
			stampDuty;
		const totalFeesPercentage = (totalFees / transactionAmount) * 100;

		// Net yield calculation - annualize fees assuming 1 year holding period
		const holdingPeriodYears = 1;
		const annualizedFeeImpact = totalFeesPercentage / holdingPeriodYears;
		const netYield = grossYield - annualizedFeeImpact;

		// Calculate after-tax yield (assuming 30% tax bracket for taxable instruments)
		const isTaxFree =
			instrumentType === "tax_free_bond" || instrumentType === "sgb";
		const effectiveTaxRate = isTaxFree ? 0 : 30;
		const taxImpact = (netYield * effectiveTaxRate) / 100;
		const netYieldAfterTax = netYield - taxImpact;

		// Convert to basis points
		const effectiveCostBps = Math.round(annualizedFeeImpact * 100);

		return {
			platformFee: Math.round(platformFee * 100) / 100,
			brokerageFee: Math.round(brokerageFee * 100) / 100,
			transactionCharges: Math.round(transactionCharges * 100) / 100,
			gstOnBrokerage: Math.round(gstOnBrokerage * 100) / 100,
			gstOnPlatformFee: Math.round(gstOnPlatformFee * 100) / 100,
			stampDuty: Math.round(stampDuty * 100) / 100,
			totalFees: Math.round(totalFees * 100) / 100,
			totalFeesPercentage: Math.round(totalFeesPercentage * 10000) / 10000,
			grossYield,
			netYield: Math.round(netYield * 10000) / 10000,
			netYieldAfterTax: Math.round(netYieldAfterTax * 10000) / 10000,
			effectiveCostBps,
			holdingPeriodYears,
			regulatoryCompliant: violations.length === 0,
			violations,
		};
	}

	// Create fee override for a specific bond
	async createFeeOverride(data: {
		isin?: string;
		governmentSecurityId?: string;
		corporateBondId?: string;
		platformFeeOverride?: number;
		brokerageFeeOverride?: number;
		transactionChargesOverride?: number;
		overrideReason: string;
		createdBy?: string;
	}) {
		// Validate override values against regulatory caps
		// We need to determine the instrument type from the bond
		// For now, we'll use general corporate bond caps as default
		const caps = REGULATORY_FEE_CAPS.corporate_bond;

		if (
			data.brokerageFeeOverride &&
			data.brokerageFeeOverride > caps.maxBrokerage
		) {
			throw new Error(
				`Brokerage override ${data.brokerageFeeOverride}% exceeds regulatory cap of ${caps.maxBrokerage}%`,
			);
		}
		if (
			data.platformFeeOverride &&
			data.platformFeeOverride > caps.maxPlatformFee
		) {
			throw new Error(
				`Platform fee override ${data.platformFeeOverride}% exceeds regulatory cap of ${caps.maxPlatformFee}%`,
			);
		}

		const result = await db
			.insert(bondFeeOverrides)
			.values({
				isin: data.isin,
				governmentSecurityId: data.governmentSecurityId,
				corporateBondId: data.corporateBondId,
				platformFeeOverride: data.platformFeeOverride?.toString(),
				brokerageFeeOverride: data.brokerageFeeOverride?.toString(),
				transactionChargesOverride: data.transactionChargesOverride?.toString(),
				overrideReason: data.overrideReason,
				createdBy: data.createdBy,
			})
			.returning();

		return result[0];
	}

	// Helper: Get instrument label
	private getInstrumentLabel(type: InstrumentType): string {
		const labels: Record<InstrumentType, string> = {
			gsec: "Government Securities",
			tbill: "Treasury Bills",
			sdl: "State Development Loans",
			sgb: "Sovereign Gold Bonds",
			corporate_bond: "Corporate Bonds",
			ncd: "Non-Convertible Debentures",
			infrastructure_bond: "Infrastructure Bonds",
			unlisted_bond: "Unlisted Bonds",
			tax_free_bond: "Tax-Free Bonds",
		};
		return labels[type] || type;
	}

	// Helper: Get regulatory reference
	private getRegulatoryReference(type: InstrumentType): string {
		const refs: Record<InstrumentType, string> = {
			gsec: "RBI Retail Direct Scheme Guidelines 2021",
			tbill: "RBI Retail Direct Scheme Guidelines 2021",
			sdl: "RBI Retail Direct Scheme Guidelines 2021",
			sgb: "RBI Sovereign Gold Bond Scheme",
			corporate_bond:
				"SEBI (Issue and Listing of Non-Convertible Securities) Regulations, 2021",
			ncd: "SEBI NCS Regulations 2021",
			infrastructure_bond: "Section 54EC, SEBI NCS Regulations",
			unlisted_bond: "Companies Act 2013, SEBI Guidelines",
			tax_free_bond: "SEBI NCS Regulations, Income Tax Act Section 10(15)",
		};
		return refs[type] || "SEBI/RBI Guidelines";
	}

	// Get regulatory caps for display
	getRegulatoryCaps() {
		return REGULATORY_FEE_CAPS;
	}

	// Calculate net yield with detailed breakdown
	async calculateNetYield(
		input: NetYieldCalculationInput,
	): Promise<NetYieldResult> {
		const {
			instrumentType,
			grossYield,
			transactionAmount,
			holdingPeriodYears = 1,
			investorSegment,
			taxBracket = 30,
			feeProfileId,
			feeOverrideId,
		} = input;

		// Get fee profile
		let profile: BondFeeProfile | null = null;
		if (feeProfileId) {
			const profiles = await db
				.select()
				.from(bondFeeProfiles)
				.where(eq(bondFeeProfiles.id, feeProfileId))
				.limit(1);
			profile = profiles[0] || null;
		}
		if (!profile) {
			profile = await this.getProfileByInstrumentType(instrumentType);
		}

		// Get regulatory caps
		const caps = REGULATORY_FEE_CAPS[instrumentType];
		const violations: string[] = [];

		// Base fee rates
		let platformFeeRate = profile
			? Number.parseFloat(profile.platformFeeValue || "0")
			: caps.maxPlatformFee * 0.5;
		let brokerageRate = profile
			? Number.parseFloat(profile.brokerageFeeValue || "0")
			: caps.maxBrokerage * 0.5;
		let transactionChargesRate = profile
			? Number.parseFloat(profile.transactionCharges || "0")
			: 0;

		// Apply overrides if present
		if (feeOverrideId) {
			const overrides = await db
				.select()
				.from(bondFeeOverrides)
				.where(eq(bondFeeOverrides.id, feeOverrideId))
				.limit(1);
			if (overrides[0]) {
				if (overrides[0].platformFeeOverride)
					platformFeeRate = Number.parseFloat(overrides[0].platformFeeOverride);
				if (overrides[0].brokerageFeeOverride)
					brokerageRate = Number.parseFloat(overrides[0].brokerageFeeOverride);
				if (overrides[0].transactionChargesOverride)
					transactionChargesRate = Number.parseFloat(
						overrides[0].transactionChargesOverride,
					);
			}
		}

		// Apply investor segment multiplier
		let segmentMultiplier = 1.0;
		if (profile) {
			switch (investorSegment) {
				case "retail":
					segmentMultiplier = Number.parseFloat(
						profile.retailMultiplier || "1.00",
					);
					break;
				case "hni":
					segmentMultiplier = Number.parseFloat(
						profile.hniMultiplier || "1.00",
					);
					break;
				case "institutional":
					segmentMultiplier = Number.parseFloat(
						profile.institutionalMultiplier || "0.50",
					);
					break;
			}
		}

		// Apply multipliers
		platformFeeRate *= segmentMultiplier;
		brokerageRate *= segmentMultiplier;

		// Validate against regulatory caps
		if (brokerageRate > caps.maxBrokerage) {
			violations.push(
				`Brokerage ${brokerageRate.toFixed(4)}% exceeds regulatory cap of ${caps.maxBrokerage}%`,
			);
			brokerageRate = caps.maxBrokerage;
		}
		if (platformFeeRate > caps.maxPlatformFee) {
			violations.push(
				`Platform fee ${platformFeeRate.toFixed(4)}% exceeds regulatory cap of ${caps.maxPlatformFee}%`,
			);
			platformFeeRate = caps.maxPlatformFee;
		}

		// Calculate one-time fee amounts as percentage
		const platformFeePercent = platformFeeRate;
		const brokerageFeePercent = brokerageRate;
		const transactionChargesPercent = transactionChargesRate;

		// GST on fees (18%)
		const gstRate = profile ? Number.parseFloat(profile.gstRate || "18") : 18;
		const gstOnBrokeragePercent = (brokerageFeePercent * gstRate) / 100;
		const gstOnPlatformFeePercent = (platformFeePercent * gstRate) / 100;
		const totalGstPercent = gstOnBrokeragePercent + gstOnPlatformFeePercent;

		// Stamp duty (one-time on buy)
		let stampDutyPercent = 0;
		if (caps.stampDuty) {
			const stampDutyRate = profile
				? Number.parseFloat(profile.stampDutyRate || "0")
				: (caps as any).stampDutyRate || 0;
			stampDutyPercent = stampDutyRate * 100; // Convert to percentage
		}

		// Total one-time fees as percentage
		const totalOneTimeFees =
			platformFeePercent +
			brokerageFeePercent +
			transactionChargesPercent +
			totalGstPercent +
			stampDutyPercent;

		// Annualize the one-time fees across holding period
		// Formula: annualized impact = one-time fee % / holding period years
		const annualizedFeePercentage =
			holdingPeriodYears > 0
				? totalOneTimeFees / holdingPeriodYears
				: totalOneTimeFees;

		// Calculate net yield (gross yield minus annualized fees)
		const netYield = grossYield - annualizedFeePercentage;

		// Calculate after-tax yield for taxable bonds
		const isTaxFree =
			instrumentType === "tax_free_bond" || instrumentType === "sgb";
		const effectiveTaxRate = isTaxFree ? 0 : taxBracket;
		const taxImpact = (netYield * effectiveTaxRate) / 100;
		const netYieldAfterTax = netYield - taxImpact;

		// Convert to basis points for easy comparison
		const feeImpactBps = Math.round(annualizedFeePercentage * 100);
		const taxImpactBps = Math.round(taxImpact * 100);
		const totalImpactBps = feeImpactBps + taxImpactBps;

		// Breakdown annualized
		const breakdown = {
			platformFeeAnnualized:
				Math.round((platformFeePercent / (holdingPeriodYears || 1)) * 10000) /
				10000,
			brokerageFeeAnnualized:
				Math.round((brokerageFeePercent / (holdingPeriodYears || 1)) * 10000) /
				10000,
			transactionChargesAnnualized:
				Math.round(
					(transactionChargesPercent / (holdingPeriodYears || 1)) * 10000,
				) / 10000,
			gstAnnualized:
				Math.round((totalGstPercent / (holdingPeriodYears || 1)) * 10000) /
				10000,
			stampDutyAnnualized:
				Math.round((stampDutyPercent / (holdingPeriodYears || 1)) * 10000) /
				10000,
		};

		return {
			grossYield: Math.round(grossYield * 10000) / 10000,
			netYield: Math.round(netYield * 10000) / 10000,
			netYieldAfterTax: Math.round(netYieldAfterTax * 10000) / 10000,
			feeImpactBps,
			taxImpactBps,
			totalImpactBps,
			annualizedFeePercentage:
				Math.round(annualizedFeePercentage * 10000) / 10000,
			breakdown,
			regulatoryCompliant: violations.length === 0,
			violations,
		};
	}

	// Calculate net yield for a bond catalog entry
	async calculateNetYieldForBond(
		bondId: string,
		investorSegment: "retail" | "hni" | "institutional" = "retail",
	): Promise<NetYieldResult | null> {
		// Get bond from catalog
		const bonds = await db
			.select()
			.from(bondCatalog)
			.where(eq(bondCatalog.id, bondId))
			.limit(1);
		if (!bonds[0]) return null;

		const bond = bonds[0];
		const grossYield = Number.parseFloat(bond.yieldToMaturity || "0");
		const transactionAmount = Number.parseFloat(bond.minInvestment || "100000");

		// Calculate holding period from maturity date
		let holdingPeriodYears = 1;
		if (bond.maturityDate) {
			const now = new Date();
			const maturity = new Date(bond.maturityDate);
			holdingPeriodYears = Math.max(
				0.25,
				(maturity.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
			);
		}

		return this.calculateNetYield({
			instrumentType: bond.instrumentType as InstrumentType,
			grossYield,
			transactionAmount,
			holdingPeriodYears,
			investorSegment,
			feeProfileId: bond.feeProfileId || undefined,
			feeOverrideId: bond.feeOverrideId || undefined,
		});
	}

	// Batch calculate net yields for multiple bonds
	async calculateNetYieldsForBonds(
		bondIds: string[],
		investorSegment: "retail" | "hni" | "institutional" = "retail",
	): Promise<Map<string, NetYieldResult>> {
		const results = new Map<string, NetYieldResult>();

		for (const bondId of bondIds) {
			const result = await this.calculateNetYieldForBond(
				bondId,
				investorSegment,
			);
			if (result) {
				results.set(bondId, result);
			}
		}

		return results;
	}
}

export const bondFeeCalibrationService = new BondFeeCalibrationService();
