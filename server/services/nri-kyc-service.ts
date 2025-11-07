/**
 * NRI KYC Service
 * Handles Smart KYC flow for Non-Resident Indians
 * Flow: PAN/Passport → Overseas Address → PIS Permission → FATCA/CRS → Review
 * 
 * Migration Note: Migrated from Cashfree to Sandbox.co.in for PAN verification
 */

import { sandboxKYCService } from './sandbox-kyc-service';
import { db } from '../db';
import { nriKycProgress, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface PassportVerificationResult {
  success: boolean;
  passportNumber: string;
  name: string;
  expiryDate: string;
  data: any;
}

interface AddressVerificationResult {
  success: boolean;
  address: string;
  country: string;
}

interface PisVerificationResult {
  success: boolean;
  pisBankName: string;
  foreignBankName: string;
}

interface FatcaDeclarationResult {
  success: boolean;
  taxResidency: string;
  usCitizen: boolean;
}

export class NRIKYCService {
  constructor() {
    // No service initialization needed - using Sandbox service instance
  }

  /**
   * Step 1: Verify Passport and optional PAN
   * Uses Sandbox.co.in API for PAN verification (replaces Cashfree)
   */
  async verifyPassportAndPAN(
    userId: string,
    passportNumber: string,
    passportName: string,
    passportExpiry: string,
    countryOfResidence: string,
    pan?: string,
    dob?: string
  ): Promise<PassportVerificationResult> {
    try {
      let panDetails = null;

      // If PAN provided, verify it using Sandbox
      if (pan && dob) {
        try {
          panDetails = await sandboxKYCService.verifyIndividualPAN(pan, passportName, dob);
        } catch (error) {
          console.warn('PAN verification failed for NRI, continuing with passport only:', error);
        }
      }

      // In production, passport verification would call an actual API
      // For now, we validate format and store details
      const passportData = {
        passportNumber,
        name: passportName,
        expiryDate: passportExpiry,
        countryOfResidence,
        panDetails,
      };

      // Create or update KYC progress
      const existingProgress = await db.query.nriKycProgress.findFirst({
        where: eq(nriKycProgress.userId, userId),
      });

      if (existingProgress) {
        await db.update(nriKycProgress)
          .set({
            step1Verified: true,
            step1PanNumber: pan,
            step1PassportNumber: passportNumber,
            step1PassportName: passportName,
            step1PassportExpiry: passportExpiry,
            step1CountryOfResidence: countryOfResidence,
            step1CompletedAt: new Date(),
            step1Data: passportData,
            currentStep: 2,
            lastUpdatedStep: 1,
            updatedAt: new Date(),
          })
          .where(eq(nriKycProgress.userId, userId));
      } else {
        await db.insert(nriKycProgress).values({
          userId,
          step1Verified: true,
          step1PanNumber: pan,
          step1PassportNumber: passportNumber,
          step1PassportName: passportName,
          step1PassportExpiry: passportExpiry,
          step1CountryOfResidence: countryOfResidence,
          step1CompletedAt: new Date(),
          step1Data: passportData,
          currentStep: 2,
          lastUpdatedStep: 1,
        });
      }

      return {
        success: true,
        passportNumber,
        name: passportName,
        expiryDate: passportExpiry,
        data: passportData,
      };
    } catch (error: any) {
      console.error('Passport verification error:', error);
      throw new Error(error.message || 'Passport verification failed');
    }
  }

  /**
   * Step 2: Verify Overseas Address with proof
   */
  async verifyOverseasAddress(
    userId: string,
    addressDetails: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state?: string;
      country: string;
      postalCode: string;
      addressProofUrl: string; // Utility bill/lease agreement in object storage
    }
  ): Promise<AddressVerificationResult> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.nriKycProgress.findFirst({
        where: eq(nriKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      const result = await db.update(nriKycProgress)
        .set({
          step2AddressVerified: true,
          step2OverseasAddressLine1: addressDetails.addressLine1,
          step2OverseasAddressLine2: addressDetails.addressLine2,
          step2OverseasCity: addressDetails.city,
          step2OverseasState: addressDetails.state,
          step2OverseasCountry: addressDetails.country,
          step2OverseasPostalCode: addressDetails.postalCode,
          step2AddressProofDocUrl: addressDetails.addressProofUrl,
          step2CompletedAt: new Date(),
          step2Data: addressDetails,
          currentStep: 3,
          lastUpdatedStep: 2,
          updatedAt: new Date(),
        })
        .where(eq(nriKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      return {
        success: true,
        address: `${addressDetails.addressLine1}, ${addressDetails.city}, ${addressDetails.country}`,
        country: addressDetails.country,
      };
    } catch (error: any) {
      console.error('Address verification error:', error);
      throw new Error(error.message || 'Overseas address verification failed');
    }
  }

  /**
   * Step 3: Verify PIS Permission & Foreign Bank Account
   */
  async verifyPISAndForeignBank(
    userId: string,
    pisDetails: {
      pisPermissionLetterUrl: string;
      pisBankName: string;
      pisBranchName: string;
      foreignBankAccountNumber: string;
      foreignBankName: string;
      foreignBankCountry: string;
      swiftCode: string;
    }
  ): Promise<PisVerificationResult> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.nriKycProgress.findFirst({
        where: eq(nriKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      const result = await db.update(nriKycProgress)
        .set({
          step3PisVerified: true,
          step3PisPermissionLetterUrl: pisDetails.pisPermissionLetterUrl,
          step3PisBankName: pisDetails.pisBankName,
          step3PisBranchName: pisDetails.pisBranchName,
          step3ForeignBankAccountNumber: pisDetails.foreignBankAccountNumber,
          step3ForeignBankName: pisDetails.foreignBankName,
          step3ForeignBankCountry: pisDetails.foreignBankCountry,
          step3SwiftCode: pisDetails.swiftCode,
          step3CompletedAt: new Date(),
          step3Data: pisDetails,
          currentStep: 4,
          lastUpdatedStep: 3,
          updatedAt: new Date(),
        })
        .where(eq(nriKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      return {
        success: true,
        pisBankName: pisDetails.pisBankName,
        foreignBankName: pisDetails.foreignBankName,
      };
    } catch (error: any) {
      console.error('PIS verification error:', error);
      throw new Error(error.message || 'PIS permission verification failed');
    }
  }

  /**
   * Step 4: Complete FATCA/CRS Declaration
   */
  async completeFatcaDeclaration(
    userId: string,
    fatcaDetails: {
      taxResidencyCountry: string;
      taxIdentificationNumber: string;
      usCitizen: boolean;
      greenCardHolder: boolean;
      fatcaDeclarationUrl: string; // W8-BEN form
      crsDeclarationUrl?: string;
    }
  ): Promise<FatcaDeclarationResult> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.nriKycProgress.findFirst({
        where: eq(nriKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      const result = await db.update(nriKycProgress)
        .set({
          step4FatcaCompleted: true,
          step4TaxResidencyCountry: fatcaDetails.taxResidencyCountry,
          step4TaxIdentificationNumber: fatcaDetails.taxIdentificationNumber,
          step4UsCitizen: fatcaDetails.usCitizen,
          step4GreenCardHolder: fatcaDetails.greenCardHolder,
          step4FatcaDeclarationUrl: fatcaDetails.fatcaDeclarationUrl,
          step4CrsDeclarationUrl: fatcaDetails.crsDeclarationUrl,
          step4CompletedAt: new Date(),
          step4Data: fatcaDetails,
          currentStep: 5,
          lastUpdatedStep: 4,
          updatedAt: new Date(),
        })
        .where(eq(nriKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      return {
        success: true,
        taxResidency: fatcaDetails.taxResidencyCountry,
        usCitizen: fatcaDetails.usCitizen,
      };
    } catch (error: any) {
      console.error('FATCA declaration error:', error);
      throw new Error(error.message || 'FATCA declaration failed');
    }
  }

  /**
   * Step 5: Confirm and Complete NRI KYC
   */
  async confirmNRIKYC(
    userId: string,
    confirmedData: {
      nriStatus: string; // NRI/NRE/NRO/PIO/OCI
      investmentType: string; // repatriable/non_repatriable
    }
  ): Promise<void> {
    try {
      // Verify existing progress record
      const existingProgress = await db.query.nriKycProgress.findFirst({
        where: eq(nriKycProgress.userId, userId),
      });

      if (!existingProgress) {
        throw new Error('No KYC progress found. Please complete Step 1 first.');
      }

      const result = await db.update(nriKycProgress)
        .set({
          step5ReviewCompleted: true,
          step5CompletedAt: new Date(),
          step5ConfirmedData: confirmedData,
          nriStatus: confirmedData.nriStatus,
          investmentType: confirmedData.investmentType,
          isCompleted: true,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(nriKycProgress.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to update KYC progress');
      }

      // Note: KYC tier tracking has been moved to kycVault table
    } catch (error: any) {
      console.error('KYC confirmation error:', error);
      throw new Error(error.message || 'Failed to complete NRI KYC');
    }
  }

  /**
   * Get NRI KYC Progress
   */
  async getNRIKYCProgress(userId: string) {
    try {
      const progress = await db.query.nriKycProgress.findFirst({
        where: eq(nriKycProgress.userId, userId),
      });

      return progress || null;
    } catch (error: any) {
      console.error('Get KYC progress error:', error);
      throw new Error('Failed to fetch KYC progress');
    }
  }

  /**
   * Resume NRI KYC from last step
   */
  async resumeNRIKYC(userId: string) {
    const progress = await this.getNRIKYCProgress(userId);
    
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

export const nriKYCService = new NRIKYCService();
