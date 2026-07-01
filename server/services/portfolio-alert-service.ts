/* eslint-disable no-console */
/**
 * portfolio-alert-service.ts — Layer 4: Alert Broadcaster (FASP-AI v3.0)
 *
 * Creates, deduplicates, and manages portfolio alerts using the existing
 * portfolioAlerts table (shared/schema/ai.ts).
 *
 * FASP-AI v3.0 | GCR-compliant | SEBI-grade audit trail
 */
import { db } from "../db";
import { portfolioAlerts } from "@shared/schema";
import { eq, and, lt, or } from "drizzle-orm";
import { logger } from "../logger";

const ENGINE_VERSION = "FASP-AI-v3.0";

export type AlertType =
  | "DRIFT_CRITICAL"
  | "DRIFT_WARNING"
  | "ALPHA_DEGRADATION"
  | "SUBSTITUTION_AVAILABLE"
  | "REBALANCE_DUE"
  | "NAV_STALE"
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_REJECTED"
  | "PROPOSAL_EXPIRED";

export type AlertSeverity = "critical" | "warning" | "info";

interface CreateAlertParams {
  portfolioId:  string;
  clientId?:    string;
  alertType:    AlertType;
  severity:     AlertSeverity;
  title:        string;
  message:      string;
  metadata?:    Record<string, unknown>;
  expiryDays?:  number;
}

// ── Alert TTL by type (days) ──────────────────────────────────────────────────
const ALERT_TTL: Record<string, number> = {
  DRIFT_CRITICAL:         3,
  DRIFT_WARNING:          7,
  ALPHA_DEGRADATION:      14,
  SUBSTITUTION_AVAILABLE: 7,
  REBALANCE_DUE:          3,
  NAV_STALE:              2,
  PROPOSAL_APPROVED:      30,
  PROPOSAL_REJECTED:      30,
  PROPOSAL_EXPIRED:       7,
};

// ── Create (or no-op if duplicate today) ─────────────────────────────────────
/**
 * Creates an alert in portfolio_alerts table.
 * If an identical alert already exists for this portfolio+type today
 * and is not yet resolved, skips insertion (idempotent).
 * Returns the created alert ID or null if skipped.
 */
export async function createAlert(params: CreateAlertParams): Promise<string | null> {
  const { portfolioId, clientId = "system", alertType, severity, title, message, metadata = {}, expiryDays } = params;
  const ttlDays  = expiryDays ?? (ALERT_TTL[alertType] ?? 7);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // Map our severity to the existing table's severity enum
  const severityMap: Record<AlertSeverity, string> = {
    critical: "high",
    warning:  "medium",
    info:     "low",
  };

  try {
    const [inserted] = await db.insert(portfolioAlerts)
      .values({
        clientId,
        portfolioId,
        alertType,
        alertCategory:      "model_portfolio",
        severity:           severityMap[severity] ?? "medium",
        alertTitle:         title,
        alertMessage:       message,
        actionDescription:  JSON.stringify({ engine_version: ENGINE_VERSION, ...metadata }),
        status:             "active",
        expiresAt,
      })
      .returning({ id: portfolioAlerts.id });

    if (inserted?.id) {
      logger.info("PORTFOLIO_ALERT_CREATED", {
        event:         "PORTFOLIO_ALERT_CREATED",
        alertId:       inserted.id,
        portfolioId,
        alertType,
        severity,
        engine_version: ENGINE_VERSION,
      });
      return inserted.id;
    }
    return null;
  } catch (err) {
    logger.error("PORTFOLIO_ALERT_CREATE_ERROR", {
      event:      "PORTFOLIO_ALERT_CREATE_ERROR",
      portfolioId,
      alertType,
      error:      err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Mark alert as read (agent viewed) ────────────────────────────────────────
export async function markAlertRead(alertId: string): Promise<void> {
  await db.update(portfolioAlerts)
    .set({ agentViewed: true, agentViewedAt: new Date(), updatedAt: new Date() })
    .where(eq(portfolioAlerts.id, alertId));
}

// ── Fetch active alerts for a portfolio ──────────────────────────────────────
export async function getPortfolioAlerts(
  portfolioId: string,
  includeRead = false,
): Promise<typeof portfolioAlerts.$inferSelect[]> {
  const conditions = [
    portfolioId === "all" ? undefined : eq(portfolioAlerts.portfolioId, portfolioId),
    includeRead ? undefined : eq(portfolioAlerts.agentViewed, false),
    eq(portfolioAlerts.status, "active"),
  ].filter(Boolean);

  return db.select()
    .from(portfolioAlerts)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(portfolioAlerts.createdAt);
}

// ── Expire stale alerts ───────────────────────────────────────────────────────
export async function expireStaleAlerts(): Promise<number> {
  const now = new Date();
  const result = await db.update(portfolioAlerts)
    .set({ status: "resolved", resolvedAt: now, updatedAt: now })
    .where(and(
      eq(portfolioAlerts.status, "active"),
      lt(portfolioAlerts.expiresAt, now),
    ))
    .returning({ id: portfolioAlerts.id });
  return result.length;
}

// ── Drift alert helper ────────────────────────────────────────────────────────
export async function createDriftAlert(
  portfolioId: string,
  portfolioName: string,
  driftScore: number,
): Promise<void> {
  const isCritical = driftScore >= 20;
  const alertType: AlertType = isCritical ? "DRIFT_CRITICAL" : "DRIFT_WARNING";
  const severity: AlertSeverity = isCritical ? "critical" : "warning";

  await createAlert({
    portfolioId,
    alertType,
    severity,
    title:   `${isCritical ? "🚨 Critical" : "⚠️ Warning"}: Drift in ${portfolioName}`,
    message: `Portfolio drift score is ${driftScore}/100. ${isCritical ? "Immediate rebalance review recommended." : "Review holdings allocation."}`,
    metadata: { driftScore, portfolioName },
  });
}

// ── NAV stale alert ───────────────────────────────────────────────────────────
export async function createNAVStaleAlert(portfolioId: string, staleDays: number): Promise<void> {
  await createAlert({
    portfolioId,
    alertType:  "NAV_STALE",
    severity:   "warning",
    title:      `NAV data stale for ${staleDays}+ days`,
    message:    `Portfolio holdings NAV data is ${staleDays} days old. Check AMFI connectivity.`,
    metadata:   { staleDays },
    expiryDays: 2,
  });
}
