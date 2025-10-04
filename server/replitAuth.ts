import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
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

async function upsertUser(claims: any) {
  const existingUser = await storage.getUser(claims["sub"]);
  
  if (existingUser) {
    // Update existing user with latest OAuth data
    await storage.updateUser(claims["sub"], {
      email: claims["email"],
      firstName: claims["first_name"] || existingUser.firstName,
      lastName: claims["last_name"] || existingUser.lastName,
      profileImageUrl: claims["profile_image_url"],
    });
  } else {
    // Create new user from OAuth data
    await storage.createUser({
      email: claims["email"] || null,
      mobile: null,
      password: '', // OAuth users don't have password
      firstName: claims["first_name"] || null,
      middleName: null,
      lastName: claims["last_name"] || null,
      profileImageUrl: claims["profile_image_url"] || null,
      isEmailVerified: true, // OAuth email is verified
      isMobileVerified: false,
      panNumber: null,
      aadharNumber: null,
      passportNumber: null,
      drivingLicense: null,
      voterIdNumber: null,
      dateOfBirth: null,
      nationality: null,
      fatherName: null,
      motherName: null,
      spouseName: null,
      maritalStatus: null,
      address: null,
      city: null,
      state: null,
      pincode: null,
      country: null,
      occupation: null,
      annualIncome: null,
      investmentExperience: null,
      riskTolerance: null,
      sourceOfWealth: null,
      residentStatus: null,
      countryOfResidence: null,
      taxResidencyCountry: null,
      fatcaStatus: null,
      fatcaTinNumber: null,
      fatcaCountryOfTaxResidence: null,
      pepStatus: null,
      pepDetails: null,
      isUbo: false,
      uboDetails: null,
      bankAccountNumber: null,
      ifscCode: null,
      nomineeDetails: null,
      nomineeRelation: null,
      euinNumber: null,
      enableCamsApi: false,
      enableKfintechApi: false,
      enableNsdlApi: false,
      enableCdslApi: false,
      nsdlDpId: null,
      nsdlClientId: null,
      cdslBoId: null,
      cdslDpId: null,
      panVerificationConsent: false,
      panConsentGivenAt: null,
      panConsentIpAddress: null,
      panConsentUserAgent: null,
      panConsentVersion: null,
      preferredCamsRegistration: false,
      preferredKfintechRegistration: false,
      preferredNsdlRegistration: false,
      preferredCdslRegistration: false,
      roles: ['user'],
      isActive: true,
      lastLoginAt: new Date(),
      loginCount: 1,
    });
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
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
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

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

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
    const user = req.user as any;
    const claims = user.claims;
    
    const dbUser = await storage.getUser(claims["sub"]);
    
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({
      id: dbUser.id,
      email: dbUser.email,
      mobile: dbUser.mobile,
      firstName: dbUser.firstName,
      middleName: dbUser.middleName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
      isEmailVerified: dbUser.isEmailVerified,
      isMobileVerified: dbUser.isMobileVerified,
      roles: dbUser.roles,
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};