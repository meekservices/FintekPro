/**
 * WhatsApp Dispatcher — IRIS Primary → Twilio Fallback
 *
 * Purpose : Single entry point for all non-OTP WhatsApp messages across FintekPro.
 *           Attempts IRIS KFintech first; on failure (or when IRIS is unconfigured)
 *           falls back to Twilio automatically. Callers receive a unified result
 *           including which provider delivered the message for audit/observability.
 *
 * Usage:
 *   import { whatsappDispatcher } from './whatsapp-dispatcher';
 *   const result = await whatsappDispatcher.send({ mobile, message, category });
 *
 * NOT for use with OTP / auth flows — those must use twilioWhatsAppService.sendOTP()
 * directly because auth OTPs have different DLT categories and stricter latency SLAs.
 */

import { irisKfintechService } from './iris-kfintech-service';
import { twilioWhatsAppService } from './twilio-whatsapp-service';
import { logger } from '../logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppDispatchOptions {
  /** Recipient phone number. E.164 (e.g. +919876543210) or 10-digit Indian mobile. */
  mobile: string;
  /** Plain-text message body. */
  message: string;
  /** Optional media / image URL (Twilio only — IRIS will ignore this field). */
  mediaUrl?: string;
  /**
   * IRIS notification category (e.g. 'FESTIVAL_GREETING', 'PORTFOLIO_ALERT').
   * Falls back to 'GENERAL' when omitted.
   * Twilio uses templateType for template selection instead.
   */
  category?: string;
  /** Investor PAN — enriches IRIS investor lookup. Not sent to Twilio. */
  pan?: string;
  /** Agent/sender display name. Appended as footer in IRIS messages. */
  agentName?: string;
  /** IRIS DLT-registered template ID. */
  templateId?: string;
  /** Twilio template key (e.g. 'kyc_update', 'notification'). */
  templateType?: string;
  /** Any additional fields passed through verbatim to the IRIS payload. */
  extra?: Record<string, unknown>;
}

