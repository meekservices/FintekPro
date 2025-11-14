import cron from 'node-cron';
import { HealthMonitoringService } from '../services/healthMonitoring';
import { getAllHealthCheckAdapters } from '../services/healthCheckAdapters';
import { monitoringStorage } from '../monitoringStorage';
import { logger } from '../services/logger';

/**
 * API Health Monitoring Cron Job
 * 
 * Runs health checks for external APIs every 5 minutes
 * Tracks BSE STAR, Cashfree, Protean KRA, eMudhra, Sandbox APIs
 */

let isRunning = false;
let healthMonitor: HealthMonitoringService | null = null;

/**
 * Initialize health monitoring service
 */
function initializeHealthMonitor(): HealthMonitoringService {
  if (!healthMonitor) {
    healthMonitor = new HealthMonitoringService(monitoringStorage);
    
    // Register all health check adapters
    const adapters = getAllHealthCheckAdapters();
    for (const adapter of adapters) {
      healthMonitor.registerCheck(adapter);
    }
    
    logger.info('[API-Health-Cron] Health monitoring service initialized with ' + adapters.length + ' checks');
  }
  
  return healthMonitor;
}

/**
 * Run all API health checks
 */
async function runHealthChecks() {
  if (isRunning) {
    logger.warn('[API-Health-Cron] Previous health check still running, skipping...');
    return;
  }

  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  isRunning = true;
  
  try {
    logger.info('[API-Health-Cron] Starting API health checks...');
    
    const monitor = initializeHealthMonitor();
    const results = await monitor.runAllChecks();
    
    // Count status distribution
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    const downCount = results.filter(r => r.status === 'down').length;
    
    logger.info(
      `[API-Health-Cron] Completed ${results.length} checks: ` +
      `${healthyCount} healthy, ${degradedCount} degraded, ${downCount} down`
    );
    
    // Alert on critical services down
    if (downCount > 0) {
      const downServices = results
        .filter(r => r.status === 'down')
        .map(r => r.service)
        .join(', ');
      
      logger.error(`[API-Health-Cron] ⚠️ Services down: ${downServices}`);
    }
  } catch (error: any) {
    logger.error('[API-Health-Cron] Job failed:', { error: error.message, stack: error.stack });
  } finally {
    isRunning = false;
  }
}

/**
 * Start API health monitoring cron job (every 5 minutes)
 */
export function startApiHealthMonitoringJob() {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('[API-Health-Cron] Skipping in test environment');
    return;
  }

  logger.info('[API-Health-Cron] Starting cron job (every 5 minutes)...');
  
  // Run every 5 minutes: */5 * * * *
  cron.schedule('*/5 * * * *', () => {
    runHealthChecks().catch(error => {
      logger.error('[API-Health-Cron] Unhandled error:', { error: error.message });
    });
  });

  // Run once immediately on startup
  runHealthChecks().catch(error => {
    logger.error('[API-Health-Cron] Initial run failed:', { error: error.message });
  });
  
  logger.info('[API-Health-Cron] Background job initialized');
}

/**
 * Manual trigger for testing
 */
export async function triggerHealthChecks() {
  await runHealthChecks();
}

/**
 * Get health monitor instance (for testing/debugging)
 */
export function getHealthMonitor(): HealthMonitoringService | null {
  return healthMonitor;
}
