import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { panConsents, panConsentAuditLog, users } from "../../shared/schema";
import type { 
  InsertPanConsent, 
  PanConsent, 
  InsertPanConsentAuditLog,
  PanConsentAuditLog 
} from "../../shared/schema";
import crypto from "crypto";

interface ConsentRequest {
  userId: string;
  panNumber: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  consentVersion?: string;
}

interface AuditLogRequest {
  consentId: string;
  userId: string;
  action: string;
  actionDetails?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  apiEndpoint?: string;
  requestId?: string;
  accessReason?: string;
}

export class PANConsentService {
  private static readonly ENCRYPTION_KEY = process.env.PAN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  private static readonly ALGORITHM = 'aes-256-gcm';

  /**
   * Public async wrapper for PAN encryption
   * Use this for encrypting PAN in routes and external services
   */
  static async encryptPAN(panNumber: string): Promise<string> {
    return this.encryptPANInternal(panNumber);
  }

  /**
   * Public async wrapper for PAN decryption
   * Use this for decrypting PAN in routes and external services
   */
  static async decryptPAN(encryptedPAN: string): Promise<string> {
    return this.decryptPANInternal(encryptedPAN);
  }

  /**
   * Encrypt PAN number using AES-256-GCM (Internal)
   */
  private static encryptPANInternal(panNumber: string): string {
    try {
      const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(panNumber.toUpperCase(), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encrypting PAN:', error);
      throw new Error('Failed to encrypt PAN number');
    }
  }

  /**
   * Decrypt PAN number (Internal)
   */
  private static decryptPANInternal(encryptedPAN: string): string {
    try {
      const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');
      const parts = encryptedPAN.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted PAN format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      if (authTag.length !== 16) {
        throw new Error('Invalid authentication tag length');
      }
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, { authTagLength: 16 });
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting PAN:', error);
      throw new Error('Failed to decrypt PAN number');
    }
  }

  /**
   * Create SHA-256 hash of PAN for verification
   */
  private static hashPAN(panNumber: string): string {
    return crypto.createHash('sha256').update(panNumber.toUpperCase()).digest('hex');
  }

  /**
   * Validate PAN format (basic validation)
   */
  private static validatePANFormat(panNumber: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(panNumber.toUpperCase());
  }

  /**
   * Store PAN consent with encryption and audit logging
   */
  static async storePANConsent(request: ConsentRequest): Promise<PanConsent> {
    const { userId, panNumber, ipAddress, userAgent, sessionId, consentVersion = "1.0" } = request;

    // Validate PAN format
    if (!this.validatePANFormat(panNumber)) {
      throw new Error('Invalid PAN format. PAN should be in format: ABCDE1234F');
    }

    // Check if user already has active consent
    const existingConsent = await this.getActivePANConsent(userId);
    if (existingConsent) {
      throw new Error('User already has active PAN consent. Use update method to modify.');
    }

    try {
      const encryptedPan = this.encryptPANInternal(panNumber);
      const panHash = this.hashPAN(panNumber);

      const consentData: InsertPanConsent = {
        userId,
        encryptedPan,
        panHash,
        consentGiven: true,
        consentVersion,
        consentIPAddress: ipAddress,
        consentUserAgent: userAgent,
        consentPurpose: "Tax data aggregation and ITR filing services",
        dataRetentionPeriod: "7_years",
        isActive: true,
        kycVerified: false,
        panVerified: false,
      };

      const [newConsent] = await db.insert(panConsents).values(consentData).returning();

      // Log the consent creation
      await this.logPANAccess({
        consentId: newConsent.id,
        userId,
        action: "created",
        actionDetails: {
          consentVersion,
          purpose: consentData.consentPurpose,
          retentionPeriod: consentData.dataRetentionPeriod
        },
        ipAddress,
        userAgent,
        sessionId,
        accessReason: "Initial PAN consent collection"
      });

      return newConsent;
    } catch (error) {
      console.error('Error storing PAN consent:', error);
      throw new Error('Failed to store PAN consent');
    }
  }

  /**
   * Get active PAN consent for user
   */
  static async getActivePANConsent(userId: string): Promise<PanConsent | null> {
    try {
      const consent = await db.query.panConsents.findFirst({
        where: and(
          eq(panConsents.userId, userId),
          eq(panConsents.isActive, true)
        )
      });

      return consent || null;
    } catch (error) {
      console.error('Error getting PAN consent:', error);
      return null;
    }
  }