export interface WhatsAppDispatchResult {
  /** Whether the message was delivered by any provider. */
  success: boolean;
  /** Which provider ultimately delivered (or attempted) the message. */
  provider: 'iris' | 'twilio' | 'none';
  /** IRIS message ID on IRIS success. */
  messageId?: string;
  /** Twilio message SID on Twilio success. */
  messageSid?: string;
  /** Error string when success===false. */
  error?: string;
  /** IRIS error code on IRIS failure (useful for audit). */
  irisErrorCode?: string;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

class WhatsAppDispatcher {
  /**
   * Send a WhatsApp message via IRIS (primary) → Twilio (fallback).
   *
   * Purpose : Universal send method. IRIS is tried whenever credentials are set.
   *           On any IRIS failure the message is automatically retried via Twilio.
   *
   * Inputs  : WhatsAppDispatchOptions (mobile + message required; rest optional)
   * Outputs : WhatsAppDispatchResult  (success, provider, messageId/messageSid)
   *
   * Edge cases:
   *   - IRIS not configured       → skip IRIS, go straight to Twilio
   *   - IRIS 4xx (bad request)    → not retryable; still fall through to Twilio
   *   - IRIS 5xx / network error  → retryable; fall through to Twilio
   *   - Twilio not configured     → provider:'none', success:false
   *   - Both providers fail       → provider:'none', success:false
   */
  async send(opts: WhatsAppDispatchOptions): Promise<WhatsAppDispatchResult> {
    const maskedMobile = opts.mobile.slice(0, 6) + '****';
    const t0 = Date.now();

    // ── 1. IRIS primary ───────────────────────────────────────────────────────
    if (irisKfintechService.isConfigured) {
      const irisResult = await irisKfintechService.sendWhatsAppMessage({
        mobile:     opts.mobile,
        message:    opts.message,
        category:   opts.category,
        pan:        opts.pan,
        agentName:  opts.agentName,
        templateId: opts.templateId,
        extra:      opts.extra,
      });

      if (irisResult.success) {
        logger.info('[WhatsAppDispatcher] Delivered via IRIS', {
          event:      'WA_DISPATCH_SUCCESS',
          provider:   'iris',
          mobile:     maskedMobile,
          category:   opts.category ?? 'GENERAL',
          messageId:  irisResult.messageId,
          latency_ms: Date.now() - t0,
          status:     'success',
        });
        return {
          success:   true,
          provider:  'iris',
          messageId: irisResult.messageId,
        };
      }

      // IRIS failed — log and fall through to Twilio
      logger.warn('[WhatsAppDispatcher] IRIS failed, falling back to Twilio', {
        event:         'WA_DISPATCH_IRIS_FAIL',
        mobile:        maskedMobile,
        irisErrorCode: irisResult.errorCode,
        retryable:     irisResult.retryable,
        latency_ms:    Date.now() - t0,
        status:        'fallback',
      });
    }

    // ── 2. Twilio fallback ────────────────────────────────────────────────────
    try {
      const twilioResult = await twilioWhatsAppService.sendMessage(
        opts.mobile,
        opts.message,
        opts.mediaUrl,
        opts.templateType,
      );

      if (twilioResult.success) {
        logger.info('[WhatsAppDispatcher] Delivered via Twilio', {
          event:      'WA_DISPATCH_SUCCESS',
          provider:   'twilio',
          mobile:     maskedMobile,
          messageSid: twilioResult.messageSid,
          latency_ms: Date.now() - t0,
          status:     'success',
        });
        return {
          success:    true,
          provider:   'twilio',
          messageSid: twilioResult.messageSid,
        };
      }

      // Twilio returned success:false without throwing
      logger.error('[WhatsAppDispatcher] Twilio failed', {
        event:     'WA_DISPATCH_TWILIO_FAIL',
        mobile:    maskedMobile,
        error:     twilioResult.error,
        latency_ms: Date.now() - t0,
        status:    'error',
      });
      return {
        success:  false,
        provider: 'none',
        error:    twilioResult.error ?? 'Twilio delivery failed',
      };
    } catch (err: any) {
      logger.error('[WhatsAppDispatcher] Twilio threw exception', {
        event:      'WA_DISPATCH_TWILIO_EXCEPTION',
        mobile:     maskedMobile,
        error:      err?.message,
        latency_ms: Date.now() - t0,
        status:     'error',
      });
      return {
        success:  false,
        provider: 'none',
        error:    err?.message ?? 'Unknown WhatsApp delivery error',
      };
    }
  }

  /**
   * Convenience: send to multiple recipients sequentially.
   * Returns per-recipient results plus aggregate counts.
   *
   * Inputs  : recipients[] each with { mobile, ...opts }
   * Outputs : { results, irisSent, twilioSent, failed }
   */
  async sendBulk(
    recipients: Array<WhatsAppDispatchOptions>,
  ): Promise<{
    results:    WhatsAppDispatchResult[];
    irisSent:   number;
    twilioSent: number;
    failed:     number;
  }> {
    const results: WhatsAppDispatchResult[] = [];
    let irisSent   = 0;
    let twilioSent = 0;
    let failed     = 0;

    for (const recipient of recipients) {
      const r = await this.send(recipient);
      results.push(r);
      if (r.provider === 'iris')   irisSent++;
      else if (r.provider === 'twilio') twilioSent++;
      else failed++;
    }

    logger.info('[WhatsAppDispatcher] Bulk send complete', {
      event:      'WA_DISPATCH_BULK_DONE',
      total:      recipients.length,
      irisSent,
      twilioSent,
      failed,
      status:     failed === recipients.length ? 'error' : 'success',
    });

    return { results, irisSent, twilioSent, failed };
  }
}

export const whatsappDispatcher = new WhatsAppDispatcher();
