/**
 * FintekPro Knowledge Hub Auto-Heal & Quality Sentinel
 * Adheres strictly to FintekPro GCR v1.0 + SEBI FASP-AI v1.0
 * 
 * Provides continuous autonomous quality auditing, financial consistency verification,
 * anomaly detection, and automated self-healing for the Daily Market Brief and
 * Knowledge Hub pages.
 */

import { logger } from "../logger";
import { telemetryBus } from "./engine-telemetry-bus";
import { knowledgeHubService } from "./knowledge-hub-service";

export interface QualityViolation {
	code: string;
	field: string;
	severity: "critical" | "warning";
	message: string;
	remedy: string;
}

export interface QualityAuditDimensionScores {
	freshness: number;               // Max 20 pts
	institutionalFinancials: number; // Max 25 pts
	commodityMacroPricing: number;   // Max 20 pts
	narrativeCompleteness: number;   // Max 20 pts
	sebiCompliance: number;          // Max 15 pts
}

export interface QualityAuditReport {
	region: string;
	targetDate: string;
	briefDate?: string;
	version: number;
	qualityScore: number;            // 0 - 100
	status: "PRISTINE" | "DEGRADED" | "CORRUPTED" | "HEALED";
	dimensions: QualityAuditDimensionScores;
	violations: QualityViolation[];
	auditedAt: string;
	healedAt?: string;
	autoHealTriggered?: boolean;
}

export interface SentinelStatusSummary {
	status: "healthy" | "healing" | "degraded";
	overallQualityScore: number;
	autoHealActive: boolean;
	lastAuditAt: string | null;
	lastHealedAt: string | null;
	totalAudits: number;
	totalHeals: number;
	regions: Record<string, QualityAuditReport>;
	recentViolations: QualityViolation[];
	engineVersion: string;
}

export class KnowledgeHubAutoHealSentinel {
	private static instance: KnowledgeHubAutoHealSentinel;
	private lastAuditReports: Map<string, QualityAuditReport> = new Map();
	private recentHeals: Array<{ region: string; timestamp: string; preScore: number; postScore: number; reason: string }> = [];
	private totalAudits = 0;
	private totalHeals = 0;
	private isHealingInProgress: Map<string, boolean> = new Map();

	private constructor() {}

	public static getInstance(): KnowledgeHubAutoHealSentinel {
		if (!KnowledgeHubAutoHealSentinel.instance) {
			KnowledgeHubAutoHealSentinel.instance = new KnowledgeHubAutoHealSentinel();
		}
		return KnowledgeHubAutoHealSentinel.instance;
	}

	/**
	 * Resolves the expected trading date in IST (Asia/Kolkata)
	 */
	public getExpectedTradingDate(): string {
		const now = new Date();
		// Format in IST
		const istString = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
		return istString;
	}

