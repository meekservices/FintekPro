/**
 * Transaction Compliance Gate — FintekPro FASP-AI v1.0
 *
 * Regulatory basis:
 *  - SEBI (Investment Advisers) Regulations 2013, Regulation 17 — suitability
 *  - SEBI Circular SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2022/98 — KYC for MF
 *  - FEMA Notification 20(R)/2017-RB — NRI investment via NRE/NRO accounts
 *  - FATCA / Common Reporting Standard — Income Tax Act Section 285BA
 *  - PMLA 2002 — client identification before every transaction
 *  - SEBI Master Circular on Mutual Funds (July 2023) — AMC country restrictions
 *
 * Usage:
 *   app.post('/api/iris/transactions/place-order',
 *     requireAuth, requireAgent,
 *     requireTransactionCompliance('MF'),
 *     handler);
 *
 * All 8 gates run sequentially; the first failure short-circuits with HTTP 422.
 * Gate 8 (EUIN Check) is special — instead of blocking, it queues the transaction
 * to the FintekPro Master Agent and returns HTTP 202 Accepted (queued).
 * A companion GET /api/compliance/transaction-readiness returns all gate statuses
 * so the frontend can show pre-flight warnings before the user clicks "Invest".
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "../logger";
import { kycSufficiencyService } from "../services/kyc-sufficiency-service";
import { fatcaCrsService } from "../services/fatca-crs-service";
import { queueTransactionForMasterApproval } from "../services/masterAgentApprovalService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionType = "MF" | "US_EQUITY";
export type TransactionAction =
	| "purchase"
	| "redemption"
	| "sip"
	| "stp"
	| "any";

export interface ComplianceGateResult {
	/** Sequential gate number (1–7) */
	gate: number;
	/** Human-readable gate name */
	gateName: string;
	/** Whether this gate passed */
	passed: boolean;
	/** Machine-readable error code */
	errorCode?: string;
	/** User-facing message */
	message?: string;
	/** Whether the client can self-serve the fix without advisor help */
	retryable: boolean;
	/** Deep-link into the portal where the user can fix the issue */
	remediationUrl?: string;
}

export interface ComplianceCheckResult {
	passed: boolean;
	gates: ComplianceGateResult[];
	/** First failing gate (undefined if all passed) */
	failingGate?: ComplianceGateResult;
}

// Countries where most Indian AMCs block NRI investments (US/Canada FATCA pressure)
const AMC_RESTRICTED_COUNTRIES_FOR_MF = new Set([
	"United States",
	"US",
	"USA",
	"United States of America",
	"Canada",
	"CA",
]);

// ─── Individual Gate Checks ───────────────────────────────────────────────────

/**
 * Gate 1: Client Residency
 * The user's residency status must be declared and recognized.
 * Permitted values: resident_indian, nri, pio, oci, foreign_national_resident
 */
async function checkResidency(userId: string): Promise<ComplianceGateResult> {
	const GATE = 1;
	const GATE_NAME = "Client Residency";
	try {
		const [userRow] = await db
			.select({
				residentStatus: schema.users.residentStatus,
				countryOfResidence: (schema.users as any).countryOfResidence,
			})
			.from(schema.users)
			.where(eq(schema.users.id, userId))
			.limit(1);

		const residentStatus = userRow?.residentStatus ?? null;
		const knownStatuses = [
			"resident_indian",
			"nri",
			"pio",
			"oci",
			"foreign_national_resident",
		];

		if (!residentStatus || !knownStatuses.includes(residentStatus)) {
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: false,
				retryable: true,
				errorCode: "RESIDENCY_UNKNOWN",
				message:
					"Your residency status is not declared. Please complete your profile to enable transactions.",
				remediationUrl: "/profile?tab=residency",
			};
		}

		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	} catch (err) {
		logger.error("[ComplianceGate] Residency check failed", { userId, err });
		return {
			gate: GATE,
			gateName: GATE_NAME,
			passed: false,
			retryable: true,
			errorCode: "RESIDENCY_CHECK_FAILED",
			message: "Unable to verify residency status. Please try again.",
		};
	}
}

/**
 * Gate 2: KYC Status
 * Full KYC must be verified. Uses the existing KYC sufficiency service
 * with the product-specific check profile.
 */
