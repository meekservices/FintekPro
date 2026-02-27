import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export type KycEntityType = 'INDIVIDUAL' | 'HUF' | 'COMPANY' | 'LLP' | 'TRUST' | 'PARTNERSHIP' | 'AOP' | 'GOVERNMENT';

export type KycStepId =
  | 'pan_verification'
  | 'ckyc_kra_check'
  | 'aadhaar_otp'
  | 'aadhaar_otp_verify'
  | 'profile_completion'
  | 'risk_profiling'
  | 'fatca_signature'
  | 'compliance_signoff'
  | 'aml_screening'
  | 'completed';

export type KycSessionStatus = 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';

export type TierStatus = 'provisional' | 'final';

export interface KycStepStatus {
  pan_verified: boolean;
  entity_locked: boolean;
  ckyc_fetched: boolean;
  ckyc_confidence?: number;
  ckyc_missing_fields?: string[];
  kra_verified: boolean;
  aadhaar_required: boolean;
  aadhaar_otp_sent: boolean;
  aadhaar_verified: boolean;
  profile_completed: boolean;
  risk_profiling: boolean;
  fatca_signed: boolean;
  compliance_signed: boolean;
  aml_screened: boolean;
  aml_risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  video_kyc_required: boolean;
}

export interface KycSessionState {
  sessionId: string;
  userId: string;
  initiatedBy: 'customer' | 'agent';
  agentId?: string;
  entityType: KycEntityType;
  entityLocked: boolean;
  overrideAllowed: boolean;
  currentStep: KycStepId;
  status: KycSessionStatus;
  stepStatus: KycStepStatus;
  kycLevel: number;
  kycTier: string;
  tierStatus: TierStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PanVerificationResult {
  pan_valid: boolean;
  entity_detected: KycEntityType;
  override_allowed: boolean;
  source: 'sandbox';
  full_name?: string;
  pan_number?: string;
  entity_locked: boolean;
}

export interface CkycDecisionResult {
  ckyc_found: boolean;
  confidence_score: number;
  missing_fields: string[];
  aadhaar_required: boolean;
  kra_status?: string;
  ckyc_number?: string;
  source: 'truthscreen' | 'authbridge' | 'mock';
}

export interface AmlCheckResult {
  aml_score: number;
  pep: boolean;
  sanctions: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  video_kyc_required: boolean;
  screening_id: string;
  source: 'truthscreen' | 'mock';
  factors: Array<{ type: string; description: string; severity: string }>;
}

export interface TierEngineResult {
  kyc_level: number;
  kyc_tier: string;
  tier_status: TierStatus;
  products_unlocked: string[];
  products_locked: string[];
  upgrade_actions: string[];
}

const PAN_ENTITY_MAP: Record<string, KycEntityType> = {
  'A': 'AOP',
  'B': 'AOP',
  'C': 'COMPANY',
  'F': 'LLP',
  'G': 'GOVERNMENT',
  'H': 'HUF',
  'J': 'AOP',
  'L': 'LLP',
  'P': 'INDIVIDUAL',
  'T': 'TRUST',
};

const STEP_ORDER: KycStepId[] = [
  'pan_verification',
  'ckyc_kra_check',
  'aadhaar_otp',
  'aadhaar_otp_verify',
  'profile_completion',
  'risk_profiling',
  'fatca_signature',
  'compliance_signoff',
  'aml_screening',
  'completed',
];

const AGENT_BLOCKED_STEPS: KycStepId[] = [
  'aadhaar_otp',
  'aadhaar_otp_verify',
  'fatca_signature',
  'compliance_signoff',
];

class KycOrchestratorService {

  getDefaultStepStatus(): KycStepStatus {
    return {
      pan_verified: false,
      entity_locked: false,
      ckyc_fetched: false,
      kra_verified: false,
      aadhaar_required: true,
      aadhaar_otp_sent: false,
      aadhaar_verified: false,
      profile_completed: false,
      risk_profiling: false,
      fatca_signed: false,
      compliance_signed: false,
      aml_screened: false,
      video_kyc_required: false,
    };
  }

