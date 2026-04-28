import { createServer } from "http";
import express, { type Request, Response, NextFunction } from "express";
import { setupAuth } from "./auth";
import { setupRoutes } from "./routes";
import { setupSessionAuth } from "./auth-setup";
import { storage } from "./storage";
import { apiResponse } from "./utils/responses";
import { logger } from "./logger";
import { db } from "./db";
import { sql } from "drizzle-orm";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { registerSPACatchAll } from "./spa-handler";
import { subdomainMiddleware } from "./subdomain-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Boot sequence tracking
const bootState = {
  dbConnected: false,
  migrationsRun: false,
  routesReady: false,
  error: null as string | null
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enhanced logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let resSent = false;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Middleware to expose boot status (helpful for load balancer / health checks)
app.get("/api/health/boot", (req, res) => {
  if (bootState.error) {
    return res.status(500).json({ status: "error", ...bootState });
  }
  const isReady = bootState.dbConnected && bootState.routesReady;
  return res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "booting",
    ...bootState
  });
});

(async () => {
  try {
    console.log('🚀 [BOOT] Starting FintekPro Application...');

    // 1. Database Connection Check (with timeout)
    console.log('⏳ [BOOT] Step 1: Verifying database connection...');
    try {
      const dbCheck = await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 5000))
      ]);
      bootState.dbConnected = true;
      console.log('✅ [BOOT] Database connected successfully.');
    } catch (dbErr: any) {
      console.error('⚠️ [BOOT] Database connection failed:', dbErr.message);
      // We don't exit here anymore - we allow the app to boot so the health check
      // and SPA catch-all can serve maintenance/error pages.
      bootState.error = `Database connection failed: ${dbErr.message}`;
    }

    // 2. Authentication Setup
    console.log('⏳ [BOOT] Step 2: Configuring session and authentication...');
    setupSessionAuth(app);
    setupAuth(app);
    console.log('✅ [BOOT] Authentication configured.');

    // 3. Subdomain and Route Setup
    console.log('⏳ [BOOT] Step 3: Registering subdomains and API routes...');
    app.use(subdomainMiddleware);
    const server = await setupRoutes(app);
    bootState.routesReady = true;
    console.log('✅ [BOOT] API routes and subdomains registered.');

    // 4. Production Static File Serving & SPA Catch-all
    if (process.env.NODE_ENV === "production") {
      console.log('⏳ [BOOT] Step 4: Configuring production static assets...');
      const publicPath = path.resolve(__dirname, "..", "dist", "public");
      
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        console.log(`✅ [BOOT] Serving static assets from: ${publicPath}`);
      } else {
        console.warn(`⚠️ [BOOT] Static assets directory NOT FOUND: ${publicPath}`);
      }

      // REGISTER SPA CATCH-ALL
      // This is critical: if this is missing, users get "Cannot GET /"
      console.log('⏳ [BOOT] Step 5: Registering SPA catch-all handler...');
      registerSPACatchAll(app);
      console.log('✅ [BOOT] SPA catch-all registered.');
    }

    // 5. Error Handling Middleware (must be last)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      logger.error(`[Express Error] ${status} - ${message}`, { stack: err.stack });
      res.status(status).json({ message });
    });

    const port = process.env.PORT || 5000;
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 [BOOT] Server is running on port ${port}`);
      console.log(`📡 [BOOT] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error: any) {
    console.error('❌ [FATAL] Server initialization failed:', error);
    bootState.error = `Boot Error: ${error?.message || String(error)}`;
    // Ensure the SPA catch-all is registered even if boot failed partway through
    // so users see the frontend (with its own error handling) rather than "Cannot GET /"
    if (process.env.NODE_ENV === 'production') {
      try {
        registerSPACatchAll(app);
      } catch (_) { /* already registered — safe to ignore */ }
    }
    // REMOVED: bootState.routesReady = true; -> Do not lie about readiness on fatal error.
  }
})();
