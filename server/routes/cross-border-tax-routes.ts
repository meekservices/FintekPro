/**
 * Cross-Border Indo-US Tax & Regulatory API Routes
 * 
 * Provides REST endpoints for Chartered Accountants, CPAs, and Advisors:
 * - POST /api/cross-border/residency-assessment : Indian Section 6 vs US IRC § 7701(b) + DTAA Tie-Breaker
 * - POST /api/cross-border/fbar-fatca-scanner   : Foreign accounts aggregation, FBAR ($10k) & FATCA thresholds
 * - POST /api/cross-border/pfic-analysis       : Indian Mutual Funds held by US Persons (IRC §§ 1291-1298)
 * - POST /api/cross-border/ftc-bridge          : US Form 1116 Sec 904 limitation vs Indian Form 67 Sec 90
 * - POST /api/cross-border/validate-preparer   : IRS PTIN & Circular 230 Practice Role Validation
 * - POST /api/cross-border/us-filing-package   : Form 1040 draft, Line-by-Line Guide & Paid Preparer Signature Block
 * - POST /api/cross-border/bilateral-audit-pack: ICAI UDIN + US PTIN Dual Verification Pack with SHA-256 Seal
 * 
 * Strict layered architecture: Controller delegates to CrossBorderTaxService.
 * Compliant with FintekPro GCR v1.0 & FASP-AI v1.0.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../logger";
import { crossBorderTaxService } from "../services/cross-border-tax-service";

const router = Router();

// ==================== ZOD SCHEMAS ====================

const residencySchema = z.object({
	taxYear: z.number().int().min(2020).max(2035).default(2025),
	daysInIndiaCurrentFY: z.number().int().min(0).max(366),
	daysInIndiaPreceding4Years: z.number().int().min(0).max(1464),
	isIndianCitizenOrPIO: z.boolean().default(true),
	indianSourceIncomeInr: z.number().min(0).default(0),
	isLiableToTaxInOtherCountry: z.boolean().default(true),
	isUsCitizen: z.boolean().default(false),
	isUsGreenCardHolder: z.boolean().default(false),
	daysInUsCurrentYear: z.number().int().min(0).max(366).default(0),
	daysInUsYearMinus1: z.number().int().min(0).max(366).default(0),
	daysInUsYearMinus2: z.number().int().min(0).max(366).default(0),
	isF1OrJ1ExemptStudent: z.boolean().optional().default(false),
});

const fbarFatcaSchema = z.object({
	calendarYear: z.number().int().min(2020).max(2035).default(2024),
	filingStatus: z.enum([
		"SINGLE_DOMESTIC",
		"MFJ_DOMESTIC",
		"MFS_DOMESTIC",
		"SINGLE_EXPAT",
		"MFJ_EXPAT",
	]).default("SINGLE_DOMESTIC"),
	exchangeRateInrPerUsd: z.number().positive().default(86.50),
	accounts: z.array(
		z.object({
			institutionName: z.string().min(1),
			accountType: z.enum([
				"NRE_SAVINGS",
				"NRO_SAVINGS",
				"FCNR_DEPOSIT",
				"INDIAN_DEMAT",
				"INDIAN_MUTUAL_FUND",
				"US_BROKERAGE_EQUITY",
				"OTHER",
			]),
			accountNumberMasked: z.string().min(1),
			currency: z.enum(["INR", "USD"]),
			peakBalanceOriginalCurrency: z.number().min(0),
			yearEndBalanceOriginalCurrency: z.number().min(0),
		})
	),
});

const pficSchema = z.object({
	calendarYear: z.number().int().min(2020).max(2035).default(2024),
	isUsTaxPerson: z.boolean().default(true),
	exchangeRateInrPerUsd: z.number().positive().default(86.50),
	fundHoldings: z.array(
		z.object({
			fundName: z.string().min(1),
			fundCategory: z.enum(["EQUITY_MF", "DEBT_MF", "HYBRID_MF", "LIQUID_MF", "REIT_INVIT"]),
			acquisitionDate: z.string(),
			unitsHeld: z.number().positive(),
			totalCostInr: z.number().min(0),
			currentFmvInr: z.number().min(0),
			unrealizedGainInr: z.number(),
			distributionsReceivedInr: z.number().min(0).default(0),
		})
	),
});

const ftcSchema = z.object({
	taxYear: z.number().int().min(2020).max(2035).default(2024),
	foreignPassiveIncomeUsd: z.number().min(0),
	totalTaxableIncomeUsd: z.number().positive(),
	usTaxBeforeCreditsUsd: z.number().min(0),
	foreignTaxesPaidInr: z.number().min(0),
	exchangeRateInrPerUsd: z.number().positive().default(86.50),
	dtaaArticle: z.string().optional().default("Article 25"),
});

const preparerSchema = z.object({
	role: z.enum([
		"US_CPA",
		"ENROLLED_AGENT",
		"ANNUAL_FILING_SEASON_PROGRAM",
		"UNENROLLED_PREPARER_PTIN",
		"SELF_PREPARED",
	]),
	preparerName: z.string().optional(),
	ptin: z.string().optional(),
	efin: z.string().optional(),
	firmName: z.string().optional(),
	firmEin: z.string().optional(),
	firmAddress: z.string().optional(),
	preparerPhone: z.string().optional(),
	isSelfEmployed: z.boolean().optional(),
	cpaStateLicense: z.string().optional(),
	cpaStateJurisdiction: z.string().optional(),
	enrolledAgentNumber: z.string().optional(),
});

const usFilingPackageSchema = z.object({
	taxYear: z.number().int().min(2020).max(2035).default(2024),
	taxpayer: z.object({
		fullName: z.string().min(1),
		maskedSsnOrItin: z.string().min(1),
		filingStatus: z.enum(["SINGLE", "MFJ", "MFS", "HOH"]).default("SINGLE"),
		address: z.string().default("USA"),
	}),
	preparer: preparerSchema.optional(),
	income: z.object({
		w2WagesUsd: z.number().min(0).default(0),
		federalWithholdingUsd: z.number().min(0).default(0),
		taxableInterestUsd: z.number().min(0).default(0),
		ordinaryDividendsUsd: z.number().min(0).default(0),
		qualifiedDividendsUsd: z.number().min(0).optional(),
		shortTermCapitalGainsUsd: z.number().default(0),
		longTermCapitalGainsUsd: z.number().default(0),
	}),
	deductions: z
		.object({
			useItemized: z.boolean().optional(),
			itemizedDeductionsUsd: z.number().min(0).optional(),
		})
		.optional(),
	foreignTaxCredit: z
		.object({
			foreignPassiveIncomeUsd: z.number().min(0),
			foreignTaxesPaidInr: z.number().min(0),
			exchangeRateInrPerUsd: z.number().positive().default(86.50),
		})
		.optional(),
	estimatedTaxPaymentsUsd: z.number().min(0).optional(),
});

const bilateralAuditPackSchema = z.object({
	taxYear: z.number().int().min(2020).max(2035).default(2024),
	clientPanMasked: z.string().min(1),
	clientSsnMasked: z.string().min(1),
	indianCaUdin: z.string().min(1),
	indianCaMembership: z.string().min(1),
	usPreparerPtin: z.string().optional(),
	usPreparerRole: z.enum([
		"US_CPA",
		"ENROLLED_AGENT",
		"ANNUAL_FILING_SEASON_PROGRAM",
		"UNENROLLED_PREPARER_PTIN",
		"SELF_PREPARED",
	]).optional(),
	indianNetTaxInr: z.number().min(0),
	usNetTaxUsd: z.number().min(0),
	dtaaReliefClaimedUsd: z.number().min(0),
	dtaaReliefClaimedInr: z.number().min(0),
	exchangeRateUsed: z.number().positive().default(86.50),
});

// ==================== ROUTE HANDLERS ====================

/**
 * POST /api/cross-border/residency-assessment
 */
