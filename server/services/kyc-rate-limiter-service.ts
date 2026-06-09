import { db } from "../db";
import { kycRateLimitCounters } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

interface RateLimitConfig {
	limitType: string;
	identifierType: "user" | "agent" | "ip";
	maxAllowed: number;
	windowMinutes: number;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
	aadhaar_otp: {
		limitType: "aadhaar_otp",
		identifierType: "user",
		maxAllowed: 5,
		windowMinutes: 1440,
	},
	pan_verify: {
		limitType: "pan_verify",
		identifierType: "agent",
		maxAllowed: 20,
		windowMinutes: 1440,
	},
	ckyc_lookup: {
		limitType: "ckyc_lookup",
		identifierType: "ip",
		maxAllowed: 50,
		windowMinutes: 1440,
	},
	aml_check: {
		limitType: "aml_check",
		identifierType: "user",
		maxAllowed: 10,
		windowMinutes: 1440,
	},
	// ── Re-KYC limits (per calendar year) ─────────────────────────────────────
	rekyc_attempt_user: {
		limitType: "rekyc_attempt_user",
		identifierType: "user",
		maxAllowed: 3,
		windowMinutes: 365 * 24 * 60, // 365 days rolling
	},
	rekyc_attempt_partner: {
		limitType: "rekyc_attempt_partner",
		identifierType: "user",
		maxAllowed: 2,
		windowMinutes: 365 * 24 * 60, // 365 days rolling
	},
	// ── Business entity verification limits ───────────────────────────────────
	gstin_verify: {
		limitType: "gstin_verify",
		identifierType: "user",
		maxAllowed: 5,
		windowMinutes: 1440,
	},
	mca_lookup: {
		limitType: "mca_lookup",
		identifierType: "user",
		maxAllowed: 5,
		windowMinutes: 1440,
	},
};

class KycRateLimiterService {
	constructor() {
		console.log("✅ KYC Rate Limiter Service initialized");
		console.log(
			`   Limits: Aadhaar OTP ${RATE_LIMIT_CONFIGS.aadhaar_otp.maxAllowed}/day/user, PAN ${RATE_LIMIT_CONFIGS.pan_verify.maxAllowed}/day/agent, CKYC ${RATE_LIMIT_CONFIGS.ckyc_lookup.maxAllowed}/day/IP`,
		);
	}

