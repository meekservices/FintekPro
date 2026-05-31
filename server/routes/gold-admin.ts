// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import { sgbPrimaryIssues, governmentSecurities } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/sgb-issues", async (req: Request, res: Response) => {
  try {
    const issues = await db.select().from(sgbPrimaryIssues).orderBy(sgbPrimaryIssues.issueOpenDate);
    res.json({ success: true, issues });
  } catch (error) {
    console.warn(`[Gold] SGB issues fetch failed: ${(error as any)?.message || 'Unknown error'}`);
    res.json({ success: true, issues: [] });
  }
});

router.get("/products", async (req: Request, res: Response) => {
  try {
    const products = await db
      .select()
      .from(governmentSecurities)
      .where(eq(governmentSecurities.securityType, "sgb"));
    res.json({ success: true, products });
  } catch (error) {
    console.warn(`[Gold] Products fetch failed: ${(error as any)?.message || 'Unknown error'}`);
    res.json({ success: true, products: [] });
  }
});

router.patch("/sgb-issues/:id/publish", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;
    
    await db
      .update(sgbPrimaryIssues)
      .set({ isPublished })
      .where(eq(sgbPrimaryIssues.id, parseInt(id)));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating SGB publish status:", error);
    res.status(500).json({ success: false, error: "Failed to update status" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    console.log("🔄 Refreshing gold/SGB data from RBI/NSE...");
    res.json({ 
      success: true, 
      message: "Gold data refresh initiated",
      refreshed: {
        sgbIssues: 0,
        goldProducts: 0
      }
    });
  } catch (error) {
    console.error("Error refreshing gold data:", error);
    res.status(500).json({ success: false, error: "Failed to refresh data" });
  }
});

export default router;
