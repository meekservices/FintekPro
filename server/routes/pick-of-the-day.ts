import { Router } from "express";
import { pickOfTheDayService, PickCategory } from "../services/pick-of-the-day-service";

const router = Router();

router.get("/today", async (req, res) => {
  try {
    let picks = await pickOfTheDayService.getTodaysPicks();
    
    if (picks.length === 0) {
      picks = await pickOfTheDayService.generateDailyPicks();
    }
    
    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      picks,
    });
  } catch (error) {
    console.error("[API] Error fetching today's picks:", error);
    res.status(500).json({ success: false, error: "Failed to fetch picks" });
  }
});

router.get("/live", async (req, res) => {
  try {
    const picks = await pickOfTheDayService.getLivePicks();
    res.json({
      success: true,
      count: picks.length,
      picks,
    });
  } catch (error) {
    console.error("[API] Error fetching live picks:", error);
    res.status(500).json({ success: false, error: "Failed to fetch live picks" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const category = req.query.category as PickCategory | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const picks = await pickOfTheDayService.getPickHistory(category, limit);
    res.json({
      success: true,
      count: picks.length,
      picks,
    });
  } catch (error) {
    console.error("[API] Error fetching pick history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch history" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await pickOfTheDayService.getPerformanceStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[API] Error fetching pick stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const picks = await pickOfTheDayService.generateDailyPicks();
    res.json({
      success: true,
      message: `Generated ${picks.length} picks`,
      picks,
    });
  } catch (error) {
    console.error("[API] Error generating picks:", error);
    res.status(500).json({ success: false, error: "Failed to generate picks" });
  }
});

router.post("/update-statuses", async (req, res) => {
  try {
    const result = await pickOfTheDayService.updatePickStatuses();
    res.json({
      success: true,
      message: `Updated ${result.updated} picks`,
      details: result.details,
    });
  } catch (error) {
    console.error("[API] Error updating pick statuses:", error);
    res.status(500).json({ success: false, error: "Failed to update statuses" });
  }
});

export default router;
