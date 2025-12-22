import { Router, Request, Response } from "express";
import { db } from "../db";
import { listedStocks } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

const router = Router();

router.get("/listed-stocks", async (req: Request, res: Response) => {
  try {
    const stocks = await db.select().from(listedStocks).orderBy(listedStocks.symbol);
    res.json(stocks);
  } catch (error: any) {
    console.error("Error fetching listed stocks:", error);
    res.status(500).json({ error: error.message || "Failed to fetch listed stocks" });
  }
});

router.post("/listed-stocks", async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      companyName,
      isin,
      bseCode,
      nseCode,
      sector,
      industry,
      marketCap,
      currentPrice,
      peRatio,
      pbRatio,
      dividendYield,
      return1Year,
      return3Year,
      analystRating,
      targetPrice,
      selectionNotes
    } = req.body;

    if (!symbol || !companyName) {
      return res.status(400).json({ error: "Symbol and company name are required" });
    }

    const existingStock = await db.select().from(listedStocks)
      .where(eq(listedStocks.symbol, symbol.toUpperCase()))
      .limit(1);

    if (existingStock.length > 0) {
      return res.status(400).json({ error: "Stock with this symbol already exists" });
    }

    const [newStock] = await db.insert(listedStocks).values({
      symbol: symbol.toUpperCase(),
      companyName,
      isin: isin || null,
      bseCode: bseCode || null,
      nseCode: nseCode || null,
      sector: sector || null,
      industry: industry || null,
      marketCap: marketCap || null,
      currentPrice: currentPrice || null,
      peRatio: peRatio || null,
      pbRatio: pbRatio || null,
      dividendYield: dividendYield || null,
      returns1Y: return1Year || null,
      returns3Y: return3Year || null,
      analystRating: analystRating || null,
      targetPrice: targetPrice || null,
      selectionNotes: selectionNotes || null,
      isPublished: false,
    }).returning();

    res.json(newStock);
  } catch (error: any) {
    console.error("Error adding listed stock:", error);
    res.status(500).json({ error: error.message || "Failed to add listed stock" });
  }
});

router.patch("/listed-stocks/:id/publish", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const [updatedStock] = await db.update(listedStocks)
      .set({ 
        isPublished: isPublished === true,
        publishedAt: isPublished ? new Date() : null
      })
      .where(eq(listedStocks.id, id))
      .returning();

    if (!updatedStock) {
      return res.status(404).json({ error: "Stock not found" });
    }

    res.json(updatedStock);
  } catch (error: any) {
    console.error("Error updating listed stock:", error);
    res.status(500).json({ error: error.message || "Failed to update listed stock" });
  }
});

router.patch("/listed-stocks/bulk-publish", async (req: Request, res: Response) => {
  try {
    const { ids, isPublished } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs array is required" });
    }

    await db.update(listedStocks)
      .set({ 
        isPublished: isPublished === true,
        publishedAt: isPublished ? new Date() : null
      })
      .where(inArray(listedStocks.id, ids.map(String)));

    res.json({ success: true, updated: ids.length });
  } catch (error: any) {
    console.error("Error bulk updating listed stocks:", error);
    res.status(500).json({ error: error.message || "Failed to bulk update listed stocks" });
  }
});

router.delete("/listed-stocks/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deletedStock] = await db.delete(listedStocks)
      .where(eq(listedStocks.id, id))
      .returning();

    if (!deletedStock) {
      return res.status(404).json({ error: "Stock not found" });
    }

    res.json({ success: true, deleted: deletedStock });
  } catch (error: any) {
    console.error("Error deleting listed stock:", error);
    res.status(500).json({ error: error.message || "Failed to delete listed stock" });
  }
});

export default router;