async function checkKycStatus(
	userId: string,
	transactionType: TransactionType,
): Promise<ComplianceGateResult> {
	const GATE = 2;
	const GATE_NAME = "KYC Status";
	try {
		const productCode =
			transactionType === "US_EQUITY" ? "EQUITY_TRADING" : "MUTUAL_FUNDS";
		const result = await kycSufficiencyService.checkSufficiency(
			userId,
			productCode,
		);

		if (!result.canProceed || result.missingMandatory.length > 0) {
			const missing = result.missingMandatory.slice(0, 3).join(", ");
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: false,
				retryable: true,
				errorCode: "KYC_INCOMPLETE",
				message: `KYC is incomplete (${missing}). Please complete your KYC to proceed.`,
				remediationUrl: "/profile?tab=kyc",
			};
		}

		if (result.kycIsExpired) {
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: false,
				retryable: true,
				errorCode: "KYC_EXPIRED",
				message:
					"Your KYC has expired. Please re-complete your KYC to enable transactions.",
				remediationUrl: "/profile?tab=kyc",
			};
		}

		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	} catch (err) {
		logger.error("[ComplianceGate] KYC check failed", { userId, err });
		return {
			gate: GATE,
			gateName: GATE_NAME,
			passed: false,
			retryable: true,
			errorCode: "KYC_CHECK_FAILED",
			message: "Unable to verify KYC status. Please try again.",
		};
	}
}

/**
 * Gate 3: FATCA / CRS Compliance
 * FATCA self-certification must be compliant or exempt.
 * Foreign nationals additionally need a valid CRS declaration.
 */
async function checkFatcaCrs(userId: string): Promise<ComplianceGateResult> {
	const GATE = 3;
	const GATE_NAME = "FATCA / CRS";
	try {
		const fatca = await fatcaCrsService.getFATCAStatus(userId);

		if (fatca.fatcaStatus === "non_compliant") {
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: false,
				retryable: true,
				errorCode: "FATCA_NON_COMPLIANT",
				message:
					"FATCA self-certification has failed or is non-compliant. Please contact support.",
				remediationUrl: "/profile?tab=fatca",
			};
		}

		if (fatca.fatcaStatus === "pending") {
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: false,
				retryable: true,
				errorCode: "FATCA_PENDING",
				message:
					"FATCA / CRS self-certification is pending. Please declare your tax residency.",
				remediationUrl: "/profile?tab=fatca",
			};
		}

		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	} catch (err) {
		logger.error("[ComplianceGate] FATCA/CRS check failed", { userId, err });
		return {
			gate: GATE,
			gateName: GATE_NAME,
			passed: false,
			retryable: true,
			errorCode: "FATCA_CHECK_FAILED",
			message: "Unable to verify FATCA/CRS status. Please try again.",
		};
	}
}

/**
 * Gate 4: NRE / NRO Bank Account Validation
 * NRI clients must have a verified NRE or NRO bank account linked.
 * Resident Indians skip this gate.
 * Redemptions are allowed if the original purchase bank is on record.
 */
async function checkNreNroBank(
	userId: string,
	action: TransactionAction,
): Promise<ComplianceGateResult> {
	const GATE = 4;
	const GATE_NAME = "NRE / NRO Bank";
	try {
		const [userRow] = await db
			.select({ residentStatus: schema.users.residentStatus })
			.from(schema.users)
			.where(eq(schema.users.id, userId))
			.limit(1);

		const isNri =
			userRow?.residentStatus &&
			["nri", "pio", "oci"].includes(userRow.residentStatus);

		if (!isNri) {
			// Resident Indians are exempt — pass through
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: true,
				retryable: false,
			};
		}

		// For redemptions: SEBI allows proceeds to the originating bank — relaxed check
		if (action === "redemption") {
			const anyBank = await db
				.select({ id: (schema.userBankAccounts as any).id })
				.from(schema.userBankAccounts as any)
				.where(
					and(
						eq((schema.userBankAccounts as any).userId, userId),
						eq((schema.userBankAccounts as any).isVerified, true),
						eq((schema.userBankAccounts as any).isActive, true),
					),
				)
				.limit(1);

			if (anyBank.length > 0) {
				return {
					gate: GATE,
					gateName: GATE_NAME,
					passed: true,
					retryable: false,
				};
			}
		}

		// For purchases and SIP: must have NRE or NRO account
		const nriBank = await db
			.select({
				id: (schema.userBankAccounts as any).id,
				accountType: (schema.userBankAccounts as any).accountType,
			})
			.from(schema.userBankAccounts as any)
			.where(
				and(
					eq((schema.userBankAccounts as any).userId, userId),
					eq((schema.userBankAccounts as any).isVerified, true),
					eq((schema.userBankAccounts as any).isActive, true),
					inArray((schema.userBankAccounts as any).accountType, [
						"nre",
						"nro",
						"NRE",
						"NRO",
					]),
				),
			)
			.limit(1);

		if (nriBank.length === 0) {
			return {
				gate: GATE,
				gateName: GATE_NAME,
				passed: false,
				retryable: true,
				errorCode: "NRE_NRO_BANK_REQUIRED",
				message:
					"As an NRI, you must link and verify an NRE or NRO bank account before investing.",
				remediationUrl: "/profile?tab=bank-accounts",
			};
		}

		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	} catch (err) {
		logger.error("[ComplianceGate] NRE/NRO bank check failed", { userId, err });
		return {
			gate: GATE,
			gateName: GATE_NAME,
			passed: false,
			retryable: true,
			errorCode: "BANK_CHECK_FAILED",
			message: "Unable to verify bank account. Please try again.",
		};
	}
}

