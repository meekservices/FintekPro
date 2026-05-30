import { Router, Request, Response, NextFunction } from "express";
import { clientFeeModeService, FeeMode } from "../services/client-fee-mode-service";
import { resolveClientCapabilities } from "../middleware/client-capability-resolver";
import { adminService } from "../admin-service";
import { z } from "zod";

const router = Router();

// Admin authentication middleware using proper pattern
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const isAdmin = await adminService.isAdmin(user.id);
  if (!isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
};

const selectFeeModeSchema = z.object({
  feeMode: z.enum(['ADVISORY_PLATFORM', 'PLATFORM_ONLY']),
  disclaimerAcknowledged: z.boolean()
});

const adminOverrideSchema = z.object({
  clientId: z.string(),
  newMode: z.enum(['ADVISORY_PLATFORM', 'PLATFORM_ONLY']),
  reason: z.string().min(10, "Reason must be at least 10 characters")
});

const updateAdminSettingsSchema = z.object({
  enablePlatformOnlyMode: z.boolean().optional(),
  allowClientSelfSelection: z.boolean().optional(),
  defaultFeeMode: z.enum(['ADVISORY_PLATFORM', 'PLATFORM_ONLY']).optional(),
  advisoryFeeBps: z.number().min(0).max(1000).optional(),
  platformFeeBps: z.number().min(0).max(1000).optional(),
  advisoryFeeCapInr: z.number().optional().nullable(),
  platformFeeCapInr: z.number().optional().nullable()
});

router.get("/capabilities", resolveClientCapabilities, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    res.json({
      success: true,
      capabilities: req.clientCapabilities
    });
  } catch (error) {
    console.error("Error getting capabilities:", error);
    res.status(500).json({ error: "Failed to get capabilities" });
  }
});

router.get("/current", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const [feeMode, adminSettings] = await Promise.all([
      clientFeeModeService.getClientFeeMode(userId),
      clientFeeModeService.getAdminSettings()
    ]);

    res.json({
      success: true,
      feeMode: feeMode?.feeMode || null,
      selectedAt: feeMode?.feeModeSelectedAt || null,
      disclaimerAcknowledged: feeMode?.disclaimerAcknowledged || false,
      platformOnlyEnabled: adminSettings?.enablePlatformOnlyMode ?? true,
      selfSelectionAllowed: adminSettings?.allowClientSelfSelection ?? true
    });
  } catch (error) {
    console.error("Error getting current fee mode:", error);
    res.status(500).json({ error: "Failed to get fee mode" });
  }
});

router.post("/select", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validation = selectFeeModeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validation.error.issues 
      });
    }

    const { feeMode, disclaimerAcknowledged } = validation.data;
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];

    const result = await clientFeeModeService.selectFeeMode({
      clientId: userId,
      feeMode,
      disclaimerAcknowledged,
      ipAddress,
      userAgent
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Fee mode selected successfully" });
  } catch (error) {
    console.error("Error selecting fee mode:", error);
    res.status(500).json({ error: "Failed to select fee mode" });
  }
});

router.get("/calculate-fees", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const orderValue = parseFloat(req.query.orderValue as string);
    if (isNaN(orderValue) || orderValue <= 0) {
      return res.status(400).json({ error: "Invalid order value" });
    }

    const feeBreakdown = await clientFeeModeService.calculateFees(orderValue, userId);
    if (!feeBreakdown) {
      return res.status(400).json({ 
        error: "Fee mode not selected",
        code: "FEE_MODE_REQUIRED"
      });
    }

    res.json({ success: true, fees: feeBreakdown });
  } catch (error) {
    console.error("Error calculating fees:", error);
    res.status(500).json({ error: "Failed to calculate fees" });
  }
});

router.get("/audit-log", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const auditLog = await clientFeeModeService.getAuditLog(userId, limit);

    res.json({ success: true, auditLog });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.get("/admin/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await clientFeeModeService.getAdminSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching admin settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/admin/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const validation = updateAdminSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validation.error.issues 
      });
    }

    const result = await clientFeeModeService.updateAdminSettings(
      validation.data as any, 
      user.id
    );

    if (!result) {
      return res.status(500).json({ error: "Failed to update settings" });
    }

    res.json({ success: true, message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating admin settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.post("/admin/override", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const validation = adminOverrideSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validation.error.issues 
      });
    }

    const { clientId, newMode, reason } = validation.data;
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();

    const result = await clientFeeModeService.adminOverrideMode({
      clientId,
      newMode,
      adminId: user.id,
      reason,
      ipAddress
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Fee mode overridden successfully" });
  } catch (error) {
    console.error("Error in admin override:", error);
    res.status(500).json({ error: "Failed to override fee mode" });
  }
});

router.get("/admin/statistics", requireAdmin, async (req: Request, res: Response) => {
  try {
    const statistics = await clientFeeModeService.getFeeModeStatistics();
    res.json({ success: true, statistics });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/admin/audit-log", requireAdmin, async (req: Request, res: Response) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const auditLog = await clientFeeModeService.getAuditLog(clientId, limit);
    res.json({ success: true, auditLog });
  } catch (error) {
    console.error("Error fetching admin audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

router.get("/admin/export/:clientId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const exportBundle = await clientFeeModeService.generateSebiExportBundle(clientId);

    res.json({ success: true, exportBundle });
  } catch (error) {
    console.error("Error generating SEBI export:", error);
    res.status(500).json({ error: "Failed to generate export" });
  }
});

export default router;
