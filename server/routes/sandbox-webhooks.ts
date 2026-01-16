import { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';

interface SandboxWebhookPayload {
  event: string;
  timestamp: number;
  transaction_id: string;
  data: any;
}

interface WebhookEvent {
  id: string;
  event: string;
  payload: any;
  processedAt: Date;
  status: 'received' | 'processed' | 'failed';
}

const processedWebhooks = new Map<string, WebhookEvent>();

function validateSignature(rawBody: Buffer | string, signature: string | undefined, secret: string | undefined): { valid: boolean; reason?: string } {
  // If secret is not configured, allow webhook (development mode)
  if (!secret) {
    console.warn('[Sandbox Webhook] WEBHOOK_SECRET not configured - allowing webhook in development mode');
    return { valid: true, reason: 'secret_not_configured' };
  }

  // If secret is configured but signature is missing, reject
  if (!signature) {
    console.error('[Sandbox Webhook] Signature missing but secret is configured - rejecting webhook');
    return { valid: false, reason: 'signature_missing' };
  }

  try {
    // Compute HMAC over raw bytes to prevent JSON re-ordering issues
    const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('base64');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('[Sandbox Webhook] Signature mismatch');
      return { valid: false, reason: 'signature_mismatch' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[Sandbox Webhook] Signature validation error:', error);
    return { valid: false, reason: 'validation_error' };
  }
}

async function handleTDSAnalyticsDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] TDS Analytics completed: ${transactionId}`);
  console.log('[Sandbox Webhook] Analytics data:', JSON.stringify(data, null, 2));
}

async function handleTDSReportDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] TDS Report prepared: ${transactionId}`);
  console.log('[Sandbox Webhook] Report data:', JSON.stringify(data, null, 2));
}

async function handleTDSForm16Done(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] TDS Form 16 generated: ${transactionId}`);
  console.log('[Sandbox Webhook] Form 16 data:', JSON.stringify(data, null, 2));
}

async function handleTDSEFileDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] TDS E-File completed: ${transactionId}`);
  console.log('[Sandbox Webhook] E-File data:', JSON.stringify(data, null, 2));
}

async function handleTDS206ABDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] TDS 206AB check completed: ${transactionId}`);
  console.log('[Sandbox Webhook] 206AB data:', JSON.stringify(data, null, 2));
}

async function handleITRReportDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] ITR Report completed: ${transactionId}`);
  console.log('[Sandbox Webhook] ITR data:', JSON.stringify(data, null, 2));
}

async function handleITRCalculatorDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] ITR Calculator completed: ${transactionId}`);
  console.log('[Sandbox Webhook] Calculator data:', JSON.stringify(data, null, 2));
}

async function handleGSTAnalyticsDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] GST Analytics completed: ${transactionId}`);
  console.log('[Sandbox Webhook] GST data:', JSON.stringify(data, null, 2));
}

async function handleKYCVerificationDone(data: any, transactionId: string): Promise<void> {
  console.log(`[Sandbox Webhook] KYC Verification completed: ${transactionId}`);
  console.log('[Sandbox Webhook] KYC data:', JSON.stringify(data, null, 2));
}

