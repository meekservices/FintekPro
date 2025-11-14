import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { aiFixSuggestions } from "@shared/schema";
import { desc, and, gte, lte, eq, sql, count } from "drizzle-orm";
import { logger } from "./logger";

// Gemini AI integration for error analysis
async function analyzeErrorWithGemini(errorContext: {
  errorMessage: string;
  stackTrace?: string;
  endpoint?: string;
  occurrenceCount: number;
}): Promise<{
  rootCause: string;
  confidence: number;
  summary: string;
  suggestedFix: string;
  suggestedCode?: string;
  fixCategory: string;
}> {
  try {
    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('Gemini API key not configured, using fallback analysis');
      return {
        rootCause: 'AI analysis unavailable - Gemini API key not configured',
        confidence: 0,
        summary: errorContext.errorMessage,
        suggestedFix: 'Please check the error logs and stack trace manually',
        fixCategory: 'manual_review',
      };
    }
    
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = 'gemini-2.0-flash-exp';
    
    const prompt = `You are an expert software debugging assistant for a financial services platform. Analyze this error and provide actionable fix suggestions.

Error Details:
- Message: ${errorContext.errorMessage}
- Endpoint: ${errorContext.endpoint || 'Unknown'}
- Occurrence Count: ${errorContext.occurrenceCount}
- Stack Trace: ${errorContext.stackTrace?.slice(0, 500) || 'Not available'}

Provide your analysis in the following JSON format:
{
  "rootCause": "Brief explanation of what's causing this error",
  "confidence": <number 0-100>,
  "summary": "One-sentence summary of the issue",
  "suggestedFix": "Detailed fix recommendation",
  "suggestedCode": "Code patch if applicable (optional)",
  "fixCategory": "code_patch|config_change|dependency_update|rollback|vendor_issue"
}

Be specific and actionable. If this is a vendor/third-party API issue, suggest fallback strategies.`;
    
    const response = await ai.models.generateContent({
      model,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            rootCause: { type: "string" },
            confidence: { type: "number" },
            summary: { type: "string" },
            suggestedFix: { type: "string" },
            suggestedCode: { type: "string" },
            fixCategory: { type: "string" }
          },
          required: ["rootCause", "confidence", "summary", "suggestedFix", "fixCategory"]
        }
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    // Safely extract text from response
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    const analysis = JSON.parse(jsonText);
    
    // Validate required fields
    if (!analysis.rootCause || !analysis.summary || !analysis.suggestedFix || !analysis.fixCategory) {
      throw new Error('Invalid response structure from Gemini API');
    }
    
    // Ensure confidence is a number between 0 and 100
    if (typeof analysis.confidence !== 'number' || analysis.confidence < 0 || analysis.confidence > 100) {
      analysis.confidence = 50; // Default to medium confidence
    }
    
    logger.info('AI error analysis completed', { 
      error: errorContext.errorMessage.slice(0, 100),
      confidence: analysis.confidence,
    });
    
    return analysis;
  } catch (error) {
    logger.error('Error analyzing with Gemini', { error: String(error) });
    
    // Fallback analysis
    return {
      rootCause: 'Error analysis failed - ' + String(error).slice(0, 100),
      confidence: 0,
      summary: errorContext.errorMessage,
      suggestedFix: 'Please manually review the error logs and stack trace',
      fixCategory: 'manual_review',
    };
  }
}

const router = Router();

// GET / - Get all AI fix suggestions
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, severity, limit = 50 } = req.query;
    
    let query = db
      .select()
      .from(aiFixSuggestions)
      .orderBy(desc(aiFixSuggestions.createdAt))
      .limit(parseInt(limit as string));
    
    const conditions = [];
    
    if (status) {
      conditions.push(eq(aiFixSuggestions.status, status as string));
    }
    if (severity) {
      conditions.push(eq(aiFixSuggestions.severity, severity as string));
    }
    
    if (conditions.length > 0) {
      query = db
        .select()
        .from(aiFixSuggestions)
        .where(and(...conditions))
        .orderBy(desc(aiFixSuggestions.createdAt))
        .limit(parseInt(limit as string)) as any;
    }
    
    const suggestions = await query;
    
    res.json({ suggestions, count: suggestions.length });
  } catch (error) {
    logger.error('Error fetching AI fix suggestions', { error: String(error) });
    res.status(500).json({ message: "Error fetching AI fix suggestions" });
  }
});

// POST /analyze - Analyze an error and generate AI fix suggestion
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { 
      errorMessage, 
      stackTrace, 
      endpoint, 
      errorType,
      severity = 'medium',
    } = req.body;
    
    if (!errorMessage) {
      return res.status(400).json({ message: "Error message is required" });
    }
    
    // Check if similar error already exists
    const existing = await db
      .select()
      .from(aiFixSuggestions)
      .where(eq(aiFixSuggestions.errorMessage, errorMessage))
      .limit(1);
    
    if (existing.length > 0) {
      // Update occurrence count
      const updated = await db
        .update(aiFixSuggestions)
        .set({
          occurrenceCount: (existing[0].occurrenceCount || 0) + 1,
          lastSeenAt: new Date(),
        })
        .where(eq(aiFixSuggestions.id, existing[0].id))
        .returning();
      
      return res.json({ 
        message: "Error already analyzed, updated occurrence count",
        suggestion: updated[0],
      });
    }
    
    // Analyze with Gemini AI
    const analysis = await analyzeErrorWithGemini({
      errorMessage,
      stackTrace,
      endpoint,
      occurrenceCount: 1,
    });
    
    // Create new AI fix suggestion
    const newSuggestion = await db
      .insert(aiFixSuggestions)
      .values({
        errorType: errorType || 'unknown',
        endpoint,
        errorMessage,
        stackTrace,
        severity,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        aiRootCause: analysis.rootCause,
        aiConfidence: analysis.confidence,
        aiSummary: analysis.summary,
        suggestedFix: analysis.suggestedFix,
        suggestedCode: analysis.suggestedCode,
        fixCategory: analysis.fixCategory,
        status: 'pending',
      })
      .returning();
    
    logger.info('AI fix suggestion created', { 
      suggestionId: newSuggestion[0].id,
      confidence: analysis.confidence,
    });
    
    res.json({ 
      message: "AI analysis completed",
      suggestion: newSuggestion[0],
    });
  } catch (error) {
    logger.error('Error analyzing error with AI', { error: String(error) });
    res.status(500).json({ message: "Error analyzing error" });
  }
});

