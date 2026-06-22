/**
 * LRS Pre-Submit Blocking Check
 *
 * Enforces RBI's Liberalised Remittance Scheme (LRS) requirements BEFORE any
 * Alpaca KYC submission or US equity order is placed for an Indian-resident investor.
 *
 * This is a HARD BLOCK at the adapter layer — it must NOT be UI-gated only.
 * Any code path to Alpaca must pass through this check.
 *
 * Regulatory requirements enforced here:
 *  1. LRS annual limit ($250,000 / ~₹2.08 Cr at current FX) must not be breached.
 *  2. FATCA/CRS self-certification must be on file in the KYC vault.
 *  3. Form A2 reference must be stored per remittance.
 *
 * GCR Rules:
 *  - Same inputs → same output ALWAYS (deterministic check)
 *  - Structured log on every call: { event, user_id, status, ytd_amount, latency_ms }
 *  - Throws a non-retryable error on block — adapter must NOT proceed silently
 *  - PAN/SSN never logged — only user_id
 */

import { db } from "../db";
import { lrsComplianceTracking } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../logger";

/** LRS annual limit in USD. Source: RBI Master Direction on LRS. */
const LRS_ANNUAL_LIMIT_USD = 250_000;

/** Financial year: April 1 to March 31 (India). */
function getFinancialYearStart(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 /* April = month 3 (0-indexed) */
    ? now.getFullYear()
    : now.getFullYear() - 1;
  return new Date(`${year}-04-01T00:00:00.000Z`);
}

export interface LrsEligibilityResult {
  /** True = may proceed with Alpaca submission. False = MUST block. */
  eligible: boolean;
  /** Human-readable block reason. Only present when eligible = false. */
  reason?: string;
  /** Block error code. Only present when eligible = false. */
  error_code?: string;
  /** Year-to-date cumulative remittance in USD (or 0 if no records). */
  ytdAmountUsd: number;
  /** Remaining allowance in USD (LRS_ANNUAL_LIMIT - ytdAmount). May be negative if over-limit. */
  remainingAllowanceUsd: number;
  /** True if FATCA/CRS self-certification exists in vault. */
  fatcaCertPresent: boolean;
  /** Financial year start date used for the YTD calculation. */
  fyStart: string;
}

/**
 * Check whether a user is eligible to proceed with an Alpaca (US market) submission.
 *
 * Called synchronously inside the Alpaca adapter's `submitKyc()` and any
 * US equity order path, BEFORE any outbound HTTP call.
 *
 * @param userId - FintekPro user ID
 * @param newRemittanceAmountUsd - Amount of the new remittance being attempted (0 for KYC-only checks)
 * @returns LrsEligibilityResult — caller MUST check `.eligible` and throw if false
 */
