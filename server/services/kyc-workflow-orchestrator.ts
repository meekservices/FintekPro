// @ts-nocheck
/**
 * KYC Workflow Orchestrator
 * 
 * Coordinates the complete KYC verification and vault storage workflow:
 * 1. User Registration
 * 2. CKYC Lookup (check if KYC already exists)
 * 3. Cashfree OKYC (if CKYC not found - Aadhaar verification)
 * 4. CKYC Creation (submit to registry if needed)
 * 5. Vault Storage (encrypt & tokenize data)
 * 6. KYC Reuse Token Generation
 * 
 * This service ensures compliance with SEBI/RBI/PMLA KYC norms.
 */

import { db } from '../db';
import { kycVault, kycConsentLogs, users } from '../../shared/schema';
import { CashfreeAadhaarService } from './cashfree-aadhaar-service';
import { CKYCService } from '../ckyc-service';
import { tokenizationService } from './tokenization-service';
import { faceHashingService } from './face-hashing-service';
import { kycReuseTokenService } from './kyc-reuse-token-service';
import { encryptionService } from '../encryption-service';
import { kycVaultDecryptionService } from './kyc-vault-decryption-service';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';

interface OKYCData {
  aadhaarNumber: string;
  name: string;
  dob: string;
  gender: string;
  fatherName?: string;
  address: {
    house: string;
    street: string;
    landmark: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  mobile?: string;
  email?: string;
  photoUrl?: string;
}

interface WorkflowResult {
  success: boolean;
  step: string;
  kycStatus?: 'verified' | 'pending' | 'failed';
  ckycKinNumber?: string;
  kycReuseToken?: string;
  message?: string;
  error?: string;
  data?: any;
}

export class KYCWorkflowOrchestrator {
  private cashfreeService: typeof CashfreeAadhaarService;
  private ckycService: CKYCService;

  constructor() {
    this.cashfreeService = CashfreeAadhaarService;
    this.ckycService = new CKYCService();
  }

  /**
   * Step 1: Initiate OKYC - Generate OTP for Aadhaar verification
   */
  async initiateOKYC(aadhaarNumber: string): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 1: Initiating Cashfree OKYC...');

      const result = await this.cashfreeService.generateOTP(aadhaarNumber);

      if (!result.success) {
        return {
          success: false,
          step: 'okyc_initiate',
          error: result.message
        };
      }

