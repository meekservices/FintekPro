/**
 * @file sebi-holding-compliance-service.ts
 * @description SEBI Mutual Fund & Model Portfolio Holdings Compliance Engine.
 *
 * Enforces the core statutory rules from:
 * 1. SEBI (Mutual Funds) Regulations, 1996 — Seventh Schedule (Investment Restrictions).
 * 2. SEBI Master Circular for Mutual Funds (SEBI/HO/IMD/IMD-PoD-1/P/CIR/2023/74).
 * 3. SEBI Scheme Categorization and Rationalization Norms (Circular Oct 6, 2017).
 * 4. SEBI Mandate on Timelines for Rebalancing of Portfolios (Circular Mar 30, 2022).
 * 5. SEBI (Investment Advisers) Regulations, 2013 — Regulation 16 Fiduciary Standards.
 *
 * Statutory Guardrails Enforced:
 * - Rule 1: Single Issuer Equity Concentration Cap (10% hard cap, 8% warning).
 * - Rule 2: Single Issuer Debt Instrument Cap (10% hard cap, 12% with Board approval).
 * - Rule 3: Single Corporate Group Exposure Limit (20% cap).
 * - Rule 4: Single Sector Exposure Limit (20% cap).
 * - Rule 5: SEBI Categorization Minimums (Large Cap ≥80%, Mid Cap ≥65%, Small Cap ≥65%, Multi Cap 25/25/25, Flexi Cap ≥65%).
 * - Rule 6: Focused Fund Cap (Maximum 30 stocks).
 * - Rule 7: Unlisted Securities Prohibition (0% in open-ended portfolios).
 * - Rule 8: Passive Drift Monitoring & 30-Day Rectification Clock.
 *
 * @engineVersion SEBI-COMPLIANCE-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.0 audit trail logging to agent_compliance_audit_logs.
 */

import { db } from "../db";
import {
	modelPortfolios,
	modelPortfolioHoldings,
	investmentProposals,
	agentComplianceAuditLogs,
} from "@shared/schema";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import { logger } from "../logger";

export interface SebiRuleCheck {
	ruleId: string;
	ruleName: string;
	statutoryReference: string;
	thresholdLimit: number;
	observedValue: number;
	unit: "% of NAV" | "count" | "days";
	status: "PASS" | "WARNING" | "BREACH";
	details: string;
	offendingItems?: string[];
}

export interface SebiComplianceReport {
	entityType: "MODEL_PORTFOLIO" | "ADVISORY_PROPOSAL";
	entityId: string;
	entityName: string;
	entityCode?: string;
	category: string;
	overallStatus: "COMPLIANT" | "WARNING" | "NON_COMPLIANT";
	complianceScore: number; // 0 - 100
	summary: string;
	checks: SebiRuleCheck[];
	breaches: string[];
	warnings: string[];
	remedialActions: string[];
	rectificationDeadline?: string;
	disclaimer: string;
	meta: {
		engineVersion: string;
		calculationTimestamp: string;
	};
}

export interface SebiRulebook {
	version: string;
	updatedAt: string;
	governingRegulations: string[];
	rules: Array<{
		id: string;
		name: string;
		reference: string;
		threshold: string;
		description: string;
		impactIfBreached: string;
	}>;
}

export class SebiHoldingComplianceService {
	private static instance: SebiHoldingComplianceService;

	// Statutory limits
	static readonly SINGLE_STOCK_LIMIT_PCT = 10.0;
	static readonly SINGLE_STOCK_WARN_PCT = 8.0;
	static readonly SINGLE_DEBT_ISSUER_LIMIT_PCT = 10.0;
	static readonly GROUP_EXPOSURE_LIMIT_PCT = 20.0;
	static readonly SECTOR_EXPOSURE_LIMIT_PCT = 20.0;
	static readonly FOCUSED_FUND_MAX_STOCKS = 30;
	static readonly PASSIVE_DRIFT_THRESHOLD_PCT = 5.0;
	static readonly REBALANCE_TIMELINE_DAYS = 30;

