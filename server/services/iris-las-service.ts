// @ts-nocheck
/**
 * IRIS LAS/LAMF Service — Loan Against Securities & Mutual Funds
 *
 * Business logic layer for the full pledge-and-lend lifecycle powered by
 * the IRIS KFintech API. Orchestrates:
 *   1. Eligibility check (MF folios / demat securities)
 *   2. Pledge initiation and status tracking
 *   3. Loan application and disbursement monitoring
 *   4. Repayment processing
 *   5. Pledge release on loan closure
 *
 * All actions are persisted to irisLasPledges + irisLasLoans tables.
 * Follows FintekPro GCR: structured logs, retry on transient failures,
 * engine_version and calculation_timestamp on every output.
 *
 * @module iris-las-service
 */

import { db } from "../db";
import { irisLasPledges, irisLasLoans, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { irisKfintechService } from "./iris-kfintech-service";
import { logger } from "../logger";

const ENGINE_VERSION = "iris-las-v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LasEligibilityResult {
	success: boolean;
	pan: string;
	eligibleFolios?: Array<{
		folioNo: string;
		schemeCode: string;
		schemeName: string;
		units: number;
		currentNav: number;
		marketValue: number;
		pledgeableValue: number;
		ltvRatio: number;
		maxLoanAmount: number;
	}>;
	eligibleSecurities?: Array<{
		isin: string;
		symbol: string;
		companyName: string;
		quantity: number;
		currentPrice: number;
		marketValue: number;
		pledgeableValue: number;
		ltvRatio: number;
		maxLoanAmount: number;
	}>;
	totalPledgeableValue: number;
	totalMaxLoanAmount: number;
	engine_version: string;
	calculation_timestamp: string;
	warning?: string;
}

export interface PledgeInitiationResult {
	success: boolean;
	localPledgeId: string;
	irisPledgeId?: string;
	pledgeStatus: string;
	message?: string;
	engine_version: string;
	calculation_timestamp: string;
}

export interface LoanApplicationResult {
	success: boolean;
	localLoanId: string;
	irisLoanId?: string;
	loanStatus: string;
	sanctionedAmount?: number;
	interestRate?: number;
	message?: string;
	disclaimer: string;
	engine_version: string;
	calculation_timestamp: string;
}

