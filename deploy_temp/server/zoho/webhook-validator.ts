import crypto from 'crypto';

/**
 * Zoho Webhook Signature Validator
 * Validates webhook requests to prevent spoofing
 */

export class ZohoWebhookValidator {
  /**
   * Validate Zoho webhook signature
   * 
   * Zoho sends webhooks with the following headers:
   * - X-Zoho-Signature: HMAC-SHA256 signature
   * - X-Zoho-Payload-Checksum: MD5 checksum of payload
   * 
   * @param rawBody - Raw request body string
   * @param signature - X-Zoho-Signature header value
   * @param webhookSecret - Secret key configured in Zoho webhook settings
   */
  static validateSignature(
    rawBody: string,
    signature: string | undefined,
    webhookSecret: string
  ): boolean {
    if (!signature || !webhookSecret) {
      console.warn('Missing signature or webhook secret');
      return false;
    }

    try {
      // Compute HMAC-SHA256 signature
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(rawBody);
      const computedSignature = hmac.digest('hex');

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
      );
    } catch (error) {
      console.error('Webhook signature validation error:', error);
      return false;
    }
  }

  /**
   * Validate payload checksum (alternative validation method)
   * 
   * @param rawBody - Raw request body string
   * @param checksum - X-Zoho-Payload-Checksum header value
   */
  static validateChecksum(
    rawBody: string,
    checksum: string | undefined
  ): boolean {
    if (!checksum) {
      console.warn('Missing payload checksum');
      return false;
    }

    try {
      // Compute MD5 checksum
      const hash = crypto.createHash('md5');
      hash.update(rawBody);
      const computedChecksum = hash.digest('hex');

      return checksum.toLowerCase() === computedChecksum.toLowerCase();
    } catch (error) {
      console.error('Webhook checksum validation error:', error);
      return false;
    }
  }

  /**
   * Validate webhook request (signature + checksum)
   * 
   * @param rawBody - Raw request body string
   * @param headers - Request headers object
   * @param webhookSecret - Secret key configured in Zoho webhook settings
   */
  static validate(
    rawBody: string,
    headers: Record<string, string | undefined>,
    webhookSecret: string
  ): { valid: boolean; reason?: string } {
    const signature = headers['x-zoho-signature'];
    const checksum = headers['x-zoho-payload-checksum'];

    // Check signature first (primary validation)
    if (signature) {
      const signatureValid = this.validateSignature(rawBody, signature, webhookSecret);
      if (!signatureValid) {
        return { valid: false, reason: 'Invalid webhook signature' };
      }
    } else {
      return { valid: false, reason: 'Missing webhook signature' };
    }

    // Check checksum (secondary validation)
    if (checksum) {
      const checksumValid = this.validateChecksum(rawBody, checksum);
      if (!checksumValid) {
        return { valid: false, reason: 'Invalid payload checksum' };
      }
    }

    return { valid: true };
  }
}

/**
 * Express middleware for webhook validation
 */
export function validateZohoWebhook(webhookSecret: string) {
  return (req: any, res: any, next: any) => {
    // Get raw body (must be string)
    const rawBody = JSON.stringify(req.body);

    // Validate webhook
    const validation = ZohoWebhookValidator.validate(
      rawBody,
      req.headers,
      webhookSecret
    );

    if (!validation.valid) {
      console.warn(`Webhook validation failed: ${validation.reason}`);
      return res.status(401).json({
        message: 'Webhook validation failed',
        reason: validation.reason
      });
    }

    // Validation passed, continue
    next();
  };
}
