import { Router } from "express";
import { db } from "../db";
import { sql, eq, desc } from "drizzle-orm";
import { corporateActions, creditRatings, symbolMapping } from "@shared/schema";

const router = Router();

// 1. Corporate Actions
router.get("/api/institutional/corporate-actions", async (req, res) => {
  try {
    const results = await db.select()
      .from(corporateActions)
      .orderBy(desc(corporateActions.exDate))
      .limit(100);
    res.json(results);
  } catch (error: any) {
    console.error("[Institutional] Corporate actions fetch error:", error.message);
    res.status(500).json({ message: "Internal server error fetching corporate actions" });
  }
});

// 2. Credit Ratings
router.get("/api/institutional/credit-ratings", async (req, res) => {
  try {
    const results = await db.select()
      .from(creditRatings)
      .orderBy(desc(creditRatings.ratingDate))
      .limit(100);
    res.json(results);
  } catch (error: any) {
    console.error("[Institutional] Credit ratings fetch error:", error.message);
    res.status(500).json({ message: "Internal server error fetching credit ratings" });
  }
});

// 3. Security Master
router.get("/api/institutional/security-master", async (req, res) => {
  try {
    const query = req.query.q as string;
    let results;
    
    if (query && query.length >= 2) {
      const searchTerm = `%${query}%`;
      results = await db.execute(sql`
        SELECT * FROM security_master 
        WHERE instrument_name ILIKE ${searchTerm} 
           OR symbol ILIKE ${searchTerm} 
           OR isin ILIKE ${searchTerm}
        LIMIT 100
      `);
    } else {
      results = await db.execute(sql`
        SELECT * FROM security_master 
        LIMIT 100
      `);
    }
    
    res.json(results.rows);
  } catch (error: any) {
    console.error("[Institutional] Security master fetch error:", error.message);
    res.status(500).json({ message: "Internal server error fetching security master" });
  }
});

// 4. Symbol Mapping
router.get("/api/institutional/symbol-mapping", async (req, res) => {
  try {
    const results = await db.select()
      .from(symbolMapping)
      .orderBy(desc(symbolMapping.createdAt))
      .limit(100);
    res.json(results);
  } catch (error: any) {
    console.error("[Institutional] Symbol mapping fetch error:", error.message);
    res.status(500).json({ message: "Internal server error fetching symbol mappings" });
  }
});

export default router;
