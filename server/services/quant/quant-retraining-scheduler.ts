import { quantRetrainingPipeline } from "./quant-retraining-pipeline";
import { db } from "../../db";
import { quantSchedulerLocks, quantSchedulerState } from "@shared/schema";
import { eq, sql, lt } from "drizzle-orm";
import { nanoid } from "nanoid";

interface ScheduleConfig {
	mvoRetrainIntervalMs: number;
	covarianceRecalibIntervalMs: number;
	blCalibrationIntervalMs: number;
	driftRetrainIntervalMs: number;
	healthCheckIntervalMs: number;
}

const MAX_SAFE_INTERVAL = 2147483647;
const MIN_RETRAIN_GAP_MS = 6 * 60 * 60 * 1000;
const DAILY_RETRAIN_CAP = 4;
const LOCK_TTL_MS = 30 * 60 * 1000;
const BASE_BACKOFF_MS = 15 * 60 * 1000;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface StructuredLog {
	timestamp: string;
	level: LogLevel;
	component: string;
	action: string;
	lockKey?: string;
	detail?: Record<string, any>;
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
	mvoRetrainIntervalMs: Math.min(24 * 24 * 60 * 60 * 1000, MAX_SAFE_INTERVAL),
	covarianceRecalibIntervalMs: 7 * 24 * 60 * 60 * 1000,
	blCalibrationIntervalMs: 14 * 24 * 60 * 60 * 1000,
	driftRetrainIntervalMs: 7 * 24 * 60 * 60 * 1000,
	healthCheckIntervalMs: 24 * 60 * 60 * 1000,
};

class QuantRetrainingScheduler {
	private timers: NodeJS.Timeout[] = [];
	private isRunning = false;
	private lastRunResults: Record<string, any> = {};
	private instanceId: string;

	constructor() {
		this.instanceId = `inst-${nanoid(8)}`;
	}

	private log(
		level: LogLevel,
		action: string,
		lockKey?: string,
		detail?: Record<string, any>,
	): void {
		const entry: StructuredLog = {
			timestamp: new Date().toISOString(),
			level,
			component: "QuantScheduler",
			action,
			lockKey,
			detail,
		};

		const msg = `[QuantScheduler] [${level}] ${action}${lockKey ? ` key=${lockKey}` : ""}${detail ? " " + JSON.stringify(detail) : ""}`;

		switch (level) {
			case "ERROR":
				console.error(msg);
				break;
			case "WARN":
				console.warn(msg);
				break;
			case "INFO":
				console.log(msg);
				break;
			case "DEBUG":
				break;
		}

		this.lastRunResults._lastLog = entry;
	}

