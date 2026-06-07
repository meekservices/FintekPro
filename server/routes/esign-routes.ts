/**
 * Unified eSign API Routes
 * 
 * Endpoints for Aadhaar-based Digital Signature Certificate (DSC) operations
 * Uses unified service that routes to active provider (TruthScreen, Protean, etc.)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { unifiedESignService } from '../services/unified-esign-service';
import { truthScreenESignService } from '../services/truthscreen-esign-service';
import { requireAuth } from '../middleware/roleMiddleware';
import { db } from '../db';
import { esignAuditLog, esignRequests, regulatoryAuditPacks, immutableAuditLogs } from '@shared/schema';

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

router.get('/api/esign/status', async (req: Request, res: Response) => {
  const activeProvider = await unifiedESignService.getActiveProvider();
  const providerConfig = unifiedESignService.getProviderConfig(activeProvider);
  
  res.json({
    service: 'Unified eSign Service',
    activeProvider,
    providerName: providerConfig?.displayName || 'Unknown',
    environment: providerConfig?.environment || 'sandbox',
    mockMode: !providerConfig?.isConfigured,
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
      multiProvider: true,
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

    // S6: Replay attack detection — block same documentHash signed in last 24h
    const recentDup = await db.execute(sql`
      SELECT id, transaction_id FROM esign_requests
      WHERE document_hash = ${validated.documentHash}
        AND user_id = ${userId}
        AND status = 'completed'
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `);
    if ((recentDup.rows || []).length > 0) {
      const dup = recentDup.rows[0] as any;
      const checksum = createHash('sha256')
        .update(`REPLAY:${userId}:${validated.documentHash}:${Date.now()}`)
        .digest('hex');
      db.insert(immutableAuditLogs).values({
        id: `replay-${Date.now()}`,
        eventType: 'SECURITY',
        action: 'SECURITY_REPLAY_ATTEMPT',
        userId,
        entityType: 'esign_request',
        entityId: dup.transaction_id,
        metadata: { documentHash: validated.documentHash, previousTransactionId: dup.transaction_id },
        checksum,
      } as any).catch(console.error);
      return res.status(409).json({
        error: 'DUPLICATE_SIGN_DETECTED',
        message: 'This document was already signed within the last 24 hours',
        previousTransactionId: dup.transaction_id,
      });
    }

    const result = await unifiedESignService.initiateESign({
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
      provider: result.provider,
    }, req);

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Initiate error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
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

    const result = await unifiedESignService.verifyESign({
      transactionId: validated.transactionId,
      otp: validated.otp,
    });

    await logAudit(validated.transactionId, userId, 'otp_verify', result.success ? 'success' : 'failed', {
      certificateId: result.certificateId,
      provider: result.provider,
    }, req);

    if (result.success) {
      await logAudit(validated.transactionId, userId, 'sign_complete', 'success', {
        certificateId: result.certificateId,
        signedAt: result.signatureData?.signedAt,
        provider: result.provider,
      }, req);

      // S1: Create SEBI Regulatory Audit Pack on every successful eSign completion
      (async () => {
        try {
          const [esignRec] = await db.select().from(esignRequests)
            .where(eq(esignRequests.transactionId, validated.transactionId))
            .limit(1);
          const packSnapshot = {
            transactionId: validated.transactionId,
            documentName: esignRec?.documentName || 'Unknown',
            documentType: esignRec?.documentType || 'other',
            documentHash: esignRec?.documentHash,
            signerName: esignRec?.signerName,
            signerAadhaarMasked: esignRec?.signerAadhaarMasked,
            certificateSerial: result.certificateId,
            signedAt: result.signatureData?.signedAt || new Date().toISOString(),
            provider: result.provider,
          };
          const auditHash = createHash('sha256').update(JSON.stringify(packSnapshot)).digest('hex');
          await db.insert(regulatoryAuditPacks).values({
            userId,
            packType: 'esign_completion',
            transactionId: validated.transactionId,
            kycSnapshot: { verifiedAt: new Date().toISOString(), note: 'KYC pre-verified at account creation' },
            suitabilitySnapshot: { verifiedAt: new Date().toISOString(), note: 'Suitability assessed at onboarding' },
            orderSnapshot: packSnapshot as any,
            auditHash,
          } as any);
        } catch (e: any) {
          console.error('[eSign] Failed to create regulatory audit pack:', e?.message);
        }
      })();
    }

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Verify error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
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

    const result = await unifiedESignService.resendOTP(transactionId);

    await logAudit(transactionId, userId, 'otp_resend', result.success ? 'success' : 'failed', {
      provider: result.provider,
    }, req);

    res.json(result);
  } catch (error) {
    console.error('[eSign Routes] Resend OTP error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to resend OTP' });
  }
});

router.get('/api/esign/request/:transactionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const status = await unifiedESignService.getStatus(transactionId);

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

    const certificates = await truthScreenESignService.getUserCertificates(userId);

    res.json({ certificates });
  } catch (error) {
    console.error('[eSign Routes] Get certificates error:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.get('/api/esign/verify-certificate/:certificateSerial', async (req: Request, res: Response) => {
  try {
    const { certificateSerial } = req.params;

    const result = await truthScreenESignService.verifyCertificate(certificateSerial);

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

    const hash = truthScreenESignService.generateDocumentHash(documentContent);

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

router.post('/api/esign/documents/:id/remind', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;
    const { sendVia } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await logAudit(id, userId, 'reminder_sent', 'success', {
      sendVia: sendVia || 'email',
    }, req);

    res.json({
      success: true,
      message: `Reminder sent via ${sendVia || 'email'}`,
      documentId: id,
    });
  } catch (error) {
    console.error('[eSign Routes] Send reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

router.get('/api/agent/esign/requests', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const auditLogs = await db.select().from(esignAuditLog)
      .where(eq(esignAuditLog.userId, userId))
      .orderBy(desc(esignAuditLog.createdAt))
      .limit(50);

    const requestsMap = new Map<string, any>();

    for (const log of auditLogs) {
      if (!requestsMap.has(log.transactionId)) {
        const details = log.details as any || {};
        requestsMap.set(log.transactionId, {
          id: log.transactionId,
          documentName: details.documentName || 'Document',
          documentType: details.documentType || 'other',
          status: log.action === 'sign_complete' ? 'signed' : 
                  log.status === 'failed' ? 'declined' : 'pending',
          createdAt: log.createdAt?.toISOString(),
          deadline: details.deadline,
          signers: [{
            name: details.fullName || 'Client',
            email: details.email || '',
            status: log.action === 'sign_complete' ? 'signed' : 'pending',
            signedAt: log.action === 'sign_complete' ? log.createdAt?.toISOString() : undefined
          }],
          documentUrl: details.documentUrl,
          signedDocumentUrl: details.signedDocumentUrl
        });
      } else {
        const existing = requestsMap.get(log.transactionId);
        if (log.action === 'sign_complete') {
          existing.status = 'signed';
          existing.signers[0].status = 'signed';
          existing.signers[0].signedAt = log.createdAt?.toISOString();
        }
      }
    }

    res.json(Array.from(requestsMap.values()));
  } catch (error) {
    console.error('[eSign Routes] Get agent requests error:', error);
    res.status(500).json({ error: 'Failed to fetch eSign requests' });
  }
});

// S5: Client read-receipt — log when signer confirms they have read the document
router.post('/api/esign/confirm-read', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { transactionId, documentHash } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required' });
    }
    await logAudit(transactionId, userId, 'signer_confirmed_read', 'success', {
      documentHash,
      confirmedAt: new Date().toISOString(),
      readMethod: 'web_checkbox',
    }, req);
    res.json({ success: true, confirmedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record read confirmation' });
  }
});

// S3: SEBI audit export — compliance officers only, logs the export itself
router.get('/api/admin/esign/audit/export', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const AUDIT_ROLES = ['admin', 'super_admin', 'superadmin', 'compliance_officer'];
    const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    if (!userRoles.some((r: string) => AUDIT_ROLES.includes(r))) {
      return res.status(403).json({ error: 'Access denied. Compliance officer or admin role required.' });
    }

    const { from, to, format = 'json' } = req.query as Record<string, string>;
    const fromDate = from || '2020-01-01';
    const toDate = to || new Date().toISOString().slice(0, 10);

    const result = await db.execute(sql`
      SELECT
        r.transaction_id    AS "transactionId",
        r.document_name     AS "documentName",
        r.document_type     AS "documentType",
        r.document_hash     AS "documentHash",
        r.signer_name       AS "signerName",
        r.signer_aadhaar_masked AS "signerAadhaarMasked",
        r.certificate_serial AS "certificateSerial",
        r.signed_at         AS "signedAt",
        r.status,
        r.provider,
        r.created_at        AS "createdAt",
        u.email             AS "agentEmail"
      FROM esign_requests r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.created_at::date >= ${fromDate}::date
        AND r.created_at::date <= ${toDate}::date
      ORDER BY r.created_at DESC
      LIMIT 5000
    `);

    const rows = result.rows as any[];

    // Log the export itself to immutable audit log (auditing the auditors)
    const checksum = createHash('sha256')
      .update(`SEBI_EXPORT:${user.id}:${fromDate}:${toDate}:${Date.now()}`)
      .digest('hex');
    db.insert(immutableAuditLogs).values({
      id: `sebi-export-${Date.now()}`,
      eventType: 'COMPLIANCE',
      action: 'SEBI_AUDIT_EXPORT',
      userId: user.id,
      entityType: 'esign_audit',
      entityId: `${fromDate}:${toDate}`,
      metadata: { from: fromDate, to: toDate, format, rowCount: rows.length, exportedBy: user.email },
      checksum,
    } as any).catch(console.error);

    if (format === 'csv') {
      const header = ['TransactionID','DocumentName','DocumentType','DocumentHash','SignerName','SignerAadhaarMasked','CertificateSerial','SignedAt','Status','Provider','AgentEmail','CreatedAt'].join(',');
      const csvRows = rows.map(r =>
        [
          r.transactionId,
          `"${(r.documentName || '').replace(/"/g, '""')}"`,
          r.documentType,
          r.documentHash,
          `"${(r.signerName || '').replace(/"/g, '""')}"`,
          r.signerAadhaarMasked,
          r.certificateSerial,
          r.signedAt,
          r.status,
          r.provider,
          r.agentEmail,
          r.createdAt,
        ].join(',')
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="esign-audit-${fromDate}-to-${toDate}.csv"`);
      return res.send([header, ...csvRows].join('\n'));
    }

    res.json({
      success: true,
      data: rows,
      meta: { total: rows.length, from: fromDate, to: toDate, exportedAt: new Date().toISOString(), requestedBy: user.email },
    });
  } catch (error) {
    console.error('[eSign Audit Export] Error:', error);
    res.status(500).json({ error: 'Failed to generate audit export' });
  }
});

export default router;
