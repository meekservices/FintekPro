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
  // We use Postgres for session persistence to survive Cloud Run container restarts
  const sessionStore = new PostgresStore({
    pool,
    tableName: "sessions",
    createTableIfMissing: true,
  });

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
    // Priority: CUSTOM_DOMAIN env var -> .fintekpro.com
    // Robust sanitization: trim whitespace and hidden characters
    const rawDomain = (process.env.CUSTOM_DOMAIN || "fintekpro.com").trim();
    
    // Validate domain format to prevent TypeError: option domain is invalid
    // Valid characters: a-z, 0-9, dot, and hyphen
    if (rawDomain && /^[a-z0-9.-]+$/i.test(rawDomain)) {
      cookieOptions.domain = rawDomain.startsWith(".") ? rawDomain : `.${rawDomain}`;
      console.log(`🛡️  Session Cookie Domain set to: ${cookieOptions.domain}`);
    } else {
      console.warn(`⚠️ [AUTH_SETUP] Invalid CUSTOM_DOMAIN detected: "${rawDomain}". Falling back to default browser scoping.`);
      // If domain is invalid, we don't set cookieOptions.domain, 
      // letting the browser scope it to the current host automatically.
    }
  }

  // 3. Register Session Middleware
  app.use(
    session({
      name: "fintekpro.sid",
      secret: process.env.SESSION_SECRET || "fintek-secure-session-secret-2024",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: cookieOptions,
      proxy: true, // Required for Cloud Run/Firebase Hosting proxy chain
    })
  );

  // 4. Trust Proxy Configuration
  // Cloud Run and Firebase Hosting use a proxy chain. We must trust them to 
  // correctly parse X-Forwarded-For and X-Forwarded-Proto headers.
  app.set("trust proxy", 1);

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

  console.log("✅ [AUTH_SETUP] Session and Passport middleware initialized");
}
