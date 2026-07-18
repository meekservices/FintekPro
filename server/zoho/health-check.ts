import { Router, Request, Response } from "express";
import { db } from "../db";
import { zohoConnections, zohoSyncLogs } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * GET /api/zoho/health
 * Returns Zoho connection health from DB — no live API call.
 * Safe to poll from monitoring infrastructure.
 */
const router = Router();

router.get("/health", async (req: Request, res: Response) => {
  const startMs = Date.now();
  try {
    // Active connection
    const [conn] = await db
      .select({
        id:             zohoConnections.id,
        zohoDataCenter: zohoConnections.zohoDataCenter,
        status:         zohoConnections.status,
        zohoOrgId:      zohoConnections.zohoOrgId,
        expiresAt:      zohoConnections.expiresAt,
        lastSyncAt:     zohoConnections.lastSyncAt,
        createdAt:      zohoConnections.createdAt,
        isDefault:      zohoConnections.isDefault,
        services:       zohoConnections.services,
        connectionName: zohoConnections.connectionName,
      })
      .from(zohoConnections)
      .where(eq(zohoConnections.status, "active"))
      .limit(1);

    // Last 3 sync log entries
    const recentLogs = await db
      .select({
        id:               zohoSyncLogs.id,
        operation:        zohoSyncLogs.operation,
        entityType:       zohoSyncLogs.entityType,
        status:           zohoSyncLogs.status,
        recordsProcessed: zohoSyncLogs.recordsProcessed,
        recordsSucceeded: zohoSyncLogs.recordsSucceeded,
        recordsFailed:    zohoSyncLogs.recordsFailed,
        durationMs:       zohoSyncLogs.durationMs,
        createdAt:        zohoSyncLogs.createdAt,
      })
      .from(zohoSyncLogs)
      .where(conn ? eq(zohoSyncLogs.connectionId, conn.id) : undefined as any)
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(3);

    const tokenExpiry = conn?.expiresAt ? new Date(conn.expiresAt) : null;
    const tokenValid = tokenExpiry ? tokenExpiry > new Date() : false;

    return res.json({
      success: true,
      data: {
        connected: !!conn,
        connection: conn
          ? {
              id:             conn.id,
              dataCenter:     conn.zohoDataCenter,
              orgId:          conn.zohoOrgId,
              connectionName: conn.connectionName,
              services:       conn.services,
              status:         conn.status,
              tokenValid,
              tokenExpiresAt: tokenExpiry?.toISOString() ?? null,
              lastSyncAt:     conn.lastSyncAt,
              isDefault:      conn.isDefault,
            }
          : null,
        syncHealth: {
          recentSyncs: recentLogs,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        latency_ms: Date.now() - startMs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { error_code: "ZOHO_HEALTH_ERROR", message: err.message, retryable: true },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

export default router;
