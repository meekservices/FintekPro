import { db } from "../db";
import { aiService, AICapability } from "./ai-service";

import { 
  marketBriefs, 
  productKnowledge, 
  explanationTemplates, 
  knowledgeAuditLogs, 
  knowledgeDisclaimers,
  assetClassInsights,
  knowledgeHubConfig,
  certificationQuizzes,
  quizAttempts,
  agentCertifications
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";
import { createHash } from "crypto";

export class KnowledgeHubService {
  async getConfig() {
    const configs = await db.select().from(knowledgeHubConfig).limit(1);
    if (configs.length === 0) {
      return {
        isEnabled: true,
        enabledForRoles: ["agent", "partner"],
        marketBriefEnabled: true,
        certificationEnabled: true,
        sharingEnabled: true,
        aiExplanationEnabled: true,
      };
    }
    return configs[0];
  }

  async updateConfig(userId: string, updates: Partial<typeof knowledgeHubConfig.$inferSelect>) {
    const existing = await db.select().from(knowledgeHubConfig).limit(1);
    if (existing.length === 0) {
      return db.insert(knowledgeHubConfig).values({
        ...updates,
        updatedBy: userId,
        updatedAt: new Date(),
      } as any).returning();
    }
    return db.update(knowledgeHubConfig)
      .set({ ...updates, updatedBy: userId, updatedAt: new Date() })
      .where(eq(knowledgeHubConfig.id, existing[0].id))
      .returning();
  }

  async getTodaysBrief(region: string = "india") {
    const today = new Date().toISOString().split('T')[0];
    const briefs = await db.select()
      .from(marketBriefs)
      .where(and(
        eq(marketBriefs.date, today),
        eq(marketBriefs.region, region),
        eq(marketBriefs.status, "published")
      ))
      .orderBy(desc(marketBriefs.version))
      .limit(1);
    return briefs[0] || null;
  }

  async getLatestApprovedBrief(region: string = "india") {
    const briefs = await db.select()
      .from(marketBriefs)
      .where(and(
        eq(marketBriefs.region, region),
        eq(marketBriefs.status, "published")
      ))
      .orderBy(desc(marketBriefs.date), desc(marketBriefs.version))
      .limit(1);
    return briefs[0] || null;
  }

  async getMarketBriefs(filters: { region?: string; status?: string; limit?: number } = {}) {
    const { region, status, limit = 10 } = filters;
    let query = db.select().from(marketBriefs);
    
    const conditions = [];
    if (region) conditions.push(eq(marketBriefs.region, region));
    if (status) conditions.push(eq(marketBriefs.status, status));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(marketBriefs.date)).limit(limit);
  }

  async createMarketBrief(data: {
    date: string;
    region: string;
    marketSnapshot: string;
    whatChanged: string;
    keyRisks?: string;
    opportunityAreas?: string;
    portfolioImpact?: string;
    complianceNote?: string;
    dataSourcesUsed?: any[];
  }) {
    const disclaimer = await this.getActiveDisclaimer("market_brief");
    return db.insert(marketBriefs).values({
      ...data,
      status: "draft",
      disclaimerVersionId: disclaimer?.id,
    } as any).returning();
  }

  async approveMarketBrief(briefId: string, approverId: string) {
    return db.update(marketBriefs)
      .set({
        status: "published",
        approvedBy: approverId,
        approvedAt: new Date(),
        publishedAt: new Date(),
      })
      .where(eq(marketBriefs.id, briefId))
      .returning();
  }

  async rejectMarketBrief(briefId: string, reviewerId: string, reason: string) {
    return db.update(marketBriefs)
      .set({
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(marketBriefs.id, briefId))
      .returning();
  }

  async getProductKnowledge(filters: { productType?: string; riskProfile?: string; status?: string } = {}) {
    const { productType, riskProfile, status = "published" } = filters;
    const conditions = [eq(productKnowledge.status, status)];
    
    if (productType) conditions.push(eq(productKnowledge.productType, productType));
    if (riskProfile) conditions.push(eq(productKnowledge.riskProfile, riskProfile));
    
    return db.select()
      .from(productKnowledge)
      .where(and(...conditions))
      .orderBy(productKnowledge.productType, productKnowledge.title);
  }

  async getProductKnowledgeById(id: string) {
    const products = await db.select()
      .from(productKnowledge)
      .where(eq(productKnowledge.id, id))
      .limit(1);
    return products[0] || null;
  }

  async createProductKnowledge(data: any, createdBy: string) {
    return db.insert(productKnowledge).values({
      ...data,
      createdBy,
      lastEditedBy: createdBy,
      status: "draft",
    } as any).returning();
  }

  async updateProductKnowledge(id: string, data: any, editedBy: string) {
    const existing = await this.getProductKnowledgeById(id);
    if (!existing) throw new Error("Product knowledge not found");

    const editHistory = [...(existing.editHistory as any[] || []), {
      userId: editedBy,
      timestamp: new Date().toISOString(),
      changes: Object.keys(data),
    }];

    return db.update(productKnowledge)
      .set({
        ...data,
        lastEditedBy: editedBy,
        editHistory,
        updatedAt: new Date(),
      })
      .where(eq(productKnowledge.id, id))
      .returning();
  }

  async publishProductKnowledge(id: string, publishedBy: string) {
    return db.update(productKnowledge)
      .set({
        status: "published",
        publishedBy,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(productKnowledge.id, id))
      .returning();
  }

  async getExplanationTemplates(filters: { category?: string } = {}) {
    const { category } = filters;
    let query = db.select().from(explanationTemplates);
    
    if (category) {
      query = query.where(eq(explanationTemplates.category, category)) as any;
    }
    
    return query.where(eq(explanationTemplates.status, "active"))
      .orderBy(explanationTemplates.category, explanationTemplates.title);
  }

  async getExplanationTemplateById(id: string) {
    const templates = await db.select()
      .from(explanationTemplates)
      .where(eq(explanationTemplates.id, id))
      .limit(1);
    return templates[0] || null;
  }

  async createExplanationTemplate(data: any, createdBy: string) {
    return db.insert(explanationTemplates).values({
      ...data,
      createdBy,
      status: "active",
    } as any).returning();
  }

  async getAssetClassInsights(assetClass?: string) {
    let query = db.select().from(assetClassInsights);
    
    if (assetClass) {
      query = query.where(eq(assetClassInsights.assetClass, assetClass)) as any;
    }
    
    return query.where(eq(assetClassInsights.status, "published"))
      .orderBy(assetClassInsights.displayOrder);
  }

  async getDisclaimers(category?: string) {
    let query = db.select().from(knowledgeDisclaimers);
    
    const conditions = [eq(knowledgeDisclaimers.isActive, true)];
    if (category) {
      conditions.push(eq(knowledgeDisclaimers.category, category));
    }
    
    return query.where(and(...conditions)).orderBy(desc(knowledgeDisclaimers.effectiveFrom));
  }

  async getActiveDisclaimer(category: string) {
    const disclaimers = await db.select()
      .from(knowledgeDisclaimers)
      .where(and(
        eq(knowledgeDisclaimers.category, category),
        eq(knowledgeDisclaimers.isActive, true)
      ))
      .orderBy(desc(knowledgeDisclaimers.effectiveFrom))
      .limit(1);
    return disclaimers[0] || null;
  }

  async createDisclaimer(data: { name: string; category: string; content: string; shortContent?: string }, createdBy: string) {
    const contentHash = createHash('sha256').update(data.content).digest('hex');
    
    const existing = await db.select()
      .from(knowledgeDisclaimers)
      .where(eq(knowledgeDisclaimers.category, data.category))
      .orderBy(desc(knowledgeDisclaimers.version))
      .limit(1);
    
    const version = existing.length > 0 ? (existing[0].version || 0) + 1 : 1;

    if (existing.length > 0) {
      await db.update(knowledgeDisclaimers)
        .set({ isActive: false, effectiveUntil: new Date() })
        .where(eq(knowledgeDisclaimers.id, existing[0].id));
    }

    return db.insert(knowledgeDisclaimers).values({
      ...data,
      version,
      contentHash,
      isActive: true,
      createdBy,
    } as any).returning();
  }

  async logAuditEvent(data: {
    userId: string;
    userRole: string;
    eventType: string;
    resourceType?: string;
    resourceId?: string;
    clientId?: string;
    clientName?: string;
    contentId?: string;
    contentVersion?: number;
    actionDetails?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const disclaimer = await this.getActiveDisclaimer("general");
    const disclaimerVersionHash = disclaimer 
      ? createHash('sha256').update(disclaimer.content).digest('hex').substring(0, 64)
      : null;

    const lastLog = await db.select({ recordHash: knowledgeAuditLogs.recordHash })
      .from(knowledgeAuditLogs)
      .orderBy(desc(knowledgeAuditLogs.createdAt))
      .limit(1);
    
    const previousRecordHash = lastLog.length > 0 ? lastLog[0].recordHash : null;

    const recordContent = JSON.stringify({
      ...data,
      disclaimerVersionHash,
      previousRecordHash,
      timestamp: new Date().toISOString(),
    });
    const recordHash = createHash('sha256').update(recordContent).digest('hex').substring(0, 64);

    return db.insert(knowledgeAuditLogs).values({
      ...data,
      disclaimerVersionHash,
      previousRecordHash,
      recordHash,
    } as any).returning();
  }

  async getAuditLogs(filters: { userId?: string; eventType?: string; startDate?: Date; endDate?: Date; limit?: number } = {}) {
    const { userId, eventType, startDate, endDate, limit = 100 } = filters;
    const conditions = [];
    
    if (userId) conditions.push(eq(knowledgeAuditLogs.userId, userId));
    if (eventType) conditions.push(eq(knowledgeAuditLogs.eventType, eventType));
    if (startDate) conditions.push(gte(knowledgeAuditLogs.createdAt, startDate));
    if (endDate) conditions.push(lte(knowledgeAuditLogs.createdAt, endDate));
    
    let query = db.select().from(knowledgeAuditLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(knowledgeAuditLogs.createdAt)).limit(limit);
  }

  async getAgentCertifications(agentId: string) {
    return db.select()
      .from(agentCertifications)
      .where(eq(agentCertifications.agentId, agentId))
      .orderBy(desc(agentCertifications.createdAt));
  }

  async addAgentCertification(agentId: string, data: {
    certificationType: string;
    certificationName: string;
    quizScore?: number;
    isCertified?: boolean;
  }) {
    return db.insert(agentCertifications).values({
      agentId,
      certificationType: data.certificationType,
      certificationName: data.certificationName,
      quizScore: data.quizScore,
      isCertified: data.isCertified || false,
      certifiedAt: data.isCertified ? new Date() : null,
    } as any).returning();
  }

  async getCertificationQuizzes(level?: string) {
    let query = db.select().from(certificationQuizzes);
    
    if (level) {
      query = query.where(eq(certificationQuizzes.certificationLevel, level)) as any;
    }
    
    return query.where(eq(certificationQuizzes.isActive, true));
  }

  async submitQuizAttempt(quizId: string, agentId: string, answers: any[], score: number, passed: boolean, timeTaken: number) {
    const existingAttempts = await db.select()
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.agentId, agentId)
      ));
    
    const attemptNumber = existingAttempts.length + 1;

    return db.insert(quizAttempts).values({
      quizId,
      agentId,
      answers,
      score,
      passed,
      timeTakenSeconds: timeTaken,
      attemptNumber,
    } as any).returning();
  }

  async scoreAndSubmitQuizAttempt(quizId: string, agentId: string, answers: Record<string, string>) {
    const quiz = await db.select()
      .from(certificationQuizzes)
      .where(eq(certificationQuizzes.id, quizId))
      .limit(1);

    if (!quiz || quiz.length === 0) {
      throw new Error("Quiz not found");
    }

    const quizData = quiz[0];
    const questions = (quizData.questions as any[]) || [];
    const passingScore = quizData.passingScore || 70;

    let correctCount = 0;
    const totalQuestions = questions.length;

    for (const question of questions) {
      const questionId = question.id;
      const correctAnswer = question.correctAnswer;
      const userAnswer = answers[questionId];
      
      if (userAnswer && userAnswer === correctAnswer) {
        correctCount++;
      }
    }

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= passingScore;

    const existingAttempts = await db.select()
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.quizId, quizId),
        eq(quizAttempts.agentId, agentId)
      ));
    
    const attemptNumber = existingAttempts.length + 1;

    const attemptResult = await db.insert(quizAttempts).values({
      quizId,
      agentId,
      answers,
      score,
      passed,
      attemptNumber,
    } as any).returning();

    if (passed) {
      const existingCert = await db.select()
        .from(agentCertifications)
        .where(and(
          eq(agentCertifications.agentId, agentId),
          eq(agentCertifications.certificationLevel, parseInt(quizData.certificationLevel))
        ))
        .limit(1);

      if (existingCert.length === 0) {
        await db.insert(agentCertifications).values({
          agentId,
          certificationLevel: parseInt(quizData.certificationLevel),
          certificationName: `Level ${quizData.certificationLevel} - ${quizData.title}`,
          status: "active",
          score,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        } as any);
      }
    }

    return {
      attemptId: attemptResult[0].id,
      score,
      passed,
      correctCount,
      totalQuestions,
      passingScore,
    };
  }

  async getQuizAttempts(agentId: string, quizId?: string) {
    const conditions = [eq(quizAttempts.agentId, agentId)];
    if (quizId) conditions.push(eq(quizAttempts.quizId, quizId));
    
    return db.select()
      .from(quizAttempts)
      .where(and(...conditions))
      .orderBy(desc(quizAttempts.createdAt));
  }

  async getDashboardStats(agentId: string) {
    const todaysBrief = await this.getTodaysBrief();
    const productCards = await this.getProductKnowledge();
    const explanations = await this.getExplanationTemplates();
    const certifications = await this.getAgentCertifications(agentId);
    const assetInsights = await this.getAssetClassInsights();

    return {
      hasTodaysBrief: !!todaysBrief,
      todaysBrief,
      productCardsCount: productCards.length,
      explanationTemplatesCount: explanations.length,
      certificationsCount: certifications.length,
      assetInsightsCount: assetInsights.length,
    };
  }

  async incrementTemplateUsage(templateId: string) {
    return db.update(explanationTemplates)
      .set({ 
        usageCount: sql`${explanationTemplates.usageCount} + 1`
      })
      .where(eq(explanationTemplates.id, templateId))
      .returning();
  }

  async simplifyTextWithAI(complexText: string): Promise<string> {
    try {
      const prompt = `You are a financial education expert helping financial advisors explain complex concepts to retail clients in India. 

Simplify the following technical financial text into plain, easy-to-understand language that a non-expert client can understand. 
- Use simple everyday words
- Avoid jargon
- Use short sentences
- Include a simple analogy if helpful
- Keep the response concise (under 150 words)
- Maintain accuracy while simplifying

Complex text to simplify:
${complexText}

Simplified explanation:`;

      const response = await aiService.chat([
        { role: 'user', content: prompt }
      ], {
        capability: AICapability.STANDARD,
        temperature: 0.7,
        maxTokens: 500
      });

      return response.content || "Unable to simplify the text. Please try again.";
    } catch (error) {
      console.error("Error simplifying text with AI:", error);
      return "AI simplification is temporarily unavailable. Please try again later.";
    }
  }
}

export const knowledgeHubService = new KnowledgeHubService();
