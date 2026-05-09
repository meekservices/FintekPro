import os from 'os';
import { db } from '../../../db';
import { sql } from 'drizzle-orm';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  latency?: number;
  lastChecked: string;
  details?: string;
}

interface BackgroundJob {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastRun?: string;
  nextRun?: string;
}

interface SystemHealthResult {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  services: ServiceStatus[];
  backgroundJobs: BackgroundJob[];
  metrics: {
    uptime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    activeConnections: number;
  };
  alerts: string[];
}

export async function getSystemHealth(): Promise<SystemHealthResult> {
  const services: ServiceStatus[] = [];
  const alerts: string[] = [];
  const now = new Date().toISOString();

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - dbStart;
    services.push({
      name: 'PostgreSQL Database',
      status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'critical',
      latency: dbLatency,
      lastChecked: now
    });
  } catch (error) {
    services.push({
      name: 'PostgreSQL Database',
      status: 'critical',
      lastChecked: now,
      details: 'Database connection failed'
    });
    alerts.push('Database connection failed');
  }

  services.push({
    name: 'Express Server',
    status: 'healthy',
    lastChecked: now
  });

  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = memTotal - memFree;
  const memPercentage = (memUsed / memTotal) * 100;

  if (memPercentage > 90) {
    alerts.push('Memory usage is critically high (>90%)');
  } else if (memPercentage > 80) {
    alerts.push('Memory usage is elevated (>80%)');
  }

  const backgroundJobs: BackgroundJob[] = [
    { name: 'Cache Warming', status: 'running', lastRun: now },
    { name: 'Session Cleanup', status: 'running' },
    { name: 'Stock Price Sync', status: 'running' },
    { name: 'Audit Integrity Check', status: 'running' }
  ];

  let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (services.some(s => s.status === 'critical')) {
    overallStatus = 'critical';
  } else if (services.some(s => s.status === 'degraded') || alerts.length > 0) {
    overallStatus = 'degraded';
  }

  return {
    overallStatus,
    services,
    backgroundJobs,
    metrics: {
      uptime: process.uptime(),
      memoryUsage: {
        used: Math.round(memUsed / 1024 / 1024),
        total: Math.round(memTotal / 1024 / 1024),
        percentage: Math.round(memPercentage)
      },
      activeConnections: 0
    },
    alerts
  };
}
