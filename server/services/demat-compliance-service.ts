// @ts-nocheck
/**
 * Demat Compliance Service
 * 
 * Implements SEBI (Depositories and Participants) Regulations, 2018
 * 
 * Features:
 * - NSDL/CDSL depository integration compliance
 * - Depository Participant (DP) validation
 * - Beneficial Owner (BO) verification
 * - Transaction authorization compliance
 * - Pledge/Unpledge compliance
 * - Transmission and nomination compliance
 * - Corporate action processing compliance
 */

import { db } from '../db';
import { users, bondHoldings, bondOrders, complianceAuditTrail, sebiDepositoryParticipants } from '@shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ==================== TYPES ====================

export interface DematAccount {
  accountNumber: string;
  dpId: string;
  clientId: string;
  depository: 'NSDL' | 'CDSL';
  accountType: 'individual' | 'joint' | 'corporate' | 'huf' | 'trust';
  holderName: string;
  panNumber: string;
  status: 'active' | 'suspended' | 'frozen' | 'closed';
  kycStatus: 'verified' | 'pending' | 'rejected';
  nomineeRegistered: boolean;
  bankLinked: boolean;
  createdAt: Date;
  lastVerified: Date;
}

export interface DPValidationResult {
  valid: boolean;
  dpId: string;
  dpName: string;
  sebiRegistrationNumber: string;
  depositoryMembership: 'NSDL' | 'CDSL' | 'both';
  status: 'active' | 'suspended' | 'cancelled' | 'pending';
  errors: string[];
  warnings?: string[]; // Optional warnings for pending verifications
}

export interface TransactionAuthResult {
  authorized: boolean;
  transactionType: string;
  authorizationMethod: 'otp' | 'pin' | 'biometric' | 'edis';
  authorizationId: string;
  validUntil: Date;
  restrictions: string[];
}

export interface HoldingVerification {
  isin: string;
  quantity: number;
  freeBalance: number;
  pledgedQuantity: number;
  lockedQuantity: number;
  pendingTransfer: number;
  availableForSale: number;
  lastUpdated: Date;
}

export interface CorporateActionCompliance {
  actionType: 'dividend' | 'bonus' | 'split' | 'merger' | 'rights' | 'buyback';
  isin: string;
  recordDate: Date;
  exDate: Date;
  status: 'announced' | 'pending' | 'processed' | 'completed';
  benefitCredited: boolean;
  complianceStatus: 'compliant' | 'pending' | 'non_compliant';
}

// ==================== NSDL/CDSL DEPOSITORY CODES ====================

const DEPOSITORY_CODES = {
  NSDL: {
    name: 'National Securities Depository Limited',
    code: 'IN',
    dpIdPattern: /^IN[0-9]{6}$/,
    clientIdPattern: /^[0-9]{8}$/,
    accountPattern: /^IN[0-9]{6}[0-9]{8}$/
  },
  CDSL: {
    name: 'Central Depository Services Limited',
    code: '',
    dpIdPattern: /^[0-9]{8}$/,
    clientIdPattern: /^[0-9]{8}$/,
    accountPattern: /^[0-9]{16}$/
  }
};

// ==================== DEMAT COMPLIANCE SERVICE ====================

/**
 * NOTE: DP validation now uses the sebi_depository_participants database table exclusively.
 * The database is seeded with 45 SEBI-registered DPs (30 NSDL + 15 CDSL).
 * 
 * For production deployment:
 * 1. Sync DP data from SEBI/NSDL/CDSL APIs using the admin endpoints
 * 2. Use /api/compliance/dp-registry endpoints to manage the registry
 * 3. All DP validation queries the database - no in-memory fallback
 */

class DematComplianceService {
  