router.post("/residency-assessment", (req: Request, res: Response): void => {
	const startTime = Date.now();
	try {
		const parsed = residencySchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_RESIDENCY_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.determineResidency(parsed.data);
		const latencyMs = Date.now() - startTime;

		logger.info("Cross-border residency assessment completed", {
			event: "CROSS_BORDER_RESIDENCY_EVALUATED",
			indianStatus: result.indianResidency.status,
			usStatus: result.usResidency.status,
			latency_ms: latencyMs,
			status: "SUCCESS",
		});

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: result.calculationTimestamp,
				version: result.engineVersion,
				advisory_notice: "FASP-AI v1.0: Decision support only. CA / CPA review required before statutory filing.",
			},
		});
	} catch (error: unknown) {
		const latencyMs = Date.now() - startTime;
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("Error evaluating cross-border residency:", {
			error: err.message,
			latency_ms: latencyMs,
		});

		res.status(500).json({
			success: false,
			error: {
				error_code: "RESIDENCY_EVALUATION_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/cross-border/fbar-fatca-scanner
 */
router.post("/fbar-fatca-scanner", (req: Request, res: Response): void => {
	const startTime = Date.now();
	try {
		const parsed = fbarFatcaSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_FBAR_FATCA_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.scanFbarFatca(parsed.data);
		const latencyMs = Date.now() - startTime;

		logger.info("Cross-border FBAR/FATCA scan completed", {
			event: "FBAR_FATCA_SCANNED",
			fbarRequired: result.fbarFinCen114.isFilingRequired,
			fatcaRequired: result.fatcaForm8938.isFilingRequired,
			latency_ms: latencyMs,
			status: "SUCCESS",
		});

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: result.calculationTimestamp,
				version: result.engineVersion,
				advisory_notice: "FASP-AI v1.0: FinCEN Form 114 and IRS Form 8938 threshold diagnostics for CPA review.",
			},
		});
	} catch (error: unknown) {
		const latencyMs = Date.now() - startTime;
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("Error scanning FBAR/FATCA:", {
			error: err.message,
			latency_ms: latencyMs,
		});

		res.status(500).json({
			success: false,
			error: {
				error_code: "FBAR_FATCA_SCAN_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/cross-border/pfic-analysis
 */
router.post("/pfic-analysis", (req: Request, res: Response): void => {
	const startTime = Date.now();
	try {
		const parsed = pficSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_PFIC_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.assessPficHoldings(parsed.data);
		const latencyMs = Date.now() - startTime;

		logger.info("Cross-border PFIC assessment completed", {
			event: "PFIC_ASSESSMENT_COMPLETED",
			holdingsCount: result.fundAnalyses.length,
			totalPficAssetsUsd: result.totalPficAssetsUsd,
			latency_ms: latencyMs,
			status: "SUCCESS",
		});

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: result.calculationTimestamp,
				version: result.engineVersion,
				advisory_notice: "FASP-AI v1.0: IRS Form 8621 Passive Foreign Investment Company diagnostic engine.",
			},
		});
	} catch (error: unknown) {
		const latencyMs = Date.now() - startTime;
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("Error evaluating PFIC holdings:", {
			error: err.message,
			latency_ms: latencyMs,
		});

		res.status(500).json({
			success: false,
			error: {
				error_code: "PFIC_EVALUATION_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/cross-border/ftc-bridge
 */
router.post("/ftc-bridge", (req: Request, res: Response): void => {
	const startTime = Date.now();
	try {
		const parsed = ftcSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_FTC_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.calculateForeignTaxCredit(parsed.data);
		const latencyMs = Date.now() - startTime;

		logger.info("Cross-border Foreign Tax Credit bridge calculation completed", {
			event: "FTC_BRIDGE_CALCULATED",
			actualFtcClaimableUsd: result.actualFtcClaimableUsd,
			excessForeignTaxesUsd: result.excessForeignTaxesUsd,
			latency_ms: latencyMs,
			status: "SUCCESS",
		});

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: result.calculationTimestamp,
				version: result.engineVersion,
				advisory_notice: "FASP-AI v1.0: Form 1116 / Form 67 Foreign Tax Credit limitation engine.",
			},
		});
	} catch (error: unknown) {
		const latencyMs = Date.now() - startTime;
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("Error calculating Foreign Tax Credit:", {
			error: err.message,
			latency_ms: latencyMs,
		});

		res.status(500).json({
			success: false,
			error: {
				error_code: "FTC_CALCULATION_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/cross-border/validate-preparer
 */
router.post("/validate-preparer", (req: Request, res: Response): void => {
	try {
		const parsed = preparerSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_PREPARER_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.validatePreparerCredentials(parsed.data);
		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "CROSS_BORDER_INDO_US_V1.0",
			},
		});
	} catch (error: unknown) {
		const err = error instanceof Error ? error : new Error(String(error));
		res.status(500).json({
			success: false,
			error: {
				error_code: "PREPARER_VALIDATION_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/cross-border/us-filing-package
 */
router.post("/us-filing-package", (req: Request, res: Response): void => {
	const startTime = Date.now();
	try {
		const parsed = usFilingPackageSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_US_FILING_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.generateUsTaxFilingPackage(parsed.data);
		const latencyMs = Date.now() - startTime;

		logger.info("US Tax Filing Package generated successfully", {
			event: "US_FILING_PACKAGE_GENERATED",
			taxYear: result.taxYear,
			agi: result.computation.adjustedGrossIncome,
			netTax: result.computation.netUsTaxPayable,
			submissionMethod: result.filingInstructions.submissionMethod,
			latency_ms: latencyMs,
			status: "SUCCESS",
		});

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: result.calculationTimestamp,
				version: result.engineVersion,
				advisory_notice: "FASP-AI v1.0: Complete Form 1040 & Schedule D/1116 Tax Filing Package for CA / CPA Review.",
			},
		});
	} catch (error: unknown) {
		const latencyMs = Date.now() - startTime;
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("Error generating US Tax Filing Package:", {
			error: err.message,
			latency_ms: latencyMs,
		});

		res.status(500).json({
			success: false,
			error: {
				error_code: "US_FILING_PACKAGE_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

/**
 * POST /api/cross-border/bilateral-audit-pack
 */
router.post("/bilateral-audit-pack", (req: Request, res: Response): void => {
	try {
		const parsed = bilateralAuditPackSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_BILATERAL_INPUT",
					message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
					retryable: false,
				},
			});
			return;
		}

		const result = crossBorderTaxService.generateBilateralAuditPack(parsed.data);
		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: result.calculationTimestamp,
				version: result.engineVersion,
				advisory_notice: "FASP-AI v1.0: Bilateral CA UDIN + US PTIN cross-border compliance pack.",
			},
		});
	} catch (error: unknown) {
		const err = error instanceof Error ? error : new Error(String(error));
		res.status(500).json({
			success: false,
			error: {
				error_code: "BILATERAL_AUDIT_PACK_ERROR",
				message: err.message,
				retryable: false,
			},
		});
	}
});

export default router;
