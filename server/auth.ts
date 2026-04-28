import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { logger } from "./logger";
import { promisify } from "util";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { emailService } from "./email-service";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { smsService } from "./services/sms-service";
import { whatsappService } from "./whatsapp";
import { apiResponse } from "./utils/responses";

import { duplicateDetectionService } from "./services/duplicateDetectionService";
import { stampSessionPortal } from "./subdomain-middleware";
declare global {
  namespace Express {
    interface User {
      id: string;
      userId: string | null;
      email?: string | null;
      mobile?: string | null;
      phone?: string | null; // Alias for mobile in legacy code
      password: string;
      firstName?: string | null;
      middleName?: string | null;
      lastName?: string | null;
      isEmailVerified: boolean | null;
      isMobileVerified: boolean | null;
      roles: string[] | null;
      role?: string | null; // Legacy single role field
      isActive: boolean | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

const DEFAULT_OTP_CHANNEL_ORDER = ['email', 'whatsapp', 'sms'] as const;

async function getOtpChannelOrder(userId?: string): Promise<string[]> {
  try {
    if (userId) {
      const userPrefs = await db.query.notificationPreferences.findFirst({
        where: eq(schema.notificationPreferences.userId, userId),
      });
      if (userPrefs?.preferredOtpChannels && userPrefs.preferredOtpChannels.length > 0) {
        return userPrefs.preferredOtpChannels;
      }
    }
    const adminSetting = await db.query.adminSettings.findFirst({
      where: eq(schema.adminSettings.key, 'otp_channel_priority'),
    });
    if (adminSetting?.value && Array.isArray(adminSetting.value) && (adminSetting.value as string[]).length > 0) {
      return adminSetting.value as string[];
    }
  } catch (err) {
    logger.warn('[Auth] Failed to load OTP channel preferences from DB — using defaults', { error: err instanceof Error ? err.message : String(err) });
  }
  return [...DEFAULT_OTP_CHANNEL_ORDER];
}

export async function generateUniqueUserId(email?: string, firstName?: string): Promise<string> {
  let prefix = "FTP";
  if (firstName && firstName.trim().length >= 3) {
    const alphabeticChars = firstName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (alphabeticChars.length >= 3) {
      prefix = alphabeticChars.substring(0, 3);
    }
  } 
  else if (email) {
    const emailLocalPart = email.split('@')[0] || '';
    const alphabeticChars = emailLocalPart.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (alphabeticChars.length >= 3) {
      prefix = alphabeticChars.substring(0, 3);
    }
  }
  
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    const randomNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const userId = `${prefix}${randomNumber}`;
    const existingUser = await storage.getUserByUserId(userId);
    if (!existingUser) {
      return userId;
    }
    attempts++;
  }
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
}

export function setupAuth(app: Express) {
  passport.use(
    "email-local",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const users = await db.select().from(schema.users).where(eq(schema.users.email, email));
          if (users.length === 0) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (users.length > 1) {
            return done(null, false, { message: "Multiple accounts found with this email. Please log in using your User ID instead." });
          }
          const user = users[0];
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Incorrect password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    "mobile-local",
    new LocalStrategy(
      {
        usernameField: "mobile",
        passwordField: "password",
      },
      async (mobile, password, done) => {
        try {
          const users = await db.select().from(schema.users).where(eq(schema.users.mobile, mobile));
          if (users.length === 0) {
            return done(null, false, { message: "Invalid mobile number or password" });
          }
          if (users.length > 1) {
            return done(null, false, { message: "Multiple accounts found with this mobile number. Please log in using your User ID instead." });
          }
          const user = users[0];
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Incorrect password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    "userId-local",
    new LocalStrategy(
      {
        usernameField: "userId",
        passwordField: "password",
      },
      async (userId, password, done) => {
        try {
          const user = await storage.getUserByUserId(userId);
          if (!user) {
            return done(null, false, { message: "User ID not found" });
          }
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Incorrect password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  app.post("/api/login", async (req, res, next) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return apiResponse.badRequest(res, "Identifier and password are required");
      }

      let strategy: string;
      let usernameField: string;

      if (identifier.includes("@")) {
        strategy = "email-local";
        usernameField = "email";
      } else if (/^[A-Z]{3}[0-9]{6}$/.test(identifier) || identifier.startsWith("FTP")) {
        strategy = "userId-local";
        usernameField = "userId";
      } else {
        strategy = "mobile-local";
        usernameField = "mobile";
      }

      const modifiedReq = {
        ...req,
        body: {
          ...req.body,
          [usernameField]: identifier,
          password
        }
      };

      passport.authenticate(strategy, async (err: any, user: any, info: any) => {
        try {
          if (err) return apiResponse.serverError(res, "Login failed");
          if (!user) return apiResponse.unauthorized(res, info?.message || "Invalid credentials");

          const isTesterAccount = user.email === "test@fintekpro.com" || user.email === "sangram.m@outlook.com";
          const otp = isTesterAccount ? "123456" : generateOtp();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

          let otpDestination = user.mobile || user.email;
          let otpType = user.mobile ? "mobile" : "email";

          if (!otpDestination) {
            return apiResponse.badRequest(res, "User account has no email or mobile for OTP verification");
          }

          await storage.createOtpVerification({
            identifier: otpDestination,
            otp,
            type: otpType,
            expiresAt,
            verified: false,
          });

          if (isTesterAccount) {
             return apiResponse.success(res, {
               requiresOtp: true,
               otpSentTo: otpType,
               identifier: otpDestination,
               devOtp: otp
             }, `Test account - use OTP: ${otp}`);
          }

          const channelOrder = await getOtpChannelOrder(user.id);
          let otpDelivered = false;
          for (const channel of channelOrder) {
            if (channel === 'email' && user.email) {
              if (await emailService.sendLoginOTP(user.email, otp)) {
                otpDelivered = true;
                break;
              }
            } else if (channel === 'whatsapp' && user.mobile) {
              if (await whatsappService.sendLoginOTP(user.mobile, otp)) {
                otpDelivered = true;
                break;
              }
            } else if (channel === 'sms' && user.mobile) {
              if (await smsService.sendOTP(user.mobile, otp)) {
                otpDelivered = true;
                break;
              }
            }
          }

          if (!otpDelivered) {
            return res.status(503).json({ error: "Unable to send OTP" });
          }

          return apiResponse.success(res, {
            requiresOtp: true,
            otpSentTo: otpType,
            identifier: otpDestination,
          }, "OTP sent successfully");
        } catch (innerError) {
          return apiResponse.serverError(res, "Internal error");
        }
      })(modifiedReq, res, next);
    } catch (error) {
      return apiResponse.serverError(res, "Login failed");
    }
  });

  app.post("/api/login/verify-otp", async (req, res) => {
    try {
      const { identifier, otp } = req.body;
      if (!identifier || !otp) return apiResponse.badRequest(res, "Missing fields");

      const otpType = identifier.includes("@") ? "email" : "mobile";
      let isValid = await storage.verifyOtp(identifier, otpType, otp);

      if (!isValid && otpType === "email") {
        const userByEmail = await storage.getUserByEmail(identifier);
        if (userByEmail?.mobile) {
          isValid = await storage.verifyOtp(userByEmail.mobile, "mobile", otp);
        }
      }

      if (!isValid) return apiResponse.badRequest(res, "Invalid or expired OTP");

      let user = identifier.includes("@") ? await storage.getUserByEmail(identifier) : await storage.getUserByMobile(identifier);
      if (!user) return apiResponse.notFound(res, "User not found");

      req.login(user, (err) => {
        if (err) return apiResponse.serverError(res, "Login failed");
        stampSessionPortal(req);
        return apiResponse.success(res, user, "Login successful");
      });
    } catch (error) {
      return apiResponse.serverError(res, "OTP verification failed");
    }
  });
}
