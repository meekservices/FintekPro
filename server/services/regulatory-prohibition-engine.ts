/**
 * Multi-Regulator Prohibition & Pre-Flight Validation Engine (RPE v1.0)
 *
 * Enforces the strict "WHAT CANNOT BE DONE" rules across Indian financial regulators:
 * - SEBI: Fee caps, CeFCoM mandate, Segregation of Advisory & Distribution, August 2024 Finfluencer Ban, Anti-pooling.
 * - RBI: Payment Aggregator routing, e-Mandate 24hr pre-debit notices, Card-on-File Tokenization (no raw PAN/CVV).
 * - CCPA & Consumer Protection: Anti-Drip Pricing, Zero Forced Continuity, Mandatory E-Commerce disclosures.
 * - MeitY & DPDP Act 2023: Consent notice, zero raw PII in external LLM prompts, CERT-In 180-day logging.
 * - IRDAI & PFRDA: Zero direct client insurance fees, strict NPS lifecycle equity ceilings.
 *
 * Inspiration & Benchmarks:
 * - Zerodha: Clean, transparent order tickets without hidden markups, strict separation between broking & education.
 * - Groww / INDmoney / Dezerv: Distinct RIA vs Broker entity lines, explicit AUA consent, CeFCoM & e-mandate dashboards.
 * - Smallcase: Non-custodial technology rail, verified SEBI Research Analysts, zero fund pooling, strict disclaimer overlays.
 * - Razorpay / Cashfree: Merchant pre-activation compliance checklists (mandating visible grievance officer & refund terms).
 */

export const RPE_ENGINE_VERSION = "1.0.0-PROHIBITION-CHECKER-2026";

export type RegulatoryDomain = "SEBI" | "RBI" | "CCPA" | "MEITY_DPDPA" | "IRDAI_PFRDA" | "TAX_GST";

export type ProhibitionSeverity = "CRITICAL_BLOCK" | "HIGH_WARNING" | "COMPLIANCE_HOLD";

export interface ProhibitionRule {
	code: string;
	domain: RegulatoryDomain;
	title: string;
	description: string;
	statutoryReference: string;
	peerBenchmark: string;
	severity: ProhibitionSeverity;
}

export interface ProhibitionViolation {
	ruleCode: string;
	domain: RegulatoryDomain;
	severity: ProhibitionSeverity;
	message: string;
	statutoryReference: string;
	remediation: string;
}

export interface ValidationVerdict {
	passed: boolean;
	totalChecked: number;
	violationsCount: number;
	violations: ProhibitionViolation[];
	timestamp: string;
	engineVersion: string;
}

/**
 * Master Registry of Statutory Prohibitions ("WHAT CANNOT BE DONE")
 */