  async createSession(params: {
    userId: string;
    initiatedBy: 'customer' | 'agent';
    agentId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<KycSessionState> {
    const sessionId = nanoid(24);
    // 7 days — must accommodate 24-48 hour CKYC polling windows
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const existingProfile = await db.select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, params.userId))
      .limit(1);

    const profile = existingProfile[0];
    const stepStatus = this.getDefaultStepStatus();
    let currentStep: KycStepId = 'pan_verification';
    let entityType: KycEntityType = 'INDIVIDUAL';

    if (profile?.panVerifiedViaSandbox) {
      stepStatus.pan_verified = true;
      stepStatus.entity_locked = true;
      currentStep = 'ckyc_kra_check';

      if (profile.entityType) {
        entityType = profile.entityType.toUpperCase() as KycEntityType;
      }
    }

    if (profile?.ckycFetchedViaAuthBridge || profile?.ckycAuthBridgeStatus === 'found') {
      stepStatus.ckyc_fetched = true;
      stepStatus.kra_verified = true;
      stepStatus.aadhaar_required = false;
      currentStep = 'risk_profiling';
    }

    if (profile?.aadhaarVerifiedViaSmartKyc) {
      stepStatus.aadhaar_verified = true;
      stepStatus.aadhaar_otp_sent = true;
    }

    const kycLevel = parseInt(profile?.kycLevel || '0', 10);
    const kycTier = profile?.kycTier || 'basic';

    const state: KycSessionState = {
      sessionId,
      userId: params.userId,
      initiatedBy: params.initiatedBy,
      agentId: params.agentId,
      entityType,
      entityLocked: stepStatus.entity_locked,
      overrideAllowed: false,
      currentStep,
      status: 'IN_PROGRESS',
      stepStatus,
      kycLevel,
      kycTier,
      tierStatus: 'provisional',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db.insert(schema.kycVerificationSessions).values({
        id: sessionId,
        userId: params.userId,
        initiatedBy: params.initiatedBy,
        createdByAgentId: params.agentId || null,
        entityType,
        entityLocked: stepStatus.entity_locked,
        currentStep,
        stepStatus,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        expiresAt,
        isActive: true,
      });
    } catch (dbErr: any) {
      console.error('[KYC_ORCHESTRATOR] Failed to persist session to DB:', dbErr?.message);
    }

    return state;
  }

  detectEntityFromPAN(panNumber: string): KycEntityType {
    if (!panNumber || panNumber.length < 5) {
      return 'INDIVIDUAL';
    }
    const fourthChar = panNumber.charAt(3).toUpperCase();
    return PAN_ENTITY_MAP[fourthChar] || 'INDIVIDUAL';
  }

  canOverrideEntity(requestorRole: string): { allowed: boolean; requiresReason: boolean } {
    if (requestorRole === 'superadmin' || requestorRole === 'admin') {
      return { allowed: true, requiresReason: true };
    }
    return { allowed: false, requiresReason: false };
  }

  async buildPanVerificationResult(
    panNumber: string,
    verificationData: any,
    requestorRole: string
  ): Promise<PanVerificationResult> {
    const entityDetected = this.detectEntityFromPAN(panNumber);
    const overrideCheck = this.canOverrideEntity(requestorRole);

    return {
      pan_valid: verificationData?.valid !== false,
      entity_detected: entityDetected,
      override_allowed: overrideCheck.allowed,
      source: 'sandbox',
      full_name: verificationData?.registered_name || verificationData?.fullName,
      pan_number: panNumber,
      entity_locked: true,
    };
  }

