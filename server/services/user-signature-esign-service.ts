/**
 * User Signature eSign Service
 * 
 * Handles signing documents using the user's saved signature (uploaded, drawn, or typed).
 * Embeds signature images into PDF documents with metadata and audit trail.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { db } from '../db';
import { userSignatures, esignRequests } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export interface UserSignatureSignRequest {
  userId: string;
  signatureId?: string;
  signatureDataUrl?: string;
  documentBuffer: Buffer;
  documentName: string;
  documentType: 'itr_verification' | 'form_15ca' | 'form_15cb' | 'investment_agreement' | 'kyc_consent' | 'mandate' | 'other';
  signerName: string;
  signerEmail?: string;
  signaturePosition?: {
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  includeTimestamp?: boolean;
  includeSignerInfo?: boolean;
}

export interface UserSignatureSignResponse {
  success: boolean;
  message: string;
  transactionId: string;
  signedDocumentBuffer?: Buffer;
  signedAt?: Date;
  signatureMetadata?: {
    signerName: string;
    signedAt: Date;
    documentHash: string;
    signatureId: string;
    ipAddress?: string;
  };
}

class UserSignatureESignService {
  private environment: 'sandbox' | 'production' = 'production';

  getEnvironment(): string {
    return this.environment;
  }

  isInMockMode(): boolean {
    return false;
  }

  private generateDocumentHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async getUserSignature(userId: string, signatureId?: string): Promise<{
    signatureDataUrl: string;
    signatureName: string;
    signatureType: string;
  } | null> {
    try {
      let signature;
      
      if (signatureId) {
        [signature] = await db
          .select()
          .from(userSignatures)
          .where(and(
            eq(userSignatures.id, signatureId),
            eq(userSignatures.userId, userId)
          ))
          .limit(1);
      } else {
        [signature] = await db
          .select()
          .from(userSignatures)
          .where(and(
            eq(userSignatures.userId, userId),
            eq(userSignatures.isDefault, true)
          ))
          .limit(1);
          
        if (!signature) {
          const [anySignature] = await db
            .select()
            .from(userSignatures)
            .where(eq(userSignatures.userId, userId))
            .limit(1);
          signature = anySignature;
        }
      }

      if (!signature) {
        return null;
      }

      return {
        signatureDataUrl: signature.signatureDataUrl,
        signatureName: signature.name,
        signatureType: signature.signatureType,
      };
    } catch (error) {
      console.error('[UserSignatureESign] Error fetching signature:', error);
      return null;
    }
  }

  private async embedSignatureInPdf(
    pdfBuffer: Buffer,
    signatureDataUrl: string,
    signerName: string,
    position?: UserSignatureSignRequest['signaturePosition'],
    includeTimestamp?: boolean,
    includeSignerInfo?: boolean
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    const targetPage = position?.page && position.page <= pages.length 
      ? pages[position.page - 1] 
      : pages[pages.length - 1];

    const { width: pageWidth, height: pageHeight } = targetPage.getSize();

    const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const signatureBuffer = Buffer.from(base64Data, 'base64');
    
    let signatureImage;
    if (signatureDataUrl.includes('image/png')) {
      signatureImage = await pdfDoc.embedPng(signatureBuffer);
    } else {
      signatureImage = await pdfDoc.embedJpg(signatureBuffer);
    }

    const sigWidth = position?.width || 150;
    const sigHeight = position?.height || 50;
    const sigX = position?.x ?? (pageWidth - sigWidth - 50);
    const sigY = position?.y ?? 80;

    targetPage.drawImage(signatureImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 8;
    const now = new Date();

    let textY = sigY - 12;

    if (includeSignerInfo) {
      targetPage.drawText(`Signed by: ${signerName}`, {
        x: sigX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      textY -= 10;
    }

    if (includeTimestamp) {
      const timestamp = now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      targetPage.drawText(`Date: ${timestamp} IST`, {
        x: sigX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      textY -= 10;
    }

    targetPage.drawText('Electronically Signed via FintekPro', {
      x: sigX,
      y: textY,
      size: 6,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const signedPdfBytes = await pdfDoc.save();
    return Buffer.from(signedPdfBytes);
  }

  async signDocument(request: UserSignatureSignRequest): Promise<UserSignatureSignResponse> {
    const transactionId = `USIG-${nanoid(12)}`;
    const signedAt = new Date();

    try {
      let signatureDataUrl = request.signatureDataUrl;
      let signatureId = request.signatureId || '';
      let signatureName = 'Direct Signature';

      if (!signatureDataUrl) {
        const userSig = await this.getUserSignature(request.userId, request.signatureId);
        if (!userSig) {
          return {
            success: false,
            message: 'No signature found. Please create a signature first.',
            transactionId,
          };
        }
        signatureDataUrl = userSig.signatureDataUrl;
        signatureName = userSig.signatureName;
      }

      const originalHash = this.generateDocumentHash(request.documentBuffer);

      const signedBuffer = await this.embedSignatureInPdf(
        request.documentBuffer,
        signatureDataUrl,
        request.signerName,
        request.signaturePosition,
        request.includeTimestamp ?? true,
        request.includeSignerInfo ?? true
      );

      const signedHash = this.generateDocumentHash(signedBuffer);

      await db.insert(esignRequests).values({
        transactionId,
        userId: parseInt(request.userId) || 0,
        documentType: request.documentType,
        documentName: request.documentName,
        documentHash: originalHash,
        signerName: request.signerName,
        signerEmail: request.signerEmail || null,
        status: 'completed',
        provider: 'user_signature',
        signedDocumentHash: signedHash,
        completedAt: signedAt,
        metadata: {
          signatureId,
          signatureName,
          signaturePosition: request.signaturePosition,
          includeTimestamp: request.includeTimestamp ?? true,
          includeSignerInfo: request.includeSignerInfo ?? true,
        },
      });

      console.log(`[UserSignatureESign] Document signed successfully - Transaction: ${transactionId}`);

      return {
        success: true,
        message: 'Document signed successfully with your saved signature',
        transactionId,
        signedDocumentBuffer: signedBuffer,
        signedAt,
        signatureMetadata: {
          signerName: request.signerName,
          signedAt,
          documentHash: signedHash,
          signatureId,
        },
      };
    } catch (error) {
      console.error('[UserSignatureESign] Error signing document:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sign document',
        transactionId,
      };
    }
  }

  async getSigningStatus(transactionId: string): Promise<{
    status: string;
    documentName: string;
    signerName: string;
    initiatedAt: Date;
    completedAt?: Date;
    provider: string;
  }> {
    try {
      const [request] = await db
        .select()
        .from(esignRequests)
        .where(eq(esignRequests.transactionId, transactionId))
        .limit(1);

      if (!request) {
        return {
          status: 'not_found',
          documentName: '',
          signerName: '',
          initiatedAt: new Date(),
          provider: 'user_signature',
        };
      }

      return {
        status: request.status || 'unknown',
        documentName: request.documentName || '',
        signerName: request.signerName || '',
        initiatedAt: request.createdAt || new Date(),
        completedAt: request.completedAt || undefined,
        provider: 'user_signature',
      };
    } catch (error) {
      console.error('[UserSignatureESign] Error getting status:', error);
      return {
        status: 'error',
        documentName: '',
        signerName: '',
        initiatedAt: new Date(),
        provider: 'user_signature',
      };
    }
  }

  async validateSignature(signatureDataUrl: string): Promise<{
    valid: boolean;
    message: string;
    dimensions?: { width: number; height: number };
  }> {
    try {
      if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
        return { valid: false, message: 'Invalid signature format. Must be a base64 data URL.' };
      }

      const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      if (buffer.length < 100) {
        return { valid: false, message: 'Signature image is too small or empty.' };
      }

      if (buffer.length > 500000) {
        return { valid: false, message: 'Signature image is too large. Maximum 500KB allowed.' };
      }

      return { 
        valid: true, 
        message: 'Signature is valid',
        dimensions: { width: 400, height: 150 }
      };
    } catch (error) {
      return { valid: false, message: 'Failed to validate signature format.' };
    }
  }
}

export const userSignatureESignService = new UserSignatureESignService();
export default userSignatureESignService;