	start(config: Partial<ScheduleConfig> = {}): void {
		if (this.isRunning) {
			this.log("WARN", "Already running, skipping start");
			return;
		}

		const raw = { ...DEFAULT_SCHEDULE, ...config };
		const schedule: ScheduleConfig = {
			mvoRetrainIntervalMs: Math.min(
				raw.mvoRetrainIntervalMs,
				MAX_SAFE_INTERVAL,
			),
			covarianceRecalibIntervalMs: Math.min(
				raw.covarianceRecalibIntervalMs,
				MAX_SAFE_INTERVAL,
			),
			blCalibrationIntervalMs: Math.min(
				raw.blCalibrationIntervalMs,
				MAX_SAFE_INTERVAL,
			),
			driftRetrainIntervalMs: Math.min(
				raw.driftRetrainIntervalMs,
				MAX_SAFE_INTERVAL,
			),
			healthCheckIntervalMs: Math.min(
				raw.healthCheckIntervalMs,
				MAX_SAFE_INTERVAL,
			),
		};
		this.isRunning = true;

		this.log("INFO", "Starting automated retraining scheduler", undefined, {
			instanceId: this.instanceId,
			mvo: `${(schedule.mvoRetrainIntervalMs / (24 * 60 * 60 * 1000)).toFixed(1)}d`,
			covariance: `${(schedule.covarianceRecalibIntervalMs / (24 * 60 * 60 * 1000)).toFixed(1)}d`,
			bl: `${(schedule.blCalibrationIntervalMs / (24 * 60 * 60 * 1000)).toFixed(1)}d`,
			drift: `${(schedule.driftRetrainIntervalMs / (24 * 60 * 60 * 1000)).toFixed(1)}d`,
			healthCheck: `${(schedule.healthCheckIntervalMs / (24 * 60 * 60 * 1000)).toFixed(1)}d`,
			minGap: `${MIN_RETRAIN_GAP_MS / (60 * 60 * 1000)}h`,
			dailyCap: DAILY_RETRAIN_CAP,
		});

		this.timers.push(
			setInterval(
				() =>
					this.safeRun("MVO_RETRAIN", () =>
						quantRetrainingPipeline.retrainMVOExpectedReturns(),
					),
				schedule.mvoRetrainIntervalMs,
			),
		);

		this.timers.push(
			setInterval(
				() =>
					this.safeRun("COVARIANCE_RECALIB", () =>
						quantRetrainingPipeline.retrainCovarianceMatrix(),
					),
				schedule.covarianceRecalibIntervalMs,
			),
		);

		this.timers.push(
			setInterval(
				() =>
					this.safeRun("BL_CALIBRATION", () =>
						quantRetrainingPipeline.retrainBLConfidenceCalibration(),
					),
				schedule.blCalibrationIntervalMs,
			),
		);

		this.timers.push(
			setInterval(
				() =>
					this.safeRun("DRIFT_RETRAIN", () =>
						quantRetrainingPipeline.retrainDriftPredictionModel(),
					),
				schedule.driftRetrainIntervalMs,
			),
		);

		this.timers.push(
			setInterval(() => this.runHealthCheck(), schedule.healthCheckIntervalMs),
		);

		setTimeout(() => this.runHealthCheck(), 5 * 60 * 1000);
	}

	stop(): void {
		this.log("INFO", "Stopping automated retraining scheduler");
		for (const timer of this.timers) {
			clearInterval(timer);
		}
		this.timers = [];
		this.isRunning = false;
	}

	async triggerManualRetrain(modelName?: string): Promise<any> {
		if (modelName) {
			this.log("INFO", "Manual retrain triggered", undefined, { modelName });
			switch (modelName) {
				case "MVO_EXPECTED_RETURNS":
					return this.safeRun("MVO_RETRAIN", () =>
						quantRetrainingPipeline.retrainMVOExpectedReturns(),
					);
				case "COVARIANCE_MATRIX":
					return this.safeRun("COVARIANCE_RECALIB", () =>
						quantRetrainingPipeline.retrainCovarianceMatrix(),
					);
				case "BL_CONFIDENCE_CALIBRATION":
					return this.safeRun("BL_CALIBRATION", () =>
						quantRetrainingPipeline.retrainBLConfidenceCalibration(),
					);
				case "DRIFT_PREDICTION":
					return this.safeRun("DRIFT_RETRAIN", () =>
						quantRetrainingPipeline.retrainDriftPredictionModel(),
					);
				default:
					throw new Error(`Unknown model: ${modelName}`);
			}
		}

		this.log("INFO", "Manual FULL pipeline retrain triggered");
		return this.safeRun("FULL_PIPELINE", () =>
			quantRetrainingPipeline.runFullRetrainingPipeline(),
		);
	}

	async runHealthCheck(): Promise<Record<string, any>> {
		const lockKey = "HEALTH_CHECK";
		const acquired = await this.acquireDbLock(lockKey);
		if (!acquired) {
			this.log("DEBUG", "Health check skipped (DB lock held)", lockKey);
			return {};
		}

		try {
			this.log("INFO", "Running model health check (diagnostic only)");
			const health = await quantRetrainingPipeline.getModelHealth();

			const modelsNeedingRetrain: string[] = [];
			for (const [modelName, status] of Object.entries(health)) {
				if (status.needsRetrain) {
					modelsNeedingRetrain.push(modelName);
				}
			}

			if (modelsNeedingRetrain.length > 0) {
				this.log(
					"INFO",
					"Models needing retraining (scheduled interval will handle)",
					undefined,
					{ models: modelsNeedingRetrain },
				);
			} else {
				this.log("INFO", "All models healthy");
			}

			this.lastRunResults.healthCheck = {
				timestamp: new Date(),
				health,
				modelsNeedingRetrain,
			};
			return health;
		} catch (error: any) {
			this.log("ERROR", "Health check failed", lockKey, {
				error: error.message,
			});
			return {};
		} finally {
			await this.releaseDbLock(lockKey);
		}
	}

