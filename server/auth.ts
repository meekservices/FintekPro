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

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

// Fixed OTP for tester accounts (sangram.m@outlook.com and test@fintekpro.com)
function isTesterAccount(identifier: string): boolean {
  const testers = ["sangram.m@outlook.com", "test@fintekpro.com", "test_id"];
  return testers.some(t => identifier.toLowerCase().includes(t.toLowerCase()));
}

export function setupAuth(app: Express) {
  // Use memory store for development, in production this should be a persistent store
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "fintekpro_secret_key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
    name: "fintekpro.sid",
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: "identifier", // Can be email, mobile, or userId
        passwordField: "password",
      },
      async (identifier, password, done) => {
        try {
          // Find user by email, mobile, or userId
          let user;
          if (identifier.includes("@")) {
            user = await storage.getUserByEmail(identifier);
          } else if (identifier.startsWith("FTP")) {
            user = await storage.getUserByUserId(identifier);
          } else {
            user = await storage.getUserByMobile(identifier);
          }

          if (!user) {
            return done(null, false, { message: "Invalid identifier or password" });
          }

          const isValid = await comparePasswords(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid identifier or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, mobile } = req.body;

      if (!email || !password || !firstName || !lastName || !mobile) {
        return apiResponse.badRequest(res, "Missing required fields");
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return apiResponse.badRequest(res, "User with this email already exists");
      }

      const existingMobile = await storage.getUserByMobile(mobile);
      if (existingMobile) {
        return apiResponse.badRequest(res, "User with this mobile number already exists");
      }

      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        roles: ["client"],
        isActive: true,
      });

      req.login(user, (err) => {
        if (err) return apiResponse.serverError(res, "Login failed after registration");
        stampSessionPortal(req);
        return apiResponse.success(res, user, "Registration successful");
      });
    } catch (error) {
      console.error("Registration error:", error);
      return apiResponse.serverError(res, "Registration failed");
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) {
        return apiResponse.unauthorized(res, info?.message || "Login failed");
      }

      // Instead of logging in directly, we send an OTP
      const otp = isTesterAccount(req.body.identifier) ? "123456" : generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Determine which identifier to use for OTP
      const identifier = user.email || user.mobile || user.userId || "";
      const type = user.email ? "email" : "mobile";

      storage.createOtpVerification({
        identifier,
        otp,
        type,
        expiresAt,
        verified: false,
      }).then(() => {
        // In production, send real OTP
        if (process.env.NODE_ENV === "production" && !isTesterAccount(identifier)) {
          if (type === "email" && user.email) {
            emailService.sendLoginOTP(user.email, otp);
          } else if (type === "mobile" && user.mobile) {
            whatsappService.sendLoginOTP(user.mobile, otp).then(sent => {
              if (!sent && user.mobile) {
                smsService.sendOTP(user.mobile, otp);
              }
            });
          }
        }
        
        console.log(`[AUTH] OTP generated for ${identifier}: ${otp}`);

        return apiResponse.success(res, {
          requiresOtp: true,
          identifier,
          type
        }, "OTP sent successfully");
      }).catch(next);
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("fintekpro.sid");
        return apiResponse.success(res, {}, "Logout successful");
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return apiResponse.unauthorized(res);
    return apiResponse.success(res, req.user);
  });

  // Verify OTP and complete login
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { identifier, otp, type: otpType } = req.body;

      if (!identifier || !otp) {
        return apiResponse.badRequest(res, "Identifier and OTP are required");
      }

      // Try both email and mobile types if the provided type doesn't work
      let isValid = await storage.verifyOtp(identifier, otpType || "email", otp);
      let resolvedIdentifier = identifier;
      let resolvedOtpType = otpType || "email";

      if (!isValid && !otpType) {
        isValid = await storage.verifyOtp(identifier, "mobile", otp);
        if (isValid) {
          resolvedOtpType = "mobile";
        }
      }
      
      // Secondary fallback: if identifier is email, check if OTP was sent to mobile or vice-versa
      if (!isValid && identifier.includes("@")) {
        const userByEmail = await storage.getUserByEmail(identifier);
        if (userByEmail?.mobile) {
          console.log("🔄 OTP not found by email, trying mobile:", userByEmail.mobile);
          isValid = await storage.verifyOtp(userByEmail.mobile, "mobile", otp);
          if (isValid) {
            resolvedIdentifier = userByEmail.mobile;
            resolvedOtpType = "mobile";
          }
        }
      }

      if (!isValid) {
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // OTP is valid - find user and complete login
      let user;
      if (resolvedOtpType === "email") {
        user = await storage.getUserByEmail(resolvedIdentifier);
      } else {
        user = await storage.getUserByMobile(resolvedIdentifier);
      }

      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Update verification status and login timestamps
      const updates: Partial<User> = {};
      if (otpType === "email") {
        updates.isEmailVerified = true;
      } else {
        updates.isMobileVerified = true;
      }
      
      // Track login timestamps
      const currentTime = new Date();
      if (user.lastLoginAt) {
        updates.previousLoginAt = user.lastLoginAt;
      }
      updates.lastLoginAt = currentTime;
      updates.loginCount = (user.loginCount || 0) + 1;
      
      await storage.updateUser(user.id, updates);

      // Fetch updated user data after saving timestamps
      const updatedUser = await storage.getUser(user.id);
      if (!updatedUser) {
        return apiResponse.serverError(res, "Failed to retrieve updated user data");
      }

      // Complete login by creating session with updated user data (guard against missing session middleware)
      if (!req.session) {
        return apiResponse.serverError(res, "Session not available. Please try again.");
      }
      req.login(updatedUser, (loginErr) => {
        if (loginErr) {
          console.error("❌ Login session error:", loginErr);
          return apiResponse.serverError(res, "Login failed");
        }
        stampSessionPortal(req);
        
        // Explicitly save session to ensure it persists
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("❌ Session save error:", saveErr);
            return apiResponse.serverError(res, "Session save failed");
          }
          
          return apiResponse.success(res, {
            id: updatedUser.id,
            userId: updatedUser.userId,
            email: updatedUser.email,
            mobile: updatedUser.mobile,
            firstName: updatedUser.firstName,
            middleName: updatedUser.middleName,
            lastName: updatedUser.lastName,
            roles: updatedUser.roles,
            isEmailVerified: updatedUser.isEmailVerified,
            isMobileVerified: updatedUser.isMobileVerified,
            lastLoginAt: updatedUser.lastLoginAt,
            previousLoginAt: updatedUser.previousLoginAt,
            loginCount: updatedUser.loginCount
          }, "Login successful");
        });
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      return apiResponse.serverError(res, "OTP verification failed");
    }
  });

  // Send OTP for mobile verification
  app.post("/api/otp/send", async (req, res) => {
    try {
      const { identifier, type } = req.body; // identifier = email or mobile, type = 'email' or 'mobile'

      if (!identifier || !type) {
        return apiResponse.badRequest(res, "Identifier and type are required");
      }

      if (type !== "email" && type !== "mobile") {
        return apiResponse.badRequest(res, "Type must be either 'email' or 'mobile'");
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await storage.createOtpVerification({
        identifier,
        otp,
        type,
        expiresAt,
        verified: false,
      });

      // In production, you would send SMS/Email here
      // For development, we'll just log the OTP
      console.log(`OTP for ${identifier} (${type}): ${otp}`);

      return apiResponse.success(res, {}, "OTP sent successfully");
    } catch (error) {
      console.error("OTP send error:", error);
      return apiResponse.serverError(res, "Failed to send OTP");
    }
  });

  // Verify OTP
  app.post("/api/otp/verify", async (req, res) => {
    try {
      const { identifier, type, otp } = req.body;

      if (!identifier || !type || !otp) {
        return apiResponse.badRequest(res, "Identifier, type, and OTP are required");
      }

      const isValid = await storage.verifyOtp(identifier, type, otp);

      if (!isValid) {
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // Update user verification status if logged in
      if (req.user) {
        const updates: Partial<User> = {};
        if (type === "email") {
          updates.isEmailVerified = true;
        } else if (type === "mobile") {
          updates.isMobileVerified = true;
        }

        await storage.updateUser(req.user.id, updates);
      }

      return apiResponse.success(res, {}, "OTP verified successfully");
    } catch (error) {
      console.error("OTP verify error:", error);
      return apiResponse.serverError(res, "OTP verification failed");
    }
  });

  // Check if user has active sessions (used before login to detect session conflicts)
  app.post("/api/sessions/check", async (req, res) => {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return apiResponse.badRequest(res, "Identifier is required");
      }

      // Find user by identifier
      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith("FTP")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        // Don't reveal that user doesn't exist (security)
        return apiResponse.success(res, { hasActiveSession: false });
      }

      console.log(`[Session Check] Checking sessions for user ID: ${user.id}`);

      // Query sessions table for active sessions for this user
      // Using raw SQL to query JSONB column
      const activeSessions = await db
        .select()
        .from(schema.sessions)
        .where(sql`sess->'passport'->>'user' = ${user.id}`)
        .execute();

      console.log(`[Session Check] Found ${activeSessions.length} active session(s) for user ${user.id}`);

      const hasActiveSession = activeSessions.length > 0;

      return apiResponse.success(res, {
        hasActiveSession,
        sessionCount: activeSessions.length
      });
    } catch (error) {
      console.error("[Session Check] Error:", error);
      console.error("[Session Check] Stack:", error instanceof Error ? error.stack : 'No stack trace');
      return apiResponse.serverError(res, "Failed to check sessions");
    }
  });

  // Force logout all sessions for a user (destroys all their active sessions)
  app.post("/api/sessions/force-logout", async (req, res) => {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return apiResponse.badRequest(res, "Identifier is required");
      }

      // Find user by identifier
      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith("FTP")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        // Still return success even if user not found (security)
        return apiResponse.success(res, { destroyedSessions: 0 }, "All sessions terminated");
      }

      console.log(`[Force Logout] Terminating all sessions for user ID: ${user.id}`);

      // Delete all sessions for this user
      const result = await db
        .delete(schema.sessions)
        .where(sql`sess->'passport'->>'user' = ${user.id}`)
        .execute();

      // Return count of destroyed sessions
      const destroyedCount = (result as any).rowCount || 0;
      console.log(`[Force Logout] Destroyed ${destroyedCount} session(s) for user ${user.id}`);

      return apiResponse.success(res, { 
        destroyedSessions: destroyedCount 
      }, "All sessions terminated successfully");
    } catch (error) {
      console.error("[Force Logout] Error:", error);
      return apiResponse.serverError(res, "Failed to terminate sessions");
    }
  });

  // AML/KYC Screening Routes (Agent/Admin only)
  app.post("/api/agent/aml-screening", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, "Agent access required");
      }

      const { name, pan, dob, fatherName } = req.body;

      if (!name || !pan) {
        return apiResponse.badRequest(res, "Name and PAN are required");
      }

      const { amlService } = await import("./aml-service");
      
      const screeningData = {
        name,
        pan,
        dob,
        fatherName,
        metadata: {
          requestedBy: req.user.id,
          requestedAt: new Date().toISOString()
        }
      };

      const screeningResult = await amlService.performFullScreening(screeningData);

      return apiResponse.success(res, {
        success: true,
        result: screeningResult
      }, "AML screening completed successfully");
    } catch (error) {
      console.error("Error in AML screening:", error);
      return apiResponse.serverError(res, "AML screening failed");
    }
  });

  // PAN Verification Consent Routes
  app.get("/api/agent/pan-consent/check/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, "Agent access required");
      }

      const userId = req.params.userId;
      const hasConsent = await storage.checkPanVerificationConsent(userId);
      return apiResponse.success(res, { hasConsent });
    } catch (error) {
      console.error("Error checking PAN consent:", error);
      return apiResponse.serverError(res, "Failed to check consent status");
    }
  });

  app.post("/api/agent/pan-consent/record/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, "Agent access required");
      }

      const userId = req.params.userId;

      // Check if consent already exists
      const existingConsent = await storage.checkPanVerificationConsent(userId);
      if (existingConsent) {
        return apiResponse.success(res, { hasConsent: true }, "Consent already recorded");
      }

      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      await storage.recordPanVerificationConsent(userId, ipAddress, userAgent);
      
      return apiResponse.success(res, { hasConsent: true }, "PAN verification consent recorded successfully");
    } catch (error) {
      console.error("Error recording PAN consent:", error);
      return apiResponse.serverError(res, "Failed to record consent");
    }
  });

  // Forgot Password - Request OTP
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return apiResponse.badRequest(res, "Email, mobile, or User ID is required");
      }

      // Find user by identifier (email, mobile, or userId)
      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith("FTP")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      // Don't reveal whether user exists for security
      if (!user) {
        // Still return success to prevent user enumeration
        return apiResponse.success(res, {
          message: "If an account exists with this identifier, an OTP has been sent"
        });
      }

      // Generate OTP
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Delete any existing password reset OTP for this user
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, user.email || user.mobile || user.userId));

      // Store OTP for password reset
      await storage.createOtpVerification({
        identifier: user.email || user.mobile || user.userId,
        otp,
        type: "password_reset",
        expiresAt,
        verified: false,
        metadata: {
          userId: user.id,
          resetRequestedAt: new Date().toISOString()
        }
      });

      // Send OTP via email (primary)
      if (user.email) {
        const emailSent = await emailService.sendPasswordResetOTP(user.email, otp);
        if (emailSent) {
          console.log(`✅ Password reset OTP sent to email: ${user.email}`);
        }
      }

      // Also try WhatsApp (default preference), then SMS as fallback
      if (user.mobile) {
        const whatsappSent = await whatsappService.sendLoginOTP(user.mobile, otp);
        if (whatsappSent) {
          console.log(`✅ Password reset OTP sent via WhatsApp to: ${user.mobile}`);
        } else {
          console.log(`⚠️ WhatsApp delivery failed for ${user.mobile}, trying SMS...`);
          const smsSent = await smsService.sendOTP(user.mobile, otp);
          if (smsSent) {
            console.log(`✅ Password reset OTP sent via SMS to: ${user.mobile}`);
          }
        }
      }

      return apiResponse.success(res, {
        message: "If an account exists with this identifier, an OTP has been sent"
      });
    } catch (error) {
      console.error("Error in forgot password:", error);
      return apiResponse.serverError(res, "Failed to process password reset request");
    }
  });

  // Reset Password - Verify OTP and Update Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { identifier, otp, newPassword } = req.body;

      if (!identifier || !otp || !newPassword) {
        return apiResponse.badRequest(res, "Identifier, OTP, and new password are required");
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return apiResponse.badRequest(res, "Password must be at least 6 characters long");
      }

      // Find user by identifier
      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith("FTP")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        return apiResponse.badRequest(res, "Invalid identifier or OTP");
      }

      // Get the OTP verification record
      const otpIdentifier = user.email || user.mobile || user.userId;
      const otpRecord = await storage.getOtpVerification(
        otpIdentifier,
        "password_reset"
      );

      if (!otpRecord) {
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // Check if OTP is expired
      const isExpired = new Date() > new Date(otpRecord.expiresAt);
      if (isExpired) {
        return apiResponse.badRequest(res, "OTP has expired. Please request a new one");
      }

      // Verify OTP matches
      if (otpRecord.otp !== otp) {
        return apiResponse.badRequest(res, "Invalid OTP");
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      // Delete the used OTP
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      console.log(`✅ Password reset successful for user: ${user.userId}`);

      return apiResponse.success(res, {
        message: "Password reset successful. You can now log in with your new password."
      });
    } catch (error) {
      console.error("Error in reset password:", error);
      return apiResponse.serverError(res, "Failed to reset password");
    }
  });

  // Cleanup expired OTPs periodically
  setInterval(async () => {
    try {
      await storage.cleanupExpiredOtps();
    } catch (error) {
      console.error("OTP cleanup error:", error);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
}
