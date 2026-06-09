/**
 * Regulatory Investability Service
 *
 * Shared utility for detecting overseas/international funds and checking
 * investability status based on per-fund DB rules (scheme_transaction_rules).
 *
 * Regulatory Context:
 * - SEBI overseas MF investment limit: industry-wide cap, but per-fund status
 *   is now determined dynamically via amfiSubscriptionSyncService which writes
 *   to scheme_transaction_rules.
 * - Binary `overseasInvestmentFrozen` flag is kept as an emergency override only
 *   (defaults to false — DB is the gate).
 */

import { db } from "../db";
import { schemeTransactionRules } from "@shared/schema";
import { ilike } from "drizzle-orm";

export interface InvestabilityResult {
	investable: boolean;
	reason: string | null;
	restrictionType?:
		| "overseas_mf"
		| "overseas_etf"
		| "fund_house"
		| "discontinued";
}

export interface RegulatoryStatus {
	overseasInvestmentFrozen: boolean;
	overseasETFFrozen: boolean;
	lastUpdated: Date;
}

const OVERSEAS_KEYWORDS = [
	"international",
	"global",
	"overseas",
	"foreign",
	"us equity",
	"us stock",
	"us fund",
	"united states",
	"nasdaq",
	"s&p 500",
	"s&p500",
	"dow jones",
	"europe",
	"european",
	"asia pacific",
	"emerging markets",
	"world",
	"greater china",
	"japan",
	"china",
	"feeder",
	"fof - overseas",
	"fund of funds - overseas",
	"world equity",
	"global equity",
	"international equity",
	"us focused",
	"us growth",
	"us value",
	"us bluechip",
	"latin america",
	"brazil",
	"germany",
	"uk equity",
];

const OVERSEAS_FUND_HOUSE_PATTERNS = [
	{ fundHouse: "franklin", pattern: "us opportunities" },
	{ fundHouse: "motilal", pattern: "nasdaq" },
	{ fundHouse: "kotak", pattern: "nasdaq" },
	{ fundHouse: "nippon", pattern: "japan" },
	{ fundHouse: "edelweiss", pattern: "china" },
	{ fundHouse: "pgim", pattern: "global" },
	{ fundHouse: "dsp", pattern: "us flexible" },
	{ fundHouse: "axis", pattern: "global" },
	{ fundHouse: "icici", pattern: "global" },
	{ fundHouse: "sbi", pattern: "international" },
];

class RegulatoryInvestabilityService {
	private static instance: RegulatoryInvestabilityService;

	// Emergency override flags (default false — DB is the live gate).
	// Set to true only as a circuit breaker if a new SEBI circular mandates
	// blanket suspension of all overseas investments.
	private overseasInvestmentFrozen = false;
	private overseasETFFrozen = false;
	private lastUpdated = new Date();

	private constructor() {
		console.log("✅ Regulatory Investability Service initialized");
	}

	static getInstance(): RegulatoryInvestabilityService {
		if (!RegulatoryInvestabilityService.instance) {
			RegulatoryInvestabilityService.instance =
				new RegulatoryInvestabilityService();
		}
		return RegulatoryInvestabilityService.instance;
	}

	isOverseasFund(fund: {
		schemeName?: string;
		name?: string;
		category?: string;
	}): boolean {
		const category = (fund.category || "").toLowerCase();
		const schemeName = (fund.schemeName || fund.name || "").toLowerCase();
		const combined = `${category} ${schemeName}`;

		for (const keyword of OVERSEAS_KEYWORDS) {
			if (combined.includes(keyword)) return true;
		}

		for (const pattern of OVERSEAS_FUND_HOUSE_PATTERNS) {
			if (
				schemeName.includes(pattern.fundHouse) &&
				schemeName.includes(pattern.pattern)
			) {
				return true;
			}
		}

		return false;
	}

	isOverseasETF(instrument: {
		name?: string;
		schemeName?: string;
		category?: string;
	}): boolean {
		const name = (instrument.name || instrument.schemeName || "").toLowerCase();
		const category = (instrument.category || "").toLowerCase();

		const isETF = name.includes("etf") || category.includes("etf");
		if (!isETF) return false;

		for (const keyword of OVERSEAS_KEYWORDS) {
			if (name.includes(keyword) || category.includes(keyword)) return true;
		}

		return false;
	}

