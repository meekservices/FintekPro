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

  // 2. Cookie Configuration
  // DO NOT set a domain on the session cookie. A host-only cookie (no Domain attribute)
  // is scoped to exactly the current subdomain (e.g. agent.fintekpro.com) and is the
  // most reliable approach for single-subdomain portals. Setting Domain=fintekpro.com
  // causes browsers to treat it as a cross-subdomain cookie with different send rules
  // that were silently breaking session persistence.
  console.log("[AUTH_SETUP] Session cookie: host-only (no Domain attribute) for maximum reliability");

  const cookieOptions: session.CookieOptions = {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No domain attribute: cookie is host-only, scoped to exact subdomain.
    // This is more reliable than setting Domain=fintekpro.com for single-portal use.
  };

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

  // 3b. No per-request domain override needed — host-only cookies don't require it.

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
