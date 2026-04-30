import { type Express, type Request, type Response, NextFunction } from "express";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { User, insertUserSchema } from "@shared/schema";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import ConnectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { eq, or } from "drizzle-orm";
import { users } from "@shared/schema";
import { stampSessionPortal } from "./subdomain-middleware";

const scryptAsync = promisify(scrypt);
const PostgresSessionStore = ConnectPgSimple(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function setupSessionAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  const customDomain = process.env.CUSTOM_DOMAIN || "fintekpro.com";
  // CRITICAL: Explicitly set the domain attribute of the session cookie to .fintekpro.com. 
  // This is required for the browser to share the session across subdomains.
  const cookieDomain = isProduction ? (customDomain.startsWith(".") ? customDomain : `.${customDomain}`) : undefined;
  console.log(`[Session] Initializing session with domain: ${cookieDomain || "localhost"}`);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "fintekpro-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      },
      createTableIfMissing: true,
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      domain: cookieDomain,
    },
    name: "fintekpro.sid",
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(or(eq(users.username, username), eq(users.email, username)))
          .limit(1);

        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, result.data.username), eq(users.email, result.data.email)))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ error: "Username or email already exists" });
      }

      const hashedPassword = await hashPassword(result.data.password);
      const [user] = await db
        .insert(users)
        .values({
          ...result.data,
          password: hashedPassword,
        })
        .returning();

      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Login after registration failed" });
        
        // Stamp the session with the portal context
        stampSessionPortal(req);
        
        res.status(201).json(user);
      });
    } catch (err) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Authentication failed" });

      req.login(user, (err) => {
        if (err) return next(err);
        
        // Stamp the session with the portal context
        stampSessionPortal(req);
        
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      
      // Clear session cookie with explicit domain for multi-portal reliability
      res.clearCookie("fintekpro.sid", {
        domain: process.env.NODE_ENV === "production" ? (process.env.CUSTOM_DOMAIN ? (process.env.CUSTOM_DOMAIN.startsWith(".") ? process.env.CUSTOM_DOMAIN : `.${process.env.CUSTOM_DOMAIN}`) : ".fintekpro.com") : undefined,
        path: "/",
      });
      
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