	getStatus(): {
		isRunning: boolean;
		instanceId: string;
		activeTimers: number;
		lastResults: Record<string, any>;
	} {
		return {
			isRunning: this.isRunning,
			instanceId: this.instanceId,
			activeTimers: this.timers.length,
			lastResults: this.lastRunResults,
		};
	}

	async getDetailedStatus(): Promise<Record<string, any>> {
		const basic = this.getStatus();

		try {
			const states = await db.select().from(quantSchedulerState);
			const locks = await db.select().from(quantSchedulerLocks);

			const stateMap: Record<string, any> = {};
			for (const s of states) {
				stateMap[s.lockKey] = {
					dailyCount: s.dailyCount,
					dailyCountDate: s.dailyCountDate,
					consecutiveFailures: s.consecutiveFailures,
					lastAttemptAt: s.lastAttemptAt,
					lastSuccessAt: s.lastSuccessAt,
					backoffUntil: s.backoffUntil,
					isInBackoff: s.backoffUntil
						? new Date(s.backoffUntil) > new Date()
						: false,
				};
			}

			const lockMap: Record<string, any> = {};
			for (const l of locks) {
				lockMap[l.lockKey] = {
					lockedBy: l.lockedBy,
					acquiredAt: l.acquiredAt,
					expiresAt: l.expiresAt,
					isExpired: new Date(l.expiresAt) < new Date(),
				};
			}

			return {
				...basic,
				config: {
					minRetrainGapMs: MIN_RETRAIN_GAP_MS,
					dailyRetrainCap: DAILY_RETRAIN_CAP,
					lockTtlMs: LOCK_TTL_MS,
					baseBackoffMs: BASE_BACKOFF_MS,
					maxBackoffMs: MAX_BACKOFF_MS,
				},
				schedulerState: stateMap,
				activeLocks: lockMap,
			};
		} catch (e: any) {
			return { ...basic, stateError: e.message };
		}
	}

	private async acquireDbLock(lockKey: string): Promise<boolean> {
		try {
			const now = new Date();
			const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

			await db
				.delete(quantSchedulerLocks)
				.where(lt(quantSchedulerLocks.expiresAt, now));

			const existing = await db
				.select()
				.from(quantSchedulerLocks)
				.where(eq(quantSchedulerLocks.lockKey, lockKey))
				.limit(1);

			if (existing.length > 0) {
				const lock = existing[0];
				const heartbeatAge = lock.heartbeatAt
					? now.getTime() - new Date(lock.heartbeatAt).getTime()
					: Number.POSITIVE_INFINITY;
				if (heartbeatAge > LOCK_TTL_MS) {
					this.log("WARN", "Evicting stale lock (heartbeat expired)", lockKey, {
						heldBy: lock.lockedBy,
						heartbeatAgeMs: heartbeatAge,
					});
					await db
						.delete(quantSchedulerLocks)
						.where(
							sql`${quantSchedulerLocks.lockKey} = ${lockKey} AND ${quantSchedulerLocks.lockedBy} = ${lock.lockedBy}`,
						);
				} else {
					this.log("DEBUG", "DB lock already held", lockKey, {
						heldBy: lock.lockedBy,
					});
					return false;
				}
			}

			await db
				.insert(quantSchedulerLocks)
				.values({
					lockKey,
					lockedBy: this.instanceId,
					acquiredAt: now,
					expiresAt,
					heartbeatAt: now,
				})
				.onConflictDoNothing();

			const verify = await db
				.select()
				.from(quantSchedulerLocks)
				.where(eq(quantSchedulerLocks.lockKey, lockKey))
				.limit(1);

			if (verify.length > 0 && verify[0].lockedBy === this.instanceId) {
				this.log("DEBUG", "DB lock acquired", lockKey);
				return true;
			}

			this.log("DEBUG", "DB lock contention lost", lockKey);
			return false;
		} catch (e: any) {
			this.log(
				"WARN",
				"DB lock acquisition error, falling back to in-memory",
				lockKey,
				{ error: e.message },
			);
			return true;
		}
	}

