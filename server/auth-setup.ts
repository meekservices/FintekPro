import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { storage } from "./storage";
import { validateSessionPortal } from "./subdomain-middleware";

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

  // CRITICAL: Trust proxy must be set BEFORE session middleware.
  // express-session uses req.secure (which respects trust proxy) to decide whether
  // to set the Secure flag on the cookie at response time.
  app.set("trust proxy", true);

  const cookieOptions: session.CookieOptions = {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // SameSite=None is required because the app is served through a CDN proxy
    // (Firebase Hosting → Cloud Run). SameSite=Lax blocks cookies on some
    // cross-site navigations in this architecture.
    // SameSite=None REQUIRES Secure=true (which we set in production above).
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    // No domain attribute: cookie is host-only, scoped to exact subdomain.
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

  // 4. Trust Proxy Configuration — already set before session middleware above.
  // app.set("trust proxy", true); // MOVED UP

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
        console.warn(`[PASSPORT] deserializeUser: user ${id} NOT FOUND in DB → session invalid`);
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      console.error(`[PASSPORT] deserializeUser ERROR for id ${id}:`, err);
      done(err);
    }
  });

  console.log("✅ [AUTH_SETUP] Session and Passport middleware initialized!");

  // 8. Session Debug Endpoint (accessible to all, reveals only non-sensitive info)
  app.get('/api/session-debug', (req: Request, res: Response) => {
    const hasSession = !!req.session;
    const sessionID = req.sessionID || null;
    const passportUser = (req.session as any)?.passport?.user || null;
    const portalType = (req.session as any)?.portalType || null;
    const isAuthenticated = req.isAuthenticated();
    const userId = (req as any).user?.id || null;
    const cookieHeader = req.headers.cookie || '(no cookie sent)';
    const hasFintekCookie = cookieHeader.includes('fintekpro.sid');
    
    console.log(`[SESSION_DEBUG] sid=${sessionID} | hasSession=${hasSession} | passport.user=${passportUser} | isAuth=${isAuthenticated} | portal=${portalType} | cookie_present=${hasFintekCookie}`);
    
    res.json({
      hasSession,
      sessionID,
      passportUser,
      portalType,
      isAuthenticated,
      userId,
      hasFintekCookie,
      cookieNames: cookieHeader.split(';').map((c: string) => c.trim().split('=')[0]).filter(Boolean),
    });
  });
}
