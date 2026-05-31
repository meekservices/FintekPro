// @ts-nocheck
import { Router } from "express";
import { db } from "../../db";
import { platformConfig, insertPlatformConfigSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";

const router = Router();

// GET all active config settings
router.get("/", requireAdmin, async (req, res) => {
  try {
    const configs = await db
      .select()
      .from(platformConfig)
      .where(eq((platformConfig as any).isActive, true))
      .orderBy(desc(platformConfig.createdAt));
    
    // Group by key to get latest for each
    const latestConfigs: Record<string, any> = {};
    configs.forEach(cfg => {
      if (!latestConfigs[(cfg as any).configKey]) {
        latestConfigs[(cfg as any).configKey] = cfg;
      }
    });

    res.json({ success: true, configs: Object.values(latestConfigs) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST update a config setting
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { configKey, configValue, description } = req.body;
    
    // 1. Deactivate old config for this key
    await db
      .update(platformConfig)
      .set({ isActive: false, updatedAt: new Date() } as any)
      .where(eq((platformConfig as any).configKey, configKey));

    // 2. Insert new version
    const [newConfig] = await db
      .insert(platformConfig)
      .values({
        configKey: configKey as any,
        configValue,
        description,
        configType: typeof configValue === 'number' ? 'number' : 'string',
        isActive: true,
        updatedBy: (req as any).user?.id,
      })
      .returning();

    res.json({ success: true, config: newConfig });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
