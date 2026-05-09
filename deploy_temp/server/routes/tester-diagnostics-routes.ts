import { Router, Request, Response } from "express";
import { db } from "../db";
import { errorLedger } from "../../shared/schema";
import { desc, sql, count, eq } from "drizzle-orm";
import os from "os";

const router = Router();

const SERVER_VERSION = "1.0.0";

function requireTesterRole(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const roles: string[] = user.roles || [];
  if (!roles.includes("tester") && !roles.includes("superadmin")) {
    return res.status(403).json({ error: "Tester role required" });
  }
  next();
}

router.use(requireTesterRole);

router.get("/", async (_req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const deploymentUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : null;

    let dbPoolStats = null;
    try {
      const result = await db.execute(sql`SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'`);
      dbPoolStats = { activeConnections: result.rows?.[0]?.active_connections ?? null };
    } catch {
      dbPoolStats = { error: "Unable to fetch pool stats" };
    }

    res.json({
      serverVersion: SERVER_VERSION,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: process.uptime(),
        formatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m ${Math.floor(process.uptime() % 60)}s`,
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      },
      system: {
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
        platform: os.platform(),
        arch: os.arch(),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        replId: process.env.REPL_ID || null,
        replSlug: process.env.REPL_SLUG || null,
        deploymentUrl,
      },
      dbPool: dbPoolStats,
    });
  } catch (err) {
    console.error("[TesterDiagnostics] Error fetching diagnostics:", err);
    res.status(500).json({ error: "Failed to fetch system diagnostics" });
  }
});

router.get("/errors", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const errors = await db
      .select()
      .from(errorLedger)
      .orderBy(desc(errorLedger.createdAt))
      .limit(limit);

    const grouped: Record<string, { count: number; errors: typeof errors }> = {};
    for (const error of errors) {
      const mod = error.module || "unknown";
      if (!grouped[mod]) {
        grouped[mod] = { count: 0, errors: [] };
      }
      grouped[mod].count++;
      grouped[mod].errors.push(error);
    }

    const moduleCounts = await db
      .select({
        module: errorLedger.module,
        errorCount: count(),
      })
      .from(errorLedger)
      .groupBy(errorLedger.module)
      .orderBy(desc(count()));

    res.json({
      totalFetched: errors.length,
      byModule: grouped,
      moduleSummary: moduleCounts,
    });
  } catch (err) {
    console.error("[TesterDiagnostics] Error fetching errors:", err);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

router.get("/errors/export", async (_req: Request, res: Response) => {
  try {
    const errors = await db
      .select()
      .from(errorLedger)
      .orderBy(desc(errorLedger.createdAt))
      .limit(500);

    const deploymentUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : null;

    const exportData = {
      exportedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      replitContext: {
        replId: process.env.REPL_ID || null,
        replSlug: process.env.REPL_SLUG || null,
        deploymentUrl,
      },
      errors,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="errors_export_${new Date().toISOString().split("T")[0]}.json"`,
    );
    res.json(exportData);
  } catch (err) {
    console.error("[TesterDiagnostics] Error exporting errors:", err);
    res.status(500).json({ error: "Failed to export errors" });
  }
});

router.post("/report", async (req: Request, res: Response) => {
  try {
    const { title, description, stepsToReproduce, screenshots, environment, browserInfo, severity, module } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "title and description are required" });
    }

    const user = (req as any).user;

    const [report] = await db
      .insert(errorLedger)
      .values({
        errorCode: "TESTER_REPORT",
        severity: severity || "info",
        source: "tester_report",
        module: module || "tester_submitted",
        message: `[Tester Report] ${title}: ${description}`,
        stackTrace: stepsToReproduce
          ? `Steps to Reproduce:\n${Array.isArray(stepsToReproduce) ? stepsToReproduce.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n") : stepsToReproduce}`
          : null,
        clientId: null,
        agentId: user?.id || null,
        environment: environment || (process.env.NODE_ENV === "production" ? "production" : "development"),
        metadata: {
          reportedBy: user?.id || "unknown",
          reporterUsername: user?.username || "unknown",
          screenshots: screenshots || [],
          browserInfo: browserInfo || null,
          reportType: "tester_submission",
        },
        status: "open",
        occurrenceCount: 1,
      })
      .returning();

    res.status(201).json({
      success: true,
      reportId: report.id,
      message: "Tester report submitted successfully",
    });
  } catch (err) {
    console.error("[TesterDiagnostics] Error submitting report:", err);
    res.status(500).json({ error: "Failed to submit tester report" });
  }
});

router.get("/health-check", async (_req: Request, res: Response) => {
  try {
    const checks: Record<string, { status: string; latencyMs?: number; details?: any }> = {};

    const dbStart = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = { status: "healthy", latencyMs: Date.now() - dbStart };
    } catch (err: any) {
      checks.database = { status: "unhealthy", latencyMs: Date.now() - dbStart, details: err.message };
    }

    try {
      const sessionResult = await db.execute(sql`SELECT count(*) as count FROM sessions`);
      checks.sessionStore = {
        status: "healthy",
        details: { activeSessions: sessionResult.rows?.[0]?.count ?? 0 },
      };
    } catch (err: any) {
      checks.sessionStore = { status: "unhealthy", details: err.message };
    }

    const apiKeys: Record<string, string> = {
      finnhub: "FINNHUB_API_KEY",
      polygon: "POLYGON_API_KEY",
      alpaca: "ALPACA_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
      cashfree: "CASHFREE_APP_ID",
      twilio: "TWILIO_AUTH_TOKEN",
      sandbox: "SANDBOX_API_KEY",
    };

    const externalApis: Record<string, { status: string }> = {};
    for (const [name, envVar] of Object.entries(apiKeys)) {
      externalApis[name] = {
        status: process.env[envVar] ? "configured" : "not_configured",
      };
    }
    checks.externalApis = { status: "checked", details: externalApis };

    const allHealthy = Object.entries(checks)
      .filter(([key]) => key !== "externalApis")
      .every(([, val]) => val.status === "healthy");

    res.json({
      overall: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (err) {
    console.error("[TesterDiagnostics] Health check failed:", err);
    res.status(500).json({ overall: "unhealthy", error: "Health check failed" });
  }
});

export default router;
