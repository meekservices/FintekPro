// @ts-nocheck
/**
 * Mutual Fund Batch Credential Validator
 * 
 * SEBI (Mutual Funds) Regulations Compliance:
 * Before processing any batch of MF transactions, verify:
 * 1. Agent's ARN (AMFI Registration Number) is active
 * 2. EUIN (Employee Unique ID) is valid and linked to ARN
 * 3. ARN hasn't expired
 * 4. No regulatory sanctions on the distributor
 * 
 * This service acts as a gatekeeper for all MF batch submissions
 * to BSE Star MF platform.
 */

import { amfiValidationService, AmfiValidationResult, EuinValidationResult } from '../amfi-validation-service';
import { complianceMonitor } from '../compliance-monitor';
import { db } from '../db';
import { users, mfBatchValidationLogs, complianceAuditTrail } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

export interface BatchCredentialValidation {
  batchId: string;
  agentId: string;
  arnCode: string;
  euinCode?: string;
  transactionCount: number;
  totalAmount: number;
  productType: 'mutual_fund';
}

export interface CredentialValidationResult {
  isValid: boolean;
  arnValidation: AmfiValidationResult;
  euinValidation?: EuinValidationResult;
  warnings: string[];
  errors: string[];
  canProceed: boolean;
  requiresManualReview: boolean;
  validationTimestamp: Date;
  validUntil?: Date;
}

interface CachedValidation {
  result: CredentialValidationResult;
  timestamp: Date;
}

class MfBatchCredentialValidator {
  private validationCache: Map<string, CachedValidation> = new Map();
  private readonly CACHE_TTL_MINUTES = 60;

  constructor() {
    console.log('✅ MF Batch Credential Validator initialized');
  }

  async validateBatchCredentials(batch: BatchCredentialValidation): Promise<CredentialValidationResult> {
    const cacheKey = `${batch.arnCode}:${batch.euinCode || 'no-euin'}`;
    
    const cached = this.validationCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`[MFBatchValidator] Using cached validation for ARN ${batch.arnCode}`);
      
      complianceMonitor.logEvent({
        eventType: 'compliance',
        action: 'mf_batch_credential_check',
        resource: batch.batchId,
        outcome: cached.result.canProceed ? 'success' : 'failure',
        riskLevel: 'low',
        userId: batch.agentId,
        metadata: {
          arnCode: batch.arnCode,
          euinCode: batch.euinCode,
          fromCache: true,
          transactionCount: batch.transactionCount
        }
      });
      
