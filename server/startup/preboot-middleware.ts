import cors from "cors";
import express, { type Express } from "express";
import { APP_VERSION } from "../../shared/version";
import { bootState } from "../utils/boot-state";

const corsAllowedOrigins = [
  "https://fintekpro.com",
  "https://www.fintekpro.com",
  "https://admin.fintekpro.com",
  "https://agent.fintekpro.com",
  "https://partner.fintekpro.com",
  "https://ins.fintekpro.com",
  "https://fintekpro-app-7f3fb64pqq-el.a.run.app",
  "https://fintekpro-app-124901641600.asia-south1.run.app",
];

function getAllowedOrigins() {
  if (process.env.NODE_ENV === "production") {
    return corsAllowedOrigins;
  }

  return [
    ...corsAllowedOrigins,
    "http://localhost:5173",
    "http://localhost:5000",
    "http://0.0.0.0:5000",
  ];
}

function isAllowedCorsOrigin(origin: string | undefined, allowedOrigins: string[]) {
  if (!origin) return true;

  return (
    allowedOrigins.includes(origin) ||
    origin.endsWith(".fintekpro.com") ||
    (origin.includes("fintekpro-app") && origin.includes(".run.app")) ||
    origin.includes("replit.dev") ||
    origin.includes("repl.co")
  );
}

export function registerPrebootMiddleware(app: Express) {
  // Redirect www. subdomain to non-www canonical domain (e.g. www.fintekpro.com -> fintekpro.com)
  app.use((req, res, next) => {
    const host = req.get("host") || "";
    if (host.toLowerCase().startsWith("www.")) {
      const newHost = host.substring(4); // Strip 'www.'
      // Check if SSL is terminated at proxy (Cloud Run / Firebase)
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      
      console.log(`[WWW_REDIRECT] Redirecting ${host}${req.originalUrl} to ${newHost}${req.originalUrl}`);
      return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      booting: !bootState.routesReady,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));

  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin, getAllowedOrigins())) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["X-CSRF-Token"],
  }));

  app.get("/api/boot-status", (_req, res) => {
    res.json({
      ready: bootState.routesReady,
      error: bootState.error,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  });
}
