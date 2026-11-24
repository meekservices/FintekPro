import { db } from "../db";
import { errorLedger, errorAlertThreshold } from "../../shared/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";
import { errorWebhookService } from "./error-webhook-service";

interface SpikeCheckResult {
	isSpike: boolean;
	occurrenceCount: number;
	windowMinutes: number;
	threshold: number;
	shouldEscalate: boolean;
}

class ErrorSpikeDetectionService {
	private recentAlerts: Map<string, number> = new Map();
	private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000;

	async checkForSpike(
		errorCode: string,
		module: string,
	): Promise<SpikeCheckResult> {
		const thresholdConfig = await errorWebhookService.getThresholdConfig(
			module,
			errorCode,
		);

		const windowMinutes = thresholdConfig?.windowMinutes || 5;
		const occurrenceThreshold = thresholdConfig?.occurrenceThreshold || 10;
		const autoEscalate = thresholdConfig?.autoEscalateToCritical ?? true;

		const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

		try {
			const [result] = await db
				.select({ count: count() })
				.from(errorLedger)
				.where(
					and(
						eq(errorLedger.errorCode, errorCode),
						gte(errorLedger.lastOccurrence, windowStart),
					),
				);

			const occurrenceCount = result?.count || 0;
			const isSpike = occurrenceCount >= occurrenceThreshold;

			return {
				isSpike,
				occurrenceCount,
				windowMinutes,
				threshold: occurrenceThreshold,
				shouldEscalate: isSpike && autoEscalate,
			};
		} catch (error) {
			console.error("[SpikeDetection] Failed to check spike:", error);
			return {
				isSpike: false,
				occurrenceCount: 0,
				windowMinutes,
				threshold: occurrenceThreshold,
				shouldEscalate: false,
			};
		}
	}

	async handleErrorIngested(errorEntry: {
		id: string;
		errorCode: string;
		module: string;
		severity: string;
		message: string;
		environment?: string;
		clientId?: string;
		transactionId?: string;
	}): Promise<void> {
		// NOTE: Per-error critical alerts are handled by errorTrackingService.triggerCriticalAlert()
		// and the route's errorDigestService.sendCriticalAlert() (first occurrence only).
		// This service is only responsible for SPIKE detection alerts.

		const spikeResult = await this.checkForSpike(
			errorEntry.errorCode,
			errorEntry.module,
		);

		if (spikeResult.isSpike) {
			const alertKey = `${errorEntry.errorCode}_${errorEntry.module}`;
			const lastAlertTime = this.recentAlerts.get(alertKey);

			if (
				lastAlertTime &&
				Date.now() - lastAlertTime < this.ALERT_COOLDOWN_MS
			) {
				console.log(
					`[SpikeDetection] Spike alert for ${alertKey} still in cooldown`,
				);
				return;
			}

			this.recentAlerts.set(alertKey, Date.now());

			// Impact-aware escalation:
			// High-impact errors involve real user transactions, client sessions, or high-risk modules.
			// Background services (AIService rate limits, PythonClient sidecar fallback) that have
			// active graceful degradation should escalate to "high" or "warning", not "critical",
			// preventing alert fatigue on the operational incident dashboard.
			const isHighImpact =
				Boolean(errorEntry.clientId || errorEntry.transactionId) ||
				["order", "portfolio", "payment", "auth", "demat", "kyc"].some((m) =>
					errorEntry.module.toLowerCase().includes(m),
				);

			const isBackgroundDegraded =
				errorEntry.errorCode.startsWith("AI_PROVIDER_ERROR_") ||
				errorEntry.errorCode === "PYTHON_SERVICE_CALL_FAILED";

			if (spikeResult.shouldEscalate) {
				if (isHighImpact || !isBackgroundDegraded) {
					if (errorEntry.severity !== "critical") {
						await this.escalateErrorSeverity(errorEntry.id, "critical");
					}
				} else if (errorEntry.severity === "low" || errorEntry.severity === "medium") {
					// Elevate background noise to high without marking it critical
					await this.escalateErrorSeverity(errorEntry.id, "high");
				}
			}

			await this.sendSpikeAlert(errorEntry, spikeResult);
		}
	}

