import { Router } from "express";
import { aiService } from "../services/ai-service";
import { treasuryPrompts } from "../ai/prompts/treasury";
import { treasuryService } from "../services/treasury-service";

const router = Router();

router.post("/copilot/query", async (req, res) => {
  try {
    const { query, entityId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // In a real app, we'd fetch actual entity data to provide context
    const entityData = await treasuryService.getPositions(entityId || "default");
    const dataString = JSON.stringify(entityData, null, 2);

    const systemPrompt = `You are the FintekPro Treasury Copilot. 
You help corporate users manage their liquidity, bank balances, and payouts.
Here is the current treasury status for the user:
${dataString}

Provide concise, professional, and actionable advice.`;

    const response = await aiService.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ], {
      feature: "treasury-copilot",
      userId: entityId || "demo-user"
    });

    res.json({ answer: response.content });
  } catch (error: any) {
    console.error("Treasury Copilot Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