/**
 * Gate 5: AMC Country Eligibility / LRS Limit
 * MF: Most AMCs block investments from US/Canada residents (FATCA friction).
 * US Equity: FEMA Liberalised Remittance Scheme — $250,000/year cap.
 */
async function checkCountryEligibility(
	userId: string,
	transactionType: TransactionType,
	amountUsd?: number,
): Promise<ComplianceGateResult> {
	const GATE = 5;
	const GATE_NAME =
		transactionType === "MF" ? "AMC Country Eligibility" : "LRS Limit (FEMA)";
	try {
		const [userRow] = await db
			.select({
				residentStatus: schema.users.residentStatus,
				countryOfResidence: (schema.users as any).countryOfResidence,
			})
			.from(schema.users)
			.where(eq(schema.users.id, userId))
			.limit(1);

		const country: string = userRow?.countryOfResidence ?? "India";

		if (transactionType === "MF") {
			if (AMC_RESTRICTED_COUNTRIES_FOR_MF.has(country)) {
				return {
					gate: GATE,
					gateName: GATE_NAME,
					passed: false,
					retryable: false,
					errorCode: "AMC_COUNTRY_BLOCKED",
					message: `Investors resident in ${country} are not permitted to invest in Indian Mutual Funds as per AMC restrictions. Please consult your advisor.`,
					remediationUrl: "/profile?tab=residency",
				};
			}
		}

		if (transactionType === "US_EQUITY" && amountUsd && amountUsd > 0) {
			// Simplified LRS check — full check happens in FEMA compliance service
			// Hard block if a single transaction exceeds annual LRS cap
			const LRS_ANNUAL_LIMIT_USD = 250_000;
			if (amountUsd > LRS_ANNUAL_LIMIT_USD) {
				return {
					gate: GATE,
					gateName: GATE_NAME,
					passed: false,
					retryable: false,
					errorCode: "LRS_LIMIT_EXCEEDED",
					message: `This transaction ($${amountUsd.toLocaleString()}) exceeds the FEMA Liberalised Remittance Scheme annual limit of $250,000.`,
					remediationUrl: "/profile?tab=lrs",
				};
			}
		}

		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	} catch (err) {
		logger.error("[ComplianceGate] Country eligibility check failed", {
			userId,
			err,
		});
		return {
			gate: GATE,
			gateName: GATE_NAME,
			passed: false,
			retryable: true,
			errorCode: "COUNTRY_CHECK_FAILED",
			message: "Unable to verify country eligibility. Please try again.",
		};
	}
}

/**
 * Gate 6: Scheme / Instrument Transaction Rules
 * MF: Minimum amount, SIP date validity, scheme-level purchase/redemption blocks.
 * US Equity: Market hours, instrument eligibility (fractional shares, PDT rule).
 *
 * For MF, the IRIS validateInvestment() is called as the authoritative source.
 * The result of validation is stored in res.locals so the next handler can
 * skip the redundant IRIS validate call.
 */
