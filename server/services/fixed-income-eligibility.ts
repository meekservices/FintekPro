import { db } from '../db';
import { 
  users,
  userProfiles,
  userDematAccounts,
  userUccStatus,
  bondSuitabilityChecks,
  kycVerificationSessions,
  fixedIncomeAuditLog
} from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;

interface EligibilityCheckResult {
  eligible: boolean;
  uccStatus: 'not_created' | 'pending' | 'active' | 'suspended' | 'deactivated';
  kycStatus: 'not_verified' | 'basic' | 'full' | 'enhanced' | 'accredited_investor';
  dematStatus: 'not_linked' | 'pending' | 'verified';
  eligibleProducts: {
    bonds: boolean;
    ncds: boolean;
    sgb: boolean;
    gsec: boolean;
    taxFreeBonds: boolean;
    mlDs: boolean;
  };
  restrictions: string[];
  nextSteps: string[];
  suitabilityCheckRequired: boolean;
  suitabilityCheckValid: boolean;
}

interface KycVerificationResult {
  verified: boolean;
  kycLevel: string;
  kraStatus: string;
  ckycNumber?: string;
  panVerified: boolean;
  aadharVerified: boolean;
  fatcaCompliant: boolean;
}

interface DematVerificationResult {
  verified: boolean;
  accounts: Array<{
    id: string;
    accountNumber: string;
    dpId: string;
    dpName: string;
    depository: string;
    status: string;
  }>;
  primaryAccountId?: string;
}

interface UccVerificationResult {
  status: string;
  uccNumber?: string;
  kraVerified: boolean;
  exchangeRegistration: {
    nse: boolean;
    bse: boolean;
  };
  tradingEnabled: {
    bonds: boolean;
    ncds: boolean;
    sgb: boolean;
    gsec: boolean;
  };
}

class FixedIncomeEligibilityService {
  
  async checkFullEligibility(userId: string): Promise<EligibilityCheckResult> {
    const [kycResult, dematResult, uccResult, suitabilityResult] = await Promise.all([
      this.verifyKycStatus(userId),
      this.verifyDematAccounts(userId),
      this.verifyUccStatus(userId),
      this.checkSuitabilityValidity(userId)
    ]);

    const restrictions: string[] = [];
    const nextSteps: string[] = [];

    if (!kycResult.verified) {
      restrictions.push('KYC verification incomplete');
      nextSteps.push('Complete KYC verification to enable trading');
    }

    if (!dematResult.verified) {
      restrictions.push('No verified demat account');
      nextSteps.push('Link and verify a demat account for settlement');
    }

    if (uccResult.status !== 'active') {
      restrictions.push('UCC not active');
      nextSteps.push('Complete UCC registration for exchange trading');
    }

    if (!kycResult.fatcaCompliant) {
      restrictions.push('FATCA declaration pending');
      nextSteps.push('Submit FATCA self-declaration');
    }

    const eligibleProducts = {
      bonds: kycResult.kycLevel !== 'not_verified' && dematResult.verified && uccResult.tradingEnabled.bonds,
      ncds: kycResult.kycLevel !== 'not_verified' && dematResult.verified && uccResult.tradingEnabled.ncds,
      sgb: kycResult.kycLevel !== 'not_verified' && dematResult.verified && uccResult.tradingEnabled.sgb,
      gsec: kycResult.kycLevel !== 'not_verified' && dematResult.verified && uccResult.tradingEnabled.gsec,
      taxFreeBonds: kycResult.kycLevel !== 'not_verified' && dematResult.verified,
      mlDs: kycResult.kycLevel === 'accredited_investor' && dematResult.verified
    };

    const eligible = kycResult.verified && 
                     dematResult.verified && 
                     uccResult.status === 'active' && 
                     Object.values(eligibleProducts).some(v => v);

    await this.logAuditEvent(userId, 'eligibility_check', 'compliance', {
      eligible,
      kycLevel: kycResult.kycLevel,
      uccStatus: uccResult.status,
      dematVerified: dematResult.verified,
      restrictions,
      eligibleProducts
    });

    return {
      eligible,
      uccStatus: uccResult.status as EligibilityCheckResult['uccStatus'],
      kycStatus: kycResult.kycLevel as EligibilityCheckResult['kycStatus'],
      dematStatus: dematResult.verified ? 'verified' : (dematResult.accounts.length > 0 ? 'pending' : 'not_linked'),
      eligibleProducts,
      restrictions,
      nextSteps,
      suitabilityCheckRequired: true,
      suitabilityCheckValid: suitabilityResult.valid
    };
  }

