import type { Express, Request, Response } from "express";
import { db } from "./db";
import { systemHealthLogs, aiFixSuggestions, auditHashChain } from "@shared/schema";
import { desc, and, gte, lte, eq, sql, count } from "drizzle-orm";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

// Service health checker - monitors external service status
const serviceHealthCheckers: Record<string, () => Promise<{ status: string; latency: number; error?: string }>> = {
  bse_star: async () => {
    const start = Date.now();
    try {
      // TODO: Implement actual BSE Star API health check
      // For now, return mock data
      const latency = Date.now() - start + Math.random() * 100;
      return { status: 'healthy', latency: Math.round(latency) };
    } catch (error) {
      return { status: 'failing', latency: Date.now() - start, error: String(error) };
    }
  },
  
  cashfree: async () => {
    const start = Date.now();
    try {
      // TODO: Implement actual Cashfree API health check
      const latency = Date.now() - start + Math.random() * 150;
      return { status: 'healthy', latency: Math.round(latency) };
    } catch (error) {
      return { status: 'failing', latency: Date.now() - start, error: String(error) };
    }
  },
  
  emudhra: async () => {
    const start = Date.now();
    try {
      // TODO: Implement actual eMudhra API health check
      const latency = Date.now() - start + Math.random() * 300;
      const status = latency > 250 ? 'degraded' : 'healthy';
      return { status, latency: Math.round(latency) };
    } catch (error) {
      return { status: 'failing', latency: Date.now() - start, error: String(error) };
    }
  },
  
  demat_sync: async () => {
    const start = Date.now();
    try {
      // TODO: Implement actual Demat (CDSL/NSDL) API health check
      const latency = Date.now() - start + Math.random() * 200;
      return { status: 'healthy', latency: Math.round(latency) };
    } catch (error) {
      return { status: 'failing', latency: Date.now() - start, error: String(error) };
    }
  },
  
  aa_finvu: async () => {
    const start = Date.now();
    try {
      // TODO: Implement actual AA (Finvu) API health check
      const latency = Date.now() - start + Math.random() * 180;
      return { status: 'healthy', latency: Math.round(latency) };
    } catch (error) {
      return { status: 'failing', latency: Date.now() - start, error: String(error) };
    }
  },
};

