import { Router, Request, Response } from "express";
import { monitoringStorage } from "./monitoringStorage";
import { insertErrorEventSchema, insertApiHealthLogSchema, insertAuditLogSchema, insertSystemMetricSchema } from "@shared/schema";
import { logger } from "./logger";
import { z } from "zod";

const router = Router();

/**
 * POST /api/monitoring/log-error
 * Log a frontend or backend error
 */
router.post("/log-error", async (req: Request, res: Response) => {
  try {
    const errorData = req.body;
    
    // Validate input
    const validated = insertErrorEventSchema.extend({
      stackTrace: z.string().optional(),
    }).parse({
      ...errorData,
      // Auto-populate HTTP context from request if not provided
      httpMethod: errorData.httpMethod || req.method,
      httpPath: errorData.httpPath || req.path,
      userAgent: errorData.userAgent || req.headers["user-agent"],
      ipAddress: errorData.ipAddress || req.ip,
      userId: errorData.userId || (req.user as any)?.id,
      sessionId: errorData.sessionId || req.sessionID,
    });

    const errorEvent = await monitoringStorage.logError(validated);

    // Log to Winston for backend records
    logger.error("Error logged via monitoring API", {
      errorId: errorEvent.id,
      source: errorEvent.source,
      severity: errorEvent.severity,
      service: errorEvent.service,
      message: errorEvent.message,
    });

    res.status(201).json({
      success: true,
      errorId: errorEvent.id,
    });
  } catch (error: any) {
    logger.error("Failed to log error via monitoring API", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to log error",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/errors
 * Get recent errors with filtering
 */
router.get("/errors", async (req: Request, res: Response) => {
  try {
    const {
      source,
      severity,
      service,
      userId,
      startTime,
      endTime,
      limit,
    } = req.query;

    const errors = await monitoringStorage.getErrors({
      source: source ? (source as string).split(",") : undefined,
      severity: severity ? (severity as string).split(",") : undefined,
      service: service as string | undefined,
      userId: userId as string | undefined,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      errors,
      total: errors.length,
    });
  } catch (error: any) {
    logger.error("Failed to get errors", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve errors",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/errors/:id
 * Get a specific error by ID with full details
 */
router.get("/errors/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const error = await monitoringStorage.getErrorById(id);

    if (!error) {
      return res.status(404).json({
        success: false,
        message: "Error not found",
      });
    }

    res.json({
      success: true,
      error,
    });
  } catch (error: any) {
    logger.error("Failed to get error by ID", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve error",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/error-groups
 * Get aggregated error groups
 */
router.get("/error-groups", async (req: Request, res: Response) => {
  try {
    const { status, severity, service, limit } = req.query;

    const errorGroups = await monitoringStorage.getErrorGroups({
      status: status as string | undefined,
      severity: severity ? (severity as string).split(",") : undefined,
      service: service as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      errorGroups,
      total: errorGroups.length,
    });
  } catch (error: any) {
    logger.error("Failed to get error groups", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve error groups",
      error: error.message,
    });
  }
});

/**
 * PATCH /api/monitoring/error-groups/:id
 * Update an error group (resolve, assign, add AI analysis)
 */
router.patch("/error-groups/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedGroup = await monitoringStorage.updateErrorGroup(id, updates);

    if (!updatedGroup) {
      return res.status(404).json({
        success: false,
        message: "Error group not found",
      });
    }

    res.json({
      success: true,
      errorGroup: updatedGroup,
    });
  } catch (error: any) {
    logger.error("Failed to update error group", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update error group",
      error: error.message,
    });
  }
});

/**
 * POST /api/monitoring/api-health
 * Log API health check result
 */
router.post("/api-health", async (req: Request, res: Response) => {
  try {
    const validated = insertApiHealthLogSchema.parse(req.body);
    const healthLog = await monitoringStorage.logApiHealth(validated);

    res.status(201).json({
      success: true,
      healthLog,
    });
  } catch (error: any) {
    logger.error("Failed to log API health", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to log API health",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/api-health
 * Get API health status
 */
router.get("/api-health", async (req: Request, res: Response) => {
  try {
    const { service, hours } = req.query;

    const healthLogs = await monitoringStorage.getApiHealthStatus(
      service as string | undefined,
      hours ? parseInt(hours as string) : undefined
    );

    // Calculate health statistics
    const stats = healthLogs.reduce((acc, log) => {
      if (!acc[log.service]) {
        acc[log.service] = {
          service: log.service,
          totalChecks: 0,
          healthyCount: 0,
          degradedCount: 0,
          downCount: 0,
          avgLatency: 0,
          latencies: [] as number[],
        };
      }

      acc[log.service].totalChecks++;
      
      if (log.status === "healthy") acc[log.service].healthyCount++;
      else if (log.status === "degraded") acc[log.service].degradedCount++;
      else if (log.status === "down") acc[log.service].downCount++;

      if (log.latencyMs) {
        acc[log.service].latencies.push(log.latencyMs);
      }

      return acc;
    }, {} as Record<string, any>);

    // Calculate average latencies
    Object.values(stats).forEach((stat: any) => {
      if (stat.latencies.length > 0) {
        stat.avgLatency = Math.round(
          stat.latencies.reduce((sum: number, lat: number) => sum + lat, 0) / stat.latencies.length
        );
      }
      delete stat.latencies;
    });

    res.json({
      success: true,
      healthLogs,
      statistics: Object.values(stats),
    });
  } catch (error: any) {
    logger.error("Failed to get API health", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve API health",
      error: error.message,
    });
  }
});

/**
 * POST /api/monitoring/audit
 * Log an audit event
 */
router.post("/audit", async (req: Request, res: Response) => {
  try {
    const validated = insertAuditLogSchema.parse({
      ...req.body,
      // Auto-populate actor info from request if not provided
      userId: req.body.userId || (req.user as any)?.id,
      ipAddress: req.body.ipAddress || req.ip,
      userAgent: req.body.userAgent || req.headers["user-agent"],
    });

    const auditLog = await monitoringStorage.logAudit(validated);

    res.status(201).json({
      success: true,
      auditLog,
    });
  } catch (error: any) {
    logger.error("Failed to log audit event", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to log audit event",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/audit
 * Get audit logs with filtering
 */
router.get("/audit", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      resource,
      action,
      startTime,
      endTime,
      limit,
    } = req.query;

    const auditLogs = await monitoringStorage.getAuditLogs({
      userId: userId as string | undefined,
      resource: resource as string | undefined,
      action: action as string | undefined,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      auditLogs,
      total: auditLogs.length,
    });
  } catch (error: any) {
    logger.error("Failed to get audit logs", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs",
      error: error.message,
    });
  }
});

/**
 * POST /api/monitoring/metrics
 * Log a system metric
 */
router.post("/metrics", async (req: Request, res: Response) => {
  try {
    const validated = insertSystemMetricSchema.parse(req.body);
    const metric = await monitoringStorage.logMetric(validated);

    res.status(201).json({
      success: true,
      metric,
    });
  } catch (error: any) {
    logger.error("Failed to log metric", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to log metric",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/metrics/:metricName
 * Get metrics for a specific metric name
 */
router.get("/metrics/:metricName", async (req: Request, res: Response) => {
  try {
    const { metricName } = req.params;
    const { service, hours } = req.query;

    const metrics = await monitoringStorage.getMetrics(
      metricName,
      service as string | undefined,
      hours ? parseInt(hours as string) : undefined
    );

    res.json({
      success: true,
      metrics,
      total: metrics.length,
    });
  } catch (error: any) {
    logger.error("Failed to get metrics", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve metrics",
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Get aggregated dashboard data
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent errors
    const recentErrors = await monitoringStorage.getErrors({
      startTime: last24Hours,
      limit: 100,
    });

    // Get error groups
    const errorGroups = await monitoringStorage.getErrorGroups({
      status: "open",
      limit: 20,
    });

    // Get API health
    const apiHealthRaw = await monitoringStorage.getApiHealthStatus(undefined, 1);

    // Calculate statistics
    const errorStats = {
      total: recentErrors.length,
      critical: recentErrors.filter(e => e.severity === "critical").length,
      high: recentErrors.filter(e => e.severity === "high").length,
      medium: recentErrors.filter(e => e.severity === "medium").length,
      low: recentErrors.filter(e => e.severity === "low").length,
      frontend: recentErrors.filter(e => e.source === "frontend").length,
      backend: recentErrors.filter(e => e.source === "backend").length,
    };

    // Aggregate API health by service
    const serviceHealthMap = new Map<string, {
      service: string;
      status: string;
      avgLatency: number;
      lastCheck: Date | null;
      lastFailure: string | null;
      totalChecks: number;
      successfulChecks: number;
    }>();

    for (const health of apiHealthRaw) {
      const existing = serviceHealthMap.get(health.service) || {
        service: health.service,
        status: 'healthy',
        avgLatency: 0,
        lastCheck: null,
        lastFailure: null,
        totalChecks: 0,
        successfulChecks: 0,
      };

      existing.totalChecks++;
      if (health.status === 'healthy') {
        existing.successfulChecks++;
      }
      existing.avgLatency += health.latencyMs || 0;
      
      // Update last check time
      if (!existing.lastCheck || (health.checkedAt && health.checkedAt > existing.lastCheck)) {
        existing.lastCheck = health.checkedAt;
        // Update overall status based on most recent check
        existing.status = health.status;
        if (health.status !== 'healthy') {
          existing.lastFailure = health.failureReason || health.errorMessage || 'Unknown failure';
        }
      }

      serviceHealthMap.set(health.service, existing);
    }

    // Calculate average latency per service
    const apiHealth = Array.from(serviceHealthMap.values()).map(service => ({
      ...service,
      avgLatency: service.totalChecks > 0 ? Math.round(service.avgLatency / service.totalChecks) : 0,
      successRate: service.totalChecks > 0 ? (service.successfulChecks / service.totalChecks * 100).toFixed(2) : '0.00',
    }));

    res.json({
      success: true,
      dashboard: {
        errorStats,
        recentErrors: recentErrors.slice(0, 10),
        errorGroups,
        apiHealth,
        lastUpdated: now,
      },
    });
  } catch (error: any) {
    logger.error("Failed to get dashboard data", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard data",
      error: error.message,
    });
  }
});

export default router;