	private async releaseDbLock(lockKey: string): Promise<void> {
		try {
			await db
				.delete(quantSchedulerLocks)
				.where(
					sql`${quantSchedulerLocks.lockKey} = ${lockKey} AND ${quantSchedulerLocks.lockedBy} = ${this.instanceId}`,
				);
			this.log("DEBUG", "DB lock released", lockKey);
		} catch (e: any) {
			this.log("WARN", "DB lock release error", lockKey, { error: e.message });
		}
	}

	private async refreshLockHeartbeat(lockKey: string): Promise<boolean> {
		try {
			const now = new Date();
			const newExpiry = new Date(now.getTime() + LOCK_TTL_MS);
			const result = await db
				.update(quantSchedulerLocks)
				.set({ heartbeatAt: now, expiresAt: newExpiry })
				.where(
					sql`${quantSchedulerLocks.lockKey} = ${lockKey} AND ${quantSchedulerLocks.lockedBy} = ${this.instanceId}`,
				);
			return true;
		} catch (e: any) {
			this.log("WARN", "Heartbeat refresh failed", lockKey, {
				error: e.message,
			});
			return false;
		}
	}

	private startHeartbeat(lockKey: string): NodeJS.Timeout {
		const interval = Math.floor(LOCK_TTL_MS / 3);
		return setInterval(() => {
			this.refreshLockHeartbeat(lockKey).catch(() => {});
		}, interval);
	}

	private async getOrCreateState(lockKey: string): Promise<{
		dailyCount: number;
		dailyCountDate: string;
		consecutiveFailures: number;
		lastAttemptAt: Date | null;
		lastSuccessAt: Date | null;
		backoffUntil: Date | null;
	}> {
		const today = new Date().toISOString().slice(0, 10);

		try {
			const rows = await db
				.select()
				.from(quantSchedulerState)
				.where(eq(quantSchedulerState.lockKey, lockKey))
				.limit(1);

			if (rows.length === 0) {
				await db
					.insert(quantSchedulerState)
					.values({
						lockKey,
						dailyCount: 0,
						dailyCountDate: today,
						consecutiveFailures: 0,
					})
					.onConflictDoNothing();

				return {
					dailyCount: 0,
					dailyCountDate: today,
					consecutiveFailures: 0,
					lastAttemptAt: null,
					lastSuccessAt: null,
					backoffUntil: null,
				};
			}

			const state = rows[0];
			if (state.dailyCountDate !== today) {
				await db
					.update(quantSchedulerState)
					.set({ dailyCount: 0, dailyCountDate: today, updatedAt: new Date() })
					.where(eq(quantSchedulerState.lockKey, lockKey));
				return {
					...state,
					dailyCount: 0,
					dailyCountDate: today,
					lastAttemptAt: state.lastAttemptAt,
					lastSuccessAt: state.lastSuccessAt,
					backoffUntil: state.backoffUntil,
				};
			}

			return {
				dailyCount: state.dailyCount,
				dailyCountDate: state.dailyCountDate,
				consecutiveFailures: state.consecutiveFailures,
				lastAttemptAt: state.lastAttemptAt,
				lastSuccessAt: state.lastSuccessAt,
				backoffUntil: state.backoffUntil,
			};
		} catch (e: any) {
			this.log("WARN", "State fetch failed, using defaults", lockKey, {
				error: e.message,
			});
			return {
				dailyCount: 0,
				dailyCountDate: today,
				consecutiveFailures: 0,
				lastAttemptAt: null,
				lastSuccessAt: null,
				backoffUntil: null,
			};
		}
	}

