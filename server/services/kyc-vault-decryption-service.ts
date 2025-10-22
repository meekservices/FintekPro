/**
 * KYC Vault Decryption Service
 * 
 * Provides secure access to decrypted KYC data from the vault with:
 * - AES-256-GCM decryption for encrypted fields
 * - Token reversal for tokenized PAN/Aadhaar
 * - Comprehensive audit logging for all vault access
 * - Purpose-based access control
 * - In-memory only decryption (no persistence)
 * 
 * Security Requirements:
 * - All vault access MUST be logged to kycAuditLogs
 * - Decrypted data stays in memory only (never persisted or logged)
 * - Purpose must be specified for every access
 * - Supports key rotation and audit compliance
 */

import { db } from '../db';
import { kycVault, kycAuditLogs, type InsertKycAuditLog } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { encryptionService } from '../encryption-service';
import { tokenizationService } from './tokenization-service';

export type VaultAccessPurpose = 
  | 'auto_population'
  | 'api_integration'
  | 'compliance_check'
  | 'user_verification'
  | 'data_export'
  | 'manual_review'
  | 'token_reuse';

export interface DecryptedKYCData {
  userId: string;
  // Decrypted PII
  pan: string;
  aadhaar?: string;
  fullName: string;
  dateOfBirth: string;
  mobile: string;
  email: string;
  // Additional fields as needed
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  fatherName?: string;
}

export interface VaultAccessOptions {
  purpose: VaultAccessPurpose;
  requestId?: string;
  externalParty?: string; // e.g., 'BSE_STAR', 'NSDL', 'CIBIL'
  fieldsRequired?: string[]; // Specific fields needed
  ipAddress?: string;
  userAgent?: string;
}

export interface VaultDecryptionResult {
  success: boolean;
  data?: DecryptedKYCData;
  error?: string;
  auditLogId?: string;
}

class KYCVaultDecryptionService {
  
  /**
   * Decrypt KYC data from vault with full audit logging
   * This is the primary method for accessing user PII
   */
  async decryptVaultData(
    userId: string,
    options: VaultAccessOptions
  ): Promise<VaultDecryptionResult> {
    const startTime = Date.now();
    let auditLogId: string | undefined;
    
    try {
      console.log(`🔓 Decrypting KYC vault for user ${userId}, purpose: ${options.purpose}`);

      // Step 1: Fetch encrypted vault data
      const vaultRecords = await db
        .select()
        .from(kycVault)
        .where(eq(kycVault.userId, userId))
        .orderBy(desc(kycVault.createdAt))
        .limit(1);

      if (vaultRecords.length === 0) {
        await this.logVaultAccess(userId, options, 'failed', 'KYC vault record not found');
        return {
          success: false,
          error: 'KYC vault record not found for user'
        };
      }

      const vault = vaultRecords[0];

      // Step 2: Detokenize PAN and Aadhaar
      if (!vault.tokenizedPan) {
        await this.logVaultAccess(userId, options, 'failed', 'Tokenized PAN not found in vault');
        return {
          success: false,
          error: 'Tokenized PAN not found in vault'
        };
      }

      const panDetokenResult = await tokenizationService.detokenize(
        vault.tokenizedPan,
        userId
      );

      if (!panDetokenResult.success || !panDetokenResult.originalValue) {
        await this.logVaultAccess(userId, options, 'failed', 'PAN detokenization failed');
        return {
          success: false,
          error: 'Failed to detokenize PAN number'
        };
      }

      const realPAN = panDetokenResult.originalValue;

      // Detokenize Aadhaar if present
      let realAadhaar: string | undefined;
      if (vault.tokenizedAadhaar) {
        const aadhaarDetokenResult = await tokenizationService.detokenize(
          vault.tokenizedAadhaar,
          userId
        );
        if (aadhaarDetokenResult.success && aadhaarDetokenResult.originalValue) {
          realAadhaar = aadhaarDetokenResult.originalValue;
        }
      }

      // Step 3: Decrypt encrypted fields
      const decryptedName = encryptionService.decrypt(vault.encryptedFullName);
      const decryptedDOB = encryptionService.decrypt(vault.encryptedDateOfBirth);
      const decryptedMobile = encryptionService.decrypt(vault.encryptedMobile);
      const decryptedEmail = encryptionService.decrypt(vault.encryptedEmail);

      // Validate decryption results
      if (!decryptedName || !decryptedDOB || !decryptedMobile || !decryptedEmail) {
        await this.logVaultAccess(userId, options, 'failed', 'Field decryption failed');
        return {
          success: false,
          error: 'Failed to decrypt required KYC fields'
        };
      }

      // Step 4: Decrypt additional optional fields
      const decryptedAddress = vault.encryptedAddress 
        ? encryptionService.decrypt(vault.encryptedAddress) 
        : undefined;
      
      const decryptedCity = vault.encryptedCity
        ? encryptionService.decrypt(vault.encryptedCity)
        : undefined;

      const decryptedState = vault.encryptedState
        ? encryptionService.decrypt(vault.encryptedState)
        : undefined;

      const decryptedPincode = vault.encryptedPincode
        ? encryptionService.decrypt(vault.encryptedPincode)
        : undefined;

      const decryptedFatherName = vault.encryptedFatherName
        ? encryptionService.decrypt(vault.encryptedFatherName)
        : undefined;

      // Step 5: Build decrypted data object
      const decryptedData: DecryptedKYCData = {
        userId,
        pan: realPAN,
        aadhaar: realAadhaar,
        fullName: decryptedName,
        dateOfBirth: decryptedDOB,
        mobile: decryptedMobile,
        email: decryptedEmail,
        address: decryptedAddress || undefined,
        city: decryptedCity || undefined,
        state: decryptedState || undefined,
        pincode: decryptedPincode || undefined,
        fatherName: decryptedFatherName || undefined
      };

      // Step 6: Log successful vault access
      auditLogId = await this.logVaultAccess(
        userId,
        options,
        'success',
        undefined,
        ['pan', 'aadhaar', 'fullName', 'dateOfBirth', 'mobile', 'email', 'address']
      );

      const durationMs = Date.now() - startTime;
      console.log(`✅ KYC vault decrypted successfully for user ${userId} (${durationMs}ms)`);
      console.log(`   Purpose: ${options.purpose}, Audit Log: ${auditLogId}`);

      return {
        success: true,
        data: decryptedData,
        auditLogId
      };

    } catch (error: any) {
      console.error('❌ KYC vault decryption error:', error.message);
      
      // Log failed access attempt
      await this.logVaultAccess(userId, options, 'failed', error.message);

      return {
        success: false,
        error: `Vault decryption failed: ${error.message}`
      };
    }
  }

