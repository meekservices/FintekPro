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
  // Generate userId in format: XXX123456
  // First 3 characters: first 3 alphabetic letters from firstName, fallback to email prefix, fallback to "FTP"
  // Next 6 characters: system-generated random digits
  
  let prefix = "FTP";
  
  // Try to use firstName first as requested by user
  if (firstName && firstName.trim().length >= 3) {
    const alphabeticChars = firstName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (alphabeticChars.length >= 3) {
      prefix = alphabeticChars.substring(0, 3);
    }
  } 
  // Fallback to email if firstName not available or too short
  else if (email) {
    // Extract first 3 alphabetic characters from the email (before @)
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
    
    // Check if userId already exists
    const existingUser = await storage.getUserByUserId(userId);
    if (!existingUser) {
      return userId;
    }
    attempts++;
  }
  
  // Fallback to timestamp-based ID if random fails
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
}

export function setupAuth(app: Express) {
  // Note: Session and passport are already initialized by setupSessionAuth (auth-setup.ts)
  // We only configure the local strategies here
  
  // Configure passport for email login
  passport.use(
    "email-local",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          // Check for multiple users with same email (family members can share)
          const users = await db.select().from(schema.users).where(eq(schema.users.email, email));
          
          if (users.length === 0) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          if (users.length > 1) {
            return done(null, false, { message: "Multiple accounts found with this email. Please log in using your User ID instead." });
          }
          
          const user = users[0];
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Incorrect password. Please try again or use Forgot Password." });
          }
          
          // Normalize user data for Express
          const normalizedUser = {
            ...user,
            isEmailVerified: user.isEmailVerified ?? false,
            isMobileVerified: user.isMobileVerified ?? false
          };
          return done(null, normalizedUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Configure passport for mobile login
  passport.use(
    "mobile-local",
    new LocalStrategy(
      {
        usernameField: "mobile",
        passwordField: "password",
      },
      async (mobile, password, done) => {
        try {
          // Check for multiple users with same mobile (family members can share)
          const users = await db.select().from(schema.users).where(eq(schema.users.mobile, mobile));
          
          if (users.length === 0) {
            return done(null, false, { message: "Invalid mobile number or password" });
          }
          
          if (users.length > 1) {
            return done(null, false, { message: "Multiple accounts found with this mobile number. Please log in using your User ID instead." });
          }
          
          const user = users[0];
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Incorrect password. Please try again or use Forgot Password." });
          }
          
          // Normalize user data for Express
          const normalizedUser = {
            ...user,
            isEmailVerified: user.isEmailVerified ?? false,
            isMobileVerified: user.isMobileVerified ?? false
          };
          return done(null, normalizedUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Configure passport for userId login
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
            return done(null, false, { message: "Incorrect password. Please try again or use Forgot Password." });
          }
          // Normalize user data for Express
          const normalizedUser = {
            ...user,
            isEmailVerified: user.isEmailVerified ?? false,
            isMobileVerified: user.isMobileVerified ?? false
          };
          return done(null, normalizedUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Note: serializeUser and deserializeUser are already configured by setupSessionAuth
  // See auth-setup.ts for the Passport serialization/deserialization logic

  // Register endpoint - Step 1: Send OTP for verification
  app.post("/api/register", async (req, res) => {
    try {
      // Block registration on admin portal
      const hostname = (req.headers["x-forwarded-host"] || req.hostname || req.get('host') || '').toString().toLowerCase();
      if (hostname.startsWith('admin.') || hostname.includes('admin.fintekpro.com')) {
        console.warn(`⚠️ [SECURITY] Registration blocked from admin portal - Host: ${hostname}, IP: ${req.ip}`);
        return apiResponse.forbidden(res, "Registration is not allowed on the admin portal. Please contact an administrator for access.");
      }

      const { email, mobile, password, fullName, portalType } = req.body;

      // Require both email AND mobile for registration
      if (!email || !mobile) {
        return apiResponse.badRequest(res, "Email and mobile number are required");
      }

      if (!password) {
        return apiResponse.badRequest(res, "Password is required");
      }

      if (!fullName || String(fullName).trim().length < 2) {
        return apiResponse.badRequest(res, "Full name is required (minimum 2 characters)");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return apiResponse.badRequest(res, "Invalid email format");
      }

      // Validate mobile format (10 digits)
      const mobileRegex = /^[0-9]{10}$/;
      if (!mobileRegex.test(mobile)) {
        return apiResponse.badRequest(res, "Mobile number must be exactly 10 digits");
      }

      // Check for duplicates using duplicate detection service
      const duplicates = await duplicateDetectionService.checkForDuplicates({
        email: email || undefined,
        mobile: mobile || undefined,
        panNumber: undefined, // PAN not provided during initial registration
        firstName: email.split('@')[0], // Use email prefix as temp name
        lastName: ""
      });
      
      // Warn about email/mobile duplicates but allow registration (family members can share contact info)
      const contactDuplicates = duplicates.filter(d => d.emailMatch || d.mobileMatch);
      
      // Note: We intentionally allow email/mobile duplicates to support family accounts
      // Users will see warnings in the OTP verification response if duplicates exist
      // Only PAN duplicates would be blocked (handled during KYC, not registration)


      // Hash password for storage in metadata
      const hashedPassword = await hashPassword(password);

      // Generate secure registration token (prevents password exposure in client state)
      const registrationToken = randomBytes(32).toString('hex');

      // Generate OTP
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Delete any existing OTP for this email/mobile to prevent duplicates
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, email));
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, mobile));

      // Store OTP with registration data in metadata
      await storage.createOtpVerification({
        identifier: mobile, // Use mobile as primary identifier for registration
        otp,
        type: "registration",
        expiresAt,
        verified: false,
        metadata: {
          email,
          mobile,
          hashedPassword,
          fullName: String(fullName).trim(),
          portalType: portalType || 'main',
          registrationToken, // Store token for resend verification
          registrationFlow: true
        }
      });

      // Send OTP following admin-configured channel priority order (no user pref yet at registration)
      const regChannelOrder = await getOtpChannelOrder();
      console.log(`[OTP] Registration channel priority: ${regChannelOrder.join(' → ')}`);
      let primaryDelivered = false;
      let regDeliveryChannel = "";
      for (const channel of regChannelOrder) {
        if (channel === 'email') {
          const sent = await emailService.sendRegistrationOTP(email, otp);
          if (sent) {
            console.log(`✅ Registration OTP sent via email to: ${email}`);
            primaryDelivered = true;
            regDeliveryChannel = "email";
            break;
          }
          console.log(`⚠️ Email delivery failed for registration, trying next channel...`);
        } else if (channel === 'whatsapp') {
          const sent = await whatsappService.sendLoginOTP(mobile, otp);
          if (sent) {
            console.log(`✅ Registration OTP sent via WhatsApp to: ${mobile}`);
            primaryDelivered = true;
            regDeliveryChannel = "WhatsApp";
            break;
          }
          console.log(`⚠️ WhatsApp delivery failed for registration, trying next channel...`);
        } else if (channel === 'sms') {
          const sent = await smsService.sendOTP(mobile, otp);
          if (sent) {
            console.log(`✅ Registration OTP sent via SMS to: ${mobile}`);
            primaryDelivered = true;
            regDeliveryChannel = "SMS";
            break;
          }
          console.log(`⚠️ SMS delivery failed for registration, trying next channel...`);
        }
      }
      // If email was not the primary channel, always also send to email as a safety copy
      if (regDeliveryChannel !== "email") {
        const emailAlso = await emailService.sendRegistrationOTP(email, otp);
        if (emailAlso) {
          console.log(`✅ Registration OTP also sent to email: ${email}`);
        }
      }
      if (!primaryDelivered) {
        console.log(`⚠️ All delivery channels failed for registration. Please check service configuration.`);
      }

      // Return success response indicating OTP is required
      return apiResponse.success(res, {
        requiresOtp: true,
        identifier: mobile, // Use mobile as primary identifier
        registrationToken, // Send token to frontend (NOT password)
        otpSentTo: `${mobile} (SMS) and ${email}`
      }, "Verification code sent to your mobile and email");

    } catch (error) {
      console.error("Registration error:", error);
      return apiResponse.serverError(res, "Registration failed");
    }
  });

  // Register endpoint - Step 2: Verify OTP and create account
  app.post("/api/register/verify-otp", async (req, res) => {
    try {
      // Block registration on admin portal
      const hostname = (req.headers["x-forwarded-host"] || req.hostname || req.get('host') || '').toString().toLowerCase();
      if (hostname.startsWith('admin.') || hostname.includes('admin.fintekpro.com')) {
        console.warn(`⚠️ [SECURITY] Registration OTP verification blocked from admin portal - Host: ${hostname}, IP: ${req.ip}`);
        return apiResponse.forbidden(res, "Registration is not allowed on the admin portal. Please contact an administrator for access.");
      }

      const { identifier, otp } = req.body;

      if (!identifier || !otp) {
        return apiResponse.badRequest(res, "Identifier and OTP are required");
      }

      // Find OTP verification record
      const otpRecord = await db.query.otpVerifications.findFirst({
        where: (otpVerifications, { eq, and }) =>
          and(
            eq(otpVerifications.identifier, identifier),
            eq(otpVerifications.otp, otp),
            eq(otpVerifications.type, "registration")
          ),
      });

      if (!otpRecord) {
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // Check if OTP is expired
      if (new Date() > otpRecord.expiresAt) {
        // Clean up expired OTP
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.id, otpRecord.id));
        return apiResponse.badRequest(res, "OTP has expired");
      }

      // Check if already verified
      if (otpRecord.verified) {
        return apiResponse.badRequest(res, "OTP already used");
      }

      // Get registration data from metadata
      const metadata = otpRecord.metadata as any;
      if (!metadata || !metadata.email || !metadata.mobile || !metadata.hashedPassword) {
        return apiResponse.badRequest(res, "Invalid registration data");
      }

      const { email, mobile, hashedPassword, fullName: registeredFullName, portalType: registeredPortal } = metadata;
      const registeredName = registeredFullName || email.split('@')[0];
      const roleForPortal = registeredPortal === 'agent' ? ['agent'] : registeredPortal === 'partner' ? ['partner'] : ['user'];

      // Split registered name into first/last for the user record
      const nameParts = registeredName.trim().split(/\s+/);
      const firstNameFromReg = nameParts[0] || null;
      const lastNameFromReg = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

      // Generate unique userId with appropriate prefix
      const userId = await generateUniqueUserId(email, firstNameFromReg || undefined);

      // Create user with verified status
      const user = await storage.createUser({
        userId,
        email,
        mobile,
        password: hashedPassword,
        firstName: firstNameFromReg,
        middleName: null,
        lastName: lastNameFromReg,
        profileImageUrl: null,
        isEmailVerified: true, // Set to true since we verified via OTP
        isMobileVerified: true, // Set to true since we verified via OTP
        panNumber: null,
        aadharNumber: null,
        dateOfBirth: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        occupation: null,
        annualIncome: null,
        investmentExperience: null,
        riskTolerance: null,
        passportNumber: null,
        drivingLicense: null,
        voterIdNumber: null,
        nationality: null,
        fatherName: null,
        motherName: null,
        spouseName: null,
        maritalStatus: null,
        country: null,
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
        panConsentVersion: "1.0",
        preferredCamsRegistration: false,
        preferredKfintechRegistration: false,
        preferredNsdlRegistration: false,
        preferredCdslRegistration: false,
        agentId: null,
        arnCode: null,
        distributorId: null,
        complianceOfficer: null,
        clientType: null,
        companyName: null,
        entityType: null,
        entityRegistrationNumber: null,
        incorporationDate: null,
        businessNature: null,
        countryOfCitizenship: null,
        isUSPerson: false,
        isEUResident: false,
        gdprConsent: false,
        gdprConsentDate: null,
        dataProcessingConsent: false,
        marketingConsent: false,
        investorType: null,
        investorCategory: null,
        financialSituation: null,
        investmentObjective: null,
        profileCompleteness: 0,
        isProfileCompleted: false,
        profileCompletedAt: null,
        lastUpdated: new Date(),
        digilockerAddress: null,
        digilockerDOB: null,
        digilockerGender: null,
        digilockerFullName: null,
        aadhaarLastFour: null,
        nameMatchScore: null,
        nameReconciliationStatus: null,
        nameReconciliationNote: null,
        panVerifiedViaSmartKyc: false,
        panVerificationDate: null,
        aadhaarVerifiedViaSmartKyc: false,
        aadhaarVerificationDate: null,
        smartKycCompletedAt: null,
        roles: roleForPortal,
        isActive: true,
        lastLoginAt: null,
        previousLoginAt: null,
        loginCount: 0,
      });

      // Create portal-specific profile record
      if (registeredPortal === 'agent') {
        try {
          await db.insert(schema.agents).values({
            userId: user.id,
            fullName: registeredName,
            email,
            phone: mobile,
            status: 'active',
            isActive: true,
            agentType: 'individual',
          });
          console.log(`✅ [Register] Agent record created for ${email}`);
        } catch (agentErr: any) {
          // Email uniqueness failure means they already have an agent record — non-fatal
          console.warn(`⚠️ [Register] Agent record creation skipped for ${email}: ${agentErr.message}`);
        }
      } else if (registeredPortal === 'partner') {
        try {
          await db.insert(schema.partners).values({
            companyName: registeredName,
            contactEmail: email,
            contactPhone: mobile,
            password: hashedPassword,
            partnerType: 'distributor',
            isActive: true,
            isVerified: false,
            approvalStatus: 'PENDING',
            kycStatus: 'PENDING',
          });
          console.log(`✅ [Register] Partner record created for ${email}`);
        } catch (partnerErr: any) {
          console.warn(`⚠️ [Register] Partner record creation skipped for ${email}: ${partnerErr.message}`);
        }
      } else {
        // Auto-assign client to default agent if only one agent exists
        await storage.autoAssignDefaultAgent(user.id);
      }

      // Delete the OTP record
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      // Auto-login the user (guard against missing session middleware)
      if (!req.session) {
        return apiResponse.serverError(res, "Session not available. Please try again.");
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return apiResponse.serverError(res, "Registration successful but login failed");
        }
        stampSessionPortal(req);
        return apiResponse.created(res, {
          id: user.id,
          userId: user.userId,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
          roles: user.roles
        }, "Registration successful");
      });

    } catch (error) {
      console.error("OTP verification error:", error);
      return apiResponse.serverError(res, "OTP verification failed");
    }
  });

  // Resend OTP during registration (secure endpoint)
  app.post("/api/register/resend-otp", async (req, res) => {
    try {
      // Block registration on admin portal
      const hostname = (req.headers["x-forwarded-host"] || req.hostname || req.get('host') || '').toString().toLowerCase();
      if (hostname.startsWith('admin.') || hostname.includes('admin.fintekpro.com')) {
        console.warn(`⚠️ [SECURITY] Registration OTP resend blocked from admin portal - Host: ${hostname}, IP: ${req.ip}`);
        return apiResponse.forbidden(res, "Registration is not allowed on the admin portal. Please contact an administrator for access.");
      }

      const { identifier, registrationToken } = req.body;

      if (!identifier || !registrationToken) {
        return apiResponse.badRequest(res, "Identifier and registration token are required");
      }

      // Find existing OTP verification record
      const otpRecord = await db.query.otpVerifications.findFirst({
        where: (otpVerifications, { eq, and }) =>
          and(
            eq(otpVerifications.identifier, identifier),
            eq(otpVerifications.type, "registration")
          ),
      });

      if (!otpRecord) {
        return apiResponse.badRequest(res, "No pending registration found");
      }

      // Verify registration token matches
      const metadata = otpRecord.metadata as any;
      if (!metadata || metadata.registrationToken !== registrationToken) {
        return apiResponse.unauthorized(res, "Invalid registration token");
      }

      // Generate new OTP
      const newOtp = generateOtp();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Update OTP record with new OTP and expiry
      await db.update(schema.otpVerifications)
        .set({
          otp: newOtp,
          expiresAt: newExpiresAt,
          verified: false
        })
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      // Send new OTP via SMS first (primary channel for Replit testing compatibility)
      let primaryDelivered = false;
      const smsSent = await smsService.sendOTP(metadata.mobile, newOtp);
      if (smsSent) {
        console.log(`✅ Resend OTP sent via SMS to: ${metadata.mobile}`);
        primaryDelivered = true;
      } else {
        console.log(`⚠️ SMS delivery failed for ${metadata.mobile}, trying WhatsApp...`);
        const whatsappSent = await whatsappService.sendLoginOTP(metadata.mobile, newOtp);
        if (whatsappSent) {
          console.log(`✅ Resend OTP sent via WhatsApp to: ${metadata.mobile}`);
          primaryDelivered = true;
        }
      }

      // Also send to email as secondary channel
      const emailSent = await emailService.sendRegistrationOTP(metadata.email, newOtp);
      if (emailSent) {
        console.log(`✅ Resend OTP also sent to email: ${metadata.email}`);
      }

      return apiResponse.success(res, {
        success: true,
        otpSentTo: `${metadata.mobile} (SMS) and ${metadata.email}`
      }, "New verification code sent");

    } catch (error) {
      console.error("Resend OTP error:", error);
      return apiResponse.serverError(res, "Failed to resend OTP");
    }
  });

  // Unified login endpoint - accepts email, mobile, or userId as identifier
  // This endpoint validates credentials and sends OTP for second-layer authentication
  app.post("/api/login", async (req, res, next) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        console.log("❌ Missing identifier or password");
        return apiResponse.badRequest(res, "Identifier and password are required");
      }

      // Detect identifier type and determine which strategy to use
      let strategy: string;
      let usernameField: string;

      // Check if it's an email (contains @)
      if (identifier.includes("@")) {
        strategy = "email-local";
        usernameField = "email";
      } 
      // Check if it's a userId (Format: Prefix + 6 digits, e.g. FTP001234, SAN852412)
      else if (/^[A-Z]{3}[0-9]{6}$/.test(identifier) || identifier.startsWith("FTP")) {
        strategy = "userId-local";
        usernameField = "userId";
      }
      // Otherwise, assume it's a mobile number
      else {
        strategy = "mobile-local";
        usernameField = "mobile";
      }

      // Create a modified request with the correct field name
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
          if (err) {
            console.error("[Login] Passport authentication error:", err);
            return apiResponse.serverError(res, "Login failed");
          }
          if (!user) {
            console.log(`[Login] Authentication failed: ${info?.message || "Invalid credentials"}`);
            return apiResponse.unauthorized(res, info?.message || "Invalid credentials");
          }

          console.log(`[Login] Authenticated user: ${user.id} (${user.email || 'no email'})`);

          // Credentials are valid - now send OTP for mandatory verification
          const isTesterAccount = user.email === "test@fintekpro.com" || (user.roles && Array.isArray(user.roles) && user.roles.includes("tester"));
          const otp = isTesterAccount ? "123456" : generateOtp();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

          if (isTesterAccount) {
            console.log(`🧪 Test account detected - using fixed OTP: ${otp}`);
          }

          // Determine OTP destination based on identifier type
          let otpDestination: string;
          let otpType: string;

          // Always prefer mobile for OTP, regardless of login method
          if (user.mobile) {
            otpDestination = user.mobile;
            otpType = "mobile";
          } else if (user.email) {
            otpDestination = user.email;
            otpType = "email";
          } else {
            return apiResponse.badRequest(res, "User account has no email or mobile for OTP verification");
          }

          if (!otpDestination) {
            return apiResponse.badRequest(res, "No valid OTP destination found for this account");
          }

          // Clean up any existing OTPs for this destination
          await db.delete(schema.otpVerifications)
            .where(eq(schema.otpVerifications.identifier, otpDestination));

          // Store new OTP
          await storage.createOtpVerification({
            identifier: otpDestination,
            otp,
            type: "login",
            expiresAt,
            verified: false,
            metadata: {
              userId: user.id,
              loginType: strategy,
              loginIdentifier: identifier
            }
          });

          // Send OTP via configured channels
          if (!isTesterAccount) {
            const channelOrder = await getOtpChannelOrder(user.id);
            console.log(`[OTP] Sending login OTP for user ${user.id} using channels: ${channelOrder.join(' → ')}`);
            
            let primaryDelivered = false;
            let deliveryChannel = "";
            for (const channel of channelOrder) {
              if (channel === 'email' && user.email) {
                const sent = await emailService.sendLoginOTP(user.email, otp);
                if (sent) {
                  console.log(`✅ Login OTP sent via email to: ${user.email}`);
                  primaryDelivered = true;
                  deliveryChannel = "email";
                  break;
                }
                console.log(`⚠️ Email delivery failed for ${user.email}, trying next channel...`);
              } else if (channel === 'whatsapp' && user.mobile) {
                const sent = await whatsappService.sendLoginOTP(user.mobile, otp);
                if (sent) {
                  console.log(`✅ Login OTP sent via WhatsApp to: ${user.mobile}`);
                  primaryDelivered = true;
                  deliveryChannel = "WhatsApp";
                  break;
                }
                console.log(`⚠️ WhatsApp delivery failed for ${user.mobile}, trying next channel...`);
              } else if (channel === 'sms' && user.mobile) {
                const sent = await smsService.sendOTP(user.mobile, otp);
                if (sent) {
                  console.log(`✅ Login OTP sent via SMS to: ${user.mobile}`);
                  primaryDelivered = true;
                  deliveryChannel = "SMS";
                  break;
                }
                console.log(`⚠️ SMS delivery failed for ${user.mobile}, trying next channel...`);
              }
            }
            // If email was not the primary delivery channel, also send to email as a safety copy
            if (deliveryChannel !== "email" && user.email) {
              const emailAlso = await emailService.sendLoginOTP(user.email, otp);
              if (emailAlso) {
                console.log(`✅ Login OTP also sent to email: ${user.email}`);
              }
            }
            if (!primaryDelivered) {
              console.log(`⚠️ All primary delivery channels failed for user ${user.id}.`);
            }
          }

          // Return success response indicating OTP is required
          return apiResponse.success(res, {
            requiresOtp: true,
            identifier: otpDestination,
            otpType,
            userId: user.id
          }, "Verification code sent to your " + otpType);

        } catch (innerError) {
          console.error("Login inner error:", innerError);
          return apiResponse.serverError(res, "Login failed");
        }
      })(modifiedReq, res, next);

    } catch (error) {
      console.error("Login endpoint error:", error);
      return apiResponse.serverError(res, "Login failed");
    }
  });

  // Verify OTP for login and finalize session
  app.post("/api/login/verify-otp", async (req, res) => {
    try {
      const { identifier, otp } = req.body;

      if (!identifier || !otp) {
        return apiResponse.badRequest(res, "Identifier and OTP are required");
      }

      // Find OTP verification record
      const otpRecord = await db.query.otpVerifications.findFirst({
        where: (otpVerifications, { eq, and }) =>
          and(
            eq(otpVerifications.identifier, identifier),
            eq(otpVerifications.otp, otp),
            eq(otpVerifications.type, "login")
          ),
      });

      if (!otpRecord) {
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // Check if OTP is expired
      if (new Date() > otpRecord.expiresAt) {
        // Clean up expired OTP
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.id, otpRecord.id));
        return apiResponse.badRequest(res, "OTP has expired");
      }

      // Check if already verified
      if (otpRecord.verified) {
        return apiResponse.badRequest(res, "OTP already used");
      }

      // Get user data
      const metadata = otpRecord.metadata as any;
      if (!metadata || !metadata.userId) {
        return apiResponse.badRequest(res, "Invalid login data");
      }

      const user = await storage.getUser(metadata.userId);
      if (!user) {
        return apiResponse.badRequest(res, "User not found");
      }

      // Mark OTP as verified
      await db.update(schema.otpVerifications)
        .set({ verified: true })
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      // Auto-login the user
      if (!req.session) {
        return apiResponse.serverError(res, "Session not available. Please try again.");
      }
      req.login(user, async (err) => {
        if (err) {
          console.error("Login error:", err);
          return apiResponse.serverError(res, "OTP verification successful but login failed");
        }

        // Update login stats
        const now = new Date();
        await db.update(schema.users)
          .set({
            lastLoginAt: now,
            previousLoginAt: user.lastLoginAt,
            loginCount: (user.loginCount || 0) + 1,
            updatedAt: now
          })
          .where(eq(schema.users.id, user.id));

        // Delete the OTP record after successful login
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.id, otpRecord.id));

        stampSessionPortal(req);
        return apiResponse.success(res, {
          id: user.id,
          userId: user.userId,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
          roles: user.roles
        }, "Login successful");
      });

    } catch (error) {
      console.error("OTP verification error:", error);
      return apiResponse.serverError(res, "OTP verification failed");
    }
  });

  // Resend OTP for login
  app.post("/api/login/resend-otp", async (req, res) => {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return apiResponse.badRequest(res, "Identifier is required");
      }

      // Find existing OTP verification record
      const otpRecord = await db.query.otpVerifications.findFirst({
        where: (otpVerifications, { eq, and }) =>
          and(
            eq(otpVerifications.identifier, identifier),
            eq(otpVerifications.type, "login")
          ),
      });

      if (!otpRecord) {
        return apiResponse.badRequest(res, "No pending login found");
      }

      const metadata = otpRecord.metadata as any;
      const user = await storage.getUser(metadata.userId);
      if (!user) {
        return apiResponse.badRequest(res, "User not found");
      }

      // Check if it's a tester account to reuse the fixed OTP
      const isTesterAccount = user.email === "test@fintekpro.com" || (user.roles && Array.isArray(user.roles) && user.roles.includes("tester"));
      const newOtp = isTesterAccount ? "123456" : generateOtp();
      const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Update OTP record
      await db.update(schema.otpVerifications)
        .set({
          otp: newOtp,
          expiresAt: newExpiresAt,
          verified: false
        })
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      // Send new OTP via configured channels
      if (!isTesterAccount) {
        const channelOrder = await getOtpChannelOrder(user.id);
        console.log(`[OTP] Resending login OTP for user ${user.id} using channels: ${channelOrder.join(' → ')}`);
        
        let primaryDelivered = false;
        let deliveryChannel = "";
        for (const channel of channelOrder) {
          if (channel === 'email' && user.email) {
            const sent = await emailService.sendLoginOTP(user.email, newOtp);
            if (sent) {
              console.log(`✅ Resend OTP sent via email to: ${user.email}`);
              primaryDelivered = true;
              deliveryChannel = "email";
              break;
            }
          } else if (channel === 'whatsapp' && user.mobile) {
            const sent = await whatsappService.sendLoginOTP(user.mobile, newOtp);
            if (sent) {
              console.log(`✅ Resend OTP sent via WhatsApp to: ${user.mobile}`);
              primaryDelivered = true;
              deliveryChannel = "WhatsApp";
              break;
            }
          } else if (channel === 'sms' && user.mobile) {
            const sent = await smsService.sendOTP(user.mobile, newOtp);
            if (sent) {
              console.log(`✅ Resend OTP sent via SMS to: ${user.mobile}`);
              primaryDelivered = true;
              deliveryChannel = "SMS";
              break;
            }
          }
        }
        // Safety email
        if (deliveryChannel !== "email" && user.email) {
          await emailService.sendLoginOTP(user.email, newOtp);
        }
      }

      return apiResponse.success(res, {
        success: true
      }, "New verification code sent");

    } catch (error) {
      console.error("Resend OTP error:", error);
      return apiResponse.serverError(res, "Failed to resend OTP");
    }
  });

  app.post("/api/logout", (req, res) => {
    if (!req.session) {
      return apiResponse.success(res, null, "Logged out successfully");
    }
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return apiResponse.serverError(res, "Logout failed");
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
          return apiResponse.serverError(res, "Logout failed");
        }
        res.clearCookie("connect.sid");
        return apiResponse.success(res, null, "Logged out successfully");
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return apiResponse.unauthorized(res, "Not authenticated");
    }
    
    const user = req.user as any;
    return apiResponse.success(res, {
      id: user.id,
      userId: user.userId,
      email: user.email,
      mobile: user.mobile,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      roles: user.roles,
      isActive: user.isActive,
      profileCompleteness: user.profileCompleteness,
      isProfileCompleted: user.isProfileCompleted
    });
  });
}