	private async recordAttempt(
		lockKey: string,
		success: boolean,
	): Promise<void> {
		const now = new Date();
		try {
			if (success) {
				await db
					.update(quantSchedulerState)
					.set({
						dailyCount: sql`${quantSchedulerState.dailyCount} + 1`,
						consecutiveFailures: 0,
						lastAttemptAt: now,
						lastSuccessAt: now,
						backoffUntil: null,
						updatedAt: now,
					})
					.where(eq(quantSchedulerState.lockKey, lockKey));
			} else {
				const state = await this.getOrCreateState(lockKey);
				const failures = state.consecutiveFailures + 1;
				const backoffMs = Math.min(
					BASE_BACKOFF_MS * 2 ** (failures - 1),
					MAX_BACKOFF_MS,
				);
				const backoffUntil = new Date(now.getTime() + backoffMs);

				await db
					.update(quantSchedulerState)
					.set({
						dailyCount: sql`${quantSchedulerState.dailyCount} + 1`,
						consecutiveFailures: failures,
						lastAttemptAt: now,
						backoffUntil,
						updatedAt: now,
					})
					.where(eq(quantSchedulerState.lockKey, lockKey));

				this.log("WARN", "Backoff applied after failure", lockKey, {
					failures,
					backoffMs,
					backoffUntil: backoffUntil.toISOString(),
				});
			}
		} catch (e: any) {
			this.log("WARN", "Failed to record attempt", lockKey, {
				error: e.message,
			});
		}
	}

	private async safeRun(label: string, fn: () => Promise<any>): Promise<any> {
		const state = await this.getOrCreateState(label);

		if (state.lastAttemptAt) {
			const elapsed = Date.now() - new Date(state.lastAttemptAt).getTime();
			if (elapsed < MIN_RETRAIN_GAP_MS) {
				this.log("DEBUG", "Skipped: within min gap", label, {
					elapsedH: (elapsed / (60 * 60 * 1000)).toFixed(1),
					minGapH: (MIN_RETRAIN_GAP_MS / (60 * 60 * 1000)).toFixed(1),
				});
				return null;
			}
		}

		if (state.dailyCount >= DAILY_RETRAIN_CAP) {
			this.log("DEBUG", "Skipped: daily cap reached", label, {
				count: state.dailyCount,
				cap: DAILY_RETRAIN_CAP,
			});
			return null;
		}

		if (state.backoffUntil && new Date(state.backoffUntil) > new Date()) {
			this.log("DEBUG", "Skipped: in exponential backoff", label, {
				backoffUntil: new Date(state.backoffUntil).toISOString(),
				failures: state.consecutiveFailures,
			});
			return null;
		}

		const lockAcquired = await this.acquireDbLock(label);
		if (!lockAcquired) {
			this.log("DEBUG", "Skipped: DB lock held by another instance", label);
			return null;
		}

		const heartbeatTimer = this.startHeartbeat(label);
		try {
			this.log("INFO", "Starting retrain", label, {
				dailyCount: state.dailyCount + 1,
				cap: DAILY_RETRAIN_CAP,
			});
			const startMs = Date.now();
			const result = await fn();
			const durationMs = Date.now() - startMs;

			await this.recordAttempt(label, true);
			this.lastRunResults[label] = {
				timestamp: new Date(),
				result,
				status: "SUCCESS",
				durationMs,
			};

			this.log("INFO", "Retrain completed", label, {
				durationMs,
				status: "SUCCESS",
			});
			return result;
		} catch (error: any) {
			await this.recordAttempt(label, false);
			this.lastRunResults[label] = {
				timestamp: new Date(),
				error: error.message,
				status: "ERROR",
			};

			this.log("ERROR", "Retrain failed", label, { error: error.message });
			return null;
		} finally {
			clearInterval(heartbeatTimer);
			await this.releaseDbLock(label);
		}
	}
}

export const quantRetrainingScheduler = new QuantRetrainingScheduler();