// ─── Retry helper (GCR: max 3 retries, exponential backoff) ──────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	let lastErr: any;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (err: any) {
			lastErr = err;
			const isTransient =
				!err?.response?.status || err?.response?.status >= 500;
			if (!isTransient || attempt === maxRetries) throw err;
			const delay = 2 ** attempt * 300;
			await new Promise((r) => setTimeout(r, delay));
			logger.warn("[IrisLAS] Retrying after transient error", {
				attempt,
				error: err?.message,
			});
		}
	}
	throw lastErr;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class IrisLasService {
	/**
	 * Check which MF folios in an investor's portfolio are eligible for LAS pledge.
	 *
	 * Purpose: Lets the agent/investor see exactly how much they can borrow against
	 *          their mutual fund holdings before committing to a pledge.
	 *
	 * Inputs: pan (required), folioNos (optional — restrict to specific folios)
	 * Outputs: LasEligibilityResult with per-folio breakdown and total loan capacity
	 * Edge cases:
	 *   - If IRIS is unconfigured, returns structured error (no throw)
	 *   - Folios in lock-in (ELSS etc.) are excluded automatically by IRIS
	 */
	async checkMfEligibility(
		pan: string,
		folioNos?: string[],
	): Promise<LasEligibilityResult> {
		const ts = new Date().toISOString();
		logger.info("[IrisLAS] Checking MF folio eligibility", {
			event: "IRIS_LAS_MF_ELIGIBILITY_CHECK",
			pan: pan.slice(0, 5) + "*****",
			folioCount: folioNos?.length ?? "all",
		});

		if (!irisKfintechService.isConfigured) {
			return {
				success: false,
				pan,
				totalPledgeableValue: 0,
				totalMaxLoanAmount: 0,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
				warning:
					"IRIS KFintech not configured. Set IRIS_USERNAME and IRIS_PASSWORD.",
			};
		}

		try {
			const data: any = await withRetry(() =>
				irisKfintechService.checkMfFolioEligibility(pan, folioNos),
			);

			const folios: LasEligibilityResult["eligibleFolios"] = (
				data?.eligibleFolios ??
				data?.folios ??
				[]
			).map((f: any) => ({
				folioNo: f.folioNo ?? f.folio_no,
				schemeCode: f.schemeCode ?? f.scheme_code,
				schemeName: f.schemeName ?? f.scheme_name ?? "",
				units: Number(f.units ?? 0),
				currentNav: Number(f.nav ?? f.currentNav ?? 0),
				marketValue: Number(f.marketValue ?? f.market_value ?? 0),
				pledgeableValue: Number(f.pledgeableValue ?? f.pledgeable_value ?? 0),
				ltvRatio: Number(f.ltvRatio ?? f.ltv_ratio ?? 0.6),
				maxLoanAmount: Number(f.maxLoanAmount ?? f.max_loan_amount ?? 0),
			}));

			const totalPledgeableValue = folios.reduce(
				(s, f) => s + f.pledgeableValue,
				0,
			);
			const totalMaxLoanAmount = folios.reduce(
				(s, f) => s + f.maxLoanAmount,
				0,
			);

			logger.info("[IrisLAS] MF eligibility check complete", {
				event: "IRIS_LAS_MF_ELIGIBILITY_DONE",
				pan: pan.slice(0, 5) + "*****",
				eligibleFolios: folios.length,
				totalMaxLoanAmount,
				latency_ms: Date.now() - new Date(ts).getTime(),
				status: "success",
			});

			return {
				success: true,
				pan,
				eligibleFolios: folios,
				totalPledgeableValue,
				totalMaxLoanAmount,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		} catch (err: any) {
			logger.error("[IrisLAS] MF eligibility check failed", {
				event: "IRIS_LAS_MF_ELIGIBILITY_FAILED",
				pan: pan.slice(0, 5) + "*****",
				error: err?.response?.data ?? err?.message,
				status: "error",
			});
			return {
				success: false,
				pan,
				totalPledgeableValue: 0,
				totalMaxLoanAmount: 0,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
				warning:
					err?.response?.data?.message ??
					err?.message ??
					"IRIS eligibility check failed",
			};
		}
	}

	/**
	 * Check demat securities eligible for pledge (LAS against equities/ETFs).
	 *
	 * Purpose: Shows agent/investor how much they can borrow against their
	 *          demat holdings (BSE/NSE listed securities).
	 *
	 * Inputs: pan, dpId (optional)
	 * Outputs: LasEligibilityResult with per-security breakdown
	 */
	async checkSecuritiesEligibility(
		pan: string,
		dpId?: string,
	): Promise<LasEligibilityResult> {
		const ts = new Date().toISOString();
		logger.info("[IrisLAS] Checking securities eligibility", {
			event: "IRIS_LAS_SEC_ELIGIBILITY_CHECK",
			pan: pan.slice(0, 5) + "*****",
		});

		if (!irisKfintechService.isConfigured) {
			return {
				success: false,
				pan,
				totalPledgeableValue: 0,
				totalMaxLoanAmount: 0,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
				warning: "IRIS KFintech not configured.",
			};
		}

		try {
			const data: any = await withRetry(() =>
				irisKfintechService.checkSecuritiesEligibility(pan, dpId),
			);

			const securities: LasEligibilityResult["eligibleSecurities"] = (
				data?.eligibleSecurities ??
				data?.securities ??
				[]
			).map((s: any) => ({
				isin: s.isin,
				symbol: s.symbol ?? s.ticker ?? "",
				companyName: s.companyName ?? s.company_name ?? "",
				quantity: Number(s.quantity ?? 0),
				currentPrice: Number(s.currentPrice ?? s.ltp ?? 0),
				marketValue: Number(s.marketValue ?? s.market_value ?? 0),
				pledgeableValue: Number(s.pledgeableValue ?? s.pledgeable_value ?? 0),
				ltvRatio: Number(s.ltvRatio ?? s.ltv_ratio ?? 0.5),
				maxLoanAmount: Number(s.maxLoanAmount ?? s.max_loan_amount ?? 0),
			}));

			const totalPledgeableValue = securities.reduce(
				(s, x) => s + x.pledgeableValue,
				0,
			);
			const totalMaxLoanAmount = securities.reduce(
				(s, x) => s + x.maxLoanAmount,
				0,
			);

			return {
				success: true,
				pan,
				eligibleSecurities: securities,
				totalPledgeableValue,
				totalMaxLoanAmount,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		} catch (err: any) {
			logger.error("[IrisLAS] Securities eligibility check failed", {
				event: "IRIS_LAS_SEC_ELIGIBILITY_FAILED",
				pan: pan.slice(0, 5) + "*****",
				error: err?.response?.data ?? err?.message,
			});
			return {
				success: false,
				pan,
				totalPledgeableValue: 0,
				totalMaxLoanAmount: 0,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
				warning:
					err?.response?.data?.message ??
					err?.message ??
					"Securities eligibility check failed",
			};
		}
	}

	/**
	 * Initiate pledge of MF folios and persist the pledge record locally.
	 *
	 * Purpose: Starts the pledge process via IRIS. The pledge goes into 'pending'
	 *          state until investor confirms via TPIN/OTP through the lender portal.
	 *
	 * Inputs: userId, pan, folioDetails, loanAmount, agentId (optional)
	 * Outputs: PledgeInitiationResult with localPledgeId and irisPledgeId
	 * Edge cases:
	 *   - If IRIS returns an error, the local DB record is saved with status='failed'
	 *     so the agent can retry without creating duplicate records
	 */
	async initiateMfPledge(opts: {
		userId: string;
		pan: string;
		folioDetails: Array<{ folioNo: string; schemeCode: string; units: number }>;
		loanAmount: number;
		lenderCode?: string;
		agentId?: string;
	}): Promise<PledgeInitiationResult> {
		const ts = new Date().toISOString();
		logger.info("[IrisLAS] Initiating MF pledge", {
			event: "IRIS_LAS_MF_PLEDGE_INITIATE",
			user_id: opts.userId,
			pan: opts.pan.slice(0, 5) + "*****",
			folioCount: opts.folioDetails.length,
			loanAmount: opts.loanAmount,
		});

		// Persist initial record
		const [pledge] = await db
			.insert(irisLasPledges)
			.values({
				userId: opts.userId,
				pan: opts.pan,
				pledgeType: "mutual_fund",
				pledgeStatus: "pending",
				folioDetails: opts.folioDetails as any,
				loanToValueRatio: "0.60",
				agentId: opts.agentId,
				source: opts.agentId ? "agent" : "api",
			})
			.returning({ id: irisLasPledges.id });

		try {
			const data: any = await withRetry(() =>
				irisKfintechService.initiateMfPledge({
					pan: opts.pan,
					folioDetails: opts.folioDetails,
					loanAmount: opts.loanAmount,
					lenderCode: opts.lenderCode,
				}),
			);

			const irisPledgeId =
				data?.pledgeId ?? data?.pledge_id ?? data?.referenceId;
			const irisStatus = data?.status ?? "initiated";

			await db
				.update(irisLasPledges)
				.set({
					irisPledgeId,
					pledgeStatus: irisStatus,
					totalPledgedValue: String(
						data?.totalPledgedValue ??
							data?.total_pledged_value ??
							opts.loanAmount,
					),
					maxLoanEligible: String(
						data?.maxLoanAmount ?? data?.max_loan_amount ?? opts.loanAmount,
					),
					irisResponse: data as any,
					updatedAt: new Date(),
				})
				.where(eq(irisLasPledges.id, pledge.id));

			logger.info("[IrisLAS] MF pledge initiated successfully", {
				event: "IRIS_LAS_MF_PLEDGE_INITIATED",
				user_id: opts.userId,
				localPledgeId: pledge.id,
				irisPledgeId,
				status: irisStatus,
				latency_ms: Date.now() - new Date(ts).getTime(),
			});

			return {
				success: true,
				localPledgeId: pledge.id,
				irisPledgeId,
				pledgeStatus: irisStatus,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		} catch (err: any) {
			await db
				.update(irisLasPledges)
				.set({
					pledgeStatus: "failed",
					irisResponse: { error: err?.message } as any,
					updatedAt: new Date(),
				})
				.where(eq(irisLasPledges.id, pledge.id));

			logger.error("[IrisLAS] MF pledge initiation failed", {
				event: "IRIS_LAS_MF_PLEDGE_FAILED",
				user_id: opts.userId,
				localPledgeId: pledge.id,
				error: err?.response?.data ?? err?.message,
			});
			return {
				success: false,
				localPledgeId: pledge.id,
				pledgeStatus: "failed",
				message:
					err?.response?.data?.message ??
					err?.message ??
					"Pledge initiation failed",
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		}
	}

	/**
	 * Initiate pledge of listed demat securities (equities, ETFs) for LAS.
	 *
	 * Purpose: Pledges specific ISIN+quantity from investor's demat account.
	 *
	 * Inputs: userId, pan, dpId, securities[], loanAmount, agentId
	 * Outputs: PledgeInitiationResult
	 */
	async initiateSecuritiesPledge(opts: {
		userId: string;
		pan: string;
		dpId: string;
		securities: Array<{ isin: string; quantity: number }>;
		loanAmount: number;
		lenderCode?: string;
		agentId?: string;
	}): Promise<PledgeInitiationResult> {
		const ts = new Date().toISOString();
		logger.info("[IrisLAS] Initiating securities pledge", {
			event: "IRIS_LAS_SEC_PLEDGE_INITIATE",
			user_id: opts.userId,
			pan: opts.pan.slice(0, 5) + "*****",
			securitiesCount: opts.securities.length,
		});

		const [pledge] = await db
			.insert(irisLasPledges)
			.values({
				userId: opts.userId,
				pan: opts.pan,
				pledgeType: "securities",
				pledgeStatus: "pending",
				securitiesDetails: opts.securities as any,
				loanToValueRatio: "0.50",
				agentId: opts.agentId,
				source: opts.agentId ? "agent" : "api",
			})
			.returning({ id: irisLasPledges.id });

		try {
			const data: any = await withRetry(() =>
				irisKfintechService.initiateSecuritiesPledge({
					pan: opts.pan,
					dpId: opts.dpId,
					securities: opts.securities,
					loanAmount: opts.loanAmount,
					lenderCode: opts.lenderCode,
				}),
			);

			const irisPledgeId =
				data?.pledgeId ?? data?.pledge_id ?? data?.referenceId;
			const irisStatus = data?.status ?? "initiated";

			await db
				.update(irisLasPledges)
				.set({
					irisPledgeId,
					pledgeStatus: irisStatus,
					totalPledgedValue: String(data?.totalPledgedValue ?? opts.loanAmount),
					maxLoanEligible: String(data?.maxLoanAmount ?? opts.loanAmount),
					irisResponse: data as any,
					updatedAt: new Date(),
				})
				.where(eq(irisLasPledges.id, pledge.id));

			return {
				success: true,
				localPledgeId: pledge.id,
				irisPledgeId,
				pledgeStatus: irisStatus,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		} catch (err: any) {
			await db
				.update(irisLasPledges)
				.set({
					pledgeStatus: "failed",
					irisResponse: { error: err?.message } as any,
					updatedAt: new Date(),
				})
				.where(eq(irisLasPledges.id, pledge.id));
			return {
				success: false,
				localPledgeId: pledge.id,
				pledgeStatus: "failed",
				message: err?.response?.data?.message ?? err?.message,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		}
	}

	/**
	 * Apply for a LAS loan against an active pledge.
	 *
	 * Purpose: Submits the loan application to the IRIS-linked lender. Returns
	 *          the loan ID for tracking disbursement.
	 *
	 * ⚠️ FASP-AI Compliance: This service is a Decision Support System only.
	 * Loan application ALWAYS requires explicit investor confirmation before calling this.
	 *
	 * Inputs: userId, pan, localPledgeId (or irisPledgeId), requestedAmount, tenure
	 * Outputs: LoanApplicationResult with mandatory risk disclaimer
	 */
	async applyForLoan(opts: {
		userId: string;
		pan: string;
		localPledgeId: string;
		requestedAmount: number;
		tenure: number;
		disbursementBankAccount?: string;
		purposeOfLoan?: string;
		agentId?: string;
	}): Promise<LoanApplicationResult> {
		const ts = new Date().toISOString();

		// Fetch the pledge to get irisPledgeId
		const [pledge] = await db
			.select()
			.from(irisLasPledges)
			.where(eq(irisLasPledges.id, opts.localPledgeId))
			.limit(1);

		if (!pledge || pledge.userId !== opts.userId) {
			return {
				success: false,
				localLoanId: "",
				loanStatus: "failed",
				message: "Pledge not found or not owned by this investor",
				disclaimer: LOAN_DISCLAIMER,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		}

		logger.info("[IrisLAS] Applying for loan", {
			event: "IRIS_LAS_LOAN_APPLY",
			user_id: opts.userId,
			localPledgeId: opts.localPledgeId,
			irisPledgeId: pledge.irisPledgeId ?? "N/A",
			requestedAmount: opts.requestedAmount,
		});

		const loanType =
			pledge.pledgeType === "mutual_fund"
				? "against_mutual_funds"
				: "against_securities";

		const [loan] = await db
			.insert(irisLasLoans)
			.values({
				userId: opts.userId,
				pan: opts.pan,
				pledgeId: opts.localPledgeId,
				irisPledgeId: pledge.irisPledgeId ?? undefined,
				loanType,
				loanStatus: "applied",
				requestedAmount: String(opts.requestedAmount),
				tenure: opts.tenure,
				agentId: opts.agentId,
				engineVersion: ENGINE_VERSION,
				calculationTimestamp: new Date(ts),
				source: opts.agentId ? "agent" : "api",
			})
			.returning({ id: irisLasLoans.id });

		try {
			const data: any = await withRetry(() =>
				irisKfintechService.applyForLoan({
					pan: opts.pan,
					pledgeId: pledge.irisPledgeId!,
					requestedAmount: opts.requestedAmount,
					tenure: opts.tenure,
					disbursementBankAccount: opts.disbursementBankAccount,
					purposeOfLoan: opts.purposeOfLoan,
				}),
			);

			const irisLoanId = data?.loanId ?? data?.loan_id ?? data?.applicationId;
			const irisStatus = data?.status ?? "under_review";
			const sanctionedAmount =
				data?.sanctionedAmount ?? data?.sanctioned_amount;
			const interestRate = data?.interestRate ?? data?.interest_rate;

			await db
				.update(irisLasLoans)
				.set({
					irisLoanId,
					loanStatus: irisStatus,
					sanctionedAmount: sanctionedAmount
						? String(sanctionedAmount)
						: undefined,
					interestRate: interestRate ? String(interestRate) : undefined,
					irisResponse: data as any,
					updatedAt: new Date(),
				})
				.where(eq(irisLasLoans.id, loan.id));

			logger.info("[IrisLAS] Loan application submitted", {
				event: "IRIS_LAS_LOAN_APPLIED",
				user_id: opts.userId,
				localLoanId: loan.id,
				irisLoanId,
				loanType,
				requestedAmount: opts.requestedAmount,
				status: irisStatus,
				latency_ms: Date.now() - new Date(ts).getTime(),
			});

			return {
				success: true,
				localLoanId: loan.id,
				irisLoanId,
				loanStatus: irisStatus,
				sanctionedAmount: sanctionedAmount
					? Number(sanctionedAmount)
					: undefined,
				interestRate: interestRate ? Number(interestRate) : undefined,
				disclaimer: LOAN_DISCLAIMER,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		} catch (err: any) {
			await db
				.update(irisLasLoans)
				.set({
					loanStatus: "failed",
					irisResponse: { error: err?.message } as any,
					updatedAt: new Date(),
				})
				.where(eq(irisLasLoans.id, loan.id));

			logger.error("[IrisLAS] Loan application failed", {
				event: "IRIS_LAS_LOAN_FAILED",
				user_id: opts.userId,
				localLoanId: loan.id,
				error: err?.response?.data ?? err?.message,
			});
			return {
				success: false,
				localLoanId: loan.id,
				loanStatus: "failed",
				message:
					err?.response?.data?.message ??
					err?.message ??
					"Loan application failed",
				disclaimer: LOAN_DISCLAIMER,
				engine_version: ENGINE_VERSION,
				calculation_timestamp: ts,
			};
		}
	}

	/**
	 * Get real-time status of a pledge from IRIS and sync to local DB.
	 */
	async getPledgeStatus(localPledgeId: string, userId: string): Promise<any> {
		const [pledge] = await db
			.select()
			.from(irisLasPledges)
			.where(
				and(
					eq(irisLasPledges.id, localPledgeId),
					eq(irisLasPledges.userId, userId),
				),
			)
			.limit(1);

		if (!pledge) throw new Error("Pledge not found");

		if (pledge.irisPledgeId) {
			const data = await withRetry(() =>
				irisKfintechService.getPledgeStatus(pledge.irisPledgeId!),
			);
			const newStatus = (data as any)?.status ?? pledge.pledgeStatus;
			if (newStatus !== pledge.pledgeStatus) {
				await db
					.update(irisLasPledges)
					.set({ pledgeStatus: newStatus, updatedAt: new Date() })
					.where(eq(irisLasPledges.id, localPledgeId));
			}
			return { ...pledge, pledgeStatus: newStatus, irisData: data };
		}

		return pledge;
	}

	/**
	 * Get real-time loan status from IRIS and sync to local DB.
	 */
	async getLoanStatus(localLoanId: string, userId: string): Promise<any> {
		const [loan] = await db
			.select()
			.from(irisLasLoans)
			.where(
				and(eq(irisLasLoans.id, localLoanId), eq(irisLasLoans.userId, userId)),
			)
			.limit(1);

		if (!loan) throw new Error("Loan not found");

		if (loan.irisLoanId) {
			const data = await withRetry(() =>
				irisKfintechService.getLoanStatus(loan.irisLoanId!),
			);
			const irisData = data as any;
			await db
				.update(irisLasLoans)
				.set({
					loanStatus: irisData?.status ?? loan.loanStatus,
					disbursedAmount: irisData?.disbursedAmount
						? String(irisData.disbursedAmount)
						: loan.disbursedAmount,
					outstandingAmount: irisData?.outstandingAmount
						? String(irisData.outstandingAmount)
						: loan.outstandingAmount,
					disbursementDate: irisData?.disbursementDate
						? new Date(irisData.disbursementDate)
						: loan.disbursementDate,
					updatedAt: new Date(),
				})
				.where(eq(irisLasLoans.id, localLoanId));
			return { ...loan, irisData };
		}

		return loan;
	}

	/**
	 * Get full loan statement for a PAN from IRIS.
	 */
	async getLoanStatement(
		userId: string,
		pan: string,
		loanId?: string,
	): Promise<any> {
		const data = await withRetry(() =>
			irisKfintechService.getLoanStatement(pan, loanId),
		);
		return {
			data,
			engine_version: ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Initiate repayment against an active loan.
	 */
	async repayLoan(opts: {
		userId: string;
		localLoanId: string;
		amount: number;
		paymentMode: "NEFT" | "IMPS" | "UPI" | "NACH";
		utrNumber?: string;
	}): Promise<any> {
		const [loan] = await db
			.select()
			.from(irisLasLoans)
			.where(
				and(
					eq(irisLasLoans.id, opts.localLoanId),
					eq(irisLasLoans.userId, opts.userId),
				),
			)
			.limit(1);

		if (!loan?.irisLoanId)
			throw new Error("Loan not found or not yet active in IRIS");

		const data = await withRetry(() =>
			irisKfintechService.repayLoan({
				loanId: loan.irisLoanId!,
				amount: opts.amount,
				paymentMode: opts.paymentMode,
				utrNumber: opts.utrNumber,
			}),
		);

		logger.info("[IrisLAS] Loan repayment initiated", {
			event: "IRIS_LAS_LOAN_REPAY",
			user_id: opts.userId,
			localLoanId: opts.localLoanId,
			amount: opts.amount,
			paymentMode: opts.paymentMode,
		});

		return {
			success: true,
			data,
			engine_version: ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Release a pledge after loan closure.
	 * Updates local DB status to 'released'.
	 */
	async releasePledge(opts: {
		userId: string;
		localPledgeId: string;
		reason: "LOAN_CLOSED" | "LOAN_CANCELLED" | "VOLUNTARY";
	}): Promise<any> {
		const [pledge] = await db
			.select()
			.from(irisLasPledges)
			.where(
				and(
					eq(irisLasPledges.id, opts.localPledgeId),
					eq(irisLasPledges.userId, opts.userId),
				),
			)
			.limit(1);

		if (!pledge?.irisPledgeId)
			throw new Error("Pledge not found or not yet active in IRIS");

		const data = await withRetry(() =>
			irisKfintechService.releasePledge(pledge.irisPledgeId!, opts.reason),
		);

		await db
			.update(irisLasPledges)
			.set({ pledgeStatus: "released", updatedAt: new Date() })
			.where(eq(irisLasPledges.id, opts.localPledgeId));

		logger.info("[IrisLAS] Pledge released", {
			event: "IRIS_LAS_PLEDGE_RELEASED",
			user_id: opts.userId,
			localPledgeId: opts.localPledgeId,
			irisPledgeId: pledge.irisPledgeId,
			reason: opts.reason,
		});

		return {
			success: true,
			data,
			engine_version: ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	/**
	 * List all pledges for a user.
	 */
	async listUserPledges(userId: string, pan?: string): Promise<any[]> {
		const conditions = pan
			? and(eq(irisLasPledges.userId, userId), eq(irisLasPledges.pan, pan))
			: eq(irisLasPledges.userId, userId);
		return db
			.select()
			.from(irisLasPledges)
			.where(conditions)
			.orderBy(desc(irisLasPledges.createdAt));
	}

	/**
	 * List all loans for a user.
	 */
	async listUserLoans(userId: string, pan?: string): Promise<any[]> {
		const conditions = pan
			? and(eq(irisLasLoans.userId, userId), eq(irisLasLoans.pan, pan))
			: eq(irisLasLoans.userId, userId);
		return db
			.select()
			.from(irisLasLoans)
			.where(conditions)
			.orderBy(desc(irisLasLoans.createdAt));
	}
}

// ─── Mandatory SEBI/FASP-AI disclaimer (required on every loan output) ────────

const LOAN_DISCLAIMER = [
	"Loan Against Securities/Mutual Funds involves pledging your investments as collateral.",
	"Non-repayment may result in forced liquidation of pledged assets.",
	"Market value fluctuations may trigger margin calls.",
	"Interest rates and processing fees vary by lender.",
	"This is a decision support tool — final loan application requires your explicit confirmation.",
	"FintekPro is not a lender. Loan sanctioning is solely at the discretion of the IRIS-linked lender.",
].join(" ");

export const irisLasService = new IrisLasService();
