import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { logger } from "../logger";
import {
	b2bApiKeys,
	b2bClients,
	b2bApiUsageLogs,
} from "../../shared/schema/b2b";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

// Extends Express Request internally to map our B2B properties natively
export interface B2BRequest extends Request {
	b2bClient?: {
		id: string;
		companyName: string;
		tier: string;
		webhookUrl: string | null;
		governanceMode: string;
	};
}

/**
 * High-Speed API Key validation using SHA-256 abstractions rather than expensive bcrypt iterations.
 * Secures the White-Label PaaS boundary.
 */
export async function b2bAuthMiddleware(
	req: B2BRequest,
	res: Response,
	next: NextFunction,
) {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res
			.status(401)
			.json({
				error:
					"Missing or invalid Authorization header. Expected 'Bearer <key>'",
			});
	}

	const rawKey = authHeader.split(" ")[1];

	// Hash the incoming raw key to match against the DB registry
	const hashedKey = createHash("sha256").update(rawKey).digest("hex");

	try {
		// Attempt rapid key resolution against Drizzle
		const [apiKeyRecord] = await db
			.select()
			.from(b2bApiKeys)
			.where(
				and(eq(b2bApiKeys.keyHash, hashedKey), eq(b2bApiKeys.isActive, true)),
			)
			.limit(1);

		if (!apiKeyRecord) {
			return res.status(401).json({ error: "Invalid API Key." });
		}

		if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
			return res.status(401).json({ error: "API Key expired." });
		}

		// Resolve specific Client context (Tenant isolation)
		const [clientRecord] = await db
			.select()
			.from(b2bClients)
			.where(
				and(
					eq(b2bClients.id, apiKeyRecord.clientId),
					eq(b2bClients.isActive, true),
				),
			)
			.limit(1);

		if (!clientRecord) {
			return res.status(403).json({ error: "Client Account Suspended." });
		}

		// Optional: IP Whitelisting Validation
		const requestIp = req.socket.remoteAddress || req.ip;
		if (clientRecord.allowedIps) {
			const allowedIpsArray = clientRecord.allowedIps as string[];
			if (
				allowedIpsArray.length > 0 &&
				requestIp &&
				!allowedIpsArray.includes(requestIp)
			) {
				return res
					.status(403)
					.json({ error: "IP Address not allowlisted for this API Key." });
			}
		}

		// Attach verified Tenant Context to Express Router payload
		req.b2bClient = {
			id: clientRecord.id,
			companyName: clientRecord.companyName,
			tier: clientRecord.tier || "standard",
			webhookUrl: clientRecord.webhookUrl,
			governanceMode: clientRecord.governanceMode || "STRICT",
		};

		// Bump "Last Used" async without blocking the REST pipeline
		db.update(b2bApiKeys)
			.set({ lastUsedAt: new Date() })
			.where(eq(b2bApiKeys.id, apiKeyRecord.id))
			.execute();

		next();
	} catch (error) {
		logger.error("[WFIA Auth Error]", { error });
		return res
			.status(500)
			.json({ error: "Internal Authentication Gateway Error" });
	}
}

import { consumeRateLimitToken } from "./distributed-rate-limiter";

export async function b2bRateLimiter(
	req: B2BRequest,
	res: Response,
	next: NextFunction,
) {
	if (!req.b2bClient) return res.status(401).json({ error: "Unauthorized." });

	const clientId = req.b2bClient.id;
	const tier = req.b2bClient.tier;

	// Rate matrix based on Contract mappings
	const REFILL_RATE_MS = 1000;
	const MAX_CAPACITY = tier === "enterprise" ? 50 : 10; // 50 requests/sec vs 10 requests/sec

	const limitResult = await consumeRateLimitToken(clientId, {
		keyPrefix: "b2b",
		maxCapacity: MAX_CAPACITY,
		refillRateMs: REFILL_RATE_MS,
	});

	if (limitResult.allowed) {
		res.setHeader("X-RateLimit-Remaining", limitResult.remaining);
		res.setHeader("X-RateLimit-Tier", limitResult.tier);
		return next();
	}

	// 429 Too Many Requests
	const trackingId = uuidv4();
	db.insert(b2bApiUsageLogs)
		.values({
			id: trackingId,
			clientId: clientId,
			endpoint: req.originalUrl,
			status: 429,
		})
		.execute()
		.catch(() => {});

	res.setHeader("Retry-After", Math.ceil(limitResult.retryAfterMs / 1000));
	return res.status(429).json({
		error: "Rate Limit Exceeded. Back off.",
		retryAfterMs: limitResult.retryAfterMs,
	});
}