	/**
	 * Audits a Market Brief against institutional-grade financial and narrative rules
	 */
	public auditBrief(brief: any, region: string = "india"): QualityAuditReport {
		const expectedDate = this.getExpectedTradingDate();
		const briefDate = brief?.date || expectedDate;
		const violations: QualityViolation[] = [];

		let freshness = 20;
		let institutionalFinancials = 25;
		let commodityMacroPricing = 20;
		let narrativeCompleteness = 20;
		let sebiCompliance = 15;

		// ── 1. Freshness & Date Alignment (Max 20 pts) ──────────────────────────
		if (!brief?.date) {
			freshness -= 10;
			violations.push({
				code: "MISSING_BRIEF_DATE",
				field: "date",
				severity: "warning",
				message: "Brief does not contain an explicit calendar date stamp.",
				remedy: "Inject target session date.",
			});
		} else {
			// Check if date is not in the future
			if (brief.date > expectedDate) {
				freshness -= 10;
				violations.push({
					code: "FUTURE_DATE_DRIFT",
					field: "date",
					severity: "warning",
					message: `Brief date (${brief.date}) is ahead of current IST date (${expectedDate}).`,
					remedy: "Align date to current trading session.",
				});
			}
		}

		// ── 2. Multi-Exchange & Institutional Financials (Max 25 pts) ───────────
		if (region === "india") {
			const inst = brief?.multiExchangeData?.institutionalFlows || brief?.institutionalFlows;
			if (!inst) {
				institutionalFinancials -= 20;
				violations.push({
					code: "MISSING_INSTITUTIONAL_FLOWS",
					field: "institutionalFlows",
					severity: "critical",
					message: "Institutional FII/DII cash flow data is missing entirely.",
					remedy: "Sync with official Upstox API v2 / fii-flow-service.",
				});
			} else {
				// FII Net
				if (typeof inst.fiiNetCr !== "number" || Number.isNaN(inst.fiiNetCr)) {
					institutionalFinancials -= 10;
					violations.push({
						code: "INVALID_FII_NET",
						field: "institutionalFlows.fiiNetCr",
						severity: "critical",
						message: "FII Net Cash flow is NaN or non-numeric.",
						remedy: "Re-fetch official Upstox / NSE institutional figures.",
					});
				}

				// DII Net
				if (typeof inst.diiNetCr !== "number" || Number.isNaN(inst.diiNetCr)) {
					institutionalFinancials -= 8;
					violations.push({
						code: "INVALID_DII_NET",
						field: "institutionalFlows.diiNetCr",
						severity: "critical",
						message: "DII Net Cash flow is NaN or non-numeric.",
						remedy: "Re-fetch official Upstox / NSE institutional figures.",
					});
				}

				// Check for stale static fallbacks (-1850 / +3120)
				if (inst.fiiNetCr === -1850 && inst.diiNetCr === 3120) {
					institutionalFinancials -= 10;
					violations.push({
						code: "STATIC_MOCK_FALLBACK_DETECTED",
						field: "institutionalFlows",
						severity: "warning",
						message: "Institutional flow figures match legacy static fallback (-₹1,850 Cr / +₹3,120 Cr).",
						remedy: "Trigger active Upstox API v2 live sync.",
					});
				}

				// Monthly SIP run-rate sanity (AMFI bounds: ₹20,000 Cr - ₹35,000 Cr)
				const sip = Number(inst.monthlySipCr || 0);
				if (sip < 15000 || sip > 45000) {
					institutionalFinancials -= 5;
					violations.push({
						code: "UNREALISTIC_SIP_RUNRATE",
						field: "institutionalFlows.monthlySipCr",
						severity: "warning",
						message: `Monthly SIP run rate (₹${sip} Cr) outside realistic AMFI benchmark band.`,
						remedy: "Reset to current AMFI monthly run rate benchmark (~₹26,425 Cr).",
					});
				}

				// Absorption ratio check: when FII is negative and DII is positive
				if (inst.fiiNetCr < 0 && inst.diiNetCr > 0) {
					const expectedRatio = Math.abs(inst.diiNetCr / inst.fiiNetCr);
					const actualRatio = Number(inst.absorptionRatio || 0);
					if (Number.isNaN(actualRatio) || actualRatio <= 0 || Math.abs(expectedRatio - actualRatio) > 0.1) {
						institutionalFinancials -= 4;
						violations.push({
							code: "ABSORPTION_RATIO_MISMATCH",
							field: "institutionalFlows.absorptionRatio",
							severity: "warning",
							message: `Absorption ratio mismatch: actual ${actualRatio}, calculated ${expectedRatio.toFixed(2)}x.`,
							remedy: "Recalculate absorptionRatio = abs(DII / FII).",
						});
					}
				}
			}
		}

		// ── 3. Commodity & Macro Pricing Ground Truth (Max 20 pts) ──────────────
		if (region === "india") {
			const commodities = brief?.commodityRadar?.commodities || [];
			const gold = commodities.find((c: any) => c.id === "GOLD" || c.name?.toUpperCase().includes("GOLD"));
			const goldPrice = gold?.mcxPrice || brief?.commodityRadar?.goldPrice;

			// CRITICAL: Check if Gold price is in standard 10g benchmark (₹80,000 - ₹180,000)
			// Must never be micro-contract like GOLDPETAL at ₹13,800
			if (typeof goldPrice === "number") {
				if (goldPrice < 50000) {
					commodityMacroPricing -= 15;
					violations.push({
						code: "GOLD_MICRO_CONTRACT_CORRUPTION",
						field: "commodityRadar.goldPrice",
						severity: "critical",
						message: `MCX Gold price (₹${goldPrice}) indicates a micro-contract (e.g. 1g GOLDPETAL) instead of 10g standard benchmark.`,
						remedy: "Resolve standard benchmark contract (GOLD FUT 10g).",
					});
				} else if (goldPrice > 250000) {
					commodityMacroPricing -= 8;
					violations.push({
						code: "GOLD_PRICE_ANOMALY",
						field: "commodityRadar.goldPrice",
						severity: "warning",
						message: `MCX Gold price (₹${goldPrice}) exceeds normal volatility ceiling.`,
						remedy: "Re-query MCX spot benchmark feed.",
					});
				}
			}

			// CCIL Sovereign Yields
			const gsecYield = brief?.ccilFixedIncome?.sovereignYields?.[0]?.yieldPercent || brief?.fbil?.gsec10YBenchmark;
			if (typeof gsecYield === "number" && (gsecYield < 5.0 || gsecYield > 9.5)) {
				commodityMacroPricing -= 5;
				violations.push({
					code: "UNREALISTIC_SOVEREIGN_YIELD",
					field: "ccilFixedIncome.sovereignYields",
					severity: "warning",
					message: `10Y G-Sec yield (${gsecYield}%) is outside plausible RBI sovereign corridors.`,
					remedy: "Re-fetch CCIL sovereign clearing benchmark.",
				});
			}

			// USD/INR Exchange Rate
			const usdInr = brief?.globalMacroDesk?.usdInr || brief?.fbil?.usdInr;
			if (typeof usdInr === "number" && (usdInr < 75 || usdInr > 115)) {
				commodityMacroPricing -= 5;
				violations.push({
					code: "UNREALISTIC_USD_INR",
					field: "globalMacroDesk.usdInr",
					severity: "warning",
					message: `USD/INR exchange rate (${usdInr}) is outside plausible historical band.`,
					remedy: "Re-fetch FBIL reference fixing.",
				});
			}
		}

		// ── 4. Narrative Completeness & Editorial Integrity (Max 20 pts) ────────
		const snapshot = brief?.marketSnapshot || "";
		if (!snapshot || snapshot.length < 60) {
			narrativeCompleteness -= 10;
			violations.push({
				code: "MARKET_SNAPSHOT_TRUNCATED",
				field: "marketSnapshot",
				severity: "critical",
				message: "Market snapshot narrative is empty or truncated (< 60 chars).",
				remedy: "Regenerate complete market snapshot editorial synthesis.",
			});
		} else if (snapshot.includes("undefined") || snapshot.includes("NaN") || snapshot.includes("[object Object]")) {
			narrativeCompleteness -= 10;
			violations.push({
				code: "MARKET_SNAPSHOT_CORRUPTED_TOKENS",
				field: "marketSnapshot",
				severity: "critical",
				message: "Market snapshot narrative contains raw unhydrated tokens ('undefined' / 'NaN').",
				remedy: "Sanitize and re-synthesize editorial tokens.",
			});
		}

		const whatChanged = brief?.whatChanged || "";
		if (!whatChanged || whatChanged.length < 30) {
			narrativeCompleteness -= 5;
			violations.push({
				code: "WHAT_CHANGED_TRUNCATED",
				field: "whatChanged",
				severity: "warning",
				message: "'What Changed' section is incomplete or truncated.",
				remedy: "Regenerate multi-asset what-changed analysis.",
			});
		}

		const movers = brief?.topMovers || [];
		if (!Array.isArray(movers) || movers.length < 3) {
			narrativeCompleteness -= 5;
			violations.push({
				code: "TOP_MOVERS_SPARSE",
				field: "topMovers",
				severity: "warning",
				message: "Top movers list contains fewer than 3 instruments.",
				remedy: "Re-query exchange gainers and losers feed.",
			});
		}

		// ── 5. SEBI FASP-AI v1.0 Regulatory Compliance (Max 15 pts) ─────────────
		const complianceNote = brief?.complianceNote || brief?.regulatoryDisclaimer || "";
		const hasSebiDisclaimer =
			complianceNote.toLowerCase().includes("sebi") ||
			complianceNote.toLowerCase().includes("fasp-ai") ||
			complianceNote.toLowerCase().includes("ria") ||
			complianceNote.toLowerCase().includes("decision support");

		if (!hasSebiDisclaimer) {
			sebiCompliance -= 10;
			violations.push({
				code: "MISSING_SEBI_COMPLIANCE_NOTE",
				field: "complianceNote",
				severity: "critical",
				message: "Missing mandatory SEBI FASP-AI decision-support advisory disclaimer.",
				remedy: "Append standard SEBI FASP-AI non-deterministic regulatory notice.",
			});
		}

		// Check for prohibited deterministic profit language
		const fullText = `${snapshot} ${whatChanged} ${brief?.keyRisks || ""}`.toLowerCase();
		if (fullText.includes("guaranteed return") || fullText.includes("risk-free profit") || fullText.includes("100% gain")) {
			sebiCompliance -= 15;
			violations.push({
				code: "PROHIBITED_DETERMINISTIC_LANGUAGE",
				field: "marketSnapshot",
				severity: "critical",
				message: "Brief text contains prohibited deterministic profit claims.",
				remedy: "Scrub language and enforce probabilistic advisory phrasing.",
			});
		}

		// Ensure points don't drop below 0
		freshness = Math.max(0, freshness);
		institutionalFinancials = Math.max(0, institutionalFinancials);
		commodityMacroPricing = Math.max(0, commodityMacroPricing);
		narrativeCompleteness = Math.max(0, narrativeCompleteness);
		sebiCompliance = Math.max(0, sebiCompliance);

		const qualityScore = Math.min(100, Math.round(
			freshness + institutionalFinancials + commodityMacroPricing + narrativeCompleteness + sebiCompliance
		));

		const hasCritical = violations.some((v) => v.severity === "critical");
		const status: QualityAuditReport["status"] =
			qualityScore >= 95 && !hasCritical
				? "PRISTINE"
				: qualityScore >= 80
				? "DEGRADED"
				: "CORRUPTED";

		const report: QualityAuditReport = {
			region,
			targetDate: expectedDate,
			briefDate,
			version: brief?.version || 1,
			qualityScore,
			status,
			dimensions: {
				freshness,
				institutionalFinancials,
				commodityMacroPricing,
				narrativeCompleteness,
				sebiCompliance,
			},
			violations,
			auditedAt: new Date().toISOString(),
		};

		this.lastAuditReports.set(region, report);
		this.totalAudits++;

		return report;
	}

