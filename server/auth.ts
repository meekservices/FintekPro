import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { emailService } from "./email-service";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { smsService } from "./services/sms-service";
import { whatsappService } from "./whatsapp";
import { apiResponse } from "./utils/responses";

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string | null;
      mobile?: string | null;
      password: string;
      firstName?: string | null;
      middleName?: string | null;
      lastName?: string | null;
      isEmailVerified: boolean | null;
      isMobileVerified: boolean | null;
      roles: string[] | null;
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
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateUniqueUserId(): Promise<string> {
  // Generate userId in format: FTP001234
  const prefix = "FTP";
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
  // Note: Session and passport are already initialized by setupReplitAuth
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
            return done(null, false, { message: "Invalid email or password" });
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
            return done(null, false, { message: "Invalid mobile number or password" });
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
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid user ID or password" });
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

  // Note: serializeUser and deserializeUser are already configured by setupReplitAuth
  // The Replit Auth serializes the entire user object, which works for both OAuth and local auth

  // Register endpoint - Step 1: Send OTP for verification
  app.post("/api/register", async (req, res) => {
    try {
      // Block registration on admin portal
      const hostname = (req.headers["x-forwarded-host"] || req.hostname || req.get('host') || '').toString().toLowerCase();
      if (hostname.startsWith('admin.') || hostname.includes('admin.fintekpro.com')) {
        console.warn(`⚠️ [SECURITY] Registration blocked from admin portal - Host: ${hostname}, IP: ${req.ip}`);
        return apiResponse.forbidden(res, "Registration is not allowed on the admin portal. Please contact an administrator for access.");
      }

      const { email, mobile, password } = req.body;

      // Require both email AND mobile for registration
      if (!email || !mobile) {
        return apiResponse.badRequest(res, "Email and mobile number are required");
      }

      if (!password) {
        return apiResponse.badRequest(res, "Password is required");
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
        identifier: email, // Use email as primary identifier for registration
        otp,
        type: "registration",
        expiresAt,
        verified: false,
        metadata: {
          email,
          mobile,
          hashedPassword,
          registrationToken, // Store token for resend verification
          registrationFlow: true
        }
      });

      // Send OTP via email (primary channel)
      const emailSent = await emailService.sendRegistrationOTP(email, otp);
      if (emailSent) {
        console.log(`✅ Registration OTP sent to email: ${email}`);
      } else {
        console.log(`⚠️ Email delivery failed for ${email}`);
      }

      // Also try sending via SMS to mobile as backup
      const smsSent = await smsService.sendOTP(mobile, otp);
      if (smsSent) {
        console.log(`✅ Registration OTP sent via SMS to: ${mobile}`);
      } else {
        console.log(`⚠️ SMS delivery failed for ${mobile}, trying WhatsApp...`);
        // Try WhatsApp as fallback
        const whatsappSent = await whatsappService.sendLoginOTP(mobile, otp);
        if (whatsappSent) {
          console.log(`✅ Registration OTP sent via WhatsApp to: ${mobile}`);
        } else {
          console.log(`⚠️ All delivery channels failed for registration. Please check service configuration.`);
        }
      }

      // Return success response indicating OTP is required
      return apiResponse.success(res, {
        requiresOtp: true,
        identifier: email,
        registrationToken, // Send token to frontend (NOT password)
        otpSentTo: `${email} and ${mobile}`
      }, "Verification code sent to your email and mobile");

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

      const { email, mobile, hashedPassword } = metadata;

      // Generate unique userId
      const userId = await generateUniqueUserId();

      // Create user with verified status
      const user = await storage.createUser({
        userId,
        email,
        mobile,
        password: hashedPassword,
        firstName: null,
        middleName: null,
        lastName: null,
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
        roles: ["user"],
        isActive: true,
        lastLoginAt: null,
        previousLoginAt: null,
        loginCount: 0,
      });

      // Auto-assign to default agent if only one agent exists
      await storage.autoAssignDefaultAgent(user.id);

      // Delete the OTP record
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      // Auto-login the user
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return apiResponse.serverError(res, "Registration successful but login failed");
        }
        return apiResponse.created(res, {
          id: user.id,
          userId: user.userId,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified
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

      // Send new OTP via email (primary channel)
      const emailSent = await emailService.sendRegistrationOTP(metadata.email, newOtp);
      if (emailSent) {
        console.log(`✅ Resend OTP sent to email: ${metadata.email}`);
      }

      // Also try sending via SMS
      const smsSent = await smsService.sendOTP(metadata.mobile, newOtp);
      if (smsSent) {
        console.log(`✅ Resend OTP sent via SMS to: ${metadata.mobile}`);
      } else {
        console.log(`⚠️ SMS delivery failed for ${metadata.mobile}, trying WhatsApp...`);
        const whatsappSent = await whatsappService.sendLoginOTP(metadata.mobile, newOtp);
        if (whatsappSent) {
          console.log(`✅ Resend OTP sent via WhatsApp to: ${metadata.mobile}`);
        }
      }

      return apiResponse.success(res, {
        success: true,
        otpSentTo: `${metadata.email} and ${metadata.mobile}`
      }, "New verification code sent");

    } catch (error) {
      console.error("Resend OTP error:", error);
      return apiResponse.serverError(res, "Failed to resend OTP");
    }
  });

  // Login with email
  app.post("/api/login/email", (req, res, next) => {
    passport.authenticate("email-local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return apiResponse.serverError(res, "Login failed");
      }
      if (!user) {
        return apiResponse.unauthorized(res, info?.message || "Invalid credentials");
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return apiResponse.serverError(res, "Login failed");
        }
        return apiResponse.success(res, {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified
        });
      });
    })(req, res, next);
  });

  // Login with mobile
  app.post("/api/login/mobile", (req, res, next) => {
    passport.authenticate("mobile-local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return apiResponse.serverError(res, "Login failed");
      }
      if (!user) {
        return apiResponse.unauthorized(res, info?.message || "Invalid credentials");
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return apiResponse.serverError(res, "Login failed");
        }
        return apiResponse.success(res, {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified
        });
      });
    })(req, res, next);
  });

  // Unified login endpoint - accepts email, mobile, or userId as identifier
  // This endpoint validates credentials and sends OTP for second-layer authentication
  app.post("/api/login", async (req, res, next) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
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
      // Check if it's a userId (starts with FTP)
      else if (identifier.startsWith("FTP")) {
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
        if (err) {
          console.error("Login error:", err);
          return apiResponse.serverError(res, "Login failed");
        }
        if (!user) {
          return apiResponse.unauthorized(res, info?.message || "Invalid credentials");
        }

        // Credentials are valid - now send OTP for mandatory verification
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Determine OTP destination based on identifier type
        let otpDestination: string;
        let otpType: string;

        if (identifier.includes("@")) {
          otpDestination = user.email;
          otpType = "email";
        } else if (identifier.startsWith("FTP")) {
          // For userId login, prefer email, fallback to mobile
          if (user.email) {
            otpDestination = user.email;
            otpType = "email";
          } else if (user.mobile) {
            otpDestination = user.mobile;
            otpType = "mobile";
          } else {
            return apiResponse.badRequest(res, "User account has no email or mobile for OTP verification");
          }
        } else {
          otpDestination = user.mobile;
          otpType = "mobile";
        }

        if (!otpDestination) {
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

        // Send OTP via appropriate channels (email/SMS/WhatsApp)
        if (otpType === "email") {
          const emailSent = await emailService.sendLoginOTP(otpDestination, otp);
          if (emailSent) {
            console.log(`✅ Login OTP sent to email: ${otpDestination}`);
          } else {
            console.log(`⚠️ Email failed, Login OTP for ${otpDestination}: ${otp}`);
          }
        } else {
          // For mobile, try SMS first, then WhatsApp as fallback
          const smsSent = await smsService.sendOTP(otpDestination, otp);
          if (smsSent) {
            console.log(`✅ Login OTP sent via SMS to: ${otpDestination}`);
          } else {
            // Try WhatsApp as fallback
            const whatsappSent = await whatsappService.sendLoginOTP(otpDestination, otp);
            if (!whatsappSent) {
              console.log(`📱 Login OTP for ${otpDestination}: ${otp} (SMS and WhatsApp unavailable)`);
            }
          }
        }

        // Return success with OTP destination info (don't complete login yet)
        return apiResponse.success(res, {
          requiresOtp: true,
          otpSentTo: otpType === "email" ? "email" : "mobile",
          identifier: otpDestination,
          userId: user.userId
        }, `OTP sent to your ${otpType}`);
      })(modifiedReq, res, next);
    } catch (error) {
      console.error("Unified login error:", error);
      return apiResponse.serverError(res, "Login failed");
    }
  });

  // Verify OTP and complete login - mandatory second-layer authentication
  app.post("/api/login/verify-otp", async (req, res) => {
    try {
      const { identifier, otp } = req.body;

      if (!identifier || !otp) {
        return apiResponse.badRequest(res, "Identifier and OTP are required");
      }

      // Determine OTP type based on identifier
      const otpType = identifier.includes("@") ? "email" : "mobile";

      // Verify OTP
      const isValid = await storage.verifyOtp(identifier, otpType, otp);

      if (!isValid) {
        return apiResponse.badRequest(res, "Invalid or expired OTP");
      }

      // OTP is valid - find user and complete login
      let user;
      if (otpType === "email") {
        user = await storage.getUserByEmail(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
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

      // Complete login by creating session with updated user data
      req.login(updatedUser, (loginErr) => {
        if (loginErr) {
          console.error("❌ Login session error:", loginErr);
          return apiResponse.serverError(res, "Login failed");
        }
        
        // Explicitly save session to ensure it persists
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("❌ Session save error:", saveErr);
            return apiResponse.serverError(res, "Session save failed");
          }
          
          // Log session details for debugging
          console.log("✅ Session created and saved for user:", updatedUser.email || updatedUser.mobile);
          console.log("📝 Session ID:", req.sessionID);
          console.log("🔑 User roles:", updatedUser.roles);
          console.log("🍪 Session cookie:", req.session.cookie);
          
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

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return apiResponse.serverError(res, "Logout failed");
      }
      return apiResponse.success(res, {}, "Logged out successfully");
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return apiResponse.unauthorized(res);
    }

    return apiResponse.success(res, {
      id: req.user.id,
      email: req.user.email,
      mobile: req.user.mobile,
      firstName: req.user.firstName,
      middleName: req.user.middleName,
      lastName: req.user.lastName,
      isEmailVerified: req.user.isEmailVerified,
      isMobileVerified: req.user.isMobileVerified
    });
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

      // Also try SMS
      if (user.mobile) {
        const smsSent = await smsService.sendOTP(user.mobile, otp);
        if (smsSent) {
          console.log(`✅ Password reset OTP sent via SMS to: ${user.mobile}`);
        } else {
          console.log(`⚠️ SMS delivery failed for ${user.mobile}, trying WhatsApp...`);
          const whatsappSent = await whatsappService.sendLoginOTP(user.mobile, otp);
          if (whatsappSent) {
            console.log(`✅ Password reset OTP sent via WhatsApp to: ${user.mobile}`);
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