  computeCkycConfidence(ckycData: any): CkycDecisionResult {
    if (!ckycData || !ckycData.found) {
      return {
        ckyc_found: false,
        confidence_score: 0,
        missing_fields: ['ckyc_record'],
        aadhaar_required: true,
        source: ckycData?.provider || 'mock',
      };
    }

    const requiredFields = ['fullName', 'dateOfBirth', 'address', 'mobile', 'gender'];
    const missingFields: string[] = [];
    let fieldsPresent = 0;

    const data = ckycData.data || {};

    for (const field of requiredFields) {
      if (field === 'address') {
        const addr = data.address;
        if (!addr || (!addr.line1 && !addr.city && !addr.pincode)) {
          missingFields.push('address');
        } else {
          fieldsPresent++;
        }
      } else if (data[field]) {
        fieldsPresent++;
      } else {
        missingFields.push(field);
      }
    }

    const confidence = fieldsPresent / requiredFields.length;
    const skipAadhaar = confidence >= 0.9 && missingFields.length === 0;

    return {
      ckyc_found: true,
      confidence_score: parseFloat(confidence.toFixed(2)),
      missing_fields: missingFields,
      aadhaar_required: !skipAadhaar,
      kra_status: ckycData.kraStatus || 'verified',
      ckyc_number: ckycData.kin || ckycData.ckycNumber,
      source: ckycData.provider || 'truthscreen',
    };
  }

  isAgentBlocked(step: KycStepId, initiatedBy: 'customer' | 'agent'): boolean {
    return initiatedBy === 'agent' && AGENT_BLOCKED_STEPS.includes(step);
  }

  resolveNextStep(
    currentStep: KycStepId,
    stepStatus: KycStepStatus,
    initiatedBy: 'customer' | 'agent'
  ): KycStepId {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < 0 || currentIndex >= STEP_ORDER.length - 1) {
      return 'completed';
    }

    for (let i = currentIndex + 1; i < STEP_ORDER.length; i++) {
      const candidateStep = STEP_ORDER[i];

      if (candidateStep === 'aadhaar_otp' && !stepStatus.aadhaar_required) {
        continue;
      }
      if (candidateStep === 'aadhaar_otp_verify' && (!stepStatus.aadhaar_required || !stepStatus.aadhaar_otp_sent)) {
        continue;
      }

      if (initiatedBy === 'agent' && AGENT_BLOCKED_STEPS.includes(candidateStep)) {
        continue;
      }

      if (candidateStep === 'aml_screening' && stepStatus.aml_screened) {
        continue;
      }

      return candidateStep;
    }

    return 'completed';
  }

  computeAmlResult(screeningData: any): AmlCheckResult {
    const score = screeningData?.riskProfile?.riskScore || screeningData?.aml_score || 10;
    const pep = screeningData?.pepMatch?.length > 0 || screeningData?.pep === true;
    const sanctions = screeningData?.sanctionsMatch?.length > 0 || screeningData?.sanctions === true;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score >= 80) riskLevel = 'CRITICAL';
    else if (score >= 60) riskLevel = 'HIGH';
    else if (score >= 30) riskLevel = 'MEDIUM';

    const videoKycRequired = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

    const factors: Array<{ type: string; description: string; severity: string }> = [];
    if (pep) factors.push({ type: 'pep', description: 'PEP match found', severity: 'high' });
    if (sanctions) factors.push({ type: 'sanctions', description: 'Sanctions match found', severity: 'critical' });