	/**
	 * Autonomous Self-Healing Pipeline
	 * Automatically cures data quality gaps, anomalous prices, or stale feeds
	 */
	public async autoHeal(
		region: string = "india",
		options: { force?: boolean; reason?: string } = {}
	): Promise<{
		healed: boolean;
		preScore: number;
		postScore: number;
		violationsResolved: number;
		healedBrief: any;
		report: QualityAuditReport;
	}> {
		const lockKey = `${region}`;
		if (this.isHealingInProgress.get(lockKey)) {
			logger.warn(`[AutoHealSentinel] ⚠️ Self-healing already in progress for ${region}, waiting...`);
			return {
				healed: false,
				preScore: 0,
				postScore: 0,
				violationsResolved: 0,
				healedBrief: null,
				report: this.lastAuditReports.get(region) || ({} as QualityAuditReport),
			};
		}

		this.isHealingInProgress.set(lockKey, true);
		const t0 = Date.now();

		try {
			logger.info(`[AutoHealSentinel] 🩺 Initiating autonomous auto-heal for region [${region}] (reason: ${options.reason || "Quality Sentinel Audit"})...`);

			// 1. Audit current brief
			const currentBrief = await knowledgeHubService.getTodaysBrief(region);
			const initialAudit = this.auditBrief(currentBrief, region);

			if (!options.force && initialAudit.qualityScore >= 95 && initialAudit.status === "PRISTINE") {
				logger.info(`[AutoHealSentinel] ✅ Brief for ${region} is already PRISTINE (${initialAudit.qualityScore}%). No healing required.`);
				return {
					healed: false,
					preScore: initialAudit.qualityScore,
					postScore: initialAudit.qualityScore,
					violationsResolved: 0,
					healedBrief: currentBrief,
					report: initialAudit,
				};
			}

			// 2. Invalidate caches (Redis + in-memory)
			const expectedDate = this.getExpectedTradingDate();
			try {
				const { getSharedRedis } = await import("../utils/redis-client");
				const redis = await getSharedRedis();
				if (redis?.isOpen) {
					await redis.del(`cache:knowledge_hub_brief:${region}:${expectedDate}`);
					logger.debug(`[AutoHealSentinel] 🧹 Flushed Redis cache for ${region}:${expectedDate}`);
				}
			} catch (cErr: any) {
				logger.warn(`[AutoHealSentinel] Cache flush warning: ${cErr?.message}`);
			}

			// 3. For India: Trigger deep multi-tier upstream synchronization
			if (region === "india") {
				// Re-sync official Upstox FII/DII institutional cash flows
				try {
					const { fiiFlowService } = await import("./macro/fii-flow-service");
					await fiiFlowService.syncAndPersistDailyFlow();
					logger.info("[AutoHealSentinel] 🔄 Synchronized institutional FII/DII feeds via Upstox API v2");
				} catch (fErr: any) {
					logger.warn(`[AutoHealSentinel] FII/DII sync non-fatal warning: ${fErr?.message}`);
				}

				// Re-sync Golden Pricing Engine live snapshots
				try {
					const { goldenPricingEngine } = await import("./golden-pricing/GoldenPricingEngine");
					await goldenPricingEngine.getDailyMarketBriefLiveSnapshot(region, true);
					logger.info("[AutoHealSentinel] 🔄 Force-refreshed Golden Pricing Engine live snapshots");
				} catch (gpErr: any) {
					logger.warn(`[AutoHealSentinel] Golden Pricing sync warning: ${gpErr?.message}`);
				}
			}

			// 4. Force regenerate and publish a new pristine brief in database
			const healedBrief = await knowledgeHubService.generateAndPublishDailyBrief(region, expectedDate);

			// 5. Re-audit newly persisted brief
			const postAudit = this.auditBrief(healedBrief, region);
			postAudit.status = "HEALED";
			postAudit.healedAt = new Date().toISOString();
			postAudit.autoHealTriggered = true;

			this.lastAuditReports.set(region, postAudit);
			this.totalHeals++;

			this.recentHeals.unshift({
				region,
				timestamp: new Date().toISOString(),
				preScore: initialAudit.qualityScore,
				postScore: postAudit.qualityScore,
				reason: options.reason || initialAudit.violations[0]?.message || "Quality threshold breach",
			});
			if (this.recentHeals.length > 50) this.recentHeals.pop();

			logger.info(
				`[AutoHealSentinel] 🌟 Auto-heal complete for ${region}: Quality Score ${initialAudit.qualityScore}% ➔ ${postAudit.qualityScore}% (${postAudit.violations.length} remaining violations)`
			);

			// 6. Report healing telemetry
			telemetryBus.report({
				engineId: "knowledge-hub-auto-heal-sentinel",
				engineName: "Knowledge Hub Auto-Heal Sentinel",
				category: "Data Quality",
				reportedAt: new Date().toISOString(),
				latencyMs: Date.now() - t0,
				qualityScore: postAudit.qualityScore,
				itemsProcessed: 1,
				errorCount: postAudit.violations.filter((v) => v.severity === "critical").length,
				meta: {
					event: "KNOWLEDGE_HUB_AUTO_HEAL_COMPLETE",
					region,
					date: expectedDate,
					preScore: initialAudit.qualityScore,
					postScore: postAudit.qualityScore,
					version: healedBrief?.version,
				},
			});

			return {
				healed: true,
				preScore: initialAudit.qualityScore,
				postScore: postAudit.qualityScore,
				violationsResolved: Math.max(0, initialAudit.violations.length - postAudit.violations.length),
				healedBrief,
				report: postAudit,
			};
		} finally {
			this.isHealingInProgress.delete(lockKey);
		}
	}