  async verifyKycStatus(userId: string): Promise<KycVerificationResult> {
    const [user, profile] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1)
    ]);

    if (!user[0]) {
      return {
        verified: false,
        kycLevel: 'not_verified',
        kraStatus: 'not_verified',
        panVerified: false,
        aadharVerified: false,
        fatcaCompliant: false
      };
    }

    const userRecord = user[0];
    const userProfile = profile[0];
    const kycLevel = userProfile?.kycTier || 'not_verified';
    
    const panVerified = userRecord.panVerifiedViaSmartKyc === true || !!userProfile?.panNumber;
    const aadharVerified = userRecord.aadhaarVerifiedViaSmartKyc === true || !!userProfile?.aadharNumber;
    
    const kraSession = await db.select()
      .from(kycVerificationSessions)
      .where(and(
        eq(kycVerificationSessions.userId, userId),
        eq(kycVerificationSessions.sessionType, 'kra')
      ))
      .orderBy(desc(kycVerificationSessions.createdAt))
      .limit(1);

    const kraStatus = kraSession[0]?.stepStatus as string || 'not_verified';

    return {
      verified: kycLevel !== 'not_verified' && kycLevel !== 'basic',
      kycLevel,
      kraStatus,
      ckycNumber: (userProfile as any)?.ckycNumber || undefined,
      panVerified,
      aadharVerified,
      fatcaCompliant: userProfile?.fatcaStatus === 'Y'
    };
  }

  async verifyDematAccounts(userId: string): Promise<DematVerificationResult> {
    const accounts = await db.select()
      .from(userDematAccounts)
      .where(eq(userDematAccounts.userId, userId));

    const verifiedAccounts = accounts.filter(acc => acc.verificationStatus === 'verified');
    const primaryAccount = accounts.find(acc => acc.isDefaultForEquityTransactions || acc.isDefaultForMutualFundTransactions);

    return {
      verified: verifiedAccounts.length > 0,
      accounts: accounts.map(acc => ({
        id: acc.id,
        accountNumber: acc.dematAccountNumber,
        dpId: acc.dematDpId,
        dpName: acc.dematDpName,
        depository: acc.depositoryType || 'nsdl',
        status: acc.verificationStatus || 'pending'
      })),
      primaryAccountId: primaryAccount?.id
    };
  }

  async verifyUccStatus(userId: string): Promise<UccVerificationResult> {
    const uccRecord = await db.select()
      .from(userUccStatus)
      .where(eq(userUccStatus.userId, userId))
      .limit(1);

    if (!uccRecord[0]) {
      return {
        status: 'not_created',
        kraVerified: false,
        exchangeRegistration: { nse: false, bse: false },
        tradingEnabled: { bonds: false, ncds: false, sgb: false, gsec: false }
      };
    }

    const ucc = uccRecord[0];
    return {
      status: ucc.uccStatus || 'not_created',
      uccNumber: ucc.uccNumber || undefined,
      kraVerified: ucc.kraStatus === 'verified',
      exchangeRegistration: {
        nse: ucc.nseRegistered || false,
        bse: ucc.bseRegistered || false
      },
      tradingEnabled: {
        bonds: ucc.bondTradingEnabled || false,
        ncds: ucc.ncdApplicationEnabled || false,
        sgb: ucc.sgbApplicationEnabled || false,
        gsec: ucc.gsecTradingEnabled || false
      }
    };
  }

  async checkSuitabilityValidity(userId: string): Promise<{ valid: boolean; expiresAt?: Date }> {
    const validCheck = await db.select()
      .from(bondSuitabilityChecks)
      .where(and(
        eq(bondSuitabilityChecks.userId, userId),
        eq(bondSuitabilityChecks.suitabilityResult, 'approved'),
        gte(bondSuitabilityChecks.validUntil, new Date())
      ))
      .orderBy(desc(bondSuitabilityChecks.createdAt))
      .limit(1);

    if (validCheck[0]) {
      return { 
        valid: true, 
        expiresAt: validCheck[0].validUntil ? new Date(validCheck[0].validUntil) : undefined 
      };
    }

    return { valid: false };
  }

  async createOrUpdateUccStatus(userId: string, data: Partial<typeof userUccStatus.$inferInsert>): Promise<typeof userUccStatus.$inferSelect> {
    const existing = await db.select()
      .from(userUccStatus)
      .where(eq(userUccStatus.userId, userId))
      .limit(1);

    if (existing[0]) {
      const [updated] = await db.update(userUccStatus)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(userUccStatus.userId, userId))
        .returning();

      await this.logAuditEvent(userId, 'ucc_status_updated', 'compliance', {
        previousStatus: existing[0].uccStatus,
        newStatus: data.uccStatus || existing[0].uccStatus,
        changes: data
      });

      return updated;
    }

    const [created] = await db.insert(userUccStatus)
      .values({
        userId,
        ...data
      })
      .returning();

    await this.logAuditEvent(userId, 'ucc_status_created', 'compliance', {
      uccNumber: created.uccNumber,
      uccStatus: created.uccStatus
    });

    return created;
  }

  async initiateUccCreation(userId: string): Promise<{ success: boolean; message: string; uccNumber?: string }> {
    const eligibility = await this.checkFullEligibility(userId);

    if (eligibility.kycStatus === 'not_verified') {
      return { success: false, message: 'KYC verification required before UCC creation' };
    }

    if (eligibility.dematStatus === 'not_linked') {
      return { success: false, message: 'Demat account must be linked before UCC creation' };
    }

    const uccNumber = `FTP${Date.now().toString(36).toUpperCase()}`;

    const ucc = await this.createOrUpdateUccStatus(userId, {
      uccNumber,
      uccStatus: 'pending',
      uccCreatedDate: new Date().toISOString().split('T')[0],
      bondTradingEnabled: false,
      ncdApplicationEnabled: false,
      sgbApplicationEnabled: false,
      gsecTradingEnabled: false
    });

    return {
      success: true,
      message: 'UCC creation initiated. Verification in progress.',
      uccNumber: ucc.uccNumber || undefined
    };
  }

  async activateUcc(userId: string, verificationData: {
    kraNumber?: string;
    kraAgency?: string;
    nseRegistered?: boolean;
    bseRegistered?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const existing = await db.select()
      .from(userUccStatus)
      .where(eq(userUccStatus.userId, userId))
      .limit(1);

    if (!existing[0]) {
      return { success: false, message: 'UCC not found. Please initiate UCC creation first.' };
    }

    await this.createOrUpdateUccStatus(userId, {
      uccStatus: 'active',
      kraStatus: 'verified',
      kraNumber: verificationData.kraNumber,
      kraAgency: verificationData.kraAgency,
      kraVerifiedDate: new Date().toISOString().split('T')[0],
      nseRegistered: verificationData.nseRegistered || false,
      bseRegistered: verificationData.bseRegistered || true,
      bondTradingEnabled: true,
      ncdApplicationEnabled: true,
      sgbApplicationEnabled: true,
      gsecTradingEnabled: true,
      uccLastVerified: new Date()
    });

    return { success: true, message: 'UCC activated successfully. Trading enabled.' };
  }

  async checkProductEligibility(
    userId: string, 
    productType: 'ncd' | 'sgb' | 'corporate_bond' | 'g_sec' | 'tax_free_bond' | 'mld',
    investmentAmount?: number
  ): Promise<{
    eligible: boolean;
    reasons: string[];
    requirements: string[];
    maxAllowedAmount?: number;
  }> {
    const eligibility = await this.checkFullEligibility(userId);
    const reasons: string[] = [];
    const requirements: string[] = [];

    if (!eligibility.eligible) {
      reasons.push(...eligibility.restrictions);
      requirements.push(...eligibility.nextSteps);
      return { eligible: false, reasons, requirements };
    }

    switch (productType) {
      case 'ncd':
        if (!eligibility.eligibleProducts.ncds) {
          reasons.push('NCD trading not enabled');
          requirements.push('Complete UCC registration with NCD trading permission');
        }
        break;

      case 'sgb':
        if (!eligibility.eligibleProducts.sgb) {
          reasons.push('SGB application not enabled');
          requirements.push('Complete SGB application enablement');
        }
        if (investmentAmount && investmentAmount > 400000000) {
          reasons.push('Investment amount exceeds SGB limit (4 kg per fiscal year)');
        }
        break;

      case 'corporate_bond':
        if (!eligibility.eligibleProducts.bonds) {
          reasons.push('Bond trading not enabled');
          requirements.push('Complete bond trading activation');
        }
        break;

      case 'g_sec':
        if (!eligibility.eligibleProducts.gsec) {
          reasons.push('G-Sec trading not enabled');
          requirements.push('Complete RBI Retail Direct account linking');
        }
        break;

      case 'tax_free_bond':
        if (!eligibility.eligibleProducts.taxFreeBonds) {
          reasons.push('Tax-free bond trading not enabled');
        }
        break;

      case 'mld':
        if (!eligibility.eligibleProducts.mlDs) {
          reasons.push('MLD investment requires accredited investor status');
          requirements.push('Complete accredited investor verification');
        }
        break;
    }

    if (!eligibility.suitabilityCheckValid) {
      requirements.push('Complete suitability check before placing orders');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      requirements
    };
  }

  async getEligibilitySummary(userId: string): Promise<{
    overallStatus: 'not_started' | 'in_progress' | 'complete' | 'blocked';
    completionPercentage: number;
    steps: Array<{
      step: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      details?: string;
    }>;
    products: Array<{
      name: string;
      eligible: boolean;
      reason?: string;
    }>;
  }> {
    const eligibility = await this.checkFullEligibility(userId);

    const steps = [
      {
        step: 'KYC Verification',
        status: eligibility.kycStatus === 'not_verified' ? 'pending' as const : 
                (eligibility.kycStatus === 'basic' ? 'in_progress' as const : 'completed' as const),
        details: `Current level: ${eligibility.kycStatus}`
      },
      {
        step: 'Demat Account Linking',
        status: eligibility.dematStatus === 'not_linked' ? 'pending' as const :
                (eligibility.dematStatus === 'pending' ? 'in_progress' as const : 'completed' as const),
        details: `Status: ${eligibility.dematStatus}`
      },
      {
        step: 'UCC Registration',
        status: eligibility.uccStatus === 'not_created' ? 'pending' as const :
                (eligibility.uccStatus === 'pending' ? 'in_progress' as const :
                (eligibility.uccStatus === 'active' ? 'completed' as const : 'failed' as const)),
        details: `Status: ${eligibility.uccStatus}`
      },
      {
        step: 'Suitability Assessment',
        status: eligibility.suitabilityCheckValid ? 'completed' as const : 'pending' as const,
        details: eligibility.suitabilityCheckValid ? 'Valid suitability check on file' : 'Required before trading'
      }
    ];

    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const completionPercentage = Math.round((completedSteps / steps.length) * 100);

    const products = [
      { name: 'Corporate Bonds', eligible: eligibility.eligibleProducts.bonds },
      { name: 'NCDs', eligible: eligibility.eligibleProducts.ncds },
      { name: 'Sovereign Gold Bonds', eligible: eligibility.eligibleProducts.sgb },
      { name: 'Government Securities', eligible: eligibility.eligibleProducts.gsec },
      { name: 'Tax-Free Bonds', eligible: eligibility.eligibleProducts.taxFreeBonds },
      { name: 'Market Linked Debentures', eligible: eligibility.eligibleProducts.mlDs, reason: eligibility.eligibleProducts.mlDs ? undefined : 'Requires accredited investor status' }
    ];

    let overallStatus: 'not_started' | 'in_progress' | 'complete' | 'blocked';
    if (completionPercentage === 0) {
      overallStatus = 'not_started';
    } else if (completionPercentage === 100) {
      overallStatus = 'complete';
    } else if (steps.some(s => s.status === 'failed')) {
      overallStatus = 'blocked';
    } else {
      overallStatus = 'in_progress';
    }

    return {
      overallStatus,
      completionPercentage,
      steps,
      products
    };
  }

  private async logAuditEvent(
    userId: string,
    eventType: string,
    eventCategory: string,
    eventData: Record<string, any>
  ) {
    try {
      await db.insert(fixedIncomeAuditLog).values({
        userId,
        eventType,
        eventCategory,
        eventData,
        eventResult: 'success',
        eventSource: 'system',
        retentionExpiresAt: new Date(Date.now() + SEVEN_YEARS_MS)
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const fixedIncomeEligibility = new FixedIncomeEligibilityService();