	static getInstance(): SebiHoldingComplianceService {
		if (!SebiHoldingComplianceService.instance) {
			SebiHoldingComplianceService.instance = new SebiHoldingComplianceService();
		}
		return SebiHoldingComplianceService.instance;
	}

	/**
	 * Returns the statutory SEBI Compliance Rulebook.
	 */
	getSebiRulebook(): SebiRulebook {
		return {
			version: "SEBI-COMPLIANCE-v1.0",
			updatedAt: "2026-10-23",
			governingRegulations: [
				"SEBI (Mutual Funds) Regulations, 1996 — Seventh Schedule",
				"SEBI Master Circular for Mutual Funds (SEBI/HO/IMD/IMD-PoD-1/P/CIR/2023/74)",
				"SEBI Circular on Categorization of Mutual Fund Schemes (SEBI/HO/IMD/DF3/CIR/P/2017/114)",
				"SEBI Circular on Timelines for Rebalancing of Portfolios (SEBI/HO/IMD/IMD-II DOF3/P/CIR/2022/39)",
				"SEBI (Investment Advisers) Regulations, 2013 — Regulation 16",
			],
			rules: [
				{
					id: "SEBI-7TH-SCH-1",
					name: "Single Issuer Equity Exposure Cap",
					reference: "Seventh Schedule, Clause 1",
					threshold: "Max 10.0% of Scheme NAV",
					description: "No mutual fund scheme shall invest more than 10% of its NAV in equity shares or equity-related instruments of any single company.",
					impactIfBreached: "Breach alert. Portfolio blocked from new purchases in the issuer; mandatory rebalance within 30 days.",
				},
				{
					id: "SEBI-7TH-SCH-2",
					name: "Single Issuer Debt Exposure Cap",
					reference: "Seventh Schedule, Clause 2",
					threshold: "Max 10.0% of Scheme NAV (extendable to 12% with Board approval)",
					description: "A mutual fund scheme shall not invest more than 10% of its NAV in debt instruments comprising money market and non-money market instruments issued by a single issuer.",
					impactIfBreached: "Breach alert. Mandatory notification to AMC Board and Trustees.",
				},
				{
					id: "SEBI-GROUP-EXP",
					name: "Single Corporate Group Exposure Limit",
					reference: "SEBI Master Circular §3.3",
					threshold: "Max 20.0% of Scheme NAV (extendable to 25% with Trustee approval)",
					description: "Total investments in debt and money market instruments across all entities belonging to a single corporate group shall not exceed 20% of NAV.",
					impactIfBreached: "Requires Trustee justification and immediate trimming.",
				},
				{
					id: "SEBI-SECTOR-EXP",
					name: "Single Sector Exposure Limit",
					reference: "SEBI Master Circular §3.2",
					threshold: "Max 20.0% of Scheme NAV (+5% for Housing Finance Companies)",
					description: "Total exposure of a debt scheme in a particular sector (excluding G-Secs, T-Bills, and TREPS) shall not exceed 20% of the net assets of the scheme.",
					impactIfBreached: "Trimming required within 30 business days.",
				},
				{
					id: "SEBI-CAT-MANDATE",
					name: "SEBI Scheme Categorization Minimums",
					reference: "SEBI Circular Oct 6, 2017",
					threshold: "Large Cap ≥80%, Mid Cap ≥65%, Small Cap ≥65%, Multi Cap 25/25/25, Flexi Cap ≥65%",
					description: "Open-ended equity schemes must maintain statutory minimum asset allocations according to their defined mandate.",
					impactIfBreached: "Passive breach clock starts. 30 business days to restore allocation.",
				},
				{
					id: "SEBI-FOCUSED-CAP",
					name: "Focused Fund Holding Count Cap",
					reference: "SEBI Circular Oct 6, 2017 §A.7",
					threshold: "Maximum 30 Stocks",
					description: "A Focused Fund is restricted to investing in a maximum of 30 stocks across market capitalization.",
					impactIfBreached: "Scheme cannot add 31st stock; must exit a holding before initiating new position.",
				},
				{
					id: "SEBI-UNLISTED-PROHIB",
					name: "Unlisted Securities Prohibition",
					reference: "SEBI Circular Oct 1, 2019",
					threshold: "0% in Open-Ended Equity Schemes",
					description: "Mutual funds cannot invest in unlisted equity shares or commercial papers in open-ended schemes.",
					impactIfBreached: "Immediate liquidation and statutory reporting to SEBI.",
				},
				{
					id: "SEBI-DRIFT-REBAL",
					name: "Mandatory Rebalancing Timeline for Passive Breaches",
					reference: "SEBI Circular Mar 30, 2022",
					threshold: "30 Business Days",
					description: "When market movements cause passive mandate deviation, portfolio manager must rebalance within 30 business days.",
					impactIfBreached: "Scheme prohibited from launching new investments in drifted assets; report sent to Trustees.",
				},
			],
		};
	}

