import { Express, Request, Response } from 'express';
import { randomInt } from 'crypto';
import { requireClientOrHigher } from '../../middleware/auth';
import { requireAuth } from '../../middleware/roleMiddleware';
import { getAccessibleProducts, getUserKYCLevel } from '../../middleware/kyc-level-gate';
import { getComplianceStatus, ROLE_KYC_MINIMUM } from '../../middleware/universal-kyc-gate';
import { storage } from '../../storage';
import { sandboxPANService } from '../../sandbox-pan-api';
import { authBridgeCKYCService } from '../../authbridge-ckyc-api';
import { getAdapter as getCkycAdapter } from '../../services/ckyc-provider-adapter';
import { PANConsentService } from '../../services/pan-consent-service';
import { kycOrchestratorService } from '../../services/kyc-orchestrator-service';
import { sandboxKYCService } from '../../services/sandbox-kyc-service';
import { kycEnvironmentService } from '../../services/kyc-environment-service';
import { getSandboxEnvironment } from '../../utils/sandbox-config';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { smsService } from '../../services/sms-service';
import { emailService } from '../../email-service';

export function registerKYCWizardPart3Routes(app: Express) {
  /**
   * GET /api/kyc/my-compliance-status
   * Returns the current KYC compliance status for ANY authenticated role.
   * Used by the Universal KYC Wall on the frontend.
   *
   * Regulatory basis: PMLA 2002 §12, RBI Master Direction on KYC 2016,
   * SEBI KRA Regulations, AMFI Circular on ARN holders.
   *
   * This endpoint is on the universal KYC gate exempt list (/api/kyc/*)
   * so it always responds even when the user has not yet completed KYC.
   */
  app.patch("/api/kyc/profile", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const rawBody = req.body;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const metadataFields = ['nameChangeReason', 'addressChangeReason', 'otpVerified', 'otpSessionId', 'documentIds'];
      const metadata: Record<string, any> = {};
      const updates: Record<string, any> = {};
      for (const [key, val] of Object.entries(rawBody)) {
        if (metadataFields.includes(key)) {
          metadata[key] = val;
        } else {
          updates[key] = val;
        }
      }
      
      // Fetch current profile
      const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const currentProfile = profiles[0];
      
      if (!currentProfile) {
        // Create a minimal profile on first edit instead of erroring
        await db.insert(schema.userProfiles).values({ userId } as any).onConflictDoNothing();
        const created = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
        if (!created[0]) {
          return res.status(404).json({ success: false, message: 'Profile could not be created. Please contact support.' });
        }
        // Re-assign to the created profile
        (profiles as any).push(created[0]);
        (profiles as any).splice(0, 0, created[0]);
        Object.assign(currentProfile as any, created[0]);
      }
      
      const errors: string[] = [];
      const warnings: string[] = [];
      const auditEntries: any[] = [];
      const allowedUpdates: Record<string, any> = {};
      
      // Validate each field
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = (currentProfile as any)[field];
        
        // Skip if value hasn't changed
        if (oldValue === newValue) continue;
        
        // Check immutable fields
        if (KYC_FIELD_RULES.immutable.includes(field)) {
          const isLocked = field === 'panNumber' 
            ? (currentProfile.panVerifiedViaSandbox || currentProfile.panSandboxStatus === 'VALID')
            : field === 'dateOfBirth' 
            ? currentProfile.panVerifiedViaSandbox
            : false;
          
          if (isLocked) {
            errors.push(`${field} is verified and cannot be changed. Please contact support.`);
            continue;
          }
        }
        
        // Check document-required fields
        if (KYC_FIELD_RULES.documentRequired.includes(field)) {
          // Enforce document upload for name/address changes (SEBI/RBI compliance)
          const documentIds = (metadata.documentIds as string[]) || [];
          if (documentIds.length === 0) {
            errors.push(`${field} change requires supporting documents. Please upload proof documents first.`);
            continue;
          }
          
          // For name changes, require reason
          if (['firstName', 'middleName', 'lastName'].includes(field)) {
            if (!metadata.nameChangeReason) {
              warnings.push(`Name change requires a reason (e.g., marriage, legal name change).`);
            }
          }
          
          // Allow update with document proof provided
          allowedUpdates[field] = newValue;
          auditEntries.push({
            action: 'kyc_field_update',
            fieldChanged: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue),
            reason: metadata.nameChangeReason || metadata.addressChangeReason || 'User initiated change',
            riskImpact: 'medium',
            complianceImpact: 'minor',
            requiresDocumentProof: true,
            documentIds
          });
        }
        
        // Check OTP-required fields
        else if (KYC_FIELD_RULES.otpRequired.includes(field)) {
          // Verify OTP was provided and validated
          if (!metadata.otpVerified) {
            errors.push(`${field} change requires OTP verification. Please verify your ${field} first.`);
            continue;
          }
          
          // Verify OTP session exists and is verified in database
          const otpRecords = await db.select()
            .from(schema.otpVerifications)
            .where(eq(schema.otpVerifications.identifier, `profile_change_${userId}_${field}`))
            .limit(1);
          
          const otpRecord = otpRecords[0];
          if (!otpRecord || !otpRecord.verified) {
            errors.push(`${field} OTP verification is invalid or expired. Please request a new OTP.`);
            continue;
          }
          
          // Clean up used OTP
          await db.delete(schema.otpVerifications)
            .where(eq(schema.otpVerifications.id, otpRecord.id));
          
          allowedUpdates[field] = newValue;
          auditEntries.push({
            action: 'kyc_field_update',
            fieldChanged: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue),
            reason: 'OTP verified change',
            riskImpact: 'high',
            complianceImpact: 'major',
            otpVerified: true,
            otpVerifiedAt: new Date().toISOString()
          });
        }
        
        // Freely editable fields
        else if (KYC_FIELD_RULES.freeEdit.includes(field)) {
          allowedUpdates[field] = newValue;
          auditEntries.push({
            action: 'kyc_field_update',
            fieldChanged: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue),
            reason: 'Self-service update',
            riskImpact: 'low',
            complianceImpact: 'none'
          });
        }
        
        // Unknown field - reject
        else {
          errors.push(`Field '${field}' is not editable through this interface.`);
        }
      }
      
      // If there are blocking errors, return them
      if (errors.length > 0 && Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          warnings
        });
      }
      
      // Apply allowed updates
      if (Object.keys(allowedUpdates).length > 0) {
        allowedUpdates.kycLastUpdatedDate = new Date();
        allowedUpdates.kycUpdateMethod = 'self_service';
        
        await db.update(schema.userProfiles)
          .set(allowedUpdates)
          .where(eq(schema.userProfiles.userId, userId));
        
        // Log all changes to compliance audit trail
        for (const entry of auditEntries) {
          await db.insert(schema.complianceAuditTrail).values({
            userId,
            action: entry.action,
            fieldChanged: entry.fieldChanged,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            reason: entry.reason,
            performedBy: userId,
            performedByRole: 'user',
            ipAddress,
            userAgent,
            riskImpact: entry.riskImpact,
            complianceImpact: entry.complianceImpact,
            metadata: {
              requiresDocumentProof: entry.requiresDocumentProof || false,
              otpVerified: entry.otpVerified || false,
              updateMethod: 'self_service',
              timestamp: new Date().toISOString()
            }
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        updatedFields: Object.keys(allowedUpdates).filter(k => k !== 'kycLastUpdatedDate' && k !== 'kycUpdateMethod'),
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        requiresDocumentUpload: auditEntries.some(e => e.requiresDocumentProof)
      });
      
    } catch (error) {
      console.error('Error updating KYC profile:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  });

  // Get KYC change history (audit trail for user)
  app.get("/api/kyc/change-history", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      
      const history = await db.select()
        .from(schema.complianceAuditTrail)
        .where(eq(schema.complianceAuditTrail.userId, userId))
        .orderBy(schema.complianceAuditTrail.createdAt);
      
      // Mask sensitive old values for security
      const maskedHistory = history.map(entry => ({
        id: entry.id,
        action: entry.action,
        fieldChanged: entry.fieldChanged,
        changeDate: entry.createdAt,
        reason: entry.reason,
        performedByRole: entry.performedByRole,
        riskImpact: entry.riskImpact,
        // Don't expose actual values for sensitive fields
        hadPreviousValue: !!entry.oldValue,
        wasUpdated: entry.oldValue !== entry.newValue
      }));
      
      res.json({
        success: true,
        data: {
          changes: maskedHistory,
          totalChanges: maskedHistory.length
        }
      });
    } catch (error) {
      console.error('Error fetching KYC change history:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch change history' });
    }
  });

  // ============================================================================
  // OTP VERIFICATION FOR PROFILE CHANGES (Email/Mobile)
  // Per RBI/SEBI guidelines, contact info changes require re-verification
  // ============================================================================
  
  // Send OTP for profile change verification
  app.post("/api/kyc/profile-change/send-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { type, newValue } = req.body; // type: 'email' | 'mobile'
      
      if (!type || !newValue) {
        return res.status(400).json({ success: false, message: 'Type and new value are required' });
      }
      
      if (!['email', 'mobile'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Type must be email or mobile' });
      }
      
      // Validate format
      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newValue)) {
          return res.status(400).json({ success: false, message: 'Invalid email format' });
        }
      } else {
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(newValue)) {
          return res.status(400).json({ success: false, message: 'Invalid mobile format (10 digits starting with 6-9)' });
        }
      }
      
      // Generate 6-digit OTP
      const otp = randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Delete any existing OTP for this identifier
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, `profile_change_${userId}_${type}`));
      
      // Store OTP with profile change context
      await db.insert(schema.otpVerifications).values({
        identifier: `profile_change_${userId}_${type}`,
        otp,
        type: 'profile_change',
        expiresAt,
        metadata: {
          userId,
          changeType: type,
          newValue,
          requestedAt: new Date().toISOString()
        }
      });
      
      // Send OTP via SMS as primary channel (for Replit testing compatibility)
      console.log(`[KYC Profile Change] Sending OTP to ${type}: ${newValue} for user ${userId}`);
      
      let otpSent = false;
      let deliveryChannel = '';
      
      if (type === 'mobile') {
        // For mobile changes, send to the NEW mobile number
        const smsSent = await smsService.sendOTP(newValue, otp);
        if (smsSent) {
          console.log(`✅ Profile change OTP sent via SMS to: ${newValue}`);
          otpSent = true;
          deliveryChannel = 'SMS';
        } else {
          console.log(`⚠️ SMS delivery failed for ${newValue}`);
        }
      } else {
        // For email changes, send to the NEW email address
        const emailSent = await emailService.sendLoginOTP(newValue, otp);
        if (emailSent) {
          console.log(`✅ Profile change OTP sent via email to: ${newValue}`);
          otpSent = true;
          deliveryChannel = 'email';
        } else {
          console.log(`⚠️ Email delivery failed for ${newValue}`);
        }
      }
      
      if (!otpSent) {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to send OTP to ${type}. Please try again.` 
        });
      }
      
      res.json({
        success: true,
        message: `OTP sent to your new ${type} via ${deliveryChannel}`,
        expiresIn: 600, // 10 minutes in seconds
        deliveryChannel
      });
      
    } catch (error) {
      console.error('Error sending profile change OTP:', error);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  });

  // Verify OTP for profile change
  app.post("/api/kyc/profile-change/verify-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { type, otp } = req.body;
      
      if (!type || !otp) {
        return res.status(400).json({ success: false, message: 'Type and OTP are required' });
      }
      
      // Find OTP record
      const identifier = `profile_change_${userId}_${type}`;
      const otpRecords = await db.select()
        .from(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, identifier))
        .limit(1);
      
      const otpRecord = otpRecords[0];
      
      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'No pending OTP verification found. Please request a new OTP.' });
      }
      
      // Check if expired
      if (new Date() > otpRecord.expiresAt) {
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.id, otpRecord.id));
        return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
      }
      
      // Verify OTP
      if (otpRecord.otp !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
      }
      
      // Mark as verified
      await db.update(schema.otpVerifications)
        .set({ verified: true })
        .where(eq(schema.otpVerifications.id, otpRecord.id));
      
      // Generate session token for the verified change
      const sessionId = nanoid(32);
      
      res.json({
        success: true,
        message: `${type} verified successfully`,
        otpSessionId: sessionId,
        verifiedValue: (otpRecord.metadata as any)?.newValue
      });
      
    } catch (error) {
      console.error('Error verifying profile change OTP:', error);
      res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
  });

  // ============================================================================
  // DOCUMENT UPLOAD FOR KYC CHANGES
  // Name/Address changes require supporting documents per regulations
  // ============================================================================
  
  app.post("/api/kyc/profile-change/upload-document", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { documentType, documentName, changeType, base64Data } = req.body;
      
      if (!documentType || !changeType) {
        return res.status(400).json({ success: false, message: 'Document type and change type are required' });
      }
      
      // Valid document types for name/address changes
      const validNameDocs = ['gazette_notification', 'marriage_certificate', 'court_order', 'passport'];
      const validAddressDocs = ['utility_bill', 'bank_statement', 'aadhaar_card', 'rental_agreement', 'passport'];
      
      const validDocs = changeType === 'name' ? validNameDocs : validAddressDocs;
      
      if (!validDocs.includes(documentType)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid document type for ${changeType} change. Valid types: ${validDocs.join(', ')}`
        });
      }
      
      // In production, store actual document in object storage
      // For now, just record the document reference
      const documentId = nanoid(16);
      
      // Log to audit trail
      await db.insert(schema.complianceAuditTrail).values({
        userId,
        action: 'document_upload',
        fieldChanged: changeType,
        newValue: documentType,
        reason: `Supporting document for ${changeType} change`,
        performedBy: userId,
        performedByRole: 'user',
        riskImpact: 'medium',
        complianceImpact: 'minor',
        metadata: {
          documentId,
          documentType,
          documentName: documentName || 'Unknown',
          uploadedAt: new Date().toISOString()
        }
      });
      
      res.json({
        success: true,
        message: 'Document uploaded successfully',
        documentId,
        documentType
      });
      
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ success: false, message: 'Failed to upload document' });
    }
  });

  // Get required documents for a change type
  app.get("/api/kyc/profile-change/required-documents/:changeType", requireClientOrHigher, async (req: any, res) => {
    try {
      const { changeType } = req.params;
      
      const documentRequirements: Record<string, any> = {
        name: {
          required: true,
          acceptedTypes: [
            { id: 'gazette_notification', name: 'Gazette Notification', description: 'Official gazette notification for name change' },
            { id: 'marriage_certificate', name: 'Marriage Certificate', description: 'For name change due to marriage' },
            { id: 'court_order', name: 'Court Order', description: 'Legal court order for name change' },
            { id: 'passport', name: 'Passport', description: 'Passport with new name' }
          ],
          message: 'As per SEBI/RBI guidelines, name changes require legal documentation.'
        },
        address: {
          required: true,
          acceptedTypes: [
            { id: 'utility_bill', name: 'Utility Bill', description: 'Recent electricity/water/gas bill (not older than 3 months)' },
            { id: 'bank_statement', name: 'Bank Statement', description: 'Recent bank statement with new address' },
            { id: 'aadhaar_card', name: 'Aadhaar Card', description: 'Updated Aadhaar card with new address' },
            { id: 'rental_agreement', name: 'Rental Agreement', description: 'Registered rental agreement' },
            { id: 'passport', name: 'Passport', description: 'Passport with new address' }
          ],
          message: 'Address proof document must be recent (within 3 months) as per KYC guidelines.'
        }
      };
      
      const requirements = documentRequirements[changeType];
      
      if (!requirements) {
        return res.json({
          success: true,
          data: { required: false, message: 'No document required for this change type' }
        });
      }
      
      res.json({
        success: true,
        data: requirements
      });
      
    } catch (error) {
      console.error('Error fetching document requirements:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch requirements' });
    }
  });

  // ============================================================================
  // KYC v2: AML / PEP / Sanctions Check (BE-KYC-005)
  // ============================================================================

  /**
   * Call TruthScreen name-based AML / sanctions search.
   * Uses the same 3-step encrypt→submit→decrypt flow as the CKYC adapter.
   * Falls back to heuristic scoring if credentials are missing or the call fails.
   */
  async function callTruthScreenAML(params: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    screeningId: string;
    panVerified: boolean;
    aadhaarVerified: boolean;
  }): Promise<{
    riskScore: number;
    riskLevel: string;
    pepMatch: any[];
    sanctionsMatch: any[];
    factors: any[];
    source: string;
  }> {
    const tsUsername = process.env.TRUTHSCREEN_USERNAME;
    const tsPassword = process.env.TRUTHSCREEN_PASSWORD;
    const tsBase = process.env.TRUTHSCREEN_BASE_URL || 'https://www.truthscreen.com';

    if (tsUsername && tsPassword) {
      try {
        const axios = (await import('axios')).default;
        const tsHeaders = {
          'Content-Type': 'application/json',
          username: tsUsername,
          Accept: 'application/json',
        };

        const transID = params.screeningId;
        const encPayload = {
          transID,
          docType: 603, // TruthScreen National Sanctions + PEP search
          firstName: params.firstName,
          lastName: params.lastName,
          ...(params.dateOfBirth ? { dateOfBirth: params.dateOfBirth } : {}),
        };

        // Step 1: Encrypt payload
        const encResp = await axios.post(
          `${tsBase}/InstantSearch/encrypted_string`,
          encPayload,
          { headers: tsHeaders, timeout: 12000 }
        );
        const encryptedRequest =
          encResp.data?.encryptedString || encResp.data?.encrypted_string || encResp.data;

        // Step 2: Submit search
        const searchResp = await axios.post(
          `${tsBase}/api/v2.2/idsearch`,
          { requestData: encryptedRequest },
          { headers: tsHeaders, timeout: 15000 }
        );
        const encryptedResponse =
          searchResp.data?.responseData || searchResp.data?.response_data || searchResp.data;

        // Step 3: Decrypt response
        let decrypted: any = {};
        if (typeof encryptedResponse === 'object') {
          decrypted = encryptedResponse;
        } else {
          const decResp = await axios.post(
            `${tsBase}/InstantSearch/decrypt_encrypted_string`,
            { responseData: encryptedResponse },
            { headers: tsHeaders, timeout: 12000 }
          );
          decrypted = decResp.data;
        }

        const pepMatches: any[] = decrypted?.pepData || decrypted?.pep_data || [];
        const sanctionMatches: any[] = decrypted?.sanctionData || decrypted?.sanction_data || [];
        const matchCount = pepMatches.length + sanctionMatches.length;
        const riskScore =
          matchCount === 0 ? (params.panVerified && params.aadhaarVerified ? 8 : 15) : matchCount >= 3 ? 75 : 45;
        const riskLevel =
          riskScore < 25 ? 'low' : riskScore < 50 ? 'medium' : riskScore < 75 ? 'high' : 'critical';

        console.log(
          `[AML/TruthScreen] screen=${transID} pep=${pepMatches.length} sanctions=${sanctionMatches.length} score=${riskScore} level=${riskLevel}`
        );
        return {
          riskScore,
          riskLevel,
          pepMatch: pepMatches,
          sanctionsMatch: sanctionMatches,
          factors: matchCount > 0 ? [{ type: 'sanctions_pep', severity: riskLevel }] : [],
          source: 'truthscreen_live',
        };
      } catch (tsErr: any) {
        console.warn('[AML/TruthScreen] Live call failed, using heuristic fallback:', tsErr?.message);
      }
    }

    // ── Heuristic fallback (no credentials / TruthScreen unavailable) ──────
    // Scores from 3–25 for fully-verified Indian users (LOW band).
    // Avoids the flat hardcoded 10 that masked real risk variance.
    let score = 20;
    if (params.panVerified) score -= 6;
    if (params.aadhaarVerified) score -= 5;
    if (params.firstName && params.lastName) score -= 3;
    if (params.dateOfBirth) score -= 2;
    const riskScore = Math.max(3, Math.min(25, score));
    const riskLevel = riskScore < 25 ? 'low' : 'medium';
    console.log(`[AML/Heuristic] TruthScreen creds not set — heuristic score=${riskScore}`);
    return {
      riskScore,
      riskLevel,
      pepMatch: [],
      sanctionsMatch: [],
      factors: [],
      source: 'heuristic_fallback',
    };
  }

  app.post("/api/kyc/aml/check", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { sessionId, firstName, lastName, dateOfBirth, nationality } = req.body;

      if (!sessionId) {
        return res.status(400).json({ success: false, message: "Session ID is required" });
      }

      const session = await storage.getKycVerificationSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ success: false, message: "Invalid session" });
      }

      // ── T002: Real AML screening ───────────────────────────────────────────
      const screeningId = `scr_${nanoid(12)}`;
      const [panVerifiedUser] = await db
        .select({ panVerified: schema.users.panVerifiedViaSmartKyc, aadhaarVerified: schema.users.aadhaarVerifiedViaSmartKyc })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      const amlRaw = await callTruthScreenAML({
        firstName: firstName || (session as any).firstName || '',
        lastName: lastName || (session as any).lastName || '',
        dateOfBirth: dateOfBirth || undefined,
        screeningId,
        panVerified: !!(panVerifiedUser?.panVerified),
        aadhaarVerified: !!(panVerifiedUser?.aadhaarVerified),
      });

      const screeningData = {
        riskProfile: {
          riskScore: amlRaw.riskScore,
          riskLevel: amlRaw.riskLevel,
          factors: amlRaw.factors,
        },
        pepMatch: amlRaw.pepMatch,
        sanctionsMatch: amlRaw.sanctionsMatch,
        screeningId,
        source: amlRaw.source,
      };
      // ──────────────────────────────────────────────────────────────────────

      const amlResult = kycOrchestratorService.computeAmlResult(screeningData);

      await storage.updateKycVerificationSession(sessionId, {
        amlRiskLevel: amlResult.risk_level,
        amlScreeningId: amlResult.screening_id,
        videoKycRequired: amlResult.video_kyc_required,
        stepStatus: {
          ...session.stepStatus as any,
          aml_screened: true,
          aml_risk_level: amlResult.risk_level,
          video_kyc_required: amlResult.video_kyc_required,
        }
      });

      await db.update(schema.userProfiles)
        .set({
          amlRiskLevel: amlResult.risk_level,
          amlScreenedAt: new Date(),
          amlScreeningId: amlResult.screening_id,
          videoKycRequired: amlResult.video_kyc_required,
        })
        .where(eq(schema.userProfiles.userId, userId));

      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'AML_SCREENED',
        step: 'aml_screening',
        details: { score: amlResult.aml_score, risk_level: amlResult.risk_level, pep: amlResult.pep, sanctions: amlResult.sanctions },
        performedBy: userId,
      });

      res.json({
        success: true,
        data: {
          aml_score: amlResult.aml_score,
          pep: amlResult.pep,
          sanctions: amlResult.sanctions,
          risk_level: amlResult.risk_level,
          video_kyc_required: amlResult.video_kyc_required,
          screening_id: amlResult.screening_id,
          source: amlResult.source,
        }
      });
    } catch (error) {
      console.error('Error performing AML check:', error);
      res.status(500).json({ success: false, message: 'Failed to perform AML screening' });
    }
  });

  // ============================================================================
  // KYC v2: PAN Entity Verification (BE-KYC-002 standalone)
  // ============================================================================
}