    return {
      aml_score: score,
      pep,
      sanctions,
      risk_level: riskLevel,
      video_kyc_required: videoKycRequired,
      screening_id: screeningData?.screeningId || `scr_${nanoid(12)}`,
      source: screeningData?.source || 'mock',
      factors,
    };
  }

  computeTierResult(params: {
    kycLevel: number;
    panVerified: boolean;
    ckycFetched: boolean;
    aadhaarVerified: boolean;
    riskProfilingDone: boolean;
    complianceSigned: boolean;
    amlScreened: boolean;
    amlRiskLevel?: string;
    videoKycDone?: boolean;
  }): TierEngineResult {
    let level = 0;
    let tier = 'basic';
    let tierStatus: TierStatus = 'provisional';
    const productsUnlocked: string[] = [];
    const productsLocked: string[] = [];
    const upgradeActions: string[] = [];

    if (params.panVerified) {
      level = 1;
      productsUnlocked.push('mutual_funds_basic', 'insurance', 'loans');
    }

    if (params.ckycFetched && (params.aadhaarVerified || params.kycLevel >= 2)) {
      level = 2;
      tier = 'enhanced';
      productsUnlocked.push('stocks', 'bonds', 'mutual_funds_full', 'unlisted_shares');
    }

    if (params.complianceSigned && params.amlScreened) {
      if (params.amlRiskLevel === 'HIGH' || params.amlRiskLevel === 'CRITICAL') {
        tierStatus = 'provisional';
        if (!params.videoKycDone) {
          upgradeActions.push('Complete Video KYC for full access');
          productsLocked.push('unlisted_shares', 'bonds');
        }
      } else {
        tierStatus = 'final';
      }
    } else {
      tierStatus = 'provisional';
      if (!params.riskProfilingDone) upgradeActions.push('Complete risk profiling');
      if (!params.complianceSigned) upgradeActions.push('Complete FATCA & compliance sign-off');
      if (!params.amlScreened) upgradeActions.push('AML screening pending');
    }

    const allProducts = ['mutual_funds_basic', 'mutual_funds_full', 'stocks', 'bonds', 'insurance', 'loans', 'unlisted_shares', 'fixed_deposits', 'pms'];
    for (const p of allProducts) {
      if (!productsUnlocked.includes(p) && !productsLocked.includes(p)) {
        productsLocked.push(p);
      }
    }

    return {
      kyc_level: level,
      kyc_tier: tier,
      tier_status: tierStatus,
      products_unlocked: productsUnlocked,
      products_locked: productsLocked,
      upgrade_actions: upgradeActions,
    };
  }

  async logAuditEvent(params: {
    userId: string;
    action: string;
    step: string;
    details: Record<string, any>;
    performedBy: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(params.details))
      .digest('hex')
      .substring(0, 16);

    const auditMeta = {
      step: params.step,
      payloadHash,
      regulation: 'SEBI_KYC_Master_2024',
      provider_stack: ['Sandbox', 'TruthScreen'],
      ...params.details,
    };

    try {
      await db.insert(schema.complianceAuditTrail).values({
        userId: params.userId,
        action: params.action,
        fieldChanged: params.step,
        performedBy: params.performedBy,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: auditMeta,
        complianceImpact: 'major',
      });
    } catch (dbErr: any) {
      console.error('[KYC_AUDIT] Failed to persist audit event to DB:', dbErr?.message);
    }

    console.log(`[KYC_AUDIT] ${params.action}`, {
      userId: params.userId,
      step: params.step,
      performedBy: params.performedBy,
      payloadHash,
      timestamp: new Date().toISOString(),
    });
  }

  canResumeStep(requestedStep: KycStepId, actualStep: KycStepId): boolean {
    const requestedIndex = STEP_ORDER.indexOf(requestedStep);
    const actualIndex = STEP_ORDER.indexOf(actualStep);
    return requestedIndex <= actualIndex;
  }

  generateCustomerKycLink(sessionId: string, userId: string): string {
    // Stable hash — no timestamp so the same session always produces the same link
    const token = createHash('sha256')
      .update(`${sessionId}:${userId}`)
      .digest('hex')
      .substring(0, 32);
    return `/kyc/continue?session=${sessionId}&token=${token}`;
  }

  getAgentAllowedSteps(): KycStepId[] {
    return STEP_ORDER.filter(step => !AGENT_BLOCKED_STEPS.includes(step));
  }

  getStepOrder(): KycStepId[] {
    return [...STEP_ORDER];
  }

  isSessionExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }
}

export const kycOrchestratorService = new KycOrchestratorService();
