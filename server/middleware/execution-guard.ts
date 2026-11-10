/* eslint-disable no-console */
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import * as globalAdvisoryService from "../services/global-advisory-service";

interface IdempotencyRecord {
	timestamp: number;
	result: any;
	payloadHash?: string;
}

const processedIdempotencyKeys = new Map<string, IdempotencyRecord>();
const inFlightIdempotencyKeys = new Set<string>();
const recentSubmissions = new Map<string, number>();

const IDEMPOTENCY_KEY_TTL = 24 * 60 * 60 * 1000;
const DEBOUNCE_WINDOW_MS = 3000;

setInterval(
	() => {
		const now = Date.now();
		const entries = Array.from(processedIdempotencyKeys.entries());
		for (const [key, value] of entries) {
			if (now - value.timestamp > IDEMPOTENCY_KEY_TTL) {
				processedIdempotencyKeys.delete(key);
			}
		}
		// Clean up recent submission fingerprints (>30s)
		for (const [key, ts] of recentSubmissions.entries()) {
			if (now - ts > 30000) {
				recentSubmissions.delete(key);
			}
		}
	},
	60 * 60 * 1000,
);

/**
 * Computes a deterministic short SHA-256 fingerprint of the request payload.
 */
function computePayloadHash(body: any): string {
	if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
		return "empty";
	}
	try {
		return crypto
			.createHash("sha256")
			.update(JSON.stringify(body))
			.digest("hex")
			.slice(0, 32);
	} catch {
		return "unhashable";
	}
}

/**
 * Scans payload for malicious or invalid inputs (prototype pollution, null bytes).
 */
function validatePayloadSanity(obj: any, depth = 0): { valid: boolean; reason?: string } {
	if (!obj || typeof obj !== "object") return { valid: true };
	if (depth > 12) return { valid: false, reason: "Payload nesting depth exceeds limit" };

	for (const key of Object.keys(obj)) {
		if (key === "__proto__" || key === "constructor" || key === "prototype") {
			return { valid: false, reason: `Forbidden prototype property '${key}'` };
		}
		const val = obj[key];
		if (typeof val === "string" && val.includes("\0")) {
			return { valid: false, reason: `Null byte detected in field '${key}'` };
		}
		if (typeof val === "number" && (Number.isNaN(val) || !Number.isFinite(val))) {
			return { valid: false, reason: `Invalid numeric value (NaN/Infinity) in field '${key}'` };
		}
		if (typeof val === "object" && val !== null) {
			const nested = validatePayloadSanity(val, depth + 1);
			if (!nested.valid) return nested;
		}
	}
	return { valid: true };
}

const EXECUTION_ENDPOINTS = [
	"/api/orders",
	"/api/trade",
	"/api/execute",
	"/api/payment",
	"/api/payments",
	"/api/consent",
	"/api/submit",
	"/api/transactions",
	"/api/kyc/submit",
	"/api/bonds/order",
	"/api/bonds/orders",
	"/api/mutual-funds/order",
	"/api/mutual-funds/orders",
	"/api/mf/orders",
	"/api/stocks/order",
	"/api/stocks/orders",
	"/api/us-trading/order",
	"/api/cart/checkout",
];

function isExecutionEndpoint(path: string): boolean {
	return EXECUTION_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
}

export interface ExecutionGuardOptions {
	requireNetworkHeader?: boolean;
	logExecution?: boolean;
	blockOfflineExecution?: boolean;
}

