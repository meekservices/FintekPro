import { db } from '../db';
import { users, userProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  requirements: {
    kycTierMet: boolean;
    accreditedStatusMet: boolean;
    riskProfileComplete: boolean;
    activeUser: boolean;
  };
  kycTier: string | null;
  accreditedStatus: string | null;
  maxTradeValue: number;
  warnings: string[];
}

export interface TradeEligibilityInput {
  userId: string;
  tradeValue: number;
  tradeType: 'buy' | 'sell';
}

const ACCREDITED_INVESTOR_THRESHOLD = 5000000;
const ENHANCED_KYC_TIERS = ['enhanced', 'accredited_investor', 'tier_3'];

export class UnlistedEligibilityService {
  async checkUserEligibility(userId: string): Promise<EligibilityResult> {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    if (!profile) {
      return {
        eligible: false,
        reason: 'User profile not found. Please complete your registration.',
        requirements: {
          kycTierMet: false,
          accreditedStatusMet: false,
          riskProfileComplete: false,
          activeUser: false,
        },
        kycTier: null,
        accreditedStatus: null,
        maxTradeValue: 0,
        warnings: [],
      };
    }

    const kycTier = profile.kycTier || 'basic';
    const accreditedStatus = profile.accreditedInvestorStatus || 'not_applicable';
    
    const kycTierMet = ENHANCED_KYC_TIERS.includes(kycTier);
    
    const accreditedStatusMet = accreditedStatus === 'verified';
    
    const isAccreditedExpired = profile.accreditedInvestorExpiryDate 
      ? new Date(profile.accreditedInvestorExpiryDate) < new Date()
      : false;
    
    const riskProfileComplete = Boolean(profile.riskCategory || profile.amlRiskScore);
    
    const activeUser = true;

    const warnings: string[] = [];
    
    if (isAccreditedExpired && accreditedStatus === 'verified') {
      warnings.push('Accredited investor status has expired. Renewal required for trades above ₹50 lakhs.');
    }
    
    if (!riskProfileComplete) {
      warnings.push('Risk profile assessment is incomplete. Complete your risk assessment for personalized recommendations.');
    }

    const maxTradeValue = accreditedStatusMet && !isAccreditedExpired 
      ? Number.MAX_SAFE_INTEGER 
      : ACCREDITED_INVESTOR_THRESHOLD;

    const eligible = kycTierMet && activeUser;

    let reason: string | undefined;
    if (!eligible) {
      if (!activeUser) {
        reason = 'Account is not active. Please contact support.';
      } else if (!kycTierMet) {
        reason = `Enhanced KYC (Tier 3) is required for unlisted marketplace trading. Current tier: ${kycTier}. Please complete your KYC upgrade.`;
      }
    }

    return {
      eligible,
      reason,
      requirements: {
        kycTierMet,
        accreditedStatusMet: accreditedStatusMet && !isAccreditedExpired,
        riskProfileComplete,
        activeUser,
      },
      kycTier,
      accreditedStatus: isAccreditedExpired ? 'expired' : accreditedStatus,
      maxTradeValue,
      warnings,
    };
  }

  async checkTradeEligibility(input: TradeEligibilityInput): Promise<EligibilityResult & { tradeAllowed: boolean }> {
    const eligibility = await this.checkUserEligibility(input.userId);

    if (!eligibility.eligible) {
      return {
        ...eligibility,
        tradeAllowed: false,
      };
    }

    if (input.tradeValue > ACCREDITED_INVESTOR_THRESHOLD && !eligibility.requirements.accreditedStatusMet) {
      return {
        ...eligibility,
        tradeAllowed: false,
        reason: `Trades above ₹${(ACCREDITED_INVESTOR_THRESHOLD / 100000).toFixed(0)} lakhs require SEBI Accredited Investor status. Your current status: ${eligibility.accreditedStatus}. Please apply for accredited investor certification.`,
      };
    }

    if (!eligibility.requirements.riskProfileComplete) {
      eligibility.warnings.push(`Risk profile incomplete: We recommend completing your risk assessment before trading unlisted securities.`);
    }

    return {
      ...eligibility,
      tradeAllowed: true,
    };
  }

  async getEligibilityRequirements(): Promise<{
    description: string;
    requirements: Array<{ name: string; description: string; mandatory: boolean }>;
    thresholds: { accreditedInvestorThreshold: number };
  }> {
    return {
      description: 'Requirements for trading in the Unlisted Marketplace',
      requirements: [
        {
          name: 'Enhanced KYC (Tier 3)',
          description: 'Complete full KYC verification including PAN, Aadhaar, address proof, and video verification',
          mandatory: true,
        },
        {
          name: 'Risk Profile Assessment',
          description: 'Complete the risk profiling questionnaire to understand your investment suitability',
          mandatory: false,
        },
        {
          name: 'SEBI Accredited Investor Certification',
          description: `Required for trades exceeding ₹${(ACCREDITED_INVESTOR_THRESHOLD / 100000).toFixed(0)} lakhs. Based on income, net worth, or portfolio value criteria.`,
          mandatory: false,
        },
        {
          name: 'Risk Disclosure Acknowledgment',
          description: 'Read and accept the SEBI-mandated risk disclosures for unlisted securities',
          mandatory: true,
        },
      ],
      thresholds: {
        accreditedInvestorThreshold: ACCREDITED_INVESTOR_THRESHOLD,
      },
    };
  }

  async getKYCUpgradeStatus(userId: string): Promise<{
    currentTier: string;
    targetTier: string;
    stepsCompleted: string[];
    stepsRemaining: string[];
    estimatedTimeToComplete: string;
  }> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const currentTier = profile?.kycTier || 'basic';
    
    const stepsCompleted: string[] = [];
    const stepsRemaining: string[] = [];

    if (user?.isEmailVerified) {
      stepsCompleted.push('Email Verification');
    } else {
      stepsRemaining.push('Email Verification');
    }

    if (user?.isMobileVerified) {
      stepsCompleted.push('Phone Verification');
    } else {
      stepsRemaining.push('Phone Verification');
    }

    if (profile?.panVerifiedViaSandbox || user?.panVerifiedViaSmartKyc) {
      stepsCompleted.push('PAN Verification');
    } else {
      stepsRemaining.push('PAN Verification');
    }

    if (user?.aadhaarVerifiedViaSmartKyc) {
      stepsCompleted.push('Aadhaar Verification');
    } else {
      stepsRemaining.push('Aadhaar OTP Verification');
    }

    if (profile?.address) {
      stepsCompleted.push('Address Proof');
    } else {
      stepsRemaining.push('Address Proof Upload');
    }

    if (profile?.videoKycStatus === 'completed') {
      stepsCompleted.push('Video KYC');
    } else {
      stepsRemaining.push('Video KYC Call');
    }

    const timePerStep = 5;
    const estimatedMinutes = stepsRemaining.length * timePerStep;
    const estimatedTimeToComplete = estimatedMinutes > 0 
      ? `~${estimatedMinutes} minutes` 
      : 'Already complete';

    return {
      currentTier,
      targetTier: 'tier_3',
      stepsCompleted,
      stepsRemaining,
      estimatedTimeToComplete,
    };
  }
}

export const unlistedEligibilityService = new UnlistedEligibilityService();