	private getWindowBounds(windowMinutes: number): {
		windowStart: Date;
		windowEnd: Date;
	} {
		const now = new Date();
		const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
		const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);
		return { windowStart, windowEnd };
	}

	async checkLimit(
		action: string,
		identifier: string,
	): Promise<{
		allowed: boolean;
		remaining: number;
		resetAt: Date;
		isLocked: boolean;
		lockReason?: string;
	}> {
		const config = RATE_LIMIT_CONFIGS[action];
		if (!config) {
			return {
				allowed: true,
				remaining: 999,
				resetAt: new Date(),
				isLocked: false,
			};
		}

		const limitKey = `${config.limitType}:${identifier}`;
		const { windowStart, windowEnd } = this.getWindowBounds(
			config.windowMinutes,
		);

		try {
			const existing = await db
				.select()
				.from(kycRateLimitCounters)
				.where(
					and(
						eq(kycRateLimitCounters.limitKey, limitKey),
						gte(kycRateLimitCounters.windowEnd, new Date()),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				const counter = existing[0];

				if (counter.isLocked) {
					return {
						allowed: false,
						remaining: 0,
						resetAt: counter.windowEnd,
						isLocked: true,
						lockReason:
							counter.lockedReason || "Rate limit exceeded - account locked",
					};
				}

				const currentCount = counter.count;
				const remaining = Math.max(0, config.maxAllowed - currentCount);

				if (currentCount >= config.maxAllowed) {
					await db
						.update(kycRateLimitCounters)
						.set({
							isLocked: true,
							lockedAt: new Date(),
							lockedReason: `Exceeded ${config.maxAllowed} ${action} attempts in ${config.windowMinutes} minutes`,
						})
						.where(eq(kycRateLimitCounters.id, counter.id));

					return {
						allowed: false,
						remaining: 0,
						resetAt: counter.windowEnd,
						isLocked: true,
						lockReason: `Rate limit exceeded: ${config.maxAllowed} ${action} attempts per day`,
					};
				}

				return {
					allowed: true,
					remaining,
					resetAt: counter.windowEnd,
					isLocked: false,
				};
			}

			return {
				allowed: true,
				remaining: config.maxAllowed,
				resetAt: windowEnd,
				isLocked: false,
			};
		} catch (error) {
			console.error(
				`[RateLimiter] Error checking limit for ${limitKey}:`,
				error,
			);
			return {
				allowed: true,
				remaining: config.maxAllowed,
				resetAt: new Date(),
				isLocked: false,
			};
		}
	}

	async incrementCounter(action: string, identifier: string): Promise<void> {
		const config = RATE_LIMIT_CONFIGS[action];
		if (!config) return;

		const limitKey = `${config.limitType}:${identifier}`;
		const { windowStart, windowEnd } = this.getWindowBounds(
			config.windowMinutes,
		);

		try {
			const existing = await db
				.select()
				.from(kycRateLimitCounters)
				.where(
					and(
						eq(kycRateLimitCounters.limitKey, limitKey),
						gte(kycRateLimitCounters.windowEnd, new Date()),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(kycRateLimitCounters)
					.set({ count: existing[0].count + 1 })
					.where(eq(kycRateLimitCounters.id, existing[0].id));
			} else {
				await db.insert(kycRateLimitCounters).values({
					limitKey,
					limitType: config.limitType,
					identifierType: config.identifierType,
					identifier,
					windowStart: new Date(),
					windowEnd,
					count: 1,
					maxAllowed: config.maxAllowed,
				});
			}
		} catch (error) {
			console.error(
				`[RateLimiter] Error incrementing counter for ${limitKey}:`,
				error,
			);
		}
	}

	async adminUnlock(
		action: string,
		identifier: string,
		adminId: string,
	): Promise<boolean> {
		const config = RATE_LIMIT_CONFIGS[action];
		if (!config) return false;

		const limitKey = `${config.limitType}:${identifier}`;

		try {
			const result = await db
				.update(kycRateLimitCounters)
				.set({
					isLocked: false,
					lockedAt: null,
					lockedReason: `Unlocked by admin ${adminId} at ${new Date().toISOString()}`,
					count: 0,
				})
				.where(eq(kycRateLimitCounters.limitKey, limitKey));

			return true;
		} catch (error) {
			console.error(`[RateLimiter] Error unlocking ${limitKey}:`, error);
			return false;
		}
	}

	async getCounterStatus(
		action: string,
		identifier: string,
	): Promise<{
		count: number;
		maxAllowed: number;
		isLocked: boolean;
		windowEnd: Date | null;
	}> {
		const config = RATE_LIMIT_CONFIGS[action];
		if (!config)
			return { count: 0, maxAllowed: 0, isLocked: false, windowEnd: null };

		const limitKey = `${config.limitType}:${identifier}`;

		try {
			const existing = await db
				.select()
				.from(kycRateLimitCounters)
				.where(
					and(
						eq(kycRateLimitCounters.limitKey, limitKey),
						gte(kycRateLimitCounters.windowEnd, new Date()),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				return {
					count: existing[0].count,
					maxAllowed: config.maxAllowed,
					isLocked: existing[0].isLocked ?? false,
					windowEnd: existing[0].windowEnd,
				};
			}

			return {
				count: 0,
				maxAllowed: config.maxAllowed,
				isLocked: false,
				windowEnd: null,
			};
		} catch (error) {
			return {
				count: 0,
				maxAllowed: config.maxAllowed,
				isLocked: false,
				windowEnd: null,
			};
		}
	}

	getConfig(action: string): RateLimitConfig | undefined {
		return RATE_LIMIT_CONFIGS[action];
	}
}

export const kycRateLimiterService = new KycRateLimiterService();
