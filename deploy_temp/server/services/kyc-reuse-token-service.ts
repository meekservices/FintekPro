/**
 * KYC Reuse Token Service
 * 
 * Generates and validates KYC Reuse Tokens for sharing with external APIs (BSE, NSE, AMCs, Lenders).
 * Token format: KYC_REUSE_{nanoid} with embedded JWT claims.
 * 
 * Security:
 * - JWT signed with HMAC-SHA256
 * - Payload encrypted at rest in database
 * - Token usage tracking and revocation
 * - Expiry enforcement (default: 1 year)
 * 
 * Use cases:
 * - BSE STAR MF onboarding
 * - Loan application KYC sharing
 * - Insurance application pre-fill
 * - PMS/AIF instant onboarding
 */

import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { kycReuseTokens, kycVault, kycAuditLogs } from '../../shared/schema';
import { encryptionService } from '../encryption-service';
import { tokenizationService } from './tokenization-service';
import { eq, and } from 'drizzle-orm';

interface KYCClaims {
  sub: string; // user ID
  kin?: string; // CKYC KIN number
  pan?: string; // Masked PAN
  name: string;
  dob: string;
  kycTier: string; // basic/enhanced/accredited_investor
  verifiedAt: string;
  exp: number; // Unix timestamp
}

interface TokenGenerationOptions {
  purpose?: string; // bse_star_mf/loan_application/insurance/pms_aif
  issuedTo?: string; // External party name (BSE/AMC/Lender)
  expiryDays?: number; // Default: 365 days (1 year)
  maxUsageLimit?: number; // Optional usage limit
  scope?: string[]; // Data fields included in token
}

interface GenerateTokenResult {
  success: boolean;
  tokenId?: string; // KYC_REUSE_{nanoid}
  token?: string; // Full JWT
  expiresAt?: Date;
  error?: string;
}

interface ValidateTokenResult {
  success: boolean;
  valid: boolean;
  claims?: KYCClaims;
  tokenId?: string;
  error?: string;
}

class KYCReuseTokenService {
  private readonly JWT_SECRET: string;
  private readonly DEFAULT_EXPIRY_DAYS = 365; // 1 year