export function executionGuard(options: ExecutionGuardOptions = {}) {
	const {
		requireNetworkHeader = true,
		logExecution = true,
		blockOfflineExecution = true,
	} = options;

	return async (req: Request, res: Response, next: NextFunction) => {
		if (
			req.method === "GET" ||
			req.method === "HEAD" ||
			req.method === "OPTIONS"
		) {
			return next();
		}

		if (!isExecutionEndpoint(req.path)) {
			return next();
		}

		const networkState = req.headers["x-network-state"] as string;
		const idempotencyKey = req.headers["x-idempotency-key"] as string;
		const queuedAt = req.headers["x-queued-at"] as string;

		const executionId = uuidv4();
		(req as any).executionId = executionId;

		if (logExecution) {
			console.log(`[EXECUTION_GUARD] ${req.method} ${req.path}`, {
				executionId,
				userId: (req as any).user?.id,
				networkState: networkState || "unknown",
				idempotencyKey: idempotencyKey || "none",
				queuedAt: queuedAt || "immediate",
				ip: req.ip,
				userAgent: req.headers["user-agent"],
				timestamp: new Date().toISOString(),
			});
		}

		if (
			blockOfflineExecution &&
			(networkState === "offline" || networkState === "slow")
		) {
			const isOffline = networkState === "offline";
			console.warn(
				`[EXECUTION_GUARD] BLOCKED ${networkState} execution: ${req.path}`,
				{
					executionId,
					userId: (req as any).user?.id,
					networkState,
				},
			);

			return res.status(400).json({
				success: false,
				error: isOffline
					? "OFFLINE_EXECUTION_BLOCKED"
					: "SLOW_NETWORK_EXECUTION_BLOCKED",
				message: isOffline
					? "This action cannot be executed offline. Please ensure you have an active internet connection."
					: "This action cannot be executed on a slow network. Please wait for a stable connection to ensure transaction integrity.",
				executionId,
				code: "NETWORK_REQUIRED",
				networkState,
			});
		}

		// Guardrail 1: Input payload sanity validation (anti-poisoning & anti-tampering)
		const sanityCheck = validatePayloadSanity(req.body);
		if (!sanityCheck.valid) {
			console.warn(`[EXECUTION_GUARD] Rejected malformed payload on ${req.path}: ${sanityCheck.reason}`);
			return res.status(400).json({
				success: false,
				error: "MALFORMED_PAYLOAD_BLOCKED",
				message: `Invalid request payload: ${sanityCheck.reason}`,
				executionId,
			});
		}

		const currentPayloadHash = computePayloadHash(req.body);

		// Guardrail 2: Explicit Idempotency Key Handling with In-Flight Locking & Payload Verification
		if (idempotencyKey) {
			// Tier 1: In-memory L1 cache
			let existing = processedIdempotencyKeys.get(idempotencyKey);

			// Tier 2: Distributed L2 Redis cache (multi-pod Cloud Run idempotency)
			if (!existing) {
				try {
					const { getSharedRedis } = await import("../utils/redis-client");
					const redis = await getSharedRedis();
					if (redis?.isOpen) {
						const raw = await redis.get(`idempotency:${idempotencyKey}`);
						if (raw) {
							existing = JSON.parse(raw);
							if (existing) {
								processedIdempotencyKeys.set(idempotencyKey, existing);
							}
						}
					}
				} catch {
					// Fall through to standard processing
				}
			}

			if (existing) {
				// Guardrail 2a: Verify that payload matches the original submission
				if (existing.payloadHash && existing.payloadHash !== "empty" && existing.payloadHash !== currentPayloadHash) {
					console.warn(
						`[EXECUTION_GUARD] Idempotency payload mismatch for key: ${idempotencyKey}`,
						{ originalHash: existing.payloadHash, newHash: currentPayloadHash }
					);
					return res.status(422).json({
						success: false,
						error: "IDEMPOTENCY_PAYLOAD_MISMATCH",
						message: "An idempotency key cannot be reused with a different request payload.",
						executionId,
						idempotencyKey,
					});
				}

				console.log(
					`[EXECUTION_GUARD] Duplicate idempotency key detected: ${idempotencyKey}`,
					{
						executionId,
						originalTimestamp: new Date(existing.timestamp).toISOString(),
					},
				);

				return res.status(200).json({
					...existing.result,
					idempotent: true,
					originalExecutionTime: new Date(existing.timestamp).toISOString(),
				});
			}

			// Guardrail 2b: In-Flight Lock (Mutual Exclusion) to prevent concurrent race conditions
			let redisLockAcquired = false;
			try {
				const { getSharedRedis } = await import("../utils/redis-client");
				const redis = await getSharedRedis();
				if (redis?.isOpen) {
					// Redis distributed lock with 60-second automatic lease expiration
					const lockResult = await redis.set(`idempotency:lock:${idempotencyKey}`, executionId, {
						NX: true,
						EX: 60,
					});
					redisLockAcquired = lockResult === "OK";
				} else {
					redisLockAcquired = !inFlightIdempotencyKeys.has(idempotencyKey);
				}
			} catch {
				redisLockAcquired = !inFlightIdempotencyKeys.has(idempotencyKey);
			}

			if (!redisLockAcquired || inFlightIdempotencyKeys.has(idempotencyKey)) {
				console.warn(`[EXECUTION_GUARD] Concurrent request in-flight for key: ${idempotencyKey}`);
				return res.status(409).json({
					success: false,
					error: "CONCURRENT_REQUEST_IN_FLIGHT",
					message: "A transaction with this idempotency key is currently being processed. Please wait.",
					executionId,
					idempotencyKey,
				});
			}

			// Acquire L1 in-flight marker
			inFlightIdempotencyKeys.add(idempotencyKey);

			// Release lock helper
			const releaseInFlightLock = async () => {
				inFlightIdempotencyKeys.delete(idempotencyKey);
				try {
					const { getSharedRedis } = await import("../utils/redis-client");
					const redis = await getSharedRedis();
					if (redis?.isOpen) {
						await redis.del(`idempotency:lock:${idempotencyKey}`);
					}
				} catch {}
			};

			const originalJson = res.json.bind(res);
			res.json = (body: any) => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					const record: IdempotencyRecord = {
						timestamp: Date.now(),
						result: body,
						payloadHash: currentPayloadHash,
					};
					processedIdempotencyKeys.set(idempotencyKey, record);

					// Asynchronously persist to Redis with 24-hour TTL
					import("../utils/redis-client")
						.then(({ getSharedRedis }) => getSharedRedis())
						.then((redis) => {
							if (redis?.isOpen) {
								return redis.setEx(
									`idempotency:${idempotencyKey}`,
									86400,
									JSON.stringify(record),
								);
							}
						})
						.catch(() => {});
				}
				void releaseInFlightLock();
				return originalJson(body);
			};

			res.on("close", () => {
				void releaseInFlightLock();
			});
		} else {
			// Guardrail 3: Double-Click / Rapid Multi-Submission Debounce Guard
			// Applied to mutating financial execution endpoints without explicit idempotency key
			const userId = (req as any).user?.id || req.ip;
			const submissionFingerprint = `${userId}:${req.method}:${req.path}:${currentPayloadHash}`;
			const lastSeen = recentSubmissions.get(submissionFingerprint);
			const now = Date.now();

			if (lastSeen && now - lastSeen < DEBOUNCE_WINDOW_MS) {
				console.warn(`[EXECUTION_GUARD] Blocked duplicate rapid submission: ${submissionFingerprint}`);
				return res.status(429).json({
					success: false,
					error: "DUPLICATE_SUBMISSION_BLOCKED",
					message: "Duplicate transaction submission detected. Please do not double-click or resubmit identical requests within 3 seconds.",
					code: "DUPLICATE_REQUEST",
					executionId,
				});
			}

			recentSubmissions.set(submissionFingerprint, now);
		}

		res.on("finish", () => {
			if (logExecution) {
				console.log(`[EXECUTION_GUARD] Completed ${req.method} ${req.path}`, {
					executionId,
					statusCode: res.statusCode,
					userId: (req as any).user?.id,
				});
			}
		});

		next();
	};
}

