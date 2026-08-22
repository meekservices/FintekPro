import { BigQuery } from "@google-cloud/bigquery";
import { logger } from "../../logger";

// ─── Constants ───────────────────────────────────────────────────────────────
const BQ_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "fintekpro";
const BQ_DATASET = "audit_logs";
const BQ_TABLE = "events";
const AUDIT_ENGINE_VERSION = "1.0.0";
const MAX_RETRIES = 3;

// ─── BigQuery client (lazy-initialized, singleton) ────────────────────────────
let _bqClient: BigQuery | null = null;
function getBQClient(): BigQuery {
	if (!_bqClient) {
		_bqClient = new BigQuery({ projectId: BQ_PROJECT });
	}
	return _bqClient;
}

// ─── Audit Event Types ────────────────────────────────────────────────────────
export enum AuditEventType {
	USER_LOGIN = "USER_LOGIN",
	USER_LOGOUT = "USER_LOGOUT",
	KYC_SUBMITTED = "KYC_SUBMITTED",
	KYC_APPROVED = "KYC_APPROVED",
	KYC_REJECTED = "KYC_REJECTED",
	TRADE_EXECUTED = "TRADE_EXECUTED",
	TRADE_REJECTED = "TRADE_REJECTED",
	PORTFOLIO_SYNC = "PORTFOLIO_SYNC",
	RISK_PROFILE_UPDATED = "RISK_PROFILE_UPDATED",
	ADMIN_ACTION = "ADMIN_ACTION",
	AI_ADVICE_GENERATED = "AI_ADVICE_GENERATED",
	PAYMENT_INITIATED = "PAYMENT_INITIATED",
	PAYMENT_COMPLETED = "PAYMENT_COMPLETED",
	DATA_EXPORT = "DATA_EXPORT",
}

// ─── Row shape matching BigQuery table schema ─────────────────────────────────
interface AuditRow {
	timestamp: string; // TIMESTAMP (ISO-8601)
	event: string;
	user_id: string;
	advisor_id: string | null;
	action: string;
	resource: string;
	ip_address: string;
	latency_ms: number;
	status: string;
	metadata: string; // JSON string → BQ JSON column
}

// ─── AuditLogger ─────────────────────────────────────────────────────────────
export class AuditLogger {
	/**
	 * Logs an immutable SEBI-compliant audit record.
	 *
	 * Strategy: dual-write
	 *   1. Synchronously emit structured log (Cloud Logging) — never fails silently
	 *   2. Asynchronously insert into BigQuery with 3-retry exponential backoff
	 *
	 * @param eventType - Categorised audit event type
	 * @param userId    - The acting user's ID (masked in logs, raw in BQ)
	 * @param metadata  - Arbitrary context dict (PII must be pre-masked by caller)
	 * @param options   - Optional: advisorId, resourceId, ipAddress, latencyMs, status
	 */
	async logEvent(
		eventType: AuditEventType,
		userId: string,
		metadata: Record<string, unknown>,
		options: {
			advisorId?: string;
			resourceId?: string;
			ipAddress?: string;
			latencyMs?: number;
			status?: "SUCCESS" | "FAILURE" | "PENDING";
		} = {},
	): Promise<void> {
		const {
			advisorId = null,
			resourceId = eventType,
			ipAddress = "SYSTEM",
			latencyMs = 0,
			status = "SUCCESS",
		} = options;

		const row: AuditRow = {
			timestamp: new Date().toISOString(),
			event: eventType,
			user_id: userId,
			advisor_id: advisorId,
			action: eventType,
			resource: resourceId,
			ip_address: ipAddress,
			latency_ms: latencyMs,
			status,
			metadata: JSON.stringify({
				...metadata,
				engine_version: AUDIT_ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
			}),
		};

		// ── 1. Synchronous structured log (guaranteed delivery via Cloud Logging) ──
		logger.info("[AUDIT]", {
			event: eventType,
			user_id: userId.slice(0, 8) + "****", // Mask in logs per SEBI PII rules
			advisor_id: advisorId,
			resource: resourceId,
			status,
			latency_ms: latencyMs,
			engine_version: AUDIT_ENGINE_VERSION,
		});

		// ── 2. Async BigQuery insert (non-blocking, with retry) ────────────────────
		this._insertToBigQueryWithRetry(row).catch((err) => {
			logger.error("[AUDIT_BQ_FAILURE] Failed to write audit event to BigQuery after retries", {
				error_code: "AUDIT_BQ_WRITE_FAILED",
				message: err.message,
				retryable: false,
				event: eventType,
				user_id: userId.slice(0, 8) + "****",
			});
		});
	}

	/**
	 * Inserts a row into BigQuery with exponential backoff retry.
	 * Retries up to MAX_RETRIES times on transient failures.
	 */
	private async _insertToBigQueryWithRetry(row: AuditRow, attempt = 1): Promise<void> {
		try {
			const bq = getBQClient();
			await bq
				.dataset(BQ_DATASET)
				.table(BQ_TABLE)
				.insert([row], { skipInvalidRows: false, ignoreUnknownValues: false });
		} catch (err: any) {
			const isTransient =
				err.code === 503 ||
				err.code === 429 ||
				(err.message && err.message.includes("UNAVAILABLE"));

			if (isTransient && attempt < MAX_RETRIES) {
				const backoffMs = Math.pow(2, attempt) * 200; // 400ms, 800ms, 1600ms
				await new Promise((r) => setTimeout(r, backoffMs));
				return this._insertToBigQueryWithRetry(row, attempt + 1);
			}
			throw err;
		}
	}
}

export const auditLogger = new AuditLogger();
