import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { type User } from "@shared/schema";

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
      isEmailVerified: boolean;
      isMobileVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

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

  passport.serializeUser((user: Express.User, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        // Normalize user data for Express
        const normalizedUser = {
          ...user,
          isEmailVerified: user.isEmailVerified ?? false,
          isMobileVerified: user.isMobileVerified ?? false
        };
        done(null, normalizedUser);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });

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
      });

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
  app.get("/api/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
        // Banking & Nominee Information
        bankAccountNumber: user.bankAccountNumber,
        ifscCode: user.ifscCode,
        nomineeDetails: user.nomineeDetails,
        nomineeRelation: user.nomineeRelation,
        // Registry Preferences
        preferredCamsRegistration: user.preferredCamsRegistration,
        preferredKfintechRegistration: user.preferredKfintechRegistration,
        preferredNsdlRegistration: user.preferredNsdlRegistration,
        preferredCdslRegistration: user.preferredCdslRegistration,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { 
        // Enhanced KYC Fields
        panNumber, aadharNumber, passportNumber, drivingLicense, voterIdNumber,
        dateOfBirth, nationality, fatherName, motherName, spouseName, maritalStatus,
        // Address Information
        address, city, state, pincode, country,
        // Financial Information
        occupation, annualIncome, investmentExperience, riskTolerance,
        // Banking & Nominee Information
        bankAccountNumber, ifscCode, nomineeDetails, nomineeRelation,
        // Registry Preferences
        preferredCamsRegistration, preferredKfintechRegistration, preferredNsdlRegistration, preferredCdslRegistration
      } = req.body;

      const updatedUser = await storage.updateUser(req.user.id, {
        // Enhanced KYC Fields
        panNumber: panNumber || null,
        aadharNumber: aadharNumber || null,
        passportNumber: passportNumber || null,
        drivingLicense: drivingLicense || null,
        voterIdNumber: voterIdNumber || null,
        dateOfBirth: dateOfBirth || null,
        nationality: nationality || null,
        fatherName: fatherName || null,
        motherName: motherName || null,
        spouseName: spouseName || null,
        maritalStatus: maritalStatus || null,
        // Address Information
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        country: country || null,
        // Financial Information
        occupation: occupation || null,
        annualIncome: annualIncome || null,
        investmentExperience: investmentExperience || null,
        riskTolerance: riskTolerance || null,
        // Banking & Nominee Information
        bankAccountNumber: bankAccountNumber || null,
        ifscCode: ifscCode || null,
        nomineeDetails: nomineeDetails || null,
        nomineeRelation: nomineeRelation || null,
        // Registry Preferences
        preferredCamsRegistration: preferredCamsRegistration || false,
        preferredKfintechRegistration: preferredKfintechRegistration || false,
        preferredNsdlRegistration: preferredNsdlRegistration || false,
        preferredCdslRegistration: preferredCdslRegistration || false,
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
        // Banking & Nominee Information
        bankAccountNumber: updatedUser.bankAccountNumber,
        ifscCode: updatedUser.ifscCode,
        nomineeDetails: updatedUser.nomineeDetails,
        nomineeRelation: updatedUser.nomineeRelation,
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

  // Cleanup expired OTPs periodically
  setInterval(async () => {
    try {
      await storage.cleanupExpiredOtps();
    } catch (error) {
      console.error("OTP cleanup error:", error);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
}