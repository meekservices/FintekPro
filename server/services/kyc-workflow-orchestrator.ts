import { storage } from '../storage';
import { proteanKRAService } from './protean-kra-service';
import { cashfreeEkycService } from './cashfree-ekyc-service';
import { cersaiCkycService } from './cersai-ckyc-service';
import { bseUccService } from './bse-ucc-service';
import { createInsertSchema } from 'drizzle-zod';
import { kycStateTransitions } from '@shared/schema';

/**
 * Production KYC Workflow Orchestrator
 * 
 * Smart 4-tier workflow with early exit optimization:
 * 1. KRA Status Check (Protean) → Early exit if verified, direct to BSE UCC
 * 2. Cashfree Aadhaar eKYC → OTP verification + XML parsing
 * 3. CERSAI CKYC Upload → Submit XML, get CKYC number
 * 4. BSE UCC Creation → Mutual fund account creation
 * 
 * State machine handles:
 * - Synchronous flow for immediate responses
 * - Asynchronous polling for 1-48 hour KRA verification
 * - Audit trail via state transitions table
 */

const insertKycStateTransitionSchema = createInsertSchema(kycStateTransitions).omit({
  id: true,
  occurredAt: true,
});
type InsertKycStateTransition = typeof insertKycStateTransitionSchema._type;

interface StartWorkflowRequest {
  userId: string;
  panNumber: string;
  dob: string;
  ipAddress: string;
  userAgent: string;
}

interface WorkflowState {
  sessionId: string;
  currentStep: string;
  kraStatus?: string;
  kraNumber?: string;
  ckycNumber?: string;
  uccNumber?: string;
  nextAction?: string;
  canProceed: boolean;
  errorMessage?: string;
}

/**
 * WorkflowStateAssembler: Joins hub (kycVerificationSessions) with spoke tables
 * to create a comprehensive WorkflowState object
 */
class WorkflowStateAssembler {
  async assembleWorkflowState(sessionId: string): Promise<WorkflowState | null> {
    try {
      // Fetch hub session
      const session = await storage.getKycVerificationSession(sessionId);
      if (!session) {
        return null;
      }

      // Fetch spoke data
      const kraCheck = await storage.getKraStatusCheckBySession(sessionId);
      const cashfreeSession = await storage.getCashfreeEkycSessionByKycSession(sessionId);
      const cersaiSubmission = await storage.getCersaiSubmissionBySession(sessionId);
      const bseRequest = await storage.getBseUccRequestBySession(sessionId);

      // Assemble composite state
      return {
        sessionId: session.id,
        currentStep: session.currentStep,
        kraStatus: kraCheck?.status,
        kraNumber: kraCheck?.kraNumber || undefined,
        ckycNumber: cersaiSubmission?.ckycNumber || undefined,
        uccNumber: bseRequest?.uccNumber || undefined,
        canProceed: this.determineCanProceed(session.currentStep),
        nextAction: this.determineNextAction(session.currentStep)
      };
    } catch (error: any) {
      console.error('[WorkflowStateAssembler] Assembly failed:', error.message);
      return null;
    }
  }

  private determineCanProceed(currentStep: string): boolean {
    const proceedableSteps = [
      'kra_verified',
      'kra_not_found',
      'cashfree_verified',
      'cersai_submitted'
    ];
    return proceedableSteps.includes(currentStep);
  }

  private determineNextAction(currentStep: string): string {
    const actionMap: Record<string, string> = {
      'kra_verified': 'create_bse_ucc',
      'kra_not_found': 'initiate_cashfree_ekyc',
      'kra_check_pending': 'wait_for_kra_verification',
      'cashfree_otp_sent': 'verify_otp',
      'cashfree_verified': 'submit_cersai_ckyc',
      'cersai_submitted': 'create_bse_ucc',
      'ucc_created': 'completed'
    };
    return actionMap[currentStep] || 'unknown';
  }
}

export class KycWorkflowOrchestrator {
  private stateAssembler = new WorkflowStateAssembler();

