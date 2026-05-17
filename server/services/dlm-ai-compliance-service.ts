import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { DLMWorkflowService } from "./dlm-workflow-service";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface ClauseAnalysis {
  clauseNumber: string;
  clauseTitle: string;
  category: string;
  text: string;
  isCompliant: boolean;
  complianceNotes: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  confidenceScore: number;
  suggestedText?: string;
  sebiClauseMapping?: string;
}

interface ComplianceFinding {
  clauseRef: string;
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  suggestion: string;
  confidence: number;
}

interface AIReviewResult {
  overallScore: number;
  riskScore: number;
  complianceScore: number;
  findings: ComplianceFinding[];
  missingClauses: string[];
  riskFactors: string[];
  recommendations: string[];
  clauseMapping: ClauseAnalysis[];
  overallConfidence: number;
  explainabilityNotes: string;
  limitations: string;
  processingTime: number;
}

export class DLMAIComplianceService {
  
  // Analyze document for SEBI compliance
  static async analyzeDocument(data: {
    documentId: string;
    versionId: string;
    content: string;
    entityType: string;
    agreementType: string;
  }): Promise<AIReviewResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildAnalysisPrompt(data);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text || "{}";
      const result = this.parseAIResponse(resultText);
      result.processingTime = Date.now() - startTime;

      // Store the review in database
      await this.saveReviewToDatabase(data.documentId, data.versionId, result);

