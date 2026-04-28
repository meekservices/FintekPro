import passport from \"passport\";
import { Strategy as LocalStrategy } from \"passport-local\";
import { type Express } from \"express\";
import session from \"express-session\";
import { hashPassword, comparePasswords } from \"./crypto\";
import { storage } from \"./storage\";
import { type User } from \"@shared/schema\";
import { apiResponse } from \"./utils/responses\";
import { smsService } from \"./services/sms-service\";
import { emailService } from \"./services/email-service\";
import { whatsappService } from \"./services/whatsapp-service\";
import { db } from \"./db\";
import * as schema from \"@shared/schema\";
import { eq, and, sql } from \"drizzle-orm\";
import { randomBytes, randomInt } from \"crypto\";
import { logger } from \"./logger\";
import { isTesterAccount } from \"./utils/tester-utils\";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

// Fixed OTP for tester accounts (regulatory bypass for automated testing)
const TESTER_FIXED_OTP = \"123456\";

// Helper to generate a cryptographically secure 6-digit OTP
function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

// Helper to check if identifier is a mobile number
function isMobileNumber(identifier: string): boolean {
  // Simple validation for 10-digit mobile numbers
  return /^[6-9]\d{9}$/.test(identifier);
}

// Helper to stamp session with portal origin (SEBI audit requirement)
function stampSessionPortal(req: any) {
  const host = req.get('host') || '';
  if (host.includes('admin.')) req.session.portal = 'admin';
  else if (host.includes('agent.')) req.session.portal = 'agent';
  else if (host.includes('partner.')) req.session.portal = 'partner';
  else req.session.portal = 'client';
}

