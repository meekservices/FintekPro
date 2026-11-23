import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { aaConsents, aaFinancialProfiles, aaTransactions } from "../../shared/schema/finvu";
import { finvuConsentService } from "../services/finvu/finvu-consent-service";
import { finvuFiService } from "../services/finvu/finvu-fi-service";
import { finvuWebhookHandler } from "../services/finvu/finvu-webhook-handler";
import { logger } from "../logger";

const router = Router();

/**
 * POST /api/finvu/consent/initiate
 * Initiates an Account Aggregator consent request via Finvu
 */
router.post("/consent/initiate", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id || (req.body.userId as string);
    const phoneNumber = req.body.phoneNumber || user?.mobile;

    if (!userId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: userId and phoneNumber",
        meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
      });
    }

    const result = await finvuConsentService.initiateConsent({
      userId,
      phoneNumber,
      fiTypes: req.body.fiTypes,
      consentMode: req.body.consentMode,
      fetchType: req.body.fetchType,
      expiryMonths: req.body.expiryMonths,
    });

    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] Consent initiation error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error initiating consent",
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

/**
 * GET /api/finvu/consent/status/:handle
 * Queries the current status of a consent handle
 */
router.get("/consent/status/:handle", async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    const result = await finvuConsentService.getConsentStatus(handle);

    return res.json({
      success: result.success,
      data: result,
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] Consent status query error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to query consent status",
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

/**
 * POST /api/finvu/fi/request
 * Triggers a Financial Information (FI) Data Request for an active consent
 */
router.post("/fi/request", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id || (req.body.userId as string);
    const { consentId } = req.body;

    if (!userId || !consentId) {
      return res.status(400).json({
        success: false,
        error: "Missing userId or consentId",
        meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
      });
    }

    const result = await finvuFiService.requestFIData(consentId, userId);

    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] FI request error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to request FI data",
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

/**
 * GET /api/finvu/fi/accounts
 * Retrieves all aggregated financial profiles (Bank, Mutual Funds, Equities) for the user
 */
router.get("/fi/accounts", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id || (req.query.userId as string);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
      });
    }

    const profiles = await db
      .select()
      .from(aaFinancialProfiles)
      .where(eq(aaFinancialProfiles.userId, userId))
      .orderBy(desc(aaFinancialProfiles.lastSyncedAt));

    return res.json({
      success: true,
      data: profiles,
      meta: {
        total: profiles.length,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] Fetch accounts error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve financial profiles",
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

/**
 * GET /api/finvu/fi/transactions/:profileId
 * Retrieves normalized bank transactions for a specific aggregated account profile
 */
router.get("/fi/transactions/:profileId", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const txns = await db
      .select()
      .from(aaTransactions)
      .where(eq(aaTransactions.profileId, profileId))
      .orderBy(desc(aaTransactions.txnDate))
      .limit(100);

    return res.json({
      success: true,
      data: txns,
      meta: {
        total: txns.length,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] Fetch transactions error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve transactions",
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

/**
 * POST /api/finvu/webhook
 * Inbound webhook receiver for Finvu ReBIT notifications (Consent & FI Data)
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-finvu-signature"] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    const isValid = finvuWebhookHandler.verifySignature(rawBody, signature);
    if (!isValid) {
      logger.warn("[FinvuRoutes] Webhook signature verification failed");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const result = await finvuWebhookHandler.handleNotification(req.body);

    // ReBIT standard acknowledgement response
    return res.status(200).json({
      ver: "1.1.2",
      timestamp: new Date().toISOString(),
      status: "SUCCESS",
      response: result,
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] Webhook handler error:", error.message);
    return res.status(500).json({
      ver: "1.1.2",
      timestamp: new Date().toISOString(),
      status: "FAILED",
      error: error.message,
    });
  }
});

/**
 * POST /api/finvu/consent/revoke
 * Revokes an existing consent
 */
router.post("/consent/revoke", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id || (req.body.userId as string);
    const { consentId } = req.body;

    if (!userId || !consentId) {
      return res.status(400).json({
        success: false,
        error: "Missing userId or consentId",
        meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
      });
    }

    const result = await finvuConsentService.revokeConsent(consentId, userId);
    return res.json({
      success: result.success,
      message: result.message,
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  } catch (error: any) {
    logger.error("[FinvuRoutes] Consent revoke error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to revoke consent",
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

export default router;
export function registerFinvuRoutes(app: any) {
  app.use("/api/finvu", router);
}
