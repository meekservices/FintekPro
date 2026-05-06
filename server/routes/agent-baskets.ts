import { Router } from "express";
import { db } from "../db";
import { agentBaskets, agentBasketItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();
const requireAuth = requireAgentPortal;

router.get("/baskets", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const baskets = await db
      .select()
      .from(agentBaskets)
      .where(eq(agentBaskets.agentId, agentId));
    res.json(baskets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch baskets" });
  }
});

export default router;