export function auditLog(
	action: string,
	details: Record<string, any>,
	req: Request,
) {
	const logEntry = {
		timestamp: new Date().toISOString(),
		action,
		executionId: (req as any).executionId,
		userId: (req as any).user?.id,
		userRole: (req as any).user?.role,
		ip: req.ip,
		userAgent: req.headers["user-agent"],
		networkState: req.headers["x-network-state"] || "unknown",
		...details,
	};

	console.log("[AUDIT]", JSON.stringify(logEntry));

	return logEntry;
}

export function requireOnline(req: Request, res: Response, next: NextFunction) {
	const networkState = req.headers["x-network-state"] as string;

	if (networkState === "offline") {
		return res.status(400).json({
			success: false,
			error: "NETWORK_REQUIRED",
			message: "This action requires an active internet connection.",
		});
	}

	next();
}

export function requireIdempotencyKey(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (
		req.method === "GET" ||
		req.method === "HEAD" ||
		req.method === "OPTIONS"
	) {
		return next();
	}

	const idempotencyKey = req.headers["x-idempotency-key"] as string;

	if (!idempotencyKey) {
		return res.status(400).json({
			success: false,
			error: "IDEMPOTENCY_KEY_REQUIRED",
			message: "An idempotency key is required for this operation.",
		});
	}

	next();
}