	/**
	 * Async version: checks scheme_transaction_rules for per-fund status.
	 * Falls back to the legacy binary flag only if the emergency override is set.
	 */
	async isFundInvestableAsync(fund: {
		schemeName?: string;
		name?: string;
		category?: string;
		extendedData?: any;
		purchaseAllowed?: boolean;
	}): Promise<InvestabilityResult> {
		const extendedData = fund.extendedData || {};
		const fundName = fund.schemeName || fund.name || "";

		// 1. Explicit purchaseAllowed=false on fund object (data from FMP/extended enrichment)
		if (
			extendedData.purchaseAllowed === false ||
			fund.purchaseAllowed === false
		) {
			return {
				investable: false,
				reason: "Fresh investment not allowed by fund house (AMC restriction)",
				restrictionType: "fund_house",
			};
		}

		// 2. Emergency override — if set, block all overseas
		if (this.isOverseasFund(fund)) {
			const schemeName = fundName.toLowerCase();
			const isETF = schemeName.includes("etf");

			if (isETF && this.overseasETFFrozen) {
				return {
					investable: false,
					reason: "SEBI overseas ETF limit reached — emergency freeze active",
					restrictionType: "overseas_etf",
				};
			}
			if (this.overseasInvestmentFrozen) {
				return {
					investable: false,
					reason:
						"SEBI overseas investment limit reached — emergency freeze active",
					restrictionType: "overseas_mf",
				};
			}

			// 3. DB-driven per-fund check (primary path)
			try {
				const [rule] = await db
					.select({
						lumpsumAllowed: schemeTransactionRules.lumpsumAllowed,
						sipAllowed: schemeTransactionRules.sipAllowed,
						subscriptionStatus: schemeTransactionRules.subscriptionStatus,
						restrictionReason: schemeTransactionRules.restrictionReason,
					})
					.from(schemeTransactionRules)
					.where(
						ilike(
							schemeTransactionRules.schemeName,
							`%${fundName.substring(0, 40)}%`,
						),
					)
					.limit(1);

				if (rule) {
					if (!rule.lumpsumAllowed) {
						return {
							investable: false,
							reason:
								rule.restrictionReason ||
								`Subscription status: ${rule.subscriptionStatus}`,
							restrictionType:
								rule.subscriptionStatus === "DISCONTINUED"
									? "discontinued"
									: "overseas_mf",
						};
					}
					return { investable: true, reason: null };
				}

				// 4. No DB row — fund has not been synced yet, default to investable for open-ended
				// (avoids false positives while sync is pending)
				return { investable: true, reason: null };
			} catch (dbErr: any) {
				// DB error — don't block on infra issue, log and pass
				console.warn(
					`[Regulatory] DB lookup failed for "${fundName}": ${dbErr.message}`,
				);
				return { investable: true, reason: null };
			}
		}

		return { investable: true, reason: null };
	}

	/**
	 * Sync version — kept for backward compatibility with callers that don't await.
	 * Only checks the emergency override flags. For full DB-driven check use isFundInvestableAsync.
	 */
	isFundInvestable(fund: {
		schemeName?: string;
		name?: string;
		category?: string;
		extendedData?: any;
		purchaseAllowed?: boolean;
	}): InvestabilityResult {
		const extendedData = fund.extendedData || {};
		const schemeName = (fund.schemeName || fund.name || "").toLowerCase();

		if (
			extendedData.purchaseAllowed === false ||
			fund.purchaseAllowed === false
		) {
			return {
				investable: false,
				reason: "Fresh investment not allowed by fund house (AMC restriction)",
				restrictionType: "fund_house",
			};
		}

		if (this.isOverseasFund(fund)) {
			const isETF = schemeName.includes("etf");
			if (isETF && this.overseasETFFrozen) {
				return {
					investable: false,
					reason: "SEBI overseas ETF limit reached — emergency freeze active",
					restrictionType: "overseas_etf",
				};
			}
			if (this.overseasInvestmentFrozen) {
				return {
					investable: false,
					reason:
						"SEBI overseas investment limit reached — emergency freeze active",
					restrictionType: "overseas_mf",
				};
			}
		}

		return { investable: true, reason: null };
	}