	private async sendCriticalAlert(errorEntry: {
		id: string;
		errorCode: string;
		module: string;
		severity: string;
		message: string;
		environment?: string;
	}): Promise<void> {
		try {
			await errorWebhookService.sendCriticalAlert({
				alertType: "critical",
				errorCode: errorEntry.errorCode,
				module: errorEntry.module,
				message: errorEntry.message,
				severity: errorEntry.severity,
				errorIds: [errorEntry.id],
				environment: errorEntry.environment || "production",
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("[SpikeDetection] Failed to send critical alert:", error);
		}
	}

	private async sendSpikeAlert(
		errorEntry: {
			id: string;
			errorCode: string;
			module: string;
			severity: string;
			message: string;
			environment?: string;
		},
		spikeResult: SpikeCheckResult,
	): Promise<void> {
		try {
			const recentErrors = await this.getRecentErrorIds(
				errorEntry.errorCode,
				spikeResult.windowMinutes,
			);

			await errorWebhookService.sendSpikeAlert({
				alertType: "spike",
				errorCode: errorEntry.errorCode,
				module: errorEntry.module,
				message: `Error spike detected: ${errorEntry.errorCode} occurred ${spikeResult.occurrenceCount} times in ${spikeResult.windowMinutes} minutes`,
				severity: spikeResult.shouldEscalate ? "critical" : errorEntry.severity,
				errorIds: recentErrors,
				occurrenceCount: spikeResult.occurrenceCount,
				windowMinutes: spikeResult.windowMinutes,
				environment: errorEntry.environment || "production",
				timestamp: new Date().toISOString(),
			});

			console.log(
				`[SpikeDetection] Spike alert sent for ${errorEntry.errorCode}`,
			);
		} catch (error) {
			console.error("[SpikeDetection] Failed to send spike alert:", error);
		}
	}

	private async escalateErrorSeverity(
		errorId: string,
		targetSeverity: "critical" | "high" = "critical",
	): Promise<void> {
		try {
			await db
				.update(errorLedger)
				.set({ severity: targetSeverity, updatedAt: new Date() })
				.where(eq(errorLedger.id, errorId));

			console.log(
				`[SpikeDetection] Escalated error ${errorId} to ${targetSeverity}`,
			);
		} catch (error) {
			console.error(
				"[SpikeDetection] Failed to escalate error severity:",
				error,
			);
		}
	}

	private async getRecentErrorIds(
		errorCode: string,
		windowMinutes: number,
	): Promise<string[]> {
		try {
			const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

			const errors = await db
				.select({ id: errorLedger.id })
				.from(errorLedger)
				.where(
					and(
						eq(errorLedger.errorCode, errorCode),
						gte(errorLedger.lastOccurrence, windowStart),
					),
				)
				.limit(10);

			return errors.map((e) => e.id);
		} catch (error) {
			console.error("[SpikeDetection] Failed to get recent error IDs:", error);
			return [];
		}
	}

	async getModuleSpikeSummary(): Promise<
		Array<{
			module: string;
			totalErrors: number;
			spikeCount: number;
			criticalCount: number;
		}>
	> {
		try {
			const windowStart = new Date(Date.now() - 60 * 60 * 1000);

			const summary = await db
				.select({
					module: errorLedger.module,
					totalErrors: count(),
					criticalCount: sql<number>`count(*) filter (where severity = 'critical')`,
				})
				.from(errorLedger)
				.where(gte(errorLedger.lastOccurrence, windowStart))
				.groupBy(errorLedger.module);

			return summary.map((s) => ({
				module: s.module,
				totalErrors: s.totalErrors,
				spikeCount: 0,
				criticalCount: s.criticalCount || 0,
			}));
		} catch (error) {
			console.error(
				"[SpikeDetection] Failed to get module spike summary:",
				error,
			);
			return [];
		}
	}

	cleanupCooldownCache(): void {
		const now = Date.now();
		for (const [key, timestamp] of this.recentAlerts.entries()) {
			if (now - timestamp > this.ALERT_COOLDOWN_MS * 2) {
				this.recentAlerts.delete(key);
			}
		}
	}
}

export const errorSpikeDetectionService = new ErrorSpikeDetectionService();

setInterval(
	() => {
		errorSpikeDetectionService.cleanupCooldownCache();
	},
	10 * 60 * 1000,
);