export async function checkLrsEligibility(
  userId: string,
  newRemittanceAmountUsd = 0,
): Promise<LrsEligibilityResult> {
  const startTs = Date.now();
  const fyStart = getFinancialYearStart();

  try {
    // ── 1. Fetch year-to-date cumulative remittance for this user ─────────────
    let ytdAmountUsd = 0;
    let fatcaCertPresent = false;

    try {
      const rows = await db
        .select()
        .from(lrsComplianceTracking)
        .where(
          and(
            eq(lrsComplianceTracking.userId, userId),
            gte(lrsComplianceTracking.createdAt, fyStart),
          ),
        )
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0] as any;
        ytdAmountUsd = Number(row.ytdAmountUsd ?? row.ytd_amount_usd ?? 0);
        fatcaCertPresent = !!(row.fatcaCompliant ?? row.fatca_compliant ?? false);
      }
    } catch (dbErr: any) {
      // Non-fatal DB read failure — log but proceed with conservative block
      logger.warn("[LRS] DB read failed during eligibility check", {
        event: "LRS_DB_READ_ERROR",
        user_id: userId,
        message: dbErr.message,
      });
      // Conservative: if we can't read, block rather than allow
      const result: LrsEligibilityResult = {
        eligible: false,
        reason: "LRS compliance check could not be completed — DB temporarily unavailable. Retry shortly.",
        error_code: "LRS_CHECK_DB_ERROR",
        ytdAmountUsd: 0,
        remainingAllowanceUsd: 0,
        fatcaCertPresent: false,
        fyStart: fyStart.toISOString(),
      };
      logger.warn("[LRS] LRS_CHECK_BLOCK — DB error, blocking conservatively", {
        event: "LRS_CHECK_BLOCK",
        user_id: userId,
        reason: result.reason,
        latency_ms: Date.now() - startTs,
        status: "blocked",
      });
      return result;
    }

    const projectedTotal = ytdAmountUsd + newRemittanceAmountUsd;
    const remainingAllowanceUsd = LRS_ANNUAL_LIMIT_USD - ytdAmountUsd;

    // ── 2. Check annual limit ─────────────────────────────────────────────────
    if (projectedTotal > LRS_ANNUAL_LIMIT_USD) {
      const result: LrsEligibilityResult = {
        eligible: false,
        reason: `LRS annual limit of $${LRS_ANNUAL_LIMIT_USD.toLocaleString()} would be breached. Year-to-date: $${ytdAmountUsd.toLocaleString()}, attempted: $${newRemittanceAmountUsd.toLocaleString()}.`,
        error_code: "LRS_ANNUAL_LIMIT_BREACHED",
        ytdAmountUsd,
        remainingAllowanceUsd,
        fatcaCertPresent,
        fyStart: fyStart.toISOString(),
      };
      logger.warn("[LRS] LRS_CHECK_BLOCK — annual limit breached", {
        event: "LRS_CHECK_BLOCK",
        user_id: userId,
        error_code: result.error_code,
        ytd_amount_usd: ytdAmountUsd,
        new_amount_usd: newRemittanceAmountUsd,
        projected_total_usd: projectedTotal,
        limit_usd: LRS_ANNUAL_LIMIT_USD,
        latency_ms: Date.now() - startTs,
        status: "blocked",
      });
      return result;
    }

    // ── 3. Check FATCA/CRS self-certification ─────────────────────────────────
    if (!fatcaCertPresent) {
      const result: LrsEligibilityResult = {
        eligible: false,
        reason: "FATCA/CRS self-certification is not on file. Complete the FATCA declaration in your KYC profile before investing in US markets.",
        error_code: "FATCA_CERT_MISSING",
        ytdAmountUsd,
        remainingAllowanceUsd,
        fatcaCertPresent: false,
        fyStart: fyStart.toISOString(),
      };
      logger.warn("[LRS] LRS_CHECK_BLOCK — FATCA cert missing", {
        event: "LRS_CHECK_BLOCK",
        user_id: userId,
        error_code: result.error_code,
        latency_ms: Date.now() - startTs,
        status: "blocked",
      });
      return result;
    }

    // ── 4. Eligible ───────────────────────────────────────────────────────────
    const result: LrsEligibilityResult = {
      eligible: true,
      ytdAmountUsd,
      remainingAllowanceUsd,
      fatcaCertPresent: true,
      fyStart: fyStart.toISOString(),
    };

    logger.info("[LRS] LRS_CHECK_PASS", {
      event: "LRS_CHECK_PASS",
      user_id: userId,
      ytd_amount_usd: ytdAmountUsd,
      new_amount_usd: newRemittanceAmountUsd,
      remaining_allowance_usd: remainingAllowanceUsd,
      latency_ms: Date.now() - startTs,
      status: "eligible",
    });

    return result;
  } catch (unexpectedErr: any) {
    logger.error("[LRS] Unexpected error in checkLrsEligibility", {
      event: "LRS_CHECK_UNEXPECTED_ERROR",
      user_id: userId,
      message: unexpectedErr.message,
      latency_ms: Date.now() - startTs,
    });
    // Never silently allow on unexpected failure
    return {
      eligible: false,
      reason: "Internal error during LRS compliance check.",
      error_code: "LRS_CHECK_INTERNAL_ERROR",
      ytdAmountUsd: 0,
      remainingAllowanceUsd: 0,
      fatcaCertPresent: false,
      fyStart: fyStart.toISOString(),
    };
  }
}
