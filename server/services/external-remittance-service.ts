/**
 * External Remittance Tracking Service
 * 
 * SEBI (AIF/PMS) Regulations Compliance:
 * For AIF and PMS orders, FintekPro facilitates documentation only.
 * Actual payments are made directly by investor to fund/portfolio manager.
 * 
 * This service tracks:
 * 1. Remittance proof uploads from investors
 * 2. Verification of payment confirmations
 * 3. Matching of capital calls with remittance receipts
 * 4. Audit trail for regulatory compliance
 */

import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { complianceMonitor } from '../compliance-monitor';
import { db } from '../db';
import { externalRemittanceProofs, complianceAuditTrail } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

export type RemittanceType = 'aif_subscription' | 'pms_subscription' | 'capital_call' | 'top_up';
export type RemittanceStatus = 'pending_upload' | 'uploaded' | 'under_review' | 'verified' | 'rejected' | 'expired';

export interface RemittanceProofDocument {
  id: string;
  orderId: string;
  productType: 'aif' | 'pms';
  productId: string;
  productName: string;
  userId: string;
  remittanceType: RemittanceType;
  
  expectedAmount: number;
  currency: string;
  
  documentPath?: string;
  documentHash?: string;
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
  
  status: RemittanceStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  
  bankDetails: {
    beneficiaryName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    utrNumber?: string;
    transactionDate?: string;
  };
  
  capitalCallReference?: string;
  subscriptionAgreementId?: string;
  
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface RemittanceUploadRequest {
  orderId: string;
  productType: 'aif' | 'pms';
  productId: string;
  productName: string;
  userId: string;
  remittanceType: RemittanceType;
  expectedAmount: number;
  currency?: string;
  capitalCallReference?: string;
  subscriptionAgreementId?: string;
  bankDetails?: Partial<RemittanceProofDocument['bankDetails']>;
}

export interface RemittanceVerificationRequest {
  remittanceId: string;
  verifierId: string;
  action: 'verify' | 'reject';
  notes?: string;
  rejectionReason?: string;
}

export interface RemittanceDocumentUpload {
  remittanceId: string;
  userId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  bankDetails: Partial<RemittanceProofDocument['bankDetails']>;
}

class ExternalRemittanceService {
  private readonly UPLOAD_EXPIRY_DAYS = 30;

  constructor() {
    console.log('✅ External Remittance Tracking Service initialized');
  }

  async createRemittanceRequest(request: RemittanceUploadRequest): Promise<RemittanceProofDocument> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.UPLOAD_EXPIRY_DAYS);

