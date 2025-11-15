import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { generateUniqueUserId } from "./auth";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
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

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    name: 'fintekpro.sid',
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: sessionTtl,
      path: '/',
      // Share cookie across all fintekpro.com subdomains in production
      domain: process.env.NODE_ENV === "production" ? ".fintekpro.com" : undefined,
    },
  });
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
    const userId = await generateUniqueUserId();
    const newUser = await storage.createUser({
      userId,
      email: claims["email"] || null,
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
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
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
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
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
    // req.user is now always a database user object (from both OAuth and local auth)
    const user = req.user as any;
    
    console.log("🔍 /api/user request - isAuthenticated:", req.isAuthenticated());
    console.log("🔍 Session ID:", req.sessionID);
    console.log("🔍 Session data:", req.session);
    console.log("🔍 User:", user ? `${user.email || user.mobile} (roles: ${user.roles})` : 'null');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
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