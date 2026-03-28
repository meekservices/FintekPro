import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import pg from 'pg';
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { generateUniqueUserId, hashPassword } from "./auth";
import { PANConsentService } from "./services/pan-consent-service";

// Custom domains for FintekPro - these need auth strategies even if not in REPLIT_DOMAINS
const CUSTOM_DOMAINS = [
  'fintekpro.com',
  'www.fintekpro.com',
  'admin.fintekpro.com',
  'agent.fintekpro.com',
  'partner.fintekpro.com'
];

// REPLIT_DOMAINS may not be set in production deployments with custom domains
if (!process.env.REPLIT_DOMAINS) {
  console.warn("⚠️ REPLIT_DOMAINS not set - using custom domains only for auth");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

let cachedSessionMiddleware: any = null;

export function getSession() {
  if (cachedSessionMiddleware) return cachedSessionMiddleware;
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const idleTimeoutMs        = 15 * 60 * 1000; // 15 minutes - RBI Digital Lending Guidelines (customer portal)
  const agentIdleTimeoutMs   =  8 * 60 * 60 * 1000; // 8 hours - agent/admin/partner back-office portals
  // Roles that get the extended timeout (not subject to the 15-min RBI customer rule)
  const PRIVILEGED_ROLES = ['agent', 'admin', 'partner', 'compliance_officer', 'super_admin', 'sub_agent', 'associate'];
  const pgStore = connectPg(session);
  
  // Create a dedicated pool for sessions with resilient settings
  // Must use the same DB as the main app so the sessions table exists
  const sessionDbUrl =
    process.env.PRODUCTION_DATABASE_URL ||
    process.env.DATABASE_URL;
  const sessionPool = new pg.Pool({
    connectionString: sessionDbUrl,
    max: 10, // Increased pool size for better availability
    min: 2, // Keep minimum connections alive
    idleTimeoutMillis: 60000, // Close idle connections after 60 seconds
    connectionTimeoutMillis: 30000, // Wait up to 30 seconds for connection (increased)
    allowExitOnIdle: true, // Allow process to exit when pool is idle
    statement_timeout: 5000, // 5 second query timeout
  });
  
  // Handle pool errors gracefully - don't crash on transient errors
  sessionPool.on('error', (err: Error) => {
    console.error('[Session Pool] Unexpected error on idle client:', err.message);
    // Pool will automatically reconnect
  });
  
  let sessionPoolConnections = 0;
  sessionPool.on('connect', () => {
    sessionPoolConnections++;
    if (sessionPoolConnections <= 2 || process.env.NODE_ENV !== 'production') {
      console.log(`[Session Pool] Client connected (${sessionPoolConnections})`);
    }
  });
  
  const sessionStore = new pgStore({
    pool: sessionPool, // Use dedicated pool instead of connection string
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    errorLog: (error: Error) => {
      const msg = error?.message || String(error) || 'Unknown session store error';
      if (msg.includes('timeout')) {
        console.log('[Session Store] Database timeout (will retry):', msg);
      } else {
        console.log('[Session Store] Database error:', msg);
      }
    },
    pruneSessionInterval: 60 * 60, // Prune expired sessions every hour (in seconds)
  });
  
  // Handle session store errors gracefully - don't throw
  sessionStore.on('error', (error: Error) => {
    console.log('[Session Store] Connection error (will auto-retry):', error?.message || String(error));
  });
  
  // Determine if we're on a custom domain or Replit domain
  const replitDomains = process.env.REPLIT_DOMAINS || '';
  const domainList = replitDomains.split(',').map(d => d.trim());
  const isProduction = process.env.NODE_ENV === "production";
  
  // Check if any domain is fintekpro.com (custom domain)
  const hasCustomDomain = domainList.some(d => d.includes('fintekpro.com'));
  // Check if ONLY replit domains exist (no custom domain)
  const isOnlyReplitDomain = domainList.every(d => d.includes('replit.app') || d.includes('replit.dev'));
  
  // Set domain for custom domains to share cookie across subdomains (admin.fintekpro.com, fintekpro.com)
  // Also check for hardcoded custom domain since REPLIT_DOMAINS may not include it
  const customDomainFromEnv = process.env.CUSTOM_DOMAIN || 'fintekpro.com';
  let cookieDomain: string | undefined = undefined;
  if (hasCustomDomain && !isOnlyReplitDomain) {
    cookieDomain = ".fintekpro.com";
  }
  
  console.log(`[Session] Domains: ${replitDomains}, Custom: ${hasCustomDomain}, Cookie domain: ${cookieDomain || 'dynamic per-request'}`);
  
  // Use a custom session middleware that sets cookie domain based on request Host header
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
      sameSite: isProduction ? "none" : "lax",
      maxAge: sessionTtl,
      path: '/',
      domain: cookieDomain,
    },
  });
  
  const middleware = (req: any, res: any, next: any) => {
    const host = req.get('host') || req.headers.host || '';
    
    // If accessing via fintekpro.com domain, set cookie domain to share across subdomains
    if (host.includes('fintekpro.com')) {
      // Override cookie domain for this request
      const originalSetHeader = res.setHeader;
      res.setHeader = function(name: string, value: any) {
        if (name.toLowerCase() === 'set-cookie' && value) {
          // Ensure cookie domain is set to .fintekpro.com for subdomain sharing
          if (Array.isArray(value)) {
            value = value.map((cookie: string) => {
              if (cookie.includes('fintekpro.sid') && !cookie.includes('Domain=')) {
                return cookie.replace(/;?\s*$/, '; Domain=.fintekpro.com');
              }
              return cookie;
            });
          } else if (typeof value === 'string' && value.includes('fintekpro.sid') && !value.includes('Domain=')) {
            value = value.replace(/;?\s*$/, '; Domain=.fintekpro.com');
          }
        }
        return originalSetHeader.call(this, name, value);
      };
    }
    
    // Wrap session middleware with timeout protection
    const sessionTimeout = setTimeout(() => {
      console.log('[Session] Session initialization timeout - continuing without session');
      // Don't call next twice
    }, 15000);
    
    sessionMiddleware(req, res, (err: any) => {
      clearTimeout(sessionTimeout);
      if (err) {
        console.log('[Session] Error initializing session:', err.message);
        return next();
      }
      
      // Server-side idle timeout enforcement
      // Customers (RBI Digital Lending Guidelines): 15 minutes
      // Agents / admins / partners (back-office): 8 hours
      if (req.session && (req.session as any).passport?.user) {
        const now = Date.now();
        const lastActivity = (req.session as any).lastActivity || now;
        const timeSinceLastActivity = now - lastActivity;

        // Resolve effective timeout — cached in session to avoid a DB hit on every request
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
            console.log(`[Session] Role-based timeout set for ${userId}: ${Math.round(timeout / 60000)}m (roles: ${roles.join(',') || 'none'})`);
            return timeout;
          } catch {
            return idleTimeoutMs; // safe default
          }
        };

        resolveTimeout().then((effectiveTimeout) => {
          if (timeSinceLastActivity > effectiveTimeout) {
            console.log(`[Session] Idle timeout exceeded (${Math.round(timeSinceLastActivity / 60000)}m, limit: ${Math.round(effectiveTimeout / 60000)}m) - destroying session`);
            return req.session.destroy((destroyErr: any) => {
              if (destroyErr) {
                console.warn('[Session] Error destroying idle session:', destroyErr.message);
              }
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
        return; // next() will be called inside the promise chain
      }
      
      next();
    });
  };
  
  cachedSessionMiddleware = middleware;
  return middleware;
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any): Promise<string> {
  // First check if user exists by email (unique constraint)
  const existingUserByEmail = claims["email"] 
    ? await storage.getUserByEmail(claims["email"])
    : null;
  
  if (existingUserByEmail) {
    // Update existing user with latest OAuth data
    await storage.updateUser(existingUserByEmail.id, {
      email: claims["email"],
      firstName: claims["first_name"] || existingUserByEmail.firstName,
      lastName: claims["last_name"] || existingUserByEmail.lastName,
      profileImageUrl: claims["profile_image_url"],
    });
    return existingUserByEmail.id;
  } else {
    // Create new user from OAuth data with minimal required fields
    // Drizzle will handle defaults for all other fields
    const userEmail = claims["email"] || null;
    const userId = await generateUniqueUserId(userEmail || undefined);
    const newUser = await storage.createUser({
      userId,
      email: userEmail,
      password: await hashPassword(randomBytes(32).toString('hex')), // Random secure password for OAuth users
      firstName: claims["first_name"] || null,
      lastName: claims["last_name"] || null,
      profileImageUrl: claims["profile_image_url"] || null,
      isEmailVerified: true, // OAuth email is verified
      roles: ['user'],
      isActive: true,
      lastLoginAt: new Date(),
      loginCount: 1,
    });
    
    // Auto-assign to default agent if only one agent exists
    await storage.autoAssignDefaultAgent(newUser.id);
    
    return newUser.id;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  // Skip session/auth middleware for Vite dev routes (HMR, source files)
  const isViteDevRoute = (path: string) => {
    return path.startsWith('/@') ||           // /@react-refresh, /@vite/*, /@fs/*
           path.startsWith('/src/') ||        // /src/*.tsx, /src/*.ts
           path.startsWith('/node_modules/') || // node_modules (Vite serves these)
           path.endsWith('.tsx') || 
           path.endsWith('.ts') ||
           path.endsWith('.jsx') ||
           path.endsWith('.js') && path.includes('/src/');
  };
  
  // Wrap session middleware to skip Vite dev routes
  app.use((req, res, next) => {
    if (isViteDevRoute(req.path)) {
      return next();
    }
    getSession()(req, res, next);
  });
  
  // Wrap passport.initialize to skip Vite dev routes
  app.use((req, res, next) => {
    if (isViteDevRoute(req.path)) {
      return next();
    }
    passport.initialize()(req, res, next);
  });
  
  // Wrap passport.session to skip Vite dev routes
  app.use((req, res, next) => {
    if (isViteDevRoute(req.path)) {
      return next();
    }
    if (!req.session) {
      return next();
    }
    passport.session()(req, res, next);
  });

  // REPL_ID is only present in the Replit runtime environment.
  // On Railway (and other non-Replit hosts) it is undefined, so the
  // openid-client discovery call would throw "clientId must be a non-empty
  // string".  In that case we skip Replit OIDC entirely — users authenticate
  // through local email/mobile credentials (set up in server/auth.ts).
  // Session, passport initialisation and serialize/deserialize are still
  // registered above so local auth continues to work normally.
  if (!process.env.REPL_ID) {
    console.log('[Auth] REPL_ID not set — Replit OIDC skipped (non-Replit host, local auth only)');
    passport.serializeUser((user: Express.User, cb) => {
      cb(null, (user as any).id);
    });
    passport.deserializeUser(async (id: string, cb) => {
      try {
        const user = await storage.getUser(id);
        cb(null, user || false);
      } catch (err) {
        cb(err);
      }
    });
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    // Upsert user and get the database user ID
    const userId = await upsertUser(tokens.claims());
    
    // Get the full user object from database
    const dbUser = await storage.getUser(userId);
    
    if (!dbUser) {
      return verified(new Error("User not found after upsert"));
    }
    
    // Pass the database user to passport
    verified(null, dbUser);
  };

  // Combine REPLIT_DOMAINS with custom domains, ensuring no duplicates
  const replitDomains = process.env.REPLIT_DOMAINS 
    ? process.env.REPLIT_DOMAINS.split(",").map(d => d.trim())
    : [];
  const allDomains = Array.from(new Set([...replitDomains, ...CUSTOM_DOMAINS]));
  
  console.log(`[Auth] Registering strategies for domains: ${allDomains.join(', ')}`);
  
  for (const domain of allDomains) {
    if (!domain) continue; // Skip empty strings
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  // Serialize user by ID (works for both OAuth and local auth)
  passport.serializeUser((user: Express.User, cb) => {
    cb(null, user.id);
  });
  
  // Deserialize user by fetching from database (works for both OAuth and local auth)
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        cb(null, user);
      } else {
        cb(null, false);
      }
    } catch (error) {
      cb(error);
    }
  });

  app.get("/api/login", (req, res, next) => {
    // Try exact hostname first, then fall back to base domain
    let strategyName = `replitauth:${req.hostname}`;
    
    // If strategy doesn't exist for this hostname, try the base domain
    if (!(passport as any)._strategy(strategyName)) {
      // Extract base domain (e.g., admin.fintekpro.com -> fintekpro.com)
      const parts = req.hostname.split('.');
      if (parts.length > 2) {
        const baseDomain = parts.slice(-2).join('.');
        const baseStrategy = `replitauth:${baseDomain}`;
        if ((passport as any)._strategy(baseStrategy)) {
          strategyName = baseStrategy;
        }
      }
    }
    
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Try exact hostname first, then fall back to base domain
    let strategyName = `replitauth:${req.hostname}`;
    
    if (!(passport as any)._strategy(strategyName)) {
      const parts = req.hostname.split('.');
      if (parts.length > 2) {
        const baseDomain = parts.slice(-2).join('.');
        const baseStrategy = `replitauth:${baseDomain}`;
        if ((passport as any)._strategy(baseStrategy)) {
          strategyName = baseStrategy;
        }
      }
    }
    
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  app.get("/api/user", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Fetch PAN from user_profiles table (where KYC data is stored)
    let panNumber: string | null = null;
    try {
      const userProfile = await storage.getUserProfile(user.id);
      if (userProfile?.panNumber) {
        // PAN is stored as plaintext in user_profiles
        // Check if it looks encrypted (contains colons) - if so, decrypt
        if (userProfile.panNumber.includes(':')) {
          try {
            panNumber = await PANConsentService.decryptPAN(userProfile.panNumber);
          } catch {
            // If decryption fails, it might be plaintext stored with a colon (edge case)
            panNumber = userProfile.panNumber;
          }
        } else {
          panNumber = userProfile.panNumber;
        }
      }
    } catch (err) {
      console.error("Error fetching user profile PAN:", err);
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
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check if user is authenticated via Passport (works for both OAuth and local auth)
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // User is authenticated, allow the request
  next();
};