/**
 * @file ops-alert-service.ts
 * @description Infrastructure ops alerting service for FintekPro.
 *
 * Purpose:
 *   Fires structured alerts to ERROR_ALERT_WEBHOOK (Slack-compatible Block Kit)
 *   for infrastructure events that require immediate operator attention:
 *   - EOD pricing stack degradation (Upstox token expired, IndianAPI key missing)
 *   - Upstox token age warnings (30 days before yearly expiry)
 *   - NSE market breadth unavailable (regime detection degraded)
 *
 * Deduplication:
 *   Same alert_code fires at most once per 1 hour (in-memory map).
 *   Prevents alert storms on repeated API failures.
 *
 * Channels:
 *   - PRIMARY: ERROR_ALERT_WEBHOOK (Slack-compatible Block Kit POST)
 *   - FALLBACK: Structured logger.error (always fires regardless of webhook)
 *
 * @compliance GCR v1.0 — structured logs { event, status, latency_ms }
 * @fasp FASP-AI v3.0 — financial platform ops alerts
 */

import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OpsAlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface OpsAlert {
  /** Unique machine-readable code for deduplication. e.g. "UPSTOX_TOKEN_EXPIRED" */
  code: string;
  severity: OpsAlertSeverity;
  /** Short human-readable title shown in Slack header */
  title: string;
  /** Detailed explanation of the issue */
  message: string;
  /** Optional remediation command or action */
  action?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const SEVERITY_EMOJI: Record<OpsAlertSeverity, string> = {
  CRITICAL: "🚨",
  WARNING:  "⚠️",
  INFO:     "ℹ️",
};

// ── Service ───────────────────────────────────────────────────────────────────

class OpsAlertService {
  /** code → last fired timestamp (ms) */
  private readonly _dedup = new Map<string, number>();

  /**
   * Fire an ops alert.
   * - Always emits a structured logger entry (guaranteed via Cloud Run logs).
   * - Sends Slack Block Kit POST to ERROR_ALERT_WEBHOOK if configured.
   * - Deduplicates: same code fires at most once per DEDUP_WINDOW_MS.
   *
   * @param alert - The alert to fire
   * @returns true if alert was dispatched, false if deduplicated
   */
  async fire(alert: OpsAlert): Promise<boolean> {
    const now = Date.now();
    const lastFired = this._dedup.get(alert.code) ?? 0;

    if (now - lastFired < DEDUP_WINDOW_MS) {
      logger.debug("[OpsAlert] Suppressed duplicate alert", {
        event: "OPS_ALERT_SUPPRESSED",
        code: alert.code,
        next_fire_in_ms: DEDUP_WINDOW_MS - (now - lastFired),
      });
      return false;
    }

    this._dedup.set(alert.code, now);

    const logFn =
      alert.severity === "CRITICAL" ? logger.error.bind(logger)
      : alert.severity === "WARNING" ? logger.warn.bind(logger)
      : logger.info.bind(logger);

    logFn(`[OpsAlert] ${alert.severity}: ${alert.title}`, {
      event:    "OPS_ALERT_FIRED",
      code:     alert.code,
      severity: alert.severity,
      title:    alert.title,
      message:  alert.message,
      action:   alert.action ?? null,
      status:   alert.severity === "CRITICAL" ? "DEGRADED" : "WARNING",
    });

    const webhookUrl = process.env.ERROR_ALERT_WEBHOOK;
    if (webhookUrl) {
      this._sendWebhook(alert, webhookUrl, now).catch((err) => {
        logger.warn("[OpsAlert] Webhook dispatch failed (logs still captured)", {
          event:     "OPS_ALERT_WEBHOOK_FAILED",
          code:      alert.code,
          error:     (err as Error).message?.slice(0, 100),
          retryable: false,
        });
      });
    }

    return true;
  }

  private async _sendWebhook(alert: OpsAlert, url: string, firedAt: number): Promise<void> {
    const t0    = Date.now();
    const emoji = SEVERITY_EMOJI[alert.severity];
    const env   = process.env.K_SERVICE ?? process.env.NODE_ENV ?? "local";
    const ts    = new Date(firedAt).toISOString();

    const payload = {
      text: `${emoji} FintekPro OPS ALERT [${alert.severity}]: ${alert.code}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${emoji} ${alert.title}`, emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Severity:*\n${alert.severity}` },
            { type: "mrkdwn", text: `*Code:*\n\`${alert.code}\`` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Details:*\n${alert.message}` },
        },
        ...(alert.action
          ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Remediation:*\n\`\`\`${alert.action}\`\`\`` },
            }]
          : []),
        {
          type: "context",
          elements: [{
            type: "mrkdwn",
            text: `FintekPro · ${env} · ${ts} · <https://fintekpro.in/admin|Admin Console>`,
          }],
        },
      ],
    };

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "X-FintekPro-Event": "ops_alert",
        "X-Alert-Code":      alert.code,
        "X-Alert-Severity":  alert.severity,
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    logger.info("[OpsAlert] Webhook dispatched", {
      event:       "OPS_ALERT_WEBHOOK_SENT",
      code:        alert.code,
      http_status: res.status,
      latency_ms:  Date.now() - t0,
      status:      res.ok ? "OK" : "FAILED",
    });
  }

  /** Reset dedup for a given code (testing / manual ack). */
  resetDedup(code: string): void {
    this._dedup.delete(code);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const opsAlertService = new OpsAlertService();
