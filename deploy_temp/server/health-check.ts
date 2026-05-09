import { Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

interface ReadinessStatus extends HealthStatus {
  database: {
    connected: boolean;
    responseTimeMs?: number;
    error?: string;
  };
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    heapUtilizationPct: number;
  };
  pythonService: {
    reachable: boolean;
    responseTimeMs?: number;
    url?: string;
  };
  errorRate: {
    pct: number;
    level: 'ok' | 'elevated' | 'critical';
  };
}

/**
 * Basic health check — returns 200 as long as the process is alive.
 * Used by Railway's /api/health probe and load balancers.
 */
export async function healthCheck(_req: Request, res: Response) {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  };
  res.status(200).json(health);
}

/**
 * Readiness check — verifies all runtime dependencies before routing traffic.
 * Checks: Neon DB connectivity, Python sidecar (port 8001), heap pressure, error rate.
 * Returns 503 if any critical check fails (DB down or heap >90% or error rate >15%).
 */
export async function readinessCheck(_req: Request, res: Response) {
  const dbStart = Date.now();
  const mem = process.memoryUsage();
  const toMb = (b: number) => Math.round(b / 1024 / 1024);

  const readiness: ReadinessStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    database: { connected: false },
    memory: {
      heapUsedMb: toMb(mem.heapUsed),
      heapTotalMb: toMb(mem.heapTotal),
      rssMb: toMb(mem.rss),
      heapUtilizationPct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },
    pythonService: { reachable: false, url: process.env.PYTHON_SERVICE_URL || '(not configured)' },
    errorRate: { pct: 0, level: 'ok' },
  };

  // 1. Database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    readiness.database.connected = true;
    readiness.database.responseTimeMs = Date.now() - dbStart;
  } catch (err) {
    readiness.status = 'unhealthy';
    readiness.database.connected = false;
    readiness.database.error = err instanceof Error ? err.message : 'DB check failed';
  }

  // 2. Python Analytics Service on Railway (non-fatal — degraded service, not unhealthy)
  const pyUrl = process.env.PYTHON_SERVICE_URL?.replace(/\/$/, '');
  if (pyUrl) {
    try {
      const pyStart = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${pyUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      readiness.pythonService = { reachable: resp.ok, responseTimeMs: Date.now() - pyStart, url: pyUrl };
    } catch {
      readiness.pythonService = { reachable: false, url: pyUrl };
    }
  }

  // 3. Error rate from the global monitor (lazy import avoids circular dep)
  try {
    const { errorMonitor } = await import('./error-monitor');
    const h = errorMonitor.getSystemHealth();
    const pct = Math.round(h.performance.errorRate * 10) / 10;
    readiness.errorRate = {
      pct,
      level: pct > 15 ? 'critical' : pct > 5 ? 'elevated' : 'ok',
    };
    if (pct > 15) readiness.status = 'unhealthy';
  } catch {
    // Monitor unavailable — safe to ignore here
  }

  // 4. Heap pressure guard (>90% → unhealthy, Railway should restart)
  if (readiness.memory.heapUtilizationPct > 90) {
    readiness.status = 'unhealthy';
  }

  res.status(readiness.status === 'healthy' ? 200 : 503).json(readiness);
}

/**
 * Liveness check — minimal check; process restarts if this fails.
 */
export async function livenessCheck(req: Request, res: Response) {
  return healthCheck(req, res);
}