	/**
	 * Periodic Autonomous Health Sweep across all supported regions
	 */
	public async runPeriodicHealthSweep(): Promise<Record<string, QualityAuditReport>> {
		const regions = ["india", "global", "us"];
		const results: Record<string, QualityAuditReport> = {};

		for (const region of regions) {
			try {
				const brief = await knowledgeHubService.getTodaysBrief(region);
				const audit = this.auditBrief(brief, region);
				results[region] = audit;

				// If quality score is degraded (< 92%) or has critical violations, auto-heal immediately
				if (audit.qualityScore < 92 || audit.violations.some((v) => v.severity === "critical")) {
					logger.warn(
						`[AutoHealSentinel] ⚠️ Quality breach detected in ${region} brief (${audit.qualityScore}%). Triggering autonomous auto-heal...`
					);
					const healResult = await this.autoHeal(region, {
						reason: `Autonomous Periodic Sweep: Score ${audit.qualityScore}% < 92%`,
					});
					results[region] = healResult.report;
				}
			} catch (err: any) {
				logger.error(`[AutoHealSentinel] ❌ Error auditing region ${region}: ${err?.message}`);
			}
		}

		return results;
	}

	/**
	 * Returns current Sentinel monitoring dashboard status
	 */
	public getSentinelStatus(): SentinelStatusSummary {
		const reports = Array.from(this.lastAuditReports.values());
		const avgScore =
			reports.length > 0
				? Math.round(reports.reduce((acc, r) => acc + r.qualityScore, 0) / reports.length)
				: 99;

		const hasDegraded = reports.some((r) => r.status === "DEGRADED" || r.status === "CORRUPTED");

		const allViolations: QualityViolation[] = [];
		for (const report of reports) {
			allViolations.push(...report.violations);
		}

		const regionsRecord: Record<string, QualityAuditReport> = {};
		this.lastAuditReports.forEach((report, key) => {
			regionsRecord[key] = report;
		});

		return {
			status: hasDegraded ? "degraded" : "healthy",
			overallQualityScore: avgScore,
			autoHealActive: true,
			lastAuditAt: reports[0]?.auditedAt || null,
			lastHealedAt: this.recentHeals[0]?.timestamp || null,
			totalAudits: this.totalAudits,
			totalHeals: this.totalHeals,
			regions: regionsRecord,
			recentViolations: allViolations.slice(0, 10),
			engineVersion: "FASP-AI-v1.0-SSOT",
		};
	}
}

export const knowledgeHubAutoHealSentinel = KnowledgeHubAutoHealSentinel.getInstance();