export function registerSandboxWebhookRoutes(app: Express): void {
  // Use dedicated webhook secret, or fall back to API secret for HMAC validation
  const WEBHOOK_SECRET = process.env.SANDBOX_WEBHOOK_SECRET || process.env.SANDBOX_API_SECRET || undefined;

  app.post('/api/webhooks/sandbox', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const signature = req.headers['x-sandbox-signature'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    console.log('[Sandbox Webhook] Received webhook request');

    // If secret is configured, rawBody MUST be present for proper HMAC verification
    if (WEBHOOK_SECRET && !rawBody) {
      console.error('[Sandbox Webhook] Raw body not captured - middleware may be missing');
      return res.status(500).json({
        success: false,
        error: 'Webhook configuration error - raw body not captured'
      });
    }

    // Use rawBody for HMAC when available (secure), otherwise use JSON.stringify (dev only)
    const bodyForValidation = rawBody || JSON.stringify(req.body);

    const validation = validateSignature(bodyForValidation, signature, WEBHOOK_SECRET);
    if (!validation.valid) {
      console.error(`[Sandbox Webhook] Signature validation failed: ${validation.reason}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid signature',
        reason: validation.reason
      });
    }

    try {
      const payload: SandboxWebhookPayload = req.body;
      const { event, transaction_id, data, timestamp } = payload;

      console.log(`[Sandbox Webhook] Event: ${event}, Transaction: ${transaction_id}`);

      if (processedWebhooks.has(transaction_id)) {
        console.log(`[Sandbox Webhook] Duplicate webhook ignored: ${transaction_id}`);
        return res.status(200).json({ 
          success: true, 
          message: 'Webhook already processed' 
        });
      }

      const webhookEvent: WebhookEvent = {
        id: transaction_id,
        event,
        payload: data,
        processedAt: new Date(),
        status: 'received',
      };

      switch (event) {
        case 'tds.analytics.done':
          await handleTDSAnalyticsDone(data, transaction_id);
          break;

        case 'tds.report.done':
          await handleTDSReportDone(data, transaction_id);
          break;

        case 'tds.form16.done':
          await handleTDSForm16Done(data, transaction_id);
          break;

        case 'tds.e-file.done':
          await handleTDSEFileDone(data, transaction_id);
          break;

        case 'tds.206-ab.done':
          await handleTDS206ABDone(data, transaction_id);
          break;

        case 'it.report.done':
          await handleITRReportDone(data, transaction_id);
          break;

        case 'it.calculator.done':
          await handleITRCalculatorDone(data, transaction_id);
          break;

        case 'gst.analytics.done':
        case 'gst.reconciliation.done':
          await handleGSTAnalyticsDone(data, transaction_id);
          break;

        case 'kyc.verification.done':
        case 'kyc.pan.done':
        case 'kyc.aadhaar.done':
        case 'kyc.bank.done':
          await handleKYCVerificationDone(data, transaction_id);
          break;

        default:
          console.log(`[Sandbox Webhook] Unknown event type: ${event}`);
      }

      webhookEvent.status = 'processed';
      processedWebhooks.set(transaction_id, webhookEvent);

      if (processedWebhooks.size > 1000) {
        const entries = Array.from(processedWebhooks.entries());
        const toDelete = entries.slice(0, 500);
        toDelete.forEach(([key]) => processedWebhooks.delete(key));
      }

      const processingTime = Date.now() - startTime;
      console.log(`[Sandbox Webhook] Processed in ${processingTime}ms`);

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        transaction_id,
        processing_time_ms: processingTime,
      });

    } catch (error) {
      console.error('[Sandbox Webhook] Processing error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      });
    }
  });

  app.get('/api/webhooks/sandbox/status', async (req: Request, res: Response) => {
    const recentWebhooks = Array.from(processedWebhooks.values())
      .sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime())
      .slice(0, 20);

    res.json({
      success: true,
      configured: !!WEBHOOK_SECRET,
      webhookUrl: `${process.env.REPLIT_DEPLOYMENT_URL || 'https://your-domain.com'}/api/webhooks/sandbox`,
      totalProcessed: processedWebhooks.size,
      recentWebhooks: recentWebhooks.map(w => ({
        id: w.id,
        event: w.event,
        status: w.status,
        processedAt: w.processedAt.toISOString(),
      })),
      supportedEvents: [
        'tds.analytics.done',
        'tds.report.done',
        'tds.form16.done',
        'tds.e-file.done',
        'tds.206-ab.done',
        'it.report.done',
        'it.calculator.done',
        'gst.analytics.done',
        'gst.reconciliation.done',
        'kyc.verification.done',
        'kyc.pan.done',
        'kyc.aadhaar.done',
        'kyc.bank.done',
      ],
    });
  });

  console.log('✅ Sandbox webhook routes registered');
}
