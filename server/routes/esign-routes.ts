/**
 * AuthBridge Aadhaar eSign API Routes
 * 
 * Endpoints for Aadhaar-based Digital Signature Certificate (DSC) operations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authBridgeESignService } from '../authbridge-esign-service';
import { requireAuth } from '../middleware/roleMiddleware';
import { db } from '../db';
import { esignAuditLog } from '@shared/schema';

const router = Router();
const isAuthenticated = requireAuth;

const initiateESignSchema = z.object({
  documentType: z.enum(['itr_verification', 'form_15ca', 'form_15cb', 'investment_agreement', 'kyc_consent', 'mandate', 'other']),
  documentName: z.string().min(1, 'Document name is required'),
  documentHash: z.string().min(1, 'Document hash is required'),
  documentUrl: z.string().optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Invalid Aadhaar number'),
  fullName: z.string().min(1, 'Full name is required'),
});

const verifyOTPSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

function logAudit(
  transactionId: string,
  userId: string | null,
  action: string,
  status: string,
  details?: object,
  req?: Request
) {
  return db.insert(esignAuditLog).values({
    transactionId,
    userId,
    action,
    status,
    details: details || {},
    ipAddress: req?.ip || null,
    userAgent: req?.get('user-agent') || null,
  });
}

router.get('/api/esign/status', (req: Request, res: Response) => {
  res.json({
    service: 'AuthBridge Aadhaar eSign',
    environment: authBridgeESignService.getEnvironment(),
    mockMode: authBridgeESignService.isInMockMode(),
    supportedDocuments: [
      'itr_verification',
      'form_15ca',
      'form_15cb',
      'investment_agreement',
      'kyc_consent',
      'mandate',
      'other'
    ],
    features: {
      aadhaarOTP: true,
      certificateGeneration: true,
      auditTrail: true,
    }
  });
});

router.post('/api/esign/initiate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = initiateESignSchema.parse(req.body);

    const result = await authBridgeESignService.initiateESign({
      userId,
      documentType: validated.documentType,
      documentName: validated.documentName,
      documentHash: validated.documentHash,
      documentUrl: validated.documentUrl,
      aadhaarNumber: validated.aadhaarNumber,
      fullName: validated.fullName,
    });

    await logAudit(result.transactionId, userId, 'initiate', result.success ? 'success' : 'failed', {
      documentType: validated.documentType,
      documentName: validated.documentName,
    }, req);

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Initiate error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: (error as Error).message || 'Failed to initiate eSign' });
  }
});

router.post('/api/esign/verify', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = verifyOTPSchema.parse(req.body);

    const result = await authBridgeESignService.verifyESign({
      transactionId: validated.transactionId,
      otp: validated.otp,
    });

    await logAudit(validated.transactionId, userId, 'otp_verify', result.success ? 'success' : 'failed', {
      certificateId: result.certificateId,
    }, req);

    if (result.success) {
      await logAudit(validated.transactionId, userId, 'sign_complete', 'success', {
        certificateId: result.certificateId,
        signedAt: result.signatureData?.signedAt,
      }, req);
    }

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Verify error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: (error as Error).message || 'Failed to verify OTP' });
  }
});

router.post('/api/esign/resend-otp', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const result = await authBridgeESignService.resendOTP(transactionId);

    await logAudit(transactionId, userId, 'otp_resend', result.success ? 'success' : 'failed', {}, req);

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Resend OTP error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to resend OTP' });
  }
});

router.get('/api/esign/request/:transactionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const status = await authBridgeESignService.getStatus(transactionId);

    res.json(status);
  } catch (error) {
    console.error('[eSign Routes] Get status error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to get status' });
  }
});

router.get('/api/esign/certificates', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const certificates = await authBridgeESignService.getUserCertificates(userId);

    res.json({ certificates });
  } catch (error) {
    console.error('[eSign Routes] Get certificates error:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.get('/api/esign/verify-certificate/:certificateSerial', async (req: Request, res: Response) => {
  try {
    const { certificateSerial } = req.params;

    const result = await authBridgeESignService.verifyCertificate(certificateSerial);

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Verify certificate error:', error);
    res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

router.post('/api/esign/generate-hash', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { documentContent } = req.body;
    if (!documentContent) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    const hash = authBridgeESignService.generateDocumentHash(documentContent);

    res.json({ hash, algorithm: 'SHA-256' });
  } catch (error) {
    console.error('[eSign Routes] Generate hash error:', error);
    res.status(500).json({ error: 'Failed to generate document hash' });
  }
});

router.get('/api/esign/download/:transactionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { transactionId } = req.params;

    await logAudit(transactionId, userId, 'download', 'success', {}, req);

    res.json({
      success: true,
      message: 'Signed document download link generated',
      downloadUrl: `/api/esign/document/${transactionId}`,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('[eSign Routes] Download error:', error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});

export default router;
