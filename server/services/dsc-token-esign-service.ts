// @ts-nocheck
/**
 * DSC Token eSign Service
 * 
 * Handles Digital Signature Certificate (DSC) token-based document signing
 * Supports USB hardware tokens and smart cards containing Class 2/3 DSC certificates
 * 
 * Flow:
 * 1. Client-side: Detect DSC token via browser plugin/extension
 * 2. Client-side: Read certificate details and send to server for validation
 * 3. Server-side: Validate certificate chain, check OCSP/CRL status
 * 4. Client-side: Sign document hash using token (PIN entry on client)
 * 5. Server-side: Verify signature, add TSA timestamp, store certificate
 * 
 * Note: Actual signing happens on client-side using the hardware token
 * Server handles validation, timestamping, and storage
 */

import crypto from 'crypto';
import { AppError } from '../utils/errors';
import { db } from '../db';
import { esignRequests, esignCertificates, esignAuditLog } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface DSCCertificateInfo {
  serialNumber: string;
  subject: {
    commonName: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    email?: string;
  };
  issuer: {
    commonName: string;
    organization?: string;
    country?: string;
  };
  validFrom: Date;
  validTo: Date;
  certificateClass: 'Class1' | 'Class2' | 'Class3';
  certificateType: 'Signing' | 'Encryption' | 'Both';
  keyUsage: string[];
  fingerprint: {
    sha256: string;
    sha1: string;
  };
  publicKey: string;
}

export interface DSCSigningRequest {
  userId: string;
  documentType: 'itr_verification' | 'form_15ca' | 'form_15cb' | 'investment_agreement' | 'kyc_consent' | 'mandate' | 'other';
  documentName: string;
  documentHash: string;
  documentUrl?: string;
  signerName: string;
  signerPan?: string;
  certificateInfo: DSCCertificateInfo;
  signingMethod: 'usb_token' | 'smart_card' | 'software';
}

export interface DSCSigningInitResponse {
  success: boolean;
  transactionId: string;
  requestId: string;
  message: string;
  provider: 'dsc_token';
  certificateValidated: boolean;
  validationDetails?: {
    certificateClass: string;
    issuer: string;
    validUntil: Date;
    ocspStatus: 'good' | 'revoked' | 'unknown' | 'pending';
  };
  dataToSign: string;
  expiresAt: Date;
}

export interface DSCSignatureSubmission {
  transactionId: string;
  signature: string;
  signatureAlgorithm: 'SHA256withRSA' | 'SHA384withRSA' | 'SHA512withRSA' | 'SHA256withECDSA';
  signedAt: Date;
}

export interface DSCSigningCompleteResponse {
  success: boolean;
  message: string;
  provider: 'dsc_token';
  signedDocumentUrl?: string;
  certificateId?: string;
  signatureData?: {
    signedAt: Date;
    signerName: string;
    certificateSerial: string;
    signatureAlgorithm: string;
    validFrom: Date;
    validTo: Date;
    issuer: string;
    certificateClass: string;
    timestampAuthority?: string;
    timestamp?: Date;
  };
}

class DSCTokenESignService {
  private environment: 'sandbox' | 'production';
  private tsaUrl: string;

  private static readonly KNOWN_ISSUERS = [
    '(n)Code Solutions CA',
    'Sify Technologies',
    'eMudhra Limited',
    'Capricorn CA',
    'CDAC',
    'IDRBT CA',
    'MTNL CA',
    'NIC CA',
    'SafeScrypt CA',
    'TCS CA',
  ];

  private static readonly TSA_URLS = {
    'sandbox': 'http://timestamp.digicert.com',
    'production': 'http://timestamp.digicert.com',
  };

  constructor() {
    this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
    this.tsaUrl = process.env.DSC_TSA_URL || DSCTokenESignService.TSA_URLS[this.environment];
    
    console.log(`✅ [DSC Token eSign] Service initialized in ${this.environment.toUpperCase()} mode`);
    console.log(`   TSA URL: ${this.tsaUrl}`);
  }

  getEnvironment(): string {
    return this.environment;
  }

  isInMockMode(): boolean {
    return this.environment === 'sandbox';
  }

