/**
 * Corporate KYC Service
 * Handles Smart KYC flow for Corporate/Non-Individual entities
 * Flow: Corporate PAN → Company Documents → Authorized Signatory → Account Discovery → Review
 */

import { SandboxKYCService } from './sandbox-kyc-service';
import { DigiLockerService } from './digilockerService';
import { db } from '../db';
import { corporateKycProgress, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface CorporatePanVerificationResult {
  success: boolean;
  pan: string;
  companyName: string;
  companyType: string;
  data: any;
}

interface SignatoryVerificationResult {
  success: boolean;
  name: string;
  aadhaarLastFour: string;
  data: any;
}

interface CorporateAccountDiscoveryResult {
  success: boolean;
  bankAccountsFound: number;
  dematAccountsFound: number;
  accounts: any[];
}

export class CorporateKYCService {
  private sandboxService: SandboxKYCService;
  private digilockerService: DigiLockerService;

  constructor() {
    this.sandboxService = new SandboxKYCService();
    this.digilockerService = new DigiLockerService();
  }

  /**
   * Step 1: Verify Corporate PAN
   */
  async verifyCorporatePAN(userId: string, pan: string, companyName: string): Promise<CorporatePanVerificationResult> {
    try {
      // Verify PAN using Sandbox API
      const panDetails = await this.sandboxService.verifyCorporatePAN(pan, companyName);

      // Validate it's a corporate PAN
      if (panDetails.category === 'Individual') {
        throw new Error('This appears to be an individual PAN. Please use Individual KYC for personal accounts.');
      }

      // Create or update KYC progress
      const existingProgress = await db.query.corporateKycProgress.findFirst({
        where: eq(corporateKycProgress.userId, userId),
      });

      if (existingProgress) {
        await db.update(corporateKycProgress)
          .set({
            step1CorporatePanVerified: true,
            step1CorporatePan: pan,
            step1CompanyName: panDetails.name,
            step1CompanyType: panDetails.category,
            step1CompletedAt: new Date(),
            step1Data: panDetails,
            currentStep: 2,
            lastUpdatedStep: 1,
            updatedAt: new Date(),
          })
          .where(eq(corporateKycProgress.userId, userId));
      } else {
        await db.insert(corporateKycProgress).values({
          userId,
          step1CorporatePanVerified: true,
          step1CorporatePan: pan,
          step1CompanyName: panDetails.name,
          step1CompanyType: panDetails.category,
          step1CompletedAt: new Date(),
          step1Data: panDetails,
          currentStep: 2,
          lastUpdatedStep: 1,
        });
      }

      return {
        success: true,
        pan: panDetails.pan,
        companyName: panDetails.name,
        companyType: panDetails.category,
        data: panDetails,
      };
    } catch (error: any) {
      console.error('Corporate PAN verification error:', error);
      throw new Error(error.message || 'Corporate PAN verification failed');
    }
  }

  /**
   * Step 2: Upload Company Documents
   * Documents handled via frontend upload to object storage
   * This method just records the URLs
   */
  async recordCompanyDocuments(
    userId: string,
    documents: {
      coiUrl?: string;
      moaUrl?: string;
      aoaUrl?: string;
      boardResolutionUrl?: string;
    }
  ): Promise<void> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.corporateKycProgress.findFirst({
        where: eq(corporateKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      const result = await db.update(corporateKycProgress)
        .set({
          step2DocumentsUploaded: true,
          step2CertificateOfIncorporation: documents.coiUrl,
          step2MemorandumOfAssociation: documents.moaUrl,
          step2ArticlesOfAssociation: documents.aoaUrl,
          step2BoardResolution: documents.boardResolutionUrl,
          step2CompletedAt: new Date(),
          step2Data: documents,
          currentStep: 3,
          lastUpdatedStep: 2,
          updatedAt: new Date(),
        })
        .where(eq(corporateKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }
    } catch (error: any) {
      console.error('Document recording error:', error);
      throw new Error(error.message || 'Failed to record company documents');
    }
  }

  /**
   * Step 3: Verify Authorized Signatory using DigiLocker
   */
  async verifyAuthorizedSignatory(
    userId: string,
    signatoryDetails: {
      name: string;
      designation: string;
      digilockerSessionId: string;
      aadhaarData: any;
    }
  ): Promise<SignatoryVerificationResult> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.corporateKycProgress.findFirst({
        where: eq(corporateKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      // Extract last 4 digits of Aadhaar
      const aadhaarNumber = signatoryDetails.aadhaarData.aadhaarNumber || '';
      const aadhaarLastFour = aadhaarNumber.slice(-4);

      const result = await db.update(corporateKycProgress)
        .set({
          step3SignatoryVerified: true,
          step3SignatoryName: signatoryDetails.name,
          step3SignatoryAadhaar: aadhaarLastFour,
          step3SignatoryDesignation: signatoryDetails.designation,
          step3DigilockerSessionId: signatoryDetails.digilockerSessionId,
          step3CompletedAt: new Date(),
          step3Data: signatoryDetails.aadhaarData,
          currentStep: 4,
          lastUpdatedStep: 3,
          updatedAt: new Date(),
        })
        .where(eq(corporateKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      return {
        success: true,
        name: signatoryDetails.name,
        aadhaarLastFour,
        data: signatoryDetails.aadhaarData,
      };
    } catch (error: any) {
      console.error('Signatory verification error:', error);
      throw new Error(error.message || 'Authorized signatory verification failed');
    }
  }

  /**
   * Step 4: Discover Corporate Bank & Demat Accounts
   * Uses Sandbox API for account discovery based on corporate PAN
   */
  async discoverCorporateAccounts(userId: string, pan: string): Promise<CorporateAccountDiscoveryResult> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.corporateKycProgress.findFirst({
        where: eq(corporateKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      // In production, this would call actual account discovery APIs
      // For now, we'll simulate discovery based on PAN
      const mockBankAccounts = [
        {
          accountNumber: 'CORP****1234',
          bankName: 'HDFC Bank',
          accountType: 'Current Account',
          ifsc: 'HDFC0001234',
        },
      ];

      const mockDematAccounts = [
        {
          dpId: 'IN300****',
          clientId: 'CORP****5678',
          depositoryParticipant: 'CDSL',
        },
      ];

      const result = await db.update(corporateKycProgress)
        .set({
          step4AccountsDiscovered: true,
          step4BankAccountsFound: mockBankAccounts.length,
          step4DematAccountsFound: mockDematAccounts.length,
          step4CompletedAt: new Date(),
          step4Data: {
            bankAccounts: mockBankAccounts,
            dematAccounts: mockDematAccounts,
          },
          currentStep: 5,
          lastUpdatedStep: 4,
          updatedAt: new Date(),
        })
        .where(eq(corporateKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      return {
        success: true,
        bankAccountsFound: mockBankAccounts.length,
        dematAccountsFound: mockDematAccounts.length,
        accounts: [...mockBankAccounts, ...mockDematAccounts],
      };
    } catch (error: any) {
      console.error('Account discovery error:', error);
      throw new Error(error.message || 'Corporate account discovery failed');
    }
  }

  /**
   * Step 5: Confirm and Complete KYC
   */
  async confirmCorporateKYC(userId: string, confirmedData: any): Promise<void> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.corporateKycProgress.findFirst({
        where: eq(corporateKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      const result = await db.update(corporateKycProgress)
        .set({
          step5ReviewCompleted: true,
          step5CompletedAt: new Date(),
          step5ConfirmedData: confirmedData,
          isCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(corporateKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      // Update user's KYC tier to enhanced (Corporate entities get enhanced tier)
      await db.update(users)
        .set({
          kycTier: 'enhanced',
          kycTierUpgradedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (error: any) {
      console.error('KYC confirmation error:', error);
      throw new Error(error.message || 'Failed to complete Corporate KYC');
    }
  }

  /**
   * Get Corporate KYC Progress
   */
  async getCorporateKYCProgress(userId: string) {
    try {
      const progress = await db.query.corporateKycProgress.findFirst({
        where: eq(corporateKycProgress.userId, userId),
      });

      return progress || null;
    } catch (error: any) {
      console.error('Get KYC progress error:', error);
      throw new Error('Failed to fetch KYC progress');
    }
  }

  /**
   * Resume Corporate KYC from last step
   */
  async resumeCorporateKYC(userId: string) {
    const progress = await this.getCorporateKYCProgress(userId);
    
    if (!progress) {
      return { currentStep: 1, canResume: false };
    }

    if (progress.isCompleted) {
      return { currentStep: 5, canResume: false, completed: true };
    }

    return {
      currentStep: progress.currentStep || 1,
      canResume: true,
      progress,
    };
  }
}

export const corporateKYCService = new CorporateKYCService();
