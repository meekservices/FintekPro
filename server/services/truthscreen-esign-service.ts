// @ts-nocheck
/**
 * TruthScreen Aadhaar-based eSign Service
 * 
 * Implements Aadhaar eSign (docType 373) via TruthScreen API:
 * 1. POST /api/v2.2/aadhaaresignapi — multipart/form-data with PDF + signer details → returns eSign URL/transaction
 * 2. POST /api/v2.2/aadhaaresignapi/aadhaarEsignStatus — check eSign status by transID
 * 
 * Authentication: username header on all requests
 */

import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import { db } from '../db';
import { esignRequests, esignCertificates } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AppError } from '../utils/errors';

interface TruthScreenESignInitRequest {
  userId: string;
  documentType: string;
  documentName: string;
  documentHash: string;
  documentUrl?: string;
  documentBuffer?: Buffer;
  aadhaarNumber: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  callbackUrl?: string;
  redirectionUrl?: string;
  pages?: '1' | '2' | '3';
  pageNumbers?: string;
  xCoordinates?: string;
  yCoordinates?: string;
  reason?: string;
}

interface TruthScreenESignStatusResponse {
  status: string;
  transID: string;
  signedPdfUrl?: string;
  signedPdfBase64?: string;
  message?: string;
  signerName?: string;
  signedAt?: string;
  certificateSerial?: string;
}

class TruthScreenESignService {
  private username: string;
  private password: string;
  private baseUrl: string;
  private environment: 'sandbox' | 'production';

  constructor() {
    this.username = process.env.TRUTHSCREEN_USERNAME || '';
    this.password = process.env.TRUTHSCREEN_PASSWORD || '';
    this.baseUrl = process.env.TRUTHSCREEN_BASE_URL || 'https://www.truthscreen.com';

    if (process.env.NODE_ENV === 'production' && this.username) {
      this.environment = 'production';
    } else {
      this.environment = 'sandbox';
    }

    if (!this.isConfigured()) {
      console.log(`[TruthScreen eSign] Running in mock mode (no credentials)`);
    } else {
      console.log(`✅ [TruthScreen eSign] Initialized (${this.environment} → ${this.baseUrl})`);
    }
  }

  isConfigured(): boolean {
    return !!(this.username && this.password);
  }

  isInMockMode(): boolean {
    return !this.isConfigured();
  }

  getEnvironment(): string {
    return this.environment;
  }

  private getHeaders(): Record<string, string> {
    return {
      'username': this.username
    };
  }