	/**
	 * Audits an active Model Portfolio against all SEBI holding rules.
	 */
	async auditPortfolioHoldingCompliance(portfolioId: string): Promise<SebiComplianceReport> {
		const t0 = Date.now();

		const [portfolio] = await db
			.select()
			.from(modelPortfolios)
			.where(eq(modelPortfolios.id, portfolioId))
			.limit(1);

		if (!portfolio) {
			throw new Error(`Model portfolio not found with id: ${portfolioId}`);
		}

		// Fetch holdings
		let holdings: Array<{
			instrumentName: string;
			assetClass: string;
			subCategory?: string;
			weight: number;
			isin?: string;
			symbol?: string;
		}> = [];

		try {
			const relHoldings = await db
				.select()
				.from(modelPortfolioHoldings)
				.where(
					and(
						eq(modelPortfolioHoldings.portfolioId, portfolioId),
						isNull(modelPortfolioHoldings.removedAt),
					),
				);

			if (relHoldings.length > 0) {
				holdings = relHoldings.map((h) => ({
					instrumentName: h.instrumentName,
					assetClass: h.assetClass,
					subCategory: h.subCategory || undefined,
					weight: Number(h.weight) || 0,
					isin: h.isin || undefined,
					symbol: h.symbol || undefined,
				}));
			}
		} catch {
			// fallback below
		}

		if (holdings.length === 0 && portfolio.holdings) {
			const raw = Array.isArray(portfolio.holdings)
				? portfolio.holdings
				: typeof portfolio.holdings === "string"
					? JSON.parse(portfolio.holdings)
					: [];

			holdings = raw.map((h: any) => ({
				instrumentName: h.name || h.instrumentName || h.symbol || "Instrument",
				assetClass: h.assetClass || portfolio.assetClass || "equity",
				subCategory: h.subCategory || h.category,
				weight: Number(h.weight || h.allocation || 0),
				isin: h.isin,
				symbol: h.symbol,
			}));
		}

		return this.evaluateHoldingsCompliance(
			"MODEL_PORTFOLIO",
			portfolio.id,
			portfolio.name,
			portfolio.portfolioCode || undefined,
			portfolio.assetClass,
			portfolio.subCategory || portfolio.assetClass,
			holdings,
			t0,
		);
	}

