import { Router, Request, Response } from "express";
import { FinancialMetricsCalculator } from "../services/financial-metrics-calculator";
import { sipSimulatorEngine } from "../services/sip-simulator-engine";
import { overlapIntelligenceEngine } from "../services/overlap-intelligence-engine";
import { stockIntersectionAnalysisService } from "../services/stock-intersection-analysis-service";
import { aiService } from "../services/ai-service";

const router = Router();

interface EngineTestResult {
	engine: string;
	category: string;
	status: "pass" | "fail" | "warn";
	latencyMs: number;
	details: string;
	sampleOutput?: any;
	error?: string;
}

async function testEngine(
	name: string,
	category: string,
	testFn: () => Promise<any>,
): Promise<EngineTestResult> {
	const start = Date.now();
	try {
		const output = await testFn();
		return {
			engine: name,
			category,
			status: "pass",
			latencyMs: Date.now() - start,
			details: `Engine responded correctly`,
			sampleOutput: output,
		};
	} catch (error: any) {
		return {
			engine: name,
			category,
			status: "fail",
			latencyMs: Date.now() - start,
			details: `Engine error: ${error.message}`,
			error: error.message,
		};
	}
}

router.get("/gemini-deep-audit", async (req: Request, res: Response) => {
	try {
		const engineList = [
			"Financial Metrics Calculator (P/E, P/B, PEG, EV/EBITDA, ROE, ROIC, Debt/Equity)",
			"SIP Simulator Engine (6/12/24 month projections with diversification scoring)",
			"Overlap Intelligence Engine (stock-level overlap, sector concentration, fund crowding)",
			"Stock Intersection Analysis (cross-fund holding analysis with weighted exposure)",
			"What-If Simulator (static & interactive scenarios: bull/bear/base projections)",
			"Capital Gains Calculator (STCG/LTCG with grandfathering, indexation benefits)",
			"Fee Calculator (platform fees, regulatory fees, GST, waivers by investor tier)",
			"Goal Planning Engine (SIP calculation, inflation adjustment, asset allocation)",
			"Investable Surplus Engine (income breakdown, client segmentation, product eligibility)",
			"Risk Suitability Engine (risk profiling, product suitability checks)",
			"Rebalancing Engine (drift detection, tax-optimized rebalancing trades)",
			"Tax Optimization Engine (lot-level FIFO, grandfathering, exit load impact)",
			"Intrinsic Value Calculator (DCF, Graham, Relative Valuation, Book Value)",
			"Return Forecasting Engine (Monte Carlo simulation, confidence intervals)",
			"Profit-Optimized Scoring Engine (deterministic scoring with 8 sub-scores)",
			"Corporate Treasury Engine (SEBI-compliant investment policy management)",
			"FEMA Compliance Service (LRS limits, TCS calculations, Form 15CA/15CB)",
			"Asset Allocation Optimizer (mean-variance optimization with constraints)",
		];

		const response = await aiService.chat(
			[
				{
					role: "system",
					content: `You are a senior financial technology auditor. Analyze the listed calculation engines of the FintekPro platform. For each engine, provide a brief assessment of:
1. Mathematical correctness risks
2. Regulatory compliance considerations (SEBI/RBI/FEMA)
3. Edge cases that could cause failures
4. Data quality dependencies

Reply as a JSON object with this structure:
{
  "overallAssessment": "string",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "engines": [{"name": "string", "riskLevel": "LOW|MEDIUM|HIGH", "mathematicalRisks": "string", "regulatoryNotes": "string", "edgeCases": ["string"], "recommendations": ["string"]}],
  "crossCuttingRisks": ["string"],
  "priorityActions": ["string"]
}`,
				},
				{
					role: "user",
					content: `Audit these calculation engines for a SEBI-registered investment advisory platform (Indian market):\n\n${engineList.map((e, i) => `${i + 1}. ${e}`).join("\n")}`,
				},
			],
			{
				provider: "gemini",
				model: "gemini-2.5-flash",
				temperature: 0.2,
				maxTokens: 8192,
			},
		);

		let parsed: any;
		try {
			const cleanContent = response.content
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			parsed = JSON.parse(cleanContent);
		} catch {
			parsed = { rawResponse: response.content, parseError: true };
		}

		res.json({
			success: true,
			auditType: "gemini-deep-audit",
			model: "gemini-2.5-flash",
			tokensUsed: response.usage?.totalTokens || 0,
			timestamp: new Date().toISOString(),
			audit: parsed,
		});
	} catch (error: any) {
		console.error("[GeminiDeepAudit] Error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// ---------------------------------------------------------------------------
// Engine Upgrade Registry — full catalogue of all FintekPro engines
// ---------------------------------------------------------------------------

export interface EngineRegistryEntry {
	name: string;
	category: string;
	subcategory: string;
	currentImpl: string;
	upgradeStatus: "completed" | "available" | "in_progress" | "not_required";
	upgradeTypes: Array<
		| "python_migration"
		| "formula_fix"
		| "algorithm_upgrade"
		| "architecture"
		| "regulatory"
	>;
	pythonMigrated: boolean;
	currentVersion: string;
	targetVersion?: string;
	upgradeNote: string;
	priority: "critical" | "high" | "medium" | "low";
}

const ENGINE_REGISTRY: EngineRegistryEntry[] = [
	// ── Quant Engines ───────────────────────────────────────────────────────
	{
		name: "MVO Engine",
		category: "Quant",
		subcategory: "Portfolio Optimization",
		currentImpl: "Python scipy SLSQP + Ledoit-Wolf shrinkage",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: true,
		currentVersion: "py-mvo-slsqp-v1",
		upgradeNote:
			"Migrated from TypeScript projected-gradient-descent to scipy SLSQP (proper QP solver). Fixed Sharpe annualisation bug (daily vol was dividing annual return — inflated by √252). Ledoit-Wolf shrinkage added.",
		priority: "critical",
	},
	{
		name: "Black-Litterman Engine",
		category: "Quant",
		subcategory: "Portfolio Optimization",
		currentImpl: "Python numpy (He & Litterman 1999)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: true,
		currentVersion: "py-bl-v1",
		upgradeNote:
			"Fixed daily vs annual covariance scale mismatch (views were suppressed ~250×). Now uses annualised cov matrix. Omega scaling follows He & Litterman (1999) standard.",
		priority: "critical",
	},
	{
		name: "Quant Backtesting Engine",
		category: "Quant",
		subcategory: "Performance Analytics",
		currentImpl: "Python numpy (Sharpe, Sortino, Calmar, MaxDD)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: true,
		currentVersion: "py-backtest-v1",
		upgradeNote:
			"Fixed Sortino denominator: now uses returns below monthly MAR = Rf/12 across ALL N periods, not just negative periods. Fixed default debt/bond monthly returns that were below risk-free rate. Risk-free rate updated to 7.15% (India 10Y G-Sec Mar 2026).",
		priority: "critical",
	},
	{
		name: "Drift Prediction Engine",
		category: "Quant",
		subcategory: "Portfolio Monitoring",
		currentImpl: "Python scipy.stats (linregress + normal CDF breach prob)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-drift-v1",
		upgradeNote:
			"Replaced TypeScript heuristics with scipy.stats linregress for velocity estimation and normal CDF breach probability over 30-day horizon. R² and days-to-breach output added.",
		priority: "high",
	},
	{
		name: "Asset Allocation Optimizer",
		category: "Quant",
		subcategory: "Portfolio Optimization",
		currentImpl: "TypeScript (rule-based allocation)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-scipy-v1",
		upgradeNote:
			"Can reuse the Python MVO/BL infrastructure. Upgrade to scipy.optimize for multi-constraint allocation including factor exposures.",
		priority: "high",
	},
	{
		name: "Quant Orchestrator",
		category: "Quant",
		subcategory: "Orchestration",
		currentImpl: "TypeScript (Python-first with Node.js fallback)",
		upgradeStatus: "completed",
		upgradeTypes: ["architecture"],
		pythonMigrated: false,
		currentVersion: "ts-v2-python-first",
		upgradeNote:
			"Python-first routing added for MVO, BL, and Drift. Falls back transparently to Node.js engines if Python sidecar unavailable.",
		priority: "medium",
	},
	// ── AI Engines ────────────────────────────────────────────────────────
	{
		name: "Unified AI Recommendation Engine",
		category: "AI",
		subcategory: "Recommendation",
		currentImpl: "TypeScript (OpenAI primary, Gemini fallback)",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v3",
		upgradeNote:
			"Orchestration engine. No math-heavy computation. Already uses best-in-class LLMs with fallback.",
		priority: "low",
	},
	{
		name: "AI ML Scoring Engine",
		category: "AI",
		subcategory: "Scoring",
		currentImpl: "TypeScript (rule-based scoring with 8 sub-scores)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-sklearn-v1",
		upgradeNote:
			"Multi-factor scoring model can be upgraded to scikit-learn Random Forest / XGBoost for non-linear factor interactions. Python migration would enable model retraining from DB data.",
		priority: "high",
	},
	{
		name: "AI Regime Detection Engine",
		category: "AI",
		subcategory: "Market Intelligence",
		currentImpl: "TypeScript (threshold-based regime classification)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-hmm-v1",
		upgradeNote:
			"Upgrade to Hidden Markov Model (hmmlearn) or Gaussian Mixture Model for statistically-grounded regime detection. Python statsmodels for Markov switching regression.",
		priority: "high",
	},
	{
		name: "AI Analytics Engine",
		category: "AI",
		subcategory: "Analytics",
		currentImpl: "TypeScript + Gemini AI",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		upgradeNote:
			"Analytics orchestration layer. No computation bottleneck identified.",
		priority: "low",
	},
	{
		name: "AI Backtesting Engine",
		category: "AI",
		subcategory: "Backtesting",
		currentImpl: "TypeScript (scenario-based simulation)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-numpy-v1",
		upgradeNote:
			"Can share the Python quant backtest endpoint. AI overlay adds scenario generation; core metric calculation (Sharpe, Sortino, drawdown) should route through Python.",
		priority: "medium",
	},
	{
		name: "AI Feedback Engine",
		category: "AI",
		subcategory: "Feedback",
		currentImpl: "TypeScript + LLM",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		upgradeNote:
			"Feedback aggregation and AI analysis. No computation bottleneck.",
		priority: "low",
	},
	{
		name: "AI Proposal Engine",
		category: "AI",
		subcategory: "Proposal",
		currentImpl: "TypeScript (4-layer alpha generation + AI)",
		upgradeStatus: "available",
		upgradeTypes: ["formula_fix", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v2",
		upgradeNote:
			"Rate-cycle-aware debt selection upgraded. Alpha engine can be further improved: Sharpe proxy via CRISIL score is an approximation; a full factor model would be more accurate.",
		priority: "medium",
	},
	{
		name: "AI XAI Engine",
		category: "AI",
		subcategory: "Explainability",
		currentImpl: "TypeScript + LLM",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		upgradeNote:
			"Explainability narrative generation via LLM. No math computation bottleneck.",
		priority: "low",
	},
	// ── Financial Calculation Engines ───────────────────────────────────────
	{
		name: "Financial Metrics Calculator",
		category: "Financial",
		subcategory: "Valuation Ratios",
		currentImpl: "TypeScript (40+ derived ratios)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-pandas-v1",
		upgradeNote:
			"P/E, P/B, PEG, EV/EBITDA, ROE, ROIC fixed for negative value edge cases. Full migration to Python pandas would enable batch computation over DB results without N+1 queries.",
		priority: "high",
	},
	{
		name: "Return Forecasting Engine",
		category: "Financial",
		subcategory: "Forecasting",
		currentImpl:
			"Python numpy/scipy — Monte Carlo, stress tests, drawdown, risk-adjusted ratios",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-return-forecast-v1",
		upgradeNote:
			"Migrated to Python: 5000-path Monte Carlo log-normal model with antithetic sampling, 5 stress scenarios (crash/correction/stagflation/bull/rate-hike), drawdown analysis, Sharpe/Sortino/Calmar/Information ratio. Uses actual NAV volatility when navHistory provided. Endpoint: POST /api/python/forecasting/return-forecast.",
		priority: "high",
	},
	{
		name: "SIP Simulator Engine",
		category: "Financial",
		subcategory: "Investment Planning",
		currentImpl:
			"Python numpy — vectorised SIP projections, inflation-adjusted, step-up SIP, XIRR",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration"],
		pythonMigrated: true,
		currentVersion: "py-sip-v1",
		upgradeNote:
			"Migrated to Python: fully vectorised numpy projection (no loops). Supports step-up SIP (annual %), inflation adjustment, existing corpus, benchmark comparison, months-to-goal calculation, XIRR via scipy brentq. Endpoint: POST /api/python/forecasting/sip-simulate.",
		priority: "medium",
	},
	{
		name: "Goal Planning Engine",
		category: "Financial",
		subcategory: "Financial Planning",
		currentImpl: "TypeScript (NPV/SIP mathematics)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-numpy-v1",
		upgradeNote:
			"Inflation-adjusted goal projections can use numpy for vectorised multi-goal, multi-horizon calculations. XIRR endpoint already available in Python sidecar.",
		priority: "medium",
	},
	{
		name: "Investable Surplus Engine",
		category: "Financial",
		subcategory: "Financial Planning",
		currentImpl: "TypeScript (income/expense breakdown)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-pandas-v1",
		upgradeNote:
			"Pandas-based income analysis with cohort segmentation. Enables AMC-level surplus reporting alongside the existing amc-breakdown endpoint.",
		priority: "low",
	},
	{
		name: "Corporate Treasury Engine",
		category: "Financial",
		subcategory: "Treasury Management",
		currentImpl: "TypeScript (yield/duration calculations)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-numpy-v1",
		upgradeNote:
			"Bond YTM, duration, convexity calculations can use scipy.optimize.brentq (same as Python XIRR). Add macaulay/modified duration, DV01 calculations.",
		priority: "medium",
	},
	{
		name: "Fixed Income Status Engine",
		category: "Financial",
		subcategory: "Fixed Income",
		currentImpl: "TypeScript (bond pricing, YTM thresholds)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-scipy-v1",
		upgradeNote:
			"Bond YTM thresholds recalibrated in Pick of Day engine. Full migration to scipy for bond pricing: clean price, accrued interest, YTM solve via brentq.",
		priority: "medium",
	},
	{
		name: "Research Metrics Engine",
		category: "Financial",
		subcategory: "Research",
		currentImpl: "TypeScript (financial ratios from DB)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-pandas-v1",
		upgradeNote:
			"Pandas batch computation of financial ratios eliminates N+1 DB query patterns. Can produce cross-sectional percentile ranks for screener integration.",
		priority: "medium",
	},
	{
		name: "MF Relative Metrics Engine",
		category: "Financial",
		subcategory: "Fund Analytics",
		currentImpl:
			"Python pandas/scipy (alpha, beta, tracking error, info ratio, SIP XIRR via py-mf-analytics-v1)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: true,
		currentVersion: "py-mf-analytics-v1",
		upgradeNote:
			"Migrated to Python: beta via OLS regression vs benchmark (mf_benchmark_map + market_index_nav), CAPM alpha, tracking error, information ratio. Risk-free rate 7.15% (India 10Y G-Sec). SIP XIRR via scipy brentq. Bulk upsert into mutual_fund_metrics.",
		priority: "high",
	},
	// ── Portfolio Engines ───────────────────────────────────────────────────
	{
		name: "Overlap Intelligence Engine",
		category: "Portfolio",
		subcategory: "Portfolio Analysis",
		currentImpl:
			"Python numpy — cosine similarity matrix, look-through exposure, replacement detection",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-overlap-v1",
		upgradeNote:
			"Migrated to Python: numpy cosine similarity for pairwise fund overlap matrix, look-through stock exposure (fund_weight × holding_weight), diversification score (0–100) with penalty model, replacement candidate detection (>50% overlap), candidate fund evaluation (INCLUDE/REVIEW/EXCLUDE). Endpoint: POST /api/python/portfolio/overlap-analysis.",
		priority: "high",
	},
	{
		name: "Rebalancing Engine",
		category: "Portfolio",
		subcategory: "Portfolio Management",
		currentImpl:
			"Python scipy — drift analysis, SLSQP minimum-cost rebalancing, tax-aware trades",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-rebalance-v1",
		upgradeNote:
			"Migrated to Python: scipy.optimize.minimize SLSQP for minimum-cost target allocation with asset class bounds. Drift analysis with urgency levels, STCG/LTCG tax impact per trade (asset-specific holding period thresholds), constraint violation detection. Endpoint: POST /api/python/portfolio/rebalance.",
		priority: "high",
	},
	{
		name: "US Rebalancing Engine",
		category: "Portfolio",
		subcategory: "Portfolio Management",
		currentImpl: "TypeScript (US market rebalancing)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-scipy-v1",
		upgradeNote:
			"Same scipy LP optimization as Indian Rebalancing Engine. Fractional share support and currency hedging overlay can be added.",
		priority: "medium",
	},
	// ── Scoring & Classification ─────────────────────────────────────────────
	{
		name: "Profit-Optimized Scoring Engine",
		category: "Classification",
		subcategory: "Fund Scoring",
		currentImpl: "TypeScript (deterministic 8-factor scoring)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-sklearn-v1",
		upgradeNote:
			"Current rule-based scoring can be supplemented with scikit-learn for data-driven weight calibration. CRISIL score proxy for Sharpe is an approximation; Python rolling-returns endpoint gives accurate Sharpe.",
		priority: "high",
	},
	{
		name: "SEBI Category Engine",
		category: "Classification",
		subcategory: "Regulatory",
		currentImpl: "TypeScript (SEBI Feb 2026 taxonomy)",
		upgradeStatus: "completed",
		upgradeTypes: ["regulatory"],
		pythonMigrated: false,
		currentVersion: "ts-v3",
		upgradeNote:
			"SEBI Feb 26, 2026 Circular Compliance System implemented. True-to-label naming, lifecycle glide path validator, compliance state machine, scheme-to-scheme overlap service.",
		priority: "medium",
	},
	{
		name: "Explainability Engine",
		category: "Classification",
		subcategory: "AI Explainability",
		currentImpl: "TypeScript + LLM (SHAP-inspired narrative)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-shap-v1",
		upgradeNote:
			"True SHAP values for ML model explanations require Python shap library. Current LLM-based narrative is good for UX but not mathematically precise.",
		priority: "medium",
	},
	// ── Risk & Compliance ────────────────────────────────────────────────────
	{
		name: "Risk Suitability Engine",
		category: "Compliance",
		subcategory: "Risk Assessment",
		currentImpl: "TypeScript (SEBI-aligned risk profiling)",
		upgradeStatus: "available",
		upgradeTypes: ["formula_fix", "regulatory"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		upgradeNote:
			"Formula audit needed: risk score thresholds and product-suitability mapping should be reviewed against SEBI IA Regulations 2020 and AMFI best practices.",
		priority: "medium",
	},
	{
		name: "Investment Advisory Compliance Engine",
		category: "Compliance",
		subcategory: "Regulatory",
		currentImpl: "TypeScript (SEBI/RBI compliance checks)",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v2",
		upgradeNote:
			"Compliance rule engine. Logic-based, not math-intensive. No Python migration required.",
		priority: "low",
	},
	{
		name: "Commission Waterfall Engine",
		category: "Compliance",
		subcategory: "Commission",
		currentImpl: "TypeScript (hierarchical partner commission)",
		upgradeStatus: "available",
		upgradeTypes: ["formula_fix"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		upgradeNote:
			"Commission waterfall formula audit needed: rounding behaviour at each tier, GST treatment, TDS threshold logic should be verified against SEBI/AMFI commission disclosure norms.",
		priority: "medium",
	},
	{
		name: "KYC Orchestration Engine",
		category: "Compliance",
		subcategory: "KYC",
		currentImpl: "TypeScript (priority-based provider selection)",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v3",
		upgradeNote:
			"KYC workflow orchestration. Three-layer priority routing with immutable audit trail. No computation bottleneck.",
		priority: "low",
	},
	// ── Proposal & Advisory ──────────────────────────────────────────────────
	{
		name: "Proposal Execution Engine",
		category: "Proposal",
		subcategory: "Proposal Management",
		currentImpl: "TypeScript (strategy-locked advisor-controlled)",
		upgradeStatus: "not_required",
		upgradeTypes: [],
		pythonMigrated: false,
		currentVersion: "ts-v2",
		upgradeNote:
			"Workflow/execution engine. Strategy locking and fair backtesting implemented. No computation bottleneck.",
		priority: "low",
	},
	{
		name: "What-If Simulator Engine",
		category: "Proposal",
		subcategory: "Scenario Analysis",
		currentImpl: "TypeScript (bull/bear/base scenarios)",
		upgradeStatus: "available",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: false,
		currentVersion: "ts-v1",
		targetVersion: "py-numpy-v1",
		upgradeNote:
			"Stochastic scenario generation via numpy random + historical return bootstrapping. Can add parametric VaR / CVaR calculations.",
		priority: "medium",
	},
	// ── Python Analytics Service ─────────────────────────────────────────────
	{
		name: "XIRR Calculator",
		category: "Python Sidecar",
		subcategory: "Return Metrics",
		currentImpl: "Python scipy (brentq root-finding)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration"],
		pythonMigrated: true,
		currentVersion: "py-xirr-v1",
		upgradeNote:
			"XIRR via scipy.optimize.brentq. Supports arbitrary cashflow schedules. Replaces TypeScript bisection method.",
		priority: "high",
	},
	{
		name: "Rolling Returns Calculator",
		category: "Python Sidecar",
		subcategory: "Return Metrics",
		currentImpl:
			"Python pandas (CAGR from mf_nav_history — bug-fixed, extended period support)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: true,
		currentVersion: "py-rolling-v2",
		upgradeNote:
			"v2: Fixed table reference (mf_nav_history, scheme_code). Extended periods: 1W/1M/3M/6M/1Y/3Y/5Y/10Y. Simple returns for sub-1Y, CAGR for ≥1Y. Backward-compatible with isin param.",
		priority: "high",
	},
	{
		name: "MF Historical Analytics Engine",
		category: "Python Sidecar",
		subcategory: "Fund Analytics",
		currentImpl:
			"Python pandas/scipy — 8 endpoints covering full MF analytics lifecycle",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-mf-analytics-v2",
		upgradeNote:
			"8 endpoints: compute-metrics, scheme-analytics (DB-native), monthly-series, bulk-compute-db, cross-sectional-rank (fills category_rank/percentile_rank for 6K+ schemes), risk-from-monthly (VaR/CVaR/semi-deviation/consistency/capture ratios from mf_monthly_returns), sync-change-pct (mutual_funds.change_percent from mf_nav_history), derived-metrics (Treynor/Jensen alpha). SQL syncs: return_1y +2104, return_3y +1727, return_5y +943 in mutual_fund_metrics; benchmark_index_code filled for 5529 funds.",
		priority: "critical",
	},
	{
		name: "Portfolio Summary Engine",
		category: "Python Sidecar",
		subcategory: "Portfolio Analytics",
		currentImpl: "Python pandas (asset allocation, AMC breakdown)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration"],
		pythonMigrated: true,
		currentVersion: "py-summary-v1",
		upgradeNote:
			"Full portfolio summary with pandas: asset allocation, AMC breakdown, gain/loss. Replaces multiple individual API calls.",
		priority: "high",
	},
	{
		name: "Capital Gains (FIFO) Engine",
		category: "Python Sidecar",
		subcategory: "Tax",
		currentImpl: "Python pandas (FIFO lot matching, STCG/LTCG split)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "formula_fix"],
		pythonMigrated: true,
		currentVersion: "py-fifo-v1",
		upgradeNote:
			"FIFO capital gains with Finance Act 2024 LTCG holding period (730 days for equity MF, not 1095). Tax estimate, per-lot detail.",
		priority: "critical",
	},
	{
		name: "Backtest Metrics Engine",
		category: "Python Sidecar",
		subcategory: "Performance Analytics",
		currentImpl: "Python numpy (Sharpe, Sortino, Calmar, MaxDD)",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration"],
		pythonMigrated: true,
		currentVersion: "py-backtest-v1",
		upgradeNote:
			"Correct Sortino (MAR = Rf/12, all periods), Calmar, max drawdown via numpy. Exposed at POST /api/python/quant/backtest.",
		priority: "high",
	},
	{
		name: "Asset Allocation Optimizer",
		category: "Python Sidecar",
		subcategory: "Portfolio Construction",
		currentImpl:
			"Python scipy SLSQP — 10-asset Indian market MPT with SEBI constraints",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-mvo-v2",
		upgradeNote:
			"Full MVO with 10 Indian asset classes (equity/debt/alternatives/gold/RE), 6 risk profiles, segment-specific constraints (retail/HNI/SHNI/BHNI/corporate), efficient frontier (10 points), goal-based risk aversion scaling. POST /api/python/quant/asset-allocation.",
		priority: "critical",
	},
	{
		name: "Financial Metrics Calculator",
		category: "Python Sidecar",
		subcategory: "Fundamental Analysis",
		currentImpl:
			"Python pandas — vectorized batch computation of 40+ financial ratios",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration"],
		pythonMigrated: true,
		currentVersion: "py-metrics-v1",
		upgradeNote:
			"40+ ratios: valuation (PE/PB/PS/PEG/EV-EBITDA/Graham number), profitability (ROE/ROA/ROCE/ROIC/margins), leverage (D/E, interest coverage, net debt), liquidity (current/quick), efficiency (asset/inventory/receivables turnover), cash flow (OCF/FCF), momentum (52W high-low distance). POST /api/python/analytics/batch-metrics.",
		priority: "high",
	},
	{
		name: "Fixed Income Analytics Engine",
		category: "Python Sidecar",
		subcategory: "Fixed Income",
		currentImpl:
			"Python scipy brentq — exact YTM, Macaulay/modified duration, DV01, convexity",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-bond-v1",
		upgradeNote:
			"Exact YTM via brentq bisection, Macaulay/modified duration, DV01, convexity, clean/dirty price, accrued interest, spread over G-Sec. Batch analytics + par yield curve builder (linear interpolation at standard tenors). POST /api/python/fixed-income/bond-analytics, /batch-bond-analytics, /yield-curve.",
		priority: "high",
	},
	{
		name: "Corporate Treasury Optimizer",
		category: "Python Sidecar",
		subcategory: "Fixed Income",
		currentImpl:
			"Python pandas — SEBI-compliant 4-bucket treasury allocation with yield optimization",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration"],
		pythonMigrated: true,
		currentVersion: "py-treasury-v1",
		upgradeNote:
			"4-bucket model (operational/short-term/medium-term/strategic), 14 product types (liquid funds through 10Y G-Secs), after-tax yield computation, emergency reserve, compliance checks (single-product cap, AAA/SOV floor, no-equity, liquidity floor). POST /api/python/fixed-income/treasury-optimize.",
		priority: "high",
	},
	{
		name: "Risk Factor Model",
		category: "Python Sidecar",
		subcategory: "Quantitative Finance",
		currentImpl:
			"Python scipy OLS — Fama-French 3-Factor + Carhart 4-Factor regression",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-factor-v1",
		upgradeNote:
			"CAPM / FF3 / Carhart 4-factor OLS regression: alpha (daily + annualised), beta per factor (Rm-Rf/SMB/HML/MOM), t-stats, p-values, R², adjusted R², tracking error, information ratio. Proxy factors from market_index_nav (NIFTY50/NIFTYSMALLCAP250/NIFTYMIDCAP150). Single fund + batch. POST /api/python/factor/fund-factors, /batch-fund-factors.",
		priority: "high",
	},
	{
		name: "AI ML Scoring Engine",
		category: "Python Sidecar",
		subcategory: "AI/ML",
		currentImpl:
			"Python scikit-learn GradientBoostingRegressor — per asset-class scoring with SHAP-style attribution",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-sklearn-v1",
		upgradeNote:
			"Replaces TypeScript decision stump ensemble with sklearn GBR (n_estimators=200, max_depth=4, subsample=0.8). Trains on completed daily_picks from DB, k-fold CV, feature ablation contributions, regime confidence modifier. 1-hour in-memory cache. POST /api/python/ml/train, /score, /cross-validate.",
		priority: "high",
	},
	{
		name: "AI Regime Detection Engine",
		category: "Python Sidecar",
		subcategory: "AI/ML",
		currentImpl:
			"Python scipy + sklearn GMM — enhanced 6-signal regime detection with Gaussian mixture overlay",
		upgradeStatus: "completed",
		upgradeTypes: ["python_migration", "algorithm_upgrade"],
		pythonMigrated: true,
		currentVersion: "py-regime-v2",
		upgradeNote:
			"6-signal weighted scoring (vol clustering 25%, trend strength 25%, momentum 20%, moving averages 15%, VIX proxy 10%, market breadth 5%) + sklearn GaussianMixture overlay on (vol, momentum) feature space. DB-native Nifty price fetch (market_index_nav → ai_price_history fallback). Persists to ai_regime_history. POST /api/python/regime/detect, /detect-batch; GET /api/python/regime/history.",
		priority: "critical",
	},
];

router.get("/registry", async (_req: Request, res: Response) => {
	const total = ENGINE_REGISTRY.length;
	const completed = ENGINE_REGISTRY.filter(
		(e) => e.upgradeStatus === "completed",
	).length;
	const available = ENGINE_REGISTRY.filter(
		(e) => e.upgradeStatus === "available",
	).length;
	const inProgress = ENGINE_REGISTRY.filter(
		(e) => e.upgradeStatus === "in_progress",
	).length;
	const notRequired = ENGINE_REGISTRY.filter(
		(e) => e.upgradeStatus === "not_required",
	).length;
	const pythonMigrated = ENGINE_REGISTRY.filter((e) => e.pythonMigrated).length;

	const byCategory: Record<string, number> = {};
	for (const e of ENGINE_REGISTRY) {
		byCategory[e.category] = (byCategory[e.category] || 0) + 1;
	}

	res.json({
		success: true,
		summary: {
			total,
			completed,
			available,
			inProgress,
			notRequired,
			pythonMigrated,
			upgradeCompletionPct: Math.round(
				(completed / (total - notRequired)) * 100,
			),
		},
		byCategory,
		engines: ENGINE_REGISTRY,
		generatedAt: new Date().toISOString(),
	});
});

export default router;