      return cached.result;
    }

    const result = await this.performFullValidation(batch);

    this.validationCache.set(cacheKey, {
      result,
      timestamp: new Date()
    });

    await this.logValidation(batch, result);

    return result;
  }

  private async performFullValidation(batch: BatchCredentialValidation): Promise<CredentialValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let requiresManualReview = false;

    console.log(`[MFBatchValidator] Validating ARN: ${batch.arnCode}, EUIN: ${batch.euinCode || 'N/A'}`);

    const arnValidation = await amfiValidationService.validateArn(batch.arnCode);

    if (!arnValidation.isValid) {
      errors.push(`ARN validation failed: ${arnValidation.errorMessage}`);
    }

    if (arnValidation.distributorDetails) {
      if (arnValidation.distributorDetails.distributorStatus === 'suspended') {
        errors.push('ARN holder is currently suspended by AMFI');
      } else if (arnValidation.distributorDetails.distributorStatus === 'expired') {
        errors.push('ARN has expired - renewal required');
      } else if (arnValidation.distributorDetails.distributorStatus === 'inactive') {
        errors.push('ARN holder is currently inactive - cannot process transactions');
      } else if (arnValidation.distributorDetails.distributorStatus !== 'active') {
        errors.push(`ARN status is ${arnValidation.distributorDetails.distributorStatus} - must be active to proceed`);
      }

      if (arnValidation.distributorDetails.arnExpiryDate) {
        const expiryDate = new Date(arnValidation.distributorDetails.arnExpiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 0) {
          errors.push('ARN has expired');
        } else if (daysUntilExpiry <= 30) {
          warnings.push(`ARN expires in ${daysUntilExpiry} days - renewal recommended`);
        } else if (daysUntilExpiry <= 90) {
          warnings.push(`ARN expires in ${daysUntilExpiry} days`);
        }
      }
    }

    let euinValidation: EuinValidationResult | undefined;
    
    if (batch.euinCode) {
      euinValidation = await amfiValidationService.validateEuin(batch.euinCode, batch.arnCode);
      
      if (!euinValidation.isValid) {
        errors.push(`EUIN validation failed: ${euinValidation.errorMessage}`);
      }

      if (euinValidation.euinDetails && !euinValidation.euinDetails.isActive) {
        errors.push('EUIN is not active');
      }
    } else {
      if (batch.totalAmount > 50000) {
        warnings.push('EUIN not provided for transaction > ₹50,000 - may require declaration');
        requiresManualReview = true;
      }
    }

    if (batch.totalAmount > 10000000) {
      warnings.push('High-value batch (>₹1 Cr) - additional compliance checks recommended');
      requiresManualReview = true;
    }

    const canProceed = errors.length === 0;
    const validUntil = new Date();
    validUntil.setMinutes(validUntil.getMinutes() + this.CACHE_TTL_MINUTES);

    const result: CredentialValidationResult = {
      isValid: arnValidation.isValid && (!euinValidation || euinValidation.isValid),
      arnValidation,
      euinValidation,
      warnings,
      errors,
      canProceed,
      requiresManualReview,
      validationTimestamp: new Date(),
      validUntil
    };

    complianceMonitor.logEvent({
      eventType: 'compliance',
      action: 'mf_batch_credential_validation',
      resource: batch.batchId,
      outcome: canProceed ? 'success' : 'failure',
      riskLevel: errors.length > 0 ? 'high' : (warnings.length > 0 ? 'medium' : 'low'),
      userId: batch.agentId,
      metadata: {
        arnCode: batch.arnCode,
        euinCode: batch.euinCode,
        transactionCount: batch.transactionCount,
        totalAmount: batch.totalAmount,
        canProceed,
        errors,
        warnings
      }
    });

    console.log(`[MFBatchValidator] Validation complete: canProceed=${canProceed}, errors=${errors.length}, warnings=${warnings.length}`);

    return result;
  }

  private async logValidation(batch: BatchCredentialValidation, result: CredentialValidationResult): Promise<void> {
    try {
      const registryResponseSnapshot = {
        arnValidation: result.arnValidation,
        euinValidation: result.euinValidation
      };

      const registryResponseHash = crypto.createHash('sha256')
        .update(JSON.stringify(registryResponseSnapshot))
        .digest('hex');

      const [inserted] = await db.insert(mfBatchValidationLogs).values({
        batchId: batch.batchId,
        agentId: batch.agentId,
        arnCode: batch.arnCode,
        euinCode: batch.euinCode || null,
        productType: batch.productType,
        transactionCount: batch.transactionCount,
        totalAmount: batch.totalAmount.toString(),
        arnValid: result.arnValidation.isValid,
        arnStatus: result.arnValidation.distributorDetails?.distributorStatus || 'unknown',
        arnExpiryDate: result.arnValidation.distributorDetails?.arnExpiryDate?.toString() || null,
        euinValid: result.euinValidation?.isValid || null,
        euinActive: result.euinValidation?.euinDetails?.isActive || null,
        canProceed: result.canProceed,
        requiresManualReview: result.requiresManualReview,
        blockingReason: result.errors.length > 0 ? result.errors.join('; ') : null,
        warnings: result.warnings,
        errors: result.errors,
        registryResponseHash,
        registryResponseSnapshot,
        validationSource: 'amfi_mock'
      }).returning();

      await db.insert(complianceAuditTrail).values({
        userId: batch.agentId,
        action: result.canProceed ? 'approved' : 'blocked',
        entityType: 'mf_batch_validation',
        entityId: inserted.id,
        newValue: {
          batchId: batch.batchId,
          arnCode: batch.arnCode,
          canProceed: result.canProceed,
          errorCount: result.errors.length,
          warningCount: result.warnings.length
        },
        performedBy: batch.agentId,
        performedByRole: 'agent',
        riskImpact: result.canProceed ? 'low' : 'medium',
        complianceImpact: result.canProceed ? 'none' : 'major'
      });

      console.log('[MFBatchValidator] Validation persisted:', {
        logId: inserted.id,
        batchId: batch.batchId,
        canProceed: result.canProceed
      });
    } catch (error) {
      console.error('[MFBatchValidator] Failed to persist validation log:', error);
    }
  }

  private isCacheValid(timestamp: Date): boolean {
    const now = Date.now();
    const cacheAge = now - timestamp.getTime();
    const maxAge = this.CACHE_TTL_MINUTES * 60 * 1000;
    return cacheAge < maxAge;
  }

  async preflightCheck(agentId: string): Promise<{
    ready: boolean;
    arnCode?: string;
    euinCode?: string;
    message: string;
  }> {
    try {
      const [agent] = await db.select()
        .from(users)
        .where(eq(users.id, agentId))
        .limit(1);

      if (!agent) {
        return { ready: false, message: 'Agent not found' };
      }

      const arnCode = (agent as any).arnCode;
      const euinCode = (agent as any).euinCode;

      if (!arnCode) {
        return { ready: false, message: 'Agent does not have an ARN configured. Please update credentials.' };
      }

      const arnValidation = await amfiValidationService.validateArn(arnCode);
      
      if (!arnValidation.isValid) {
        return { 
          ready: false, 
          arnCode,
          message: `ARN validation failed: ${arnValidation.errorMessage}` 
        };
      }

      if (arnValidation.distributorDetails?.distributorStatus !== 'active') {
        return {
          ready: false,
          arnCode,
          message: `ARN is not active (status: ${arnValidation.distributorDetails?.distributorStatus})`
        };
      }

      return {
        ready: true,
        arnCode,
        euinCode,
        message: 'Agent credentials verified and ready for MF transactions'
      };
    } catch (error) {
      console.error('[MFBatchValidator] Preflight check error:', error);
      return { ready: false, message: 'Failed to verify credentials' };
    }
  }

  getValidationStatus(): {
    cacheSize: number;
    validCacheEntries: number;
    expiredCacheEntries: number;
  } {
    let validCount = 0;
    let expiredCount = 0;
    
    for (const [, cached] of this.validationCache) {
      if (this.isCacheValid(cached.timestamp)) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      cacheSize: this.validationCache.size,
      validCacheEntries: validCount,
      expiredCacheEntries: expiredCount
    };
  }

  clearCache(): void {
    this.validationCache.clear();
    console.log('[MFBatchValidator] Validation cache cleared');
  }
}

export const mfBatchCredentialValidator = new MfBatchCredentialValidator();
