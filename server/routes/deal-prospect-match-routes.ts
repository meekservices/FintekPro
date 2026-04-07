import { Router, Request, Response } from "express";
import { matchDealToProspects, getGeoIntelligence, type DealType } from "../services/aif-pms-prospect-matcher";
import { db } from "../db";
import { aifMaster, pmsMaster, prospectLeads } from "@shared/schema";
import { isNotNull, desc, count, avg, sum, sql } from "drizzle-orm";

const router = Router();

router.post("/match-prospects", async (req: Request, res: Response) => {
  try {
    const { dealId, dealType, limit } = req.body;
    if (!dealId || !dealType) return res.status(400).json({ error: "dealId and dealType (aif|pms) are required" });
    if (!["aif", "pms"].includes(dealType)) return res.status(400).json({ error: "dealType must be 'aif' or 'pms'" });
    const result = await matchDealToProspects(dealId, dealType as DealType, Math.min(limit || 50, 100));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/list", async (_req: Request, res: Response) => {
  try {
    const [aifs, pmss] = await Promise.all([
      db.select({
        id: aifMaster.id,
        name: aifMaster.name,
        dealType: sql<string>`'aif'`.as("deal_type"),
        category: aifMaster.category,
        minInvestment: aifMaster.minInvestment,
        return1Y: aifMaster.return1Y,
        fundStatus: aifMaster.fundStatus,
        isPublished: aifMaster.isPublished,
      }).from(aifMaster).orderBy(desc(aifMaster.createdAt)).limit(50),
      db.select({
        id: pmsMaster.id,
        name: pmsMaster.name,
        dealType: sql<string>`'pms'`.as("deal_type"),
        category: pmsMaster.strategy,
        minInvestment: pmsMaster.minInvestment,
        return1Y: pmsMaster.return1Y,
        fundStatus: pmsMaster.fundStatus,
        isPublished: pmsMaster.isPublished,
      }).from(pmsMaster).orderBy(desc(pmsMaster.createdAt)).limit(50),
    ]);
    res.json({ success: true, deals: [...aifs, ...pmss] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/geo-intelligence", async (_req: Request, res: Response) => {
  try {
    const result = await getGeoIntelligence();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/pipeline-stats", async (_req: Request, res: Response) => {
  try {
    const [prospectStats] = await db
      .select({
        total: count(),
        scored: count(prospectLeads.compositeScore),
        hot: sql<number>`count(*) filter (where lead_quality = 'hot')`.mapWith(Number),
        warm: sql<number>`count(*) filter (where lead_quality = 'warm')`.mapWith(Number),
        avgComposite: avg(prospectLeads.compositeScore),
        totalInvestable: sum(prospectLeads.investableSurplus),
        totalNetworth: sum(prospectLeads.estimatedNetworth),
      })
      .from(prospectLeads);

    const [dealStats] = await db.select({ total: count() }).from(aifMaster);
    const [pmsStats] = await db.select({ total: count() }).from(pmsMaster);

    res.json({
      success: true,
      prospects: {
        total: Number(prospectStats.total),
        scored: Number(prospectStats.scored),
        hot: Number(prospectStats.hot),
        warm: Number(prospectStats.warm),
        avgCompositeScore: parseFloat(String(prospectStats.avgComposite || "0")).toFixed(1),
        totalInvestableRupees: parseFloat(String(prospectStats.totalInvestable || "0")),
        totalNetworthRupees: parseFloat(String(prospectStats.totalNetworth || "0")),
      },
      deals: {
        aifCount: Number(dealStats.total),
        pmsCount: Number(pmsStats.total),
        total: Number(dealStats.total) + Number(pmsStats.total),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
