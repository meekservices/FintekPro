import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import PostgresSessionStore from "connect-pg-simple";
import { pool } from "./db";
import { validateSessionPortal } from "./subdomain-middleware";

const PostgresStore = PostgresSessionStore(session);

// Extend express-session to include passport property
declare module "express-session" {
  interface SessionData {
    passport: {
      user: string;
    };
    portalType?: string;
  }
}

/**
 * Global authentication middleware to check if a user is logged in.
 * Exported for use in other route files.
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized", message: "Please log in to continue" });
}

export async function setupAuth(app: Express) {
  // 1. Session Store Configuration
  // We use the centralized storage.sessionStore instance to ensure pool consistency
  const sessionStore = storage.sessionStore;

  // 2. Cookie Configuration for Multi-Portal Persistence
  // CRITICAL: We set the domain to '.fintekpro.com' so the session cookie
  // is shared across agent.fintekpro.com, partner.fintekpro.com, etc.
  const cookieOptions: session.CookieOptions = {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Required for cross-subdomain navigation
    path: "/",
  };

  // In production, set the domain attribute for SSO across subdomains
  if (process.env.NODE_ENV === "production") {
    const rawDomain = process.env.SESSION_COOKIE_DOMAIN || process.env.CUSTOM_DOMAIN;
    const hostname = rawDomain
      ?.replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname && hostname.includes(".") && !hostname.endsWith(".run.app")) {
      cookieOptions.domain = hostname.startsWith(".") ? hostname : `.${hostname}`;
      console.log(`[AUTH_SETUP] Session cookie scoped to ${cookieOptions.domain}`);
    } else {
      console.warn("[AUTH_SETUP] SESSION_COOKIE_DOMAIN/CUSTOM_DOMAIN not set; using host-only session cookie.");
    }
  }

  const sessionSecret = process.env.SESSION_SECRET || (!process.env.NODE_ENV || process.env.NODE_ENV !== "production"
    ? process.env.REPL_ID || "fintek-secure-session-secret-2024"
    : undefined);

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be configured in production.");
  }

  // 3. Register Session Middleware
  app.use(
    session({
      name: "fintekpro.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: sessionStore,
      cookie: cookieOptions,
      proxy: true,
    })
  );

  // 4. Trust Proxy Configuration
  app.set("trust proxy", true);

  // 5. Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // 6. Portal Context Validation
  // Ensure that the session portal context matches the current subdomain
  app.use(validateSessionPortal);

  // 7. Serialize/Deserialize User for persistent sessions
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  console.log("✅ [AUTH_SETUP] Session and Passport middleware initialized!");
}