  /**
   * Validate Depository Participant registration against SEBI registry database
   * 
   * This method performs authoritative DP validation using the sebi_depository_participants table.
   * The table should be synced from official SEBI/NSDL/CDSL data sources.
   * 
   * Validation flow:
   * 1. Format validation (NSDL: IN + 6 digits, CDSL: 8 digits)
   * 2. Database lookup against sebi_depository_participants table
   * 3. Status check (active/suspended/cancelled)
   * 4. Audit logging for all validation attempts
   * 
   * PRODUCTION REQUIREMENTS:
   * - Implement scheduled sync job to populate sebi_depository_participants from SEBI/NSDL/CDSL APIs
   * - Admin endpoints available at /api/compliance/dp-registry for manual management
   * - DPs not in database will FAIL validation (fail-closed approach)
   */
  async validateDP(dpId: string): Promise<DPValidationResult> {
    const errors: string[] = [];
    
    // Step 1: Format validation
    const isNSDL = DEPOSITORY_CODES.NSDL.dpIdPattern.test(dpId);
    const isCDSL = DEPOSITORY_CODES.CDSL.dpIdPattern.test(dpId);
    
    if (!isNSDL && !isCDSL) {
      await this.logDematEvent('system', 'dp_validation_failed', {
        dpId,
        reason: 'Invalid DP ID format',
        isNSDL,
        isCDSL
      });
      
      return {
        valid: false,
        dpId,
        dpName: '',
        sebiRegistrationNumber: '',
        depositoryMembership: 'NSDL',
        status: 'cancelled',
        errors: ['Invalid DP ID format. NSDL format: IN + 6 digits, CDSL format: 8 digits']
      };
    }

    const detectedDepository = isNSDL ? 'NSDL' : 'CDSL';

    try {
      // Step 2: Database lookup against authoritative SEBI registry
      const dp = await db.select()
        .from(sebiDepositoryParticipants)
        .where(
          or(
            eq(sebiDepositoryParticipants.dpId, dpId),
            eq(sebiDepositoryParticipants.nsdlDpId, dpId),
            eq(sebiDepositoryParticipants.cdslDpId, dpId)
          )
        )
        .limit(1);

      if (dp.length === 0) {
        // DP not found in authoritative database - FAIL CLOSED
        console.error(`[Demat Compliance] DP ${dpId} not found in SEBI registry database. Validation FAILED.`);
        
        await this.logDematEvent('system', 'dp_validation_failed', {
          dpId,
          detectedDepository,
          reason: 'DP not found in SEBI registry database',
          requiresAdminAction: true,
          severity: 'high'
        });

        return {
          valid: false,
          dpId,
          dpName: '',
          sebiRegistrationNumber: '',
          depositoryMembership: detectedDepository,
          status: 'cancelled',
          errors: [
            `DP ${dpId} is not registered in the SEBI depository participants database.`,
            'Please ensure your DP is SEBI-registered and contact support if this is an error.'
          ]
        };
      }

      const dpRecord = dp[0];

      // Step 3: Status check
      if (dpRecord.status !== 'active') {
        await this.logDematEvent('system', 'dp_validation_failed', {
          dpId,
          dpName: dpRecord.dpName,
          status: dpRecord.status,
          statusReason: dpRecord.statusReason,
          reason: `DP status is ${dpRecord.status}`
        });

        return {
          valid: false,
          dpId,
          dpName: dpRecord.dpName,
          sebiRegistrationNumber: dpRecord.sebiRegistrationNumber,
          depositoryMembership: dpRecord.depository as 'NSDL' | 'CDSL' | 'both',
          status: dpRecord.status as 'active' | 'suspended' | 'cancelled',
          errors: [
            `DP ${dpRecord.dpName} is currently ${dpRecord.status}.`,
            dpRecord.statusReason || 'Please contact your DP for more information.'
          ]
        };
      }

      // Step 4: Successful validation
      await this.logDematEvent('system', 'dp_validation_success', {
        dpId,
        dpName: dpRecord.dpName,
        sebiRegistrationNumber: dpRecord.sebiRegistrationNumber,
        depository: dpRecord.depository,
        complianceScore: dpRecord.complianceScore,
        lastVerified: dpRecord.lastSebiVerification,
        valid: true
      });

      return {
        valid: true,
        dpId,
        dpName: dpRecord.dpName,
        sebiRegistrationNumber: dpRecord.sebiRegistrationNumber,
        depositoryMembership: dpRecord.depository as 'NSDL' | 'CDSL' | 'both',
        status: 'active',
        errors: []
      };

    } catch (error) {
      // Database error - fail with clear message
      console.error(`[Demat Compliance] Database error during DP validation:`, error);
      
      await this.logDematEvent('system', 'dp_validation_error', {
        dpId,
        detectedDepository,
        error: error instanceof Error ? error.message : 'Unknown database error',
        severity: 'critical'
      });

      return {
        valid: false,
        dpId,
        dpName: '',
        sebiRegistrationNumber: '',
        depositoryMembership: detectedDepository,
        status: 'cancelled',
        errors: [
          'Unable to verify DP registration due to a system error.',
          'Please try again later or contact support.'
        ]
      };
    }
  }