  generateDocumentHash(documentContent: Buffer | string): string {
    const content = typeof documentContent === 'string' ? Buffer.from(documentContent) : documentContent;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private maskAadhaar(aadhaar: string): string {
    const cleaned = aadhaar.replace(/\s/g, '');
    if (cleaned.length !== 12) return 'XXXX-XXXX-XXXX';
    return `XXXX-XXXX-${cleaned.slice(-4)}`;
  }

  async initiateESign(request: TruthScreenESignInitRequest): Promise<{
    success: boolean;
    transactionId: string;
    requestId: string;
    message: string;
    otpSent?: boolean;
    maskedMobile?: string;
    expiresAt?: Date;
    esignUrl?: string;
  }> {
    const transactionId = `TS-ESIGN-${Date.now()}-${nanoid(6)}`;

    try {
      await db.insert(esignRequests).values({
        id: nanoid(),
        userId: request.userId,
        transactionId,
        documentType: request.documentType,
        documentName: request.documentName,
        documentHash: request.documentHash,
        documentUrl: request.documentUrl || null,
        aadhaarMasked: this.maskAadhaar(request.aadhaarNumber),
        signerName: request.fullName,
        provider: 'truthscreen',
        status: 'initiated',
        otpSentAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      if (this.isInMockMode()) {
        console.log(`[TruthScreen eSign] Mock mode - simulating eSign initiation: ${transactionId}`);

        return {
          success: true,
          transactionId,
          requestId: `REQ-${nanoid(10)}`,
          message: 'eSign initiated successfully (mock mode). OTP will be sent to Aadhaar-linked mobile.',
          otpSent: true,
          maskedMobile: 'XXXXXX9876',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        };
      }

      const nameParts = request.fullName.trim().split(/\s+/);
      const firstName = request.firstName || nameParts[0] || '';
      const lastName = request.lastName || nameParts.slice(1).join(' ') || '';

      const form = new FormData();
      form.append('transID', transactionId);
      form.append('docType', '373');
      form.append('pages', request.pages || '1');
      form.append('firstName', firstName);
      form.append('lastName', lastName);
      form.append('location', '');
      form.append('reason', request.reason || 'I agree to sign the documents as its legally binded and approved.');
      form.append('authmode', 'OTP');

      if (request.pageNumbers) {
        form.append('page_no', request.pageNumbers);
      } else {
        form.append('page_no', '1');
      }

      if (request.xCoordinates) {
        form.append('x_cordinate', request.xCoordinates);
      } else {
        form.append('x_cordinate', '20');
      }

      if (request.yCoordinates) {
        form.append('y_cordinate', request.yCoordinates);
      } else {
        form.append('y_cordinate', '20');
      }

      if (request.callbackUrl) {
        form.append('callback', request.callbackUrl);
      }

      if (request.redirectionUrl) {
        form.append('redirection', request.redirectionUrl);
      }

      if (request.documentBuffer) {
        form.append('file', request.documentBuffer, {
          filename: request.documentName || 'document.pdf',
          contentType: 'application/pdf',
        });
      } else if (request.documentUrl) {
        try {
          const fileResponse = await axios.get(request.documentUrl, { responseType: 'arraybuffer', timeout: 15000 });
          form.append('file', Buffer.from(fileResponse.data), {
            filename: request.documentName || 'document.pdf',
            contentType: 'application/pdf',
          });
        } catch (fetchErr: any) {
          console.error(`[TruthScreen eSign] Failed to fetch document from URL: ${fetchErr.message}`);
          throw new AppError('Failed to fetch document for signing', 400, 'DOCUMENT_FETCH_FAILED');
        }
      } else {
        const placeholderPdf = Buffer.from('%PDF-1.4 placeholder for hash-based signing');
        form.append('file', placeholderPdf, {
          filename: request.documentName || 'document.pdf',
          contentType: 'application/pdf',
        });
      }

      console.log(`[TruthScreen eSign] Submitting eSign request: ${transactionId}`);

      const response = await axios.post(
        `${this.baseUrl}/api/v2.2/aadhaaresignapi`,
        form,
        {
          headers: {
            ...this.getHeaders(),
            ...form.getHeaders(),
          },
          timeout: 60000,
        }
      );

      const data = response.data;
      console.log(`[TruthScreen eSign] Response:`, JSON.stringify(data).substring(0, 500));

      const esignUrl = data?.url || data?.esignUrl || data?.redirect_url || data?.redirectUrl;
      const status = data?.status || data?.msg || '';
      const isSuccess = esignUrl || status.toString() === '1' || (typeof status === 'string' && status.toLowerCase().includes('success'));

      await db.update(esignRequests)
        .set({
          status: isSuccess ? 'otp_sent' : 'failed',
          apiResponse: data,
          errorMessage: isSuccess ? null : (data?.msg || data?.message || 'eSign initiation failed'),
        } as any)
        .where(eq(esignRequests.transactionId, transactionId));

      return {
        success: !!isSuccess,
        transactionId,
        requestId: data?.requestId || data?.request_id || transactionId,
        message: isSuccess
          ? (data?.msg || 'eSign initiated. Complete signing via the provided URL.')
          : (data?.msg || data?.message || 'eSign initiation failed'),
        otpSent: !!isSuccess,
        esignUrl: esignUrl || undefined,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

    } catch (error: any) {
      console.error(`[TruthScreen eSign] Error initiating:`, error.message);
      if (error.response?.data) {
        console.error('[TruthScreen eSign] Response body:', JSON.stringify(error.response.data).substring(0, 500));
      }

      await db.update(esignRequests)
        .set({ status: 'failed', errorMessage: error.message } as any)
        .where(eq(esignRequests.transactionId, transactionId));

      if (error instanceof AppError) throw error;

      throw new AppError(
        error.response?.data?.msg || error.response?.data?.message || 'Failed to initiate eSign via TruthScreen',
        error.response?.status || 500,
        'TRUTHSCREEN_ESIGN_FAILED'
      );
    }
  }

  async checkStatus(transactionId: string): Promise<TruthScreenESignStatusResponse> {
    if (this.isInMockMode()) {
      const [esignRequest] = await db.select()
        .from(esignRequests)
        .where(eq(esignRequests.transactionId, transactionId))
        .limit(1);

      return {
        status: esignRequest?.status || 'pending',
        transID: transactionId,
        message: `Mock status for ${transactionId}`,
        signerName: esignRequest?.signerName || 'Unknown',
      };
    }

    try {
      console.log(`[TruthScreen eSign] Checking status for: ${transactionId}`);

      const response = await axios.post(
        `${this.baseUrl}/api/v2.2/aadhaaresignapi/aadhaarEsignStatus`,
        {
          transID: transactionId,
          docType: 373
        },
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      console.log(`[TruthScreen eSign] Status response:`, JSON.stringify(data).substring(0, 500));

      const statusStr = (data?.status || data?.esignStatus || '').toString().toLowerCase();
      const isSigned = statusStr === 'signed' || statusStr === 'completed' || statusStr === '1' || statusStr === 'success';
      const isPending = statusStr === 'pending' || statusStr === 'initiated' || statusStr === '0';

      let dbStatus = 'pending';
      if (isSigned) dbStatus = 'completed';
      else if (!isPending) dbStatus = 'failed';

      if (isSigned) {
        await db.update(esignRequests)
          .set({
            status: 'completed',
            completedAt: new Date(),
            apiResponse: data,
          } as any)
          .where(eq(esignRequests.transactionId, transactionId));

        if (data.certificateSerial || data.certificate_serial) {
          const certId = data.certificateSerial || data.certificate_serial;
          const [esignRequest] = await db.select()
            .from(esignRequests)
            .where(eq(esignRequests.transactionId, transactionId))
            .limit(1);

          if (esignRequest) {
            try {
              await db.insert(esignCertificates).values({
                id: nanoid(),
                userId: esignRequest.userId,
                transactionId,
                documentType: esignRequest.documentType,
                documentName: esignRequest.documentName,
                documentHash: esignRequest.documentHash,
                signedDocumentUrl: data.signedPdfUrl || data.signed_pdf_url || '',
                certificateSerial: certId,
                signerName: esignRequest.signerName,
                signerAadhaarMasked: esignRequest.aadhaarMasked,
                signedAt: new Date(),
                validFrom: new Date(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                signatureAlgorithm: 'SHA256withRSA',
                status: 'valid',
              });
            } catch (certErr: any) {
              console.warn(`[TruthScreen eSign] Certificate insert failed (may already exist):`, certErr.message);
            }
          }
        }
      }

      return {
        status: dbStatus,
        transID: transactionId,
        signedPdfUrl: data.signedPdfUrl || data.signed_pdf_url,
        signedPdfBase64: data.signedPdfBase64 || data.signed_pdf_base64,
        message: data.msg || data.message,
        signerName: data.signerName || data.signer_name,
        signedAt: data.signedAt || data.signed_at,
        certificateSerial: data.certificateSerial || data.certificate_serial,
      };
    } catch (error: any) {
      console.error(`[TruthScreen eSign] Status check error:`, error.message);
      if (error.response?.data) {
        console.error('[TruthScreen eSign] Response:', JSON.stringify(error.response.data).substring(0, 500));
      }

      throw new AppError(
        error.response?.data?.msg || 'Failed to check eSign status',
        error.response?.status || 500,
        'TRUTHSCREEN_ESIGN_STATUS_FAILED'
      );
    }
  }

  async getStatus(transactionId: string): Promise<{
    status: string;
    documentName: string;
    signerName: string;
    initiatedAt: Date;
    completedAt?: Date;
    certificateId?: string;
  }> {
    const [esignRequest] = await db.select()
      .from(esignRequests)
      .where(eq(esignRequests.transactionId, transactionId))
      .limit(1);

    if (!esignRequest) {
      throw new AppError('eSign request not found', 404, 'ESIGN_NOT_FOUND');
    }

    if (esignRequest.status !== 'completed' && !this.isInMockMode()) {
      try {
        const liveStatus = await this.checkStatus(transactionId);
        return {
          status: liveStatus.status,
          documentName: esignRequest.documentName,
          signerName: esignRequest.signerName,
          initiatedAt: esignRequest.createdAt!,
          completedAt: liveStatus.status === 'completed' ? new Date() : undefined,
          certificateId: liveStatus.certificateSerial,
        };
      } catch {
      }
    }

    return {
      status: esignRequest.status,
      documentName: esignRequest.documentName,
      signerName: esignRequest.signerName,
      initiatedAt: esignRequest.createdAt!,
      completedAt: esignRequest.completedAt || undefined,
      certificateId: esignRequest.certificateId || undefined,
    };
  }

  async verifyESign(request: { transactionId: string; otp: string }): Promise<{
    success: boolean;
    message: string;
    signedDocumentUrl?: string;
    certificateId?: string;
    signatureData?: {
      signedAt: Date;
      signerName: string;
      signerAadhaar: string;
      certificateSerial: string;
      signatureAlgorithm: string;
      validFrom: Date;
      validTo: Date;
    };
  }> {
    const [esignRequest] = await db.select()
      .from(esignRequests)
      .where(eq(esignRequests.transactionId, request.transactionId))
      .limit(1);

    if (!esignRequest) {
      throw new AppError('eSign request not found', 404, 'ESIGN_NOT_FOUND');
    }

    if (this.isInMockMode()) {
      if (request.otp.length !== 6 || !/^\d+$/.test(request.otp)) {
        throw new AppError('Invalid OTP format', 400, 'INVALID_OTP');
      }

      const certificateId = `TS-CERT-${nanoid(12)}`;
      const signedAt = new Date();

      await db.insert(esignCertificates).values({
        id: nanoid(),
        userId: esignRequest.userId,
        transactionId: request.transactionId,
        documentType: esignRequest.documentType,
        documentName: esignRequest.documentName,
        documentHash: esignRequest.documentHash,
        signedDocumentUrl: `/api/esign/download/${request.transactionId}`,
        certificateSerial: certificateId,
        signerName: esignRequest.signerName,
        signerAadhaarMasked: esignRequest.aadhaarMasked,
        signedAt,
        validFrom: signedAt,
        validTo: new Date(signedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
        signatureAlgorithm: 'SHA256withRSA',
        status: 'valid',
      });

      await db.update(esignRequests)
        .set({ status: 'completed', completedAt: signedAt, certificateId } as any)
        .where(eq(esignRequests.transactionId, request.transactionId));

      return {
        success: true,
        message: 'Document signed successfully (mock)',
        signedDocumentUrl: `/api/esign/download/${request.transactionId}`,
        certificateId,
        signatureData: {
          signedAt,
          signerName: esignRequest.signerName,
          signerAadhaar: esignRequest.aadhaarMasked,
          certificateSerial: certificateId,
          signatureAlgorithm: 'SHA256withRSA',
          validFrom: signedAt,
          validTo: new Date(signedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
        },
      };
    }

    const statusResult = await this.checkStatus(request.transactionId);

    if (statusResult.status === 'completed') {
      return {
        success: true,
        message: 'Document signed successfully',
        signedDocumentUrl: statusResult.signedPdfUrl,
        certificateId: statusResult.certificateSerial,
        signatureData: statusResult.signedAt ? {
          signedAt: new Date(statusResult.signedAt),
          signerName: statusResult.signerName || esignRequest.signerName,
          signerAadhaar: esignRequest.aadhaarMasked,
          certificateSerial: statusResult.certificateSerial || '',
          signatureAlgorithm: 'SHA256withRSA',
          validFrom: new Date(statusResult.signedAt),
          validTo: new Date(new Date(statusResult.signedAt).getTime() + 365 * 24 * 60 * 60 * 1000),
        } : undefined,
      };
    }

    return {
      success: false,
      message: statusResult.message || 'eSign not yet completed. User must complete signing via the eSign URL.',
    };
  }

  async resendOTP(transactionId: string): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'TruthScreen Aadhaar eSign uses redirect-based OTP. Please use the eSign URL to complete signing.',
    };
  }

  async getUserCertificates(userId: string): Promise<any[]> {
    const certificates = await db.select()
      .from(esignCertificates)
      .where(eq(esignCertificates.userId, userId))
      .orderBy(desc(esignCertificates.signedAt));

    return certificates.map(cert => ({
      id: cert.id,
      userId: cert.userId,
      transactionId: cert.transactionId,
      documentType: cert.documentType,
      documentName: cert.documentName,
      documentHash: cert.documentHash,
      signedDocumentUrl: cert.signedDocumentUrl || '',
      certificateSerial: cert.certificateSerial,
      signerName: cert.signerName,
      signerAadhaarMasked: cert.signerAadhaarMasked,
      signedAt: cert.signedAt,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      signatureAlgorithm: cert.signatureAlgorithm || 'SHA256withRSA',
      status: cert.status as 'valid' | 'expired' | 'revoked',
    }));
  }

  async verifyCertificate(certificateSerial: string): Promise<{
    valid: boolean;
    certificate?: any;
    message: string;
  }> {
    const [cert] = await db.select()
      .from(esignCertificates)
      .where(eq(esignCertificates.certificateSerial, certificateSerial))
      .limit(1);

    if (!cert) {
      return { valid: false, message: 'Certificate not found' };
    }

    const now = new Date();
    if (now > cert.validTo) {
      return { valid: false, certificate: cert, message: 'Certificate has expired' };
    }

    if (cert.status === 'revoked') {
      return { valid: false, certificate: cert, message: 'Certificate has been revoked' };
    }

    return { valid: true, certificate: cert, message: 'Certificate is valid' };
  }
}

export const truthScreenESignService = new TruthScreenESignService();
export default truthScreenESignService;
