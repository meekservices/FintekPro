import { logger } from "../logger";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getCurrentISTHour(): number {
	const now = new Date();
	const istTime = new Date(now.getTime() + IST_OFFSET_MS);
	return istTime.getUTCHours();
}

export function isProductionEnvironment(): boolean {
	return (
		process.env.NODE_ENV === "production" ||
		process.env.REPLIT_DEPLOYMENT === "1"
	);
}

/**
 * Returns true if the current IST time is within the allowed enrichment window:
 * 8:00 PM → 8:00 AM IST (20:00 – 07:59). This keeps heavy DB writes off-peak
 * and away from market hours (9:15 AM – 3:30 PM IST).
 */
export function isEnrichmentWindow(): boolean {
	const hour = getCurrentISTHour(); // 0–23
	// Allow: 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7
	return hour >= 20 || hour < 8;
}

export function shouldRunEnrichment(): boolean {
	return isProductionEnvironment();
}

export function getEnrichmentGuardReason(): string {
	if (!isProductionEnvironment()) {
		return `NODE_ENV=${process.env.NODE_ENV || "undefined"} (requires production)`;
	}
	if (!isEnrichmentWindow()) {
		const hour = getCurrentISTHour();
		return `Current IST hour: ${hour} (allowed: 8 PM - 8 AM IST only)`;
	}
	return "OK";
}

export function logEnrichmentSkip(serviceName: string): void {
	const reason = getEnrichmentGuardReason();
	logger.info(`⏭️ [${serviceName}] Skipped - ${reason}`);
}