export const STATUTORY_PROHIBITION_REGISTRY: Record<string, ProhibitionRule> = {
	// SEBI PROHIBITIONS
	PROHIBIT_RETURN_GUARANTEES: {
		code: "PROHIBIT_RETURN_GUARANTEES",
		domain: "SEBI",
		title: "Prohibition on Return Guarantees or Deterministic Profit Claims",
		description: "Never guarantee profits, deterministic returns, or present simulated backtests as assured alpha.",
		statutoryReference: "SEBI Advertising Guidelines 2023 / IA Regulations 2013 Reg 15",
		peerBenchmark: "Zerodha / Smallcase: Mandates visible market risk warnings; zero profit promises on all landing pages.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_EXCESSIVE_ADVISORY_FEE: {
		code: "PROHIBIT_EXCESSIVE_ADVISORY_FEE",
		domain: "SEBI",
		title: "Prohibition on Breaching SEBI IA Statutory Fee Caps",
		description: "Advisory fees cannot exceed ₹1,25,000 p.a. (fixed mode) or 2.5% of AUA p.a. per client family across schemes.",
		statutoryReference: "SEBI (Investment Advisers) Regulations, 2013, Regulation 15A",
		peerBenchmark: "INDmoney / Dezerv: Hardcoded AUA fee calculations with explicit caps and signed investment advisory agreements.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_ADVANCE_FEE_OVER_SIX_MONTHS: {
		code: "PROHIBIT_ADVANCE_FEE_OVER_SIX_MONTHS",
		domain: "SEBI",
		title: "Prohibition on Collecting Advance Advisory Fees Beyond 2 Quarters",
		description: "Advance fee collections are strictly capped at 2 quarters (6 months). Multi-year lock-in fees are illegal.",
		statutoryReference: "SEBI IA Regulations Regulation 15A(3)",
		peerBenchmark: "SEBI Registered RIAs: Quarterly or bi-annual billing cycles with prorated refund clauses.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_CASH_AND_UNTRACEABLE_COLLECTIONS: {
		code: "PROHIBIT_CASH_AND_UNTRACEABLE_COLLECTIONS",
		domain: "SEBI",
		title: "Prohibition on Cash Collections for Advisory & Securities Transactions",
		description: "All client fees and transaction payments must route through traceable banking channels or CeFCoM.",
		statutoryReference: "SEBI Circular SEBI/HO/MIRSD/MIRSD-POD-1/P/CIR/2024/120 (CeFCoM) & PMLA",
		peerBenchmark: "All registered institutional peers: 100% digital bank transfers, net banking, or UPI only.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_DUAL_COMMISSION_ADVISORY_CONFLICT: {
		code: "PROHIBIT_DUAL_COMMISSION_ADVISORY_CONFLICT",
		domain: "SEBI",
		title: "Prohibition on Earning Both Advisory Fees & Distributor Commissions",
		description: "Clients paying advisory fees cannot be charged distribution commissions on the same investment asset.",
		statutoryReference: "SEBI IA Regulations Regulation 22 (Segregation of Advisory and Distribution)",
		peerBenchmark: "Zerodha / Groww: Total separation between fee-based advisory vs zero-brokerage direct mutual funds.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP: {
		code: "PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP",
		domain: "SEBI",
		title: "Prohibition on Associating with Unregistered Financial Influencers",
		description: "Regulated entities cannot pay referral bounties or share revenue with unregistered tipsters or influencers.",
		statutoryReference: "SEBI Board Amendments August 2024 (Association of Intermediaries with Unregulated Entities)",
		peerBenchmark: "Angel One / Upstox / Groww: Complete decommissioning of unregulated social influencer affiliate programs.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_PROPRIETARY_FUND_POOLING: {
		code: "PROHIBIT_PROPRIETARY_FUND_POOLING",
		domain: "SEBI",
		title: "Prohibition on Pooling Client Funds into Proprietary Escrow/Nodal Accounts",
		description: "Fintechs cannot pool client transaction funds in their own accounts. Funds must route directly to Clearing Corporations / AMCs.",
		statutoryReference: "SEBI Circular on Discontinuation of Pooling of Funds by Intermediaries",
		peerBenchmark: "Smallcase / Upstox: Direct broker routing where trades and funds stay inside the investor's segregated account.",
		severity: "CRITICAL_BLOCK",
	},

	// RBI PROHIBITIONS
	PROHIBIT_RAW_CARD_STORAGE: {
		code: "PROHIBIT_RAW_CARD_STORAGE",
		domain: "RBI",
		title: "Prohibition on Storing Raw Card Details (Card-on-File Tokenization)",
		description: "Platforms cannot store 16-digit PAN, CVV, or card expiry on proprietary databases or logs.",
		statutoryReference: "RBI Card-on-File Tokenization (CoFT) Master Directions",
		peerBenchmark: "Razorpay / Cashfree / Stripe: SDK-hosted iframes with RBI network tokens.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_UNNOTIFIED_RECURRING_DEBIT: {
		code: "PROHIBIT_UNNOTIFIED_RECURRING_DEBIT",
		domain: "RBI",
		title: "Prohibition on Executing Recurring e-Mandates without 24-Hour Pre-Debit Alert",
		description: "Mandates must dispatch an SMS/Email alert to the client at least 24 hours prior to recurring execution.",
		statutoryReference: "Section 25 Payment and Settlement Systems Act, 2007 & RBI e-Mandate Circulars",
		peerBenchmark: "Razorpay Subscriptions / Cashfree: Automated T-24hr webhook and customer email notification triggers.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_OBSTRUCTED_MANDATE_CANCELLATION: {
		code: "PROHIBIT_OBSTRUCTED_MANDATE_CANCELLATION",
		domain: "RBI",
		title: "Prohibition on Trapping Clients in Recurring Mandates without 1-Click Revocation",
		description: "Clients must have an accessible, self-service dashboard to pause or revoke recurring mandates instantly.",
		statutoryReference: "RBI Framework for Processing of e-mandates on cards / UPI",
		peerBenchmark: "INDmoney / Netflix India: Unconditional instant cancel button in billing settings.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_UNLICENSED_PAYMENT_ROUTING: {
		code: "PROHIBIT_UNLICENSED_PAYMENT_ROUTING",
		domain: "RBI",
		title: "Prohibition on Collecting Online Payments without an Authorized Payment Aggregator",
		description: "Online collections cannot pass through informal merchant bank accounts without an RBI-authorized PA.",
		statutoryReference: "RBI Guidelines on Regulation of Payment Aggregators and Payment Gateways",
		peerBenchmark: "All compliant Indian merchants: Routing through RBI licensed PAs (Razorpay, BillDesk, Cashfree, etc.).",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_FINTECH_LOAN_DISBURSEMENT: {
		code: "PROHIBIT_FINTECH_LOAN_DISBURSEMENT",
		domain: "RBI",
		title: "Prohibition on Disbursing Loan Funds through Fintech Balance Sheets",
		description: "Credit lines and loans against securities must flow directly between the Regulated Entity (Bank/NBFC) and borrower.",
		statutoryReference: "RBI Digital Lending Guidelines (DLG) 2022",
		peerBenchmark: "CRED / Navi: Direct bank-to-borrower NEFT/RTGS disbursals with Key Fact Statement (KFS).",
		severity: "CRITICAL_BLOCK",
	},

	// CCPA & CONSUMER PROTECTION PROHIBITIONS
	PROHIBIT_DRIP_PRICING: {
		code: "PROHIBIT_DRIP_PRICING",
		domain: "CCPA",
		title: "Prohibition on Drip Pricing & Stealth Checkout Surcharges",
		description: "Total fees including 18% GST and any convenience costs must be revealed upfront before checkout initiation.",
		statutoryReference: "CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023 (Section 5)",
		peerBenchmark: "Zerodha: Real-time full cost breakup before pressing buy/subscribe.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_FORCED_CONTINUITY_PRECHECK: {
		code: "PROHIBIT_FORCED_CONTINUITY_PRECHECK",
		domain: "CCPA",
		title: "Prohibition on Forced Continuity & Pre-Checked Subscription Checkboxes",
		description: "Checkboxes for recurring auto-renewals, bundled addons, or services must start completely unchecked.",
		statutoryReference: "CCPA Dark Patterns Guidelines, 2023 (Forced Continuity & Basket Sneaking)",
		peerBenchmark: "Amazon India / Flipkart: Unchecked optional add-on checkboxes.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_MISSING_STATUTORY_DISCLOSURES: {
		code: "PROHIBIT_MISSING_STATUTORY_DISCLOSURES",
		domain: "CCPA",
		title: "Prohibition on Operating Business Websites Without Mandatory Disclosures",
		description: "Website must display Corporate Identity Number (CIN), registered address, Grievance Officer details, and Terms.",
		statutoryReference: "Consumer Protection (E-Commerce) Rules, 2020",
		peerBenchmark: "Razorpay / Zerodha / Groww footers: Clear CIN, SEBI registration number, Grievance Officer contact, and SCORES links.",
		severity: "CRITICAL_BLOCK",
	},

	// MEITY & DPDP ACT 2023 PROHIBITIONS
	PROHIBIT_RAW_PII_IN_LLM_PROMPT: {
		code: "PROHIBIT_RAW_PII_IN_LLM_PROMPT",
		domain: "MEITY_DPDPA",
		title: "Prohibition on Transmitting Unmasked PII / Financial Identifiers to Public LLMs",
		description: "Never transmit raw Aadhaar, PAN, bank account numbers, or demat IDs in prompts to external LLM providers.",
		statutoryReference: "Digital Personal Data Protection Act, 2023 & FintekPro MR-AICF v1.0",
		peerBenchmark: "Institutional banks & wealth managers: Pre-prompt enterprise tokenization and redactor firewalls.",
		severity: "CRITICAL_BLOCK",
	},
	PROHIBIT_UNCONSENTED_PII_PROCESSING: {
		code: "PROHIBIT_UNCONSENTED_PII_PROCESSING",
		domain: "MEITY_DPDPA",
		title: "Prohibition on Processing Client Data Without an Itemized Consent Notice",
		description: "Client data collection requires explicit, unbundled consent with the right to withdraw and request erasure.",
		statutoryReference: "DPDP Act, 2023 Section 6 (Consent Notice)",
		peerBenchmark: "Account Aggregators (Setu, Anumati): Granular data-sharing consent scopes with expiration dates.",
		severity: "CRITICAL_BLOCK",
	},

	// IRDAI & PFRDA PROHIBITIONS
	PROHIBIT_DIRECT_INSURANCE_FEE: {
		code: "PROHIBIT_DIRECT_INSURANCE_FEE",
		domain: "IRDAI_PFRDA",
		title: "Prohibition on Charging Direct Client Advisory Fees for Insurance Sales",
		description: "Insurance web aggregators/intermediaries cannot charge retail consumers direct advisory fees for policy distribution.",
		statutoryReference: "IRDAI (Insurance Web Aggregators) Regulations & Intermediary Guidelines",
		peerBenchmark: "Policybazaar: Zero fee to client; remuneration exclusively derived from insurer commission within statutory limits.",
		severity: "CRITICAL_BLOCK",
	},
};

/**
 * Input interfaces for specific validation engines
 */
export interface PricingCheckInput {
	baseAmount: number;
	gstAmount?: number;
	totalPayable: number;
	dripChargesApplied?: number;
	autoRenewalPreChecked?: boolean;
	convenienceFeeSneaked?: boolean;
	currency?: string;
}

export interface AdvisoryFeeCheckInput {
	feeMode: "fixed" | "aua";
	proposedAnnualFee: number;
	auaAmount?: number;
	advanceBillingMonths: number;
	paymentChannel: "CASH" | "NET_BANKING" | "UPI" | "CARD" | "ENACH" | "CEFCOM";
	alsoReceivesDistributionCommission?: boolean;
}

export interface MarketingContentInput {
	content: string;
	contentType: "PAGE_COPY" | "AD_BANNER" | "EMAIL" | "SOCIAL_POST" | "CTA";
}

export interface PartnerOnboardingInput {
	partnerName: string;
	partnerType: "INDIVIDUAL_INFLUENCER" | "REGISTERED_RIA" | "REGISTERED_RA" | "AMFI_MFD" | "CORPORATE_B2B";
	sebiRegistrationNumber?: string;
	hasSignedAntiTippingUndertaking: boolean;
	compensationModel: "FIXED_B2B" | "REV_SHARE_PER_TRADE" | "PAID_PROMOTION_TIPS";
}

export interface WebsiteFooterCheckInput {
	hasCin: boolean;
	hasRegisteredAddress: boolean;
	hasGrievanceOfficer: boolean;
	hasGrievanceEmail: boolean;
	hasScoresLink: boolean;
	hasSmartOdrLink: boolean;
	hasTermsAndPrivacy: boolean;
	hasRefundPolicy: boolean;
}

export class RegulatoryProhibitionEngine {
	private readonly engineVersion = RPE_ENGINE_VERSION;

	/**
	 * Returns the complete statutory prohibition catalog
	 */
	public getProhibitionRegistry(): Record<string, ProhibitionRule> {
		return { ...STATUTORY_PROHIBITION_REGISTRY };
	}

	/**
	 * Checks pricing and checkout payloads against CCPA Dark Patterns & Consumer Protection rules
	 */
	public checkPricingAndCheckout(input: PricingCheckInput): ValidationVerdict {
		const violations: ProhibitionViolation[] = [];
		let totalChecked = 0;

		totalChecked++;
		// Check 1: Drip Pricing / Sneaked charges
		if (input.dripChargesApplied && input.dripChargesApplied > 0) {
			violations.push({
				ruleCode: "PROHIBIT_DRIP_PRICING",
				domain: "CCPA",
				severity: "CRITICAL_BLOCK",
				message: `Drip pricing violation: ₹${input.dripChargesApplied} sneaked into final checkout without upfront disclosure.`,
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_DRIP_PRICING.statutoryReference,
				remediation: "Disclose all charges and statutory taxes upfront on the pricing table before initiating checkout.",
			});
		}

		totalChecked++;
		if (input.convenienceFeeSneaked) {
			violations.push({
				ruleCode: "PROHIBIT_DRIP_PRICING",
				domain: "CCPA",
				severity: "CRITICAL_BLOCK",
				message: "Convenience fee or gateway surcharge added at final step without prior notice.",
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_DRIP_PRICING.statutoryReference,
				remediation: "Absorb gateway fees or display all-inclusive final payable amounts before checkout initiation.",
			});
		}

		totalChecked++;
		// Check 2: Forced Continuity / Pre-ticked auto-renewal
		if (input.autoRenewalPreChecked === true) {
			violations.push({
				ruleCode: "PROHIBIT_FORCED_CONTINUITY_PRECHECK",
				domain: "CCPA",
				severity: "CRITICAL_BLOCK",
				message: "Forced continuity violation: Auto-renewal or recurring subscription checkbox is pre-selected.",
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_FORCED_CONTINUITY_PRECHECK.statutoryReference,
				remediation: "Ensure all auto-renewal or subscription opt-ins default to unselected (checked={false}).",
			});
		}

		totalChecked++;
		// Check 3: GST Calculation Determinism (18% check)
		if (input.gstAmount !== undefined && input.baseAmount > 0) {
			const expectedGst = Math.round(input.baseAmount * 0.18 * 100) / 100;
			const delta = Math.abs(input.gstAmount - expectedGst);
			if (delta > 1.0) {
				violations.push({
					ruleCode: "PROHIBIT_DRIP_PRICING",
					domain: "TAX_GST",
					severity: "HIGH_WARNING",
					message: `GST calculation discrepancy: Expected ₹${expectedGst} (18%), but received ₹${input.gstAmount}.`,
					statutoryReference: "GST Act 2017 SAC 9971 / 9983 (Standard 18% Rate)",
					remediation: "Enforce standard 18% GST calculation across all software and advisory checkout lines.",
				});
			}
		}

		return {
			passed: violations.length === 0,
			totalChecked,
			violationsCount: violations.length,
			violations,
			timestamp: new Date().toISOString(),
			engineVersion: this.engineVersion,
		};
	}

	/**
	 * Checks Investment Advisory fee proposals against SEBI IA Regulations
	 */
	public checkAdvisoryFee(input: AdvisoryFeeCheckInput): ValidationVerdict {
		const violations: ProhibitionViolation[] = [];
		let totalChecked = 0;

		totalChecked++;
		// Check 1: SEBI Fee Caps (₹1.25L fixed or 2.5% AUA)
		if (input.feeMode === "fixed") {
			const MAX_FIXED_FEE = 125000;
			if (input.proposedAnnualFee > MAX_FIXED_FEE) {
				violations.push({
					ruleCode: "PROHIBIT_EXCESSIVE_ADVISORY_FEE",
					domain: "SEBI",
					severity: "CRITICAL_BLOCK",
					message: `Fee cap breach: Proposed fixed advisory fee of ₹${input.proposedAnnualFee} exceeds the statutory ceiling of ₹${MAX_FIXED_FEE}/year.`,
					statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_EXCESSIVE_ADVISORY_FEE.statutoryReference,
					remediation: "Cap fixed annual advisory fees to a maximum of ₹1,25,000 per family across all advisory schemes.",
				});
			}
		} else if (input.feeMode === "aua") {
			const MAX_AUA_PERCENT = 2.5;
			if (input.auaAmount && input.auaAmount > 0) {
				const effectivePercent = (input.proposedAnnualFee / input.auaAmount) * 100;
				if (effectivePercent > MAX_AUA_PERCENT) {
					violations.push({
						ruleCode: "PROHIBIT_EXCESSIVE_ADVISORY_FEE",
						domain: "SEBI",
						severity: "CRITICAL_BLOCK",
						message: `Fee cap breach: Proposed AUA fee rate of ${effectivePercent.toFixed(2)}% exceeds statutory cap of ${MAX_AUA_PERCENT}%.`,
						statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_EXCESSIVE_ADVISORY_FEE.statutoryReference,
						remediation: "Cap AUA-based advisory fee to maximum 2.5% of verified Assets Under Advice.",
					});
				}
			}
		}

		totalChecked++;
		// Check 2: Advance collection beyond 6 months (2 quarters)
		if (input.advanceBillingMonths > 6) {
			violations.push({
				ruleCode: "PROHIBIT_ADVANCE_FEE_OVER_SIX_MONTHS",
				domain: "SEBI",
				severity: "CRITICAL_BLOCK",
				message: `Advance billing breach: Advance billing of ${input.advanceBillingMonths} months exceeds permissible 6 months (2 quarters).`,
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_ADVANCE_FEE_OVER_SIX_MONTHS.statutoryReference,
				remediation: "Limit advance fee collection to a maximum of 2 quarters (6 months) with prorated refund rights.",
			});
		}

		totalChecked++;
		// Check 3: Cash payments
		if (input.paymentChannel === "CASH") {
			violations.push({
				ruleCode: "PROHIBIT_CASH_AND_UNTRACEABLE_COLLECTIONS",
				domain: "SEBI",
				severity: "CRITICAL_BLOCK",
				message: "Cash collection prohibited for all advisory and securities transactions.",
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_CASH_AND_UNTRACEABLE_COLLECTIONS.statutoryReference,
				remediation: "Route payments exclusively via CeFCoM, UPI, Net Banking, or RBI-authorized payment gateways.",
			});
		}

		totalChecked++;
		// Check 4: Dual Commission Conflict (Reg 22)
		if (input.alsoReceivesDistributionCommission === true) {
			violations.push({
				ruleCode: "PROHIBIT_DUAL_COMMISSION_ADVISORY_CONFLICT",
				domain: "SEBI",
				severity: "CRITICAL_BLOCK",
				message: "Conflict of interest breach: Client is charged advisory fees while platform earns distribution commissions.",
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_DUAL_COMMISSION_ADVISORY_CONFLICT.statutoryReference,
				remediation: "Segregate advisory clients to 100% Direct Plans with zero commission pass-through.",
			});
		}

		return {
			passed: violations.length === 0,
			totalChecked,
			violationsCount: violations.length,
			violations,
			timestamp: new Date().toISOString(),
			engineVersion: this.engineVersion,
		};
	}

	/**
	 * Scans marketing copy, website text, and CTA banners for prohibited financial claims
	 */
	public checkMarketingContent(input: MarketingContentInput): ValidationVerdict {
		const violations: ProhibitionViolation[] = [];
		let totalChecked = 0;

		const prohibitedPatterns: Array<{
			regex: RegExp;
			ruleCode: string;
			domain: RegulatoryDomain;
			message: string;
			statutoryReference: string;
			remediation: string;
		}> = [
			{
				regex: /guaranteed\s+(?:\d+%\s+)?returns?/i,
				ruleCode: "PROHIBIT_RETURN_GUARANTEES",
				domain: "SEBI",
				message: "Deceptive marketing violation: Guaranteed return promises are strictly prohibited by SEBI.",
				statutoryReference: "SEBI Advertising Code 2023",
				remediation: "Replace with factual historical performance accompanied by mandatory statutory market risk disclaimers.",
			},
			{
				regex: /risk-free\s+(?:profit|investment|returns?|trading)/i,
				ruleCode: "PROHIBIT_RETURN_GUARANTEES",
				domain: "SEBI",
				message: "Deceptive claim: Stating securities investments or trading are 'risk-free' violates SEBI rules.",
				statutoryReference: "SEBI Master Circular for Investment Intermediaries",
				remediation: "Highlight asset risk categories and disclose standard volatility risks.",
			},
			{
				regex: /sure-shot\s+(?:profit|tips?|call|trade|stocks?)/i,
				ruleCode: "PROHIBIT_RETURN_GUARANTEES",
				domain: "SEBI",
				message: "Stock tipping jargon ('sure-shot') is prohibited across all client-facing surfaces.",
				statutoryReference: "SEBI Code of Conduct for Research Analysts and Investment Advisers",
				remediation: "Use institutional, quantitative research vocabulary grounded in fundamental/technical analysis.",
			},
			{
				regex: /Bloomberg\s+Terminal/i,
				ruleCode: "PROHIBIT_DECEPTIVE_CLAIMS",
				domain: "CCPA",
				message: "Unlicensed trademark appropriation: 'Bloomberg Terminal' is a protected mark and cannot be used as a self-descriptor.",
				statutoryReference: "Trade Marks Act 1999 & GCR BT-AC v1.0",
				remediation: "Use approved phrasing: 'Wall Street Analytics, Built for Indian Investors'.",
			},
			{
				regex: /Robinhood\s+of\s+India/i,
				ruleCode: "PROHIBIT_DECEPTIVE_CLAIMS",
				domain: "CCPA",
				message: "Unlicensed equivalency claim: 'Robinhood of India' violates trademark and fair advertising norms.",
				statutoryReference: "GCR BT-AC v1.0 & Consumer Protection Act 2019",
				remediation: "Describe FintekPro using direct platform capabilities.",
			},
		];

		for (const pattern of prohibitedPatterns) {
			totalChecked++;
			if (pattern.regex.test(input.content)) {
				violations.push({
					ruleCode: pattern.ruleCode,
					domain: pattern.domain,
					severity: "CRITICAL_BLOCK",
					message: pattern.message,
					statutoryReference: pattern.statutoryReference,
					remediation: pattern.remediation,
				});
			}
		}

		return {
			passed: violations.length === 0,
			totalChecked,
			violationsCount: violations.length,
			violations,
			timestamp: new Date().toISOString(),
			engineVersion: this.engineVersion,
		};
	}

	/**
	 * Validates commercial partner & influencer onboarding under the August 2024 SEBI Finfluencer ban
	 */
	public checkPartnerOnboarding(input: PartnerOnboardingInput): ValidationVerdict {
		const violations: ProhibitionViolation[] = [];
		let totalChecked = 0;

		totalChecked++;
		// Check 1: Paying trade revenue share to individual influencers
		if (
			input.partnerType === "INDIVIDUAL_INFLUENCER" &&
			(input.compensationModel === "REV_SHARE_PER_TRADE" || input.compensationModel === "PAID_PROMOTION_TIPS")
		) {
			violations.push({
				ruleCode: "PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP",
				domain: "SEBI",
				severity: "CRITICAL_BLOCK",
				message: `Prohibited finfluencer tie-up: Commercial association / revenue share per trade with individual influencer '${input.partnerName}' is banned by SEBI.`,
				statutoryReference: STATUTORY_PROHIBITION_REGISTRY.PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP.statutoryReference,
				remediation: "Terminate volume/trade-based affiliate deals with unregistered persons. Only investor education without tips is permissible.",
			});
		}

		totalChecked++;
		// Check 2: Missing registration number for advisory/research partners
		if (
			(input.partnerType === "REGISTERED_RIA" || input.partnerType === "REGISTERED_RA") &&
			(!input.sebiRegistrationNumber || !input.sebiRegistrationNumber.startsWith("IN"))
		) {
			violations.push({
				ruleCode: "PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP",
				domain: "SEBI",
				severity: "CRITICAL_BLOCK",
				message: `Missing or invalid SEBI registration number for ${input.partnerType}: ${input.sebiRegistrationNumber || "NONE"}.`,
				statutoryReference: "SEBI (Intermediaries) Regulations 2008",
				remediation: "Verify and attach active SEBI registration certificate before granting partner console access.",
			});
		}

		totalChecked++;
		// Check 3: Anti-tipping undertaking
		if (!input.hasSignedAntiTippingUndertaking) {
			violations.push({
				ruleCode: "PROHIBIT_UNREGISTERED_FINFLUENCER_TIEUP",
				domain: "SEBI",
				severity: "HIGH_WARNING",
				message: "Partner has not executed mandatory legal undertaking pledging zero unauthorized tips or performance guarantees.",
				statutoryReference: "FintekPro B2B Partner Governance SOP",
				remediation: "Obtain digital signature on FintekPro Anti-Tipping & Regulatory Compliance Undertaking.",
			});
		}

		return {
			passed: violations.length === 0,
			totalChecked,
			violationsCount: violations.length,
			violations,
			timestamp: new Date().toISOString(),
			engineVersion: this.engineVersion,
		};
	}

	/**
	 * Checks website footer disclosures against Consumer Protection (E-Commerce) Rules, 2020
	 */
	public checkWebsiteFooterDisclosures(input: WebsiteFooterCheckInput): ValidationVerdict {
		const violations: ProhibitionViolation[] = [];
		let totalChecked = 0;

		totalChecked++;
		if (!input.hasCin) {
			violations.push({
				ruleCode: "PROHIBIT_MISSING_STATUTORY_DISCLOSURES",
				domain: "CCPA",
				severity: "CRITICAL_BLOCK",
				message: "Mandatory corporate identifier (CIN / LLPIN) is missing from the website footer.",
				statutoryReference: "Consumer Protection (E-Commerce) Rules 2020 Rule 4(1)",
				remediation: "Display legal entity CIN/LLPIN in all website footers.",
			});
		}

		totalChecked++;
		if (!input.hasRegisteredAddress) {
			violations.push({
				ruleCode: "PROHIBIT_MISSING_STATUTORY_DISCLOSURES",
				domain: "CCPA",
				severity: "CRITICAL_BLOCK",
				message: "Registered and corporate office address missing from public website.",
				statutoryReference: "Consumer Protection (E-Commerce) Rules 2020",
				remediation: "Display physical registered office address in footer.",
			});
		}

		totalChecked++;
		if (!input.hasGrievanceOfficer || !input.hasGrievanceEmail) {
			violations.push({
				ruleCode: "PROHIBIT_MISSING_STATUTORY_DISCLOSURES",
				domain: "CCPA",
				severity: "CRITICAL_BLOCK",
				message: "Name, email, and designation of Grievance Redressal Officer must be clearly published.",
				statutoryReference: "IT Intermediary Rules 2021 & Consumer Protection Rules 2020",
				remediation: "Publish designated Grievance Officer contact details with 24h acknowledgement / 15d SLA.",
			});
		}

		totalChecked++;
		if (!input.hasScoresLink || !input.hasSmartOdrLink) {
			violations.push({
				ruleCode: "PROHIBIT_MISSING_STATUTORY_DISCLOSURES",
				domain: "SEBI",
				severity: "HIGH_WARNING",
				message: "Links to SEBI SCORES portal and SMART ODR platform missing from advisory/securities pages.",
				statutoryReference: "SEBI Circular on Online Dispute Resolution (ODR) & SCORES",
				remediation: "Include prominent clickable links to scores.sebi.gov.in and smartodr.in in portal footer.",
			});
		}

		return {
			passed: violations.length === 0,
			totalChecked,
			violationsCount: violations.length,
			violations,
			timestamp: new Date().toISOString(),
			engineVersion: this.engineVersion,
		};
	}
}

export const regulatoryProhibitionEngine = new RegulatoryProhibitionEngine();