      return {
        success: true,
        step: 'okyc_initiate',
        message: result.message,
        data: {
          refId: result.ref_id,
          maskedAadhaar: result.maskedAadhaar
        }
      };
    } catch (error: any) {
      console.error('OKYC initiation error:', error);
      return {
        success: false,
        step: 'okyc_initiate',
        error: error.message || 'Failed to initiate OKYC'
      };
    }
  }

  /**
   * Step 2: Verify OTP and retrieve Aadhaar data
   */
  async verifyOKYC(otp: string, refId: string): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 2: Verifying OTP and fetching Aadhaar data...');

      const result = await this.cashfreeService.verifyOTP(otp, refId);

      if (!result.success || !result.verified || !result.data) {
        return {
          success: false,
          step: 'okyc_verify',
          error: result.message
        };
      }

      return {
        success: true,
        step: 'okyc_verify',
        message: 'Aadhaar verified successfully',
        data: result.data
      };
    } catch (error: any) {
      console.error('OKYC verification error:', error);
      return {
        success: false,
        step: 'okyc_verify',
        error: error.message || 'Failed to verify OTP'
      };
    }
  }

  /**
   * Step 3: Check CKYC Registry
   * Lookup if user already has CKYC record
   */
  async checkCKYC(panNumber: string, aadhaarNumber?: string): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 3: Checking CKYC Registry...');

      const searchResult = await this.ckycService.searchCKYC({
        panNumber,
        aadharNumber: aadhaarNumber
      });

      if (searchResult.success && searchResult.found && searchResult.ckycNumber) {
        return {
          success: true,
          step: 'ckyc_lookup',
          message: 'CKYC record found',
          ckycKinNumber: searchResult.ckycNumber,
          data: searchResult
        };
      }

      return {
        success: true,
        step: 'ckyc_lookup',
        message: 'CKYC record not found - will create new',
        data: { found: false }
      };
    } catch (error: any) {
      console.error('CKYC lookup error:', error);
      return {
        success: false,
        step: 'ckyc_lookup',
        error: error.message || 'Failed to check CKYC registry'
      };
    }
  }

  /**
   * Step 4: Create CKYC Record (if not found)
   */
  async createCKYC(okycData: OKYCData, panNumber: string): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 4: Creating CKYC record...');

      const registrationResult = await this.ckycService.registerCKYC({
        firstName: okycData.name.split(' ')[0] || '',
        lastName: okycData.name.split(' ').slice(1).join(' ') || '',
        dateOfBirth: okycData.dob,
        gender: okycData.gender.toUpperCase() as 'M' | 'F' | 'T',
        nationality: 'Indian',
        panNumber,
        aadharNumber: okycData.aadhaarNumber,
        mobileNumber: okycData.mobile || '',
        emailAddress: okycData.email || '',
        addressLine1: `${okycData.address.house} ${okycData.address.street}`.trim(),
        addressLine2: okycData.address.landmark,
        city: okycData.address.city,
        state: okycData.address.state,
        pincode: okycData.address.pincode,
        country: okycData.address.country || 'India'
      });

      if (!registrationResult.success || !registrationResult.ckycNumber) {
        return {
          success: false,
          step: 'ckyc_create',
          error: registrationResult.message || 'Failed to create CKYC record'
        };
      }

      return {
        success: true,
        step: 'ckyc_create',
        message: 'CKYC record created successfully',
        ckycKinNumber: registrationResult.ckycNumber,
        data: registrationResult
      };
    } catch (error: any) {
      console.error('CKYC creation error:', error);
      return {
        success: false,
        step: 'ckyc_create',
        error: error.message || 'Failed to create CKYC record'
      };
    }
  }

  /**
   * Step 5: Store in KYC Vault with encryption & tokenization
   */
  async storeInVault(
    userId: string,
    okycData: OKYCData,
    panNumber: string,
    ckycKinNumber: string,
    cashfreeRefId: string
  ): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 5: Storing KYC data in secure vault...');

      // Encrypt personal data
      const encryptedFullName = encryptionService.encrypt(okycData.name);
      const encryptedDob = encryptionService.encrypt(okycData.dob);
      const encryptedGender = encryptionService.encrypt(okycData.gender);
      const encryptedFatherName = okycData.fatherName ? encryptionService.encrypt(okycData.fatherName) : null;
      
      // Encrypt address
      const fullAddress = `${okycData.address.house}, ${okycData.address.street}, ${okycData.address.locality}, ${okycData.address.city}, ${okycData.address.state}`;
      const encryptedAddress = encryptionService.encrypt(fullAddress);
      const encryptedCity = encryptionService.encrypt(okycData.address.city);
      const encryptedState = encryptionService.encrypt(okycData.address.state);
      const encryptedPincode = encryptionService.encrypt(okycData.address.pincode);
      
      // Encrypt contact info
      const encryptedMobile = okycData.mobile ? encryptionService.encrypt(okycData.mobile) : null;
      const encryptedEmail = okycData.email ? encryptionService.encrypt(okycData.email) : null;
      
      // Encrypt CKYC KIN (CRITICAL: Never store in plain text)
      const encryptedCkycKin = encryptionService.encrypt(ckycKinNumber);

      // Tokenize PAN, Aadhaar, CKYC KIN
      const tokenResults = await tokenizationService.tokenizeBatch([
        { value: panNumber, fieldType: 'pan' },
        { value: okycData.aadhaarNumber, fieldType: 'aadhaar' },
        { value: ckycKinNumber, fieldType: 'ckyc_kin' }
      ], userId);

      const tokenizedPan = tokenResults.get('pan') || null;
      const tokenizedAadhaar = tokenResults.get('aadhaar') || null;
      const tokenizedCkycKin = tokenResults.get('ckyc_kin') || null;

      // Hash face image if available
      let faceImageHash: string | null = null;
      if (okycData.photoUrl) {
        const hashResult = await faceHashingService.hashFaceImageFromUrl(okycData.photoUrl);
        faceImageHash = hashResult.success && hashResult.hash ? hashResult.hash : null;
      }

      // Calculate KYC expiry (2 years from now - SEBI norms)
      const kycExpiryDate = new Date();
      kycExpiryDate.setFullYear(kycExpiryDate.getFullYear() + 2);

      const kycNextRenewalDate = new Date(kycExpiryDate);
      kycNextRenewalDate.setDate(kycNextRenewalDate.getDate() - 30); // Remind 30 days before

      // Store in KYC Vault
      await db.insert(kycVault).values({
        userId,
        // Encrypted fields
        encryptedFullName,
        encryptedDateOfBirth: encryptedDob,
        encryptedGender,
        encryptedFatherName,
        encryptedAddress,
        encryptedCity,
        encryptedState,
        encryptedPincode,
        encryptedMobile,
        encryptedEmail,
        encryptedCkycKin, // CKYC KIN encrypted (NEVER plain text)
        // Tokenized fields
        tokenizedPan,
        tokenizedAadhaar,
        tokenizedCkycKin,
        aadhaarLast4: okycData.aadhaarNumber.slice(-4),
        // Hashed fields
        faceImageHash,
        faceImageHashAlgorithm: 'SHA-256',
        // Plain text status
        kycStatus: 'verified',
        ckycStatus: 'created',
        source: 'cashfree_okyc',
        verificationMethod: 'aadhaar_otp',
        isReusable: false, // Will be set to true after consent
        // CKYC metadata
        ckycRegistrationDate: new Date(),
        ckycExpiryDate: kycExpiryDate,
        ckycVerificationLevel: 'enhanced',
        // Verification metadata
        cashfreeRefId,
        aadhaarVerifiedAt: new Date(),
        panVerifiedAt: new Date(),
        addressVerifiedAt: new Date(),
        // Validity
        kycVerifiedAt: new Date(),
        kycExpiryDate,
        kycNextRenewalDate,
        isExpired: false
      });

      console.log('✅ KYC data stored securely in vault');

      return {
        success: true,
        step: 'vault_storage',
        message: 'KYC data stored successfully',
        kycStatus: 'verified',
        ckycKinNumber
      };
    } catch (error: any) {
      console.error('Vault storage error:', error);
      return {
        success: false,
        step: 'vault_storage',
        error: error.message || 'Failed to store KYC data'
      };
    }
  }

  /**
   * Validate Vault Storage
   * Verifies that stored KYC data can be retrieved and decrypted successfully
   */
  async validateVaultStorage(
    userId: string,
    expectedPAN: string,
    expectedName: string
  ): Promise<WorkflowResult> {
    try {
      console.log('🔍 Validating vault storage for user:', userId);

      // Read back vault data with decryption
      const decryptionResult = await kycVaultDecryptionService.decryptVaultData(userId, {
        purpose: 'compliance_check',
        requestId: `validation_${Date.now()}`,
        fieldsRequired: ['pan', 'fullName', 'dateOfBirth']
      });

      if (!decryptionResult.success || !decryptionResult.data) {
        return {
          success: false,
          step: 'vault_validation',
          error: 'Vault data could not be decrypted or retrieved'
        };
      }

      const decrypted = decryptionResult.data;

      // Verify critical fields match
      if (decrypted.pan !== expectedPAN) {
        return {
          success: false,
          step: 'vault_validation',
          error: 'PAN mismatch: vault data integrity check failed'
        };
      }

      if (decrypted.fullName !== expectedName) {
        return {
          success: false,
          step: 'vault_validation',
          error: 'Name mismatch: vault data integrity check failed'
        };
      }

      // Verify essential fields are present
      if (!decrypted.dateOfBirth || !decrypted.fullName || !decrypted.pan) {
        return {
          success: false,
          step: 'vault_validation',
          error: 'Missing essential fields in vault data'
        };
      }

      console.log(`✅ Vault validation successful for user ${userId} (Audit: ${decryptionResult.auditLogId})`);

      return {
        success: true,
        step: 'vault_validation',
        message: 'Vault data validated successfully'
      };

    } catch (error: any) {
      console.error('Vault validation error:', error);
      return {
        success: false,
        step: 'vault_validation',
        error: error.message || 'Vault validation failed'
      };
    }
  }

  /**
   * Step 6: Record user consent for KYC reuse
   */
  async recordConsent(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 6: Recording user consent...');

      const consentText = `I hereby consent to share my KYC data with authorized financial institutions and service providers for the purpose of account opening, investment processing, and regulatory compliance. I understand that my data will be encrypted and stored securely.`;

      // Create HMAC signature for consent — key must be set; never silently fall back
      const hmacKey = process.env.ENCRYPTION_MASTER_KEY;
      if (!hmacKey) throw new Error('ENCRYPTION_MASTER_KEY is not configured — cannot sign KYC consent');
      const consentSignature = createHmac('sha256', hmacKey)
        .update(JSON.stringify({ userId, consentText, timestamp: Date.now() }))
        .digest('hex');

      await db.insert(kycConsentLogs).values({
        userId,
        consentType: 'kyc_reuse',
        consentGiven: true,
        consentText,
        purpose: 'Enable KYC data sharing for financial services',
        ipAddress,
        userAgent,
        consentSignature,
        expiresAt: null // Consent doesn't expire
      });

      // Update vault to mark KYC as reusable
      await db
        .update(kycVault)
        .set({ isReusable: true })
        .where(eq(kycVault.userId, userId));

      console.log('✅ User consent recorded');

      return {
        success: true,
        step: 'consent_recording',
        message: 'Consent recorded successfully'
      };
    } catch (error: any) {
      console.error('Consent recording error:', error);
      return {
        success: false,
        step: 'consent_recording',
        error: error.message || 'Failed to record consent'
      };
    }
  }

  /**
   * Step 7: Generate KYC Reuse Token
   */
  async generateReuseToken(
    userId: string,
    purpose?: string,
    issuedTo?: string
  ): Promise<WorkflowResult> {
    try {
      console.log('🔄 Step 7: Generating KYC Reuse Token...');

      const tokenResult = await kycReuseTokenService.generateToken(userId, {
        purpose,
        issuedTo,
        expiryDays: 365 // 1 year validity
      });

      if (!tokenResult.success || !tokenResult.tokenId) {
        return {
          success: false,
          step: 'token_generation',
          error: tokenResult.error || 'Failed to generate KYC reuse token'
        };
      }

      console.log(`✅ KYC Reuse Token generated: ${tokenResult.tokenId}`);

      return {
        success: true,
        step: 'token_generation',
        message: 'KYC Reuse Token generated successfully',
        kycReuseToken: tokenResult.tokenId,
        data: {
          tokenId: tokenResult.tokenId,
          expiresAt: tokenResult.expiresAt
        }
      };
    } catch (error: any) {
      console.error('Token generation error:', error);
      return {
        success: false,
        step: 'token_generation',
        error: error.message || 'Failed to generate reuse token'
      };
    }
  }

  /**
   * Store Pre-Verified KYC Data (For Smart KYC Wizard)
   * Use this when OTP has already been verified and we have Aadhaar data
   * Skips the OKYC verification step and goes directly to vault storage
   */
  async storePreVerifiedKYCData(
    userId: string,
    panNumber: string,
    okycData: OKYCData,
    cashfreeRefId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WorkflowResult> {
    try {
      console.log('🚀 Starting pre-verified KYC storage workflow for user:', userId);

      // Step 1: Check CKYC Registry
      const ckycCheckResult = await this.checkCKYC(panNumber, okycData.aadhaarNumber);
      
      let ckycKinNumber: string;

      if (ckycCheckResult.data?.found && ckycCheckResult.ckycKinNumber) {
        // CKYC exists
        console.log('✅ Existing CKYC record found:', ckycCheckResult.ckycKinNumber);
        ckycKinNumber = ckycCheckResult.ckycKinNumber;
      } else {
        // Step 2: Create new CKYC record
        const ckycCreateResult = await this.createCKYC(okycData, panNumber);
        if (!ckycCreateResult.success || !ckycCreateResult.ckycKinNumber) {
          return ckycCreateResult;
        }
        ckycKinNumber = ckycCreateResult.ckycKinNumber;
      }

      // Step 3: Store in Vault
      const vaultResult = await this.storeInVault(
        userId,
        okycData,
        panNumber,
        ckycKinNumber,
        cashfreeRefId
      );
      
      if (!vaultResult.success) {
        return vaultResult;
      }

      // Step 3.5: Validate Vault Storage (prevent silent failures)
      const validationResult = await this.validateVaultStorage(userId, panNumber, okycData.name);
      if (!validationResult.success) {
        console.error(`❌ Vault validation failed: ${validationResult.error}`);
        return {
          success: false,
          step: 'vault_validation_failed',
          error: `Data stored but validation failed: ${validationResult.error}. Please contact support.`
        };
      }
      console.log('✅ Vault storage validated successfully');

      // Step 4: Record Consent
      const consentResult = await this.recordConsent(userId, ipAddress, userAgent);
      if (!consentResult.success) {
        console.warn('⚠️  Consent recording failed, but continuing...');
      }

      // Step 5: Generate Reuse Token
      const tokenResult = await this.generateReuseToken(
        userId,
        'smart_kyc_wizard',
        'FintekPro Platform'
      );

      console.log('🎉 Pre-verified KYC storage completed successfully!');

      return {
        success: true,
        step: 'workflow_complete',
        kycStatus: 'verified',
        ckycKinNumber,
        kycReuseToken: tokenResult.kycReuseToken,
        message: 'Smart KYC data stored successfully in vault',
        data: {
          okycVerified: true,
          ckycKinNumber,
          kycReuseToken: tokenResult.kycReuseToken,
          tokenExpiresAt: tokenResult.data?.expiresAt
        }
      };
    } catch (error: any) {
      console.error('❌ Pre-verified KYC storage error:', error);
      return {
        success: false,
        step: 'vault_storage_error',
        error: error.message || 'Failed to store pre-verified KYC data'
      };
    }
  }

  /**
   * Complete Workflow: Execute all steps end-to-end
   * This is the main orchestrator method
   */
  async executeCompleteWorkflow(
    userId: string,
    panNumber: string,
    aadhaarNumber: string,
    otp: string,
    refId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WorkflowResult> {
    try {
      console.log('🚀 Starting complete KYC workflow for user:', userId);

      // Step 1 & 2: Verify OKYC (already initiated, just verify)
      const okycResult = await this.verifyOKYC(otp, refId);
      if (!okycResult.success || !okycResult.data) {
        return okycResult;
      }

      const okycData = okycResult.data as OKYCData;

      // Step 3: Check CKYC Registry
      const ckycCheckResult = await this.checkCKYC(panNumber, aadhaarNumber);
      
      let ckycKinNumber: string;

      if (ckycCheckResult.data?.found && ckycCheckResult.ckycKinNumber) {
        // CKYC exists
        console.log('✅ Existing CKYC record found:', ckycCheckResult.ckycKinNumber);
        ckycKinNumber = ckycCheckResult.ckycKinNumber;
      } else {
        // Step 4: Create new CKYC record
        const ckycCreateResult = await this.createCKYC(okycData, panNumber);
        if (!ckycCreateResult.success || !ckycCreateResult.ckycKinNumber) {
          return ckycCreateResult;
        }
        ckycKinNumber = ckycCreateResult.ckycKinNumber;
      }

      // Step 5: Store in Vault
      const vaultResult = await this.storeInVault(
        userId,
        okycData,
        panNumber,
        ckycKinNumber,
        refId
      );
      
      if (!vaultResult.success) {
        return vaultResult;
      }

      // Step 5.5: Validate Vault Storage (prevent silent failures)
      const validationResult = await this.validateVaultStorage(userId, panNumber, okycData.name);
      if (!validationResult.success) {
        console.error(`❌ Vault validation failed: ${validationResult.error}`);
        return {
          success: false,
          step: 'vault_validation_failed',
          error: `Data stored but validation failed: ${validationResult.error}. Please contact support.`
        };
      }
      console.log('✅ Vault storage validated successfully');

      // Step 6: Record Consent
      const consentResult = await this.recordConsent(userId, ipAddress, userAgent);
      if (!consentResult.success) {
        console.warn('⚠️  Consent recording failed, but continuing...');
      }

      // Step 7: Generate Reuse Token
      const tokenResult = await this.generateReuseToken(
        userId,
        'general_use',
        'FintekPro Platform'
      );

      console.log('🎉 KYC workflow completed successfully!');

      return {
        success: true,
        step: 'workflow_complete',
        kycStatus: 'verified',
        ckycKinNumber,
        kycReuseToken: tokenResult.kycReuseToken,
        message: 'KYC verification and vault storage completed successfully',
        data: {
          okycVerified: true,
          ckycKinNumber,
          kycReuseToken: tokenResult.kycReuseToken,
          tokenExpiresAt: tokenResult.data?.expiresAt
        }
      };
    } catch (error: any) {
      console.error('❌ Complete workflow error:', error);
      return {
        success: false,
        step: 'workflow_error',
        error: error.message || 'Complete workflow failed'
      };
    }
  }

  /**
   * KYC Step Recovery: Detect interrupted flows and resume from last completed step
   * Returns the current progress state and guidance on next step
   */
  async getRecoveryState(userId: string): Promise<{
    hasInterruptedFlow: boolean;
    currentStep: string;
    completedSteps: string[];
    nextStep: string | null;
    canResume: boolean;
    resumeData: any;
    message: string;
  }> {
    try {
      console.log(`[KYC Recovery] Checking recovery state for user ${userId}`);

      // Check all KYC progress tables to find the current state
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return {
          hasInterruptedFlow: false,
          currentStep: 'not_started',
          completedSteps: [],
          nextStep: 'pan_verification',
          canResume: false,
          resumeData: null,
          message: 'User not found'
        };
      }

      // Check KYC Vault for completed KYC
      const [vaultRecord] = await db
        .select()
        .from(kycVault)
        .where(eq(kycVault.userId, userId));

      if (vaultRecord && vaultRecord.kycStatus === 'verified') {
        return {
          hasInterruptedFlow: false,
          currentStep: 'completed',
          completedSteps: ['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'ckyc_lookup', 'vault_storage', 'consent', 'token_generation'],
          nextStep: null,
          canResume: false,
          resumeData: null,
          message: 'KYC already completed'
        };
      }

      // Check for partial vault record (interrupted after vault but before completion)
      if (vaultRecord && vaultRecord.kycStatus !== 'verified') {
        const completedSteps = ['pan_verification', 'aadhaar_otp', 'aadhaar_verification'];
        
        if (vaultRecord.ckycKinNumber) {
          completedSteps.push('ckyc_lookup');
        }
        
        completedSteps.push('vault_storage');

        return {
          hasInterruptedFlow: true,
          currentStep: 'vault_stored',
          completedSteps,
          nextStep: 'consent',
          canResume: true,
          resumeData: {
            vaultId: vaultRecord.id,
            panTokenized: vaultRecord.panTokenized,
            ckycKinNumber: vaultRecord.ckycKinNumber
          },
          message: 'KYC was interrupted after vault storage. Can resume from consent step.'
        };
      }

      // Check consent logs - if consent exists but no vault, something is wrong
      const [consentLog] = await db
        .select()
        .from(kycConsentLogs)
        .where(eq(kycConsentLogs.userId, userId));

      if (consentLog && !vaultRecord) {
        return {
          hasInterruptedFlow: true,
          currentStep: 'consent_recorded',
          completedSteps: ['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'consent'],
          nextStep: 'vault_storage',
          canResume: false,
          resumeData: null,
          message: 'Consent recorded but vault storage failed. Requires re-verification.'
        };
      }

      // Check user record for partial completion indicators
      const userMeta = (user as any).kycMetadata || {};
      
      if (userMeta.okycRefId && !vaultRecord) {
        // OKYC was initiated but not completed
        const initiatedAt = userMeta.okycInitiatedAt;
        const hoursSinceInit = initiatedAt ? 
          (Date.now() - new Date(initiatedAt).getTime()) / (1000 * 60 * 60) : 0;

        if (hoursSinceInit > 24) {
          // OTP has expired, need to restart
          return {
            hasInterruptedFlow: true,
            currentStep: 'okyc_expired',
            completedSteps: ['pan_verification'],
            nextStep: 'aadhaar_otp',
            canResume: false,
            resumeData: null,
            message: 'OTP expired (>24 hours). Please restart Aadhaar verification.'
          };
        }

        return {
          hasInterruptedFlow: true,
          currentStep: 'aadhaar_otp_sent',
          completedSteps: ['pan_verification', 'aadhaar_otp'],
          nextStep: 'aadhaar_verification',
          canResume: true,
          resumeData: {
            refId: userMeta.okycRefId,
            maskedAadhaar: userMeta.maskedAadhaar,
            panNumber: user.panNumber
          },
          message: 'OTP was sent but not verified. Can resume from OTP verification.'
        };
      }

      // Check if PAN is verified but nothing else
      if (user.panNumber && !userMeta.okycRefId) {
        return {
          hasInterruptedFlow: (user as any).kycTier !== 'basic',
          currentStep: 'pan_verified',
          completedSteps: ['pan_verification'],
          nextStep: 'aadhaar_otp',
          canResume: true,
          resumeData: {
            panNumber: user.panNumber
          },
          message: 'PAN verified. Continue with Aadhaar verification.'
        };
      }

      // Fresh start
      return {
        hasInterruptedFlow: false,
        currentStep: 'not_started',
        completedSteps: [],
        nextStep: 'pan_verification',
        canResume: false,
        resumeData: null,
        message: 'No KYC progress found. Start fresh.'
      };

    } catch (error: any) {
      console.error('[KYC Recovery] Error checking recovery state:', error);
      return {
        hasInterruptedFlow: false,
        currentStep: 'error',
        completedSteps: [],
        nextStep: null,
        canResume: false,
        resumeData: null,
        message: `Error checking recovery state: ${error.message}`
      };
    }
  }

  /**
   * Resume an interrupted KYC workflow from the last completed step
   */
  async resumeWorkflow(
    userId: string,
    resumeData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WorkflowResult> {
    try {
      const recoveryState = await this.getRecoveryState(userId);

      if (!recoveryState.canResume) {
        return {
          success: false,
          step: 'resume_not_possible',
          error: recoveryState.message
        };
      }

      console.log(`[KYC Recovery] Resuming workflow for user ${userId} from step: ${recoveryState.currentStep}`);

      switch (recoveryState.currentStep) {
        case 'aadhaar_otp_sent':
          if (!resumeData.otp) {
            return {
              success: false,
              step: 'missing_otp',
              error: 'OTP is required to resume from this step',
              data: { refId: recoveryState.resumeData?.refId }
            };
          }
          
          // Verify OTP first
          const okycResult = await this.verifyOKYC(resumeData.otp, recoveryState.resumeData?.refId);
          if (!okycResult.success || !okycResult.data) {
            return okycResult;
          }
          
          // Continue with full workflow - CKYC lookup and vault storage
          const okycData = okycResult.data as any;
          const panNumber = resumeData.panNumber || recoveryState.resumeData?.panNumber;
          
          if (!panNumber) {
            return {
              success: false,
              step: 'missing_pan',
              error: 'PAN number is required to complete KYC'
            };
          }
          
          // Continue with storePreVerifiedKYCData which handles CKYC, vault, consent, and token
          return await this.storePreVerifiedKYCData(
            userId,
            panNumber,
            okycData,
            recoveryState.resumeData?.refId,
            ipAddress,
            userAgent
          );

        case 'vault_stored':
          const consentResult = await this.recordConsent(userId, ipAddress, userAgent);
          if (!consentResult.success) {
            console.warn('⚠️  Consent recording failed during resume');
          }
          
          const tokenResult = await this.generateReuseToken(userId, 'resume_flow', 'FintekPro Platform');
          
          return {
            success: true,
            step: 'workflow_complete',
            kycStatus: 'verified',
            ckycKinNumber: recoveryState.resumeData?.ckycKinNumber,
            kycReuseToken: tokenResult.kycReuseToken,
            message: 'KYC workflow resumed and completed successfully'
          };

        case 'pan_verified':
          if (!resumeData.aadhaarNumber) {
            return {
              success: false,
              step: 'missing_aadhaar',
              error: 'Aadhaar number is required to continue'
            };
          }
          return await this.initiateOKYC(resumeData.aadhaarNumber);

        default:
          return {
            success: false,
            step: 'unknown_state',
            error: `Cannot resume from state: ${recoveryState.currentStep}`
          };
      }
    } catch (error: any) {
      console.error('[KYC Recovery] Resume workflow error:', error);
      return {
        success: false,
        step: 'resume_error',
        error: error.message || 'Failed to resume workflow'
      };
    }
  }
}

export const kycWorkflowOrchestrator = new KYCWorkflowOrchestrator();