  /**
   * Validate demat account format and structure
   */
  async validateDematAccount(
    accountNumber: string,
    depository: 'NSDL' | 'CDSL'
  ): Promise<{ valid: boolean; errors: string[]; details?: DematAccount }> {
    const errors: string[] = [];
    const depositoryConfig = DEPOSITORY_CODES[depository];

    // Validate account format
    if (!depositoryConfig.accountPattern.test(accountNumber)) {
      errors.push(`Invalid ${depository} account format`);
    }

    // Extract DP ID and Client ID
    let dpId: string;
    let clientId: string;

    if (depository === 'NSDL') {
      dpId = accountNumber.substring(0, 8); // IN + 6 digits
      clientId = accountNumber.substring(8); // 8 digits
    } else {
      dpId = accountNumber.substring(0, 8);
      clientId = accountNumber.substring(8);
    }

    // Validate DP ID
    if (!depositoryConfig.dpIdPattern.test(dpId)) {
      errors.push('Invalid DP ID format');
    }

    // Validate Client ID
    if (!depositoryConfig.clientIdPattern.test(clientId)) {
      errors.push('Invalid Client ID format');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // In production, this would call depository API
    const dematAccount: DematAccount = {
      accountNumber,
      dpId,
      clientId,
      depository,
      accountType: 'individual',
      holderName: 'Verified Account',
      panNumber: 'XXXPX0000X',
      status: 'active',
      kycStatus: 'verified',
      nomineeRegistered: true,
      bankLinked: true,
      createdAt: new Date(),
      lastVerified: new Date()
    };

    return { valid: true, errors: [], details: dematAccount };
  }

  /**
   * Verify beneficial owner for a demat account
   */
  async verifyBeneficialOwner(
    userId: string,
    dematAccountNumber: string,
    panNumber: string
  ): Promise<{
    verified: boolean;
    matchScore: number;
    details: {
      nameMatch: boolean;
      panMatch: boolean;
      addressMatch: boolean;
      kycVerified: boolean;
    };
    errors: string[];
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        verified: false,
        matchScore: 0,
        details: {
          nameMatch: false,
          panMatch: false,
          addressMatch: false,
          kycVerified: false
        },
        errors: ['User not found']
      };
    }

    let matchScore = 0;
    const errors: string[] = [];

    // PAN match (using panNumber from schema)
    const panMatch = user.panNumber?.toUpperCase() === panNumber.toUpperCase();
    if (panMatch) matchScore += 40;
    else errors.push('PAN does not match user records');

    // KYC verification (using panVerifiedViaSmartKyc and aadhaarVerifiedViaSmartKyc from schema)
    const kycVerified = user.panVerifiedViaSmartKyc && user.aadhaarVerifiedViaSmartKyc;
    if (kycVerified) matchScore += 30;
    else errors.push('KYC verification incomplete');

    // Name verification would be done via depository API
    const nameMatch = true; // Simulated
    if (nameMatch) matchScore += 20;

    // Address verification
    const addressMatch = !!user.address;
    if (addressMatch) matchScore += 10;

    await this.logDematEvent(userId, 'bo_verification', {
      dematAccountNumber,
      verified: matchScore >= 70,
      matchScore
    });

