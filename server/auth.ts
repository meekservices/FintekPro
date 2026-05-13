import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserType } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema/users";

declare global {
  namespace Express {
    interface User extends UserType {
      id: string;
      userId: string;
      role?: string;
      roles?: string[];
    }
  }
}

import { eq } from "drizzle-orm";
import { apiResponse } from "./utils/responses";
import { emailService } from "./email-service";
import { whatsappService } from "./whatsapp";
import { smsService } from "./services/sms-service";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
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

export async function hashPin(pin: string) {
  return hashPassword(pin);
}

export async function comparePins(supplied: string, stored: string) {
  return comparePasswords(supplied, stored);
}

export async function generateUniqueUserId(email?: string): Promise<string> {
  let prefix = "FTP";
  
  if (email) {
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
    
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    
    if (existingUser.length === 0) {
      return userId;
    }
    
    attempts++;
  }
  
  throw new Error("Failed to generate unique userId after maximum attempts");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

function stampSessionPortal(req: any, portal: string) {
  if (req.session) {
    (req.session as any).portal = portal;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "fintekpro-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    }
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" },
      async (identifier, password, done) => {
        try {
          const user = await storage.getUserByUsername(identifier);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid credentials" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // The register route in HEAD was actually implementing a sophisticated login logic
  // We'll rename it to /api/login to fix the structure while keeping the HEAD functionality
  app.post("/api/login", async (req, res, next) => {
    try {
      // Allow passing portal type via query or header for Cloud Run compatibility
      const targetPortal = (req.query.portal || req.headers['x-portal-context'] || req.subdomain || 'main') as string;
      console.log(`[LOGIN_REQUEST] Portal Context: ${targetPortal}`);

      // Modify the request to pass portal context to passport callback
      const modifiedReq = req as any;
      modifiedReq.targetPortal = targetPortal;
      (req.session as any).targetPortal = targetPortal; // Persist in session for verify-otp step

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
          const isTesterAccount = 
            user.userId?.toLowerCase().startsWith('tester_') || 
            user.email?.startsWith('test_') ||
            user.email === 'test@fintekpro.com' ||
            user.email === 'tester@fintekpro.com';

          if (isTesterAccount) {
             console.log(`🧪 Detected tester account: ${user.userId || user.email}`);
          }

          /* 
227:           // 3. Mandatory First-Time Verification Check (Email & Mobile)
228:           const needsVerification = !user.isEmailVerified || !user.isMobileVerified;
...
284:           }
285:           */

          // 5. Multi-Factor Authentication (OTP Layer) - Legacy/Fallback or for Testers
          // For security, all production logins require an OTP verification
          let otp = generateOtp();
          
          // Force fixed OTP for testers to ensure stable automated/manual tests
          if (isTesterAccount) {
            otp = "123456";
          }
          
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

  app.post("/api/register", async (req, res) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return res.status(500).send(err);
        res.status(201).json(user);
      });
    } catch (err) {
      res.status(500).send(err);
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
        user = await storage.getUserByEmail(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        return apiResponse.notFound(res, "User not found with this identifier");
      }

      const otp = generateOtp();
      const otpType = identifier.includes("@") ? "email" : "mobile";
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await storage.createOtpVerification({
        identifier,
        otp,
        type: otpType,
        expiresAt,
        verified: false,
      });

      // Send OTP
      let sent = false;
      if (otpType === "email") {
        sent = await emailService.sendLoginOTP(identifier, otp);
      } else {
        sent = await whatsappService.sendLoginOTP(identifier, otp) || await smsService.sendOTP(identifier, otp);
      }

      if (!sent) {
        return apiResponse.serverError(res, "Failed to send OTP");
      }

      const maskedTarget = otpType === "mobile"
        ? `mobile ending in ${identifier.slice(-4)}`
        : identifier;

      return apiResponse.success(res, {
        otpSentTo: maskedTarget,
        identifier,
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
      console.log(`[VERIFY_OTP] Request: identifier=${identifier}, otp=${otp}`);

      if (!identifier || !otp) {
        console.log("❌ Missing identifier or OTP");
        return apiResponse.badRequest(res, "Identifier and OTP are required");
      }

      // Determine OTP type based on identifier
      const otpType = identifier.includes("@") ? "email" : "mobile";

      // Try verifying OTP directly with the provided identifier
      console.log(`[VERIFY_OTP] Checking OTP for ${identifier} (${otpType})...`);
      let isValid = await storage.verifyOtp(identifier, otpType, otp);

      // If email identifier failed, the OTP may have been stored under the user's mobile number
      // (login always prefers mobile for OTP delivery). Look up user and try mobile identifier.
      let resolvedIdentifier = identifier;
      let resolvedOtpType = otpType;
      if (!isValid && otpType === "email") {
        const userByEmail = await storage.getUserByEmail(identifier);
        if (userByEmail?.mobile) {
          console.log(`[VERIFY_OTP] OTP not found by email, trying mobile: ${userByEmail.mobile}`);
          isValid = await storage.verifyOtp(userByEmail.mobile, "mobile", otp);
          if (isValid) {
            resolvedIdentifier = userByEmail.mobile;
            resolvedOtpType = "mobile";
            console.log(`[VERIFY_OTP] Validated OTP via mobile fallback`);
          }
        }
      }

      if (!isValid) {
        console.log(`❌ [VERIFY_OTP] Invalid or expired OTP for ${identifier}`);
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // OTP is valid - find user and complete login
      console.log(`[VERIFY_OTP] OTP valid. Resolving user...`);
      let user;
      if (resolvedOtpType === "email") {
        user = await storage.getUserByEmail(resolvedIdentifier);
      } else {
        user = await storage.getUserByMobile(resolvedIdentifier);
      }

      if (!user) {
        console.error(`❌ [VERIFY_OTP] User not found after valid OTP: ${resolvedIdentifier}`);
        return apiResponse.notFound(res, "User not found");
      }

      console.log(`[VERIFY_OTP] Found user ${user.id}. Updating login stats...`);

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
        console.error(`❌ [VERIFY_OTP] Failed to retrieve updated user data for ${user.id}`);
        return apiResponse.serverError(res, "Failed to retrieve updated user data");
      }

      // Complete login by creating session with updated user data
      if (!req.session) {
        console.error(`❌ [VERIFY_OTP] Session not available for ${updatedUser.id}`);
        return apiResponse.serverError(res, "Session not available. Please try again.");
      }

      // Check if both are verified before completing login
      const isTester = updatedUser.userId?.toLowerCase().startsWith('tester_') || updatedUser.email?.startsWith('test_');
      const bothVerified = updatedUser.isEmailVerified && updatedUser.isMobileVerified;
      
      if (!bothVerified && !isTester) {
        console.log(`[VERIFY_OTP] Partial verification completed for user ${updatedUser.id}. Mobile: ${updatedUser.isMobileVerified}, Email: ${updatedUser.isEmailVerified}`);
        return apiResponse.success(res, {
          requiresVerification: true,
          isEmailVerified: updatedUser.isEmailVerified,
          isMobileVerified: updatedUser.isMobileVerified,
          nextVerificationType: !updatedUser.isMobileVerified ? "mobile" : "email"
        }, `Verification successful. Now please verify your ${!updatedUser.isMobileVerified ? "mobile" : "email"}.`);
      }

      console.log(`[VERIFY_OTP] Finalizing login for user ${updatedUser.id}...`);
      req.login(updatedUser, (loginErr) => {
        if (loginErr) {
          console.error("❌ [VERIFY_OTP] Login session error:", loginErr);
          return apiResponse.serverError(res, "Login failed");
        }
        
        console.log(`[VERIFY_OTP] Session created. Stamping portal type...`);
        const targetPortal = (req.session as any).targetPortal || req.subdomain;
        stampSessionPortal(req, targetPortal);
        
        // Explicitly save session to ensure it persists
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("❌ [VERIFY_OTP] Session save error:", saveErr);
            return apiResponse.serverError(res, "Session save failed");
          }
          
          console.log(`✅ [VERIFY_OTP] Success! User ${updatedUser.id} logged in.`);
          
          // If first-time verification just completed, check if PIN setup is needed
          const needsPinSetup = !updatedUser.isPinSet;
          
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
            loginCount: updatedUser.loginCount,
            requiresPinSetup: needsPinSetup
          }, needsPinSetup ? "Verification successful. Please set up your login PIN." : "Login successful");
        });
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      return apiResponse.serverError(res, "Verification failed");
    }
  });

  // Set 4-digit login PIN
  app.post("/api/login/set-pin", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      const { pin } = req.body;
      if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
        return apiResponse.badRequest(res, "Invalid PIN. Must be 4 digits.");
      }

      const hashedPin = await hashPin(pin);
      await storage.updateUser(req.user.id, {
        loginPin: hashedPin,
        isPinSet: true
      });

      return apiResponse.success(res, {}, "PIN set successfully. You can now use this for future logins.");
    } catch (error) {
      console.error("[PIN_SETUP] Error:", error);
      return apiResponse.serverError(res, "Failed to set PIN");
    }
  });

  // Verify 4-digit login PIN
  app.post("/api/login/verify-pin", async (req, res) => {
    try {
      const { identifier, pin } = req.body;
      if (!identifier || !pin) {
        return apiResponse.badRequest(res, "Identifier and PIN are required");
      }

      let user;
      if (identifier.includes("@")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith("FTP")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user || !user.isPinSet || !user.loginPin) {
        return apiResponse.unauthorized(res, "Invalid credentials or PIN not set");
      }

      const isValid = await comparePins(pin, user.loginPin);
      if (!isValid) {
        return apiResponse.unauthorized(res, "Invalid PIN");
      }

      // Complete login
      req.login(user, (err) => {
        if (err) {
          return apiResponse.serverError(res, "Login failed");
        }
        
        const targetPortal = (req.session as any).targetPortal || req.subdomain;
        stampSessionPortal(req, targetPortal);
        
        return apiResponse.success(res, {
          id: user.id,
          userId: user.userId,
          roles: user.roles
        }, "Login successful");
      });
    } catch (error) {
      console.error("[PIN_VERIFY] Error:", error);
      return apiResponse.serverError(res, "PIN verification failed");
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

      // Send OTP
      let sent = false;
      if (type === "email") {
        sent = await emailService.sendLoginOTP(identifier, otp);
      } else {
        sent = await whatsappService.sendLoginOTP(identifier, otp) || await smsService.sendOTP(identifier, otp);
      }

      if (!sent) {
        return apiResponse.serverError(res, "Failed to send OTP");
      }

      return apiResponse.success(res, {}, "OTP sent successfully");
    } catch (error) {
      console.error("[OTP_SEND] Error:", error);
      return apiResponse.serverError(res, "Failed to send OTP");
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

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
      isPinSet: req.user.isPinSet,
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

  // Check PAN Verification Consent status for a user (Agent only)
  app.get("/api/agent/pan-consent/check/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, "Agent access required");
      }

      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      return apiResponse.success(res, {
        userId: user.id,
        panVerificationConsent: user.panVerificationConsent || false,
        panConsentGivenAt: user.panConsentGivenAt || null
      });
    } catch (error) {
      console.error("[PAN_CONSENT] Check error:", error);
      return apiResponse.serverError(res, "Failed to check consent status");
    }
  });

  // Record PAN Verification Consent for a user (Agent only)
  app.post("/api/agent/pan-consent/record/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, "Agent access required");
      }

      const userId = req.params.userId;
      const { consent, source, ipAddress } = req.body;

      if (consent === undefined) {
        return apiResponse.badRequest(res, "Consent status (true/false) is required");
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Update user with consent status
      await storage.updateUser(user.id, {
        panVerificationConsent: !!consent,
        panConsentGivenAt: consent ? new Date() : null
      });

      console.log(`[PAN_CONSENT] Recorded ${consent ? 'CONSENT_GIVEN' : 'CONSENT_WITHDRAWN'} for user ${user.id} by agent ${req.user.id}`);

      return apiResponse.success(res, {
        userId: user.id,
        panVerificationConsent: !!consent,
        recordedAt: new Date()
      }, "Consent status updated successfully");
    } catch (error) {
      console.error("[PAN_CONSENT] Recording error:", error);
      return apiResponse.serverError(res, "Failed to record consent status");
    }
  });
}
