import { quantRetrainingPipeline } from './quant-retraining-pipeline';

interface ScheduleConfig {
  mvoRetrainIntervalMs: number;
  covarianceRecalibIntervalMs: number;
  blCalibrationIntervalMs: number;
  driftRetrainIntervalMs: number;
  healthCheckIntervalMs: number;
}

const MAX_SAFE_INTERVAL = 2147483647;

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
  private activeRetrains = new Set<string>();
  private lastRetrainAttempt: Record<string, number> = {};
  private static MIN_RETRAIN_GAP_MS = 60 * 60 * 1000;

  start(config: Partial<ScheduleConfig> = {}): void {
    if (this.isRunning) {
      console.log('[QuantScheduler] Already running, skipping start');
      return;
    }

    const raw = { ...DEFAULT_SCHEDULE, ...config };
    const schedule: ScheduleConfig = {
      mvoRetrainIntervalMs: Math.min(raw.mvoRetrainIntervalMs, MAX_SAFE_INTERVAL),
      covarianceRecalibIntervalMs: Math.min(raw.covarianceRecalibIntervalMs, MAX_SAFE_INTERVAL),
      blCalibrationIntervalMs: Math.min(raw.blCalibrationIntervalMs, MAX_SAFE_INTERVAL),
      driftRetrainIntervalMs: Math.min(raw.driftRetrainIntervalMs, MAX_SAFE_INTERVAL),
      healthCheckIntervalMs: Math.min(raw.healthCheckIntervalMs, MAX_SAFE_INTERVAL),
    };
    this.isRunning = true;

    console.log('[QuantScheduler] Starting automated retraining scheduler');
    console.log(`[QuantScheduler] MVO: every ${schedule.mvoRetrainIntervalMs / (24 * 60 * 60 * 1000)}d`);
    console.log(`[QuantScheduler] Covariance: every ${schedule.covarianceRecalibIntervalMs / (24 * 60 * 60 * 1000)}d`);
    console.log(`[QuantScheduler] BL Calibration: every ${schedule.blCalibrationIntervalMs / (24 * 60 * 60 * 1000)}d`);
    console.log(`[QuantScheduler] Drift: every ${schedule.driftRetrainIntervalMs / (24 * 60 * 60 * 1000)}d`);
    console.log(`[QuantScheduler] Health Check: every ${schedule.healthCheckIntervalMs / (24 * 60 * 60 * 1000)}d`);

    this.timers.push(
      setInterval(() => this.safeRun('MVO_RETRAIN', () => quantRetrainingPipeline.retrainMVOExpectedReturns()),
        schedule.mvoRetrainIntervalMs)
    );

    this.timers.push(
      setInterval(() => this.safeRun('COVARIANCE_RECALIB', () => quantRetrainingPipeline.retrainCovarianceMatrix()),
        schedule.covarianceRecalibIntervalMs)
    );

    this.timers.push(
      setInterval(() => this.safeRun('BL_CALIBRATION', () => quantRetrainingPipeline.retrainBLConfidenceCalibration()),
        schedule.blCalibrationIntervalMs)
    );

    this.timers.push(
      setInterval(() => this.safeRun('DRIFT_RETRAIN', () => quantRetrainingPipeline.retrainDriftPredictionModel()),
        schedule.driftRetrainIntervalMs)
    );

    this.timers.push(
      setInterval(() => this.runHealthCheck(), schedule.healthCheckIntervalMs)
    );

    setTimeout(() => this.runHealthCheck(), 5 * 60 * 1000);
  }

  stop(): void {
    console.log('[QuantScheduler] Stopping automated retraining scheduler');
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    this.isRunning = false;
  }

  async triggerManualRetrain(modelName?: string): Promise<any> {
    if (modelName) {
      console.log(`[QuantScheduler] Manual retrain triggered for: ${modelName}`);
      switch (modelName) {
        case 'MVO_EXPECTED_RETURNS':
          return this.safeRun('MVO_RETRAIN', () => quantRetrainingPipeline.retrainMVOExpectedReturns());
        case 'COVARIANCE_MATRIX':
          return this.safeRun('COVARIANCE_RECALIB', () => quantRetrainingPipeline.retrainCovarianceMatrix());
        case 'BL_CONFIDENCE_CALIBRATION':
          return this.safeRun('BL_CALIBRATION', () => quantRetrainingPipeline.retrainBLConfidenceCalibration());
        case 'DRIFT_PREDICTION':
          return this.safeRun('DRIFT_RETRAIN', () => quantRetrainingPipeline.retrainDriftPredictionModel());
        default:
          throw new Error(`Unknown model: ${modelName}`);
      }
    }

    console.log('[QuantScheduler] Manual FULL pipeline retrain triggered');
    return this.safeRun('FULL_PIPELINE', () => quantRetrainingPipeline.runFullRetrainingPipeline());
  }

  async runHealthCheck(): Promise<Record<string, any>> {
    if (this.activeRetrains.has('HEALTH_CHECK')) {
      return {};
    }

    this.activeRetrains.add('HEALTH_CHECK');
    try {
      console.log('[QuantScheduler] Running model health check (diagnostic only)');
      const health = await quantRetrainingPipeline.getModelHealth();

      const modelsNeedingRetrain: string[] = [];
      for (const [modelName, status] of Object.entries(health)) {
        if (status.needsRetrain) {
          modelsNeedingRetrain.push(modelName);
        }
      }

      if (modelsNeedingRetrain.length > 0) {
        console.log(`[QuantScheduler] Models needing retraining: ${modelsNeedingRetrain.join(', ')} (will be retrained on next scheduled interval)`);
      } else {
        console.log('[QuantScheduler] All models healthy');
      }

      this.lastRunResults.healthCheck = { timestamp: new Date(), health, modelsNeedingRetrain };
      return health;
    } catch (error: any) {
      console.error('[QuantScheduler] Health check failed:', error.message);
      return {};
    } finally {
      this.activeRetrains.delete('HEALTH_CHECK');
    }
  }

  getStatus(): {
    isRunning: boolean;
    activeTimers: number;
    activeRetrains: string[];
    lastResults: Record<string, any>;
  } {
    return {
      isRunning: this.isRunning,
      activeTimers: this.timers.length,
      activeRetrains: [...this.activeRetrains],
      lastResults: this.lastRunResults,
    };
  }

  private async safeRun(label: string, fn: () => Promise<any>): Promise<any> {
    if (this.activeRetrains.has(label)) {
      return null;
    }

    const lastAttempt = this.lastRetrainAttempt[label] || 0;
    const elapsed = Date.now() - lastAttempt;
    if (elapsed < QuantRetrainingScheduler.MIN_RETRAIN_GAP_MS) {
      return null;
    }

    this.activeRetrains.add(label);
    this.lastRetrainAttempt[label] = Date.now();
    try {
      console.log(`[QuantScheduler] Running ${label}...`);
      const result = await fn();
      this.lastRunResults[label] = { timestamp: new Date(), result, status: 'SUCCESS' };
      return result;
    } catch (error: any) {
      console.error(`[QuantScheduler] ${label} FAILED:`, error.message);
      this.lastRunResults[label] = { timestamp: new Date(), error: error.message, status: 'ERROR' };
      return null;
    } finally {
      this.activeRetrains.delete(label);
    }
  }
}

export const quantRetrainingScheduler = new QuantRetrainingScheduler();
