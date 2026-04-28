import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, registerSPACatchAll } from "./vite";
import path from "path";
import fs from "fs";
import { logger } from "./logger";
import { APP_VERSION } from "@shared/version";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Tracking boot state for health checks and diagnostics
const bootState = {
  startedAt: new Date(),
  dbConnected: false,
  routesReady: false,
  error: null as string | null
};

/**
 * Health Check Endpoint
 * Critical for Cloud Run / K8s probes.
 * Returns 200 even if still booting, to prevent container restarts.
 */
app.get("/health", (req, res) => {
  const uptime = Math.floor((Date.now() - bootState.startedAt.getTime()) / 1000);
  res.status(200).json({
    status: bootState.error ? "error" : (bootState.routesReady ? "healthy" : "booting"),
    version: APP_VERSION,
    uptime: `${uptime}s`,
    dbConnected: bootState.dbConnected,
    error: bootState.error
  });
});

/**
 * Diagnostics Endpoint
 * Provides detailed boot logs for troubleshooting.
 */
const bootLogs: string[] = [];
function logBootProgress(msg: string) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  bootLogs.push(entry);
  console.log(entry);
}

app.get("/api/diagnostics/boot-logs", (req, res) => {
  res.json({
    state: bootState,
    logs: bootLogs
  });
});

(async () => {
  try {
    logBootProgress("Starting server initialization...");
    
    // Serve static assets IMMEDIATELY in production
    if (process.env.NODE_ENV === "production") {
      logBootProgress("Production environment detected. Serving static assets...");
      serveStatic(app);
      // Register SPA catch-all early to avoid "Cannot GET /"
      registerSPACatchAll(app);
    }

    // Initialize routes and database
    logBootProgress("Registering application routes...");
    const server = await registerRoutes(app);
    bootState.routesReady = true;
    bootState.dbConnected = true; // registerRoutes handles DB connection
    logBootProgress("All routes registered successfully.");

    // Final Express error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    }

    const PORT = Number(process.env.PORT) || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      logBootProgress(`Server running on port ${PORT} (v${APP_VERSION})`);
    });

  } catch (error: any) {
    console.error("❌ [FATAL] Server initialization failed:", error);
    bootState.error = `Boot Error: ${error?.message || String(error)}`;
    
    // In production, try to keep the SPA accessible even on boot failure
    if (process.env.NODE_ENV === "production") {
      try {
        registerSPACatchAll(app);
      } catch (_) { /* idempotent */ }
    }
    // REMOVED: bootState.routesReady = true; -> Do not lie about readiness on fatal error.
  }
})();
