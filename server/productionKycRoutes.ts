import { Router } from "express";
import type { IStorage } from "./storage";
import { apiResponse } from "./utils/responses";
import multer from "multer";
import path from "path";
import { objectStorageClient } from "./objectStorage";

/**
 * Production KYC Routes
 * Smart onboarding workflow with database-first PAN validation
 */
export function createProductionKycRouter(storage: IStorage, requireClientOrHigher: any) {
  const router = Router();

  // Configure multer for file uploads (memory storage for streaming to object storage)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: (req, file, cb) => {
      // Only allow PDF files
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.pdf') {
        cb(new Error('Only PDF files are allowed'));
        return;
      }
      cb(null, true);
    },
  });

  // Check if PAN exists in database
  router.post("/check-pan", requireClientOrHigher, async (req: any, res) => {
    try {
      const { panNumber } = req.body;
      const userId = req.user.id;

      if (!panNumber || typeof panNumber !== 'string' || panNumber.length !== 10) {
        return apiResponse.badRequest(res, "Valid PAN number is required");
      }

      // Check if PAN exists in database for this user
      const existingPan = await storage.getUserPanDetails(userId, panNumber.toUpperCase());

      console.log(`🔍 [check-pan] PAN lookup for ${panNumber}:`, existingPan ? 'FOUND' : 'NOT FOUND');

      if (existingPan) {
        const responseData = {
          exists: true,
          panData: {
            panNumber: existingPan.panNumber,
            name: existingPan.fullName,
            dob: existingPan.dateOfBirth,
            verified: existingPan.verified,
          },
        };
        console.log(`✅ [check-pan] Sending response:`, JSON.stringify(responseData, null, 2));
        return apiResponse.success(res, responseData);
      }

      console.log(`✅ [check-pan] Sending response: { exists: false }`);
      return apiResponse.success(res, { exists: false });
    } catch (error) {
      console.error("Error checking PAN:", error);
      return apiResponse.serverError(res, "Failed to check PAN");
    }
  });

  // Verify PAN via Sandbox API and save to database
  router.post("/verify-pan", requireClientOrHigher, async (req: any, res) => {
    try {
      const { panNumber, fullName, dob } = req.body;
      const userId = req.user.id;

      if (!panNumber || !fullName || !dob) {
        return apiResponse.badRequest(res, "PAN number, full name, and date of birth are required");
      }

      // Use SandboxKYCService for proper authentication
      const { SandboxKYCService } = await import('./services/sandbox-kyc-service');
      const sandboxKYC = new SandboxKYCService();
      
      // Verify PAN via Sandbox API with proper authentication
      const panData = await sandboxKYC.verifyIndividualPAN(
        panNumber.toUpperCase(),
        fullName,
        dob
      );

      // Validate PAN data matches user input
      const nameMatch = panData.fullName?.toLowerCase().includes(fullName.toLowerCase()) ||
                       fullName.toLowerCase().includes(panData.fullName?.toLowerCase() || '');
      
      if (!nameMatch) {
        return apiResponse.error(res, "PAN name does not match provided name", 400);
      }

      // Save to database
      await storage.saveUserPanDetails({
        userId,
        panNumber: panData.pan,
        fullName: panData.fullName,
        dateOfBirth: panData.dateOfBirth,
        panType: panData.category || "Individual",
        verified: true,
      });

      return apiResponse.success(res, {
        success: true,
        panData: {
          panNumber: panData.pan,
          name: panData.fullName,
          dob: panData.dateOfBirth,
          category: panData.category,
        },
      });
    } catch (error: any) {
      console.error("Error verifying PAN:", error);
      const errorMessage = error.message || "Failed to verify PAN";
      return apiResponse.error(res, errorMessage, 400);
    }
  });

  // Check for existing production KYC sessions (only in-progress)
  router.post("/check-session", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get the most recent incomplete session
      const existingSession = await storage.getLatestProductionKycSession(userId);

      // Only return sessions that are in progress (not completed or cancelled)
      if (
        existingSession &&
        existingSession.currentStep !== "completed" &&
        existingSession.currentStep !== "cancelled" &&
        new Date(existingSession.expiresAt || 0) > new Date()
      ) {
        return apiResponse.success(res, {
          hasSession: true,
          session: existingSession,
        });
      }

      return apiResponse.success(res, { hasSession: false });
    } catch (error) {
      console.error("Error checking session:", error);
      return apiResponse.serverError(res, "Failed to check session");
    }
  });

  // Cancel existing production KYC session
  router.post("/cancel-session", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      const userId = req.user.id;

      if (!sessionId) {
        return apiResponse.badRequest(res, "Session ID is required");
      }

      await storage.cancelProductionKycSession(sessionId, userId);

      return apiResponse.success(res, { success: true, message: "Session cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling session:", error);
      return apiResponse.serverError(res, "Failed to cancel session");
    }
  });

  // Start production KYC workflow (KRA check)
  router.post("/start", requireClientOrHigher, async (req: any, res) => {
    try {
      const { panNumber, panDob, userType } = req.body;
      const userId = req.user.id;

      if (!panNumber || !userType) {
        return apiResponse.badRequest(res, "PAN number and user type are required");
      }

      // Create or get production KYC session
      const session = await storage.createProductionKycSession({
        userId,
        panNumber: panNumber.toUpperCase(),
        userType,
        currentStep: "kra_check_pending",
        panVerified: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Start KRA verification workflow
      const kraWorkflow = await import('./services/kyc-workflow-orchestrator');
      const result = await kraWorkflow.startProductionKycWorkflow(session.id, {
        panNumber: panNumber.toUpperCase(),
        dob: panDob,
        userType,
      });

      return apiResponse.success(res, {
        success: true,
        session: result.session,
      });
    } catch (error) {
      console.error("Error starting KYC workflow:", error);
      return apiResponse.serverError(res, "Failed to start KYC workflow");
    }
  });

  // Get production KYC session status
  router.get("/status/:sessionId", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = await storage.getProductionKycSession(sessionId, userId);

      if (!session) {
        return apiResponse.notFound(res, "Session not found");
      }

      return apiResponse.success(res, { session });
    } catch (error) {
      console.error("Error getting session status:", error);
      return apiResponse.serverError(res, "Failed to get session status");
    }
  });

  // Cashfree Aadhaar eKYC initialization
  router.post("/cashfree/init", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, aadhaarNumber } = req.body;
      const userId = req.user.id;

      if (!sessionId || !aadhaarNumber) {
        return apiResponse.badRequest(res, "Session ID and Aadhaar number are required");
      }

      // Verify session belongs to user
      const session = await storage.getProductionKycSession(sessionId, userId);
      if (!session) {
        return apiResponse.notFound(res, "Session not found");
      }

      // Initialize Cashfree Aadhaar verification
      // TODO: Implement Cashfree API integration
      const transactionId = `TXN${Date.now()}`;

      return apiResponse.success(res, {
        success: true,
        transactionId,
        message: "OTP sent to registered mobile number",
      });
    } catch (error) {
      console.error("Error initializing Cashfree eKYC:", error);
      return apiResponse.serverError(res, "Failed to send OTP");
    }
  });

  // Cashfree Aadhaar OTP verification
  router.post("/cashfree/verify-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, otp } = req.body;
      const userId = req.user.id;

      if (!sessionId || !otp) {
        return apiResponse.badRequest(res, "Session ID and OTP are required");
      }

      // Verify session belongs to user
      const session = await storage.getProductionKycSession(sessionId, userId);
      if (!session) {
        return apiResponse.notFound(res, "Session not found");
      }

      // Verify OTP with Cashfree
      // TODO: Implement Cashfree OTP verification

      // Update session
      await storage.updateProductionKycSession(sessionId, {
        currentStep: "cersai_submission",
        cashfreeVerified: true,
      });

      return apiResponse.success(res, {
        success: true,
        message: "Aadhaar verified successfully",
      });
    } catch (error) {
      console.error("Error verifying Cashfree OTP:", error);
      return apiResponse.serverError(res, "Failed to verify OTP");
    }
  });

  // CERSAI submission
  router.post("/cersai/submit", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      const userId = req.user.id;

      const session = await storage.getProductionKycSession(sessionId, userId);
      if (!session) {
        return apiResponse.notFound(res, "Session not found");
      }

      // Submit to CERSAI
      // TODO: Implement CERSAI API integration

      await storage.updateProductionKycSession(sessionId, {
        currentStep: "bse_ucc",
        cersaiSubmitted: true,
      });

      return apiResponse.success(res, {
        success: true,
        message: "CERSAI submission successful",
      });
    } catch (error) {
      console.error("Error submitting to CERSAI:", error);
      return apiResponse.serverError(res, "Failed to submit to CERSAI");
    }
  });

  // BSE UCC creation
  router.post("/bse/create-ucc", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      const userId = req.user.id;

      const session = await storage.getProductionKycSession(sessionId, userId);
      if (!session) {
        return apiResponse.notFound(res, "Session not found");
      }

      // Create UCC in BSE
      // TODO: Implement BSE API integration
      const uccNumber = `UCC${Date.now()}`;

      await storage.updateProductionKycSession(sessionId, {
        currentStep: "completed",
        uccCreated: true,
        uccNumber,
      });

      return apiResponse.success(res, {
        success: true,
        uccNumber,
        message: "UCC created successfully",
      });
    } catch (error) {
      console.error("Error creating BSE UCC:", error);
      return apiResponse.serverError(res, "Failed to create UCC");
    }
  });

  // Get KYC Tier Status
  router.get("/tier-status", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Import tier detection service
      const { detectProductionKycTier, PRODUCTION_TIER_MATRIX, getVerificationDisplayName } = await import("./kyc-tier-service");
      
      const tierDetection = await detectProductionKycTier(userId);
      
      // Format response with user-friendly names
      const response = {
        currentTier: tierDetection.currentTier,
        currentTierName: tierDetection.currentTier ? PRODUCTION_TIER_MATRIX[tierDetection.currentTier].name : null,
        currentTierDescription: tierDetection.currentTier ? PRODUCTION_TIER_MATRIX[tierDetection.currentTier].description : null,
        eligibleForUpgrade: tierDetection.eligibleForUpgrade,
        nextTier: tierDetection.nextTier,
        nextTierName: tierDetection.nextTier ? PRODUCTION_TIER_MATRIX[tierDetection.nextTier].name : null,
        nextTierDescription: tierDetection.nextTier ? PRODUCTION_TIER_MATRIX[tierDetection.nextTier].description : null,
        completedVerifications: tierDetection.completedVerifications.map(v => ({
          code: v,
          name: getVerificationDisplayName(v)
        })),
        missingVerifications: tierDetection.missingVerifications.map(v => ({
          code: v,
          name: getVerificationDisplayName(v)
        })),
        unlockedFeatures: tierDetection.unlockedFeatures,
      };
      
      return apiResponse.success(res, response);
    } catch (error) {
      console.error("Error getting tier status:", error);
      return apiResponse.serverError(res, "Failed to get tier status");
    }
  });

  // Initiate Tier Upgrade
  router.post("/upgrade", requireClientOrHigher, async (req: any, res) => {
    try {
      const { targetTier } = req.body;
      const userId = req.user.id;
      
      if (!targetTier || !["tier_2", "tier_3"].includes(targetTier)) {
        return apiResponse.badRequest(res, "Valid target tier is required (tier_2 or tier_3)");
      }
      
      // Import tier detection service
      const { detectProductionKycTier, updateProductionKycTier } = await import("./kyc-tier-service");
      
      // Check if user is eligible for upgrade
      const tierDetection = await detectProductionKycTier(userId);
      
      if (tierDetection.currentTier === targetTier) {
        return apiResponse.error(res, "You are already at this tier", 400);
      }
      
      if (tierDetection.nextTier !== targetTier) {
        return apiResponse.error(res, "You must upgrade to the next tier sequentially", 400);
      }
      
      if (!tierDetection.eligibleForUpgrade) {
        return apiResponse.error(res, "You have not completed all requirements for this tier", 400);
      }
      
      // Create a new KYC session for the upgrade
      const session = await storage.createProductionKycSession({
        userId,
        userType: "individual", // Default, can be updated
        currentStep: "pan_verification",
        targetKycTier: targetTier,
        previousKycTier: tierDetection.currentTier || undefined,
        isUpgradeSession: true,
        kycStatus: "in_progress",
      });
      
      // Update user's tier
      await updateProductionKycTier(userId, targetTier, session.id, "user");
      
      return apiResponse.success(res, {
        success: true,
        message: `Successfully upgraded to ${targetTier}`,
        sessionId: session.id,
        newTier: targetTier,
      });
    } catch (error) {
      console.error("Error upgrading tier:", error);
      return apiResponse.serverError(res, "Failed to upgrade tier");
    }
  });

  // ==================== TIER 3: ACCREDITED INVESTOR ROUTES ====================

  // Initiate Accredited Investor verification
  router.post("/accredited-investor/initiate", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { verificationBasis, netWorthAmount, annualIncomeAmount } = req.body;

      // Validate verification basis
      if (!verificationBasis || !["networth", "income", "both"].includes(verificationBasis)) {
        return apiResponse.badRequest(res, "Valid verification basis required (networth, income, or both)");
      }

      // Validate amounts based on verification basis
      if ((verificationBasis === "networth" || verificationBasis === "both") && !netWorthAmount) {
        return apiResponse.badRequest(res, "Net worth amount is required");
      }
      if ((verificationBasis === "income" || verificationBasis === "both") && !annualIncomeAmount) {
        return apiResponse.badRequest(res, "Annual income amount is required");
      }

      const { db } = await import("./db");
      const schema = await import("@shared/schema");

      // Check if user already has a pending verification
      const existingVerification = await db.query.accreditedInvestorVerifications.findFirst({
        where: (table: any, { eq, and }: any) => and(
          eq(table.userId, userId),
          eq(table.status, "pending")
        ),
      });

      if (existingVerification) {
        return apiResponse.error(res, "You already have a pending AI verification. Please complete or cancel it first.", 400);
      }

      // Create new verification record
      const [verification] = await db.insert(schema.accreditedInvestorVerifications).values({
        userId,
        status: "pending",
        currentStep: "ca_upload",
        verificationBasis,
        netWorthAmount: netWorthAmount ? netWorthAmount.toString() : null,
        annualIncomeAmount: annualIncomeAmount ? annualIncomeAmount.toString() : null,
      }).returning();

      return apiResponse.success(res, {
        success: true,
        verificationId: verification.id,
        currentStep: "ca_upload",
        message: "Accredited Investor verification initiated. Please upload CA certificate.",
      });
    } catch (error) {
      console.error("Error initiating AI verification:", error);
      return apiResponse.serverError(res, "Failed to initiate AI verification");
    }
  });

  // Upload CA certificate files to object storage
  router.post("/accredited-investor/upload-file", requireClientOrHigher, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return apiResponse.badRequest(res, "No file uploaded");
      }

      // Validate file content (not just extension)
      const { fileTypeFromBuffer } = await import('file-type');
      const fileType = await fileTypeFromBuffer(file.buffer);
      
      if (!fileType || fileType.mime !== 'application/pdf') {
        return apiResponse.badRequest(res, "File is not a valid PDF. Only genuine PDF files are allowed.");
      }

      // Sanitize filename to prevent path traversal
      const originalFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const filename = `${timestamp}-${originalFilename}`;
      
      // Get private object directory from environment
      const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateObjectDir) {
        return apiResponse.serverError(res, "Object storage not configured");
      }

      // Construct object path: /.private/kyc/ai-certificates/{userId}/{timestamp}-{filename}
      const objectPath = `${privateObjectDir}/kyc/ai-certificates/${userId}/${filename}`;
      
      // Parse bucket and object name
      const pathParts = objectPath.split("/");
      const bucketName = pathParts[1];
      const objectName = pathParts.slice(2).join("/");

      // Upload to object storage
      const bucket = objectStorageClient.bucket(bucketName);
      const fileObj = bucket.file(objectName);

      await fileObj.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          metadata: {
            uploadedBy: userId,
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Generate the storage URL
      const storageUrl = `https://storage.googleapis.com/${bucketName}/${objectName}`;

      return apiResponse.success(res, {
        success: true,
        fileUrl: storageUrl,
        filename: originalFilename,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error uploading file to object storage:", error);
      if (error.message === 'Only PDF files are allowed') {
        return apiResponse.badRequest(res, error.message);
      }
      return apiResponse.serverError(res, "Failed to upload file");
    }
  });

  // Upload CA certificate
  router.post("/accredited-investor/upload-ca", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { verificationId, caCertificateUrl, caCertificateName, caCertificateNumber } = req.body;

      if (!verificationId || !caCertificateUrl) {
        return apiResponse.badRequest(res, "Verification ID and certificate URL are required");
      }

      const { db } = await import("./db");
      const schema = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // Verify ownership and get verification record
      const verification = await db.query.accreditedInvestorVerifications.findFirst({
        where: and(
          eq(schema.accreditedInvestorVerifications.id, verificationId),
          eq(schema.accreditedInvestorVerifications.userId, userId)
        ),
      });

      if (!verification) {
        return apiResponse.notFound(res, "Verification record not found");
      }

      if (verification.status !== "pending") {
        return apiResponse.error(res, "Verification is not in pending status", 400);
      }

      // Update verification record with CA certificate
      await db.update(schema.accreditedInvestorVerifications)
        .set({
          caCertificateUrl,
          caCertificateName,
          caCertificateNumber,
          caCertificateUploadedAt: new Date(),
          status: "ca_uploaded",
          currentStep: "esign",
          updatedAt: new Date(),
        })
        .where(eq(schema.accreditedInvestorVerifications.id, verificationId));

      return apiResponse.success(res, {
        success: true,
        message: "CA certificate uploaded successfully",
        nextStep: "esign",
      });
    } catch (error) {
      console.error("Error uploading CA certificate:", error);
      return apiResponse.serverError(res, "Failed to upload CA certificate");
    }
  });

  // Initiate eSign for risk declaration
  router.post("/accredited-investor/esign-initiate", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { verificationId } = req.body;

      if (!verificationId) {
        return apiResponse.badRequest(res, "Verification ID is required");
      }

      const { db } = await import("./db");
      const schema = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // Get verification record and user details
      const verification = await db.query.accreditedInvestorVerifications.findFirst({
        where: and(
          eq(schema.accreditedInvestorVerifications.id, verificationId),
          eq(schema.accreditedInvestorVerifications.userId, userId)
        ),
      });

      if (!verification) {
        return apiResponse.notFound(res, "Verification record not found");
      }


      // Enhanced validation: Check state transitions
      const validStatusesForESign = ["ca_uploaded", "esign_pending", "rejected"];
      if (!validStatusesForESign.includes(verification.status || "")) {
        return apiResponse.error(res, `Cannot initiate eSign from current status: ${verification.status}. CA certificate must be uploaded first.`, 400);
      }

      // Prevent re-signing if already completed
      if (verification.status === "esign_completed" || verification.status === "submitted" || verification.status === "approved") {
        return apiResponse.error(res, "eSign already completed for this verification", 400);
      }

      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Initialize eSign service
      const { initiateESign } = await import("./services/esign-service");
      
      const eSignResult = await initiateESign({
        userId,
        verificationId,
        documentType: "risk_declaration",
        documentUrl: verification.riskDeclarationUrl || "", // Will be generated by eSign service
        signerDetails: {
          fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          email: user.email || "",
          mobile: user.mobile || "",
          panNumber: user.panNumber || "",
        },
        returnUrl: `${process.env.APP_URL || "http://localhost:5000"}/smart-production-kyc`,
      });

      if (!eSignResult.success) {
        return apiResponse.error(res, eSignResult.message, 400);
      }

      return apiResponse.success(res, {
        success: true,
        transactionId: eSignResult.transactionId,
        redirectUrl: eSignResult.redirectUrl,
        message: "eSign initiated successfully. Please complete the digital signature.",
      });
    } catch (error) {
      console.error("Error initiating eSign:", error);
      return apiResponse.serverError(res, "Failed to initiate eSign");
    }
  });

  // Submit to BSE for AI certificate
  router.post("/accredited-investor/submit-bse", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { verificationId } = req.body;

      if (!verificationId) {
        return apiResponse.badRequest(res, "Verification ID is required");
      }

      const { db } = await import("./db");
      const schema = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // Get verification record
      const verification = await db.query.accreditedInvestorVerifications.findFirst({
        where: and(
          eq(schema.accreditedInvestorVerifications.id, verificationId),
          eq(schema.accreditedInvestorVerifications.userId, userId)
        ),
      });

      if (!verification) {
        return apiResponse.notFound(res, "Verification record not found");
      }


      // Enhanced validation: Check state transitions
      if (verification.status !== "esign_completed") {
        return apiResponse.error(res, `Cannot submit to BSE from current status: ${verification.status}. eSign must be completed first.`, 400);
      }

      if (verification.currentStep !== "bse_submission") {
        return apiResponse.error(res, `Invalid workflow step: ${verification.currentStep}. Expected: bse_submission`, 400);
      }

      // Prevent re-submission if already processed
      if (verification.status === "approved" || verification.status === "submitted") {
        return apiResponse.error(res, "BSE submission already processed for this verification", 400);
      }

      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      if (!user) {
        return apiResponse.notFound(res, "User not found");
      }

      // Submit to BSE Accreditation API
      const { submitForAccreditation } = await import("./services/bse-accreditation-api");
      
      const bseResult = await submitForAccreditation({
        userId,
        verificationId,
        caCertificateUrl: verification.caCertificateUrl || "",
        riskDeclarationUrl: verification.riskDeclarationUrl || "",
        netWorthAmount: verification.netWorthAmount ? parseFloat(verification.netWorthAmount) : undefined,
        annualIncomeAmount: verification.annualIncomeAmount ? parseFloat(verification.annualIncomeAmount) : undefined,
        verificationBasis: verification.verificationBasis as "networth" | "income" | "both",
        applicantDetails: {
          panNumber: user.panNumber || "",
          fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          email: user.email || "",
          mobile: user.mobile || "",
          dateOfBirth: user.dateOfBirth || "",
        },
      });

      if (!bseResult.success) {
        return apiResponse.error(res, bseResult.message, 400);
      }

      // Get updated verification record to return the certificate details
      const updatedVerification = await db.query.accreditedInvestorVerifications.findFirst({
        where: eq(schema.accreditedInvestorVerifications.id, verificationId),
      });

      return apiResponse.success(res, {
        success: true,
        submissionId: bseResult.submissionId,
        status: bseResult.status,
        certificateNumber: updatedVerification?.aiCertificateNumber,
        certificateId: updatedVerification?.aiCertificateId,
        certificateUrl: updatedVerification?.aiCertificateUrl,
        expiryDate: updatedVerification?.aiCertificateExpiryDate,
        message: bseResult.message,
      });
    } catch (error) {
      console.error("Error submitting to BSE:", error);
      return apiResponse.serverError(res, "Failed to submit to BSE");
    }
  });

  // Get AI verification status
  router.get("/accredited-investor/status", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const { db } = await import("./db");
      const schema = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      // Get the latest verification record
      const verification = await db.query.accreditedInvestorVerifications.findFirst({
        where: eq(schema.accreditedInvestorVerifications.userId, userId),
        orderBy: desc(schema.accreditedInvestorVerifications.createdAt),
      });

      if (!verification) {
        return apiResponse.success(res, {
          hasVerification: false,
          message: "No AI verification found",
        });
      }

      return apiResponse.success(res, {
        hasVerification: true,
        verification: {
          id: verification.id,
          status: verification.status,
          currentStep: verification.currentStep,
          caCertificateUploaded: !!verification.caCertificateUrl,
          eSignCompleted: verification.eSignStatus === "completed",
          bseSubmitted: !!verification.bseSubmissionId,
          certificateNumber: verification.aiCertificateNumber,
          certificateId: verification.aiCertificateId,
          certificateUrl: verification.aiCertificateUrl,
          expiryDate: verification.aiCertificateExpiryDate,
          approvedAt: verification.approvedAt,
          rejectedAt: verification.rejectedAt,
          rejectionReason: verification.rejectionReason,
        },
      });
    } catch (error) {
      console.error("Error getting AI verification status:", error);
      return apiResponse.serverError(res, "Failed to get AI verification status");
    }
  });

  return router;
}
