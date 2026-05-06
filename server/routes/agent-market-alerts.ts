import { Router } from "express";
import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();
const requireAuth = requireAgentPortal;

router.get("/market-alerts", requireAuth, async (req, res) => {
  try {
    // Implementation for market alerts
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch market alerts" });
  }
});

export default router;
