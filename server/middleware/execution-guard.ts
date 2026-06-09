import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import * as globalAdvisoryService from "../services/global-advisory-service";

const processedIdempotencyKeys = new Map<
	string,
	{ timestamp: number; result: any }
>();

const IDEMPOTENCY_KEY_TTL = 24 * 60 * 60 * 1000;

setInterval(
	() => {
		const now = Date.now();
		const entries = Array.from(processedIdempotencyKeys.entries());
		for (const [key, value] of entries) {
			if (now - value.timestamp > IDEMPOTENCY_KEY_TTL) {
				processedIdempotencyKeys.delete(key);
			}
		}
	},
	60 * 60 * 1000,
);

const EXECUTION_ENDPOINTS = [
	"/api/orders",
	"/api/trade",
	"/api/execute",
	"/api/payment",
	"/api/consent",
	"/api/submit",
	"/api/transactions",
	"/api/kyc/submit",
	"/api/bonds/order",
	"/api/mutual-funds/order",
	"/api/stocks/order",
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

	return (req: Request, res: Response, next: NextFunction) => {
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

		if (idempotencyKey) {
			const existing = processedIdempotencyKeys.get(idempotencyKey);
			if (existing) {
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

			const originalJson = res.json.bind(res);
			res.json = (body: any) => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					processedIdempotencyKeys.set(idempotencyKey, {
						timestamp: Date.now(),
						result: body,
					});
				}
				return originalJson(body);
			};
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