    return {
      verified: matchScore >= 70,
      matchScore,
      details: {
        nameMatch,
        panMatch,
        addressMatch,
        kycVerified
      },
      errors
    };
  }

  /**
   * Authorize transaction for EDIS compliance
   */
  async authorizeTransaction(
    userId: string,
    transactionType: 'sale' | 'pledge' | 'unpledge' | 'transfer',
    isin: string,
    quantity: number,
    dematAccountNumber: string
  ): Promise<TransactionAuthResult> {
    const authorizationId = `EDIS-${nanoid(12)}`;
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 4); // 4 hour validity

    const restrictions: string[] = [];

    // Check if user has sufficient holdings
    const holdings = await db.select()
      .from(bondHoldings)
      .where(
        and(
          eq(bondHoldings.userId, userId),
          eq(bondHoldings.isin, isin),
          eq(bondHoldings.holdingStatus, 'active')
        )
      );

    const totalHolding = holdings.reduce((sum, h) => sum + (h.quantity || 0), 0);

    if (totalHolding < quantity) {
      restrictions.push(`Insufficient holdings: Available ${totalHolding}, Required ${quantity}`);
    }

    // Check for any locks or pledges
    // In production, this would query depository
    const lockedQuantity = 0; // Simulated
    if (totalHolding - lockedQuantity < quantity) {
      restrictions.push('Holdings are locked or pledged');
    }

    await this.logDematEvent(userId, 'transaction_authorization', {
      authorizationId,
      transactionType,
      isin,
      quantity,
      authorized: restrictions.length === 0
    });

    return {
      authorized: restrictions.length === 0,
      transactionType,
      authorizationMethod: 'edis',
      authorizationId,
      validUntil,
      restrictions
    };
  }

  /**
   * Verify holdings in demat account
   */
  async verifyHoldings(
    userId: string,
    isin: string
  ): Promise<HoldingVerification> {
    const holdings = await db.select()
      .from(bondHoldings)
      .where(
        and(
          eq(bondHoldings.userId, userId),
          eq(bondHoldings.isin, isin)
        )
      );

    const totalQuantity = holdings.reduce((sum, h) => sum + (h.quantity || 0), 0);
    
    // In production, query depository for pledge/lock status
    const pledgedQuantity = 0;
    const lockedQuantity = 0;
    const pendingTransfer = 0;
    const freeBalance = totalQuantity - pledgedQuantity - lockedQuantity - pendingTransfer;

    return {
      isin,
      quantity: totalQuantity,
      freeBalance,
      pledgedQuantity,
      lockedQuantity,
      pendingTransfer,
      availableForSale: freeBalance,
      lastUpdated: new Date()
    };
  }

  /**
   * Process corporate action compliance
   */
  async processCorporateAction(
    isin: string,
    actionType: CorporateActionCompliance['actionType'],
    recordDate: Date,
    exDate: Date
  ): Promise<CorporateActionCompliance> {
    // Find all holders of this ISIN as of record date
    const holders = await db.select()
      .from(bondHoldings)
      .where(eq(bondHoldings.isin, isin));

    // Log corporate action for compliance
    await this.logDematEvent('system', 'corporate_action', {
      isin,
      actionType,
      recordDate: recordDate.toISOString(),
      exDate: exDate.toISOString(),
      affectedHolders: holders.length
    });

    return {
      actionType,
      isin,
      recordDate,
      exDate,
      status: 'announced',
      benefitCredited: false,
      complianceStatus: 'pending'
    };
  }

  /**
   * Validate nominee registration compliance
   */
  async validateNomineeCompliance(userId: string): Promise<{
    compliant: boolean;
    nomineeRegistered: boolean;
    nomineeDetails?: {
      name: string;
      relationship: string;
      percentage: number;
    }[];
    requiredActions: string[];
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        compliant: false,
        nomineeRegistered: false,
        requiredActions: ['User verification required']
      };
    }

    const requiredActions: string[] = [];
    
    // Check if nominee is registered (using nomineeDetails from schema)
    const hasNominee = !!user.nomineeDetails;
    
    if (!hasNominee) {
      requiredActions.push('Register nominee for demat account');
      requiredActions.push('Submit nominee declaration form');
    }

    // Per SEBI regulations, nominee declaration is now mandatory
    // Parse nominee details from JSON field
    let nomineeDetails: { name: string; relationship: string; percentage: number }[] | undefined;
    if (hasNominee && user.nomineeDetails) {
      try {
        const parsed = typeof user.nomineeDetails === 'string' 
          ? JSON.parse(user.nomineeDetails) 
          : user.nomineeDetails;
        nomineeDetails = [{
          name: parsed.name || 'Registered Nominee',
          relationship: user.nomineeRelation || parsed.relationship || 'Not specified',
          percentage: parsed.percentage || 100
        }];
      } catch {
        nomineeDetails = [{
          name: 'Registered Nominee',
          relationship: user.nomineeRelation || 'Not specified',
          percentage: 100
        }];
      }
    }

    return {
      compliant: hasNominee,
      nomineeRegistered: hasNominee,
      nomineeDetails,
      requiredActions
    };
  }

  /**
   * Generate demat compliance report
   */
  async generateComplianceReport(userId: string): Promise<{
    userId: string;
    dematStatus: {
      accountLinked: boolean;
      dpVerified: boolean;
      nomineeRegistered: boolean;
      kycCompliant: boolean;
    };
    holdingsSummary: {
      totalSecurities: number;
      totalValue: number;
      pledgedValue: number;
    };
    complianceScore: number;
    issues: string[];
    lastAudit: Date;
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    const holdings = await db.select()
      .from(bondHoldings)
      .where(eq(bondHoldings.userId, userId));

    const issues: string[] = [];
    let score = 100;

    // Check account status (using nsdl/cdsl fields from schema)
    const accountLinked = !!(user?.nsdlDpId && user?.nsdlClientId) || !!(user?.cdslBoId && user?.cdslDpId);
    if (!accountLinked) {
      issues.push('Demat account not linked');
      score -= 25;
    }

    // Check DP verification (using nsdlDpId or cdslDpId from schema)
    const dpVerified = !!user?.nsdlDpId || !!user?.cdslDpId;
    if (!dpVerified) {
      issues.push('DP ID not verified');
      score -= 20;
    }

    // Check nominee (using nomineeDetails from schema)
    const nomineeRegistered = !!user?.nomineeDetails;
    if (!nomineeRegistered) {
      issues.push('Nominee not registered (mandatory as per SEBI)');
      score -= 15;
    }

    // Check KYC (using panVerifiedViaSmartKyc and aadhaarVerifiedViaSmartKyc from schema)
    const kycCompliant = user?.panVerifiedViaSmartKyc && user?.aadhaarVerifiedViaSmartKyc;
    if (!kycCompliant) {
      issues.push('KYC verification incomplete');
      score -= 20;
    }

    // Calculate holdings value
    const totalValue = holdings.reduce((sum, h) => 
      sum + parseFloat(h.currentValue || h.totalInvestedAmount || '0'), 0
    );

    await this.logDematEvent(userId, 'compliance_report', {
      score,
      issuesCount: issues.length
    });

    return {
      userId,
      dematStatus: {
        accountLinked,
        dpVerified,
        nomineeRegistered,
        kycCompliant: !!kycCompliant
      },
      holdingsSummary: {
        totalSecurities: holdings.length,
        totalValue,
        pledgedValue: 0 // Would be fetched from depository
      },
      complianceScore: Math.max(0, score),
      issues,
      lastAudit: new Date()
    };
  }

  /**
   * Log demat-related event to audit trail
   */
  private async logDematEvent(userId: string, action: string, details: any): Promise<void> {
    try {
      await db.insert(complianceAuditTrail).values({
        id: `DEMAT-${nanoid(12)}`,
        userId,
        action: `demat_${action}`,
        entityType: 'demat_compliance',
        entityId: userId,
        newValue: details,
        performedBy: 'system',
        performedByRole: 'compliance_system',
        complianceImpact: 'none'
      });
    } catch (error) {
      console.error('[Demat Compliance] Failed to log event:', error);
    }
  }
}

export const dematComplianceService = new DematComplianceService();