  /**
   * Start KYC workflow with KRA status check (Tier 1)
   */
  async startKycWorkflow(request: StartWorkflowRequest): Promise<WorkflowState> {
    const { userId, panNumber, dob, ipAddress, userAgent } = request;

    // Create KYC verification session
    const session = await storage.createKycVerificationSession({
      userId,
      panNumber,
      currentStep: 'kra_check_initiated',
      ipAddress,
      userAgent
    });

    await this.logStateTransition({
      sessionId: session.id,
      userId,
      fromState: 'not_started',
      toState: 'kra_check_initiated',
      trigger: 'user_action',
      performedBy: userId,
      performedByRole: 'user',
      metadata: { panNumber: panNumber.substring(0, 5) + '****', dob },
      ipAddress,
      userAgent
    });

    // Initiate KRA status check
    const kraResult = await this.processKraCheck(session.id, userId, panNumber, dob);

    if (kraResult.status === 'verified') {
      // Early exit: KRA verified, skip to UCC creation
      await storage.updateKycVerificationSession(session.id, {
        currentStep: 'kra_verified'
      });

      await this.logStateTransition({
        sessionId: session.id,
        userId,
        fromState: 'kra_check_initiated',
        toState: 'kra_verified',
        trigger: 'api_call',
        performedBy: 'system',
        performedByRole: 'system',
        metadata: { kraNumber: kraResult.kraNumber, earlyExit: true },
        ipAddress,
        userAgent
      });

      return {
        sessionId: session.id,
        currentStep: 'kra_verified',
        kraStatus: 'verified',
        kraNumber: kraResult.kraNumber,
        nextAction: 'create_bse_ucc',
        canProceed: true
      };
    }

    if (kraResult.status === 'pending') {
      // Async verification: will be polled by background job
      await storage.updateKycVerificationSession(session.id, {
        currentStep: 'kra_check_pending'
      });

      await this.logStateTransition({
        sessionId: session.id,
        userId,
        fromState: 'kra_check_initiated',
        toState: 'kra_check_pending',
        trigger: 'api_call',
        performedBy: 'system',
        performedByRole: 'system',
        metadata: { asyncVerification: true, nextPollAt: kraResult.nextPollAt },
        ipAddress,
        userAgent
      });

      return {
        sessionId: session.id,
        currentStep: 'kra_check_pending',
        kraStatus: 'pending',
        nextAction: 'wait_for_kra_verification',
        canProceed: false
      };
    }

    // KRA not found/rejected → Fall back to Cashfree eKYC
    await storage.updateKycVerificationSession(session.id, {
      currentStep: 'kra_not_found'
    });

    await this.logStateTransition({
      sessionId: session.id,
      userId,
      fromState: 'kra_check_initiated',
      toState: 'kra_not_found',
      trigger: 'api_call',
      performedBy: 'system',
      performedByRole: 'system',
      metadata: { fallbackToCashfree: true, kraStatus: kraResult.status },
      ipAddress,
      userAgent
    });

    return {
      sessionId: session.id,
      currentStep: 'kra_not_found',
      kraStatus: kraResult.status,
      nextAction: 'initiate_cashfree_ekyc',
      canProceed: true
    };
  }

  /**
   * Process KRA status check via Protean API
   */
  async processKraCheck(sessionId: string, userId: string, panNumber: string, dob: string): Promise<{
    status: string;
    kraNumber?: string;
    nextPollAt?: Date;
  }> {
    try {
      const result = await proteanKRAService.checkKRAStatus({ panNumber, dateOfBirth: dob });

      // Create KRA status check record
      const kraCheck = await storage.createKraStatusCheck({
        sessionId,
        userId,
        status: result.status,
        kraNumber: result.kraNumber,
        proteanReferenceId: result.proteanReferenceId,
        verificationDate: result.verificationDate,
        kraAgency: result.kraAgency,
        nextPollAt: result.status === 'pending' ? new Date(Date.now() + 5 * 60 * 1000) : undefined, // Poll in 5 min
        pollAttempt: 0,
        maxPollAttempts: 48, // 48 hours max
        responsePayload: result.responsePayload,
        reasonCode: result.reasonCode,
        reasonMessage: result.reasonMessage
      });

      return {
        status: result.status,
        kraNumber: result.kraNumber,
        nextPollAt: kraCheck.nextPollAt || undefined
      };
    } catch (error: any) {
      console.error('[KycOrchestrator] KRA check failed:', error.message);
      
      await storage.createKraStatusCheck({
        sessionId,
        userId,
        status: 'not_found',
        reasonCode: 'API_ERROR',
        reasonMessage: error.message
      });

      return { status: 'not_found' };
    }
  }