	isETFInvestable(etf: {
		name?: string;
		symbol?: string;
		category?: string;
		isin?: string;
	}): InvestabilityResult {
		if (this.isOverseasETF(etf)) {
			if (this.overseasETFFrozen) {
				return {
					investable: false,
					reason: "SEBI overseas ETF limit reached — emergency freeze active",
					restrictionType: "overseas_etf",
				};
			}
		}
		return { investable: true, reason: null };
	}

	updateOverseasInvestmentStatus(frozen: boolean): void {
		this.overseasInvestmentFrozen = frozen;
		this.lastUpdated = new Date();
		console.log(
			`[Regulatory] Emergency overseas investment override: ${frozen ? "FROZEN" : "RELEASED (DB is gate)"}`,
		);
	}

	updateOverseasETFStatus(frozen: boolean): void {
		this.overseasETFFrozen = frozen;
		this.lastUpdated = new Date();
		console.log(
			`[Regulatory] Emergency overseas ETF override: ${frozen ? "FROZEN" : "RELEASED (DB is gate)"}`,
		);
	}

	getStatus(): RegulatoryStatus {
		return {
			overseasInvestmentFrozen: this.overseasInvestmentFrozen,
			overseasETFFrozen: this.overseasETFFrozen,
			lastUpdated: this.lastUpdated,
		};
	}

	logFilteredInstrument(
		instrumentType: "mutual_fund" | "etf",
		instrumentName: string,
		reason: string,
	): void {
		console.log(
			`[Regulatory Audit] Filtered ${instrumentType}: "${instrumentName}" - Reason: ${reason}`,
		);
	}
}

export const regulatoryInvestabilityService =
	RegulatoryInvestabilityService.getInstance();

export function isOverseasFund(fund: {
	schemeName?: string;
	name?: string;
	category?: string;
}): boolean {
	return regulatoryInvestabilityService.isOverseasFund(fund);
}

export function isOverseasETF(etf: {
	name?: string;
	schemeName?: string;
	category?: string;
}): boolean {
	return regulatoryInvestabilityService.isOverseasETF(etf);
}

export function isFundInvestable(fund: {
	schemeName?: string;
	name?: string;
	category?: string;
	extendedData?: any;
	purchaseAllowed?: boolean;
}): InvestabilityResult {
	return regulatoryInvestabilityService.isFundInvestable(fund);
}

export async function isFundInvestableAsync(fund: {
	schemeName?: string;
	name?: string;
	category?: string;
	extendedData?: any;
	purchaseAllowed?: boolean;
}): Promise<InvestabilityResult> {
	return regulatoryInvestabilityService.isFundInvestableAsync(fund);
}

export function isETFInvestable(etf: {
	name?: string;
	symbol?: string;
	category?: string;
	isin?: string;
}): InvestabilityResult {
	return regulatoryInvestabilityService.isETFInvestable(etf);
}

export function getRegulatoryStatus(): RegulatoryStatus {
	return regulatoryInvestabilityService.getStatus();
}

export function updateRegulatoryStatus(
	overseasInvestmentFrozen?: boolean,
	overseasETFFrozen?: boolean,
): void {
	if (typeof overseasInvestmentFrozen === "boolean") {
		regulatoryInvestabilityService.updateOverseasInvestmentStatus(
			overseasInvestmentFrozen,
		);
	}
	if (typeof overseasETFFrozen === "boolean") {
		regulatoryInvestabilityService.updateOverseasETFStatus(overseasETFFrozen);
	}
}

export function logFilteredInstrument(
	instrumentType: "mutual_fund" | "etf",
	instrumentName: string,
	reason: string,
): void {
	regulatoryInvestabilityService.logFilteredInstrument(
		instrumentType,
		instrumentName,
		reason,
	);
}
