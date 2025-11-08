/**
 * KYC Priority Orchestrator
 * 
 * State-machine-driven orchestrator that executes the hybrid KYC priority workflow:
 * 1. CKYC Lookup (Central Registry) - Instant if record exists
 * 2. KRA eKYC (Multi-agency) - Query 5 KRA agencies in parallel
 * 3. Video KYC (Live verification) - Video session with AI checks
 * 4. Manual KYC (Final fallback) - Document upload + human review
 * 
 * Features:
 * - Early exit on first successful verification
 * - Persistent state tracking in kyc_workflows table
 * - Detailed attempt logging in kyc_verification_attempts table
 * - Distributed locking to prevent concurrent workflows
 * - Automatic vault storage after successful verification
 */

import crypto from 'crypto';
import { db } from '../db';
import { kycWorkflows, kycVerificationAttempts, kycVault, type InsertKycWorkflow, type InsertKycVerificationAttempt } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from './logger';
import { CKYCService } from '../ckyc-service';
import { kraEKYCService, type NormalizedKYCData } from './kra-ekyc-service';
import { videoKYCService } from './video-kyc-service';
import { encryptionService } from '../encryption-service';
import { tokenizationService } from './tokenization-service';
import { faceHashingService } from './face-hashing-service';

export interface KYCOrchestrationRequest {
  userId: string;
  panNumber: string;
  aadhaarNumber?: string;
  name?: string;
  dateOfBirth?: string;
  mobile?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface KYCOrchestrationResult {
  success: boolean;
  workflowId: string;
  status: string; // verified/failed/pending
  method?: string; // ckyc/kra_ekyc/video_kyc/manual_kyc
  ckycKinNumber?: string;
  message: string;
  error?: string;
  attemptsSummary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class KYCPriorityOrchestrator {
  private ckycService: CKYCService;

  constructor() {
    this.ckycService = new CKYCService();
  }

  /**
   * Execute complete KYC priority workflow with state machine
   */
  async executeWorkflow(request: KYCOrchestrationRequest): Promise<KYCOrchestrationResult> {
    const correlationId = crypto.randomUUID();

    logger.info('Starting KYC priority workflow', {
      correlationId,
      userId: request.userId,
      pan: request.panNumber.slice(0, 3) + '***' + request.panNumber.slice(-2),
    });

    // Step 1: Acquire distributed lock
    const lockToken = await this.acquireLock(request.userId);
    if (!lockToken) {
      return {
        success: false,
        workflowId: '',
        status: 'failed',
        message: 'Another KYC workflow is already in progress for this user',
        error: 'Workflow locked',
        attemptsSummary: { total: 0, successful: 0, failed: 0 },
      };
    }

    try {
      // Step 2: Create workflow record
      const workflowId = crypto.randomUUID();
      await db.insert(kycWorkflows).values({
        id: workflowId,
        userId: request.userId,
        status: 'initiated',
        currentMethod: 'ckyc',
        panNumber: request.panNumber,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        lockToken,
        lockedAt: new Date(),
        lockExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        attemptedMethods: [],
        stepTimestamps: {},
      });

      logger.info('KYC workflow created', { correlationId, workflowId });

      // Step 3: Try CKYC Lookup (Method 1)
      const ckycResult = await this.tryCKYCLookup(workflowId, request, correlationId);
      if (ckycResult.success) {
        await this.releaseLock(request.userId);
        return ckycResult;
      }

      // Step 4: Try KRA eKYC (Method 2)
      const kraResult = await this.tryKRAeKYC(workflowId, request, correlationId);
      if (kraResult.success) {
        await this.releaseLock(request.userId);
        return kraResult;
      }

      // Step 5: Try Video KYC (Method 3)
      const videoResult = await this.tryVideoKYC(workflowId, request, correlationId);
      if (videoResult.success) {
        await this.releaseLock(request.userId);
        return videoResult;
      }

      // Step 6: Fallback to Manual KYC (Method 4)
      const manualResult = await this.initiateManualKYC(workflowId, request, correlationId);
      await this.releaseLock(request.userId);
      return manualResult;

    } catch (error: any) {
      logger.error('KYC workflow failed with exception', {
        correlationId,
        userId: request.userId,
        error: error.message,
      });

      await this.releaseLock(request.userId);

      return {
        success: false,
        workflowId: '',
        status: 'failed',
        message: 'KYC workflow encountered an error',
        error: error.message,
        attemptsSummary: { total: 0, successful: 0, failed: 0 },
      };
    }
  }

  /**
   * Method 1: CKYC Lookup
   */
  private async tryCKYCLookup(
    workflowId: string,
    request: KYCOrchestrationRequest,
    correlationId: string
  ): Promise<KYCOrchestrationResult> {
    const startTime = Date.now();
    const attemptId = crypto.randomUUID();

    logger.info('Attempting CKYC lookup', { correlationId, workflowId });

    // Update workflow status
    await db.update(kycWorkflows)
      .set({
        status: 'ckyc_lookup',
        currentMethod: 'ckyc',
        attemptedMethods: sql`array_append(attempted_methods, 'ckyc')`,
        stepTimestamps: sql`jsonb_set(step_timestamps, '{ckyc_started}', to_jsonb(now()))`,
      })
      .where(eq(kycWorkflows.id, workflowId));

    try {
      // Query CKYC registry
      const ckycSearchResult = await this.ckycService.searchCKYC({
        panNumber: request.panNumber,
        aadharNumber: request.aadhaarNumber,
      });

      const latencyMs = Date.now() - startTime;

      // Log attempt
      await this.logAttempt({
        workflowId,
        userId: request.userId,
        verificationMethod: 'ckyc_lookup',
        provider: 'CERSAI_CKYC',
        correlationId: attemptId,
        outcome: ckycSearchResult.found ? 'success' : 'failure',
        responseCode: ckycSearchResult.success ? '200' : '404',
        latencyMs,
        dataCompleteness: ckycSearchResult.found && ckycSearchResult.data ? 100 : 0,
        dataFreshness: ckycSearchResult.lastVerifiedAt ? new Date(ckycSearchResult.lastVerifiedAt) : undefined,
      });

      if (ckycSearchResult.found && ckycSearchResult.ckycNumber && ckycSearchResult.data) {
        // CKYC found - store in vault and complete workflow
        await this.storeInVault(request.userId, {
          firstName: ckycSearchResult.data.firstName,
          middleName: ckycSearchResult.data.middleName,
          lastName: ckycSearchResult.data.lastName,
          fullName: `${ckycSearchResult.data.firstName} ${ckycSearchResult.data.lastName}`,
          dateOfBirth: ckycSearchResult.data.dateOfBirth,
          gender: 'M',
          panNumber: request.panNumber,
          mobile: ckycSearchResult.data.mobileNumber,
          email: ckycSearchResult.data.emailAddress,
          addressLine1: ckycSearchResult.data.address,
          city: ckycSearchResult.data.city,
          state: ckycSearchResult.data.state,
          pincode: ckycSearchResult.data.pincode,
          country: ckycSearchResult.data.country,
          kycType: 'CKYC',
          kycNumber: ckycSearchResult.ckycNumber,
          kycStatus: 'verified',
          verificationLevel: ckycSearchResult.verificationLevel || 'basic',
          dataSource: 'CKYC_Registry',
          dataFreshness: ckycSearchResult.lastVerifiedAt ? new Date(ckycSearchResult.lastVerifiedAt) : new Date(),
          completeness: 100,
        });

        // Update workflow as verified
        await db.update(kycWorkflows)
          .set({
            status: 'verified',
            successfulMethod: 'ckyc',
            ckycKinNumber: ckycSearchResult.ckycNumber,
            verifiedAt: new Date(),
            completedAt: new Date(),
            stepTimestamps: sql`jsonb_set(step_timestamps, '{ckyc_completed}', to_jsonb(now()))`,
          })
          .where(eq(kycWorkflows.id, workflowId));

        logger.info('CKYC lookup successful', { correlationId, workflowId, ckycNumber: ckycSearchResult.ckycNumber });

        return {
          success: true,
          workflowId,
          status: 'verified',
          method: 'ckyc',
          ckycKinNumber: ckycSearchResult.ckycNumber,
          message: 'KYC verified successfully via CKYC Registry',
          attemptsSummary: { total: 1, successful: 1, failed: 0 },
        };
      }

      // CKYC not found - continue to next method
      logger.info('CKYC not found, proceeding to KRA eKYC', { correlationId, workflowId });
      return {
        success: false,
        workflowId,
        status: 'kra_ekyc',
        message: 'CKYC not found',
        attemptsSummary: { total: 1, successful: 0, failed: 1 },
      };

    } catch (error: any) {
      logger.warn('CKYC lookup failed', { correlationId, workflowId, error: error.message });

      await this.logAttempt({
        workflowId,
        userId: request.userId,
        verificationMethod: 'ckyc_lookup',
        provider: 'CERSAI_CKYC',
        correlationId: attemptId,
        outcome: 'failure',
        responseCode: 'ERROR',
        latencyMs: Date.now() - startTime,
        errorDetails: { message: error.message },
      });

      return {
        success: false,
        workflowId,
        status: 'kra_ekyc',
        message: 'CKYC lookup failed',
        error: error.message,
        attemptsSummary: { total: 1, successful: 0, failed: 1 },
      };
    }
  }

  /**
   * Method 2: KRA eKYC
   */
  private async tryKRAeKYC(
    workflowId: string,
    request: KYCOrchestrationRequest,
    correlationId: string
  ): Promise<KYCOrchestrationResult> {
    const startTime = Date.now();
    const attemptId = crypto.randomUUID();

    logger.info('Attempting KRA eKYC', { correlationId, workflowId });

    // Update workflow status
    await db.update(kycWorkflows)
      .set({
        status: 'kra_ekyc',
        currentMethod: 'kra_ekyc',
        attemptedMethods: sql`array_append(attempted_methods, 'kra_ekyc')`,
        stepTimestamps: sql`jsonb_set(step_timestamps, '{kra_started}', to_jsonb(now()))`,
      })
      .where(eq(kycWorkflows.id, workflowId));

    try {
      // Query all KRA agencies
      const kraResult = await kraEKYCService.queryAllAgencies(request.panNumber, request.aadhaarNumber);

      const latencyMs = Date.now() - startTime;

      // Determine outcome and response code
      let outcome: string;
      let responseCode: string;

      if (!kraResult.success) {
        // All agencies failed with errors (network/API issues)
        outcome = 'failure';
        responseCode = 'TRANSPORT_ERROR';
      } else if (kraResult.found) {
        // Found KYC data
        outcome = 'success';
        responseCode = '200';
      } else {
        // No data found but at least some agencies responded successfully
        outcome = 'failure';
        responseCode = '404';
      }

      // Log main attempt
      await this.logAttempt({
        workflowId,
        userId: request.userId,
        verificationMethod: 'kra_ekyc',
        provider: 'Multi-Agency',
        correlationId: attemptId,
        outcome,
        responseCode,
        latencyMs,
        dataCompleteness: kraResult.verifiedData?.completeness || 0,
        dataFreshness: kraResult.verifiedData?.dataFreshness,
        errorDetails: !kraResult.success ? { message: kraResult.message, agencies: kraResult.agencies } : undefined,
        metadata: {
          agencies: kraResult.agencies,
          details: kraResult.details,
        },
      });

      if (kraResult.found && kraResult.verifiedData) {
        // KRA data found - store in vault
        await this.storeInVault(request.userId, kraResult.verifiedData);

        // Update workflow as verified
        await db.update(kycWorkflows)
          .set({
            status: 'verified',
            successfulMethod: 'kra_ekyc',
            kraVerificationNumber: kraResult.verifiedData.kycNumber,
            verifiedAt: new Date(),
            completedAt: new Date(),
            stepTimestamps: sql`jsonb_set(step_timestamps, '{kra_completed}', to_jsonb(now()))`,
          })
          .where(eq(kycWorkflows.id, workflowId));

        logger.info('KRA eKYC successful', { correlationId, workflowId, agencies: kraResult.agencies.successful });

        return {
          success: true,
          workflowId,
          status: 'verified',
          method: 'kra_ekyc',
          message: `KYC verified via KRA (${kraResult.agencies.successful.join(', ')})`,
          attemptsSummary: { total: 2, successful: 1, failed: 1 },
        };
      }

      // KRA not found - continue to Video KYC
      logger.info('KRA eKYC not found, proceeding to Video KYC', { correlationId, workflowId });
      return {
        success: false,
        workflowId,
        status: 'video_kyc',
        message: 'KRA record not found',
        attemptsSummary: { total: 2, successful: 0, failed: 2 },
      };

    } catch (error: any) {
      logger.warn('KRA eKYC failed', { correlationId, workflowId, error: error.message });

      await this.logAttempt({
        workflowId,
        userId: request.userId,
        verificationMethod: 'kra_ekyc',
        provider: 'Multi-Agency',
        correlationId: attemptId,
        outcome: 'failure',
        responseCode: 'ERROR',
        latencyMs: Date.now() - startTime,
        errorDetails: { message: error.message },
      });

      return {
        success: false,
        workflowId,
        status: 'video_kyc',
        message: 'KRA eKYC failed',
        error: error.message,
        attemptsSummary: { total: 2, successful: 0, failed: 2 },
      };
    }
  }

  /**
   * Method 3: Video KYC
   */
  private async tryVideoKYC(
    workflowId: string,
    request: KYCOrchestrationRequest,
    correlationId: string
  ): Promise<KYCOrchestrationResult> {
    const attemptId = crypto.randomUUID();

    logger.info('Attempting Video KYC', { correlationId, workflowId });

    // Update workflow status
    await db.update(kycWorkflows)
      .set({
        status: 'video_kyc',
        currentMethod: 'video_kyc',
        attemptedMethods: sql`array_append(attempted_methods, 'video_kyc')`,
        stepTimestamps: sql`jsonb_set(step_timestamps, '{video_started}', to_jsonb(now()))`,
      })
      .where(eq(kycWorkflows.id, workflowId));

    // Video KYC requires additional user information
    if (!request.name || !request.dateOfBirth || !request.mobile || !request.email) {
      logger.warn('Video KYC requires name, DOB, mobile, email', { correlationId, workflowId });

      await this.logAttempt({
        workflowId,
        userId: request.userId,
        verificationMethod: 'video_kyc',
        provider: 'Not_Started',
        correlationId: attemptId,
        outcome: 'failure',
        responseCode: 'MISSING_DATA',
        latencyMs: 0,
        errorDetails: { message: 'Missing required fields for Video KYC' },
      });

      return {
        success: false,
        workflowId,
        status: 'manual_kyc',
        message: 'Video KYC requires additional information',
        error: 'Missing name, DOB, mobile, or email',
        attemptsSummary: { total: 3, successful: 0, failed: 3 },
      };
    }

    // Create Video KYC session (async - user completes later)
    const sessionResult = await videoKYCService.createSession({
      userId: request.userId,
      panNumber: request.panNumber,
      aadhaarNumber: request.aadhaarNumber,
      name: request.name,
      dateOfBirth: request.dateOfBirth,
      mobile: request.mobile,
      email: request.email,
    });

    if (!sessionResult.success || !sessionResult.session) {
      logger.warn('Video KYC session creation failed', { correlationId, workflowId });

      await this.logAttempt({
        workflowId,
        userId: request.userId,
        verificationMethod: 'video_kyc',
        provider: 'Session_Failed',
        correlationId: attemptId,
        outcome: 'failure',
        responseCode: 'SESSION_ERROR',
        latencyMs: 0,
        errorDetails: { message: sessionResult.error || 'Session creation failed' },
      });

      return {
        success: false,
        workflowId,
        status: 'manual_kyc',
        message: 'Video KYC session creation failed',
        error: sessionResult.error,
        attemptsSummary: { total: 3, successful: 0, failed: 3 },
      };
    }

    // Update workflow with video session info
    await db.update(kycWorkflows)
      .set({
        videoKycSessionId: sessionResult.session.sessionId,
      })
      .where(eq(kycWorkflows.id, workflowId));

    logger.info('Video KYC session created - awaiting user completion', {
      correlationId,
      workflowId,
      sessionId: sessionResult.session.sessionId,
    });

    // Video KYC is async - user must complete session
    // Return pending status (workflow completed via webhook later)
    return {
      success: true,
      workflowId,
      status: 'pending',
      method: 'video_kyc',
      message: 'Video KYC session created. Please complete the video verification.',
      attemptsSummary: { total: 3, successful: 0, failed: 2 },
    };
  }

  /**
   * Method 4: Manual KYC
   */
  private async initiateManualKYC(
    workflowId: string,
    request: KYCOrchestrationRequest,
    correlationId: string
  ): Promise<KYCOrchestrationResult> {
    logger.info('Initiating Manual KYC', { correlationId, workflowId });

    // Update workflow status
    await db.update(kycWorkflows)
      .set({
        status: 'manual_kyc',
        currentMethod: 'manual_kyc',
        attemptedMethods: sql`array_append(attempted_methods, 'manual_kyc')`,
        stepTimestamps: sql`jsonb_set(step_timestamps, '{manual_started}', to_jsonb(now()))`,
      })
      .where(eq(kycWorkflows.id, workflowId));

    await this.logAttempt({
      workflowId,
      userId: request.userId,
      verificationMethod: 'manual_kyc',
      provider: 'Internal_Compliance',
      correlationId: crypto.randomUUID(),
      outcome: 'partial_success',
      responseCode: 'PENDING',
      latencyMs: 0,
      metadata: { status: 'Awaiting document upload and manual review' },
    });

    logger.info('Manual KYC initiated - user must upload documents', { correlationId, workflowId });

    return {
      success: true,
      workflowId,
      status: 'pending',
      method: 'manual_kyc',
      message: 'Please upload KYC documents for manual verification by our compliance team.',
      attemptsSummary: { total: 4, successful: 0, failed: 3 },
    };
  }

  /**
   * Store verified KYC data in vault
   */
  private async storeInVault(userId: string, data: NormalizedKYCData): Promise<void> {
    // Encrypt personal data
    const encryptedFullName = encryptionService.encrypt(data.fullName);
    const encryptedDob = encryptionService.encrypt(data.dateOfBirth);
    const encryptedGender = encryptionService.encrypt(data.gender);
    const encryptedAddress = encryptionService.encrypt(`${data.addressLine1}, ${data.city}, ${data.state}`);
    const encryptedCity = encryptionService.encrypt(data.city);
    const encryptedState = encryptionService.encrypt(data.state);
    const encryptedPincode = encryptionService.encrypt(data.pincode);
    const encryptedMobile = data.mobile ? encryptionService.encrypt(data.mobile) : null;
    const encryptedEmail = data.email ? encryptionService.encrypt(data.email) : null;
    const encryptedCkycKin = encryptionService.encrypt(data.kycNumber);

    // Tokenize PAN, Aadhaar, CKYC/KRA number
    const tokenResults = await tokenizationService.tokenizeBatch([
      { value: data.panNumber, fieldType: 'pan' as const },
      ...(data.aadhaarNumber ? [{ value: data.aadhaarNumber, fieldType: 'aadhaar' as const }] : []),
      { value: data.kycNumber, fieldType: 'ckyc_kin' as const },
    ], userId);

    const tokenizedPan = tokenResults.get('pan') || null;
    const tokenizedAadhaar = tokenResults.get('aadhaar') || null;
    const tokenizedCkycKin = tokenResults.get('ckyc_kin') || null;

    // Calculate expiry (2 years from now)
    const kycExpiryDate = new Date();
    kycExpiryDate.setFullYear(kycExpiryDate.getFullYear() + 2);

    await db.insert(kycVault).values({
      userId,
      encryptedFullName,
      encryptedDateOfBirth: encryptedDob,
      encryptedGender,
      encryptedAddress,
      encryptedCity,
      encryptedState,
      encryptedPincode,
      encryptedMobile,
      encryptedEmail,
      encryptedCkycKin,
      tokenizedPan,
      tokenizedAadhaar,
      tokenizedCkycKin,
      aadhaarLast4: data.aadhaarNumber?.slice(-4),
      kycStatus: 'verified',
      ckycStatus: data.kycType === 'CKYC' ? 'found' : 'created',
      source: `priority_workflow_${data.dataSource}`,
      verificationMethod: data.kycType.toLowerCase(),
      isReusable: true,
      kycVerifiedAt: new Date(),
      kycExpiryDate,
      kycNextRenewalDate: new Date(kycExpiryDate.getTime() - 30 * 24 * 60 * 60 * 1000),
      isExpired: false,
    }).onConflictDoNothing();

    logger.info('KYC data stored in vault', { userId, dataSource: data.dataSource });
  }

  /**
   * Log verification attempt
   */
  private async logAttempt(attempt: {
    workflowId: string;
    userId: string;
    verificationMethod: string;
    provider: string;
    correlationId: string;
    outcome: string;
    responseCode?: string;
    latencyMs?: number;
    dataCompleteness?: number;
    dataFreshness?: Date;
    errorDetails?: any;
    metadata?: any;
  }): Promise<void> {
    await db.insert(kycVerificationAttempts).values({
      workflowId: attempt.workflowId,
      userId: attempt.userId,
      verificationMethod: attempt.verificationMethod,
      provider: attempt.provider,
      correlationId: attempt.correlationId,
      outcome: attempt.outcome,
      responseCode: attempt.responseCode,
      latencyMs: attempt.latencyMs,
      dataCompleteness: attempt.dataCompleteness,
      dataFreshness: attempt.dataFreshness,
      errorDetails: attempt.errorDetails,
      metadata: attempt.metadata,
      completedAt: new Date(),
    });
  }

  /**
   * Acquire distributed lock for user
   */
  private async acquireLock(userId: string): Promise<string | null> {
    const lockToken = crypto.randomUUID();

    // Check if existing lock is active
    const existing = await db.select()
      .from(kycWorkflows)
      .where(and(
        eq(kycWorkflows.userId, userId),
        sql`lock_expires_at > NOW()`
      ))
      .limit(1);

    if (existing.length > 0) {
      logger.warn('KYC workflow already locked for user', { userId });
      return null;
    }

    return lockToken;
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(userId: string): Promise<void> {
    await db.update(kycWorkflows)
      .set({
        lockToken: null,
        lockedAt: null,
        lockExpiresAt: null,
      })
      .where(eq(kycWorkflows.userId, userId));
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<any> {
    const [workflow] = await db.select()
      .from(kycWorkflows)
      .where(eq(kycWorkflows.id, workflowId))
      .limit(1);

    if (!workflow) {
      return null;
    }

    const attempts = await db.select()
      .from(kycVerificationAttempts)
      .where(eq(kycVerificationAttempts.workflowId, workflowId));

    return {
      workflow,
      attempts,
    };
  }
}

// Export singleton instance
export const kycPriorityOrchestrator = new KYCPriorityOrchestrator();