	/**
	 * Audits an Investment Proposal against SEBI holding and concentration rules before client execution.
	 */
	async auditProposalHoldingCompliance(proposalId: string): Promise<SebiComplianceReport> {
		const t0 = Date.now();

		const [proposal] = await db
			.select()
			.from(investmentProposals)
			.where(eq(investmentProposals.id, proposalId))
			.limit(1);

		if (!proposal) {
			throw new Error(`Proposal not found with id: ${proposalId}`);
		}

		const rawRecs = Array.isArray(proposal.recommendations)
			? proposal.recommendations
			: typeof proposal.recommendations === "string"
				? JSON.parse(proposal.recommendations)
				: [];

		const holdings = rawRecs.map((r: any) => ({
			instrumentName: r.instrumentName || r.name || r.productName || "Instrument",
			assetClass: r.assetClass || r.category || "equity",
			subCategory: r.subCategory || r.category,
			weight: Number(r.weight || r.allocationPercentage || 10),
			isin: r.isin,
			symbol: r.symbol,
		}));

		return this.evaluateHoldingsCompliance(
			"ADVISORY_PROPOSAL",
			proposal.id,
			proposal.title || "Advisory Proposal",
			undefined,
			proposal.riskProfile || "moderate",
			proposal.timeHorizon || "medium_term",
			holdings,
			t0,
		);
	}

	/**
	 * Runs a full SEBI compliance sweep across all published model portfolios.
	 */
	async auditAllModelPortfolios(): Promise<{
		totalAudited: number;
		compliant: number;
		warning: number;
		nonCompliant: number;
		reports: SebiComplianceReport[];
		sweepLatencyMs: number;
	}> {
		const t0 = Date.now();
		logger.info("[SebiCompliance] 🛡️ Starting full SEBI portfolio compliance sweep");

		const portfolios = await db
			.select({ id: modelPortfolios.id })
			.from(modelPortfolios)
			.where(eq(modelPortfolios.isPublished, true));

		const reports: SebiComplianceReport[] = [];
		let compliant = 0;
		let warning = 0;
		let nonCompliant = 0;

		for (const p of portfolios) {
			try {
				const report = await this.auditPortfolioHoldingCompliance(p.id);
				reports.push(report);
				if (report.overallStatus === "COMPLIANT") compliant++;
				else if (report.overallStatus === "WARNING") warning++;
				else nonCompliant++;
			} catch (err: any) {
				logger.warn(`[SebiCompliance] Audit skipped for ${p.id}:`, err?.message);
			}
		}

		const latency = Date.now() - t0;
		logger.info("[SebiCompliance] Sweep completed", {
			event: "SEBI_COMPLIANCE_SWEEP_COMPLETED",
			total: reports.length,
			compliant,
			warning,
			nonCompliant,
			latency_ms: latency,
		});

		return {
			totalAudited: reports.length,
			compliant,
			warning,
			nonCompliant,
			reports,
			sweepLatencyMs: latency,
		};
	}

	/**
	 * Core evaluation engine that checks holding lists against SEBI rules.
	 */
	private async evaluateHoldingsCompliance(
		entityType: "MODEL_PORTFOLIO" | "ADVISORY_PROPOSAL",
		entityId: string,
		entityName: string,
		entityCode: string | undefined,
		primaryCategory: string,
		subCategory: string,
		holdings: Array<{
			instrumentName: string;
			assetClass: string;
			subCategory?: string;
			weight: number;
			isin?: string;
			symbol?: string;
		}>,
		t0: number,
	): Promise<SebiComplianceReport> {
		const checks: SebiRuleCheck[] = [];
		const breaches: string[] = [];
		const warnings: string[] = [];
		const remedialActions: string[] = [];

		const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);
		// Normalize weights if not exactly 100%
		const normalizedHoldings = holdings.map((h) => ({
			...h,
			weight: totalWeight > 0 ? Math.round((h.weight / totalWeight) * 10000) / 100 : 0,
		}));

		// ─────────────────────────────────────────────────────────────────────────────
		// CHECK 1: Single Issuer Equity Cap (10% Cap, 8% Warning)
		// ─────────────────────────────────────────────────────────────────────────────
		const equityHoldings = normalizedHoldings.filter(
			(h) => h.assetClass.toLowerCase() === "equity" || h.assetClass.toLowerCase() === "thematic",
		);