export function setupAuth(app: Express) {
  // First, apply standard session middleware for login state persistence
  // Note: auth-setup.ts also handles session but this is for local strategy specifically
  
  // Unified Registration Endpoint - Phase 1: Identity & OTP Generation
  app.post(\"/api/register\", async (req, res) => {
    try {
      // Block registration on admin portal
      const hostname = (req.headers[\"x-forwarded-host\"] || req.hostname || req.get('host') || '').toString().toLowerCase();
      if (hostname.startsWith('admin.') || hostname.includes('admin.fintekpro.com')) {
        console.warn(`⚠️ [SECURITY] Registration blocked from admin portal - Host: \${hostname}, IP: \${req.ip}`);
        return apiResponse.forbidden(res, \"Registration is not allowed on the admin portal. Please contact an administrator for access.\");
      }

      const { firstName, lastName, email, mobile, password, portal } = req.body;

      if (!firstName || !lastName || !email || !mobile || !password) {
        return apiResponse.badRequest(res, \"All fields are required\");
      }

      // Check if user already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return apiResponse.badRequest(res, \"Email already registered\");
      }

      const existingMobile = await storage.getUserByMobile(mobile);
      if (existingMobile) {
        return apiResponse.badRequest(res, \"Mobile number already registered\");
      }

      // Generate OTP and expiration
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Generate a registration token to link identity and verification
      const registrationToken = randomBytes(32).toString('hex');

      // Hash password before storing in verification metadata
      const hashedPassword = await hashPassword(password);

      // Delete any existing registration OTP for this identifier
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, email));

      // Store OTP and registration data temporarily in verification record
      await storage.createOtpVerification({
        identifier: email,
        otp,
        type: \"registration\",
        expiresAt,
        verified: false,
        metadata: {
          firstName,
          lastName,
          email,
          mobile,
          password: hashedPassword,
          portal: portal || 'client',
          registrationToken
        }
      });

      // Send OTP via multiple channels for maximum reliability
      // SMS is primary for Replit environment testing
      let primaryDelivered = false;
      const smsSent = await smsService.sendOTP(mobile, otp);
      if (smsSent) {
        console.log(`✅ Registration OTP sent via SMS to: \${mobile}`);
        primaryDelivered = true;
      } else {
        console.log(`⚠️ SMS delivery failed for \${mobile}, trying WhatsApp...`);
        const whatsappSent = await whatsappService.sendLoginOTP(mobile, otp);
        if (whatsappSent) {
          console.log(`✅ Registration OTP sent via WhatsApp to: \${mobile}`);
          primaryDelivered = true;
        }
      }

      // Secondary channel: Email
      const emailSent = await emailService.sendRegistrationOTP(email, otp);
      if (emailSent) {
        console.log(`✅ Registration OTP also sent to email: \${email}`);
      }

      return apiResponse.success(res, {
        identifier: email,
        registrationToken,
        otpSentTo: `\${mobile} (SMS) and \${email}`
      }, \"Verification code sent. Please verify your mobile/email to complete registration.\");

    } catch (error) {
      console.error(\"Registration error:\", error);
      return apiResponse.serverError(res, \"Failed to initiate registration\");
    }
  });

  // Verification endpoint for Registration
  app.post(\"/api/register/verify\", async (req, res) => {
    try {
      const { identifier, otp, registrationToken } = req.body;

      if (!identifier || !otp || !registrationToken) {
        return apiResponse.badRequest(res, \"Identifier, OTP, and registration token are required\");
      }

      // Get the OTP verification record
      const otpRecord = await db.query.otpVerifications.findFirst({
        where: (otpVerifications, { eq, and }) =>
          and(
            eq(otpVerifications.identifier, identifier),
            eq(otpVerifications.type, \"registration\")
          ),
      });

      if (!otpRecord) {
        return apiResponse.badRequest(res, \"Invalid or expired verification session\");
      }

      // Check if expired
      if (new Date() > new Date(otpRecord.expiresAt)) {
        return apiResponse.badRequest(res, \"Verification code has expired. Please request a new one.\");
      }

      // Verify registration token matches
      const metadata = otpRecord.metadata as any;
      if (!metadata || metadata.registrationToken !== registrationToken) {
        return apiResponse.unauthorized(res, \"Invalid registration token\");
      }

      // Verify OTP matches
      if (otpRecord.otp !== otp) {
        return apiResponse.badRequest(res, \"Invalid verification code\");
      }

      // Verification successful - Create the user record
      const { firstName, lastName, email, mobile, password: hashedPassword, portal } = metadata;

      // Determine default role based on registration portal
      let roleForPortal = ['client'];
      const registeredPortal = portal || 'client';
      const registeredName = `\${firstName} \${lastName}`;

      if (registeredPortal === 'agent') roleForPortal = ['agent'];
      else if (registeredPortal === 'partner') roleForPortal = ['partner'];

      const [user] = await db.insert(schema.users).values({
        firstName,
        lastName,
        email,
        mobile,
        password: hashedPassword,
        isEmailVerified: true,
        isMobileVerified: true,
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
        kycStatus: 'pending',
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
      }).returning();

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
          console.log(`✅ [Register] Agent record created for \${email}`);
        } catch (agentErr: any) {
          // Email uniqueness failure means they already have an agent record — non-fatal
          console.warn(`⚠️ [Register] Agent record creation skipped for \${email}: \${agentErr.message}`);
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
          console.log(`✅ [Register] Partner record created for \${email}`);
        } catch (partnerErr: any) {
          console.warn(`⚠️ [Register] Partner record creation skipped for \${email}: \${partnerErr.message}`);
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
        return apiResponse.serverError(res, \"Session not available. Please try again.\");
      }
      req.login(user, (err) => {
        if (err) {
          console.error(\"Login error:\", err);
          return apiResponse.serverError(res, \"Registration successful but login failed\");
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
        }, \"Registration successful\");
      });

    } catch (error) {
      console.error(\"OTP verification error:\", error);
      return apiResponse.serverError(res, \"OTP verification failed\");
    }
  });

  // Resend OTP during registration (secure endpoint)
  app.post(\"/api/register/resend-otp\", async (req, res) => {
    try {
      // Block registration on admin portal
      const hostname = (req.headers[\"x-forwarded-host\"] || req.hostname || req.get('host') || '').toString().toLowerCase();
      if (hostname.startsWith('admin.') || hostname.includes('admin.fintekpro.com')) {
        console.warn(`⚠️ [SECURITY] Registration OTP resend blocked from admin portal - Host: \${hostname}, IP: \${req.ip}`);
        return apiResponse.forbidden(res, \"Registration is not allowed on the admin portal. Please contact an administrator for access.\");
      }

      const { identifier, registrationToken } = req.body;

      if (!identifier || !registrationToken) {
        return apiResponse.badRequest(res, \"Identifier and registration token are required\");
      }

      // Find existing OTP verification record
      const otpRecord = await db.query.otpVerifications.findFirst({
        where: (otpVerifications, { eq, and }) =>
          and(
            eq(otpVerifications.identifier, identifier),
            eq(otpVerifications.type, \"registration\")
          ),
      });

      if (!otpRecord) {
        return apiResponse.badRequest(res, \"No pending registration found\");
      }

      // Verify registration token matches
      const metadata = otpRecord.metadata as any;
      if (!metadata || metadata.registrationToken !== registrationToken) {
        return apiResponse.unauthorized(res, \"Invalid registration token\");
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
        console.log(`✅ Resend OTP sent via SMS to: \${metadata.mobile}`);
        primaryDelivered = true;
      } else {
        console.log(`⚠️ SMS delivery failed for \${metadata.mobile}, trying WhatsApp...`);
        const whatsappSent = await whatsappService.sendLoginOTP(metadata.mobile, newOtp);
        if (whatsappSent) {
          console.log(`✅ Resend OTP sent via WhatsApp to: \${metadata.mobile}`);
          primaryDelivered = true;
        }
      }

      // Also send to email as secondary channel
      const emailSent = await emailService.sendRegistrationOTP(metadata.email, newOtp);
      if (emailSent) {
        console.log(`✅ Resend OTP also sent to email: \${metadata.email}`);
      }

      return apiResponse.success(res, {
        success: true,
        otpSentTo: `\${metadata.mobile} (SMS) and \${metadata.email}`
      }, \"New verification code sent\");

    } catch (error) {
      console.error(\"Resend OTP error:\", error);
      return apiResponse.serverError(res, \"Failed to resend OTP\");
    }
  });

  // Unified login endpoint - accepts email, mobile, or userId as identifier
  // This endpoint validates credentials and sends OTP for second-layer authentication
  app.post(\"/api/login\", async (req, res, next) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        console.log(\"❌ Missing identifier or password\");
        return apiResponse.badRequest(res, \"Identifier and password are required\");
      }

      // Detect identifier type and determine which strategy to use
      let strategy: string;
      let usernameField: string;

      // Check if it's an email (contains @)
      if (identifier.includes(\"@\")) {
        strategy = \"email-local\";
        usernameField = \"email\";
      } 
      // Check if it's a userId (Format: Prefix + 6 digits, e.g. FTP001234, SAN852412)
      else if (/^[A-Z]{3}[0-9]{6}$/.test(identifier) || identifier.startsWith(\"FTP\")) {
        strategy = \"userId-local\";
        usernameField = \"userId\";
      }
      // Otherwise, assume it's a mobile number
      else {
        strategy = \"mobile-local\";
        usernameField = \"mobile\";
      }

      console.log(`Logging in with strategy: \${strategy} for identifier: \${identifier}`);

      // Authenticate using the chosen passport strategy
      passport.authenticate(strategy, async (err: any, user: User, info: any) => {
        if (err) {
          console.error(`Login error (\${strategy}):`, err);
          return next(err);
        }
        if (!user) {
          console.log(`Authentication failed (\${strategy}):`, info?.message);
          return apiResponse.unauthorized(res, info?.message || \"Invalid credentials\");
        }

        // ── OTP Logic (Second-Layer Authentication) ───────────────────────────
        
        // Use fixed OTP for tester accounts (regulatory testing requirement)
        const isTester = isTesterAccount(identifier);
        const otp = isTester ? TESTER_FIXED_OTP : generateOtp();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Delete any existing OTP for this identifier
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.identifier, identifier));

        // Create new OTP verification record
        await storage.createOtpVerification({
          identifier,
          otp,
          type: \"login\",
          expiresAt,
          verified: false,
          metadata: { userId: user.id }
        });

        // Skip sending actual OTP for tester accounts
        if (isTester) {
          console.log(`✅ [Tester] Internal OTP \${otp} recorded for \${identifier} (bypass enabled)`);
          return apiResponse.success(res, {
            identifier,
            otpRequired: true,
            isTester: true,
            message: \"Tester authentication initiated. Please enter the fixed test OTP.\"
          }, \"Authentication successful, OTP required\");
        }

        // Send OTP via available channels (Mobile is primary for Replit environment)
        let smsSent = false;
        let whatsappSent = false;
        let emailSent = false;

        // Try SMS first (highest delivery reliability in target region)
        if (user.mobile) {
          smsSent = await smsService.sendOTP(user.mobile, otp);
          if (smsSent) {
            console.log(`✅ Login OTP sent via SMS to: \${user.mobile}`);
          } else {
            // Fallback to WhatsApp
            whatsappSent = await whatsappService.sendLoginOTP(user.mobile, otp);
            if (whatsappSent) {
              console.log(`✅ Login OTP sent via WhatsApp to: \${user.mobile}`);
            }
          }
        }

        // Always send to email as a secondary channel
        if (user.email) {
          emailSent = await emailService.sendLoginOTP(user.email, otp);
          if (emailSent) {
            console.log(`✅ Login OTP also sent to email: \${user.email}`);
          }
        }

        // Audit log the authentication attempt (DPDP Act §8)
        logger.info(`Authentication step 1 complete for user \${user.userId}`, {
          identifier,
          method: strategy,
          smsSent,
          whatsappSent,
          emailSent
        });

        return apiResponse.success(res, {
          identifier,
          otpRequired: true,
          otpSentTo: user.mobile ? `\${user.mobile} (Mobile)` : user.email
        }, \"Authentication successful, verification code sent\");

      })(req, res, next);

    } catch (error) {
      console.error(\"Login processing error:\", error);
      return apiResponse.serverError(res, \"Internal login failure\");
    }
  });

  // OTP Verification Endpoint for Login
  app.post(\"/api/login/verify\", async (req, res) => {
    try {
      const { identifier, otp } = req.body;

      if (!identifier || !otp) {
        return apiResponse.badRequest(res, \"Identifier and OTP are required\");
      }

      // Get the OTP verification record
      const otpRecord = await storage.getOtpVerification(identifier, \"login\");

      if (!otpRecord) {
        return apiResponse.badRequest(res, \"No pending login found for this identifier\");
      }

      // Check if expired
      if (new Date() > new Date(otpRecord.expiresAt)) {
        return apiResponse.badRequest(res, \"Verification code has expired. Please log in again.\");
      }

      // Verify OTP matches
      if (otpRecord.otp !== otp) {
        return apiResponse.badRequest(res, \"Invalid verification code\");
      }

      // Find the user associated with this OTP
      const metadata = otpRecord.metadata as any;
      const user = await storage.getUser(metadata.userId);

      if (!user) {
        return apiResponse.serverError(res, \"User not found during verification\");
      }

      // Final step: Log the user in via Passport
      req.login(user, async (err) => {
        if (err) {
          console.error(\"Passport login error:\", err);
          return apiResponse.serverError(res, \"Final login step failed\");
        }

        // Delete the used OTP record
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.id, otpRecord.id));

        // Update login statistics
        await storage.updateUser(user.id, {
          lastLoginAt: new Date(),
          previousLoginAt: user.lastLoginAt,
          loginCount: (user.loginCount || 0) + 1
        });

        // SEBI audit trail: log successful portal access
        stampSessionPortal(req);
        logger.info(`User \${user.userId} logged in successfully via \${req.session.portal} portal`, {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

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
          portal: req.session.portal
        }, \"Login successful\");
      });

    } catch (error) {
      console.error(\"OTP verification error:\", error);
      return apiResponse.serverError(res, \"Failed to verify login code\");
    }
  });

  // Logout endpoint
  app.post(\"/api/logout\", (req, res) => {
    if (!req.isAuthenticated()) {
      return apiResponse.badRequest(res, \"No active session\");
    }

    const userId = req.user?.userId;
    req.logout((err) => {
      if (err) return apiResponse.serverError(res, \"Logout failed\");
      
      // Destroy session explicitly to prevent session fixation attacks
      req.session.destroy((destroyErr) => {
        if (destroyErr) console.warn('⚠️ Session destruction failed:', destroyErr);
        
        logger.info(`User \${userId} logged out`);
        return apiResponse.success(res, null, \"Logged out successfully\");
      });
    });
  });

  // Identity route - returns currently logged in user info
  app.get(\"/api/user\", (req, res) => {
    if (!req.isAuthenticated()) {
      return apiResponse.unauthorized(res);
    }
    
    // Safety check - ensure portal is stamped even if session was restored from store
    if (!req.session.portal) stampSessionPortal(req);
    
    return apiResponse.success(res, req.user);
  });

  // UI Preference update route
  app.patch(\"/api/user/preferences\", async (req, res) => {
    if (!req.isAuthenticated()) {
      return apiResponse.unauthorized(res);
    }

    try {
      const { navPosition } = req.body;
      
      // Validate navPosition - require a valid value
      const validPositions = [\"left\", \"top\", \"bottom\"];
      if (!navPosition || !validPositions.includes(navPosition)) {
        return apiResponse.badRequest(res, \"Invalid nav position. Must be 'left', 'top', or 'bottom'\");
      }

      // Update user preferences
      await storage.updateUser(req.user.id, { navPosition });

      return apiResponse.success(res, {
        navPosition
      }, \"Preferences updated successfully\");
    } catch (error) {
      console.error(\"Error updating preferences:\", error);
      return apiResponse.serverError(res, \"Failed to update preferences\");
    }
  });

  // Profile routes
  // Agent-only profile access route  
  app.get(\"/api/agent/profile/:userId\", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, \"Agent access required\");
      }

      const userId = req.params.userId;

      const user = await storage.getUser(userId);
      if (!user) {
        return apiResponse.notFound(res, \"User not found\");
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
        console.log(\"No agent assigned or error fetching agent data:\", error);
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
        euinNumber: agentData?.euinNumber || user.euinNumber || \"\",
        arnCode: agentData?.arnCode || user.arnCode || \"\",
        distributorId: agentData?.distributorId || user.distributorId || \"\",
        
        // PAN Consent Status
        panVerificationConsent: user.panVerificationConsent || false,
        panConsentGivenAt: user.panConsentGivenAt
      });
    } catch (error) {
      console.error(\"Error fetching profile:\", error);
      return apiResponse.serverError(res);
    }
  });

  // Agent-only profile update route
  app.put(\"/api/agent/profile/:userId\", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, \"Agent access required\");
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
        ...(permanentAddress && { permanentAddress }),
        ...(permanentCity && { permanentCity }),
        ...(permanentState && { permanentState }),
        ...(permanentPincode && { permanentPincode }),
        ...(permanentCountry && { permanentCountry }),
        ...(typeof isAddressSame === 'boolean' && { isAddressSame }),
        
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
        ...(crsStatus && { crsStatus }),
        ...(crsTaxResidentCountries && { crsTaxResidentCountries }),
        ...(crsTinNumbers && { crsTinNumbers }),
        
        // PEP Declaration - Enhanced
        ...(pepStatus && { pepStatus }),
        ...(pepDetails && { pepDetails }),
        ...(pepRelatedPersonStatus && { pepRelatedPersonStatus }),
        ...(pepRelationshipDetails && { pepRelationshipDetails }),
        
        // UBO Information - Enhanced
        ...(isUbo && { isUbo }),
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
        ...(preferredCamsRegistration && { preferredCamsRegistration }),
        ...(preferredKfintechRegistration && { preferredKfintechRegistration }),
        ...(preferredNsdlRegistration && { preferredNsdlRegistration }),
        ...(preferredCdslRegistration && { preferredCdslRegistration })
      });

      return apiResponse.success(res, updatedUser);
    } catch (error) {
      console.error(\"Error updating profile:\", error);
      return apiResponse.serverError(res);
    }
  });

  // AML Screening route (agent only)
  app.post(\"/api/agent/aml-screening/:userId\", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, \"Agent access required\");
      }

      const userId = req.params.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return apiResponse.notFound(res, \"User not found\");
      }

      // Trigger AML screening using aml-service
      const { amlService } = await import(\"./services/aml-service\");
      
      const screeningData = {
        name: `\${user.firstName} \${user.lastName}`,
        pan: user.panNumber,
        dob: user.dateOfBirth,
        country: user.country || 'IN'
      };

      const screeningResult = await amlService.performFullScreening(screeningData);

      return apiResponse.success(res, {
        success: true,
        result: screeningResult
      }, \"AML screening completed successfully\");
    } catch (error) {
      console.error(\"Error in AML screening:\", error);
      return apiResponse.serverError(res, \"AML screening failed\");
    }
  });

  // PAN Verification Consent Routes
  app.get(\"/api/agent/pan-consent/check/:userId\", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, \"Agent access required\");
      }

      const userId = req.params.userId;
      const hasConsent = await storage.checkPanVerificationConsent(userId);
      return apiResponse.success(res, { hasConsent });
    } catch (error) {
      console.error(\"Error checking PAN consent:\", error);
      return apiResponse.serverError(res, \"Failed to check consent status\");
    }
  });

  app.post(\"/api/agent/pan-consent/record/:userId\", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return apiResponse.unauthorized(res);
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return apiResponse.forbidden(res, \"Agent access required\");
      }

      const userId = req.params.userId;

      // Check if consent already exists
      const existingConsent = await storage.checkPanVerificationConsent(userId);
      if (existingConsent) {
        return apiResponse.success(res, { hasConsent: true }, \"Consent already recorded\");
      }

      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      await storage.recordPanVerificationConsent(userId, ipAddress, userAgent);
      
      return apiResponse.success(res, { hasConsent: true }, \"PAN verification consent recorded successfully\");
    } catch (error) {
      console.error(\"Error recording PAN consent:\", error);
      return apiResponse.serverError(res, \"Failed to record consent\");
    }
  });

  // Forgot Password - Request OTP
  app.post(\"/api/auth/forgot-password\", async (req, res) => {
    try {
      const { identifier } = req.body;

      if (!identifier) {
        return apiResponse.badRequest(res, \"Email, mobile, or User ID is required\");
      }

      // Find user by identifier (email, mobile, or userId)
      let user;
      if (identifier.includes(\"@\")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith(\"FTP\")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      // Don't reveal whether user exists for security
      if (!user) {
        // Still return success to prevent user enumeration
        return apiResponse.success(res, {
          message: \"If an account exists with this identifier, an OTP has been sent\"
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
        type: \"password_reset\",
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
          console.log(`✅ Password reset OTP sent to email: \${user.email}`);
        }
      }

      // Also try WhatsApp (default preference), then SMS as fallback
      if (user.mobile) {
        const whatsappSent = await whatsappService.sendLoginOTP(user.mobile, otp);
        if (whatsappSent) {
          console.log(`✅ Password reset OTP sent via WhatsApp to: \${user.mobile}`);
        } else {
          console.log(`⚠️ WhatsApp delivery failed for \${user.mobile}, trying SMS...`);
          const smsSent = await smsService.sendOTP(user.mobile, otp);
          if (smsSent) {
            console.log(`✅ Password reset OTP sent via SMS to: \${user.mobile}`);
          }
        }
      }

      return apiResponse.success(res, {
        message: \"If an account exists with this identifier, an OTP has been sent\"
      });
    } catch (error) {
      console.error(\"Error in forgot password:\", error);
      return apiResponse.serverError(res, \"Failed to process password reset request\");
    }
  });

  // Reset Password - Verify OTP and Update Password
  app.post(\"/api/auth/reset-password\", async (req, res) => {
    try {
      const { identifier, otp, newPassword } = req.body;

      if (!identifier || !otp || !newPassword) {
        return apiResponse.badRequest(res, \"Identifier, OTP, and new password are required\");
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return apiResponse.badRequest(res, \"Password must be at least 6 characters long\");
      }

      // Find user by identifier
      let user;
      if (identifier.includes(\"@\")) {
        user = await storage.getUserByEmail(identifier);
      } else if (identifier.startsWith(\"FTP\")) {
        user = await storage.getUserByUserId(identifier);
      } else {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        return apiResponse.badRequest(res, \"Invalid identifier or OTP\");
      }

      // Get the OTP verification record
      const otpIdentifier = user.email || user.mobile || user.userId;
      const otpRecord = await storage.getOtpVerification(
        otpIdentifier,
        \"password_reset\"
      );

      if (!otpRecord) {
        return apiResponse.badRequest(res, \"Invalid or expired OTP\");
      }

      // Check if OTP is expired
      const isExpired = new Date() > new Date(otpRecord.expiresAt);
      if (isExpired) {
        return apiResponse.badRequest(res, \"OTP has expired. Please request a new one\");
      }

      // Verify OTP matches
      if (otpRecord.otp !== otp) {
        return apiResponse.badRequest(res, \"Invalid OTP\");
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      // Delete the used OTP
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.id, otpRecord.id));

      console.log(`✅ Password reset successful for user: \${user.userId}`);

      return apiResponse.success(res, {
        message: \"Password reset successful. You can now log in with your new password.\"
      });
    } catch (error) {
      console.error(\"Error in reset password:\", error);
      return apiResponse.serverError(res, \"Failed to reset password\");
    }
  });

  // Cleanup expired OTPs periodically
  setInterval(async () => {
    try {
      await storage.cleanupExpiredOtps();
    } catch (error) {
      console.error(\"OTP cleanup error:\", error);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
}
