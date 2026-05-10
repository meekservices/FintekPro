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

    // 0. Fetch Context Data
    const entityData = await treasuryService.getPositions(entityId || "default");
    const dataString = JSON.stringify(entityData, null, 2);

    // 1. Generate Cache Key (hash of query + data context)
    const inputParams = { query, entityData };
    const { getCachedRationale, cacheRationale } = await import("../services/investment-cache-service");
    
    // 2. Check Cache
    const cachedResult = await getCachedRationale("treasury_copilot", inputParams);
    
    if (cachedResult) {
      console.log(`[TreasuryCopilot] Cache HIT for query: ${query.slice(0, 50)}...`);
      return res.json({ 
        answer: cachedResult.rationale,
        isCached: true,
        cachedAt: cachedResult.createdAt
      });
    }

    console.log(`[TreasuryCopilot] Cache MISS for query: ${query.slice(0, 50)}...`);

    const systemPrompt = `You are the FintekPro Treasury Copilot. 
You help corporate users manage their liquidity, bank balances, and payouts.
Here is the current treasury status for the user:
${dataString}

Provide concise, professional, and actionable advice.`;

    const result = await aiService.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ], {
      feature: "treasury-copilot",
      userId: entityId || "demo-user"
    });

    // 3. Store in Cache
    await cacheRationale("treasury_copilot", inputParams, result.content, {
      userId: entityId || "demo-user",
      modelUsed: result.usage.model,
      tokensUsed: result.usage.totalTokens
    });

    res.json({ answer: result.content, isCached: false });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Treasury Copilot Error:", error);
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
