/**
 * Stamp Duty Service — v2.0.0-FA2019
 *
 * Implements regulatory-compliant stamp duty calculation for securities transactions
 * as per Indian Stamp Act 1899 (amended by Finance Act 2019, effective July 1, 2020).
 *
 * Finance Act 2019 changes:
 *  - Unified centralized collection via Clearing Corporations (exchange trades)
 *    and Depositories (off-market transfers)
 *  - State-specific rates replaced by pan-India uniform rates
 *  - Payer changed to BUYER for all exchange-settled transactions
 *
 * Rate table (Finance Act 2019, Schedule IA — effective 01-Jul-2020):
 *  Product                            Rate (bps)  Payer
 *  ─────────────────────────────────────────────────────
 *  Unlisted Shares (off-market)       1.5         Seller
 *  Equity Delivery (exchange)         1.5         Buyer
 *  Equity Non-Delivery/Intraday       0.3         Buyer
 *  Corporate Bond / NCD / Tax-Free    0.01        Buyer
 *  Infrastructure Bond                0.01        Buyer
 *  Equity Futures                     0.2         Buyer
 *  Equity Options                     0.3         Buyer
 *  Currency & IR Derivatives          0.01        Buyer
 *  MF Units (off-market transfer)     0.5         Buyer
 *  Debenture Issue (primary)          0.5         Buyer (allottee)
 *  G-Sec / T-Bill / SDL / SGB         EXEMPT      —
 *  Bonus Shares                       EXEMPT      —
 *  Gift / Transmission                EXEMPT      —
 *
 * GCR Compliance:
 *  - Every output includes engine_version + calculation_timestamp (Financial Logic Integrity)
 *  - Every output exposes formula + inputs (Explainability Layer)
 *  - All logging via structured logger (Observability)
 */

import { db } from "./db";
import {
	stampDutyConfig,
	stampDutyAuditLog,
	type StampDutyConfig,
	type InsertStampDutyAuditLog,
} from "@shared/schema";
import { eq, and, isNull, lte, or, gte } from "drizzle-orm";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────────
// Engine versioning — bump when any rate or formula changes
// ─────────────────────────────────────────────────────────────────────────────
export const STAMP_DUTY_ENGINE_VERSION = "2.0.0-FA2019";
const EFFECTIVE_DATE = "2020-07-01"; // Finance Act 2019 amendment date