export function registerAdminMonitoringRoutes(app: Express) {
  // GET /api/admin/monitoring/services - Check all service health statuses
  app.get("/api/admin/monitoring/services", async (req: Request, res: Response) => {
    try {
      const serviceResults = await Promise.all(
        Object.entries(serviceHealthCheckers).map(async ([name, checker]) => {
          const result = await checker();
          
          // Log the health check result
          await db.insert(systemHealthLogs).values({
            serviceName: name,
            serviceCategory: getServiceCategory(name),
            status: result.status,
            latencyMs: result.latency,
            errorMessage: result.error || null,
            checkedAt: new Date(),
          });
          
          return {
            name,
            category: getServiceCategory(name),
            ...result,
          };
        })
      );
      
      res.json({ services: serviceResults });
    } catch (error) {
      logger.error('Error checking service health', { error: String(error) });
      res.status(500).json({ message: "Error checking service health" });
    }
  });
  
  // GET /api/admin/monitoring/metrics - Get aggregated system metrics
  app.get("/api/admin/monitoring/metrics", async (req: Request, res: Response) => {
    try {
      const hoursAgo = parseInt(req.query.hours as string) || 1;
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      
      // Calculate P95 latency (95th percentile)
      const latencyData = await db
        .select({ latencyMs: systemHealthLogs.latencyMs })
        .from(systemHealthLogs)
        .where(and(
          gte(systemHealthLogs.checkedAt, since),
          sql`${systemHealthLogs.latencyMs} IS NOT NULL`
        ))
        .orderBy(systemHealthLogs.latencyMs);
      
      const p95Index = Math.floor(latencyData.length * 0.95);
      const p95Latency = latencyData[p95Index]?.latencyMs || 0;
      
      // Calculate error rate
      const totalChecks = await db
        .select({ count: count() })
        .from(systemHealthLogs)
        .where(gte(systemHealthLogs.checkedAt, since));
      
      const failedChecks = await db
        .select({ count: count() })
        .from(systemHealthLogs)
        .where(and(
          gte(systemHealthLogs.checkedAt, since),
          eq(systemHealthLogs.status, 'failing')
        ));
      
      const errorRate = totalChecks[0].count > 0 
        ? (failedChecks[0].count / totalChecks[0].count) * 100 
        : 0;
      
      // Calculate uptime (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const totalChecks7d = await db
        .select({ count: count() })
        .from(systemHealthLogs)
        .where(gte(systemHealthLogs.checkedAt, sevenDaysAgo));
      
      const healthyChecks7d = await db
        .select({ count: count() })
        .from(systemHealthLogs)
        .where(and(
          gte(systemHealthLogs.checkedAt, sevenDaysAgo),
          eq(systemHealthLogs.status, 'healthy')
        ));
      
      const uptime = totalChecks7d[0].count > 0 
        ? (healthyChecks7d[0].count / totalChecks7d[0].count) * 100 
        : 100;
      
      res.json({
        p95Latency,
        errorRate: parseFloat(errorRate.toFixed(2)),
        uptime: parseFloat(uptime.toFixed(2)),
        period: `last ${hoursAgo} hour(s)`,
      });
    } catch (error) {
      logger.error('Error calculating metrics', { error: String(error) });
      res.status(500).json({ message: "Error calculating metrics" });
    }
  });
  
  // GET /api/admin/monitoring/errors - Get error stream with filters
  app.get("/api/admin/monitoring/errors", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, service, severity, limit = 50 } = req.query;
      
      // Parse winston log files to get error stream
      const logsDir = path.join(process.cwd(), 'logs');
      let errorStream: any[] = [];
      
      try {
        // Read combined log file (winston logs)
        const logFiles = fs.readdirSync(logsDir).filter(f => f.startsWith('combined-'));
        
        for (const file of logFiles.slice(-3)) { // Read last 3 log files
          const logPath = path.join(logsDir, file);
          const logContent = fs.readFileSync(logPath, 'utf-8');
          const lines = logContent.split('\n').filter(Boolean);
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              
              // Filter for errors and warnings
              if (entry.level === 'error' || entry.level === 'warn') {
                errorStream.push({
                  timestamp: entry.timestamp,
                  level: entry.level,
                  message: entry.message,
                  endpoint: entry.path || entry.endpoint || 'N/A',
                  service: entry.service || 'unknown',
                  statusCode: entry.status || entry.statusCode,
                  metadata: entry,
                });
              }
            } catch (parseError) {
              // Skip invalid JSON lines
            }
          }
        }
      } catch (fsError) {
        logger.warn('Could not read log files', { error: String(fsError) });
      }
      
      // Apply filters
      if (service) {
        errorStream = errorStream.filter(e => e.service === service);
      }
      
      if (severity) {
        errorStream = errorStream.filter(e => e.level === severity);
      }
      
      if (startDate) {
        errorStream = errorStream.filter(e => new Date(e.timestamp) >= new Date(startDate as string));
      }
      
      if (endDate) {
        errorStream = errorStream.filter(e => new Date(e.timestamp) <= new Date(endDate as string));
      }
      
      // Sort by timestamp descending and limit
      errorStream = errorStream
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, parseInt(limit as string));
      
      res.json({ errors: errorStream, count: errorStream.length });
    } catch (error) {
      logger.error('Error fetching error stream', { error: String(error) });
      res.status(500).json({ message: "Error fetching error stream" });
    }
  });
  
  // GET /api/admin/monitoring/health-history - Get service health history
  app.get("/api/admin/monitoring/health-history", async (req: Request, res: Response) => {
    try {
      const { service, hours = 24 } = req.query;
      const since = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);
      
      let query = db
        .select()
        .from(systemHealthLogs)
        .where(gte(systemHealthLogs.checkedAt, since))
        .orderBy(desc(systemHealthLogs.checkedAt))
        .limit(1000);
      
      if (service) {
        query = db
          .select()
          .from(systemHealthLogs)
          .where(and(
            gte(systemHealthLogs.checkedAt, since),
            eq(systemHealthLogs.serviceName, service as string)
          ))
          .orderBy(desc(systemHealthLogs.checkedAt))
          .limit(1000) as any;
      }
      
      const history = await query;
      
      res.json({ history, count: history.length });
    } catch (error) {
      logger.error('Error fetching health history', { error: String(error) });
      res.status(500).json({ message: "Error fetching health history" });
    }
  });
}

// Helper function to categorize services
function getServiceCategory(serviceName: string): string {
  const categories: Record<string, string> = {
    bse_star: 'trading',
    cashfree: 'payment',
    emudhra: 'kyc',
    demat_sync: 'trading',
    aa_finvu: 'data_aggregation',
  };
  return categories[serviceName] || 'general';
}
