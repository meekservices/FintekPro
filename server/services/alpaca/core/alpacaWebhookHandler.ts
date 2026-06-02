import crypto from 'crypto';
import { logger } from '../../../logger';
import { db } from '../../../db';
import { alpacaOrders, users } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { emailService } from '../../../email-service';
import { whatsappDispatcher } from '../../whatsapp-dispatcher';
import { referralService } from '../../social/referralService';

// ─── HMAC Verification ──────────────────────────────────────────────────────
/**
 * Verifies the Alpaca webhook HMAC-SHA256 signature.
 * Alpaca signs the raw request body with the webhook secret using HMAC-SHA256
 * and sends the hex digest in the `apca-signature` header.
 *
 * @param rawBody   - The raw request body buffer (must be captured before JSON parsing)
 * @param signature - Value of the `apca-signature` header from Alpaca
 * @returns true if the signature is valid, false otherwise
 */
export function verifyAlpacaWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.ALPACA_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('[AlpacaWebhook] ALPACA_WEBHOOK_SECRET not set — skipping HMAC verification (INSECURE)');
    return true; // Degrade gracefully in dev; enforce in prod via startup check
  }
  if (!signature) {
    logger.warn('[AlpacaWebhook] Missing apca-signature header');
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (err: any) {
    logger.error('[AlpacaWebhook] HMAC verification error', { error: err.message });
    return false;
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export class AlpacaWebhookHandler {

  /**
   * Process an Alpaca broker event payload.
   * @param payload   - Parsed JSON body from Alpaca
   * @param rawBody   - Raw Buffer for HMAC signature verification
   * @param signature - Value of apca-signature header
   */
  async handleEvent(payload: unknown, rawBody?: Buffer, signature?: string): Promise<void> {
    if (rawBody && signature !== undefined) {
      const valid = verifyAlpacaWebhookSignature(rawBody, signature);
      if (!valid) {
        logger.warn('[AlpacaWebhook] Invalid HMAC signature — rejecting event');
        throw new Error('Invalid Alpaca webhook signature');
      }
    }

    const eventData = payload as Record<string, unknown>;
    const eventType = eventData?.event as string;

    logger.info(`[AlpacaWebhook] Received event: ${eventType}`, {
      event: eventType,
      user_id: (eventData?.data as any)?.account_id,
      status: 'received',
    });

    switch (eventType) {
      case 'trade_updates':
        await this.handleTradeUpdate(eventData.data as Record<string, unknown>);
        break;
      case 'account_updates':
        await this.handleAccountUpdate(eventData.data as Record<string, unknown>);
        break;
      case 'journal_status':
        await this.handleJournalUpdate(eventData.data as Record<string, unknown>);
        break;
      default:
        logger.warn(`[AlpacaWebhook] Unhandled event type: ${eventType}`, {
          event: 'ALPACA_WEBHOOK_UNHANDLED',
          eventType,
          status: 'unhandled',
        });
    }
  }

  /**
   * Handles trade_updates events — updates order status in alpaca_orders table.
   */
  private async handleTradeUpdate(data: Record<string, unknown>): Promise<void> {
    const order = data?.order as Record<string, unknown> | undefined;
    const orderEvent = data?.event as string;
    const orderId = order?.id as string | undefined;

    logger.info('[AlpacaWebhook] Trade Update', {
      event: 'ALPACA_TRADE_UPDATE',
      order_id: orderId,
      order_event: orderEvent,
      status: order?.status,
      latency_ms: 0,
    });

    if (!orderId) return;

    try {
      const existingOrders = await db
        .select()
        .from(alpacaOrders)
        .where(eq(alpacaOrders.providerOrderId, orderId))
        .limit(1);

      if (existingOrders.length > 0) {
        await db
          .update(alpacaOrders)
          .set({
            status: (order?.status as string) ?? existingOrders[0].status,
            filledQty: (order?.filled_qty as string) ?? existingOrders[0].filledQty,
            filledAvgPrice: (order?.filled_avg_price as string) ?? existingOrders[0].filledAvgPrice,
            updatedAt: new Date(),
          })
          .where(eq(alpacaOrders.providerOrderId, orderId));

        logger.info('[AlpacaWebhook] Order status updated in DB', {
          event: 'ALPACA_ORDER_DB_UPDATED',
          order_id: orderId,
          new_status: order?.status,
          status: 'success',
          latency_ms: 0,
        });
      }
    } catch (err: any) {
      logger.error('[AlpacaWebhook] Failed to update order in DB', {
        event: 'ALPACA_ORDER_DB_ERROR',
        order_id: orderId,
        error: err.message,
        retryable: true,
        status: 'error',
      });
    }
  }

  // ─── HOOK 1: Account ACTIVE → Welcome email + WhatsApp ───────────────────────
  /**
   * Handles account_updates events.
   * When status becomes ACTIVE: sends welcome email + WhatsApp and generates
   * the user's referral code so they can immediately invite friends.
   *
   * Purpose  : Onboarding conversion — engage the user the moment their Alpaca
   *            account is KYC-approved and ready to trade.
   * Inputs   : data.id (Alpaca account ID), data.status
   * Outputs  : email, WhatsApp, referral code generated in DB
   * Edge cases: user not found → skip silently; existing referralCode → skips re-generation
   */
  private async handleAccountUpdate(data: Record<string, unknown>): Promise<void> {
    const alpacaAccountId = data?.id as string | undefined;
    const status = data?.status as string | undefined;

    logger.info('[AlpacaWebhook] Account Update', {
      event: 'ALPACA_ACCOUNT_UPDATE',
      alpaca_account_id: alpacaAccountId,
      account_status: status,
      status: 'received',
      latency_ms: 0,
    });

    // Only act when account transitions to ACTIVE (KYC approved)
    if (status !== 'ACTIVE' || !alpacaAccountId) return;

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.alpacaAccountId, alpacaAccountId),
      });

      if (!user) {
        logger.warn('[AlpacaWebhook] No FintekPro user found for Alpaca account', {
          event: 'ALPACA_ACCOUNT_USER_NOT_FOUND',
          alpaca_account_id: alpacaAccountId,
          status: 'warning',
        });
        return;
      }

      const firstName = user.firstName ?? 'Investor';

      // Generate referral code immediately so user can share from Day 1
      let referralCode: string | null = null;
      try {
        referralCode = await referralService.generateReferralCode(user.id);
      } catch (refErr: any) {
        logger.warn('[AlpacaWebhook] Referral code generation failed', { error: refErr.message });
      }

      const appUrl = process.env.REPLIT_DEV_DOMAIN ?? process.env.APP_URL ?? 'https://app.fintekpro.in';

      // ── Welcome Email ────────────────────────────────────────────────────
      if (user.email) {
        try {
          await emailService.sendEmail({
            to: user.email,
            subject: '🎉 Your US Trading Account is Active — Start Investing!',
            html: `
              <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#1e40af 0%,#7c3aed 100%);padding:32px;text-align:center;">
                  <h1 style="margin:0;font-size:28px;color:#fff;">🚀 You're Ready to Trade!</h1>
                  <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Your Alpaca US Trading account is now active</p>
                </div>
                <div style="padding:32px;">
                  <p style="font-size:16px;margin-top:0;">Hi <strong>${firstName}</strong>,</p>
                  <p style="color:#94a3b8;">Your KYC has been verified and your US Trading account is <strong style="color:#22c55e;">live</strong>. You can now invest in US stocks and ETFs directly from India.</p>
                  <div style="background:#1e293b;border-radius:8px;padding:20px;margin:24px 0;">
                    <h3 style="margin:0 0 12px;color:#60a5fa;">🎯 Get Started in 3 Steps</h3>
                    <p style="margin:8px 0;color:#94a3b8;">1. <strong style="color:#e2e8f0;">Fund your account</strong> — Link your bank via Plaid (ACH transfer)</p>
                    <p style="margin:8px 0;color:#94a3b8;">2. <strong style="color:#e2e8f0;">Explore stocks</strong> — Browse our AI-curated Best Buys</p>
                    <p style="margin:8px 0;color:#94a3b8;">3. <strong style="color:#e2e8f0;">Place your first order</strong> — Start with as little as $1</p>
                  </div>
                  ${referralCode ? `
                  <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">🎁 YOUR REFERRAL CODE</p>
                    <p style="margin:0;font-size:22px;font-weight:bold;color:#60a5fa;letter-spacing:3px;">${referralCode}</p>
                    <p style="margin:8px 0 0;color:#64748b;font-size:12px;">Share with friends and earn rewards when they join</p>
                  </div>` : ''}
                  <div style="text-align:center;margin-top:28px;">
                    <a href="${appUrl}/us-trading" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#7c3aed);color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Start Trading Now →</a>
                  </div>
                  <p style="color:#475569;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #1e293b;">
                    ⚠️ Investments in US markets are subject to currency risk and market volatility. Past performance does not guarantee future returns.
                  </p>
                </div>
              </div>`,
          });
          logger.info('[AlpacaWebhook] Welcome email sent', { event: 'ALPACA_WELCOME_EMAIL_SENT', user_id: user.id, status: 'success', latency_ms: 0 });
        } catch (emailErr: any) {
          logger.error('[AlpacaWebhook] Welcome email failed', { error: emailErr.message, user_id: user.id });
        }
      }

      // ── Welcome WhatsApp ───────────────────────────────────────────────────
      if (user.mobile) {
        try {
          const waMsg = `🎉 *Congratulations ${firstName}!*\n\nYour FintekPro US Trading account is now *ACTIVE* and ready to trade! 🚀\n\n✅ Invest in Apple, Tesla, S&P 500 ETFs & more\n✅ Start with as little as $1\n✅ Real-time prices & AI picks${referralCode ? `\n\n🎁 Your referral code: *${referralCode}*\nShare & earn rewards!` : ''}\n\n👉 ${appUrl}/us-trading\n\n_Risk Disclosure: US market investments are subject to currency & market risks._`;
          const result = await whatsappDispatcher.send({ mobile: user.mobile, message: waMsg, category: 'ACCOUNT_ACTIVATION' });
          if (result.success) {
            logger.info('[AlpacaWebhook] Welcome WhatsApp sent', { event: 'ALPACA_WELCOME_WHATSAPP_SENT', user_id: user.id, provider: result.provider, status: 'success', latency_ms: 0 });
          }
        } catch (waErr: any) {
          logger.error('[AlpacaWebhook] Welcome WhatsApp failed', { error: waErr.message, user_id: user.id });
        }
      }

      logger.info('[AlpacaWebhook] Account ACTIVE hook complete', {
        event: 'ALPACA_ACCOUNT_ACTIVE_HOOK_DONE',
        user_id: user.id,
        alpaca_account_id: alpacaAccountId,
        referral_code: referralCode,
        status: 'success',
        latency_ms: 0,
      });

    } catch (err: any) {
      logger.error('[AlpacaWebhook] handleAccountUpdate failed', {
        event: 'ALPACA_ACCOUNT_UPDATE_ERROR',
        alpaca_account_id: alpacaAccountId,
        error: err.message,
        retryable: true,
        status: 'error',
      });
    }
  }

  // ─── HOOK 2: Transfer COMPLETE → First Deposit Notification ───────────────────
  /**
   * Handles journal_status events — ACH transfer / funding status changes.
   * When a deposit reaches EXECUTED/CORRECT status, fires a congratulations
   * notification and prompts the user to place their first trade.
   *
   * Purpose  : First-deposit engagement — convert funded users to first-trade users.
   * Inputs   : data.id, data.status, data.to_account (recipient Alpaca account ID),
   *            data.net_amount (USD), data.entry_type (JNLF=cash, JNLS=securities)
   * Outputs  : email + WhatsApp first-deposit notification
   * Edge cases: Only fires for cash deposits (JNLF); ignores withdrawals
   */
  private async handleJournalUpdate(data: Record<string, unknown>): Promise<void> {
    const journalId     = data?.id as string | undefined;
    const journalStatus = data?.status as string | undefined;
    const toAccount     = data?.to_account as string | undefined;
    const entryType     = data?.entry_type as string | undefined;
    const netAmount     = data?.net_amount as string | undefined;

    logger.info('[AlpacaWebhook] Journal Update', {
      event: 'ALPACA_JOURNAL_UPDATE',
      journal_id: journalId,
      journal_status: journalStatus,
      entry_type: entryType,
      status: 'received',
      latency_ms: 0,
    });

    // Only act on completed cash deposits (JNLF = journal cash fund)
    const isCompleted   = ['executed', 'EXECUTED', 'correct', 'CORRECT'].includes(journalStatus ?? '');
    const isCashDeposit = !entryType || entryType === 'JNLF';

    if (!isCompleted || !isCashDeposit || !toAccount) return;

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.alpacaAccountId, toAccount),
      });

      if (!user) {
        logger.warn('[AlpacaWebhook] No FintekPro user found for funded Alpaca account', {
          event: 'ALPACA_FUNDED_USER_NOT_FOUND',
          alpaca_account_id: toAccount,
          status: 'warning',
        });
        return;
      }

      const firstName  = user.firstName ?? 'Investor';
      const amountUsd  = netAmount ? `$${parseFloat(netAmount).toFixed(2)}` : 'funds';
      const appUrl     = process.env.REPLIT_DEV_DOMAIN ?? process.env.APP_URL ?? 'https://app.fintekpro.in';

      // ── First Deposit Email ──────────────────────────────────────────────
      if (user.email) {
        try {
          await emailService.sendEmail({
            to: user.email,
            subject: `💰 ${amountUsd} Deposited — Time to Put It to Work!`,
            html: `
              <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#065f46 0%,#1e40af 100%);padding:32px;text-align:center;">
                  <h1 style="margin:0;font-size:28px;color:#fff;">💰 ${amountUsd} Deposited!</h1>
                  <p style="margin:8px 0 0;color:#a7f3d0;font-size:14px;">Your funds are ready to invest</p>
                </div>
                <div style="padding:32px;">
                  <p style="font-size:16px;margin-top:0;">Hi <strong>${firstName}</strong>,</p>
                  <p style="color:#94a3b8;">Your deposit of <strong style="color:#22c55e;">${amountUsd}</strong> has been credited and is ready to invest in US markets.</p>
                  <div style="background:#1e293b;border-radius:8px;padding:20px;margin:24px 0;">
                    <h3 style="margin:0 0 16px;color:#60a5fa;">🤖 AI-Recommended Picks</h3>
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">Based on top-performing instruments:</p>
                    <p style="margin:6px 0;color:#e2e8f0;">📊 <strong>Broad ETFs</strong> — VTI, VOO (S&P 500)</p>
                    <p style="margin:6px 0;color:#e2e8f0;">💻 <strong>Tech Leaders</strong> — AAPL, MSFT, GOOGL</p>
                    <p style="margin:6px 0;color:#e2e8f0;">🌍 <strong>Diversified</strong> — QQQ (Nasdaq-100)</p>
                  </div>
                  <div style="text-align:center;margin-top:28px;">
                    <a href="${appUrl}/us-trading" style="display:inline-block;background:linear-gradient(135deg,#065f46,#1e40af);color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">View Best Buys &amp; Invest →</a>
                  </div>
                  <p style="color:#475569;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #1e293b;">
                    ⚠️ AI recommendations are for informational purposes only. Not financial advice. Investments subject to market risks.
                  </p>
                </div>
              </div>`,
          });
          logger.info('[AlpacaWebhook] First-deposit email sent', { event: 'ALPACA_DEPOSIT_EMAIL_SENT', user_id: user.id, status: 'success', latency_ms: 0 });
        } catch (emailErr: any) {
          logger.error('[AlpacaWebhook] First-deposit email failed', { error: emailErr.message, user_id: user.id });
        }
      }

      // ── First Deposit WhatsApp ─────────────────────────────────────────────
      if (user.mobile) {
        try {
          const waMsg = `💰 *${amountUsd} deposited successfully!*\n\nHi ${firstName}, your funds are ready to invest in US markets.\n\n🚀 *Top AI picks right now:*\n• VTI / VOO — S&P 500 ETFs\n• AAPL, MSFT — Tech leaders\n• QQQ — Nasdaq-100\n\n👉 Start investing: ${appUrl}/us-trading\n\n_AI suggestions are for informational purposes only. Past performance ≠ future returns._`;
          const result = await whatsappDispatcher.send({ mobile: user.mobile, message: waMsg, category: 'FIRST_DEPOSIT' });
          if (result.success) {
            logger.info('[AlpacaWebhook] First-deposit WhatsApp sent', { event: 'ALPACA_DEPOSIT_WHATSAPP_SENT', user_id: user.id, provider: result.provider, status: 'success', latency_ms: 0 });
          }
        } catch (waErr: any) {
          logger.error('[AlpacaWebhook] First-deposit WhatsApp failed', { error: waErr.message, user_id: user.id });
        }
      }

      logger.info('[AlpacaWebhook] Deposit hook complete', {
        event: 'ALPACA_DEPOSIT_HOOK_DONE',
        user_id: user.id,
        journal_id: journalId,
        amount_usd: netAmount,
        status: 'success',
        latency_ms: 0,
      });

    } catch (err: any) {
      logger.error('[AlpacaWebhook] handleJournalUpdate failed', {
        event: 'ALPACA_JOURNAL_UPDATE_ERROR',
        journal_id: journalId,
        error: err.message,
        retryable: true,
        status: 'error',
      });
    }
  }
}

export const alpacaWebhookHandler = new AlpacaWebhookHandler();
