import { Express, Request, Response } from 'express';
import { sandboxKYCService } from '../services/sandbox-kyc-service';

/**
 * EntityLocker (KYB) Routes — Gap 1
 *
 * EntityLocker is Sandbox.co.in's business KYB verification system.
 * It provides a redirect-based OAuth-like flow for verifying business entities —
 * GST certificates, MCA incorporation certificates, and bank account details for companies.
 *
 * Flow:
 *   1. POST /api/kyc/entitylocker/sessions/init → get { sessionId, authorizationUrl }
 *   2. Redirect business user to authorizationUrl
 *   3. After consent, Sandbox calls your webhook (kyc.entitylocker.done event)
 *   4. POST /api/kyc/entitylocker/fetch with sessionId → get verified documents
 *
 * Supported document types:
 *   - gst_certificate       — GST registration certificate (GSTIN, legal name, trade name, address)
 *   - incorporation_certificate — MCA/ROC company incorporation certificate
 *   - bank_account          — Verified bank account details (account no, IFSC, name match)
 */
export function registerEntityLockerRoutes(app: Express): void {

  // ============================================================
  // INITIATE ENTITYLOCKER SESSION
  // ============================================================

  /**
   * POST /api/kyc/entitylocker/sessions/init
   * Initiate an EntityLocker KYB verification session.
   * Body: { redirectUrl, flow?, consentExpiry? }
   *   redirectUrl    — URL to redirect business user back to after consent (must be https)
   *   flow           — "signin" (default) or "signup" (first-time EntityLocker registration)
   *   consentExpiry  — Unix timestamp ms for consent expiry (min: now + 1 hour; default: 24h)
   * Returns: { sessionId, authorizationUrl, transactionId }
   *   → Redirect business user to authorizationUrl to complete verification.
   */
  app.post('/api/kyc/entitylocker/sessions/init', async (req: Request, res: Response) => {
    try {
      const { redirectUrl, flow, consentExpiry } = req.body;

      if (!redirectUrl) {
        return res.status(400).json({
          success: false,
          message: 'redirectUrl is required (must start with https://)',
        });
      }
      if (!/^https?:\/\/.+/.test(redirectUrl)) {
        return res.status(400).json({
          success: false,
          message: 'redirectUrl must be a valid URL (http:// or https://)',
        });
      }
      if (flow && !['signin', 'signup'].includes(flow)) {
        return res.status(400).json({
          success: false,
          message: 'flow must be "signin" or "signup"',
        });
      }
      if (consentExpiry !== undefined && Number(consentExpiry) < Date.now() + 3600000) {
        return res.status(400).json({
          success: false,
          message: 'consentExpiry must be at least 1 hour from now',
        });
      }

      const result = await sandboxKYCService.initiateEntityLockerSession(
        redirectUrl,
        (flow as 'signin' | 'signup') ?? 'signin',
        consentExpiry ? Number(consentExpiry) : undefined,
      );

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('[EntityLocker] initiate session error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initiate EntityLocker session',
      });
    }
  });

  // ============================================================
  // FETCH VERIFIED BUSINESS DOCUMENT
  // ============================================================

  /**
   * POST /api/kyc/entitylocker/fetch
   * Fetch a verified business document from an EntityLocker session.
   * Call this after receiving the kyc.entitylocker.done webhook event.
   * Body: { sessionId, documentType }
   *   sessionId    — Session ID from the /sessions/init response
   *   documentType — One of:
   *                    "gst_certificate"         — GST registration details
   *                    "incorporation_certificate" — MCA/ROC incorporation cert
   *                    "bank_account"            — Business bank account verification
   * Returns: { documentType, gstin, legalName, tradeName?, documentData, pdfUrl?, verifiedAt }
   */
  app.post('/api/kyc/entitylocker/fetch', async (req: Request, res: Response) => {
    try {
      const { sessionId, documentType } = req.body;

      if (!sessionId || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'sessionId and documentType are required',
        });
      }

      const VALID_DOC_TYPES = ['gst_certificate', 'incorporation_certificate', 'bank_account'];
      if (!VALID_DOC_TYPES.includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: `documentType must be one of: ${VALID_DOC_TYPES.join(', ')}`,
        });
      }

      const result = await sandboxKYCService.fetchEntityLockerDocument(sessionId, documentType);
      return res.json({ success: true, document: result });
    } catch (error) {
      console.error('[EntityLocker] fetch document error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch EntityLocker document',
      });
    }
  });

  // ============================================================
  // ENTITYLOCKER STATUS & DOCS
  // ============================================================

  /**
   * GET /api/kyc/entitylocker/status
   * Returns EntityLocker configuration status and endpoint documentation.
   */
  app.get('/api/kyc/entitylocker/status', (_req: Request, res: Response) => {
    res.json({
      configured: !!(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET),
      endpoints: {
        initiate: 'POST /api/kyc/entitylocker/sessions/init',
        fetch: 'POST /api/kyc/entitylocker/fetch',
        webhook_event: 'kyc.entitylocker.done (→ POST /api/webhooks/sandbox)',
      },
      supported_document_types: [
        { type: 'gst_certificate', description: 'GST registration certificate — GSTIN, legal name, trade name, registration date, address' },
        { type: 'incorporation_certificate', description: 'MCA/ROC incorporation certificate — CIN, company name, date of incorporation, registered address' },
        { type: 'bank_account', description: 'Business bank account — account number, IFSC, account holder name match, bank name' },
      ],
      flow: [
        '1. POST /api/kyc/entitylocker/sessions/init → get { sessionId, authorizationUrl }',
        '2. Redirect business user to authorizationUrl',
        '3. Business user authenticates and grants consent on EntityLocker',
        '4. Sandbox sends kyc.entitylocker.done webhook to /api/webhooks/sandbox',
        '5. POST /api/kyc/entitylocker/fetch with { sessionId, documentType } → verified data',
      ],
      india_kyb_notes: [
        'Required for business client onboarding per SEBI DP regulations',
        'GST certificate verifies GST registration number (GSTIN) against GSTN database',
        'Incorporation certificate verifies MCA21 company registration',
        'Use alongside Director PAN verification (Sandbox KYC) for complete KYB',
        'Store only last 4 digits of any account numbers per PCI-DSS / UIDAI guidelines',
      ],
    });
  });

  console.log('✅ EntityLocker (KYB) routes registered (/api/kyc/entitylocker/*)');
}