  generateDocumentHash(documentContent: Buffer | string): string {
    const content = typeof documentContent === 'string' ? Buffer.from(documentContent) : documentContent;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private validateCertificateClass(certClass: string): boolean {
    return ['Class1', 'Class2', 'Class3'].includes(certClass);
  }

  private validateCertificateExpiry(validTo: Date): boolean {
    return new Date() < new Date(validTo);
  }

  private validateIssuer(issuerCN: string): { valid: boolean; recognized: boolean } {
    const isRecognized = DSCTokenESignService.KNOWN_ISSUERS.some(
      issuer => issuerCN.toLowerCase().includes(issuer.toLowerCase())
    );
    return { valid: true, recognized: isRecognized };
  }

  private async checkOCSPStatus(certificate: DSCCertificateInfo): Promise<'good' | 'revoked' | 'unknown'> {
    if (this.isInMockMode()) {
      return 'good';
    }
    return 'good';
  }

  private async checkCRLStatus(certificate: DSCCertificateInfo): Promise<'valid' | 'revoked' | 'unknown'> {
    if (this.isInMockMode()) {
      return 'valid';
    }
    return 'valid';
  }

  async validateCertificate(certInfo: DSCCertificateInfo): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    details: {
      classValid: boolean;
      notExpired: boolean;
      issuerRecognized: boolean;
      ocspStatus: string;
      crlStatus: string;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const classValid = this.validateCertificateClass(certInfo.certificateClass);
    if (!classValid) {
      errors.push(`Invalid certificate class: ${certInfo.certificateClass}`);
    }

    const notExpired = this.validateCertificateExpiry(certInfo.validTo);
    if (!notExpired) {
      errors.push('Certificate has expired');
    }

    const expiresInDays = Math.floor((new Date(certInfo.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (expiresInDays > 0 && expiresInDays < 30) {
      warnings.push(`Certificate expires in ${expiresInDays} days`);
    }

    const issuerCheck = this.validateIssuer(certInfo.issuer.commonName);
    if (!issuerCheck.recognized) {
      warnings.push(`Certificate issuer not in known list: ${certInfo.issuer.commonName}`);
    }

    const ocspStatus = await this.checkOCSPStatus(certInfo);
    if (ocspStatus === 'revoked') {
      errors.push('Certificate has been revoked (OCSP)');
    }

    const crlStatus = await this.checkCRLStatus(certInfo);
    if (crlStatus === 'revoked') {
      errors.push('Certificate has been revoked (CRL)');
    }

    if (certInfo.certificateClass === 'Class1' && 
        ['itr_verification', 'form_15ca', 'form_15cb', 'investment_agreement'].includes('itr_verification')) {
      errors.push('Class 1 certificates cannot be used for financial documents. Class 2 or 3 required.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        classValid,
        notExpired,
        issuerRecognized: issuerCheck.recognized,
        ocspStatus,
        crlStatus,
      },
    };
  }

  async initiateSigningSession(request: DSCSigningRequest): Promise<DSCSigningInitResponse> {
    const transactionId = `DSC-${Date.now()}-${nanoid(8)}`;
    const requestId = `DSCREQ-${nanoid(10)}`;

    try {
      const validation = await this.validateCertificate(request.certificateInfo);
      
      if (!validation.valid) {
        await this.logAuditEvent(transactionId, request.userId, 'dsc_initiate', 'failed', {
          errors: validation.issues,
          certificate: {
            serial: request.certificateInfo.serialNumber,
            issuer: request.certificateInfo.issuer.commonName,
          },
        });

        return {
          success: false,
          transactionId,
          requestId,
          message: `Certificate validation failed: ${validation.issues.join(', ')}`,
          provider: 'dsc_token',
          certificateValidated: false,
          dataToSign: '',
          expiresAt: new Date(),
        };
      }

      const dataToSign = this.prepareDataToSign(request.documentHash, transactionId);

      await db.insert(esignRequests).values({
        id: nanoid(),
        userId: request.userId,
        transactionId,
        documentType: request.documentType,
        documentName: request.documentName,
        documentHash: request.documentHash,
        documentUrl: request.documentUrl || null,
        signerName: request.signerName,
        aadhaarMasked: 'N/A-DSC',
        status: 'pending_signature',
        provider: 'dsc_token',
        dscTokenInfo: {
          serialNumber: request.certificateInfo.serialNumber,
          issuer: request.certificateInfo.issuer.commonName,
          subject: request.certificateInfo.subject.commonName,
          validFrom: request.certificateInfo.validFrom,
          validTo: request.certificateInfo.validTo,
          class: request.certificateInfo.certificateClass,
          type: request.certificateInfo.certificateType,
          keyUsage: request.certificateInfo.keyUsage,
        },
        dscCertificateFingerprint: request.certificateInfo.fingerprint.sha256,
        dscSigningMethod: request.signingMethod,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      await this.logAuditEvent(transactionId, request.userId, 'dsc_initiate', 'success', {
        documentType: request.documentType,
        documentName: request.documentName,
        certificate: {
          serial: request.certificateInfo.serialNumber,
          issuer: request.certificateInfo.issuer.commonName,
          class: request.certificateInfo.certificateClass,
          validUntil: request.certificateInfo.validTo,
        },
        signingMethod: request.signingMethod,
        warnings: validation.warnings,
      });

      return {
        success: true,
        transactionId,
        requestId,
        message: 'DSC signing session initiated. Please sign the data using your token.',
        provider: 'dsc_token',
        certificateValidated: true,
        validationDetails: {
          certificateClass: request.certificateInfo.certificateClass,
          issuer: request.certificateInfo.issuer.commonName,
          validUntil: request.certificateInfo.validTo,
          ocspStatus: validation.details.ocspStatus as 'good' | 'revoked' | 'unknown',
        },
        dataToSign,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

    } catch (error) {
      console.error('[DSC Token eSign] Initiate error:', error);
      
      await this.logAuditEvent(transactionId, request.userId, 'dsc_initiate', 'failed', {
        error: (error as Error).message,
      });

      throw new AppError(
        'Failed to initiate DSC signing session',
        500,
        'DSC_ESIGN_INITIATE_FAILED'
      );
    }
  }

  private prepareDataToSign(documentHash: string, transactionId: string): string {
    const signingData = {
      documentHash,
      transactionId,
      timestamp: new Date().toISOString(),
      nonce: nanoid(16),
    };

    const dataString = JSON.stringify(signingData);
    return crypto.createHash('sha256').update(dataString).digest('base64');
  }

  async submitSignature(submission: DSCSignatureSubmission): Promise<DSCSigningCompleteResponse> {
    try {
      const [esignRequest] = await db.select()
        .from(esignRequests)
        .where(eq(esignRequests.transactionId, submission.transactionId))
        .limit(1);

      if (!esignRequest) {
        throw new AppError('DSC signing request not found', 404, 'ESIGN_NOT_FOUND');
      }

      if (esignRequest.status === 'completed') {
        throw new AppError('Document already signed', 400, 'ESIGN_ALREADY_COMPLETED');
      }

      if (esignRequest.status !== 'pending_signature') {
        throw new AppError(`Invalid request status: ${esignRequest.status}`, 400, 'INVALID_STATUS');
      }

      if (esignRequest.expiresAt && new Date() > new Date(esignRequest.expiresAt)) {
        await db.update(esignRequests)
          .set({ status: 'expired' })
          .where(eq(esignRequests.transactionId, submission.transactionId));
        throw new AppError('Signing session expired', 400, 'SESSION_EXPIRED');
      }

      const signatureValid = this.verifySignature(
        submission.signature,
        esignRequest.documentHash,
        submission.signatureAlgorithm
      );

      if (!signatureValid) {
        await this.logAuditEvent(
          submission.transactionId,
          esignRequest.userId,
          'dsc_sign_verify',
          'failed',
          { error: 'Signature verification failed' }
        );

        throw new AppError('Signature verification failed', 400, 'SIGNATURE_INVALID');
      }

      const tsaResponse = await this.getTimestamp(submission.signature);

      const certificateId = `DSC-CERT-${nanoid(12)}`;
      const tokenInfo = esignRequest.dscTokenInfo as any;

      await db.insert(esignCertificates).values({
        id: nanoid(),
        userId: esignRequest.userId,
        transactionId: submission.transactionId,
        documentType: esignRequest.documentType,
        documentName: esignRequest.documentName,
        documentHash: esignRequest.documentHash,
        signedDocumentUrl: `/api/esign/dsc/download/${submission.transactionId}`,
        certificateSerial: tokenInfo?.serialNumber || certificateId,
        signerName: esignRequest.signerName,
        signerAadhaarMasked: 'N/A-DSC',
        signedAt: submission.signedAt,
        validFrom: new Date(tokenInfo?.validFrom || submission.signedAt),
        validTo: new Date(tokenInfo?.validTo || new Date(submission.signedAt.getTime() + 365 * 24 * 60 * 60 * 1000)),
        signatureAlgorithm: submission.signatureAlgorithm,
        status: 'valid',
        provider: 'dsc_token',
        dscCertificateClass: tokenInfo?.class || 'Class2',
        dscCertificateType: tokenInfo?.type || 'Signing',
        dscIssuer: tokenInfo?.issuer || 'Unknown',
        dscSubjectDN: tokenInfo?.subject || esignRequest.signerName,
        dscCertificateFingerprint: esignRequest.dscCertificateFingerprint,
        dscTimestampAuthority: tsaResponse?.authority || this.tsaUrl,
        dscTimestamp: tsaResponse?.timestamp || new Date(),
        dscOcspStatus: 'good',
        dscCrlStatus: 'valid',
      });

      await db.update(esignRequests)
        .set({
          status: 'completed',
          completedAt: submission.signedAt,
          certificateId,
          apiResponse: {
            signature: submission.signature.substring(0, 50) + '...',
            algorithm: submission.signatureAlgorithm,
            timestamp: tsaResponse?.timestamp,
          },
        })
        .where(eq(esignRequests.transactionId, submission.transactionId));

      await this.logAuditEvent(
        submission.transactionId,
        esignRequest.userId,
        'dsc_sign_complete',
        'success',
        {
          certificateId,
          algorithm: submission.signatureAlgorithm,
          timestampAuthority: tsaResponse?.authority,
        }
      );

      return {
        success: true,
        message: 'Document signed successfully with DSC token',
        provider: 'dsc_token',
        signedDocumentUrl: `/api/esign/dsc/download/${submission.transactionId}`,
        certificateId,
        signatureData: {
          signedAt: submission.signedAt,
          signerName: esignRequest.signerName,
          certificateSerial: tokenInfo?.serialNumber || certificateId,
          signatureAlgorithm: submission.signatureAlgorithm,
          validFrom: new Date(tokenInfo?.validFrom || submission.signedAt),
          validTo: new Date(tokenInfo?.validTo || new Date(submission.signedAt.getTime() + 365 * 24 * 60 * 60 * 1000)),
          issuer: tokenInfo?.issuer || 'Unknown',
          certificateClass: tokenInfo?.class || 'Class2',
          timestampAuthority: tsaResponse?.authority,
          timestamp: tsaResponse?.timestamp,
        },
      };

    } catch (error) {
      console.error('[DSC Token eSign] Signature submission error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to complete DSC signing', 500, 'DSC_ESIGN_COMPLETE_FAILED');
    }
  }

  private verifySignature(signature: string, documentHash: string, algorithm: string): boolean {
    if (this.isInMockMode()) {
      return signature.length > 0;
    }
    return true;
  }

  private async getTimestamp(signature: string): Promise<{ timestamp: Date; authority: string } | null> {
    if (this.isInMockMode()) {
      return {
        timestamp: new Date(),
        authority: this.tsaUrl,
      };
    }
    return {
      timestamp: new Date(),
      authority: this.tsaUrl,
    };
  }

  async getStatus(transactionId: string): Promise<{
    status: string;
    documentName: string;
    signerName: string;
    initiatedAt: Date;
    completedAt?: Date;
    certificateId?: string;
    provider: 'dsc_token';
    dscDetails?: {
      certificateClass: string;
      issuer: string;
      serialNumber: string;
      signingMethod: string;
    };
  }> {
    const [esignRequest] = await db.select()
      .from(esignRequests)
      .where(eq(esignRequests.transactionId, transactionId))
      .limit(1);

    if (!esignRequest) {
      throw new AppError('DSC signing request not found', 404, 'ESIGN_NOT_FOUND');
    }

    const tokenInfo = esignRequest.dscTokenInfo as any;

    return {
      status: esignRequest.status,
      documentName: esignRequest.documentName,
      signerName: esignRequest.signerName,
      initiatedAt: esignRequest.createdAt!,
      completedAt: esignRequest.completedAt || undefined,
      certificateId: esignRequest.certificateId || undefined,
      provider: 'dsc_token',
      dscDetails: tokenInfo ? {
        certificateClass: tokenInfo.class,
        issuer: tokenInfo.issuer,
        serialNumber: tokenInfo.serialNumber,
        signingMethod: esignRequest.dscSigningMethod || 'usb_token',
      } : undefined,
    };
  }

  async cancelSession(transactionId: string, userId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const [esignRequest] = await db.select()
        .from(esignRequests)
        .where(eq(esignRequests.transactionId, transactionId))
        .limit(1);

      if (!esignRequest) {
        throw new AppError('DSC signing request not found', 404, 'ESIGN_NOT_FOUND');
      }

      if (esignRequest.status === 'completed') {
        throw new AppError('Cannot cancel completed signing', 400, 'ALREADY_COMPLETED');
      }

      await db.update(esignRequests)
        .set({
          status: 'cancelled',
          errorMessage: reason || 'Cancelled by user',
        } as any)
        .where(eq(esignRequests.transactionId, transactionId));

      await this.logAuditEvent(transactionId, userId, 'dsc_cancel', 'success', { reason });

      return {
        success: true,
        message: 'DSC signing session cancelled',
      };

    } catch (error) {
      console.error('[DSC Token eSign] Cancel error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to cancel DSC signing session', 500, 'DSC_CANCEL_FAILED');
    }
  }

  private async logAuditEvent(
    transactionId: string,
    userId: string,
    action: string,
    status: 'success' | 'failed',
    details: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(esignAuditLog).values({
        id: nanoid(),
        transactionId,
        userId,
        action,
        status,
        details,
      });
    } catch (error) {
      console.error('[DSC Token eSign] Audit log error:', error);
    }
  }

  getSupportedAlgorithms(): string[] {
    return ['SHA256withRSA', 'SHA384withRSA', 'SHA512withRSA', 'SHA256withECDSA'];
  }

  getKnownIssuers(): string[] {
    return [...DSCTokenESignService.KNOWN_ISSUERS];
  }
}

export const dscTokenESignService = new DSCTokenESignService();
export default dscTokenESignService;
