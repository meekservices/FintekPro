/**
 * DSC Token eSign API Routes
 * 
 * Handles Digital Signature Certificate (DSC) token-based document signing
 * Endpoints for initiating signing sessions, submitting signatures, and verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { unifiedESignService } from '../services/unified-esign-service';
import { dscTokenESignService } from '../services/dsc-token-esign-service';
import { auditLogService } from '../services/audit-log-service';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const router = Router();

const DSCCertificateInfoSchema = z.object({
  serialNumber: z.string(),
  subject: z.object({
    commonName: z.string(),
    organization: z.string().optional(),
    organizationalUnit: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    locality: z.string().optional(),
    email: z.string().optional(),
  }),
  issuer: z.object({
    commonName: z.string(),
    organization: z.string().optional(),
    country: z.string().optional(),
  }),
  validFrom: z.string().transform(s => new Date(s)),
  validTo: z.string().transform(s => new Date(s)),
  certificateClass: z.enum(['Class1', 'Class2', 'Class3']),
  certificateType: z.enum(['Signing', 'Encryption', 'Both']),
  keyUsage: z.array(z.string()),
  fingerprint: z.object({
    sha256: z.string(),
    sha1: z.string(),
  }),
  publicKey: z.string(),
});

const InitiateDSCSigningSchema = z.object({
  documentType: z.enum(['itr_verification', 'form_15ca', 'form_15cb', 'investment_agreement', 'kyc_consent', 'mandate', 'other']),
  documentName: z.string(),
  documentHash: z.string(),
  documentUrl: z.string().optional(),
  signerName: z.string(),
  signerPan: z.string().optional(),
  certificateInfo: DSCCertificateInfoSchema,
  signingMethod: z.enum(['usb_token', 'smart_card', 'software']),
});

const SubmitDSCSignatureSchema = z.object({
  transactionId: z.string(),
  signature: z.string(),
  signatureAlgorithm: z.enum(['SHA256withRSA', 'SHA384withRSA', 'SHA512withRSA', 'SHA256withECDSA']),
  signedAt: z.string().transform(s => new Date(s)),
});

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

router.get('/dsc/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = unifiedESignService.getProviderConfig('dsc_token');
    const knownIssuers = unifiedESignService.getDSCKnownIssuers();
    const supportedAlgorithms = unifiedESignService.getDSCSupportedAlgorithms();

    res.json({
      success: true,
      provider: 'dsc_token',
      displayName: config?.displayName || 'DSC Token (Hardware)',
      description: config?.description || 'Digital Signature Certificate via USB Token or Smart Card',
      features: config?.features || [],
      knownIssuers,
      supportedAlgorithms,
      certificateClasses: ['Class1', 'Class2', 'Class3'],
      signingMethods: ['usb_token', 'smart_card', 'software'],
      requirements: {
        Class1: 'Basic identity verification - Email/Password',
        Class2: 'Organizational verification - Document submission',
        Class3: 'In-person identity verification - Physical presence required',
      },
      supportedDocumentTypes: [
        'itr_verification',
        'form_15ca',
        'form_15cb',
        'investment_agreement',
        'kyc_consent',
        'mandate',
        'other',
      ],
      minimumClassForFinancial: 'Class2',
      offlineCapable: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dsc/validate-certificate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = DSCCertificateInfoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid certificate data',
        details: result.error.issues,
      });
    }

    const validation = await dscTokenESignService.validateCertificate(result.data as any);

    res.json({
      success: validation.valid,
      valid: validation.valid,
      errors: validation.issues,
      warnings: validation.warnings,
      details: validation.details,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dsc/initiate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = InitiateDSCSigningSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: result.error.issues,
      });
    }

    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role || 'client';
    if (!userId) {
      throw new AppError('User ID not found', 401, 'AUTH_REQUIRED');
    }

    await auditLogService.log('DSC_ESIGN', 'SESSION_INITIATED', {
      userId,
      userRole,
      entityType: 'esign_request',
      newState: {
        documentType: result.data.documentType,
        documentName: result.data.documentName,
        signerName: result.data.signerName,
        signingMethod: result.data.signingMethod,
        certificateClass: result.data.certificateInfo.certificateClass,
        certificateIssuer: result.data.certificateInfo.issuer.commonName,
        initiatedAt: new Date().toISOString(),
      },
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.path,
        requestMethod: req.method,
      },
    });

    const response = await unifiedESignService.initiateDSCSigningSession({
      userId,
      ...result.data,
    });

    if (response.success) {
      await auditLogService.log('DSC_ESIGN', 'SESSION_CREATED', {
        userId,
        userRole,
        entityType: 'esign_request',
        entityId: response.transactionId,
        newState: {
          transactionId: response.transactionId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        metadata: {
          ip: req.ip,
        },
      });
    }

    res.json(response);
  } catch (error) {
    const userId = (req.user as any)?.id;

    await auditLogService.log('DSC_ESIGN', 'SESSION_INITIATION_FAILED', {
      userId,
      entityType: 'esign_request',
      newState: {
        error: (error as Error).message,
        documentName: req.body?.documentName,
        failedAt: new Date().toISOString(),
      },
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    next(error);
  }
});

router.post('/dsc/submit-signature', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = SubmitDSCSignatureSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature data',
        details: result.error.issues,
      });
    }

    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role || 'client';

    await auditLogService.log('DSC_ESIGN', 'SIGNATURE_SUBMITTED', {
      userId,
      userRole,
      entityType: 'esign_request',
      entityId: result.data.transactionId,
      newState: {
        transactionId: result.data.transactionId,
        signatureAlgorithm: result.data.signatureAlgorithm,
        signedAt: result.data.signedAt.toISOString(),
        submittedAt: new Date().toISOString(),
      },
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.path,
        requestMethod: req.method,
      },
    });

    const response = await unifiedESignService.submitDSCSignature(result.data);

    if (response.success) {
      await auditLogService.log('DSC_ESIGN', 'SIGNATURE_VERIFIED', {
        userId,
        userRole,
        entityType: 'esign_request',
        entityId: result.data.transactionId,
        newState: {
          transactionId: result.data.transactionId,
          certificateId: response.certificateId,
          status: 'completed',
          verifiedAt: new Date().toISOString(),
        },
        metadata: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    }

    res.json(response);
  } catch (error) {
    const userId = (req.user as any)?.id;
    const transactionId = req.body?.transactionId;

    await auditLogService.log('DSC_ESIGN', 'SIGNATURE_SUBMISSION_FAILED', {
      userId,
      entityType: 'esign_request',
      entityId: transactionId,
      newState: {
        error: (error as Error).message,
        failedAt: new Date().toISOString(),
      },
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    next(error);
  }
});

router.get('/dsc/status/:transactionId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId.startsWith('DSC-')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DSC transaction ID',
      });
    }

    const status = await dscTokenESignService.getStatus(transactionId);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dsc/cancel/:transactionId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;
    const userId = (req.user as any)?.id;

    if (!transactionId.startsWith('DSC-')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DSC transaction ID',
      });
    }

    const response = await unifiedESignService.cancelDSCSession(transactionId, userId, reason);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/dsc/download/:transactionId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId.startsWith('DSC-')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DSC transaction ID',
      });
    }

    const status = await dscTokenESignService.getStatus(transactionId);

    if (status.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Document not yet signed',
      });
    }

    res.json({
      success: true,
      message: 'Signed document available',
      transactionId,
      documentName: status.documentName,
      downloadUrl: `/api/esign/dsc/download/${transactionId}/document`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