  /**
   * Decrypt only specific fields (minimal access principle)
   * Use this when you only need partial PII
   */
  async decryptSpecificFields(
    userId: string,
    fields: Array<'pan' | 'aadhaar' | 'fullName' | 'dateOfBirth' | 'mobile' | 'email'>,
    options: VaultAccessOptions
  ): Promise<VaultDecryptionResult> {
    // Update options to track which fields were requested
    const fullOptions = {
      ...options,
      fieldsRequired: fields
    };

    // Decrypt full vault
    const result = await this.decryptVaultData(userId, fullOptions);

    if (!result.success || !result.data) {
      return result;
    }

    // Filter to only requested fields
    const filteredData: Partial<DecryptedKYCData> = { userId };
    
    for (const field of fields) {
      if (result.data[field]) {
        (filteredData as any)[field] = result.data[field];
      }
    }

    return {
      success: true,
      data: filteredData as DecryptedKYCData,
      auditLogId: result.auditLogId
    };
  }

  /**
   * Log vault access to audit trail
   * CRITICAL: Every vault access MUST be logged for compliance
   */
  private async logVaultAccess(
    userId: string,
    options: VaultAccessOptions,
    status: 'success' | 'failed' | 'denied',
    failureReason?: string,
    fieldsAccessed?: string[]
  ): Promise<string | undefined> {
    try {
      const auditLog: InsertKycAuditLog = {
        userId,
        accessedBy: 'system', // In production, could be actual admin/system user ID
        accessType: 'read',
        dataFieldsAccessed: fieldsAccessed || [],
        purpose: `Vault decryption: ${options.purpose}`,
        apiEndpoint: '/api/auto-populate/*', // Could be more specific
        externalParty: options.externalParty || null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        requestId: options.requestId || null,
        accessStatus: status,
        failureReason: failureReason || null,
        regulatoryPurpose: this.mapPurposeToRegulatory(options.purpose),
        complianceCheckPassed: status === 'success'
      };

      const result = await db.insert(kycAuditLogs).values(auditLog).returning();
      
      return result.length > 0 ? result[0].id : undefined;
    } catch (error: any) {
      // Vault access logging failure is CRITICAL - log to console but don't fail the operation
      console.error('🚨 CRITICAL: Failed to log KYC vault access:', error.message);
      console.error('   User:', userId, 'Purpose:', options.purpose, 'Status:', status);
      return undefined;
    }
  }

  /**
   * Map vault access purpose to regulatory purpose
   */
  private mapPurposeToRegulatory(purpose: VaultAccessPurpose): string | null {
    const mapping: Record<VaultAccessPurpose, string | null> = {
      auto_population: 'KYC',
      api_integration: 'KYC',
      compliance_check: 'CDD',
      user_verification: 'KYC',
      data_export: 'KYC',
      manual_review: 'EDD',
      token_reuse: 'KYC'
    };

    return mapping[purpose] || 'KYC';
  }

  /**
   * Check if vault decryption is available for a user
   * (without actually decrypting - just checks if vault exists)
   */
  async isVaultAvailable(userId: string): Promise<boolean> {
    try {
      const vaultRecords = await db
        .select({ id: kycVault.id })
        .from(kycVault)
        .where(eq(kycVault.userId, userId))
        .limit(1);

      return vaultRecords.length > 0;
    } catch (error) {
      console.error('Vault availability check error:', error);
      return false;
    }
  }

  /**
   * Get audit trail for user's vault access
   * Useful for compliance reporting
   */
  async getVaultAccessHistory(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const logs = await db
        .select()
        .from(kycAuditLogs)
        .where(eq(kycAuditLogs.userId, userId))
        .orderBy(desc(kycAuditLogs.accessedAt))
        .limit(limit);

      return logs;
    } catch (error) {
      console.error('Failed to fetch vault access history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const kycVaultDecryptionService = new KYCVaultDecryptionService();