      return result;
    } catch (error: any) {
      console.error("AI Compliance Analysis Error:", error);
      
      // Return a fallback result with error indication
      return {
        overallScore: 50,
        riskScore: 50,
        complianceScore: 50,
        findings: [{
          clauseRef: "N/A",
          issue: "AI analysis could not be completed",
          severity: "medium",
          suggestion: "Manual review required",
          confidence: 0,
        }],
        missingClauses: [],
        riskFactors: ["AI analysis failed - manual review required"],
        recommendations: ["Please have the document reviewed manually by a compliance officer"],
        clauseMapping: [],
        overallConfidence: 0,
        explainabilityNotes: "AI analysis encountered an error. The results shown are placeholders.",
        limitations: `Error: ${error.message}`,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private static buildAnalysisPrompt(data: {
    content: string;
    entityType: string;
    agreementType: string;
  }): string {
    return `You are a SEBI compliance expert analyzing a financial services agreement. Analyze the following ${data.agreementType.replace(/_/g, " ")} for a ${data.entityType} entity.

DOCUMENT CONTENT:
---
${data.content.substring(0, 15000)}
---

Analyze this document for:
1. SEBI regulatory compliance for financial services agreements
2. Standard clause requirements for ${data.agreementType.replace(/_/g, " ")}
3. Risk factors and potential issues
4. Missing mandatory clauses
5. Suggested improvements

Respond in JSON format:
{
  "overallScore": <0-100 overall compliance score>,
  "riskScore": <0-100, higher = more risk>,
  "complianceScore": <0-100 SEBI compliance score>,
  "findings": [
    {
      "clauseRef": "<clause number or reference>",
      "issue": "<description of the compliance issue>",
      "severity": "<low|medium|high|critical>",
      "suggestion": "<recommended fix>",
      "confidence": <0-100>
    }
  ],
  "missingClauses": ["<list of mandatory clauses that should be present>"],
  "riskFactors": ["<identified risk factors>"],
  "recommendations": ["<improvement recommendations>"],
  "clauseMapping": [
    {
      "clauseNumber": "<clause number>",
      "clauseTitle": "<title>",
      "category": "<category: payment_terms|liability|termination|confidentiality|compliance|dispute_resolution|other>",
      "text": "<first 200 chars of clause text>",
      "isCompliant": <true|false>,
      "complianceNotes": "<compliance notes>",
      "riskLevel": "<low|medium|high|critical>",
      "confidenceScore": <0-100>,
      "suggestedText": "<suggested improvement if needed>",
      "sebiClauseMapping": "<relevant SEBI regulation reference if any>"
    }
  ],
  "overallConfidence": <0-100 confidence in the analysis>,
  "explainabilityNotes": "<explanation of how the analysis was conducted>",
  "limitations": "<any limitations or caveats about this analysis>"
}

Focus on:
- KYC/AML compliance requirements
- Investor protection clauses
- Disclosure requirements
- Risk disclosure obligations
- Fee transparency
- Termination and exit provisions
- Dispute resolution mechanisms
- Data privacy and confidentiality
- Regulatory reporting obligations

Provide actionable, specific feedback.`;
  }

  private static parseAIResponse(responseText: string): AIReviewResult {
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        const plainJsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (plainJsonMatch) {
          jsonStr = plainJsonMatch[0];
        }
      }

      const parsed = JSON.parse(jsonStr);

      return {
        overallScore: Math.min(100, Math.max(0, parsed.overallScore || 50)),
        riskScore: Math.min(100, Math.max(0, parsed.riskScore || 50)),
        complianceScore: Math.min(100, Math.max(0, parsed.complianceScore || 50)),
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        missingClauses: Array.isArray(parsed.missingClauses) ? parsed.missingClauses : [],
        riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        clauseMapping: Array.isArray(parsed.clauseMapping) ? parsed.clauseMapping : [],
        overallConfidence: Math.min(100, Math.max(0, parsed.overallConfidence || 70)),
        explainabilityNotes: parsed.explainabilityNotes || "AI analysis based on SEBI compliance requirements",
        limitations: parsed.limitations || "This AI analysis should be reviewed by a qualified compliance officer",
        processingTime: 0,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      
      return {
        overallScore: 50,
        riskScore: 50,
        complianceScore: 50,
        findings: [],
        missingClauses: [],
        riskFactors: ["Unable to parse AI analysis"],
        recommendations: ["Manual review required"],
        clauseMapping: [],
        overallConfidence: 0,
        explainabilityNotes: "AI response could not be parsed",
        limitations: "Parse error - manual review required",
        processingTime: 0,
      };
    }
  }

  private static async saveReviewToDatabase(
    documentId: string,
    versionId: string,
    result: AIReviewResult
  ) {
    try {
      // Generate report hash
      const reportHash = DLMWorkflowService.generateHash(JSON.stringify(result));

      // Insert AI review record
      const [review] = await db.insert(schema.documentAiReviews)
        .values({
          documentId,
          versionId,
          reviewType: "compliance",
          modelUsed: "gemini-2.0-flash",
          overallScore: result.overallScore,
          riskScore: result.riskScore,
          complianceScore: result.complianceScore,
          findings: result.findings,
          missingClauses: result.missingClauses,
          riskFactors: result.riskFactors,
          recommendations: result.recommendations,
          clauseMapping: result.clauseMapping,
          reportHash,
          overallConfidence: result.overallConfidence,
          explainabilityNotes: result.explainabilityNotes,
          limitations: result.limitations,
          processingTime: result.processingTime,
          isAcknowledged: false,
        })
        .returning();

      // Update document with AI review score
      await db.update(schema.documents)
        .set({
          aiReviewScore: result.overallScore,
          riskScore: result.riskScore,
          complianceScore: result.complianceScore,
          updatedAt: new Date(),
        })
        .where(eq(schema.documents.id, documentId));

      // Create audit event
      await DLMWorkflowService.createAuditEvent({
        documentId,
        versionId,
        eventType: "ai_review_completed",
        eventCategory: "compliance",
        eventData: {
          reviewId: review.id,
          overallScore: result.overallScore,
          riskScore: result.riskScore,
          complianceScore: result.complianceScore,
          findingsCount: result.findings.length,
          confidence: result.overallConfidence,
        },
      });

      return review;
    } catch (error) {
      console.error("Error saving AI review:", error);
      throw error;
    }
  }

  // Get AI review for a document version
  static async getReview(documentId: string, versionId?: string) {
    let query = db.select()
      .from(schema.documentAiReviews)
      .where(eq(schema.documentAiReviews.documentId, documentId))
      .orderBy(schema.documentAiReviews.createdAt);

    if (versionId) {
      query = query.where(eq(schema.documentAiReviews.versionId, versionId)) as any;
    }

    const reviews = await query.limit(1);
    return reviews[0] || null;
  }

  // Acknowledge AI review (admin confirmation)
  static async acknowledgeReview(data: {
    reviewId: string;
    acknowledgedBy: string;
    notes?: string;
  }) {
    const [review] = await db.update(schema.documentAiReviews)
      .set({
        isAcknowledged: true,
        acknowledgedBy: data.acknowledgedBy,
        acknowledgedAt: new Date(),
        acknowledgmentNotes: data.notes,
      })
      .where(eq(schema.documentAiReviews.id, data.reviewId))
      .returning();

    if (review) {
      await DLMWorkflowService.createAuditEvent({
        documentId: review.documentId,
        versionId: review.versionId || undefined,
        eventType: "ai_review_acknowledged",
        eventCategory: "compliance",
        actorId: data.acknowledgedBy,
        eventData: {
          reviewId: review.id,
          notes: data.notes,
        },
      });
    }

    return review;
  }

  // Compare two document versions for changes
  static async compareVersions(data: {
    documentId: string;
    versionId1: string;
    versionId2: string;
  }) {
    const [version1] = await db.select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.id, data.versionId1))
      .limit(1);

    const [version2] = await db.select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.id, data.versionId2))
      .limit(1);

    if (!version1 || !version2) {
      throw new Error("One or both versions not found");
    }

    const prompt = `Compare these two document versions and identify changes:

VERSION 1 (v${version1.versionNumber}):
---
${(version1.content || "").substring(0, 8000)}
---

VERSION 2 (v${version2.versionNumber}):
---
${(version2.content || "").substring(0, 8000)}
---

Respond in JSON format:
{
  "summary": "<brief summary of changes>",
  "addedClauses": ["<clauses added in version 2>"],
  "removedClauses": ["<clauses removed from version 1>"],
  "modifiedClauses": [
    {
      "clauseRef": "<clause reference>",
      "originalText": "<original text summary>",
      "newText": "<new text summary>",
      "significanceLevel": "<low|medium|high>",
      "complianceImpact": "<description of compliance impact>"
    }
  ],
  "riskDelta": {
    "direction": "<increased|decreased|unchanged>",
    "explanation": "<explanation>"
  },
  "recommendation": "<recommendation for reviewers>"
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text || "{}";
      return JSON.parse(resultText);
    } catch (error) {
      console.error("Version comparison error:", error);
      return {
        summary: "Comparison could not be completed",
        addedClauses: [],
        removedClauses: [],
        modifiedClauses: [],
        riskDelta: { direction: "unchanged", explanation: "Analysis failed" },
        recommendation: "Manual review required",
      };
    }
  }

  // Generate suggested clause text
  static async suggestClauseText(data: {
    clauseCategory: string;
    entityType: string;
    agreementType: string;
    existingText?: string;
  }) {
    const prompt = `Generate SEBI-compliant clause text for a ${data.agreementType.replace(/_/g, " ")} with a ${data.entityType} entity.

Clause Category: ${data.clauseCategory.replace(/_/g, " ")}
${data.existingText ? `\nExisting Text to Improve:\n${data.existingText}` : ""}

Provide a well-drafted clause that:
1. Meets SEBI regulatory requirements
2. Protects both parties fairly
3. Is clear and unambiguous
4. Includes necessary disclosures

Respond in JSON format:
{
  "suggestedText": "<the full suggested clause text>",
  "explanation": "<why this wording is recommended>",
  "regulatoryReference": "<relevant SEBI circular or regulation>",
  "keyPoints": ["<key compliance points covered>"]
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          temperature: 0.4,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text || "{}";
      return JSON.parse(resultText);
    } catch (error) {
      console.error("Clause suggestion error:", error);
      return {
        suggestedText: "",
        explanation: "Suggestion could not be generated",
        regulatoryReference: "",
        keyPoints: [],
      };
    }
  }
}

export default DLMAIComplianceService;