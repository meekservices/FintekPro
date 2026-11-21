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
import { marketHolidayService } from "./market-holiday-service";

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
				const fiiNet = typeof inst.fiiNetCr === "number" && !Number.isNaN(inst.fiiNetCr)
					? inst.fiiNetCr
					: typeof inst.fiiNetInflowCr === "number" && !Number.isNaN(inst.fiiNetInflowCr)
						? inst.fiiNetInflowCr
						: null;

				const diiNet = typeof inst.diiNetCr === "number" && !Number.isNaN(inst.diiNetCr)
					? inst.diiNetCr
					: typeof inst.diiNetInflowCr === "number" && !Number.isNaN(inst.diiNetInflowCr)
						? inst.diiNetInflowCr
						: null;

				// FII Net
				if (fiiNet === null) {
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
				if (diiNet === null) {
					institutionalFinancials -= 8;
					violations.push({
						code: "INVALID_DII_NET",
						field: "institutionalFlows.diiNetCr",
						severity: "critical",
						message: "DII Net Cash flow is NaN or non-numeric.",
						remedy: "Re-fetch official Upstox / NSE institutional figures.",
					});
				}

				// Check for stale static fallbacks (-1850 / +3120) or (+5736.55 / -2253.58)
				if (
					fiiNet !== null && diiNet !== null &&
					((fiiNet === -1850 && diiNet === 3120) ||
					(fiiNet === 5736.55 && diiNet === -2253.58))
				) {
					institutionalFinancials -= 10;
					violations.push({
						code: "STATIC_MOCK_FALLBACK_DETECTED",
						field: "institutionalFlows",
						severity: "warning",
						message: "Institutional flow figures match legacy static fallback snapshot.",
						remedy: "Trigger active Upstox API v2 live sync or dynamic holiday-aware backfill.",
					});
				}

				// Check for stale trade date against latest settled trading day
				const expectedSettledDate = marketHolidayService.getLatestSettledTradingDate("NSE");
				if (inst.asOfDate) {
					const flowDate = String(inst.asOfDate).split("T")[0];
					if (flowDate < expectedSettledDate) {
						institutionalFinancials -= 10;
						violations.push({
							code: "STALE_INSTITUTIONAL_FLOW_DATE",
							field: "institutionalFlows.asOfDate",
							severity: "warning",
							message: `Institutional feed trade date (${flowDate}) is stale compared to latest settled trading day (${expectedSettledDate}).`,
							remedy: "Synchronize latest exchange feed from Upstox / fiiFlowService.",
						});
					}
				}

				// Monthly SIP run-rate sanity (AMFI bounds: ₹20,000 Cr - ₹35,000 Cr)
				const sip = Number(inst.monthlySipCr ?? inst.monthlyMfSipRunRateCr ?? 0);
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
				if (fiiNet !== null && diiNet !== null && fiiNet < 0 && diiNet > 0) {
					const expectedRatio = Math.abs(diiNet / fiiNet);
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

			// CRITICAL: Check if Gold price is in standard 10g benchmark (₹65,000 - ₹90,000)
			// Must never be micro-contract like GOLDPETAL at ₹13,800 or unanchored mock like ₹1,41,255
			if (typeof goldPrice === "number") {
				if (goldPrice < 55000) {
					commodityMacroPricing -= 15;
					violations.push({
						code: "GOLD_MICRO_CONTRACT_CORRUPTION",
						field: "commodityRadar.goldPrice",
						severity: "critical",
						message: `MCX Gold price (₹${goldPrice}) indicates a micro-contract (e.g. 1g GOLDPETAL) instead of 10g standard benchmark.`,
						remedy: "Resolve standard benchmark contract (GOLD FUT 10g, ~₹78,000).",
					});
				} else if (goldPrice > 95000) {
					commodityMacroPricing -= 12;
					violations.push({
						code: "GOLD_PRICE_ANOMALY",
						field: "commodityRadar.goldPrice",
						severity: "critical",
						message: `MCX Gold price (₹${goldPrice}/10g) exceeds normal benchmark corridor [₹65,000 - ₹90,000]. Unanchored synthetic mock detected.`,
						remedy: "Re-query MCX spot benchmark feed via commodityMarketService.",
					});
				}
			}

			// CRITICAL: Check Silver benchmark price (1kg standard: ₹75,000 - ₹105,000)
			const silver = commodities.find((c: any) => c.id === "SILVER" || c.name?.toUpperCase().includes("SILVER"));
			const silverPrice = silver?.mcxPrice || brief?.commodityRadar?.silverPrice;
			if (typeof silverPrice === "number") {
				if (silverPrice < 65000 || silverPrice > 115000) {
					commodityMacroPricing -= 8;
					violations.push({
						code: "SILVER_PRICE_ANOMALY",
						field: "commodityRadar.silverPrice",
						severity: "warning",
						message: `MCX Silver price (₹${silverPrice}/kg) outside standard market band [₹75,000 - ₹105,000].`,
						remedy: "Re-query official MCX silver spot quote.",
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

			// Real Yield Mathematical Parity Check
			const reportedRealYield = brief?.ccilFixedIncome?.yieldCurveAnalysis?.realYield10Y ?? brief?.sovereign?.realYield10Y;
			const cpi = brief?.macroIndicators?.indiaCpiInflation?.value ?? 6.21;
			if (typeof gsecYield === "number" && typeof reportedRealYield === "number" && typeof cpi === "number") {
				const expectedRealYield = Number((gsecYield - cpi).toFixed(2));
				if (Math.abs(reportedRealYield - expectedRealYield) > 0.15) {
					commodityMacroPricing -= 5;
					violations.push({
						code: "REAL_YIELD_FORMULA_MISMATCH",
						field: "ccilFixedIncome.yieldCurveAnalysis.realYield10Y",
						severity: "warning",
						message: `Real yield (+${reportedRealYield}%) does not match 10Y G-Sec (${gsecYield}%) minus CPI (${cpi}%) which equals +${expectedRealYield}%.`,
						remedy: "Recalculate real yield dynamically as gsec10Y - cpi.",
					});
				}
			}

			// USD/INR Exchange Rate (Plausible corridor: ₹80.00 - ₹89.00)
			const usdInr = brief?.globalMacroDesk?.usdInr || brief?.fbil?.usdInr;
			if (typeof usdInr === "number" && (usdInr < 78 || usdInr > 89)) {
				commodityMacroPricing -= 12;
				violations.push({
					code: "UNREALISTIC_USD_INR",
					field: "globalMacroDesk.usdInr",
					severity: "critical",
					message: `USD/INR exchange rate (₹${usdInr}) is outside plausible market band [₹80.00 - ₹89.00]. Legacy mock (e.g. ₹94.86) detected.`,
					remedy: "Re-fetch FBIL reference fixing via fbilMarketService.",
				});
			}
		} else if (region === "us") {
			const fixedIncome = brief?.usFixedIncome || brief?.fixedIncome;
			const tenYear = typeof fixedIncome?.tenYearTreasury === "number" ? fixedIncome.tenYearTreasury : null;
			const twoYear = typeof fixedIncome?.twoYearTreasury === "number" ? fixedIncome.twoYearTreasury : null;
			const spread = typeof fixedIncome?.tenYearMinusTwoYearBps === "number" ? fixedIncome.tenYearMinusTwoYearBps : null;
			const fedFundsTarget = typeof fixedIncome?.fedFundsTargetRate === "string" ? fixedIncome.fedFundsTargetRate.trim() : "";
			const mortgage30Y = typeof fixedIncome?.thirtyYearMortgageAvg === "number" ? fixedIncome.thirtyYearMortgageAvg : null;

			// 10Y Benchmark Treasury corridor: 3.0% to 6.5%
			if (tenYear != null) {
				if (tenYear < 3.0 || tenYear > 6.5) {
					commodityMacroPricing -= 8;
					violations.push({
						code: "UNREALISTIC_US_10Y_YIELD",
						field: "usFixedIncome.tenYearTreasury",
						severity: "critical",
						message: `US 10-Year Treasury yield (${tenYear}%) is outside plausible macro corridor [3.0% - 6.5%].`,
						remedy: "Re-query official FRED DGS10 daily constant maturity release.",
					});
				}
			} else {
				commodityMacroPricing -= 8;
				violations.push({
					code: "MISSING_US_10Y_YIELD",
					field: "usFixedIncome.tenYearTreasury",
					severity: "critical",
					message: "US 10-Year Treasury yield benchmark is missing or non-numeric.",
					remedy: "Resolve official FRED DGS10 benchmark.",
				});
			}

			// 2Y Treasury Yield corridor: 2.5% to 6.0%
			if (twoYear != null) {
				if (twoYear < 2.5 || twoYear > 6.0) {
					commodityMacroPricing -= 6;
					violations.push({
						code: "UNREALISTIC_US_2Y_YIELD",
						field: "usFixedIncome.twoYearTreasury",
						severity: "warning",
						message: `US 2-Year Treasury yield (${twoYear}%) is outside plausible policy proxy corridor [2.5% - 6.0%].`,
						remedy: "Re-query official FRED DGS2 constant maturity release.",
					});
				}
			}

			// Term Spread calculation & Slope consistency
			if (tenYear != null && twoYear != null && spread != null) {
				const expectedSpread = Math.round((tenYear - twoYear) * 100);
				if (Math.abs(expectedSpread - spread) > 2) {
					commodityMacroPricing -= 5;
					violations.push({
						code: "TERM_SPREAD_MATH_MISMATCH",
						field: "usFixedIncome.tenYearMinusTwoYearBps",
						severity: "warning",
						message: `10Y-2Y term spread mismatch: recorded ${spread} bps vs calculated ${expectedSpread} bps.`,
						remedy: "Recalculate term spread = round((10Y - 2Y) * 100).",
					});
				}

				const slope = (fixedIncome?.yieldCurveSlope || "").toLowerCase();
				if (expectedSpread >= 0 && slope.includes("inverted") && !slope.includes("normal")) {
					commodityMacroPricing -= 5;
					violations.push({
						code: "YIELD_CURVE_SLOPE_MISMATCH",
						field: "usFixedIncome.yieldCurveSlope",
						severity: "warning",
						message: `Yield curve slope labeled 'Inverted' despite positive term spread (+${expectedSpread} bps).`,
						remedy: "Correct slope classification to 'Normal Upward'.",
					});
				}
			}

			// Fed Funds Target Range: Syntax & Active Target adherence
			if (fedFundsTarget) {
				const rangeMatch = fedFundsTarget.match(/(\d+\.\d{2})%\s*–\s*(\d+\.\d{2})%/);
				if (!rangeMatch) {
					commodityMacroPricing -= 5;
					violations.push({
						code: "INVALID_FED_FUNDS_RANGE_SYNTAX",
						field: "usFixedIncome.fedFundsTargetRate",
						severity: "warning",
						message: `Fed Funds Target Range format invalid ('${fedFundsTarget}'). Expected 'X.XX% – X.XX%'.`,
						remedy: "Format target range adhering strictly to standard FOMC 25 bps band.",
					});
				} else {
					const lo = parseFloat(rangeMatch[1]);
					const hi = parseFloat(rangeMatch[2]);
					if (Math.abs(hi - lo - 0.25) > 0.01) {
						commodityMacroPricing -= 4;
						violations.push({
							code: "INVALID_FOMC_BANDWIDTH",
							field: "usFixedIncome.fedFundsTargetRate",
							severity: "warning",
							message: `FOMC target bandwidth is ${Math.round((hi - lo) * 100)} bps instead of standard 25 bps.`,
							remedy: "Re-align FOMC target band width to 25 bps.",
						});
					}
					// Check for premature or stale cut band (e.g. 4.25% - 4.50%)
					if (lo < 4.50 && hi <= 4.50) {
						commodityMacroPricing -= 6;
						violations.push({
							code: "OUTDATED_FED_FUNDS_TARGET",
							field: "usFixedIncome.fedFundsTargetRate",
							severity: "critical",
							message: `Fed Funds target range '${fedFundsTarget}' reflects outdated or prematurely cut policy rate. Active FOMC target is 4.50% – 4.75%.`,
							remedy: "Update target band to active official FOMC policy range (4.50% – 4.75%).",
						});
					}
				}
			} else {
				commodityMacroPricing -= 5;
				violations.push({
					code: "MISSING_FED_FUNDS_TARGET",
					field: "usFixedIncome.fedFundsTargetRate",
					severity: "critical",
					message: "Fed Funds Target Range is missing from US fixed income desk.",
					remedy: "Inject active FOMC target range (4.50% – 4.75%).",
				});
			}

			// Freddie Mac 30Y Fixed Mortgage: 5.0% to 9.0%, reject legacy stale 6.55%
			if (mortgage30Y != null) {
				if (mortgage30Y < 5.0 || mortgage30Y > 9.0) {
					commodityMacroPricing -= 5;
					violations.push({
						code: "UNREALISTIC_MORTGAGE_RATE",
						field: "usFixedIncome.thirtyYearMortgageAvg",
						severity: "warning",
						message: `30-Year Mortgage Average (${mortgage30Y}%) outside plausible market bounds [5.0% - 9.0%].`,
						remedy: "Re-query Freddie Mac Primary Mortgage Market Survey (FRED MORTGAGE30US).",
					});
				} else if (mortgage30Y === 6.55) {
					commodityMacroPricing -= 5;
					violations.push({
						code: "STALE_MORTGAGE_FALLBACK_DETECTED",
						field: "usFixedIncome.thirtyYearMortgageAvg",
						severity: "warning",
						message: "30-Year Mortgage Average matches legacy late-September fallback (6.55%). Current PMMS is ~6.78% – 6.84%.",
						remedy: "Update to live Freddie Mac PMMS release (FRED MORTGAGE30US).",
					});
				}
			}
		} else if (region === "global") {
			const globalDesk = brief?.globalMacroDesk;
			const dxy = typeof globalDesk?.dxyIndex === "number" ? globalDesk.dxyIndex : null;
			const bund = typeof globalDesk?.bund10YYield === "number" ? globalDesk.bund10YYield : null;
			const gilt = typeof globalDesk?.gilt10YYield === "number" ? globalDesk.gilt10YYield : null;
			const jgb = typeof globalDesk?.jgb10YYield === "number" ? globalDesk.jgb10YYield : null;

			// DXY Index bounds: 90 to 115
			if (dxy != null) {
				if (dxy < 90 || dxy > 115) {
					commodityMacroPricing -= 8;
					violations.push({
						code: "DXY_OUTLIER_DETECTED",
						field: "globalMacroDesk.dxyIndex",
						severity: "critical",
						message: `US Dollar Index (${dxy}) outside plausible macro corridor [90 - 115].`,
						remedy: "Re-synthesize DXY from ICE geometric currency basket or FRED DTWEXBGS.",
					});
				}
			}

			// Sovereign Debt Corridors: Bund (1.0% - 4.5%), Gilt (2.5% - 6.0%), JGB (0.2% - 2.5%)
			if (bund != null && (bund < 1.0 || bund > 4.5)) {
				commodityMacroPricing -= 4;
				violations.push({
					code: "UNREALISTIC_BUND_YIELD",
					field: "globalMacroDesk.bund10YYield",
					severity: "warning",
					message: `German 10Y Bund yield (${bund}%) outside normal European sovereign band.`,
					remedy: "Re-query European benchmark yield curve.",
				});
			}

			if (gilt != null && (gilt < 2.5 || gilt > 6.0)) {
				commodityMacroPricing -= 4;
				violations.push({
					code: "UNREALISTIC_GILT_YIELD",
					field: "globalMacroDesk.gilt10YYield",
					severity: "warning",
					message: `UK 10Y Gilt yield (${gilt}%) outside normal UK sovereign corridor.`,
					remedy: "Re-query UK DMO gilt benchmark.",
				});
			}

			if (jgb != null && (jgb < 0.2 || jgb > 2.5)) {
				commodityMacroPricing -= 4;
				violations.push({
					code: "UNREALISTIC_JGB_YIELD",
					field: "globalMacroDesk.jgb10YYield",
					severity: "warning",
					message: `Japan 10Y JGB yield (${jgb}%) outside Bank of Japan yield curve control tolerances.`,
					remedy: "Re-query BoJ JGB benchmark feed.",
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

		// ── 6. Policy Enforcement: Zero Synthetic Calculations (FintekPro GCR v1.0) ───
		// Policy mandates: Pure API quotes and official exchange published archives only.
		// Flag any detected synthetic multiplier / synthetic estimation artifacts.
		const sourceStr = `${brief?.ccilFixedIncome?.source || ""} ${brief?.fbil?.source || ""} ${brief?.source || ""}`.toLowerCase();
		if (sourceStr.includes("synthetic") || fullText.includes("synthetic proxy") || fullText.includes("formula multiplier")) {
			sebiCompliance -= 10;
			violations.push({
				code: "SYNTHETIC_CALCULATION_DETECTED",
				field: "source",
				severity: "critical",
				message: "Synthetic calculation or unanchored formula multiplier detected. Policy mandates pure API binding and official published archives only.",
				remedy: "Eliminate synthetic derivation; bind directly to official exchange tick or published FBIL/Bhavcopy fixing.",
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
			const datesToFlush = Array.from(new Set([
				expectedDate,
				new Date().toISOString().split("T")[0],
				currentBrief?.date,
			].filter(Boolean))) as string[];

			try {
				const { getSharedRedis } = await import("../utils/redis-client");
				const redis = await getSharedRedis();
				if (redis?.isOpen) {
					for (const d of datesToFlush) {
						await redis.del(`cache:knowledge_hub_brief:${region}:${d}`);
					}
					logger.debug(`[AutoHealSentinel] 🧹 Flushed Redis cache for ${region} on dates [${datesToFlush.join(", ")}]`);
				}
			} catch (cErr: any) {
				logger.warn(`[AutoHealSentinel] Cache flush warning: ${cErr?.message}`);
			}

			// 3. Multi-tier upstream synchronization based on region
			if (region === "india") {
				// Re-sync official Upstox FII/DII institutional cash flows
				try {
					const { fiiFlowService } = await import("./macro/fii-flow-service");
					await fiiFlowService.syncAndPersistDailyFlow();
					logger.info("[AutoHealSentinel] 🔄 Synchronized institutional FII/DII feeds via Upstox API v2");
				} catch (fErr: any) {
					logger.warn(`[AutoHealSentinel] FII/DII sync non-fatal warning: ${fErr?.message}`);
				}
			} else if (region === "us" || region === "global") {
				// Re-sync official Federal Reserve (FRED) observations
				try {
					const { fredCommodityService } = await import("./fred-commodity-service");
					await fredCommodityService.getCommodityAndMacroSnapshot(true);
					logger.info(`[AutoHealSentinel] 🔄 Force-refreshed FRED commodity and Treasury benchmarks for ${region}`);
				} catch (fredErr: any) {
					logger.warn(`[AutoHealSentinel] FRED sync warning: ${fredErr?.message}`);
				}
			}

			// Re-sync Golden Pricing Engine live snapshots across all regions
			try {
				const { goldenPricingEngine } = await import("./golden-pricing/GoldenPricingEngine");
				await goldenPricingEngine.getDailyMarketBriefLiveSnapshot(region, true);
				logger.info(`[AutoHealSentinel] 🔄 Force-refreshed Golden Pricing Engine live snapshots for ${region}`);
			} catch (gpErr: any) {
				logger.warn(`[AutoHealSentinel] Golden Pricing sync warning: ${gpErr?.message}`);
			}

			// 4. Force regenerate and publish a new pristine brief in database
			const healedBrief = await knowledgeHubService.generateAndPublishDailyBrief(region, expectedDate);
			if (currentBrief?.date && currentBrief.date !== expectedDate) {
				await knowledgeHubService.generateAndPublishDailyBrief(region, currentBrief.date).catch(() => null);
			}

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
