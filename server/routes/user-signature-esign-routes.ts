/**
 * User Signature eSign Routes
 * 
 * API endpoints for signing documents using the user's saved signature
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { userSignatureESignService } from '../services/user-signature-esign-service';
import { requireAuth } from '../middleware/roleMiddleware';
import { db } from '../db';
import { userSignatures } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

const signDocumentSchema = z.object({
  signatureId: z.string().optional(),
  signatureDataUrl: z.string().optional(),
  documentBase64: z.string().min(1, 'Document is required'),
  documentName: z.string().min(1, 'Document name is required'),
  documentType: z.enum(['itr_verification', 'form_15ca', 'form_15cb', 'investment_agreement', 'kyc_consent', 'mandate', 'other']),
  signerName: z.string().min(1, 'Signer name is required'),
  signerEmail: z.string().email().optional(),
  signaturePosition: z.object({
    page: z.number().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  includeTimestamp: z.boolean().optional(),
  includeSignerInfo: z.boolean().optional(),
});

router.get('/api/esign/user-signature/status', async (req: Request, res: Response) => {
  res.json({
    service: 'User Signature eSign Service',
    provider: 'user_signature',
    displayName: 'Saved Signature',
    environment: userSignatureESignService.getEnvironment(),
    mockMode: userSignatureESignService.isInMockMode(),
    features: [
      'Upload Image',
      'Draw Signature',
      'Type Signature',
      'Instant Signing',
      'No OTP Required',
      'PDF Embedding',
      'Timestamp',
      'Signer Info',
    ],
    supportedFormats: ['pdf'],
    maxDocumentSize: '10MB',
  });
});

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

router.post('/api/esign/user-signature/sign', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = signDocumentSchema.parse(req.body);

    if (!validated.signatureId && !validated.signatureDataUrl) {
      const [defaultSig] = await db
        .select()
        .from(userSignatures)
        .where(and(
          eq(userSignatures.userId, userId.toString()),
          eq(userSignatures.isDefault, true)
        ))
        .limit(1);
      
      if (!defaultSig) {
        return res.status(400).json({ 
          error: 'No signature provided and no default signature found. Please create a signature first.' 
        });
      }
    }

    const documentBuffer = Buffer.from(validated.documentBase64, 'base64');

    if (documentBuffer.length > MAX_DOCUMENT_SIZE) {
      return res.status(400).json({ 
        error: `Document too large. Maximum size is ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB` 
      });
    }

    const pdfHeader = documentBuffer.slice(0, 5).toString('ascii');
    if (pdfHeader !== '%PDF-') {
      return res.status(400).json({ 
        error: 'Invalid document format. Only PDF files are supported.' 
      });
    }

    const result = await userSignatureESignService.signDocument({
      userId: userId.toString(),
      signatureId: validated.signatureId,
      signatureDataUrl: validated.signatureDataUrl,
      documentBuffer,
      documentName: validated.documentName,
      documentType: validated.documentType,
      signerName: validated.signerName,
      signerEmail: validated.signerEmail,
      signaturePosition: validated.signaturePosition,
      includeTimestamp: validated.includeTimestamp,
      includeSignerInfo: validated.includeSignerInfo,
    });

    if (result.success && result.signedDocumentBuffer) {
      res.json({
        success: true,
        message: result.message,
        transactionId: result.transactionId,
        signedDocumentBase64: result.signedDocumentBuffer.toString('base64'),
        signedAt: result.signedAt,
        signatureMetadata: result.signatureMetadata,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        transactionId: result.transactionId,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[UserSignatureESign] Error signing document:', error);
    res.status(500).json({ error: 'Failed to sign document' });
  }
});

router.get('/api/esign/user-signature/transaction/:transactionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const status = await userSignatureESignService.getSigningStatus(transactionId);
    res.json(status);
  } catch (error) {
    console.error('[UserSignatureESign] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get signing status' });
  }
});

router.post('/api/esign/user-signature/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { signatureDataUrl } = req.body;
    
    if (!signatureDataUrl) {
      return res.status(400).json({ error: 'Signature data URL is required' });
    }

    const result = await userSignatureESignService.validateSignature(signatureDataUrl);
    res.json(result);
  } catch (error) {
    console.error('[UserSignatureESign] Error validating signature:', error);
    res.status(500).json({ error: 'Failed to validate signature' });
  }
});

router.get('/api/esign/user-signature/available', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const signatures = await db
      .select({
        id: userSignatures.id,
        name: userSignatures.name,
        signatureType: userSignatures.signatureType,
        isDefault: userSignatures.isDefault,
        createdAt: userSignatures.createdAt,
      })
      .from(userSignatures)
      .where(eq(userSignatures.userId, userId.toString()));

    const hasSignatures = signatures.length > 0;
    const defaultSignature = signatures.find(s => s.isDefault);

    res.json({
      available: hasSignatures,
      signatureCount: signatures.length,
      defaultSignature: defaultSignature ? {
        id: defaultSignature.id,
        name: defaultSignature.name,
        type: defaultSignature.signatureType,
      } : null,
      signatures: signatures.map(s => ({
        id: s.id,
        name: s.name,
        type: s.signatureType,
        isDefault: s.isDefault,
      })),
    });
  } catch (error) {
    console.error('[UserSignatureESign] Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check signature availability' });
  }
});

export default router;