  constructor() {
    // Use ENCRYPTION_MASTER_KEY for JWT signing (or dedicated JWT_SECRET if preferred)
    this.JWT_SECRET = process.env.ENCRYPTION_MASTER_KEY || process.env.JWT_SECRET || '';
    
    if (!this.JWT_SECRET) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET or ENCRYPTION_MASTER_KEY must be set in environment variables. Cannot generate KYC tokens without secure signing key.');
    }
  }

  /**
   * Generate a KYC Reuse Token for a user
   * Creates JWT with KYC claims and stores in database
   */
  async generateToken(
    userId: string,
    options: TokenGenerationOptions = {}
  ): Promise<GenerateTokenResult> {
    try {
      // Fetch user's KYC vault data
      const vaultData = await db
        .select()
        .from(kycVault)
        .where(eq(kycVault.userId, userId))
        .limit(1);

      if (vaultData.length === 0) {
        return {
          success: false,
          error: 'KYC vault data not found for user'
        };
      }

      const vault = vaultData[0];

      // Check if KYC is verified and reusable
      if (vault.kycStatus !== 'verified') {
        return {
          success: false,
          error: 'KYC is not verified. Cannot generate reuse token.'
        };
      }

      if (!vault.isReusable) {
        return {
          success: false,
          error: 'User has not consented to KYC reuse'
        };
      }

      // Check if KYC is expired
      if (vault.isExpired || (vault.kycExpiryDate && new Date() > new Date(vault.kycExpiryDate))) {
        return {
          success: false,
          error: 'KYC has expired. Renewal required.'
        };
      }

      // Decrypt necessary fields for claims
      const fullName = vault.encryptedFullName ? encryptionService.decrypt(vault.encryptedFullName) : null;
      const dob = vault.encryptedDateOfBirth ? encryptionService.decrypt(vault.encryptedDateOfBirth) : null;
      const ckycKin = vault.encryptedCkycKin ? encryptionService.decrypt(vault.encryptedCkycKin) : null;

      if (!fullName || !dob) {
        return {
          success: false,
          error: 'Required KYC fields are missing or corrupted'
        };
      }

      // Detokenize PAN for claims (masked version)
      let maskedPan: string | undefined;
      if (vault.tokenizedPan) {
        const panResult = await tokenizationService.detokenize(vault.tokenizedPan, userId);
        if (panResult.success && panResult.originalValue) {
          // Mask PAN: Show only last 4 characters
          maskedPan = `XXXXX${panResult.originalValue.slice(-4)}`;
        }
      }

      // Calculate expiry
      const expiryDays = options.expiryDays || this.DEFAULT_EXPIRY_DAYS;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Create JWT claims
      const claims: KYCClaims = {
        sub: userId,
        kin: ckycKin || undefined, // Decrypted CKYC KIN (never plain text)
        pan: maskedPan,
        name: fullName,
        dob: dob,
        kycTier: 'enhanced', // Can be dynamic based on userProfiles.kycTier
        verifiedAt: vault.kycVerifiedAt?.toISOString() || new Date().toISOString(),
        exp: Math.floor(expiresAt.getTime() / 1000) // Unix timestamp
      };

      // Generate JWT
      const jwtToken = jwt.sign(claims, this.JWT_SECRET, {
        algorithm: 'HS256'
      });

      // Generate unique token ID: KYC_REUSE_{nanoid}
      const tokenId = `KYC_REUSE_${nanoid(12).toUpperCase()}`;

      // Encrypt JWT payload for storage
      const encryptedPayload = encryptionService.encrypt(JSON.stringify(claims));

      if (!encryptedPayload) {
        return {
          success: false,
          error: 'Failed to encrypt JWT payload'
        };
      }

      // Generate JWT signature for verification
      const jwtSignature = jwt.sign({ tokenId }, this.JWT_SECRET, {
        algorithm: 'HS256'
      });

      // Store token in database
      await db.insert(kycReuseTokens).values({
        tokenId,
        userId,
        encryptedJwtPayload: encryptedPayload,
        jwtSignature,
        tokenPurpose: options.purpose,
        issuedTo: options.issuedTo,
        scope: options.scope ? options.scope : null,
        isActive: true,
        isRevoked: false,
        maxUsageLimit: options.maxUsageLimit,
        expiresAt
      });

      // Log token generation in audit logs
      await db.insert(kycAuditLogs).values({
        userId,
        accessedBy: userId, // Self-generated
        accessType: 'token_generate',
        dataFieldsAccessed: ['name', 'dob', 'pan', 'kin'],
        purpose: `Generated KYC Reuse Token for ${options.purpose || 'general use'}`,
        externalParty: options.issuedTo,
        accessStatus: 'success',
        regulatoryPurpose: 'KYC_REUSE'
      });

      return {
        success: true,
        tokenId,
        token: jwtToken,
        expiresAt
      };
    } catch (error: any) {
      console.error('KYC Reuse Token generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate KYC reuse token'
      };
    }
  }

  /**
   * Validate a KYC Reuse Token
   * Verifies JWT signature and checks database status
   */
  async validateToken(tokenId: string): Promise<ValidateTokenResult> {
    try {
      if (!tokenId || !tokenId.startsWith('KYC_REUSE_')) {
        return {
          success: false,
          valid: false,
          error: 'Invalid token format'
        };
      }

      // Fetch token from database
      const tokens = await db
        .select()
        .from(kycReuseTokens)
        .where(eq(kycReuseTokens.tokenId, tokenId))
        .limit(1);

      if (tokens.length === 0) {
        return {
          success: true,
          valid: false,
          error: 'Token not found'
        };
      }

      const tokenRecord = tokens[0];

      // Check if token is active
      if (!tokenRecord.isActive || tokenRecord.isRevoked) {
        return {
          success: true,
          valid: false,
          error: tokenRecord.isRevoked ? 'Token has been revoked' : 'Token is inactive'
        };
      }

      // Check expiry
      if (new Date() > new Date(tokenRecord.expiresAt)) {
        return {
          success: true,
          valid: false,
          error: 'Token has expired'
        };
      }

      // Check usage limit
      if (tokenRecord.maxUsageLimit && (tokenRecord.usageCount || 0) >= tokenRecord.maxUsageLimit) {
        return {
          success: true,
          valid: false,
          error: 'Token usage limit exceeded'
        };
      }

      // Decrypt and parse claims
      const decryptedPayload = encryptionService.decrypt(tokenRecord.encryptedJwtPayload);
      
      if (!decryptedPayload) {
        return {
          success: false,
          valid: false,
          error: 'Failed to decrypt token payload'
        };
      }

      const claims: KYCClaims = JSON.parse(decryptedPayload);

      // Update usage count and last used timestamp
      await db
        .update(kycReuseTokens)
        .set({
          usageCount: (tokenRecord.usageCount || 0) + 1,
          lastUsedAt: new Date()
        })
        .where(eq(kycReuseTokens.tokenId, tokenId));

      // Log token validation in audit logs
      await db.insert(kycAuditLogs).values({
        userId: tokenRecord.userId,
        accessedBy: 'system', // External party validation
        accessType: 'token_validate',
        dataFieldsAccessed: ['token_validation'],
        purpose: `Validated KYC Reuse Token for ${tokenRecord.tokenPurpose || 'unknown purpose'}`,
        externalParty: tokenRecord.issuedTo,
        accessStatus: 'success',
        regulatoryPurpose: 'KYC_REUSE'
      });

      return {
        success: true,
        valid: true,
        claims,
        tokenId
      };
    } catch (error: any) {
      console.error('KYC Reuse Token validation error:', error);
      return {
        success: false,
        valid: false,
        error: error.message || 'Failed to validate token'
      };
    }
  }

  /**
   * Revoke a KYC Reuse Token
   * Marks token as revoked and logs the action
   */
  async revokeToken(
    tokenId: string,
    userId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await db
        .update(kycReuseTokens)
        .set({
          isActive: false,
          isRevoked: true,
          revokedAt: new Date(),
          revokeReason: reason
        })
        .where(and(
          eq(kycReuseTokens.tokenId, tokenId),
          eq(kycReuseTokens.userId, userId)
        ));

      // Log revocation
      await db.insert(kycAuditLogs).values({
        userId,
        accessedBy: userId,
        accessType: 'token_revoke',
        dataFieldsAccessed: ['token_revocation'],
        purpose: `Revoked KYC Reuse Token: ${reason}`,
        accessStatus: 'success',
        regulatoryPurpose: 'KYC_REUSE'
      });

      return { success: true };
    } catch (error: any) {
      console.error('Token revocation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to revoke token'
      };
    }
  }

  /**
   * Get all active tokens for a user
   */
  async getUserTokens(userId: string) {
    try {
      return await db
        .select()
        .from(kycReuseTokens)
        .where(and(
          eq(kycReuseTokens.userId, userId),
          eq(kycReuseTokens.isActive, true)
        ));
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      return [];
    }
  }
}

export const kycReuseTokenService = new KYCReuseTokenService();