// ─────────────────────────────────────────────────────────────────────────────
// Rate Table — Indian Stamp Act 1899 Schedule IA (Finance Act 2019 amendment)
// All rates in BASIS POINTS (bps). 1 bps = 0.01% = 0.0001
// Formula: stampDutyAmount = transactionAmount × (rate / 10000)
// ─────────────────────────────────────────────────────────────────────────────
export const STAMP_DUTY_RATES = {
	// ── Off-market equity transfers ───────────────────────────────────────────
	unlisted_shares: {
		rate: 1.5, // 0.015% — off-market transfer
		payerSide: "seller" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56A (Finance Act 2019)",
		statuteSection:
			"Article 56A — Transfer of shares in companies not listed on recognized Stock Exchange",
		transactionContext: "off_market",
	},

	// ── Exchange-traded equity ────────────────────────────────────────────────
	equity_delivery: {
		rate: 1.5, // 0.015% — buyer pays via Clearing Corporation
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56A (Finance Act 2019)",
		statuteSection:
			"Article 56A — Transfer of shares through recognized Stock Exchange (delivery basis)",
		transactionContext: "exchange",
	},
	equity_non_delivery: {
		rate: 0.3, // 0.003% — intraday / non-delivery
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56A (Finance Act 2019)",
		statuteSection:
			"Article 56A — Transfer of shares through recognized Stock Exchange (non-delivery basis)",
		transactionContext: "exchange",
	},

	// ── Fixed income (exchange-settled — payer is BUYER per FA2019) ───────────
	corporate_bond: {
		rate: 0.01, // 0.0001%
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 27 (Finance Act 2019)",
		statuteSection: "Article 27 — Transfer of debentures / corporate bonds",
		transactionContext: "exchange_or_depository",
	},
	ncd: {
		rate: 0.01, // 0.0001%
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 27 (Finance Act 2019)",
		statuteSection: "Article 27 — Transfer of Non-Convertible Debentures",
		transactionContext: "exchange_or_depository",
	},
	tax_free_bond: {
		rate: 0.01, // 0.0001%
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 27 (Finance Act 2019)",
		statuteSection: "Article 27 — Transfer of Tax-Free Bonds",
		transactionContext: "exchange_or_depository",
	},
	infrastructure_bond: {
		rate: 0.01, // 0.0001%
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 27 (Finance Act 2019)",
		statuteSection: "Article 27 — Transfer of Infrastructure Bonds",
		transactionContext: "exchange_or_depository",
	},

	// ── Derivatives ───────────────────────────────────────────────────────────
	futures: {
		rate: 0.2, // 0.002%
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56B (Finance Act 2019)",
		statuteSection: "Article 56B — Equity Futures contracts on recognized Stock Exchange",
		transactionContext: "exchange",
	},
	options: {
		rate: 0.3, // 0.003% — levied on option premium (not notional)
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56B (Finance Act 2019)",
		statuteSection:
			"Article 56B — Equity Options contracts on recognized Stock Exchange (on premium)",
		transactionContext: "exchange",
	},
	currency_interest_rate_derivatives: {
		rate: 0.01, // 0.0001%
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56B (Finance Act 2019)",
		statuteSection:
			"Article 56B — Currency and Interest Rate Derivative contracts",
		transactionContext: "exchange",
	},

	// ── Mutual Fund Units ─────────────────────────────────────────────────────
	mf_units: {
		rate: 0.5, // 0.005% — off-market transfer of MF units via CDAS/depository
		payerSide: "buyer" as const,
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 56A (Finance Act 2019)",
		statuteSection:
			"Article 56A — Transfer of Mutual Fund units through depository",
		transactionContext: "depository",
	},

	// ── Primary market issuance ───────────────────────────────────────────────
	debenture_issue: {
		rate: 0.5, // 0.005% — paid by allottee at issuance
		payerSide: "buyer" as const, // allottee
		isExempt: false,
		regulatorReference: "Indian Stamp Act 1899, Schedule IA, Article 27 (Finance Act 2019)",
		statuteSection: "Article 27 — Issue of debentures / NCDs (primary market)",
		transactionContext: "primary_market",
	},

	// ── Government Securities — EXEMPT ────────────────────────────────────────
	g_sec: {
		rate: 0,
		payerSide: "buyer" as const,
		isExempt: true,
		exemptionReason:
			"Government Securities are exempt under Section 9 of the Indian Stamp Act 1899",
		regulatorReference: "Indian Stamp Act 1899, Section 9",
		statuteSection:
			"Section 9 — Exemption of instruments relating to Government Securities",
		transactionContext: "any",
	},
	t_bill: {
		rate: 0,
		payerSide: "buyer" as const,
		isExempt: true,
		exemptionReason:
			"Treasury Bills are Government Securities exempt under Section 9",
		regulatorReference: "Indian Stamp Act 1899, Section 9",
		statuteSection:
			"Section 9 — Exemption of instruments relating to Government Securities",
		transactionContext: "any",
	},
	sdl: {
		rate: 0,
		payerSide: "buyer" as const,
		isExempt: true,
		exemptionReason:
			"State Development Loans are Government Securities exempt under Section 9",
		regulatorReference: "Indian Stamp Act 1899, Section 9",
		statuteSection:
			"Section 9 — Exemption of instruments relating to Government Securities",
		transactionContext: "any",
	},
	sgb: {
		rate: 0,
		payerSide: "buyer" as const,
		isExempt: true,
		exemptionReason:
			"Sovereign Gold Bonds are Government Securities issued by RBI, exempt under Section 9",
		regulatorReference: "Indian Stamp Act 1899, Section 9",
		statuteSection:
			"Section 9 — Exemption of instruments relating to Government Securities",
		transactionContext: "any",
	},

	// ── Corporate actions — EXEMPT ────────────────────────────────────────────
	bonus_shares: {
		rate: 0,
		payerSide: "buyer" as const,
		isExempt: true,
		exemptionReason:
			"Bonus shares issued without consideration — no transfer, no stamp duty applicable",
		regulatorReference: "Indian Stamp Act 1899, Schedule IA (negative list)",
		statuteSection: "No transfer consideration — exempt from stamp duty",
		transactionContext: "corporate_action",
	},
	gift_transfer: {
		rate: 0,
		payerSide: "buyer" as const,
		isExempt: true,
		exemptionReason:
			"Gift or transmission of securities without monetary consideration — exempt",
		regulatorReference: "Indian Stamp Act 1899, Schedule IA (negative list)",
		statuteSection: "No consideration — transmission/gift not subject to stamp duty",
		transactionContext: "off_market",
	},
} as const;

