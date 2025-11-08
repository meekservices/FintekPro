import { Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createLogger } from './services/logger';

const logger = createLogger({ service: 'health-check' });

/**
 * Health Check Endpoints for Production Deployment
 * 
 * /health - Basic health check (always returns 200 if server is running)
 * /ready - Readiness check (checks database connectivity)
 * /metrics - Prometheus-compatible metrics endpoint
 */

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
}

interface ReadinessStatus extends HealthStatus {
  database: {
    connected: boolean;
    responseTime?: number;
    error?: string;
  };
  dependencies?: {
    [key: string]: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      message?: string;
    };
  };
}

/**
 * Get system metrics for monitoring
 */
function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  };
}

/**
 * Basic health check - returns 200 if server is running
 * Used by load balancers to check if server process is alive
 */
export async function healthCheck(req: Request, res: Response) {
  const metrics = getSystemMetrics();
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    ...metrics
  };

  res.status(200).json(health);
}

/**
 * Check health of external dependencies
 */
async function checkDependencies(): Promise<ReadinessStatus['dependencies']> {
  const dependencies: ReadinessStatus['dependencies'] = {};

  dependencies.cashfree = process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET
    ? { status: 'healthy', message: 'Credentials configured' }
    : { status: 'degraded', message: 'Credentials not configured' };

  dependencies.email = process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? { status: 'healthy', message: 'SMTP configured' }
    : { status: 'degraded', message: 'SMTP not configured' };

  dependencies.sms = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? { status: 'healthy', message: 'Twilio configured' }
    : { status: 'degraded', message: 'Twilio not configured' };

  return dependencies;
}

/**
 * Readiness check - verifies all dependencies are ready
 * Used by orchestrators (Kubernetes, etc.) to know when to route traffic
 */
export async function readinessCheck(req: Request, res: Response) {
  const startTime = Date.now();
  const metrics = getSystemMetrics();
  
  const readiness: ReadinessStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    ...metrics,
    database: {
      connected: false
    }
  };

  try {
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;
    
    readiness.database.connected = true;
    readiness.database.responseTime = responseTime;

    readiness.dependencies = await checkDependencies();
    
    res.status(200).json(readiness);
    
  } catch (error) {
    readiness.status = 'unhealthy';
    readiness.database.connected = false;
    readiness.database.error = error instanceof Error ? error.message : 'Database connection failed';
    
    logger.error('Readiness check failed', error instanceof Error ? error : undefined, {
      databaseError: readiness.database.error
    });
    
    res.status(503).json(readiness);
  }
}

/**
 * Liveness check - similar to health but can include more detailed checks
 * Used to determine if the application should be restarted
 */
export async function livenessCheck(req: Request, res: Response) {
  return healthCheck(req, res);
}

/**
 * Metrics endpoint - Prometheus-compatible metrics
 * Provides system metrics in Prometheus exposition format
 */
export async function metricsEndpoint(req: Request, res: Response) {
  try {
    const metrics = getSystemMetrics();
    const uptime = process.uptime();
    
    const dbStartTime = Date.now();
    let dbLatency = 0;
    let dbStatus = 0;
    
    try {
      await db.execute(sql`SELECT 1`);
      dbLatency = Date.now() - dbStartTime;
      dbStatus = 1;
    } catch {
      dbStatus = 0;
    }
    
    const prometheusMetrics = `
# HELP fintekpro_uptime_seconds Application uptime in seconds
# TYPE fintekpro_uptime_seconds counter
fintekpro_uptime_seconds ${uptime.toFixed(2)}

# HELP fintekpro_memory_heap_used_mb Memory heap used in MB
# TYPE fintekpro_memory_heap_used_mb gauge
fintekpro_memory_heap_used_mb ${metrics.memory.heapUsed}

# HELP fintekpro_memory_heap_total_mb Memory heap total in MB
# TYPE fintekpro_memory_heap_total_mb gauge
fintekpro_memory_heap_total_mb ${metrics.memory.heapTotal}

# HELP fintekpro_memory_rss_mb Resident Set Size in MB
# TYPE fintekpro_memory_rss_mb gauge
fintekpro_memory_rss_mb ${metrics.memory.rss}

# HELP fintekpro_cpu_user_microseconds CPU user time in microseconds
# TYPE fintekpro_cpu_user_microseconds counter
fintekpro_cpu_user_microseconds ${metrics.cpu.user}

# HELP fintekpro_cpu_system_microseconds CPU system time in microseconds
# TYPE fintekpro_cpu_system_microseconds counter
fintekpro_cpu_system_microseconds ${metrics.cpu.system}

# HELP fintekpro_database_status Database connectivity status (1=up, 0=down)
# TYPE fintekpro_database_status gauge
fintekpro_database_status ${dbStatus}

# HELP fintekpro_database_latency_ms Database query latency in milliseconds
# TYPE fintekpro_database_latency_ms gauge
fintekpro_database_latency_ms ${dbLatency}
`.trim();

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(prometheusMetrics);
    
  } catch (error) {
    logger.error('Metrics endpoint error', error instanceof Error ? error : undefined);
    res.status(500).send('# Error generating metrics');
  }
}
