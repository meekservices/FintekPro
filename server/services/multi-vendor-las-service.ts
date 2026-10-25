/**
 * Multi-Vendor LAS/LAMF Aggregator Service — IRIS & Smallcase
 *
 * Coordinates between FintekPro's two licensed LAS loan gateways:
 *   1. IRIS KFintech — Direct RTA mutual fund folios & depository pledge (TPIN/OTP)
 *   2. Smallcase Gateway — Multi-broker demat equities, ETFs, and shares
 *
 * Provides:
 *   - Provider capability directory & live status
 *   - Side-by-side comparative quotes (LTV, interest rates, processing fees, turn-around times)
 *   - Consolidated total borrowing power across both MF + Equity collateral pools
 *   - Smart recommendation engine (picks the optimal provider based on collateral mix)
 *
 * Adheres to FintekPro GCR v1.0 & FASP-AI v1.0.
 *
 * @module multi-vendor-las-service
 */

import { irisLasService, LasEligibilityResult } from "./iris-las-service";
import { smallcaseLasService, SmallcaseLasEligibilityResult } from "./smallcase-las-service";
import { logger } from "../logger";

const ENGINE_VERSION = "multi-las-v2.0";

export interface LasProviderInfo {
	id: "IRIS" | "SMALLCASE";
	name: string;
	tagline: string;
	primaryCollateral: "MUTUAL_FUNDS" | "DEMAT_EQUITIES" | "BOTH";
	supportedLenders: string[];
	indicativeInterestRate: {
		min: number;
		max: number;
		label: string;
	};
	ltvPolicy: {
		equityMax: number; // e.g. 50%
		debtMax: number;   // e.g. 80%
	};
	lienMechanism: "TPIN_OTP" | "GATEWAY_SDK";
	turnaroundTime: string;
	processingFeeLabel: string;
	isActive: boolean;
	isConfigured: boolean;
}

export interface MultiVendorLasComparison {
	pan: string;
	providers: LasProviderInfo[];
	irisQuote?: LasEligibilityResult;
	smallcaseQuote?: SmallcaseLasEligibilityResult;
	consolidated: {
		totalGrossCollateral: number;
		totalPledgeableCollateral: number;
		combinedMaxLoanAmount: number;
		recommendedProvider: "IRIS" | "SMALLCASE" | "DUAL_PLEDGE";
		recommendationRationale: string;
	};
	engine_version: string;
	calculation_timestamp: string;
}

class MultiVendorLasService {
	/**
	 * Returns directory of supported LAS loan providers and their operational status.
	 */
	getProviders(): LasProviderInfo[] {
		return [
			{
				id: "IRIS",
				name: "IRIS (KFintech)",
				tagline: "Direct RTA Lien on Mutual Fund Folios",
				primaryCollateral: "MUTUAL_FUNDS",
				supportedLenders: ["HDFC Bank", "Bajaj Finance", "ICICI Bank", "Tata Capital"],
				indicativeInterestRate: {
					min: 9.5,
					max: 10.75,
					label: "9.50% – 10.75% p.a.",
				},
				ltvPolicy: {
					equityMax: 50,
					debtMax: 80,
				},
				lienMechanism: "TPIN_OTP",
				turnaroundTime: "2 to 4 hours (Instant for pre-approved)",
				processingFeeLabel: "0.50% or ₹1,000 (whichever is lower)",
				isActive: true,
				isConfigured: true,
			},
			{
				id: "SMALLCASE",
				name: "Smallcase Gateway",
				tagline: "Multi-Broker Demat Equities & ETFs Pledging",
				primaryCollateral: "DEMAT_EQUITIES",
				supportedLenders: ["Smallcase Capital", "Bajaj Finance", "VoloFin", "Mirae Asset"],
				indicativeInterestRate: {
					min: 9.99,
					max: 11.25,
					label: "9.99% – 11.25% p.a.",
				},
				ltvPolicy: {
					equityMax: 50,
					debtMax: 70,
				},
				lienMechanism: "GATEWAY_SDK",
				turnaroundTime: "Same day (within 24 hours)",
				processingFeeLabel: "Flat ₹999 + GST",
				isActive: true,
				isConfigured: smallcaseLasService.isConfigured,
			},
		];
	}