// PATCH /:id/review - Review an AI fix suggestion
router.patch("/:id/review", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const updated = await db
      .update(aiFixSuggestions)
      .set({
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(aiFixSuggestions.id, id))
      .returning();
    
    if (updated.length === 0) {
      return res.status(404).json({ message: "Fix suggestion not found" });
    }
    
    logger.info('AI fix suggestion reviewed', { 
      suggestionId: id,
      status,
      reviewedBy: userId,
    });
    
    res.json({ 
      message: "Fix suggestion reviewed",
      suggestion: updated[0],
    });
  } catch (error) {
    logger.error('Error reviewing AI fix suggestion', { error: String(error) });
    res.status(500).json({ message: "Error reviewing suggestion" });
  }
});

// POST /:id/deploy - Deploy an AI fix suggestion
router.post("/:id/deploy", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deploymentNotes } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Get the fix suggestion
    const suggestion = await db
      .select()
      .from(aiFixSuggestions)
      .where(eq(aiFixSuggestions.id, id))
      .limit(1);
    
    if (suggestion.length === 0) {
      return res.status(404).json({ message: "Fix suggestion not found" });
    }
    
    if (suggestion[0].status !== 'approved') {
      return res.status(400).json({ message: "Fix suggestion must be approved before deployment" });
    }
    
    const updated = await db
      .update(aiFixSuggestions)
      .set({
        status: 'deployed',
        deployedBy: userId,
        deployedAt: new Date(),
        deploymentStatus: 'success',
        deploymentNotes,
        updatedAt: new Date(),
      })
      .where(eq(aiFixSuggestions.id, id))
      .returning();
    
    logger.info('AI fix suggestion deployed', { 
      suggestionId: id,
      deployedBy: userId,
    });
    
    res.json({ 
      message: "Fix suggestion deployed successfully",
      suggestion: updated[0],
    });
  } catch (error) {
    logger.error('Error deploying AI fix suggestion', { error: String(error) });
    res.status(500).json({ message: "Error deploying suggestion" });
  }
});

// POST /:id/resolve - Mark an AI fix suggestion as resolved
router.post("/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionMethod } = req.body;
    
    const updated = await db
      .update(aiFixSuggestions)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionMethod,
        updatedAt: new Date(),
      })
      .where(eq(aiFixSuggestions.id, id))
      .returning();
    
    if (updated.length === 0) {
      return res.status(404).json({ message: "Fix suggestion not found" });
    }
    
    logger.info('AI fix suggestion resolved', { 
      suggestionId: id,
      resolutionMethod,
    });
    
    res.json({ 
      message: "Fix suggestion marked as resolved",
      suggestion: updated[0],
    });
  } catch (error) {
    logger.error('Error resolving AI fix suggestion', { error: String(error) });
    res.status(500).json({ message: "Error resolving suggestion" });
  }
});

// GET /stats - Get AI fix suggestions statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const totalSuggestions = await db
      .select({ count: count() })
      .from(aiFixSuggestions);
    
    const pendingCount = await db
      .select({ count: count() })
      .from(aiFixSuggestions)
      .where(eq(aiFixSuggestions.status, 'pending'));
    
    const approvedCount = await db
      .select({ count: count() })
      .from(aiFixSuggestions)
      .where(eq(aiFixSuggestions.status, 'approved'));
    
    const deployedCount = await db
      .select({ count: count() })
      .from(aiFixSuggestions)
      .where(eq(aiFixSuggestions.status, 'deployed'));
    
    const resolvedCount = await db
      .select({ count: count() })
      .from(aiFixSuggestions)
      .where(eq(aiFixSuggestions.status, 'resolved'));
    
    const avgConfidence = await db
      .select({ 
        avg: sql<number>`AVG(${aiFixSuggestions.aiConfidence})` 
      })
      .from(aiFixSuggestions)
      .where(sql`${aiFixSuggestions.aiConfidence} IS NOT NULL`);
    
    res.json({
      total: totalSuggestions[0].count,
      pending: pendingCount[0].count,
      approved: approvedCount[0].count,
      deployed: deployedCount[0].count,
      resolved: resolvedCount[0].count,
      averageConfidence: Math.round(avgConfidence[0]?.avg ?? 0),
    });
  } catch (error) {
    logger.error('Error fetching AI fix statistics', { error: String(error) });
    res.status(500).json({ message: "Error fetching statistics" });
  }
});

export default router;
