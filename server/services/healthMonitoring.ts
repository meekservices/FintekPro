import type { MonitoringStorage } from '../monitoringStorage';
import { logger } from './logger';

/**
 * Health Monitoring Service
 * Centralized orchestrator for external API health checks
 * Runs standardized, low-impact health checks and logs results
 */

export type HealthCheckStatus = 'healthy' | 'degraded' | 'down';
export type HealthCheckType = 'ping' | 'auth' | 'transaction';

export interface HealthCheckResult {
  service: string;
  endpoint: string;
  checkType: HealthCheckType;
  status: HealthCheckStatus;
  latencyMs: number;
  responseCode?: number;
  failureReason?: string;
  errorMessage?: string;
}

export interface CheckDefinition {
  service: string;
  endpoint: string;
  checkType: HealthCheckType;
  checkFn: () => Promise<{ success: boolean; latencyMs: number; responseCode?: number; error?: string }>;
  enabled: boolean;
}

export class HealthMonitoringService {
  private checks: CheckDefinition[] = [];
  private monitoringStorage: MonitoringStorage;

  constructor(monitoringStorage: MonitoringStorage) {
    this.monitoringStorage = monitoringStorage;
  }

  /**
   * Register a health check
   */
  registerCheck(check: CheckDefinition): void {
    this.checks.push(check);
    logger.info(`[HealthMonitoring] Registered check: ${check.service} (${check.checkType})`);
  }

  /**
   * Evaluate health status based on latency and success
   */
  private evaluateStatus(success: boolean, latencyMs: number, error?: string): HealthCheckStatus {
    if (!success) {
      // Network errors, exceptions, or auth failures = down
      if (error && (error.includes('ECONNREFUSED') || error.includes('ETIMEDOUT') || error.includes('timeout'))) {
        return 'down';
      }
      return 'degraded'; // Soft failures (non-200, partial data)
    }

    // Success cases based on latency
    if (latencyMs < 500) {
      return 'healthy';
    } else if (latencyMs < 2000) {
      return 'degraded';
    } else {
      return 'down'; // Too slow, treat as down
    }
  }

  /**
   * Sanitize error messages to remove PII and sensitive data
   */
  private sanitizeError(error: string): string {
    return error
      .replace(/\b\d{12}\b/g, '****')          // Aadhaar
      .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '****') // PAN
      .replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer ***') // JWT
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***') // Email
      .replace(/\b\d{10}\b/g, '**********'); // Phone
  }

  /**
   * Run a single health check
   * Uses adapter-reported latency instead of wall-clock measurement
   */
  private async runCheck(check: CheckDefinition): Promise<HealthCheckResult> {
    try {
      // Execute adapter check function
      const result = await check.checkFn();
      
      // Use adapter-reported latency (not wall-clock measurement)
      const latencyMs = result.latencyMs || 0;
      
      const status = this.evaluateStatus(result.success, latencyMs, result.error);
      
      return {
        service: check.service,
        endpoint: check.endpoint,
        checkType: check.checkType,
        status,
        latencyMs,
        responseCode: result.responseCode,
        failureReason: result.error ? this.sanitizeError(result.error) : undefined,
        errorMessage: undefined,
      };
    } catch (error: any) {
      // Adapter threw an exception - mark as down with zero latency
      return {
        service: check.service,
        endpoint: check.endpoint,
        checkType: check.checkType,
        status: 'down',
        latencyMs: 0,
        responseCode: undefined,
        failureReason: 'Exception thrown during health check',
        errorMessage: this.sanitizeError(error.message || 'Unknown error'),
      };
    }
  }

  /**
   * Run all enabled health checks in parallel
   * Uses Promise.allSettled to ensure all checks run even if some fail
   */
  async runAllChecks(): Promise<HealthCheckResult[]> {
    const enabledChecks = this.checks.filter(c => c.enabled);
    
    if (enabledChecks.length === 0) {
      logger.warn('[HealthMonitoring] No enabled health checks registered');
      return [];
    }

    logger.info(`[HealthMonitoring] Running ${enabledChecks.length} health checks...`);
    
    // Run all checks in parallel
    const results = await Promise.allSettled(
      enabledChecks.map(check => this.runCheck(check))
    );

    // Extract results and log to monitoring storage
    const healthResults: HealthCheckResult[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const healthResult = result.value;
        healthResults.push(healthResult);
        
        // Log to monitoring storage
        await this.monitoringStorage.logApiHealth({
          service: healthResult.service,
          endpoint: healthResult.endpoint,
          checkType: healthResult.checkType,
          status: healthResult.status,
          latencyMs: healthResult.latencyMs,
          responseCode: healthResult.responseCode,
          failureReason: healthResult.failureReason,
          errorMessage: healthResult.errorMessage,
        });

        // Log status
        const emoji = healthResult.status === 'healthy' ? '✅' : 
                      healthResult.status === 'degraded' ? '⚠️' : '❌';
        logger.info(
          `[HealthMonitoring] ${emoji} ${healthResult.service}: ${healthResult.status} (${healthResult.latencyMs}ms)`
        );
      } else {
        logger.error('[HealthMonitoring] Health check promise rejected:', result.reason);
      }
    }

    return healthResults;
  }

  /**
   * Get all registered checks (for debugging)
   */
  getRegisteredChecks(): CheckDefinition[] {
    return this.checks;
  }

  /**
   * Enable/disable a specific check
   */
  toggleCheck(service: string, enabled: boolean): void {
    const check = this.checks.find(c => c.service === service);
    if (check) {
      check.enabled = enabled;
      logger.info(`[HealthMonitoring] ${enabled ? 'Enabled' : 'Disabled'} check for ${service}`);
    }
  }
}
