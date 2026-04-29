import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { bootState } from "./utils/boot-state";
import path from "path";
import fs from "fs";

/**
 * Phase 0: Environment & Core Configuration
 * Setup base application state and global handlers.
 */
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Global Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let resSent = false;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (res.get("X-Response-Time")) {
        logLine += ` (saw ${res.get("X-Response-Time")}ms)`;
      }
      log(logLine);
    }
  });

  next();
});

/**
 * Phase 1: Database Connectivity
 * Attempt to verify DB connection but proceed even on failure to ensure
 * SPA availability for status reporting/debugging.
 */
async function initializeDatabase() {
  bootState.setPhase(1, "connecting");
  try {
    log("Phase 1: Attempting database connectivity check...");
    await db.execute(sql`SELECT 1`);
    log("Phase 1: Database connection verified successfully.");
    bootState.setPhase(1, "ready");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Phase 1 WARNING: Database connectivity failed: ${msg}`);
    log("Proceeding to Phase 2 in degraded mode (SPA will remain active).");
    bootState.setPhase(1, "error", msg);
  }
}

/**
 * Phase 2: Route Registration
 * Attaches API endpoints and system handlers.
 */
async function initializeRoutes() {
  bootState.setPhase(2, "registering");
  try {
    log("Phase 2: Initializing API routes...");
    const server = registerRoutes(app);
    log("Phase 2: API routes registered.");
    bootState.setPhase(2, "ready");
    return server;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Phase 2 CRITICAL: Route registration failed: ${msg}`);
    bootState.setPhase(2, "error", msg);
    throw error;
  }
}

/**
 * Phase 3: Error Handling Middleware
 * Global catch-all for API and system errors.
 */
function setupErrorHandling() {
  bootState.setPhase(3, "setting_up");
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log errors but keep them concise in production
    if (process.env.NODE_ENV !== 'production') {
      console.error("[Runtime Error]", err);
    } else if (status >= 500) {
      log(`Runtime Error ${status}: ${message}`);
    }

    res.status(status).json({ message });
  });
  log("Phase 3: Global error handlers attached.");
  bootState.setPhase(3, "ready");
}

/**
 * Phase 4: Frontend Integration (Vite/Static)
 * Handles SPA serving logic based on environment.
 */
async function initializeFrontend() {
  bootState.setPhase(4, "serving");
  try {
    if (app.get("env") === "development") {
      log("Phase 4: Setting up Vite development middleware...");
      await setupVite(app);
      log("Phase 4: Vite middleware active.");
    } else {
      log("Phase 4: Setting up static asset serving (production)...");
      serveStatic(app);
      log("Phase 4: Static serving configured.");
    }
    bootState.setPhase(4, "ready");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Phase 4 WARNING: Frontend setup issue: ${msg}`);
    bootState.setPhase(4, "error", msg);
  }
}

/**
 * Main Boot Sequence
 */
(async () => {
  log("Starting Hybrid Architecture Boot Sequence...");
  
  try {
    // 1. DB (Non-blocking)
    initializeDatabase();

    // 2. API Routes
    const server = await initializeRoutes();

    // 3. Error Handlers
    setupErrorHandling();

    // 4. Frontend (SPA)
    await initializeFrontend();

    // Phase 5: Execution Readiness
    bootState.setPhase(5, "starting");
    const PORT = Number(process.env.PORT) || 5000;
    
    server.listen(PORT, "0.0.0.0", () => {
      log(`Phase 5: Server listening on port ${PORT}`);
      log("Boot Sequence Complete. System is LIVE.");
      bootState.setPhase(5, "ready");
      bootState.setPhase(6, "ready"); // Overall system ready
    });

  } catch (criticalError) {
    log("FATAL: Boot sequence aborted due to critical error.");
    console.error(criticalError);
    bootState.setPhase(6, "error", criticalError instanceof Error ? criticalError.message : String(criticalError));
    process.exit(1);
  }
})();
