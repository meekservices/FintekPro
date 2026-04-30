import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { emailService } from "./email-service";
import { whatsappService } from "./whatsapp";
import { smsService } from "./services/sms-service";
import { apiResponse } from "./utils/responses";
import { stampSessionPortal } from "./subdomain-middleware";

const scryptAsync = promisify(scrypt);

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

function generateOtp(): string {
  // Use a fixed OTP for testers
  return "123456";
  // return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Gets the preferred OTP delivery channel for a user.
 * Order: user setting → global setting → default fallback
 */
async function getOtpChannelOrder(userId: string): Promise<string[]> {
  try {
    // 1. Check user preferences
    const user = await storage.getUser(userId);
    if (user && (user as any).preferredOtpChannel) {
      const preferred = (user as any).preferredOtpChannel;
      const others = ['whatsapp', 'email', 'sms'].filter(c => c !== preferred);
      return [preferred, ...others];
    }

    // 2. Check admin global settings
    const adminSettings = await storage.getAdminSettings();
    if (adminSettings && adminSettings.defaultOtpChannel) {
      const preferred = adminSettings.defaultOtpChannel;
      const others = ['whatsapp', 'email', 'sms'].filter(c => c !== preferred);
      return [preferred, ...others];
    }
  } catch (error) {
    console.warn(`[OTP_CONFIG] Error fetching channel order for user ${userId}, using defaults:`, error);
  }

  // 3. Default fallback order
  return ['whatsapp', 'email', 'sms'];
}

export function setupAuth(app: Express) {
  // Use the LocalStrategy for login
  passport.use(
    new LocalStrategy(
      {
        usernameField: "identifier", // Can be username, email, or mobile
        passwordField: "password",
        passReqToCallback: true,
      },
      async (req, identifier, password, done) => {
        try {
          // Find user by username, email, or mobile
          let user;
          if (identifier.includes("@")) {
            user = await storage.getUserByEmail(identifier.trim());
          } else if (identifier.startsWith("FTP")) {
            user = await storage.getUserByUserId(identifier.trim());
          } else {
            user = await storage.getUserByMobile(identifier.trim());
          }

          if (!user) {
            return done(null, false, { message: "Invalid credentials" });
          }

          // Check if password matches
          const isValid = await comparePasswords(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid credentials" });
          }

          // Check if user is active
          if (!user.isActive) {
            return done(null, false, { message: "Account is inactive. Please contact support." });
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

  // Unified login endpoint - handles portal context and multi-factor auth
  app.post("/api/login", async (req, res, next) => {
    try {
      // Allow passing portal type via query or header for Cloud Run compatibility
      const targetPortal = (req.query.portal || req.headers['x-portal-context'] || req.subdomain || 'main') as string;
      console.log(`[LOGIN_REQUEST] Portal Context: ${targetPortal}`);

      // Modify the request to pass portal context to passport callback
      const modifiedReq = req as any;
      modifiedReq.targetPortal = targetPortal;

      passport.authenticate("local", async (err: any, user: User | false, info: any) => {
        try {
          if (err) {
            console.error("[Login] Passport authentication error:", err);
            return apiResponse.serverError(res, "Authentication failed");
          }

          if (!user) {
            console.log("[Login] Authentication failed:", info?.message);
            return apiResponse.unauthorized(res, info?.message || "Invalid username or password");
          }

          // 1. Role-based Portal Authorization
          const userRoles = user.roles || [];
          const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
          const isAgent = userRoles.includes('agent') || userRoles.includes('master_agent') || userRoles.includes('sub_agent');
          const isPartner = userRoles.includes('partner');

          console.log(`[Login] User roles: ${userRoles.join(', ')} | Target: ${targetPortal}`);

          // Restrict portal access based on roles
          if (targetPortal === 'admin' && !isAdmin) {
            return apiResponse.forbidden(res, "You do not have permission to access the admin portal");
          }
          if (targetPortal === 'agent' && !isAgent && !isAdmin) {
            return apiResponse.forbidden(res, "You do not have permission to access the agent portal");
          }
          if (targetPortal === 'partner' && !isPartner && !isAgent && !isAdmin) {
            return apiResponse.forbidden(res, "You do not have permission to access the partner portal");
          }

          // 2. Test Account Bypass Logic
          const isTesterAccount = user.username?.toLowerCase().startsWith('tester_') || user.email?.startsWith('test_');
          
          if (isTesterAccount) {
             console.log(`🧪 Detected tester account: ${user.username || user.email}`);
          }

          // 3. Multi-Factor Authentication (OTP Layer)
          // For security, all production logins require an OTP verification
          const otp = generateOtp();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          
          // Determine delivery target (prioritize mobile for SMS/WhatsApp)
          const otpDestination = user.mobile || user.email;
          const otpType = user.mobile ? "mobile" : "email";

          if (!otpDestination) {
            console.error(`❌ [Login] User ${user.id} has no valid OTP destination (email/mobile)`);
            return apiResponse.badRequest(res, "No valid OTP destination found for this account");
          }

          // Store OTP for verification
          await storage.createOtpVerification({
            identifier: otpDestination,
            otp,
            type: otpType,
            expiresAt,
            verified: false,
          });

          // Send OTP via appropriate channels following priority order:
          // user preference → admin global setting → default (email → whatsapp → sms)
          let otpDelivered = false;
          let deliveryChannel = "";

          if (isTesterAccount) {
            otpDelivered = true;
            deliveryChannel = "TEST_BYPASS";
            console.log(`🧪 Skipping OTP delivery for test account - use OTP: ${otp}`);
          } else {
            const channelOrder = await getOtpChannelOrder(user.id);
            console.log(`[OTP] Channel priority for ${user.id}: ${channelOrder.join(' → ')}`);
            for (const channel of channelOrder) {
              if (channel === 'email' && user.email) {
                const sent = await emailService.sendLoginOTP(user.email, otp);
                if (sent) {
                  console.log(`✅ Login OTP sent via email to: ${user.email}`);
                  otpDelivered = true;
                  deliveryChannel = "email";
                  break;
                }
                console.log(`⚠️ Email delivery failed, trying next channel...`);
              } else if (channel === 'whatsapp' && user.mobile) {
                const sent = await whatsappService.sendLoginOTP(user.mobile, otp);
                if (sent) {
                  console.log(`✅ Login OTP sent via WhatsApp to: ${user.mobile}`);
                  otpDelivered = true;
                  deliveryChannel = "WhatsApp";
                  break;
                }
                console.log(`⚠️ WhatsApp delivery failed, trying next channel...`);
              } else if (channel === 'sms' && user.mobile) {
                const sent = await smsService.sendOTP(user.mobile, otp);
                if (sent) {
                  console.log(`✅ Login OTP sent via SMS to: ${user.mobile}`);
                  otpDelivered = true;
                  deliveryChannel = "SMS";
                  break;
                }
                console.log(`⚠️ SMS delivery failed, trying next channel...`);
              }
            }
            if (!otpDelivered) {
              console.error(`❌ [Login] All OTP delivery channels (${channelOrder.join(', ')}) failed for user ${user.id}`);
            }
          }

          // Check if OTP was actually delivered
          if (!otpDelivered) {
            console.error(`❌ OTP delivery failed — no delivery channel available for this account`);
            return res.status(503).json({
              error: "Unable to send OTP",
              message: "We could not reach you via SMS, WhatsApp, or email. Please contact support or try again later.",
            });
          }

          // Return success with OTP destination info (don't complete login yet)
          const responseData: any = {
            requiresOtp: true,
            otpSentTo: otpType === "email" ? "email" : "mobile",
            identifier: otpDestination,
            userId: user.userId,
            deliveryChannel
          };
          if (isTesterAccount) {
            responseData.devOtp = otp;
            responseData.devHint = "Test account: use fixed OTP 123456";
          }
          return apiResponse.success(res, responseData, isTesterAccount 
            ? `Test account - use OTP: ${otp}` 
            : `OTP sent to your ${otpType} via ${deliveryChannel}`);
        } catch (innerError) {
          console.error("[Login] Error in passport callback:", innerError);
          return apiResponse.serverError(res, "Internal error during login callback");
        }
      })(modifiedReq, res, next);
    } catch (error) {
      console.error("Unified login error:", error);
      return apiResponse.serverError(res, "Login failed");
    }
  });

  // Request OTP for passwordless login (agent portal OTP Login tab)
  app.post("/api/login/request-otp", async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return apiResponse.badRequest(res, "Identifier is required");
      }

      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier.trim());
      } else {
        user = await storage.getUserByMobile(identifier.trim());
      }

      if (!user) {
        return apiResponse.notFound(res, "No account found with this email or mobile number");
      }

      if (!user.isActive) {
        return apiResponse.badRequest(res, "Account is not active. Please contact support.");
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const otpTarget = user.mobile || user.email;
      const otpType = user.mobile ? "mobile" : "email";

      await storage.createOtpVerification({
        identifier: otpTarget,
        otp,
        type: otpType,
        expiresAt,
        verified: false,
      });

      console.log(`[OTP Login] OTP for ${otpTarget} (${otpType}): ${otp}`);

      const maskedTarget = otpType === "mobile"
        ? `mobile ending in ${otpTarget.slice(-4)}`
        : user.email;

      return apiResponse.success(res, {
        otpSentTo: maskedTarget,
        identifier: otpTarget,
      }, "OTP sent successfully");
    } catch (error) {
      console.error("OTP login request error:", error);
      return apiResponse.serverError(res, "Failed to send OTP");
    }
  });

  // Verify OTP and complete login - mandatory second-layer authentication
  app.post("/api/login/verify-otp", async (req, res) => {
    try {
      const { identifier, otp } = req.body;

      if (!identifier || !otp) {
        console.log("❌ Missing identifier or OTP");
        return apiResponse.badRequest(res, "Identifier and OTP are required");
      }

      // Determine OTP type based on identifier
      const otpType = identifier.includes("@") ? "email" : "mobile";

      // Try verifying OTP directly with the provided identifier
      let isValid = await storage.verifyOtp(identifier, otpType, otp);

      // If email identifier failed, the OTP may have been stored under the user's mobile number
      // (login always prefers mobile for OTP delivery). Look up user and try mobile identifier.
      let resolvedIdentifier = identifier;
      let resolvedOtpType = otpType;
      if (!isValid && otpType === "email") {
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
        console.log(`[LOGIN_SUCCESS] User ${updatedUser.id} logging in to portal: ${req.subdomain || 'main'}`);
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

      // Delete all sessions for this user from the sessions table
      // Using raw SQL to query JSONB column
      const result = await db
        .delete(schema.sessions)
        .where(sql`sess->'passport'->>'user' = ${user.id}`)
        .execute();

      console.log(`[Force Logout] Destroyed ${result.rowCount || 0} session(s) for user ${user.id}`);

      return apiResponse.success(res, {
        destroyedSessions: result.rowCount || 0
      }, "All sessions terminated successfully");
    } catch (error) {
      console.error("[Force Logout] Error:", error);
      console.error("[Force Logout] Stack:", error instanceof Error ? error.stack : 'No stack trace');
      return apiResponse.serverError(res, "Failed to terminate sessions");
    }
  });

  // Service-to-service JWT token (used by micro-service subdomains like ins.fintekpro.com)
  app.get("/api/auth/service-token", (req: any, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const { issueServiceToken } = require('./utils/service-token');
      const token = issueServiceToken(req.user);
      return res.json({ token, expiresIn: 900 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return apiResponse.serverError(res, "Logout failed");
      }
      
      // Destroy the session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
        }
        
        // Clear the session cookie
        res.clearCookie('fintekpro.sid', {
          path: '/',
          domain: process.env.NODE_ENV === "production" ? (process.env.CUSTOM_DOMAIN ? (process.env.CUSTOM_DOMAIN.startsWith(".") ? process.env.CUSTOM_DOMAIN : `.${process.env.CUSTOM_DOMAIN}`) : ".fintekpro.com") : undefined
        });
        
        return apiResponse.success(res, {}, "Logged out successfully");
      });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return apiResponse.unauthorized(res);
    }

    return apiResponse.success(res, {
      id: req.user.id,
      userId: req.user.userId,
      email: req.user.email,
      mobile: req.user.mobile,
      firstName: req.user.firstName,
      middleName: req.user.middleName,
      lastName: req.user.lastName,
      isEmailVerified: req.user.isEmailVerified,
      isMobileVerified: req.user.isMobileVerified,
      navPosition: (req.user as any).navPosition || "left"
    });
  });

  // Get user preferences
  app.get("/api/user/preferences", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return apiResponse.unauthorized(res);
    }

    return apiResponse.success(res, {
      navPosition: (req.user as any).navPosition || "left"
    });
  });

  // Update user preferences
  app.patch("/api/user/preferences", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return apiResponse.unauthorized(res);
    }

    try {
      const { navPosition } = req.body;
      
      // Validate navPosition - require a valid value
      const validPositions = ["left", "top", "bottom"];
      if (!navPosition || !validPositions.includes(navPosition)) {
        return apiResponse.badRequest(res, "Invalid nav position. Must be 'left', 'top', or 'bottom'");
      }

      // Update user preferences
      await storage.updateUser(req.user.id, { navPosition });

      return apiResponse.success(res, {
        navPosition
      }, "Preferences updated successfully");
    } catch (error) {
      console.error("Error updating preferences:", error);
      return apiResponse.serverError(res, "Failed to update preferences");
    }
  });

  // Profile routes
  // Agent-only profile access route  
  app.get("/api/agent/profile/:userId", async (req, res) => {
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

      const user = await storage.getUser(userId);
      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Fetch agent data for API integration codes
      let agentData = null;
      try {
        const agentRelationship = await storage.getAgentForClient(userId);
        if (agentRelationship && agentRelationship.agent) {
          agentData = {
            euinNumber: agentRelationship.agent.euinNumber,
            arnCode: agentRelationship.agent.arnCode,
            distributorId: agentRelationship.agent.distributorId,
          };
        }
      } catch (error) {
        console.log("No agent assigned or error fetching agent data:", error);
      }

      return apiResponse.success(res, {
        // Enhanced KYC Fields
        panNumber: user.panNumber,
        aadharNumber: user.aadharNumber,
        passportNumber: user.passportNumber,
        drivingLicense: user.drivingLicense,
        voterIdNumber: user.voterIdNumber,
        dateOfBirth: user.dateOfBirth,
        nationality: user.nationality,
        fatherName: user.fatherName,
        motherName: user.motherName,
        spouseName: user.spouseName,
        maritalStatus: user.maritalStatus,
        
        // Residency Status
        residentStatus: user.residentStatus,
        countryOfResidence: user.countryOfResidence,
        taxResidencyCountry: user.taxResidencyCountry,
        
        // Address Information
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        country: user.country,
        
        // Financial Information
        occupation: user.occupation,
        annualIncome: user.annualIncome,
        investmentExperience: user.investmentExperience,
        riskTolerance: user.riskTolerance,
        sourceOfWealth: user.sourceOfWealth,
        
        // FATCA Compliance
        fatcaStatus: user.fatcaStatus,
        fatcaTinNumber: user.fatcaTinNumber,
        fatcaCountryOfTaxResidence: user.fatcaCountryOfTaxResidence,
        
        // PEP Status
        pepStatus: user.pepStatus,
        pepDetails: user.pepDetails,
        
        // UBO Information
        isUbo: user.isUbo,
        uboDetails: user.uboDetails,
        
        // API Integration (auto-populated from agent)
        euinNumber: agentData?.euinNumber || user.euinNumber || "",
        arnCode: agentData?.arnCode || user.arnCode || "",
        distributorId: agentData?.distributorId || user.distributorId || "",
        
        // PAN Consent Status
        panVerificationConsent: user.panVerificationConsent || false,
        panConsentGivenAt: user.panConsentGivenAt
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      return apiResponse.serverError(res);
    }
  });

  // Agent-only profile update route
  app.put("/api/agent/profile/:userId", async (req, res) => {
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

      const { 
        // Client Type and Entity Information
        clientType, entityType, companyName, entityRegistrationNumber, incorporationDate, businessNature, companyPanNumber,
        
        // Enhanced KYC Fields - Individual
        firstName, middleName, lastName, gender, dateOfBirth, fatherName, motherName, spouseName, maritalStatus,
        
        // Identity Documents
        panNumber, aadharNumber, passportNumber, passportCountry, passportExpiryDate, drivingLicense, voterIdNumber,
        
        // Contact Information
        email, mobile, alternateContactNumber,
        
        // Comprehensive Residency Status
        residentStatus, countryOfResidence, countryOfCitizenship, countryOfBirth, taxResidencyCountry,
        nriSubType, visaType, permanentResidenceStatus, nriRepatriationType, overseasTaxId,
        
        // Address Information - Enhanced
        presentAddress, presentCity, presentState, presentPincode, presentCountry,
        permanentAddress, permanentCity, permanentState, permanentPincode, permanentCountry,
        isAddressSame,
        
        // Financial Information - AML Enhanced
        occupation, employer, designation, workExperience, annualIncome, sourceOfWealth, netWorth,
        
        // Investment Profile
        investmentExperience, riskTolerance, investmentObjective, investmentHorizon,
        
        // Banking Details - Enhanced
        bankAccountNumber, ifscCode, bankName, branchAddress, accountType,
        
        // Demat Account - CVL/KRA Integration
        nsdlDpId, nsdlClientId, cdslBoId, cdslDpId, krvNumber, cvlKycNumber,
        
        // Regulatory Compliance - Enhanced FATCA & CRS
        fatcaStatus, fatcaTinNumber, fatcaCountryOfTaxResidence,
        crsStatus, crsTaxResidentCountries, crsTinNumbers,
        
        // PEP Declaration - Enhanced
        pepStatus, pepDetails, pepRelatedPersonStatus, pepRelationshipDetails,
        
        // UBO Information - Enhanced
        isUbo, uboDetails, beneficialOwnershipPercentage,
        
        // Nominee and Guardian Information
        nomineeDetails, nomineeRelation, nomineeContactNumber, guardianDetails,
        
        // Professional Information
        educationalQualifications, professionalCertifications,
        
        // Consent and Declarations
        panVerificationConsent, amlScreeningConsent, fatcaDeclarationConsent, termsAndConditionsConsent,
        dataProcessingConsent, regulatoryReportingConsent,
        
        // Legacy API Integration (backward compatibility)
        euinNumber, enableCamsApi, enableKfintechApi, enableNsdlApi, enableCdslApi,
        preferredCamsRegistration, preferredKfintechRegistration, preferredNsdlRegistration, preferredCdslRegistration
      } = req.body;

      const updatedUser = await storage.updateUser(userId, {
        // Client Type and Entity Information
        ...(clientType && { clientType }),
        ...(entityType && { entityType }),
        ...(companyName && { companyName }),
        ...(entityRegistrationNumber && { entityRegistrationNumber }),
        ...(incorporationDate && { incorporationDate }),
        ...(businessNature && { businessNature }),
        ...(companyPanNumber && { companyPanNumber }),
        
        // Enhanced Individual KYC Fields
        ...(firstName && { firstName }),
        ...(middleName && { middleName }),
        ...(lastName && { lastName }),
        ...(gender && { gender }),
        ...(dateOfBirth && { dateOfBirth }),
        ...(fatherName && { fatherName }),
        ...(motherName && { motherName }),
        ...(spouseName && { spouseName }),
        ...(maritalStatus && { maritalStatus }),
        
        // Identity Documents
        ...(panNumber && { panNumber }),
        ...(aadharNumber && { aadharNumber }),
        ...(passportNumber && { passportNumber }),
        ...(passportCountry && { passportCountry }),
        ...(passportExpiryDate && { passportExpiryDate }),
        ...(drivingLicense && { drivingLicense }),
        ...(voterIdNumber && { voterIdNumber }),
        
        // Contact Information
        ...(email && { email }),
        ...(mobile && { mobile }),
        ...(alternateContactNumber && { alternateContactNumber }),
        
        // Comprehensive Residency Status
        ...(residentStatus && { residentStatus }),
        ...(countryOfResidence && { countryOfResidence }),
        ...(countryOfCitizenship && { countryOfCitizenship }),
        ...(countryOfBirth && { countryOfBirth }),
        ...(taxResidencyCountry && { taxResidencyCountry }),
        ...(nriSubType && { nriSubType }),
        ...(visaType && { visaType }),
        ...(permanentResidenceStatus && { permanentResidenceStatus }),
        ...(nriRepatriationType && { nriRepatriationType }),
        ...(overseasTaxId && { overseasTaxId }),
        
        // Address Information - Enhanced
        ...(presentAddress && { address: presentAddress }),
        ...(presentCity && { city: presentCity }),
        ...(presentState && { state: presentState }),
        ...(presentPincode && { pincode: presentPincode }),
        ...(presentCountry && { country: presentCountry }),
        
        // Financial Information - AML Enhanced
        ...(occupation && { occupation }),
        ...(employer && { employer }),
        ...(designation && { designation }),
        ...(workExperience && { workExperience }),
        ...(annualIncome && { annualIncome }),
        ...(sourceOfWealth && { sourceOfWealth }),
        ...(netWorth && { netWorth }),
        
        // Investment Profile
        ...(investmentExperience && { investmentExperience }),
        ...(riskTolerance && { riskTolerance }),
        ...(investmentObjective && { investmentObjective }),
        ...(investmentHorizon && { investmentHorizon }),
        
        // Banking Details - Enhanced
        ...(bankAccountNumber && { bankAccountNumber }),
        ...(ifscCode && { ifscCode }),
        ...(bankName && { bankName }),
        ...(branchAddress && { branchAddress }),
        ...(accountType && { accountType }),
        
        // Demat Account - CVL/KRA Integration
        ...(nsdlDpId && { nsdlDpId }),
        ...(nsdlClientId && { nsdlClientId }),
        ...(cdslBoId && { cdslBoId }),
        ...(cdslDpId && { cdslDpId }),
        ...(krvNumber && { krvNumber }),
        ...(cvlKycNumber && { cvlKycNumber }),
        
        // Regulatory Compliance - Enhanced FATCA & CRS
        ...(fatcaStatus && { fatcaStatus }),
        ...(fatcaTinNumber && { fatcaTinNumber }),
        ...(fatcaCountryOfTaxResidence && { fatcaCountryOfTaxResidence }),
        
        // PEP Declaration - Enhanced
        ...(pepStatus && { pepStatus }),
        ...(pepDetails && { pepDetails }),
        ...(pepRelatedPersonStatus && { pepRelatedPersonStatus }),
        ...(pepRelationshipDetails && { pepRelationshipDetails }),
        
        // UBO Information - Enhanced
        ...(typeof isUbo === 'boolean' && { isUbo }),
        ...(uboDetails && { uboDetails }),
        ...(beneficialOwnershipPercentage && { beneficialOwnershipPercentage }),
        
        // Nominee and Guardian Information
        ...(nomineeDetails && { nomineeDetails }),
        ...(nomineeRelation && { nomineeRelation }),
        ...(nomineeContactNumber && { nomineeContactNumber }),
        ...(guardianDetails && { guardianDetails }),
        
        // Professional Information
        ...(educationalQualifications && { educationalQualifications }),
        ...(professionalCertifications && { professionalCertifications }),
        
        // Consent and Declarations
        ...(typeof panVerificationConsent === 'boolean' && { panVerificationConsent }),
        ...(typeof amlScreeningConsent === 'boolean' && { amlScreeningConsent }),
        ...(typeof fatcaDeclarationConsent === 'boolean' && { fatcaDeclarationConsent }),
        ...(typeof termsAndConditionsConsent === 'boolean' && { termsAndConditionsConsent }),
        ...(typeof dataProcessingConsent === 'boolean' && { dataProcessingConsent }),
        ...(typeof regulatoryReportingConsent === 'boolean' && { regulatoryReportingConsent }),
        
        // Legacy API Integration (backward compatibility)
        ...(euinNumber && { euinNumber }),
        ...(typeof enableCamsApi === 'boolean' && { enableCamsApi }),
        ...(typeof enableKfintechApi === 'boolean' && { enableKfintechApi }),
        ...(typeof enableNsdlApi === 'boolean' && { enableNsdlApi }),
        ...(typeof enableCdslApi === 'boolean' && { enableCdslApi }),
        ...(typeof preferredCamsRegistration === 'boolean' && { preferredCamsRegistration }),
        ...(typeof preferredKfintechRegistration === 'boolean' && { preferredKfintechRegistration }),
        ...(typeof preferredNsdlRegistration === 'boolean' && { preferredNsdlRegistration }),
        ...(typeof preferredCdslRegistration === 'boolean' && { preferredCdslRegistration }),
        
        updatedAt: new Date(),
      });

      if (!updatedUser) {
        return apiResponse.notFound(res, "User not found");
      }

      return apiResponse.success(res, {
        // Enhanced KYC Fields
        panNumber: updatedUser.panNumber,
        aadharNumber: updatedUser.aadharNumber,
        passportNumber: updatedUser.passportNumber,
        drivingLicense: updatedUser.drivingLicense,
        voterIdNumber: updatedUser.voterIdNumber,
        dateOfBirth: updatedUser.dateOfBirth,
        nationality: updatedUser.nationality,
        fatherName: updatedUser.fatherName,
        motherName: updatedUser.motherName,
        spouseName: updatedUser.spouseName,
        maritalStatus: updatedUser.maritalStatus,
        
        // Residency Status
        residentStatus: updatedUser.residentStatus,
        countryOfResidence: updatedUser.countryOfResidence,
        taxResidencyCountry: updatedUser.taxResidencyCountry,
        
        // Address Information
        address: updatedUser.address,
        city: updatedUser.city,
        state: updatedUser.state,
        pincode: updatedUser.pincode,
        country: updatedUser.country,
        
        // Financial Information
        occupation: updatedUser.occupation,
        annualIncome: updatedUser.annualIncome,
        investmentExperience: updatedUser.investmentExperience,
        riskTolerance: updatedUser.riskTolerance,
        sourceOfWealth: updatedUser.sourceOfWealth,
        
        // FATCA Compliance
        fatcaStatus: updatedUser.fatcaStatus,
        fatcaTinNumber: updatedUser.fatcaTinNumber,
        fatcaCountryOfTaxResidence: updatedUser.fatcaCountryOfTaxResidence,
        
        // PEP Status
        pepStatus: updatedUser.pepStatus,
        pepDetails: updatedUser.pepDetails,
        
        // UBO Information
        isUbo: updatedUser.isUbo,
        uboDetails: updatedUser.uboDetails,
        // EUIN and API Integration
        euinNumber: updatedUser.euinNumber,
        enableCamsApi: updatedUser.enableCamsApi,
        enableKfintechApi: updatedUser.enableKfintechApi,
        enableNsdlApi: updatedUser.enableNsdlApi,
        enableCdslApi: updatedUser.enableCdslApi,
        // Registry Preferences
        preferredCamsRegistration: updatedUser.preferredCamsRegistration,
        preferredKfintechRegistration: updatedUser.preferredKfintechRegistration,
        preferredNsdlRegistration: updatedUser.preferredNsdlRegistration,
        preferredCdslRegistration: updatedUser.preferredCdslRegistration
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      return apiResponse.serverError(res);
    }
  });

  // CKYC Integration Endpoints - Agent Only
  app.post("/api/agent/ckyc-register/:userId", async (req, res) => {
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
      const user = await storage.getUser(userId);
      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Import CKYC service dynamically to avoid module loading issues
      const { CKYCService } = await import("./ckyc-service");
      const ckycService = new CKYCService();

      // Perform comprehensive KYC registration
      const results = await ckycService.performComprehensiveKYC(user);

      return apiResponse.success(res, {
        success: true,
        results: {
          ckyc: results.ckyc,
          kra: results.kra || null,
          cvl: results.cvl || null
        }
      }, "CKYC registration completed");
    } catch (error) {
      console.error("Error in CKYC registration:", error);
      return apiResponse.serverError(res, "CKYC registration failed");
    }
  });

  app.get("/api/agent/ckyc-search", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, "Agent access required");
      }

      const { panNumber, ckycNumber, aadharNumber, passportNumber } = req.query;

      if (!panNumber && !ckycNumber && !aadharNumber && !passportNumber) {
        return apiResponse.badRequest(res, "At least one search parameter is required (PAN, CKYC, Aadhaar, or Passport)");
      }

      const { CKYCService } = await import("./ckyc-service");
      const ckycService = new CKYCService();

      const searchResult = await ckycService.searchCKYC({
        panNumber: panNumber as string,
        ckycNumber: ckycNumber as string,
        aadharNumber: aadharNumber as string,
        passportNumber: passportNumber as string,
      });

      return apiResponse.success(res, searchResult);
    } catch (error) {
      console.error("Error in CKYC search:", error);
      return apiResponse.serverError(res, "CKYC search failed");
    }
  });

  // Enhanced AML Screening with Profile Integration
  app.post("/api/profile/aml-screening", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Import AML service dynamically
      const AMLServiceModule = await import("./aml-service");
      const AMLService = AMLServiceModule.default;
      const amlService = new AMLService({
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });

      // Enhanced screening data from user profile
      const screeningData = {
        userId: user.id,
        firstName: user.firstName || user.companyName?.split(' ')[0] || '',
        lastName: user.lastName || user.companyName?.split(' ').slice(1).join(' ') || '',
        fullName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.middleName || ''} ${user.lastName}`.trim()
          : user.companyName || '',
        dateOfBirth: user.dateOfBirth || user.incorporationDate || '',
        nationality: user.countryOfCitizenship || user.nationality || 'Unknown',
        countryOfResidence: user.countryOfResidence || 'Unknown',
        passportNumber: user.passportNumber || '',
        // Additional fields for enhanced screening
        occupation: user.occupation || '',
        businessNature: user.businessNature || '',
        sourceOfWealth: user.sourceOfWealth || '',
        pepStatus: user.pepStatus === 'yes',
        clientType: user.clientType || 'individual',
        entityType: user.entityType || undefined,
        companyRegistrationNumber: user.entityRegistrationNumber || undefined,
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
