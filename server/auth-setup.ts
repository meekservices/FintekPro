import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import pg from 'pg';
import { storage } from "./storage";
import { PANConsentService } from "./services/pan-consent-service";

let cachedSessionMiddleware: any = null;

export function getSession() {
  if (cachedSessionMiddleware) return cachedSessionMiddleware;
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const idleTimeoutMs        = 15 * 60 * 1000; // 15 minutes - RBI Digital Lending Guidelines (customer portal)
  const agentIdleTimeoutMs   =  8 * 60 * 60 * 1000; // 8 hours - agent/admin/partner back-office portals
  const PRIVILEGED_ROLES = ['agent', 'admin', 'partner', 'compliance_officer', 'super_admin', 'sub_agent', 'associate'];
  const pgStore = connectPg(session);
  
  const sessionDbUrl =
    process.env.PRODUCTION_DATABASE_URL ||
    process.env.DATABASE_URL;

  const sessionPool = new pg.Pool({
    connectionString: sessionDbUrl,
    max: 10,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: true,
    statement_timeout: 5000,
  });
  
  sessionPool.on('error', (err: Error) => {
    console.error('[Session Pool] Unexpected error on idle client:', err.message);
  });
  
  const sessionStore = new pgStore({
    pool: sessionPool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    pruneSessionInterval: 60 * 60,
  });
  
  sessionStore.on('error', (error: Error) => {
    console.log('[Session Store] Connection error (will auto-retry):', error?.message || String(error));
  });
  
  const isProduction = process.env.NODE_ENV === "production";
  const customDomain = process.env.CUSTOM_DOMAIN || 'fintekpro.com';
  
  // Set domain for session cookie to share across subdomains
  // CRITICAL: Must start with a dot (e.g. .fintekpro.com) to be shared across subdomains
  const cookieDomain = isProduction ? (customDomain.startsWith('.') ? customDomain : `.${customDomain}`) : undefined;
  console.log(`[Session] Initializing session with domain: ${cookieDomain || 'localhost'} (Source: ${customDomain})`);
  
  const sessionMiddleware = session({
    name: 'fintekpro.sid',
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: sessionTtl,
      path: '/',
      domain: cookieDomain,
    },
  });
  
  const middleware = (req: any, res: any, next: any) => {
    sessionMiddleware(req, res, (err: any) => {
      if (err) {
        console.log('[Session] Error initializing session:', err.message);
        return next();
      }
      
      if (req.session && (req.session as any).passport?.user) {
        const now = Date.now();
        const lastActivity = (req.session as any).lastActivity || now;
        const timeSinceLastActivity = now - lastActivity;

        const resolveTimeout = async (): Promise<number> => {
          if ((req.session as any).sessionIdleTimeoutMs) {
            return (req.session as any).sessionIdleTimeoutMs;
          }
          try {
            const userId = (req.session as any).passport.user as string;
            const user = await storage.getUser(userId);
            const roles: string[] = (user as any)?.roles || ((user as any)?.role ? [(user as any).role] : []);
            const isPrivileged = roles.some((r: string) => PRIVILEGED_ROLES.includes(r));
            const timeout = isPrivileged ? agentIdleTimeoutMs : idleTimeoutMs;
            (req.session as any).sessionIdleTimeoutMs = timeout;
            return timeout;
          } catch {
            return idleTimeoutMs;
          }
        };

        resolveTimeout().then((effectiveTimeout) => {
          if (timeSinceLastActivity > effectiveTimeout) {
            console.log(`[Session] Idle timeout exceeded - destroying session`);
            return req.session.destroy(() => {
              res.clearCookie('fintekpro.sid', { path: '/' });
              next();
            });
          }
          (req.session as any).lastActivity = now;
          next();
        }).catch(() => {
          (req.session as any).lastActivity = now;
          next();
        });
        return;
      }
      
      next();
    });
  };
  
  cachedSessionMiddleware = middleware;
  return middleware;
}

export async function setupAuth(app: Express) {
  app.set(\"trust proxy\", true);
  
  const isViteDevRoute = (path: string) => {
    return path.startsWith('/@') || 
           path.startsWith('/src/') || 
           path.startsWith('/node_modules/') || 
           path.endsWith('.tsx') || 
           path.endsWith('.ts') ||
           path.endsWith('.jsx') ||
           path.endsWith('.js') && path.includes('/src/');
  };
  
  app.use((req, res, next) => {
    if (isViteDevRoute(req.path)) return next();
    getSession()(req, res, next);
  });
  
  app.use((req, res, next) => {
    if (isViteDevRoute(req.path)) return next();
    passport.initialize()(req, res, next);
  });
  
  app.use((req, res, next) => {
    if (isViteDevRoute(req.path) || !req.session) return next();
    passport.session()(req, res, next);
  });

  app.get(\"/api/user\", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(404).json({ message: \"User not found\" });

    let panNumber: string | null = null;
    try {
      const userProfile = await storage.getUserProfile(user.id);
      if (userProfile?.panNumber) {
        if (userProfile.panNumber.includes(':')) {
          try {
            panNumber = await PANConsentService.decryptPAN(userProfile.panNumber);
          } catch {
            panNumber = userProfile.panNumber;
          }
        } else {
          panNumber = userProfile.panNumber;
        }
      }
    } catch (err) {
      console.error(\"Error fetching user profile PAN:\", err);
    }

    res.json({
      id: user.id,
      userId: user.userId,
      email: user.email,
      mobile: user.mobile,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt,
      panNumber: panNumber,
    });
  });

  passport.serializeUser((user: any, cb) => {
    cb(null, user.id);
  });

  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      cb(null, user || false);
    } catch (err) {
      cb(err);
    }
  });

  app.get(\"/api/logout\", (req, res) => {
    req.logout(() => {
      res.redirect(\"/\");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: \"Unauthorized\" });
  }
  next();
};