  /**
   * Get decrypted PAN for authorized operations
   */
  static async getDecryptedPAN(userId: string, requestId?: string, apiEndpoint?: string, accessReason?: string): Promise<string | null> {
    try {
      const consent = await this.getActivePANConsent(userId);
      if (!consent) {
        return null;
      }

      // Update last used timestamp and usage count
      const currentUsageCount = consent.usageCount || 0;
      await db.update(panConsents)
        .set({ 
          lastUsed: new Date(),
          usageCount: currentUsageCount + 1
        })
        .where(eq(panConsents.id, consent.id));

      // Log the PAN access
      await this.logPANAccess({
        consentId: consent.id,
        userId,
        action: "accessed",
        actionDetails: {
          usageCount: currentUsageCount + 1
        },
        apiEndpoint,
        requestId,
        accessReason: accessReason || "Tax service operation"
      });

      return this.decryptPANInternal(consent.encryptedPan);
    } catch (error) {
      console.error('Error getting decrypted PAN:', error);
      return null;
    }
  }

  /**
   * Verify if user has PAN consent
   */
  static async hasPANConsent(userId: string): Promise<boolean> {
    const consent = await this.getActivePANConsent(userId);
    return consent !== null && consent.consentGiven;
  }

  /**
   * Update PAN verification status
   */
  static async updatePANVerification(userId: string, verified: boolean, verificationSource?: string): Promise<void> {
    try {
      const consent = await this.getActivePANConsent(userId);
      if (!consent) {
        throw new Error('No active PAN consent found');
      }

      await db.update(panConsents)
        .set({
          panVerified: verified,
          verificationDate: verified ? new Date() : null,
          verificationSource: verificationSource || 'api'
        })
        .where(eq(panConsents.id, consent.id));

      // Log the verification update
      await this.logPANAccess({
        consentId: consent.id,
        userId,
        action: "verified",
        actionDetails: {
          verified,
          verificationSource
        },
        accessReason: "PAN verification update"
      });
    } catch (error) {
      console.error('Error updating PAN verification:', error);
      throw new Error('Failed to update PAN verification status');
    }
  }