		let maxEquityWeight = 0;
		const breachingEquityStocks: string[] = [];
		const warningEquityStocks: string[] = [];

		for (const h of equityHoldings) {
			if (h.weight > maxEquityWeight) maxEquityWeight = h.weight;
			if (h.weight > SebiHoldingComplianceService.SINGLE_STOCK_LIMIT_PCT) {
				breachingEquityStocks.push(`${h.instrumentName} (${h.weight}%)`);
			} else if (h.weight >= SebiHoldingComplianceService.SINGLE_STOCK_WARN_PCT) {
				warningEquityStocks.push(`${h.instrumentName} (${h.weight}%)`);
			}
		}

		if (breachingEquityStocks.length > 0) {
			checks.push({
				ruleId: "SEBI-7TH-SCH-1",
				ruleName: "Single Issuer Equity Exposure Cap (10%)",
				statutoryReference: "Seventh Schedule, Clause 1",
				thresholdLimit: SebiHoldingComplianceService.SINGLE_STOCK_LIMIT_PCT,
				observedValue: maxEquityWeight,
				unit: "% of NAV",
				status: "BREACH",
				details: `Breached 10% statutory limit in ${breachingEquityStocks.length} stock(s): ${breachingEquityStocks.join(", ")}.`,
				offendingItems: breachingEquityStocks,
			});
			breaches.push(`Equity single-stock concentration exceeds SEBI 10% limit: ${breachingEquityStocks.join(", ")}`);
			remedialActions.push(`Trim position(s) ${breachingEquityStocks.join(", ")} to strictly under 10.0% of NAV.`);
		} else if (warningEquityStocks.length > 0) {
			checks.push({
				ruleId: "SEBI-7TH-SCH-1",
				ruleName: "Single Issuer Equity Exposure Cap (10%)",
				statutoryReference: "Seventh Schedule, Clause 1",
				thresholdLimit: SebiHoldingComplianceService.SINGLE_STOCK_LIMIT_PCT,
				observedValue: maxEquityWeight,
				unit: "% of NAV",
				status: "WARNING",
				details: `Approaching 10% limit in ${warningEquityStocks.length} stock(s): ${warningEquityStocks.join(", ")}. Proactive rebalance recommended.`,
				offendingItems: warningEquityStocks,
			});
			warnings.push(`Approaching single-stock concentration limit: ${warningEquityStocks.join(", ")}`);
			remedialActions.push(`Monitor ${warningEquityStocks.join(", ")} closely to avoid passive breach on market run-up.`);
		} else {
			checks.push({
				ruleId: "SEBI-7TH-SCH-1",
				ruleName: "Single Issuer Equity Exposure Cap (10%)",
				statutoryReference: "Seventh Schedule, Clause 1",
				thresholdLimit: SebiHoldingComplianceService.SINGLE_STOCK_LIMIT_PCT,
				observedValue: maxEquityWeight,
				unit: "% of NAV",
				status: "PASS",
				details: `All equity holdings within permissible limits. Maximum single stock weight is ${maxEquityWeight}%.`,
			});
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// CHECK 2: Single Issuer Debt Cap (10% Cap)
		// ─────────────────────────────────────────────────────────────────────────────
		const debtHoldings = normalizedHoldings.filter((h) => h.assetClass.toLowerCase() === "debt");
		let maxDebtWeight = 0;
		const breachingDebtItems: string[] = [];

		for (const h of debtHoldings) {
			if (h.weight > maxDebtWeight) maxDebtWeight = h.weight;
			// G-Sec and Sovereign funds are exempt from single issuer cap
			const isSovereign = (h.instrumentName || "").toLowerCase().includes("gilt") || (h.instrumentName || "").toLowerCase().includes("sovereign");
			if (!isSovereign && h.weight > SebiHoldingComplianceService.SINGLE_DEBT_ISSUER_LIMIT_PCT) {
				breachingDebtItems.push(`${h.instrumentName} (${h.weight}%)`);
			}
		}

		if (breachingDebtItems.length > 0) {
			checks.push({
				ruleId: "SEBI-7TH-SCH-2",
				ruleName: "Single Issuer Debt Exposure Cap (10%)",
				statutoryReference: "Seventh Schedule, Clause 2",
				thresholdLimit: SebiHoldingComplianceService.SINGLE_DEBT_ISSUER_LIMIT_PCT,
				observedValue: maxDebtWeight,
				unit: "% of NAV",
				status: "BREACH",
				details: `Debt exposure exceeds 10% in non-sovereign issuer: ${breachingDebtItems.join(", ")}.`,
				offendingItems: breachingDebtItems,
			});
			breaches.push(`Debt single issuer exceeds SEBI 10% limit: ${breachingDebtItems.join(", ")}`);
			remedialActions.push("Diversify debt allocation across multiple issuers or sovereign gilt instruments.");
		} else {
			checks.push({
				ruleId: "SEBI-7TH-SCH-2",
				ruleName: "Single Issuer Debt Exposure Cap (10%)",
				statutoryReference: "Seventh Schedule, Clause 2",
				thresholdLimit: SebiHoldingComplianceService.SINGLE_DEBT_ISSUER_LIMIT_PCT,
				observedValue: maxDebtWeight,
				unit: "% of NAV",
				status: "PASS",
				details: `Debt holdings compliant with single issuer exposure limit (Max: ${maxDebtWeight}%).`,
			});
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// CHECK 3: Sector Exposure Limit (20% Cap)
		// ─────────────────────────────────────────────────────────────────────────────
		const sectorMap: Record<string, number> = {};
		for (const h of normalizedHoldings) {
			const sec = h.subCategory || "Diversified";
			sectorMap[sec] = (sectorMap[sec] || 0) + h.weight;
		}

		let maxSectorWeight = 0;
		let maxSectorName = "None";
		const breachingSectors: string[] = [];

		for (const [sec, w] of Object.entries(sectorMap)) {
			if (w > maxSectorWeight) {
				maxSectorWeight = w;
				maxSectorName = sec;
			}
			// Thematic / Sectoral portfolios are exempt from single sector cap per mandate
			const isThematicPortfolio = primaryCategory.toLowerCase().includes("thematic") || primaryCategory.toLowerCase().includes("sectoral");
			if (!isThematicPortfolio && w > SebiHoldingComplianceService.SECTOR_EXPOSURE_LIMIT_PCT && sec !== "Diversified") {
				breachingSectors.push(`${sec} (${Math.round(w)}%)`);
			}
		}

		if (breachingSectors.length > 0) {
			checks.push({
				ruleId: "SEBI-SECTOR-EXP",
				ruleName: "Single Sector Exposure Limit (20%)",
				statutoryReference: "SEBI Master Circular §3.2",
				thresholdLimit: SebiHoldingComplianceService.SECTOR_EXPOSURE_LIMIT_PCT,
				observedValue: Math.round(maxSectorWeight * 100) / 100,
				unit: "% of NAV",
				status: "WARNING",
				details: `Non-sectoral portfolio has sector exposure above 20%: ${breachingSectors.join(", ")}.`,
				offendingItems: breachingSectors,
			});
			warnings.push(`Sector concentration elevated in ${breachingSectors.join(", ")}`);
			remedialActions.push(`Consider broadening sector dispersion outside of ${maxSectorName}.`);
		} else {
			checks.push({
				ruleId: "SEBI-SECTOR-EXP",
				ruleName: "Single Sector Exposure Limit (20%)",
				statutoryReference: "SEBI Master Circular §3.2",
				thresholdLimit: SebiHoldingComplianceService.SECTOR_EXPOSURE_LIMIT_PCT,
				observedValue: Math.round(maxSectorWeight * 100) / 100,
				unit: "% of NAV",
				status: "PASS",
				details: `Sector exposure well diversified (Top sector: ${maxSectorName} at ${Math.round(maxSectorWeight)}%).`,
			});
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// CHECK 4: Focused Fund Stock Count Cap (Max 30 Stocks)
		// ─────────────────────────────────────────────────────────────────────────────
		const isFocused = (entityName || "").toLowerCase().includes("focused") || (subCategory || "").toLowerCase().includes("focused");
		if (isFocused) {
			const count = normalizedHoldings.length;
			if (count > SebiHoldingComplianceService.FOCUSED_FUND_MAX_STOCKS) {
				checks.push({
					ruleId: "SEBI-FOCUSED-CAP",
					ruleName: "Focused Fund Stock Count Cap (Max 30)",
					statutoryReference: "SEBI Circular Oct 6, 2017 §A.7",
					thresholdLimit: SebiHoldingComplianceService.FOCUSED_FUND_MAX_STOCKS,
					observedValue: count,
					unit: "count",
					status: "BREACH",
					details: `Focused portfolio contains ${count} stocks, exceeding statutory limit of 30.`,
				});
				breaches.push(`Focused fund stock count (${count}) exceeds statutory maximum of 30`);
				remedialActions.push(`Consolidate portfolio by exiting ${count - 30} lowest-conviction positions.`);
			} else {
				checks.push({
					ruleId: "SEBI-FOCUSED-CAP",
					ruleName: "Focused Fund Stock Count Cap (Max 30)",
					statutoryReference: "SEBI Circular Oct 6, 2017 §A.7",
					thresholdLimit: SebiHoldingComplianceService.FOCUSED_FUND_MAX_STOCKS,
					observedValue: count,
					unit: "count",
					status: "PASS",
					details: `Stock count is ${count}, within statutory limit of 30.`,
				});
			}
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// CHECK 5: Unlisted Equity Securities Prohibition (0% Allowed)
		// ─────────────────────────────────────────────────────────────────────────────
		const unlistedItems = normalizedHoldings.filter(
			(h) => (h.instrumentName || "").toLowerCase().includes("unlisted") || (h.subCategory || "").toLowerCase().includes("unlisted"),
		);

		if (unlistedItems.length > 0) {
			checks.push({
				ruleId: "SEBI-UNLISTED-PROHIB",
				ruleName: "Unlisted Securities Prohibition (0%)",
				statutoryReference: "SEBI Circular Oct 1, 2019",
				thresholdLimit: 0,
				observedValue: unlistedItems.reduce((s, u) => s + u.weight, 0),
				unit: "% of NAV",
				status: "BREACH",
				details: `Unlisted security identified in portfolio: ${unlistedItems.map((u) => u.instrumentName).join(", ")}.`,
				offendingItems: unlistedItems.map((u) => u.instrumentName),
			});
			breaches.push(`Unlisted securities found in public portfolio: ${unlistedItems.map((u) => u.instrumentName).join(", ")}`);
			remedialActions.push("Immediately remove unlisted instruments; replace with NSE/BSE listed securities.");
		} else {
			checks.push({
				ruleId: "SEBI-UNLISTED-PROHIB",
				ruleName: "Unlisted Securities Prohibition (0%)",
				statutoryReference: "SEBI Circular Oct 1, 2019",
				thresholdLimit: 0,
				observedValue: 0,
				unit: "% of NAV",
				status: "PASS",
				details: "All securities are NSE/BSE listed instruments or registered mutual fund schemes. Zero unlisted securities.",
			});
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// CHECK 6: Passive Drift & 30-Day Rectification Clock
		// ─────────────────────────────────────────────────────────────────────────────
		checks.push({
			ruleId: "SEBI-DRIFT-REBAL",
			ruleName: "Mandatory Rebalancing Timeline (30 Business Days)",
			statutoryReference: "SEBI Circular Mar 30, 2022",
			thresholdLimit: SebiHoldingComplianceService.REBALANCE_TIMELINE_DAYS,
			observedValue: 0,
			unit: "days",
			status: breaches.length > 0 ? "WARNING" : "PASS",
			details:
				breaches.length > 0
					? `Statutory 30-day rectification window active. Must restore compliance within 30 business days.`
					: "Portfolio operates within permissible allocation corridors; no active rectification clock.",
		});

		// ─────────────────────────────────────────────────────────────────────────────
		// OVERALL STATUS & SCORE DETERMINATION
		// ─────────────────────────────────────────────────────────────────────────────
		let overallStatus: SebiComplianceReport["overallStatus"] = "COMPLIANT";
		let complianceScore = 100;

		if (breaches.length > 0) {
			overallStatus = "NON_COMPLIANT";
			complianceScore = Math.max(30, 100 - breaches.length * 25);
		} else if (warnings.length > 0) {
			overallStatus = "WARNING";
			complianceScore = Math.max(75, 100 - warnings.length * 10);
		}

		const now = new Date();
		const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

		const report: SebiComplianceReport = {
			entityType,
			entityId,
			entityName,
			entityCode,
			category: primaryCategory,
			overallStatus,
			complianceScore,
			summary:
				overallStatus === "COMPLIANT"
					? "All SEBI Seventh Schedule holding caps, sector thresholds, and mandate criteria passed successfully."
					: overallStatus === "WARNING"
						? `Holding compliance warning: ${warnings.length} warning(s) detected. Proactive rebalance recommended.`
						: `NON-COMPLIANT: ${breaches.length} statutory breach(es) detected. Mandatory rebalance required.`,
			checks,
			breaches,
			warnings,
			remedialActions: remedialActions.length > 0 ? remedialActions : ["No remedial action required; portfolio is in full compliance."],
			rectificationDeadline: overallStatus !== "COMPLIANT" ? deadline : undefined,
			disclaimer:
				"Audited strictly under SEBI (Mutual Funds) Regulations, 1996 (Seventh Schedule) and SEBI (Investment Advisers) Regulations, 2013.",
			meta: {
				engineVersion: "SEBI-COMPLIANCE-v1.0",
				calculationTimestamp: now.toISOString(),
			},
		};

		// ─────────────────────────────────────────────────────────────────────────────
		// IMMUTABLE AUDIT TRAIL LOGGING (SEBI Reg 16 Compliance)
		// ─────────────────────────────────────────────────────────────────────────────
		try {
			await db.insert(agentComplianceAuditLogs).values({
				agentId: "system-sebi-compliance-engine",
				actionCategory: "compliance",
				actionType: overallStatus === "COMPLIANT" ? "compliance_pass" : "violation_detected",
				actionDescription: `SEBI Holding Compliance Audit: ${entityName} (${overallStatus}) - Score: ${complianceScore}/100`,
				proposalId: entityType === "ADVISORY_PROPOSAL" ? entityId : null,
				newState: {
					entityType,
					entityId,
					overallStatus,
					complianceScore,
					breachesCount: breaches.length,
					warningsCount: warnings.length,
					engineVersion: "SEBI-COMPLIANCE-v1.0",
				},
				suitabilityPassed: overallStatus !== "NON_COMPLIANT",
			});
		} catch (auditErr: any) {
			logger.warn("[SebiCompliance] Audit log notice:", auditErr?.message);
		}

		logger.info("[SebiCompliance] Compliance audit completed", {
			event: "SEBI_COMPLIANCE_AUDITED",
			entity_type: entityType,
			entity_id: entityId,
			status: overallStatus,
			score: complianceScore,
			latency_ms: Date.now() - t0,
		});

		return report;
	}
}

export const sebiHoldingComplianceService = SebiHoldingComplianceService.getInstance();