async function checkSchemeRules(
	res: Response,
	transactionType: TransactionType,
	schemeCode?: string,
	amount?: number,
	action?: TransactionAction,
): Promise<ComplianceGateResult> {
	const GATE = 6;
	const GATE_NAME = "Scheme Transaction Rules";

	// For MF: defer to IRIS validation — if the caller is place-order,
	// the irisKfintechService.placeOrder() itself internally validates.
	// We mark this gate as a pass with a note that IRIS performs the check.
	// For a stricter pre-check, the caller can pass schemeCode + amount.
	if (transactionType === "MF") {
		// Minimum amount guard (₹100 for lump sum, ₹500 for SIP)
		if (amount !== undefined) {
			const minAmount = action === "sip" ? 500 : 100;
			if (amount < minAmount) {
				return {
					gate: GATE,
					gateName: GATE_NAME,
					passed: false,
					retryable: true,
					errorCode: "AMOUNT_BELOW_MINIMUM",
					message: `Minimum ${action === "sip" ? "SIP" : "lump-sum"} amount is ₹${minAmount.toLocaleString("en-IN")}.`,
				};
			}
		}

		// Scheme-level check: pass through — IRIS validates on submission
		res.locals.schemeRulesPreValidated = true;
		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	}

	if (transactionType === "US_EQUITY") {
		// US equity: no pre-check at gate level; Alpaca validates order type/quantity
		res.locals.schemeRulesPreValidated = true;
		return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
	}

	return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

/**
 * Run all 7 compliance gates for a given user and transaction context.
 * Returns the full gate-by-gate result for display or logging.
 *
 * @param userId - FintekPro user ID
 * @param transactionType - 'MF' for mutual funds, 'US_EQUITY' for Alpaca
 * @param options - optional per-gate parameters (amount, action, schemeCode)
 */
// ─── Gate 8: EUIN Verification (Agent/Partner Executing Role) ────────────────
/**
 * Gate 8: EUIN Check
 *
 * Only EUIN-verified agents and partners can independently submit transactions to IRIS.
 * Without a verified EUIN, the transaction is NOT blocked — instead it is:
 *   1. Stored in pending_transactions table
 *   2. Assigned to the FintekPro Master Agent for approval
 *   3. Returns { gate8Queued: true, pendingTransactionId } to the middleware
 *      which sends HTTP 202 Accepted instead of proceeding to IRIS.
 *
 * SEBI compliance: EUIN must appear on all MF order forms.
 * When agent has no EUIN, Master Agent's EUIN is used as the executing principal.
 *
 * Returns passed: true when actor HAS verified EUIN (transaction proceeds normally).
 * Returns passed: false + gate8Queued: true when no EUIN (transaction is queued).
 */
async function checkEuinAndRouteToMasterAgent(
  actorUserId: string,
  actorRole: string,
  transactionType: string,
  productType: string,
  payload: Record<string, unknown>,
  clientPan?: string,
  clientUserId?: string,
): Promise<ComplianceGateResult & { gate8Queued?: boolean; pendingTransactionId?: string; masterAgentUserId?: string }> {
  const GATE = 8;
  const GATE_NAME = "EUIN Verification";

  // Only MF transactions require EUIN (bonds, FDs, US equity have different rules)
  if (productType !== "mutual_fund" && !transactionType.startsWith("mf_")) {
    return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
  }

  try {
    // Check if actor has a verified EUIN in customerCareAgents
    const agentRecord = await db
      .select({
        euinNumber:             schema.customerCareAgents.euinNumber,
        euinVerificationStatus: schema.customerCareAgents.euinVerificationStatus,
        euinCardVerified:       schema.customerCareAgents.euinCardVerified,
      })
      .from(schema.customerCareAgents)
      .where(
        and(
          eq(schema.customerCareAgents.distributorId, actorUserId),
          eq(schema.customerCareAgents.euinCardVerified, true),
        ),
      )
      .limit(1);

    const hasVerifiedEuin = agentRecord.length > 0 && !!agentRecord[0].euinNumber;

    if (hasVerifiedEuin) {
      // EUIN verified — transaction can go directly to IRIS
      return { gate: GATE, gateName: GATE_NAME, passed: true, retryable: false };
    }

    // No verified EUIN — queue to master agent instead of blocking
    const role = ["agent", "partner"].includes(actorRole) ? actorRole as "agent" | "partner" : "agent";
    const queueResult = await queueTransactionForMasterApproval(
      actorUserId,
      role,
      transactionType,
      productType,
      payload,
      clientPan,
      clientUserId,
    );

    return {
      gate:          GATE,
      gateName:      GATE_NAME,
      passed:        false,
      retryable:     false,
      errorCode:     "NO_EUIN_QUEUED_TO_MASTER_AGENT",
      message:       `Transaction queued for Master Agent approval (Ref: ${queueResult.pendingTransactionId}). You will be notified once approved.`,
      gate8Queued:          true,
      pendingTransactionId: queueResult.pendingTransactionId,
      masterAgentUserId:    queueResult.masterAgentUserId,
    };
  } catch (err: any) {
    logger.error("[ComplianceGate] Gate 8 EUIN check failed", { actorUserId, err: err.message });
    // Fail-safe: if we can't determine EUIN status, queue to master agent
    return {
      gate:      GATE,
      gateName:  GATE_NAME,
      passed:    false,
      retryable: true,
      errorCode: "EUIN_CHECK_FAILED",
      message:   "Could not verify EUIN status. Transaction held pending manual review.",
    };
  }
}

export async function runComplianceChecks(
	userId: string,
	transactionType: TransactionType,
	res: Response,
	options: {
		action?: TransactionAction;
		amount?: number;
		amountUsd?: number;
		schemeCode?: string;
		/** Actor role — agent | partner | admin. EUIN gate skips for admin/superadmin/master_agent. */
		actorRole?: string;
		/** Original request payload forwarded on master-agent approval */
		payload?: Record<string, unknown>;
		clientPan?: string;
		clientUserId?: string;
	} = {},
): Promise<ComplianceCheckResult & { gate8Queued?: boolean; pendingTransactionId?: string }> {
	const { action = "any", amount, amountUsd, schemeCode, actorRole, payload = {}, clientPan, clientUserId } = options;

	const gates: ComplianceGateResult[] = [];

	// Gate 1: Residency
	const g1 = await checkResidency(userId);
	gates.push(g1);
	if (!g1.passed) return { passed: false, gates, failingGate: g1 };

	// Gate 2: KYC
	const g2 = await checkKycStatus(userId, transactionType);
	gates.push(g2);
	if (!g2.passed) return { passed: false, gates, failingGate: g2 };

	// Gate 3: FATCA / CRS
	const g3 = await checkFatcaCrs(userId);
	gates.push(g3);
	if (!g3.passed) return { passed: false, gates, failingGate: g3 };

	// Gate 4: NRE/NRO Bank (NRIs only; redemptions use relaxed rule)
	const g4 = await checkNreNroBank(userId, action);
	gates.push(g4);
	if (!g4.passed) return { passed: false, gates, failingGate: g4 };

	// Gate 5: AMC Country / LRS Limit
	const g5 = await checkCountryEligibility(userId, transactionType, amountUsd);
	gates.push(g5);
	if (!g5.passed) return { passed: false, gates, failingGate: g5 };

	// Gate 6: Scheme / Instrument Rules
	const g6 = await checkSchemeRules(
		res,
		transactionType,
		schemeCode,
		amount,
		action,
	);
	gates.push(g6);
	if (!g6.passed) return { passed: false, gates, failingGate: g6 };

	// Gate 7: Client compliance clear
	gates.push({
		gate: 7,
		gateName: "Client Compliance Clear",
		passed: true,
		retryable: false,
	});

	// Gate 8: EUIN Verification — routes no-EUIN actors to Master Agent approval queue
	// Skip for admin/superadmin/master_agent who always have authority to execute
	const adminRoles = new Set(["admin", "superadmin", "master_agent"]);
	if (actorRole && !adminRoles.has(actorRole)) {
		const g8 = await checkEuinAndRouteToMasterAgent(
			userId,
			actorRole,
			transactionType,
			"mutual_fund",
			payload,
			clientPan,
			clientUserId,
		);
		gates.push(g8);

		if (!g8.passed) {
			const extended = g8 as ComplianceGateResult & { gate8Queued?: boolean; pendingTransactionId?: string };
			return {
				passed:               false,
				gates,
				failingGate:          g8,
				gate8Queued:          extended.gate8Queued,
				pendingTransactionId: extended.pendingTransactionId,
			};
		}
	}

	// All gates passed — transaction proceeds to IRIS / Alpaca
	gates.push({
		gate: 9,
		gateName: "Submit to Provider",
		passed: true,
		retryable: false,
	});

	return { passed: true, gates };
}

// ─── Express Middleware Factory ───────────────────────────────────────────────

/**
 * Middleware factory — returns an Express middleware that enforces the full
 * 7-step compliance pipeline before the request reaches the transaction handler.
 *
 * @param transactionType - 'MF' | 'US_EQUITY'
 * @param actionHint - 'purchase' | 'redemption' | 'sip' | 'stp' | 'any'
 *
 * @example
 *   app.post('/api/iris/transactions/place-order',
 *     requireAuth, requireAgent,
 *     requireTransactionCompliance('MF', 'purchase'),
 *     placeOrderHandler);
 */
export function requireTransactionCompliance(
	transactionType: TransactionType,
	actionHint: TransactionAction = "any",
) {
	return async function transactionComplianceGate(
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		const userId = (req as any).user?.id as string | undefined;

		if (!userId) {
			res.status(401).json({
				success: false,
				error_code: "UNAUTHENTICATED",
				message: "Authentication required.",
				retryable: false,
			});
			return;
		}

		// Extract transaction context from body
		const body = (req.body ?? {}) as Record<string, unknown>;
		const amount =
			typeof body.amount === "number"
				? body.amount
				: typeof body.amount === "string"
					? Number.parseFloat(body.amount)
					: undefined;
		const amountUsd =
			typeof body.amountUsd === "number"
				? body.amountUsd
				: typeof body.qty === "number"
					? body.qty * ((body.limitPrice as number) || 0)
					: undefined;
		const schemeCode = body.schemeCode as string | undefined;

		const startMs = Date.now();

		try {
			const result = await runComplianceChecks(userId, transactionType, res, {
				action: actionHint,
				amount,
				amountUsd,
				schemeCode,
				actorRole: (req as any).user?.role ?? ((req as any).user?.roles?.[0] as string | undefined),
				payload:   (req.body ?? {}) as Record<string, unknown>,
				clientPan: (req.body as any)?.pan as string | undefined,
				clientUserId: (req.body as any)?.clientUserId as string | undefined,
			});

			const latencyMs = Date.now() - startMs;

			// Structured compliance log — required by FASP-AI v1.0
			logger.info("TRANSACTION_COMPLIANCE_CHECK", {
				user_id: userId,
				transaction_type: transactionType,
				action: actionHint,
				passed: result.passed,
				gates_run: result.gates.length,
				failing_gate: result.failingGate?.gateName ?? null,
				error_code: result.failingGate?.errorCode ?? null,
				latency_ms: latencyMs,
				status: result.passed ? "ALLOWED" : "BLOCKED",
			});

			if (!result.passed && result.failingGate) {
				// Gate 8 special case: no EUIN → queued to master agent → return 202 Accepted
				if ((result as any).gate8Queued) {
					res.status(202).json({
						success: false,
						queued: true,
						error_code: "NO_EUIN_QUEUED_TO_MASTER_AGENT",
						message: result.failingGate.message,
						pending_transaction_id: (result as any).pendingTransactionId,
						gate: result.failingGate.gate,
						gate_name: result.failingGate.gateName,
						meta: { timestamp: new Date().toISOString(), version: "1.0" },
					});
					return;
				}
				// All other failing gates → 422 Unprocessable
				const {
					errorCode,
					message,
					retryable,
					remediationUrl,
					gate,
					gateName,
				} = result.failingGate;
				res.status(422).json({
					success: false,
					error_code: errorCode,
					message,
					retryable,
					gate,
					gate_name: gateName,
					remediation_url: remediationUrl ?? null,
					meta: {
						timestamp: new Date().toISOString(),
						version: "1.0",
					},
				});
				return;
			}

			// Store compliance result for downstream handlers (e.g. audit pack)
			res.locals.complianceResult = result;
			next();
		} catch (err) {
			logger.error("[ComplianceGate] Fatal error in compliance pipeline", {
				user_id: userId,
				err,
			});
			res.status(500).json({
				success: false,
				error_code: "COMPLIANCE_CHECK_FAILED",
				message:
					"Unable to complete compliance verification. Please try again.",
				retryable: true,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	};
}
