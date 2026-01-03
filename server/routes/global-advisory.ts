import { Router, Request, Response } from "express";
import { requireClientOrHigher, requireAdmin } from "../middleware/auth";
import * as globalAdvisoryService from "../services/global-advisory-service";
import { z } from "zod";

const router = Router();

// ============================================================================
// FEATURE FLAGS
// ============================================================================

router.get("/feature-flags", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const flags = await globalAdvisoryService.getAllFeatureFlags("global_advisory");
    res.json({ success: true, flags });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/feature-flags/:flagKey", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { flagKey } = req.params;
    const isEnabled = await globalAdvisoryService.isFeatureEnabled(flagKey);
    const flag = await globalAdvisoryService.getFeatureFlag(flagKey);
    res.json({ success: true, isEnabled, flag });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/feature-flags/:flagKey", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { flagKey } = req.params;
    const userId = (req.user as any)?.id;
    const flag = await globalAdvisoryService.updateFeatureFlag(flagKey, req.body, userId);
    res.json({ success: true, flag });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/feature-flags/:flagKey/kill", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { flagKey } = req.params;
    const { reason } = req.body;
    const userId = (req.user as any)?.id;
    
    if (!reason) {
      return res.status(400).json({ success: false, error: "Kill switch reason is required" });
    }
    
    const flag = await globalAdvisoryService.activateKillSwitch(flagKey, reason, userId);
    res.json({ success: true, flag, message: "Kill switch activated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MARKETS
// ============================================================================

router.get("/markets", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { all } = req.query;
    const markets = all === "true" 
      ? await globalAdvisoryService.getAllMarkets()
      : await globalAdvisoryService.getEnabledMarkets();
    res.json({ success: true, markets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/markets/:marketCode", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { marketCode } = req.params;
    const market = await globalAdvisoryService.getMarketByCode(marketCode);
    if (!market) {
      return res.status(404).json({ success: false, error: "Market not found" });
    }
    res.json({ success: true, market });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/markets/:marketCode", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { marketCode } = req.params;
    const userId = (req.user as any)?.id;
    const market = await globalAdvisoryService.updateMarket(marketCode, req.body, userId);
    res.json({ success: true, market });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/markets/:marketCode/toggle", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { marketCode } = req.params;
    const { isEnabled } = req.body;
    const userId = (req.user as any)?.id;
    const market = await globalAdvisoryService.toggleMarketEnabled(marketCode, isEnabled, userId);
    res.json({ success: true, market });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MARKET PRODUCTS
// ============================================================================

router.get("/markets/:marketCode/products", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { marketCode } = req.params;
    const products = await globalAdvisoryService.getProductsForMarket(marketCode);
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market-products", requireAdmin, async (req: Request, res: Response) => {
  try {
    const products = await globalAdvisoryService.getAllMarketProducts();
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/market-products/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;
    const product = await globalAdvisoryService.updateMarketProduct(id, req.body, userId);
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/check-product/:marketCode/:productCategory", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { marketCode, productCategory } = req.params;
    const result = await globalAdvisoryService.isProductAllowedInMarket(marketCode, productCategory);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// USER MARKET PREFERENCES
// ============================================================================

router.get("/preferences", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const preferences = await globalAdvisoryService.getUserMarketPreferences(userId);
    res.json({ success: true, preferences: preferences || { selectedMarket: "IN", displayCurrency: "INR", showGlobalMarkets: false } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/preferences", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const preferences = await globalAdvisoryService.upsertUserMarketPreferences(userId, req.body);
    res.json({ success: true, preferences });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/select-market", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const { marketCode } = req.body;
    if (!marketCode) {
      return res.status(400).json({ success: false, error: "Market code is required" });
    }
    
    const preferences = await globalAdvisoryService.setSelectedMarket(userId, marketCode);
    
    await globalAdvisoryService.logAuditEvent(userId, "market_selection", "change", { marketCode }, {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      requestPath: req.path
    });
    
    res.json({ success: true, preferences });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ACKNOWLEDGMENTS
// ============================================================================

const acknowledgmentSchema = z.object({
  marketCode: z.string().min(2).max(10),
  acknowledgmentType: z.string().min(1),
  disclaimerVersion: z.string().min(1),
  disclaimerText: z.string().min(1)
});

router.get("/acknowledgments", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const acknowledgments = await globalAdvisoryService.getUserAcknowledgments(userId);
    res.json({ success: true, acknowledgments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/acknowledgments/check/:marketCode/:type", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const { marketCode, type } = req.params;
    const hasAcknowledged = await globalAdvisoryService.hasUserAcknowledged(userId, marketCode, type);
    res.json({ success: true, hasAcknowledged });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/acknowledgments", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const result = acknowledgmentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: "Invalid acknowledgment data", details: result.error.issues });
    }
    
    const { marketCode, acknowledgmentType, disclaimerVersion, disclaimerText } = result.data;
    
    const acknowledgment = await globalAdvisoryService.recordAcknowledgment(
      userId,
      marketCode,
      acknowledgmentType,
      disclaimerVersion,
      disclaimerText,
      {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.sessionID
      }
    );
    
    res.json({ success: true, acknowledgment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ELIGIBILITY
// ============================================================================

router.get("/eligibility", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const eligibility = await globalAdvisoryService.getUserMarketEligibility(userId);
    res.json({ success: true, eligibility });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/eligibility/:marketCode", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { marketCode } = req.params;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    const eligibility = await globalAdvisoryService.getMarketEligibilityForUser(userId, marketCode);
    res.json({ success: true, eligibility });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CURRENCY CONVERSION
// ============================================================================

router.get("/convert", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { amount, from, to } = req.query;
    
    if (!amount || !from || !to) {
      return res.status(400).json({ success: false, error: "Missing required parameters: amount, from, to" });
    }
    
    const result = await globalAdvisoryService.convertCurrency(
      parseFloat(amount as string),
      from as string,
      to as string
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/exchange-rates", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { baseCurrency } = req.query;
    const rates = await globalAdvisoryService.getExchangeRates(baseCurrency as string);
    res.json({ success: true, rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EXECUTION GUARD
// ============================================================================

router.get("/can-execute/:marketCode", requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const { marketCode } = req.params;
    const result = await globalAdvisoryService.canExecuteInMarket(marketCode);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AUDIT LOGS (Admin)
// ============================================================================

router.get("/audit-logs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, marketCode, eventType, startDate, endDate, limit } = req.query;
    
    const logs = await globalAdvisoryService.getAuditLogs({
      userId: userId as string,
      marketCode: marketCode as string,
      eventType: eventType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });
    
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/sebi-export/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Start and end dates are required" });
    }
    
    const exportData = await globalAdvisoryService.generateSEBIExport(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json({ success: true, ...exportData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