	/**
	 * Produces a side-by-side comparative eligibility analysis across both IRIS and Smallcase.
	 *
	 * Inputs: pan, optional folio filter, optional smallcaseAuthId
	 * Outputs: MultiVendorLasComparison with combined borrowing power and FASP recommendations
	 */
	async getComparativeEligibility(
		pan: string,
		opts: {
			folioNos?: string[];
			dpId?: string;
			smallcaseAuthId?: string;
		} = {},
	): Promise<MultiVendorLasComparison> {
		const ts = new Date().toISOString();
		const maskedPan = pan.slice(0, 5) + "*****";

		logger.info("[MultiVendorLAS] Evaluating comparative eligibility", {
			event: "MULTI_VENDOR_LAS_COMPARE",
			pan: maskedPan,
		});

		// Fetch IRIS MF Eligibility (with fallback/error suppression)
		let irisQuote: LasEligibilityResult | undefined;
		try {
			irisQuote = await irisLasService.checkMfEligibility(pan, opts.folioNos);
		} catch (err: any) {
			logger.warn("[MultiVendorLAS] IRIS quote fetch error (graceful): " + err?.message);
		}

		// Fetch Smallcase Demat Equity Eligibility
		let smallcaseQuote: SmallcaseLasEligibilityResult | undefined;
		try {
			smallcaseQuote = await smallcaseLasService.checkEligibility(pan, opts.smallcaseAuthId);
		} catch (err: any) {
			logger.warn("[MultiVendorLAS] Smallcase quote fetch error (graceful): " + err?.message);
		}

		// Calculate Consolidated Portfolio Borrowing Power
		const irisGross = irisQuote?.eligibleFolios?.reduce((s, f) => s + f.marketValue, 0) || 0;
		const irisPledgeable = irisQuote?.totalPledgeableValue || 0;
		const irisMaxLoan = irisQuote?.totalMaxLoanAmount || 0;

		const scGross = smallcaseQuote?.totalMarketValue || 0;
		const scPledgeable = smallcaseQuote?.totalPledgeableValue || 0;
		const scMaxLoan = smallcaseQuote?.totalMaxLoanAmount || 0;

		const totalGrossCollateral = irisGross + scGross;
		const totalPledgeableCollateral = irisPledgeable + scPledgeable;
		const combinedMaxLoanAmount = irisMaxLoan + scMaxLoan;

		// FASP-AI Decision Support Recommendation
		let recommendedProvider: "IRIS" | "SMALLCASE" | "DUAL_PLEDGE" = "IRIS";
		let recommendationRationale = "";

		if (irisMaxLoan > 0 && scMaxLoan > 0) {
			recommendedProvider = "DUAL_PLEDGE";
			recommendationRationale = `Dual-collateral available: Unlock up to ₹${combinedMaxLoanAmount.toLocaleString("en-IN")} by pledging Mutual Funds via IRIS (₹${irisMaxLoan.toLocaleString("en-IN")}) and Demat Shares via Smallcase (₹${scMaxLoan.toLocaleString("en-IN")}).`;
		} else if (scMaxLoan > irisMaxLoan) {
			recommendedProvider = "SMALLCASE";
			recommendationRationale = `Smallcase Gateway recommended: Higher borrowing power of ₹${scMaxLoan.toLocaleString("en-IN")} against your demat equity holdings across retail brokers at 9.99% p.a.`;
		} else {
			recommendedProvider = "IRIS";
			recommendationRationale = `IRIS KFintech recommended: Direct RTA lien on mutual funds with lower interest rates (starting at 9.50% p.a.) and zero equity capital gains tax triggering.`;
		}

		return {
			pan,
			providers: this.getProviders(),
			irisQuote,
			smallcaseQuote,
			consolidated: {
				totalGrossCollateral,
				totalPledgeableCollateral,
				combinedMaxLoanAmount,
				recommendedProvider,
				recommendationRationale,
			},
			engine_version: ENGINE_VERSION,
			calculation_timestamp: ts,
		};
	}
}

export const multiVendorLasService = new MultiVendorLasService();