  /**
   * Revoke PAN consent
   */
  static async revokePANConsent(userId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const consent = await this.getActivePANConsent(userId);
      if (!consent) {
        throw new Error('No active PAN consent found');
      }

      await db.update(panConsents)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revokedReason: reason || 'User requested revocation'
        })
        .where(eq(panConsents.id, consent.id));

      // Log the revocation
      await this.logPANAccess({
        consentId: consent.id,
        userId,
        action: "revoked",
        actionDetails: {
          reason: reason || 'User requested revocation'
        },
        ipAddress,
        userAgent,
        accessReason: "User consent revocation"
      });
    } catch (error) {
      console.error('Error revoking PAN consent:', error);
      throw new Error('Failed to revoke PAN consent');
    }
  }

  /**
   * Log PAN access for audit trail
   */
  static async logPANAccess(request: AuditLogRequest): Promise<void> {
    try {
      const auditData: InsertPanConsentAuditLog = {
        consentId: request.consentId,
        userId: request.userId,
        action: request.action,
        actionDetails: request.actionDetails || {},
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        sessionId: request.sessionId,
        apiEndpoint: request.apiEndpoint,
        requestId: request.requestId,
        accessReason: request.accessReason,
        dataMinimized: true
      };

      await db.insert(panConsentAuditLog).values(auditData);
    } catch (error) {
      console.error('Error logging PAN access:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Get audit log for user (for transparency)
   */
  static async getPANAuditLog(userId: string, limit = 50): Promise<PanConsentAuditLog[]> {
    try {
      return await db.query.panConsentAuditLog.findMany({
        where: eq(panConsentAuditLog.userId, userId),
        orderBy: (table, { desc }) => [desc(table.timestamp)],
        limit
      });
    } catch (error) {
      console.error('Error getting PAN audit log:', error);
      return [];
    }
  }

  /**
   * Get masked PAN for user display (secure client access)
   */
  static async getMaskedPANForUser(userId: string, requestId?: string): Promise<{
    maskedPan: string;
    panVerified: boolean;
    consentStatus: string;
    lastUsed?: Date;
    usageCount: number;
  } | null> {
    try {
      const consent = await this.getActivePANConsent(userId);
      
      if (!consent) {
        return null;
      }

      // Get the actual PAN to create proper mask
      const actualPan = this.decryptPANInternal(consent.encryptedPan);
      
      // Create masked version (show first 3 and last 2 characters)
      const maskedPan = actualPan.substring(0, 3) + 'X'.repeat(5) + actualPan.substring(8, 10);

      // Log this access
      await this.logPANAccess({
        consentId: consent.id,
        userId,
        action: "viewed_masked",
        actionDetails: {
          maskedView: true,
          accessType: "user_dashboard"
        },
        requestId,
        accessReason: "User viewing own PAN information"
      });

      return {
        maskedPan,
        panVerified: consent.panVerified || false,
        consentStatus: consent.isActive ? 'active' : 'inactive',
        lastUsed: consent.lastUsed || undefined,
        usageCount: consent.usageCount || 0
      };
    } catch (error) {
      console.error('Error getting masked PAN for user:', error);
      return null;
    }
  }

  /**
   * Get comprehensive PAN status for user (secure client access)
   */
  static async getPANStatusForUser(userId: string): Promise<{
    hasActivePan: boolean;
    maskedPan?: string;
    consentDetails?: {
      consentGiven: boolean;
      consentTimestamp: Date;
      consentVersion: string;
      panVerified: boolean;
      kycVerified: boolean;
      lastUsed?: Date;
      usageCount: number;
      dataRetentionPeriod: string;
    };
    compliance?: {
      isCompliant: boolean;
      needsRenewal: boolean;
      issues: string[];
    };
  }> {
    try {
      const consent = await this.getActivePANConsent(userId);
      
      if (!consent) {
        return { hasActivePan: false };
      }

      const maskedInfo = await this.getMaskedPANForUser(userId);
      const compliance = await this.checkConsentCompliance(userId);

      return {
        hasActivePan: true,
        maskedPan: maskedInfo?.maskedPan,
        consentDetails: {
          consentGiven: consent.consentGiven || false,
          consentTimestamp: consent.consentTimestamp,
          consentVersion: consent.consentVersion || "1.0",
          panVerified: consent.panVerified || false,
          kycVerified: consent.kycVerified || false,
          lastUsed: consent.lastUsed || undefined,
          usageCount: consent.usageCount || 0,
          dataRetentionPeriod: consent.dataRetentionPeriod || "7_years"
        },
        compliance: {
          isCompliant: compliance.isValid && compliance.complianceStatus === 'compliant',
          needsRenewal: compliance.needsRenewal,
          issues: compliance.issues
        }
      };
    } catch (error) {
      console.error('Error getting PAN status for user:', error);
      return { hasActivePan: false };
    }
  }

  /**
   * Verify user-specific data access (security middleware)
   */
  static async verifyUserDataAccess(requestingUserId: string, targetUserId: string): Promise<boolean> {
    // Users can only access their own PAN data
    return requestingUserId === targetUserId;
  }

  /**
   * Check consent validity and compliance
   */
  static async checkConsentCompliance(userId: string): Promise<{
    isValid: boolean;
    needsRenewal: boolean;
    complianceStatus: string;
    issues: string[];
  }> {
    try {
      const consent = await this.getActivePANConsent(userId);
      
      if (!consent) {
        return {
          isValid: false,
          needsRenewal: false,
          complianceStatus: 'no_consent',
          issues: ['No PAN consent found']
        };
      }

      const issues: string[] = [];
      let needsRenewal = false;

      // Check if consent is older than 3 years (compliance requirement)
      const consentAge = Date.now() - consent.consentTimestamp.getTime();
      const threeYears = 3 * 365 * 24 * 60 * 60 * 1000;
      
      if (consentAge > threeYears) {
        issues.push('Consent is older than 3 years');
        needsRenewal = true;
      }

      // Check if PAN is verified
      if (!consent.panVerified) {
        issues.push('PAN not verified');
      }

      const isValid = consent.isActive && consent.consentGiven && !consent.revokedAt;
      const complianceStatus = isValid && issues.length === 0 ? 'compliant' : 'needs_attention';

      return {
        isValid,
        needsRenewal,
        complianceStatus,
        issues
      };
    } catch (error) {
      console.error('Error checking consent compliance:', error);
      return {
        isValid: false,
        needsRenewal: false,
        complianceStatus: 'error',
        issues: ['Error checking compliance']
      };
    }
  }
}