    const retentionExpiresAt = new Date();
    retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 8);

    try {
      const [inserted] = await db.insert(externalRemittanceProofs).values({
        orderId: request.orderId,
        productType: request.productType,
        productId: request.productId,
        productName: request.productName,
        userId: request.userId,
        remittanceType: request.remittanceType,
        expectedAmount: request.expectedAmount.toString(),
        currency: request.currency || 'INR',
        status: 'pending_upload',
        beneficiaryName: request.bankDetails?.beneficiaryName,
        bankName: request.bankDetails?.bankName,
        accountNumber: request.bankDetails?.accountNumber,
        ifscCode: request.bankDetails?.ifscCode,
        capitalCallReference: request.capitalCallReference,
        subscriptionAgreementId: request.subscriptionAgreementId,
        expiresAt,
        retentionExpiresAt
      }).returning();

      await db.insert(complianceAuditTrail).values({
        userId: request.userId,
        action: 'remittance_request_created',
        entityType: 'remittance_proof',
        entityId: inserted.id,
        newValue: {
          productType: request.productType,
          productId: request.productId,
          expectedAmount: request.expectedAmount
        },
        performedBy: request.userId,
        performedByRole: 'user',
        riskImpact: 'low',
        complianceImpact: 'none'
      });

      complianceMonitor.logEvent({
        eventType: 'compliance',
        action: 'remittance_request_created',
        resource: request.orderId,
        outcome: 'success',
        riskLevel: 'low',
        userId: request.userId,
        metadata: {
          remittanceId: inserted.id,
          productType: request.productType,
          productId: request.productId,
          expectedAmount: request.expectedAmount
        }
      });

      console.log(`[RemittanceTracking] Created remittance request ${inserted.id} for ${request.productType} order ${request.orderId}`);

      return this.mapDbToInterface(inserted);
    } catch (error) {
      console.error('[RemittanceTracking] Failed to create remittance request:', error);
      throw error;
    }
  }

  private mapDbToInterface(record: any): RemittanceProofDocument {
    return {
      id: record.id,
      orderId: record.orderId,
      productType: record.productType,
      productId: record.productId,
      productName: record.productName,
      userId: record.userId,
      remittanceType: record.remittanceType,
      expectedAmount: parseFloat(record.expectedAmount),
      currency: record.currency,
      documentPath: record.documentPath,
      documentHash: record.documentHash,
      originalFileName: record.originalFileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      uploadedAt: record.uploadedAt,
      status: record.status,
      verifiedBy: record.verifiedBy,
      verifiedAt: record.verifiedAt,
      rejectionReason: record.rejectionReason,
      bankDetails: {
        beneficiaryName: record.beneficiaryName,
        bankName: record.bankName,
        accountNumber: record.accountNumber,
        ifscCode: record.ifscCode,
        utrNumber: record.utrNumber,
        transactionDate: record.transactionDate
      },
      capitalCallReference: record.capitalCallReference,
      subscriptionAgreementId: record.subscriptionAgreementId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      expiresAt: record.expiresAt
    };
  }

  async uploadRemittanceProof(upload: RemittanceDocumentUpload): Promise<{ success: boolean; message: string }> {
    try {
      const [remittance] = await db.select()
        .from(externalRemittanceProofs)
        .where(eq(externalRemittanceProofs.id, upload.remittanceId))
        .limit(1);
      
      if (!remittance) {
        return { success: false, message: 'Remittance request not found' };
      }

      if (remittance.userId !== upload.userId) {
        return { success: false, message: 'Unauthorized - user does not own this remittance request' };
      }

      if (remittance.status !== 'pending_upload') {
        return { success: false, message: `Cannot upload proof for remittance in ${remittance.status} status` };
      }

      if (remittance.expiresAt && new Date() > remittance.expiresAt) {
        await db.update(externalRemittanceProofs)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(externalRemittanceProofs.id, upload.remittanceId));
        return { success: false, message: 'Remittance upload window has expired' };
      }

      const documentHash = crypto.createHash('sha256')
        .update(upload.fileName + upload.fileSize + Date.now())
        .digest('hex');

      await db.update(externalRemittanceProofs)
        .set({
          documentPath: upload.filePath,
          documentHash,
          hashAlgorithm: 'sha256',
          originalFileName: upload.fileName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          uploadedAt: new Date(),
          status: 'uploaded',
          utrNumber: upload.bankDetails.utrNumber,
          transactionDate: upload.bankDetails.transactionDate,
          updatedAt: new Date()
        })
        .where(eq(externalRemittanceProofs.id, upload.remittanceId));

      await db.insert(complianceAuditTrail).values({
        userId: upload.userId,
        action: 'remittance_proof_uploaded',
        entityType: 'remittance_proof',
        entityId: upload.remittanceId,
        newValue: {
          documentHash,
          utrNumber: upload.bankDetails.utrNumber
        },
        performedBy: upload.userId,
        performedByRole: 'user',
        riskImpact: 'low',
        complianceImpact: 'none'
      });

      complianceMonitor.logEvent({
        eventType: 'compliance',
        action: 'remittance_proof_uploaded',
        resource: remittance.orderId,
        outcome: 'success',
        riskLevel: 'low',
        userId: upload.userId,
        metadata: {
          remittanceId: upload.remittanceId,
          documentHash,
          utrNumber: upload.bankDetails.utrNumber
        }
      });

      console.log(`[RemittanceTracking] Proof uploaded for remittance ${upload.remittanceId}`);

      return { success: true, message: 'Remittance proof uploaded successfully. Awaiting verification.' };
    } catch (error) {
      console.error('[RemittanceTracking] Failed to upload proof:', error);
      return { success: false, message: 'Failed to upload proof' };
    }
  }

  async verifyRemittance(request: RemittanceVerificationRequest): Promise<{ success: boolean; message: string }> {
    try {
      const [remittance] = await db.select()
        .from(externalRemittanceProofs)
        .where(eq(externalRemittanceProofs.id, request.remittanceId))
        .limit(1);
      
      if (!remittance) {
        return { success: false, message: 'Remittance not found' };
      }

      if (remittance.status !== 'uploaded' && remittance.status !== 'under_review') {
        return { success: false, message: `Cannot verify remittance in ${remittance.status} status` };
      }

      const now = new Date();

      if (request.action === 'verify') {
        await db.update(externalRemittanceProofs)
          .set({
            status: 'verified',
            verifiedBy: request.verifierId,
            verifiedAt: now,
            reviewerNotes: request.notes,
            updatedAt: now
          })
          .where(eq(externalRemittanceProofs.id, request.remittanceId));

        await db.insert(complianceAuditTrail).values({
          userId: remittance.userId,
          action: 'remittance_verified',
          entityType: 'remittance_proof',
          entityId: request.remittanceId,
          newValue: { notes: request.notes },
          performedBy: request.verifierId,
          performedByRole: 'compliance_officer',
          riskImpact: 'low',
          complianceImpact: 'none'
        });
        
        complianceMonitor.logEvent({
          eventType: 'compliance',
          action: 'remittance_verified',
          resource: remittance.orderId,
          outcome: 'success',
          riskLevel: 'low',
          userId: request.verifierId,
          metadata: {
            remittanceId: request.remittanceId,
            productType: remittance.productType,
            amount: remittance.expectedAmount,
            documentHash: remittance.documentHash
          }
        });

        console.log(`[RemittanceTracking] Remittance ${request.remittanceId} VERIFIED by ${request.verifierId}`);

        return { success: true, message: 'Remittance verified successfully' };
      } else {
        const rejectionReason = request.rejectionReason || 'Verification failed';

        await db.update(externalRemittanceProofs)
          .set({
            status: 'rejected',
            verifiedBy: request.verifierId,
            verifiedAt: now,
            rejectionReason,
            reviewerNotes: request.notes,
            updatedAt: now
          })
          .where(eq(externalRemittanceProofs.id, request.remittanceId));

        await db.insert(complianceAuditTrail).values({
          userId: remittance.userId,
          action: 'remittance_rejected',
          entityType: 'remittance_proof',
          entityId: request.remittanceId,
          newValue: { rejectionReason, notes: request.notes },
          performedBy: request.verifierId,
          performedByRole: 'compliance_officer',
          riskImpact: 'medium',
          complianceImpact: 'major'
        });

        complianceMonitor.logEvent({
          eventType: 'compliance',
          action: 'remittance_rejected',
          resource: remittance.orderId,
          outcome: 'failure',
          riskLevel: 'medium',
          userId: request.verifierId,
          metadata: {
            remittanceId: request.remittanceId,
            rejectionReason
          }
        });

        console.log(`[RemittanceTracking] Remittance ${request.remittanceId} REJECTED: ${rejectionReason}`);

        return { success: true, message: 'Remittance rejected' };
      }
    } catch (error) {
      console.error('[RemittanceTracking] Failed to verify remittance:', error);
      return { success: false, message: 'Failed to verify remittance' };
    }
  }

  async getRemittance(remittanceId: string): Promise<RemittanceProofDocument | undefined> {
    try {
      const [record] = await db.select()
        .from(externalRemittanceProofs)
        .where(eq(externalRemittanceProofs.id, remittanceId))
        .limit(1);
      return record ? this.mapDbToInterface(record) : undefined;
    } catch (error) {
      console.error('[RemittanceTracking] Failed to get remittance:', error);
      return undefined;
    }
  }

  async getRemittancesByOrder(orderId: string): Promise<RemittanceProofDocument[]> {
    try {
      const records = await db.select()
        .from(externalRemittanceProofs)
        .where(eq(externalRemittanceProofs.orderId, orderId))
        .orderBy(desc(externalRemittanceProofs.createdAt));
      return records.map(r => this.mapDbToInterface(r));
    } catch (error) {
      console.error('[RemittanceTracking] Failed to get remittances by order:', error);
      return [];
    }
  }

  async getRemittancesByUser(userId: string): Promise<RemittanceProofDocument[]> {
    try {
      const records = await db.select()
        .from(externalRemittanceProofs)
        .where(eq(externalRemittanceProofs.userId, userId))
        .orderBy(desc(externalRemittanceProofs.createdAt));
      return records.map(r => this.mapDbToInterface(r));
    } catch (error) {
      console.error('[RemittanceTracking] Failed to get remittances by user:', error);
      return [];
    }
  }

  async getPendingVerifications(): Promise<RemittanceProofDocument[]> {
    try {
      const records = await db.select()
        .from(externalRemittanceProofs)
        .where(
          and(
            eq(externalRemittanceProofs.status, 'uploaded'),
          )
        )
        .orderBy(externalRemittanceProofs.uploadedAt);
      return records.map(r => this.mapDbToInterface(r));
    } catch (error) {
      console.error('[RemittanceTracking] Failed to get pending verifications:', error);
      return [];
    }
  }

  async getComplianceReport(): Promise<{
    totalRemittances: number;
    pendingUpload: number;
    awaitingVerification: number;
    verified: number;
    rejected: number;
    expired: number;
    totalVerifiedAmount: number;
    aifCount: number;
    pmsCount: number;
  }> {
    try {
      const all = await db.select().from(externalRemittanceProofs);
      
      return {
        totalRemittances: all.length,
        pendingUpload: all.filter(r => r.status === 'pending_upload').length,
        awaitingVerification: all.filter(r => r.status === 'uploaded' || r.status === 'under_review').length,
        verified: all.filter(r => r.status === 'verified').length,
        rejected: all.filter(r => r.status === 'rejected').length,
        expired: all.filter(r => r.status === 'expired').length,
        totalVerifiedAmount: all
          .filter(r => r.status === 'verified')
          .reduce((sum, r) => sum + parseFloat(r.expectedAmount || '0'), 0),
        aifCount: all.filter(r => r.productType === 'aif').length,
        pmsCount: all.filter(r => r.productType === 'pms').length
      };
    } catch (error) {
      console.error('[RemittanceTracking] Failed to get compliance report:', error);
      return {
        totalRemittances: 0,
        pendingUpload: 0,
        awaitingVerification: 0,
        verified: 0,
        rejected: 0,
        expired: 0,
        totalVerifiedAmount: 0,
        aifCount: 0,
        pmsCount: 0
      };
    }
  }

  async checkRemittanceProofRequired(productType: 'aif' | 'pms', orderId: string): Promise<{
    required: boolean;
    hasProof: boolean;
    verified: boolean;
    remittanceId?: string;
  }> {
    const remittances = await this.getRemittancesByOrder(orderId);
    
    if (remittances.length === 0) {
      return {
        required: true,
        hasProof: false,
        verified: false
      };
    }

    const latestRemittance = remittances[0];
    
    return {
      required: true,
      hasProof: latestRemittance.status !== 'pending_upload',
      verified: latestRemittance.status === 'verified',
      remittanceId: latestRemittance.id
    };
  }
}

export const externalRemittanceService = new ExternalRemittanceService();