// ============================================================================
// GLOBAL ADVISORY EXECUTION GUARDS
// Prevent execution of orders/trades outside of India (SEBI compliance)
// ============================================================================

export async function requireExecutionAllowedForMarket(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const marketCode =
			req.body?.marketCode ||
			req.query?.marketCode ||
			req.params?.marketCode ||
			"IN";

		const result = await globalAdvisoryService.canExecuteInMarket(marketCode);

		if (!result.canExecute) {
			await globalAdvisoryService.logAuditEvent(
				(req as any).user?.id || null,
				"execution_blocked",
				"guardrail_triggered",
				{
					marketCode,
					reason: result.reason,
					endpoint: req.path,
					method: req.method,
				},
				{
					marketCode,
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
					requestPath: req.path,
					advisoryClassification: "ANALYTICS_ONLY",
				},
			);

			return res.status(403).json({
				success: false,
				error: "EXECUTION_NOT_ALLOWED",
				message: result.reason || "Execution is not permitted for this market",
				marketCode,
				advisoryLevel: "ANALYTICS_ONLY",
				recommendation:
					"Please execute trades through your licensed broker for this market",
			});
		}

		next();
	} catch (error: any) {
		console.error("[ExecutionGuard:Market] Error:", error.message);
		return res.status(500).json({
			success: false,
			error: "EXECUTION_CHECK_FAILED",
			message: "Failed to verify execution permissions",
		});
	}
}

export function blockNonIndiaExecution(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const marketCode =
		req.body?.marketCode || req.query?.marketCode || req.params?.marketCode;

	if (marketCode && marketCode !== "IN") {
		console.warn(
			`[ExecutionGuard] BLOCKED non-India execution attempt: ${req.path}`,
			{
				marketCode,
				userId: (req as any).user?.id,
				ip: req.ip,
			},
		);

		return res.status(403).json({
			success: false,
			error: "EXECUTION_NOT_ALLOWED",
			message:
				"Order execution is only available for Indian markets. For international markets, please execute trades through your licensed broker.",
			marketCode,
			advisoryLevel: "ANALYTICS_ONLY",
		});
	}

	next();
}

export async function setGlobalAdvisoryHeaders(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const marketCode =
			req.body?.marketCode ||
			req.query?.marketCode ||
			req.params?.marketCode ||
			"IN";

		if (marketCode !== "IN") {
			const market = await globalAdvisoryService.getMarketByCode(marketCode);

			if (market) {
				res.setHeader("X-Advisory-Level", market.advisoryLevel);
				res.setHeader(
					"X-Execution-Allowed",
					(market.executionAllowed ?? false).toString(),
				);
				res.setHeader("X-Market-Code", marketCode);
				res.setHeader("X-Market-Name", market.marketName);
			}
		}

		next();
	} catch (error) {
		next();
	}
}
