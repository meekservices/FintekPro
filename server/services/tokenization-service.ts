/**
 * Tokenization Service for PAN/Aadhaar/CKYC KIN
 * 
 * Provides format-preserving tokenization with reversible mapping.
 * Tokens can be detokenized by authorized services only.
 * 
 * Security:
 * - Original values are AES-256-GCM encrypted before storage
 * - Tokens are randomly generated but preserve format hints
 * - Mapping table has strict access controls
 */

import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { kycTokenMap } from '../../shared/schema';
import { encryptionService } from '../encryption-service';
import { eq, and } from 'drizzle-orm';

type TokenFieldType = 'pan' | 'aadhaar' | 'ckyc_kin';

interface TokenizationResult {
  success: boolean;
  token?: string;
  error?: string;
}

interface DetokenizationResult {
  success: boolean;
  originalValue?: string;
  error?: string;
}

class TokenizationService {
  
  /**
   * Tokenize a value (PAN/Aadhaar/CKYC KIN)
   * Generates a unique token and stores encrypted mapping
   */
  async tokenize(
    originalValue: string,
    fieldType: TokenFieldType,
    userId: string
  ): Promise<TokenizationResult> {
    try {
      if (!originalValue || !fieldType || !userId) {
        return {
          success: false,
          error: 'Missing required parameters for tokenization'
        };
      }

      // Generate format-preserving token based on field type
      const token = this.generateToken(fieldType, originalValue);
      
      // Encrypt the original value before storing
      const encryptedValue = encryptionService.encrypt(originalValue);
      
      if (!encryptedValue) {
        return {
          success: false,
          error: 'Failed to encrypt original value'
        };
      }

      // Store token mapping
      await db.insert(kycTokenMap).values({
        token,
        encryptedOriginalValue: encryptedValue,
        fieldType,
        userId,
        expiresAt: null // Tokens don't expire by default for KYC data
      });

      return {
        success: true,
        token
      };
    } catch (error: any) {
      console.error('Tokenization error:', error);
      return {
        success: false,
        error: error.message || 'Failed to tokenize value'
      };
    }
  }

  /**
   * Detokenize a token back to original value
   * Only for authorized access with audit logging
   */
  async detokenize(
    token: string,
    userId: string
  ): Promise<DetokenizationResult> {
    try {
      if (!token || !userId) {
        return {
          success: false,
          error: 'Missing required parameters for detokenization'
        };
      }

      // Fetch token mapping
      const mappings = await db
        .select()
        .from(kycTokenMap)
        .where(and(
          eq(kycTokenMap.token, token),
          eq(kycTokenMap.userId, userId)
        ))
        .limit(1);

      if (mappings.length === 0) {
        return {
          success: false,
          error: 'Token not found or access denied'
        };
      }

      const mapping = mappings[0];

      // Check expiry if set
      if (mapping.expiresAt && new Date() > new Date(mapping.expiresAt)) {
        return {
          success: false,
          error: 'Token has expired'
        };
      }

      // Decrypt the original value
      const originalValue = encryptionService.decrypt(mapping.encryptedOriginalValue);

      if (!originalValue) {
        return {
          success: false,
          error: 'Failed to decrypt original value'
        };
      }

      return {
        success: true,
        originalValue
      };
    } catch (error: any) {
      console.error('Detokenization error:', error);
      return {
        success: false,
        error: error.message || 'Failed to detokenize value'
      };
    }
  }

  /**
   * Generate format-preserving token based on field type
   * Tokens look similar to original format but are randomly generated
   */
  private generateToken(fieldType: TokenFieldType, originalValue: string): string {
    const randomId = nanoid(16); // 16-character random string
    
    switch (fieldType) {
      case 'pan':
        // PAN format: XXXXX9999X (5 letters, 4 digits, 1 letter)
        // Token format: TKN{random}PAN
        return `TKN${randomId.substring(0, 6).toUpperCase()}PAN`;
        
      case 'aadhaar': {
        // Aadhaar format: 12 digits
        // Token format: TKN{random_12_digits}
        // Use crypto.randomInt (CSPRNG) — Math.random() is predictable and unsafe for PII tokens
        const randomDigits = Array.from({ length: 12 }, () =>
          crypto.randomInt(0, 10)
        ).join('');
        return `TKN${randomDigits}`;
      }
        
      case 'ckyc_kin':
        // CKYC KIN format: Varies, typically alphanumeric
        // Token format: CKYC_TKN_{random}
        return `CKYC_TKN_${randomId.toUpperCase()}`;
        
      default:
        // Generic token
        return `TKN_${randomId.toUpperCase()}`;
    }
  }

  /**
   * Batch tokenization for multiple fields
   * Useful when tokenizing full user profile
   */
  async tokenizeBatch(
    values: Array<{ value: string; fieldType: TokenFieldType }>,
    userId: string
  ): Promise<Map<TokenFieldType, string>> {
    const tokenMap = new Map<TokenFieldType, string>();

    for (const { value, fieldType } of values) {
      if (!value) continue;

      const result = await this.tokenize(value, fieldType, userId);
      if (result.success && result.token) {
        tokenMap.set(fieldType, result.token);
      }
    }

    return tokenMap;
  }

  /**
   * Hash a value for search purposes (one-way, no detokenization)
   * Used for quick lookups without exposing original value
   */
  hashForSearch(value: string): string {
    return encryptionService.hashForSearch(value);
  }

  /**
   * Check if a token exists and is valid
   */
  async isTokenValid(token: string, userId: string): Promise<boolean> {
    try {
      const mappings = await db
        .select()
        .from(kycTokenMap)
        .where(and(
          eq(kycTokenMap.token, token),
          eq(kycTokenMap.userId, userId)
        ))
        .limit(1);

      if (mappings.length === 0) return false;

      const mapping = mappings[0];

      // Check expiry
      if (mapping.expiresAt && new Date() > new Date(mapping.expiresAt)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Delete a token (e.g., when user updates their KYC)
   * Old tokens should be removed when new ones are generated
   */
  async deleteToken(token: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(kycTokenMap)
        .where(and(
          eq(kycTokenMap.token, token),
          eq(kycTokenMap.userId, userId)
        ));

      return true;
    } catch (error) {
      console.error('Token deletion error:', error);
      return false;
    }
  }
}

export const tokenizationService = new TokenizationService();