  /**
   * Initiate Cashfree Aadhaar eKYC (Tier 2)
   */
  async initiateCashfreeEkyc(
    sessionId: string,
    userId: string,
    aadhaarNumber: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    success: boolean;
    cashfreeSessionId?: string;
    otpSent?: boolean;
    errorMessage?: string;
  }> {
    try {
      const result = await cashfreeEkycService.initSession({
        aadhaarNumber,
        consent: true,
        consentIpAddress: ipAddress,
        consentUserAgent: userAgent
      });

      // Create Cashfree eKYC session record
      await storage.createCashfreeEkycSession({
        sessionId,
        userId,
        cashfreeSessionId: result.sessionId,
        aadhaarNumber, // Should be encrypted before storage
        otpSentAt: result.status === 'otp_sent' ? new Date() : undefined,
        consentGiven: true,
        consentIpAddress: ipAddress,
        consentUserAgent: userAgent,
        consentTimestamp: new Date(),
        status: result.status === 'otp_sent' ? 'otp_sent' : 'failed',
        errorCode: result.errorCode,
        errorMessage: result.message
      });

      await this.logStateTransition({
        sessionId,
        userId,
        fromState: 'kra_not_found',
        toState: result.status === 'otp_sent' ? 'cashfree_otp_sent' : 'cashfree_failed',
        trigger: 'api_call',
        performedBy: userId,
        performedByRole: 'user',
        metadata: { aadhaarMasked: `XXXX-XXXX-${aadhaarNumber.slice(-4)}` },
        ipAddress,
        userAgent
      });

      if (result.status === 'failed') {
        return {
          success: false,
          errorMessage: result.message || 'OTP sending failed'
        };
      }

      await storage.updateKycVerificationSession(sessionId, {
        currentStep: 'cashfree_otp_sent'
      });

      return {
        success: true,
        cashfreeSessionId: result.sessionId,
        otpSent: true
      };
    } catch (error: any) {
      console.error('[KycOrchestrator] Cashfree init failed:', error.message);
      
      return {
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Verify Cashfree OTP and parse XML
   */
  async verifyCashfreeOtp(
    sessionId: string,
    userId: string,
    cashfreeSessionId: string,
    otp: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    success: boolean;
    parsedData?: any;
    xmlUrl?: string;
    errorMessage?: string;
  }> {
    try {
      const verifyResult = await cashfreeEkycService.verifyOtp({
        sessionId: cashfreeSessionId,
        otp
      });

      if (verifyResult.status === 'failed') {
        const cashfreeSession = await storage.getCashfreeEkycSessionByKycSession(sessionId);
        if (cashfreeSession) {
          await storage.updateCashfreeEkycSession(cashfreeSession.id, {
            status: 'failed',
            errorCode: verifyResult.errorCode,
            errorMessage: verifyResult.errorMessage
          });
        }

        return {
          success: false,
          errorMessage: verifyResult.errorMessage || 'OTP verification failed'
        };
      }

      // Download and parse XML
      const xmlContent = await cashfreeEkycService.getXmlDocument(verifyResult.xmlUrl!);
      const parsedData = xmlContent ? await cashfreeEkycService.parseXmlData(xmlContent) : null;

      if (!parsedData) {
        return {
          success: false,
          errorMessage: 'Failed to parse Aadhaar XML'
        };
      }

      // Update Cashfree session with parsed data
      const cashfreeSession = await storage.getCashfreeEkycSessionByKycSession(sessionId);
      if (cashfreeSession) {
        await storage.updateCashfreeEkycSession(cashfreeSession.id, {
          otpVerifiedAt: new Date(),
          xmlUrl: verifyResult.xmlUrl,
          xmlHash: verifyResult.xmlHash,
          xmlParsed: true,
          xmlParsedAt: new Date(),
          parsedData,
          status: 'verified'
        });
      }

      await storage.updateKycVerificationSession(sessionId, {
        currentStep: 'cashfree_verified'
      });

      await this.logStateTransition({
        sessionId,
        userId,
        fromState: 'cashfree_otp_sent',
        toState: 'cashfree_verified',
        trigger: 'user_action',
        performedBy: userId,
        performedByRole: 'user',
        metadata: { ekycCompleted: true },
        ipAddress,
        userAgent
      });

      return {
        success: true,
        parsedData,
        xmlUrl: verifyResult.xmlUrl
      };
    } catch (error: any) {
      console.error('[KycOrchestrator] Cashfree OTP verification failed:', error.message);
      
      return {
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Submit CKYC to CERSAI (Tier 3)
   */
  async submitCersaiCkyc(
    sessionId: string,
    userId: string,
    personalData: any,
    addresses: any[],
    identityProofs: any[],
    images: any[],
    ekycSessionId?: string
  ): Promise<{
    success: boolean;
    submissionId?: string;
    ckycNumber?: string;
    xmlContent?: string;
    errorMessage?: string;
  }> {
    try {
      const result = await cersaiCkycService.completeCkycSubmission({
        personalData,
        addresses,
        identityProofs,
        images,
        applicationReferenceNumber: `APP_${sessionId}_${Date.now()}`
      });

      // Create CERSAI submission record
      await storage.createCersaiSubmission({
        sessionId,
        userId,
        ekycSessionId,
        submissionId: result.submissionId,
        ckycNumber: result.ckycNumber,
        status: result.success ? 'submitted' : 'failed',
        submittedAt: result.success ? new Date() : undefined,
        acknowledgmentData: result.acknowledgmentData,
        rejectionCode: result.errorCode,
        rejectionMessage: result.errorMessage,
        xmlStorageUrl: undefined // TODO: Upload to object storage
      });

      if (!result.success) {
        return {
          success: false,
          errorMessage: result.errorMessage || 'CKYC submission failed'
        };
      }

      await storage.updateKycVerificationSession(sessionId, {
        currentStep: 'cersai_submitted'
      });

      await this.logStateTransition({
        sessionId,
        userId,
        fromState: 'cashfree_verified',
        toState: 'cersai_submitted',
        trigger: 'api_call',
        performedBy: userId,
        performedByRole: 'user',
        metadata: { ckycNumber: result.ckycNumber },
        ipAddress: '',
        userAgent: ''
      });

      return {
        success: true,
        submissionId: result.submissionId,
        ckycNumber: result.ckycNumber,
        xmlContent: result.xmlContent
      };
    } catch (error: any) {
      console.error('[KycOrchestrator] CERSAI submission failed:', error.message);
      
      return {
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Create BSE UCC (Tier 4 - Final step)
   */
  async createBseUcc(
    sessionId: string,
    userId: string,
    personalDetails: any,
    addressDetails: any,
    bankDetails: any,
    kraNumber: string,
    ckycNumber?: string
  ): Promise<{
    success: boolean;
    uccNumber?: string;
    clientCode?: string;
    errorMessage?: string;
  }> {
    try {
      // Validate KRA status
      const kraCheck = await storage.getKraStatusCheckBySession(sessionId);
      
      if (kraCheck) {
        const validation = bseUccService.validateKraStatus(kraCheck.status, kraCheck.kraNumber || undefined);
        
        if (!validation.valid) {
          return {
            success: false,
            errorMessage: validation.reason || 'KRA validation failed'
          };
        }
      }

      const result = await bseUccService.createUcc({
        personalDetails,
        addressDetails,
        bankDetails,
        kycDetails: {
          kraNumber,
          ckycNumber,
          pepFlag: 'N'
        }
      });

      // Create BSE UCC request record
      await storage.createBseUccRequest({
        sessionId,
        userId,
        kraCheckId: kraCheck?.id,
        uccNumber: result.uccNumber,
        requestId: result.requestId,
        status: result.success ? 'created' : 'failed',
        attemptCount: 1,
        lastTriedAt: new Date(),
        requestPayload: { personalDetails, addressDetails, bankDetails },
        responseData: result.responseData,
        rejectionReason: result.errorMessage
      });

      if (!result.success) {
        return {
          success: false,
          errorMessage: result.errorMessage || 'UCC creation failed'
        };
      }

      await storage.updateKycVerificationSession(sessionId, {
        currentStep: 'ucc_created',
        completedAt: new Date()
      });

      await this.logStateTransition({
        sessionId,
        userId,
        fromState: kraCheck ? 'kra_verified' : 'cersai_submitted',
        toState: 'ucc_created',
        trigger: 'api_call',
        performedBy: userId,
        performedByRole: 'user',
        metadata: { uccNumber: result.uccNumber, workflowCompleted: true },
        ipAddress: '',
        userAgent: ''
      });

      return {
        success: true,
        uccNumber: result.uccNumber,
        clientCode: result.clientCode
      };
    } catch (error: any) {
      console.error('[KycOrchestrator] BSE UCC creation failed:', error.message);
      
      return {
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Get workflow status using WorkflowStateAssembler
   */
  async getWorkflowStatus(sessionId: string): Promise<WorkflowState | null> {
    return this.stateAssembler.assembleWorkflowState(sessionId);
  }

  /**
   * Log state transition for audit compliance
   */
  private async logStateTransition(transition: InsertKycStateTransition): Promise<void> {
    try {
      await storage.createKycStateTransition(transition);
    } catch (error: any) {
      console.error('[KycOrchestrator] State transition logging failed:', error.message);
    }
  }
}

export const kycWorkflowOrchestrator = new KycWorkflowOrchestrator();
