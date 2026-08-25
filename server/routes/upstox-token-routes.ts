/**
 * upstox-token-routes.ts
 *
 * Admin API for accepting and rotating the Upstox Access Token.
 *
 * Purpose:
 *   Provides a secure admin UI-driven flow to:
 *     1. Accept a new Upstox access token (pasted from the Upstox Developer Portal)
 *     2. Validate the token against the Upstox API (probe call)
 *     3. Update the GCP Secret Manager secret (UPSTOX_ACCESS_TOKEN)
 *     4. Hot-reload the service singleton in-process
 *     5. Update the Cloud Run service env vars (triggers a new revision)
 *
 * Security:
 *   - Admin-only: requireAdmin middleware (same as system-admin.ts)
 *   - Token is never logged — only length and first/last 4 chars
 *   - Idempotent: safe to call multiple times
 *
 * GCR v1.0 Compliance:
 *   - Structured logs: { event, user_id, latency_ms, status }
 *   - Errors: { error_code, message, retryable }
 *   - Supports safe retry (idempotency: same token → same result)
 *
 * @module upstox-token-routes
 */

import type { Express } from "express";
import axios from "axios";
import { adminService } from "../admin-service";
import { logger } from "../logger";
import { upstoxMarketDataService } from "../services/upstox-market-data-service";

// ── Auth Guard ─────────────────────────────────────────────────────────────────

async function requireAdmin(req: any, res: any, next: any) {
	if (!req.user)
		return res.status(401).json({ success: false, message: "Authentication required" });
	const isAdmin = await adminService.isAdmin(req.user.id);
	if (!isAdmin)
		return res.status(403).json({ success: false, message: "Admin access required" });
	next();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Mask token: show first 4 + last 4 chars only */
function maskToken(token: string): string {
	if (token.length <= 8) return "****";
	return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/** Validate token with a live Upstox probe call (RELIANCE LTP) */
async function validateUpstoxToken(token: string): Promise<{
	valid: boolean;
	error?: string;
}> {
	try {
		const res = await axios.get("https://api.upstox.com/v2/market-quote/ltp", {
			params: { instrument_key: "NSE_EQ|RELIANCE" },
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				"Api-Version": "2.0",
			},
			timeout: 8_000,
		});
		const price = res.data?.data?.["NSE_EQ|RELIANCE"]?.last_price;
		if (!price) {
			return { valid: false, error: "Token validated but no price data returned" };
		}
		return { valid: true };
	} catch (err: any) {
		const status = err?.response?.status;
		if (status === 401) return { valid: false, error: "Invalid or expired token (401)" };
		if (status === 429) return { valid: false, error: "Rate limited — token is valid but try again in 60s" };
		return { valid: false, error: err?.message ?? "Unknown error during token validation" };
	}
}

/** Update GCP Secret Manager secret with new token value */
async function updateGcpSecret(
	project: string,
	secretName: string,
	value: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const { execSync } = await import("child_process");
		// Write new version to secret manager
		const encoded = Buffer.from(value).toString("base64");
		execSync(
			`echo "${encoded}" | base64 -d | gcloud secrets versions add ${secretName} --data-file=- --project=${project}`,
			{ stdio: "pipe", timeout: 15_000 },
		);
		return { success: true };
	} catch (err: any) {
		return { success: false, error: err?.stderr?.toString() ?? err?.message ?? "gcloud command failed" };
	}
}

/** Hot-reload Upstox service singleton in-process using the public API */
function hotReloadUpstoxService(token: string, issuedAt: string): void {
	upstoxMarketDataService.hotReload(token, issuedAt);
}

// ── Route Registration ─────────────────────────────────────────────────────────

