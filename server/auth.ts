import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { emailService } from "./email-service";

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
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
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
          const user = await storage.getUserByMobile(mobile);
          if (!user || !(await comparePasswords(password, user.password))) {
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

  // Note: serializeUser and deserializeUser are already configured by setupReplitAuth
  // The Replit Auth serializes the entire user object, which works for both OAuth and local auth

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { email, mobile, password, firstName, middleName, lastName } = req.body;

      if (!email && !mobile) {
        return res.status(400).json({ message: "Email or mobile number is required" });
      }

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Check if user already exists
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "User with this email already exists" });
        }
      }

      if (mobile) {
        const existingUser = await storage.getUserByMobile(mobile);
        if (existingUser) {
          return res.status(400).json({ message: "User with this mobile number already exists" });
        }
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email: email || null,
        mobile: mobile || null,
        password: hashedPassword,
        firstName: firstName || null,
        middleName: middleName || null,
        lastName: lastName || null,
        profileImageUrl: null,
        isEmailVerified: false,
        isMobileVerified: false,
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
        nsdlDpId: null,
        nsdlClientId: null,
        cdslBoId: null,
        cdslDpId: null,
        roles: ["user"],
        isActive: true,
        lastLoginAt: null,
        loginCount: 0,
        agentId: null,
        complianceOfficer: null,
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
      });

      // Auto-assign to default agent if only one agent exists
      await storage.autoAssignDefaultAgent(user.id);

      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.status(201).json({
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login with email
  app.post("/api/login/email", (req, res, next) => {
    passport.authenticate("email-local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
        });
      });
    })(req, res, next);
  });

  // Login with mobile
  app.post("/api/login/mobile", (req, res, next) => {
    passport.authenticate("mobile-local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
        });
      });
    })(req, res, next);
  });

  // Send OTP for mobile verification
  app.post("/api/otp/send", async (req, res) => {
    try {
      const { identifier, type } = req.body; // identifier = email or mobile, type = 'email' or 'mobile'

      if (!identifier || !type) {
        return res.status(400).json({ message: "Identifier and type are required" });
      }

      if (type !== "email" && type !== "mobile") {
        return res.status(400).json({ message: "Type must be either 'email' or 'mobile'" });
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

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("OTP send error:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // Verify OTP
  app.post("/api/otp/verify", async (req, res) => {
    try {
      const { identifier, type, otp } = req.body;

      if (!identifier || !type || !otp) {
        return res.status(400).json({ message: "Identifier, type, and OTP are required" });
      }

      const isValid = await storage.verifyOtp(identifier, type, otp);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
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

      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("OTP verify error:", error);
      res.status(500).json({ message: "OTP verification failed" });
    }
  });

  // Forgot Password - Send OTP
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { identifier } = req.body; // Can be email or mobile

      if (!identifier) {
        return res.status(400).json({ message: "Email or mobile number is required" });
      }

      // Find user by email or mobile
      let user = await storage.getUserByEmail(identifier);
      if (!user) {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ message: "If an account exists, a password reset OTP has been sent" });
      }

      // Generate 6-digit OTP
      const resetOtp = generateOtp();

      // Store the reset token in database
      await storage.createPasswordResetToken(user.id, identifier, resetOtp);

      // Send OTP via email if identifier is email, otherwise log to console
      const isEmail = identifier.includes('@');
      if (isEmail) {
        const emailSent = await emailService.sendPasswordResetOTP(identifier, resetOtp);
        if (emailSent) {
          console.log(`✅ Password reset OTP sent to ${identifier}`);
        } else {
          console.log(`⚠️ Failed to send email, OTP for ${identifier}: ${resetOtp}`);
        }
      } else {
        // For mobile numbers, log to console (SMS integration can be added later)
        console.log(`📱 Password Reset OTP for ${identifier}: ${resetOtp}`);
      }

      res.json({ message: "If an account exists, a password reset OTP has been sent" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset Password - Verify OTP and Update Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { identifier, otp, newPassword } = req.body;

      if (!identifier || !otp || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Find user by email or mobile
      let user = await storage.getUserByEmail(identifier);
      if (!user) {
        user = await storage.getUserByMobile(identifier);
      }

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Get the reset token
      const resetToken = await storage.getPasswordResetToken(user.id, otp);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Check if token is expired (10 minutes)
      const isExpired = new Date() > new Date(resetToken.expiresAt);
      if (isExpired) {
        return res.status(400).json({ message: "OTP has expired. Please request a new one" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(resetToken.id);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    res.json({
      id: req.user.id,
      email: req.user.email,
      mobile: req.user.mobile,
      firstName: req.user.firstName,
      middleName: req.user.middleName,
      lastName: req.user.lastName,
      isEmailVerified: req.user.isEmailVerified,
      isMobileVerified: req.user.isMobileVerified,
    });
  });

  // Profile routes
  // Agent-only profile access route  
  app.get("/api/agent/profile/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return res.status(403).json({ message: "Agent access required" });
      }

      const userId = req.params.userId;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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

      res.json({
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
        panConsentGivenAt: user.panConsentGivenAt,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Agent-only profile update route
  app.put("/api/agent/profile/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return res.status(403).json({ message: "Agent access required" });
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
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
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
        preferredCdslRegistration: updatedUser.preferredCdslRegistration,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // CKYC Integration Endpoints - Agent Only
  app.post("/api/agent/ckyc-register/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return res.status(403).json({ message: "Agent access required" });
      }

      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Import CKYC service dynamically to avoid module loading issues
      const { CKYCService } = await import("./ckyc-service");
      const ckycService = new CKYCService();

      // Perform comprehensive KYC registration
      const results = await ckycService.performComprehensiveKYC(user);

      res.json({
        success: true,
        message: "CKYC registration completed",
        results: {
          ckyc: results.ckyc,
          kra: results.kra || null,
          cvl: results.cvl || null,
        }
      });
    } catch (error) {
      console.error("Error in CKYC registration:", error);
      res.status(500).json({ 
        success: false,
        message: "CKYC registration failed",
        error: "Internal server error" 
      });
    }
  });

  app.get("/api/agent/ckyc-search", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return res.status(403).json({ message: "Agent access required" });
      }

      const { panNumber, ckycNumber, aadharNumber, passportNumber } = req.query;

      if (!panNumber && !ckycNumber && !aadharNumber && !passportNumber) {
        return res.status(400).json({ 
          message: "At least one search parameter is required (PAN, CKYC, Aadhaar, or Passport)" 
        });
      }

      const { CKYCService } = await import("./ckyc-service");
      const ckycService = new CKYCService();

      const searchResult = await ckycService.searchCKYC({
        panNumber: panNumber as string,
        ckycNumber: ckycNumber as string,
        aadharNumber: aadharNumber as string,
        passportNumber: passportNumber as string,
      });

      res.json(searchResult);
    } catch (error) {
      console.error("Error in CKYC search:", error);
      res.status(500).json({ 
        success: false,
        message: "CKYC search failed",
        error: "Internal server error" 
      });
    }
  });

  // Enhanced AML Screening with Profile Integration
  app.post("/api/profile/aml-screening", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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

      res.json({
        success: true,
        message: "AML screening completed successfully",
        result: screeningResult
      });
    } catch (error) {
      console.error("Error in AML screening:", error);
      res.status(500).json({ 
        success: false,
        message: "AML screening failed",
        error: "Internal server error" 
      });
    }
  });

  // PAN Verification Consent Routes
  app.get("/api/agent/pan-consent/check/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return res.status(403).json({ message: "Agent access required" });
      }

      const userId = req.params.userId;
      const hasConsent = await storage.checkPanVerificationConsent(userId);
      res.json({ hasConsent });
    } catch (error) {
      console.error("Error checking PAN consent:", error);
      res.status(500).json({ message: "Failed to check consent status" });
    }
  });

  app.post("/api/agent/pan-consent/record/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has agent/admin role
      const userRoles = req.user.roles || [];
      if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('super_admin')) {
        return res.status(403).json({ message: "Agent access required" });
      }

      const userId = req.params.userId;

      // Check if consent already exists
      const existingConsent = await storage.checkPanVerificationConsent(userId);
      if (existingConsent) {
        return res.json({ message: "Consent already recorded", hasConsent: true });
      }

      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      await storage.recordPanVerificationConsent(userId, ipAddress, userAgent);
      
      res.json({ message: "PAN verification consent recorded successfully", hasConsent: true });
    } catch (error) {
      console.error("Error recording PAN consent:", error);
      res.status(500).json({ message: "Failed to record consent" });
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