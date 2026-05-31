// @ts-nocheck
import { kycOrchestrationEngine } from "./kyc-orchestration-engine";
import { kycAuditPackService } from "./kyc-audit-pack-service";
import { db } from "../db";
import { users, agentNotifications } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * KYC Central Hub Service
 * 
 * The single source of truth for all KYC operations across FintekPro portals.
 * It coordinates the orchestration engine, compliance logging, and 
 * data portability for partners like Alpaca and IIFL.
 */
export class KycCentralHubService {
  private static engine = kycOrchestrationEngine;

  /**
   * Universal entry point for any KYC step from any portal.
   */
  static async processKycStep(params: {
    userId: string;
    step: string; // 'pan', 'aadhaar', 'bank', 'ckyc'
    portalId: string; // 'primary_portal', 'agent_portal', 'alpaca_integration'
    payload: any;
    productType?: string;
  }) {
    const traceId = `tr_${nanoid(10)}`;
    const startTime = Date.now();

    console.log(`[KYC-HUB] ${params.portalId} initiating ${params.step} for user ${params.userId} (Trace: ${traceId})`);

    // 1. Execute the verification through the existing orchestration engine
    const result = await this.engine.executeVerification({
      userId: params.userId,
      kycStep: params.step,
      productType: params.productType || 'general',
      payload: params.payload,
    });

    // 2. Log Regulatory Audit (with SHA-256 Hashing)
    // We log the attempt regardless of success/failure
    await kycAuditPackService.logRegulatoryStep({
      userId: params.userId,
      serviceProvider: result.providerCode,
      apiEndpoint: `/api/kyc/${params.step}`,
      requestType: `${params.step}_verify`,
      requestBody: params.payload,
      responseBody: result.data || { error: result.errorMessage },
      status: result.success ? 'success' : 'failure',
      traceId: traceId,
      latencyMs: Date.now() - startTime,
    });

    // 3. Update Central User Status if success
    if (result.success && result.data?.verified) {
      await this.updateUserKycProgress(params.userId, params.step, result.data);
    }

    // 4. Auto-generate tasks for Humans if it failed but needs review
    if (!result.success && this.isManualReviewRequired(result)) {
      await this.createManualTask(params.userId, params.step, result);
    }

    return result;
  }

  /**
   * Facilitates "Auto-fill" for partners like Alpaca or IIFL
   * with strict Consent Verification.
   */
  static async getVerifiedDataForPartner(userId: string, partnerId: string, purpose: string) {
    // 1. Compliance Check: Is there a record of user consent?
    const hasConsent = await kycAuditPackService.verifyConsent(userId, partnerId, purpose);
    if (!hasConsent) {
      throw new Error(`COMPLIANCE_ERROR: No valid consent found for partner ${partnerId}`);
    }

    // 2. Fetch the "Golden Record" from the vault
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) throw new Error("USER_NOT_FOUND");

    // 3. Log the data sharing event for future audits
    await kycAuditPackService.logConsent({
      userId,
      partnerId,
      purpose,
      consentType: 'platform_autofill',
      dataShared: ['pan', 'name', 'dob', 'address'], // Filtered per partner need
    });

    // 4. Return the data pack
    return {
      pan: user.panNumber,
      name: user.fullName,
      email: user.email,
      // ... mapping more fields per partner needs
    };
  }

  private static async updateUserKycProgress(userId: string, step: string, data: any) {
    // Sync status across portals
    // Example: if PAN is verified, update the main user record
    if (step === 'pan') {
      await db.update(users)
        .set({ 
          panNumber: data.pan || data.panNumber,
          kycStatus: 'PAN_VERIFIED' 
        })
        .where(eq(users.id, userId));
    }
  }

  private static isManualReviewRequired(result: any): boolean {
    const criticalErrors = ['NAME_MISMATCH', 'DOB_MISMATCH', 'BLURRY_DOCUMENT'];
    return criticalErrors.includes(result.errorCode || '');
  }

  private static async createManualTask(userId: string, step: string, result: any) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;

    // Determine who to notify (Agent if user has one, else Admin)
    const notificationTarget = user.createdByAgentId || 'system_admin';
    const errorType = result.errorCode || 'VERIFICATION_FAILURE';

    await db.insert(agentNotifications).values({
      id: nanoid(),
      userId: notificationTarget,
      title: "Action Required: KYC Intervention",
      message: `Manual review needed for ${user.fullName} (${step}). Error: ${result.errorMessage}`,
      type: "kyc_task",
      severity: "high",
      metadata: {
        targetUserId: userId,
        kycStep: step,
        errorCode: errorType,
        errorMessage: result.errorMessage,
        automatedResult: result.data
      },
      isRead: false,
      createdAt: new Date(),
    });

    console.log(`[KYC-HUB] Created manual task for ${notificationTarget} regarding user ${userId}`);
  }
}