export function registerUpstoxTokenRoutes(app: Express): void {

	// ── GET  /api/admin/upstox/token-status ───────────────────────────────────
	// Returns current token health (configured, days since issued, expired-since)

	app.get("/api/admin/upstox/token-status", requireAdmin, (_req, res) => {
		try {
			const health = upstoxMarketDataService.getTokenHealth();
			const maskedToken = process.env.UPSTOX_ACCESS_TOKEN
				? maskToken(process.env.UPSTOX_ACCESS_TOKEN)
				: null;

			res.json({
				success: true,
				data: {
					configured: health.configured,
					maskedToken,
					daysSinceIssued: health.daysSinceIssued,
					issuedAt: process.env.UPSTOX_TOKEN_ISSUED_AT ?? null,
					expiredSince: health.expiredSince,
					status: !health.configured
						? "NOT_CONFIGURED"
						: health.expiredSince
							? "EXPIRED"
							: health.daysSinceIssued !== null && health.daysSinceIssued > 335
								? "EXPIRING_SOON"
								: "HEALTHY",
					daysUntilExpiry: health.daysSinceIssued !== null
						? Math.max(0, 365 - health.daysSinceIssued)
						: null,
				},
				meta: { timestamp: new Date().toISOString(), version: "upstox-token-routes@1.0.0" },
			});
		} catch (err) {
			logger.error("[UpstoxToken] Failed to get token status", { error: String(err) });
			res.status(500).json({ success: false, message: "Failed to get token status" });
		}
	});

	// ── POST /api/admin/upstox/validate-token ─────────────────────────────────
	// Validates a token WITHOUT storing it — let admin verify before committing

	app.post("/api/admin/upstox/validate-token", requireAdmin, async (req, res) => {
		const t0 = Date.now();
		const { token } = req.body as { token?: string };

		if (!token || typeof token !== "string" || token.trim().length < 10) {
			return res.status(400).json({
				success: false,
				error: { error_code: "INVALID_TOKEN", message: "A valid token string is required", retryable: false },
			});
		}

		const trimmedToken = token.trim();

		logger.info("[UpstoxToken] Token validation requested", {
			event: "UPSTOX_TOKEN_VALIDATE_REQUEST",
			user_id: (req.user as any)?.id,
			masked_token: maskToken(trimmedToken),
		});

		const result = await validateUpstoxToken(trimmedToken);

		logger.info("[UpstoxToken] Token validation result", {
			event: "UPSTOX_TOKEN_VALIDATE_RESULT",
			user_id: (req.user as any)?.id,
			valid: result.valid,
			latency_ms: Date.now() - t0,
		});

		if (!result.valid) {
			return res.status(422).json({
				success: false,
				error: {
					error_code: "TOKEN_INVALID",
					message: result.error ?? "Token validation failed",
					retryable: false,
				},
				meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
			});
		}

		res.json({
			success: true,
			data: { valid: true, message: "Token validated — Upstox LTP probe successful" },
			meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
		});
	});

	// ── POST /api/admin/upstox/rotate-token ───────────────────────────────────
	// Full rotation flow:
	//   1. Validate token
	//   2. Update Secret Manager (UPSTOX_ACCESS_TOKEN)
	//   3. Hot-reload service singleton
	//   4. Update Cloud Run env vars (async, triggers new revision)

	app.post("/api/admin/upstox/rotate-token", requireAdmin, async (req, res) => {
		const t0 = Date.now();
		const { token, skipValidation = false } = req.body as {
			token?: string;
			skipValidation?: boolean;
		};

		if (!token || typeof token !== "string" || token.trim().length < 10) {
			return res.status(400).json({
				success: false,
				error: { error_code: "INVALID_TOKEN", message: "A valid token string is required", retryable: false },
			});
		}

		const trimmedToken = token.trim();
		const issuedAt = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

		logger.info("[UpstoxToken] Token rotation initiated", {
			event: "UPSTOX_TOKEN_ROTATE_START",
			user_id: (req.user as any)?.id,
			masked_token: maskToken(trimmedToken),
			status: "PENDING",
		});

		const steps: string[] = [];

		// ── Step 1: Validate ─────────────────────────────────────────────────
		if (!skipValidation) {
			const validationResult = await validateUpstoxToken(trimmedToken);
			if (!validationResult.valid) {
				return res.status(422).json({
					success: false,
					error: {
						error_code: "TOKEN_VALIDATION_FAILED",
						message: validationResult.error ?? "Token did not pass validation",
						retryable: false,
					},
					meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
				});
			}
			steps.push("✅ Token validated via Upstox LTP probe");
		} else {
			steps.push("⚠️ Validation skipped by admin");
		}

		// ── Step 2: Update Secret Manager ────────────────────────────────────
		const gcpProject = process.env.GOOGLE_CLOUD_PROJECT ?? "fintekpro";
		const secretResult = await updateGcpSecret(gcpProject, "UPSTOX_ACCESS_TOKEN", trimmedToken);
		if (secretResult.success) {
			steps.push("✅ Secret Manager updated (UPSTOX_ACCESS_TOKEN)");
		} else {
			steps.push(`⚠️ Secret Manager update failed: ${secretResult.error} — continuing with hot-reload only`);
		}

		// Also update issued-at secret
		await updateGcpSecret(gcpProject, "UPSTOX_TOKEN_ISSUED_AT", issuedAt).catch(() => {/* non-critical */});

		// ── Step 3: Hot-reload service in-process ─────────────────────────────
		hotReloadUpstoxService(trimmedToken, issuedAt);
		steps.push("✅ Upstox service hot-reloaded (in-process, immediate effect)");

		// ── Step 4: Update Cloud Run env vars (async — does not block response) ─
		const deployCmd =
			`gcloud run services update fintekpro-app ` +
			`--region=asia-south1 ` +
			`--project=${gcpProject} ` +
			`--update-env-vars=UPSTOX_TOKEN_ISSUED_AT=${issuedAt}`;

		const { exec } = await import("child_process");
		exec(deployCmd, { timeout: 120_000 }, (err) => {
			if (err) {
				logger.warn("[UpstoxToken] Cloud Run update failed (token already hot-reloaded)", {
					event: "UPSTOX_CLOUDRUN_UPDATE_FAILED",
					error: err.message,
					status: "WARNING",
				});
			} else {
				logger.info("[UpstoxToken] Cloud Run env vars updated", {
					event: "UPSTOX_CLOUDRUN_UPDATE_SUCCESS",
					status: "SUCCESS",
				});
			}
		});
		steps.push("🔄 Cloud Run env update triggered (async — new revision will start momentarily)");

		logger.info("[UpstoxToken] Token rotation complete", {
			event: "UPSTOX_TOKEN_ROTATE_SUCCESS",
			user_id: (req.user as any)?.id,
			issued_at: issuedAt,
			masked_token: maskToken(trimmedToken),
			latency_ms: Date.now() - t0,
			status: "SUCCESS",
		});

		res.json({
			success: true,
			data: {
				message: "Upstox token rotated successfully",
				issuedAt,
				maskedToken: maskToken(trimmedToken),
				steps,
				note: "Market data is live immediately. Cloud Run will deploy a new revision in ~60s.",
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "upstox-token-routes@1.0.0",
				latency_ms: Date.now() - t0,
			},
		});
	});
}
