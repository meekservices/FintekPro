import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes";
import { setupVite, log as logRoute } from "./vite";
import { serveStatic } from "./static";
import { testConnection } from "./db";
import { logger } from "./logger";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let resBody: any = null;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    resBody = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (resBody) {
        logLine += ` :: ${JSON.stringify(resBody)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.substring(0, 79) + "…";
      }

      logRoute(logLine);
    }
  });

  next();
});

(async () => {
  logger.info("[Server] 🚀 Starting FintekPro Core...");

  // 1. Initialize Auth and Session
  try {
    setupAuth(app);
    logger.info("[Auth] ✅ Session and Passport initialized");
  } catch (err) {
    logger.error("[Auth] ❌ Failed to initialize auth", err);
  }

  // 2. Database Connection Check
  // We don't block the server boot if DB is down (to allow health checks to pass)
  // but we log the status clearly.
  testConnection()
    .then(res => {
      if (res.success) {
        logger.info(`[DB] ✅ Database connection verified at ${res.timestamp}`);
      }
    })
    .catch(err => {
      logger.error("[DB] ❌ Database connection failed during boot", err);
      logger.warn("[DB] ⚠️ Server will continue in degraded mode.");
    });

  // 3. Register API Routes
const server = await registerRoutes(app);

  // 4. Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    logger.error(`[Error] ${status}: ${message}`, err);
    res.status(status).json({ message });
  });

  // 5. Setup Frontend (Vite in dev, Static in prod)
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 6. Start Listening
  const PORT = Number(process.env.PORT) || 8080;
  server.listen(PORT, "0.0.0.0", () => {
    logRoute(`serving on port ${PORT}`);
  });
})();