export type ProductType = keyof typeof STAMP_DUTY_RATES;

// ─────────────────────────────────────────────────────────────────────────────
// Output interfaces (GCR: every financial output includes engine_version +
// calculation_timestamp + explainability)
// ─────────────────────────────────────────────────────────────────────────────

export interface StampDutyCalculation {
	transactionAmount: number;
	stampDutyRate: number; // In basis points (bps)
	stampDutyAmount: number;
	isExempt: boolean;
	exemptionReason?: string;
	payerSide: "buyer" | "seller" | "transferor";
	regulatorReference: string;
	statuteSection: string;
	effectiveDate: string;
	/** GCR: engine version for deterministic audit trail */
	engine_version: string;
	/** GCR: ISO timestamp of when this calculation was performed */
	calculation_timestamp: string;
}

export interface StampDutyBreakdown {
	principal: number;
	stampDuty: number;
	stampDutyRate: string;
	isExempt: boolean;
	exemptionReason?: string;
	payerSide: string;
	regulatorReference: string;
	total: number;
}

/** GCR Explainability: exposes formula, inputs, and intermediate steps */
export interface StampDutyExplainability extends StampDutyCalculation {
	explainability: {
		formula: string;
		inputs: {
			transactionAmount: number;
			rateBps: number;
			ratePercent: string;
			divisor: number;
		};
		steps: string[];
		regulatoryBasis: string;
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────────────────────

class StampDutyService {
	private configCache: Map<string, StampDutyConfig> = new Map();
	private lastCacheRefresh: Date = new Date(0);
	private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

	/**
	 * Calculate stamp duty for a transaction.
	 *
	 * @param productType   - Securities product type key (see STAMP_DUTY_RATES)
	 * @param transactionAmount - Transaction value in INR
	 * @param transactionType   - "purchase" | "sale" | "transfer" | "issue"
	 * @returns StampDutyCalculation with GCR-compliant engine_version + timestamp
	 *
	 * @throws Error if productType is unknown
	 *
	 * @example
	 *   // Corporate bond purchase ₹10,00,000 → ₹1 stamp duty (0.01 bps)
	 *   calculateStampDuty("corporate_bond", 1_000_000)
	 */
	calculateStampDuty(
		productType: ProductType,
		transactionAmount: number,
		transactionType: "purchase" | "sale" | "transfer" | "issue" = "purchase",
	): StampDutyCalculation {
		const config = STAMP_DUTY_RATES[productType];

		if (!config) {
			throw new Error(
				`[StampDutyService] Unknown product type: ${productType}. ` +
					`Valid types: ${Object.keys(STAMP_DUTY_RATES).join(", ")}`,
			);
		}

		// For primary market issuance, use debenture_issue rate explicitly
		const effectiveRate =
			transactionType === "issue" && productType === "debenture_issue"
				? STAMP_DUTY_RATES.debenture_issue.rate
				: config.rate;

		// Formula: stampDutyAmount = transactionAmount × (rateBps / 10000)
		// Round to 2 decimal places (paise precision)
		const stampDutyAmount = config.isExempt
			? 0
			: Math.round((transactionAmount * effectiveRate) / 10000 * 100) / 100;

		return {
			transactionAmount,
			stampDutyRate: effectiveRate,
			stampDutyAmount,
			isExempt: config.isExempt,
			exemptionReason: config.isExempt
				? (config as any).exemptionReason
				: undefined,
			payerSide: config.payerSide,
			regulatorReference: config.regulatorReference,
			statuteSection: config.statuteSection,
			effectiveDate: EFFECTIVE_DATE,
			engine_version: STAMP_DUTY_ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Full explainability view — returns calculation with formula, inputs, and
	 * step-by-step reasoning for compliance officer review (GCR requirement).
	 *
	 * @param productType       - Securities product type key
	 * @param transactionAmount - Transaction value in INR
	 * @param transactionType   - "purchase" | "sale" | "transfer" | "issue"
	 */
	calculateWithExplainability(
		productType: ProductType,
		transactionAmount: number,
		transactionType: "purchase" | "sale" | "transfer" | "issue" = "purchase",
	): StampDutyExplainability {
		const calc = this.calculateStampDuty(productType, transactionAmount, transactionType);
		const config = STAMP_DUTY_RATES[productType];

		const ratePercent = `${(calc.stampDutyRate / 100).toFixed(4)}%`;
		const steps: string[] = calc.isExempt
			? [
					`Product type: ${productType}`,
					`Exemption applies: ${(config as any).exemptionReason}`,
					`Stamp duty amount: ₹0 (exempt)`,
				]
			: [
					`Product type: ${productType} (${config.transactionContext})`,
					`Transaction amount: ₹${transactionAmount.toLocaleString("en-IN")}`,
					`Rate: ${calc.stampDutyRate} bps = ${ratePercent}`,
					`Formula: ₹${transactionAmount} × (${calc.stampDutyRate} ÷ 10,000)`,
					`= ₹${transactionAmount} × ${calc.stampDutyRate / 10000}`,
					`= ₹${calc.stampDutyAmount} (rounded to 2 decimal places)`,
					`Payer: ${calc.payerSide}`,
				];

		return {
			...calc,
			explainability: {
				formula: "stampDutyAmount = transactionAmount × (rateBps / 10000)",
				inputs: {
					transactionAmount,
					rateBps: calc.stampDutyRate,
					ratePercent,
					divisor: 10000,
				},
				steps,
				regulatoryBasis: `${calc.regulatorReference} — effective ${EFFECTIVE_DATE}`,
			},
		};
	}

	/**
	 * Get stamp duty breakdown for display in order dialogs
	 */
	getStampDutyBreakdown(
		productType: ProductType,
		transactionAmount: number,
	): StampDutyBreakdown {
		const calc = this.calculateStampDuty(productType, transactionAmount);

		return {
			principal: transactionAmount,
			stampDuty: calc.stampDutyAmount,
			stampDutyRate: calc.isExempt
				? "Exempt"
				: `${calc.stampDutyRate} bps (${(calc.stampDutyRate / 100).toFixed(4)}%)`,
			isExempt: calc.isExempt,
			exemptionReason: calc.exemptionReason,
			payerSide: calc.payerSide,
			regulatorReference: calc.regulatorReference,
			total: transactionAmount + calc.stampDutyAmount,
		};
	}

	/**
	 * Get stamp duty config from database (with cache).
	 * Falls back gracefully to static STAMP_DUTY_RATES if DB is unavailable.
	 */
	async getConfigFromDb(productType: string): Promise<StampDutyConfig | null> {
		const now = new Date();
		if (now.getTime() - this.lastCacheRefresh.getTime() > this.CACHE_TTL_MS) {
			this.configCache.clear();
			this.lastCacheRefresh = now;
		}

		if (this.configCache.has(productType)) {
			return this.configCache.get(productType)!;
		}

		try {
			const config = await db
				.select()
				.from(stampDutyConfig)
				.where(
					and(
						eq(stampDutyConfig.productType, productType),
						eq(stampDutyConfig.isActive, true),
						lte(
							stampDutyConfig.effectiveFrom,
							new Date().toISOString().split("T")[0],
						),
						or(
							isNull(stampDutyConfig.effectiveTo),
							gte(
								stampDutyConfig.effectiveTo,
								new Date().toISOString().split("T")[0],
							),
						),
					),
				)
				.limit(1);

			if (config.length > 0) {
				this.configCache.set(productType, config[0]);
				return config[0];
			}
		} catch (error) {
			logger.warn(
				"[StampDutyService] Database query failed, using static rates",
				{ product_type: productType, error: (error as Error)?.message },
			);
		}

		return null;
	}

	/**
	 * Log stamp duty calculation for audit trail (7-year retention per SEBI).
	 * Failure is non-blocking — audit failure must not block the transaction.
	 */
	async logAudit(
		transactionId: string,
		transactionType: "bond_order" | "unlisted_deal",
		productType: string,
		isin: string | null,
		productName: string,
		transactionAmount: number,
		calculation: StampDutyCalculation,
		payerUserId: string,
		payerState?: string,
	): Promise<void> {
		try {
			const retentionExpiry = new Date();
			retentionExpiry.setFullYear(retentionExpiry.getFullYear() + 7);

			const auditEntry: InsertStampDutyAuditLog = {
				transactionId,
				transactionType,
				productType,
				isin,
				productName,
				transactionAmount: transactionAmount.toString(),
				stampDutyRate: calculation.stampDutyRate.toString(),
				stampDutyAmount: calculation.stampDutyAmount.toString(),
				isExempt: calculation.isExempt,
				exemptionReason: calculation.exemptionReason,
				payerUserId,
				payerSide: calculation.payerSide,
				payerState,
				regulatorReference: calculation.regulatorReference,
				statuteSection: calculation.statuteSection,
				effectiveRateDate: calculation.effectiveDate,
				collectionStatus: "collected",
				retentionExpiresAt: retentionExpiry,
			};

			await db.insert(stampDutyAuditLog).values(auditEntry);

			logger.info("[StampDutyService] Audit logged", {
				event: "STAMP_DUTY_AUDIT_LOGGED",
				transaction_id: transactionId,
				transaction_type: transactionType,
				product_type: productType,
				amount: transactionAmount,
				stamp_duty: calculation.stampDutyAmount,
				engine_version: calculation.engine_version,
			});
		} catch (error) {
			logger.error(
				"[StampDutyService] Failed to log audit — transaction continues",
				{ transaction_id: transactionId },
				error as Error,
			);
			// Non-blocking: audit failure must not block the transaction
		}
	}

	/**
	 * Get all stamp duty rates for admin display / regulatory review.
	 */
	getAllRates(): Record<string, any> {
		return Object.entries(STAMP_DUTY_RATES).map(([key, value]) => ({
			productType: key,
			...value,
			ratePercent: `${(value.rate / 100).toFixed(4)}%`,
			effectiveFrom: EFFECTIVE_DATE,
			engine_version: STAMP_DUTY_ENGINE_VERSION,
		}));
	}

	/**
	 * Check if a product type is exempt from stamp duty.
	 */
	isExempt(productType: ProductType): boolean {
		return STAMP_DUTY_RATES[productType]?.isExempt ?? false;
	}

	/**
	 * Get payer side for a product type.
	 */
	getPayerSide(productType: ProductType): "buyer" | "seller" | "transferor" {
		return STAMP_DUTY_RATES[productType]?.payerSide ?? "buyer";
	}

	/**
	 * Seed stamp duty configuration to database.
	 * Safe to call multiple times — only inserts missing records.
	 */
	async seedConfiguration(): Promise<void> {
		try {
			const entries = Object.entries(STAMP_DUTY_RATES);

			for (const [productType, config] of entries) {
				const existing = await db
					.select()
					.from(stampDutyConfig)
					.where(eq(stampDutyConfig.productType, productType))
					.limit(1);

				if (existing.length === 0) {
					await db.insert(stampDutyConfig).values({
						productType,
						productTypeLabel: productType
							.replace(/_/g, " ")
							.replace(/\b\w/g, (l) => l.toUpperCase()),
						stampDutyBps: config.rate.toString(),
						isExempt: config.isExempt,
						exemptionReason: (config as any).exemptionReason || null,
						payerSide: config.payerSide,
						applicableTransactionTypes: ["purchase", "sale", "transfer"],
						regulatorReference: config.regulatorReference,
						statuteSection: config.statuteSection,
						effectiveFrom: EFFECTIVE_DATE,
						collectingAgent: "platform",
						remittanceFrequency: "monthly",
						isActive: true,
					});
					logger.info("[StampDutyService] Seeded config", {
						event: "STAMP_DUTY_CONFIG_SEEDED",
						product_type: productType,
						rate_bps: config.rate,
						engine_version: STAMP_DUTY_ENGINE_VERSION,
					});
				}
			}

			logger.info("[StampDutyService] Configuration seeding complete", {
				event: "STAMP_DUTY_SEED_COMPLETE",
				total_products: entries.length,
				engine_version: STAMP_DUTY_ENGINE_VERSION,
			});
		} catch (error) {
			logger.warn(
				"[StampDutyService] Failed to seed configuration",
				{ error: (error as Error)?.message },
			);
		}
	}
}

export const stampDutyService = new StampDutyService();
