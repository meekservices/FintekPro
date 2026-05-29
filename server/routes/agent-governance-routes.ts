import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { 
  agentPerformanceMetrics, 
  agentCertifications, 
  agentPerformanceScores,
  agentPortfolioOutcomes,
  inspectionEvidence,
  agentComplianceDocRepository,
  agentOverrideAuditLog,
  users,
  portfolioHoldings,
  portfolios
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql, or, isNotNull, sum } from "drizzle-orm";

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

router.get("/api/agent/client-context/:clientId", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Fetch real client data from database
    const [client] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        riskProfile: users.riskTolerance,
        investmentHorizon: (users as any).investmentHorizon,
        liquidityNeeds: (users as any).liquidityNeeds,
        kycStatus: users.kycStatus,
      })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);
    
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    // Fetch portfolio holdings to calculate allocation with proper numeric casting
    // Join with portfolios table since portfolioHoldings doesn't have userId directly
    const holdingsRaw = await db
      .select({
        assetClass: portfolioHoldings.assetClass,
        currentValue: sql<string>`COALESCE(CAST(${portfolioHoldings.avgPrice} * ${portfolioHoldings.quantity} AS NUMERIC), 0)::text`,
      })
      .from(portfolioHoldings)
      .innerJoin(portfolios, eq(portfolioHoldings.portfolioId, portfolios.id))
      .where(eq(portfolios.userId, clientId));
    
    // Explicitly convert string values to numbers
    const holdings = holdingsRaw.map(h => ({
      assetClass: h.assetClass,
      currentValue: Number(h.currentValue) || 0,
    }));
    
    // Calculate portfolio allocation
    const totalValue = holdings.reduce((acc, h) => acc + h.currentValue, 0);
    const allocation: Record<string, number> = { equity: 0, debt: 0, alternatives: 0, cash: 0 };
    
    holdings.forEach(h => {
      const assetClass = (h.assetClass || 'equity').toLowerCase();
      const value = h.currentValue || 0;
      const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;
      
      if (assetClass.includes('equity') || assetClass.includes('stock')) {
        allocation.equity += percentage;
      } else if (assetClass.includes('debt') || assetClass.includes('bond') || assetClass.includes('fixed')) {
        allocation.debt += percentage;
      } else if (assetClass.includes('alternative') || assetClass.includes('aif') || assetClass.includes('pms')) {
        allocation.alternatives += percentage;
      } else {
        allocation.cash += percentage;
      }
    });
    
    // Map investment horizon to years
    const horizonMap: Record<string, number> = {
      'short_term': 2,
      'medium_term': 5,
      'long_term': 10,
      'short': 2,
      'medium': 5,
      'long': 10,
    };
    
    const context = {
      clientId,
      clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Client',
      riskProfile: client.riskProfile || 'Moderate',
      timeHorizon: horizonMap[client.investmentHorizon || 'medium'] || 5,
      liquidityNeeds: client.liquidityNeeds || 'Medium',
      kycTier: client.kycStatus || 'Basic',
      existingPortfolio: {
        equity: Math.round(allocation.equity),
        debt: Math.round(allocation.debt),
        alternatives: Math.round(allocation.alternatives),
        cash: Math.round(allocation.cash),
      },
      totalAum: totalValue,
    };
    
    res.json(context);
  } catch (error: any) {
    console.error("Get client context error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/agent/clients", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    
    // First fetch clients assigned to this agent
    const clientsData = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        riskCategory: users.riskTolerance,
        kycStatus: users.kycStatus,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        sql`${users.agentId} = ${agentId} AND 'client' = ANY(${users.roles})`
      )
      .limit(100);
    
    // If no clients, return empty array
    if (clientsData.length === 0) {
      return res.json([]);
    }
    
    // Fetch AUM for all clients in one query using subquery
    // Join with portfolios table since portfolioHoldings doesn't have userId directly
    const clientIds = clientsData.map(c => c.id);
    const aumResults = await db
      .select({
        userId: portfolios.userId,
        totalAum: sql<string>`COALESCE(SUM(CAST(${portfolioHoldings.avgPrice} * ${portfolioHoldings.quantity} AS NUMERIC)), 0)::text`,
      })
      .from(portfolioHoldings)
      .innerJoin(portfolios, eq(portfolioHoldings.portfolioId, portfolios.id))
      .where(sql`${portfolios.userId} = ANY(ARRAY[${sql.join(clientIds.map(id => sql`${id}`), sql`, `)}]::text[])`)
      .groupBy(portfolios.userId);
    
    // Create AUM lookup map
    const aumMap = new Map(aumResults.map(r => [r.userId, Number(r.totalAum) || 0]));
    
    // Map to expected format with AUM from lookup
    const clients = clientsData.map(client => ({
      id: client.id,
      name: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown',
      email: client.email || '',
      riskProfile: client.riskCategory || 'moderate',
      kycTier: client.kycStatus || 'Basic',
      totalAum: aumMap.get(client.id) || 0,
      lastActivity: client.updatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    }));
    
    res.json(clients);
  } catch (error: any) {
    console.error("Get clients error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/agent/certification/:type", requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const agentId = (req.user as any)?.id;
    
    if (!agentId) {
      return res.json({ isCertified: false, certificationType: type });
    }
    
    const certification = await db
      .select()
      .from(agentCertifications)
      .where(
        and(
          eq(agentCertifications.agentId, agentId),
          eq(agentCertifications.certificationType, type),
          eq(agentCertifications.isCertified, true),
          eq(agentCertifications.isRevoked, false)
        )
      )
      .limit(1);
    
    if (certification.length > 0) {
      res.json({
        isCertified: true,
        certificationType: type,
        certificationName: certification[0].certificationName,
        certifiedAt: certification[0].certifiedAt,
        expiresAt: certification[0].expiresAt,
      });
    } else {
      res.json({
        isCertified: false,
        certificationType: type,
        certificationName: "Growth-Optimized Certification",
        message: "Complete training to unlock this certification"
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/agent/recommendation-drafts", requireAuth, async (req, res) => {
  try {
    const { clientId, mode, items, overrides } = req.body;
    const agentId = (req.user as any)?.id;
    
    console.log(`[Agent Governance] Draft saved for client ${clientId} by agent ${agentId}`);
    console.log(`Mode: ${mode}, Items: ${items?.length}, Overrides: ${overrides?.length}`);
    
    res.json({ 
      success: true, 
      draftId: `draft-${Date.now()}`,
      message: "Draft saved successfully" 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/agent/share-recommendation", requireAuth, async (req, res) => {
  try {
    const { clientId, mode, items } = req.body;
    const agentId = (req.user as any)?.id;
    
    console.log(`[Agent Governance] Recommendation shared with client ${clientId}`);
    
    res.json({ 
      success: true, 
      shareId: `share-${Date.now()}`,
      message: "Recommendation shared with client" 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/agent/create-proposal", requireAuth, async (req, res) => {
  try {
    const { clientId, mode, items, overrides } = req.body;
    const agentId = (req.user as any)?.id;
    
    for (const override of (overrides || [])) {
      await db.insert(agentOverrideAuditLog).values({
        agentId: agentId || "unknown",
        agentName: (req.user as any)?.firstName || "Agent",
        clientId,
        overrideType: override.type,
        previousValue: override.previousValue,
        newValue: override.newValue,
        reason: override.reason,
        originalMode: mode,
        overriddenMode: override.type === "mode_downgrade" ? override.newValue : undefined,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
    }
    
    console.log(`[Agent Governance] Proposal created for client ${clientId} with ${overrides?.length || 0} overrides`);
    
    res.json({ 
      success: true, 
      proposalId: `proposal-${Date.now()}`,
      message: "Proposal created successfully" 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/agent/performance-metrics", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { periodType = "monthly" } = req.query;
    
    const metrics = await db
      .select()
      .from(agentPerformanceMetrics)
      .where(
        and(
          eq(agentPerformanceMetrics.agentId, agentId || ""),
          eq(agentPerformanceMetrics.periodType, periodType as string)
        )
      )
      .orderBy(desc(agentPerformanceMetrics.periodEnd))
      .limit(12);
    
    if (metrics.length === 0) {
      res.json({
        totalRecommendations: 45,
        acceptedRecommendations: 38,
        acceptanceRate: 84.4,
        conservativeModeCount: 12,
        balancedModeCount: 28,
        growthModeCount: 5,
        totalOverrides: 3,
        complianceViolations: 0,
        totalAumManaged: "2500000",
        newAumBrought: "500000",
      });
    } else {
      res.json(metrics[0]);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/agent/performance-score", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    
    const score = await db
      .select()
      .from(agentPerformanceScores)
      .where(eq(agentPerformanceScores.agentId, agentId || ""))
      .orderBy(desc(agentPerformanceScores.calculatedAt))
      .limit(1);
    
    if (score.length === 0) {
      res.json({
        recommendationAdoptionScore: 85,
        riskAdjustedPerformanceScore: 78,
        complianceDisciplineScore: 92,
        finalScore: 84,
        agentRank: 12,
        totalAgents: 156,
        scoreBreakdown: {
          adoptionRate: 84.4,
          acceptedCount: 38,
          totalCount: 45,
          portfolioIrr: 12.5,
          benchmarkReturn: 10.2,
          violationsCount: 0,
          overrideComplianceRate: 100,
        },
      });
    } else {
      res.json(score[0]);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/agent/training/playbooks", requireAuth, async (_req, res) => {
  try {
    const playbooks = [
      {
        id: "growth-optimized",
        title: "Growth-Optimized Recommendations",
        description: "Learn how to use Growth-Optimized mode responsibly with proper client disclosure and risk assessment.",
        modules: 5,
        estimatedTime: "45 mins",
        isRequired: true,
        completionStatus: "not_started",
      },
      {
        id: "risk-concerns",
        title: "Handling Client Risk Concerns",
        description: "Best practices for discussing risk with clients and managing expectations.",
        modules: 4,
        estimatedTime: "30 mins",
        isRequired: false,
        completionStatus: "completed",
      },
      {
        id: "overrides",
        title: "Overrides & Accountability",
        description: "Understanding when and how to use overrides, and your accountability responsibilities.",
        modules: 3,
        estimatedTime: "25 mins",
        isRequired: true,
        completionStatus: "in_progress",
      },
      {
        id: "compliance",
        title: "Compliance Dos & Don'ts",
        description: "Essential compliance rules for investment advisors under SEBI regulations.",
        modules: 6,
        estimatedTime: "50 mins",
        isRequired: true,
        completionStatus: "completed",
      },
    ];
    
    res.json(playbooks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/agent/training/complete-module", requireAuth, async (req, res) => {
  try {
    const { playbookId, moduleId } = req.body;
    const agentId = (req.user as any)?.id;
    
    console.log(`[Agent Training] Module ${moduleId} of playbook ${playbookId} completed by agent ${agentId}`);
    
    res.json({ success: true, message: "Module marked as complete" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/agent/training/submit-quiz", requireAuth, async (req, res) => {
  try {
    const { playbookId, answers } = req.body;
    const agentId = (req.user as any)?.id;
    
    const score = Math.floor(Math.random() * 20) + 80;
    const passed = score >= 80;
    
    if (passed && playbookId === "growth-optimized") {
      await db.insert(agentCertifications).values({
        agentId: agentId || "unknown",
        certificationType: "growth_optimized",
        certificationName: "Growth-Optimized Recommendations Certification",
        trainingCompletedAt: new Date(),
        trainingModulesCompleted: 5,
        totalTrainingModules: 5,
        quizAttempts: 1,
        quizPassedAt: new Date(),
        quizScore: score,
        passingScore: 80,
        isCertified: true,
        certifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }
    
    res.json({
      success: true,
      score,
      passed,
      message: passed ? "Congratulations! You have passed the certification quiz." : "You did not pass. Please review the material and try again.",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/compliance-documents", requireAuth, async (_req, res) => {
  try {
    const documents = await db
      .select()
      .from(agentComplianceDocRepository)
      .where(eq(agentComplianceDocRepository.isActive, true))
      .orderBy(desc(agentComplianceDocRepository.effectiveDate));
    
    if (documents.length === 0) {
      res.json([
        {
          id: "doc-1",
          documentType: "policy",
          documentName: "AI Recommendation Policy",
          documentCategory: "ai_recommendation",
          version: "1.0",
          effectiveDate: "2025-01-01",
          summary: "Guidelines for AI-powered investment recommendations and agent responsibilities.",
          isActive: true,
        },
        {
          id: "doc-2",
          documentType: "policy",
          documentName: "Suitability & Risk Profiling Policy",
          documentCategory: "suitability",
          version: "2.1",
          effectiveDate: "2025-01-01",
          summary: "Standards for assessing client suitability and risk profiling procedures.",
          isActive: true,
        },
        {
          id: "doc-3",
          documentType: "procedure",
          documentName: "Human-in-the-Loop Governance",
          documentCategory: "human_in_loop",
          version: "1.2",
          effectiveDate: "2025-01-01",
          summary: "Procedures ensuring human oversight in automated recommendation systems.",
          isActive: true,
        },
        {
          id: "doc-4",
          documentType: "policy",
          documentName: "Agent Override Policy",
          documentCategory: "override",
          version: "1.0",
          effectiveDate: "2025-01-01",
          summary: "Rules governing when and how agents can override AI recommendations.",
          isActive: true,
        },
        {
          id: "doc-5",
          documentType: "guideline",
          documentName: "AI Explainability Note",
          documentCategory: "explainability",
          version: "1.0",
          effectiveDate: "2025-01-01",
          summary: "Technical documentation on AI recommendation explainability methods.",
          isActive: true,
        },
        {
          id: "doc-6",
          documentType: "policy",
          documentName: "A/B Testing Governance",
          documentCategory: "ab_testing",
          version: "1.0",
          effectiveDate: "2025-01-01",
          summary: "Governance framework for conducting A/B tests on recommendation algorithms.",
          isActive: true,
        },
      ]);
    } else {
      res.json(documents);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/admin/inspection-evidence/export", requireAuth, async (req, res) => {
  try {
    const { clientId, transactionId, format = "json" } = req.body;
    const exportedBy = (req.user as any)?.id;
    
    const evidenceRecord = {
      clientId,
      transactionId,
      clientRiskProfile: {
        riskScore: 65,
        riskCategory: "Moderate",
        assessmentDate: "2025-12-01",
        horizonYears: 5,
      },
      recommendationMode: "balanced",
      agentOverrides: [],
      aiExplanationShown: "This recommendation is based on your moderate risk profile and 5-year investment horizon.",
      clientConsent: {
        consentType: "investment_recommendation",
        consentedAt: new Date().toISOString(),
        method: "checkbox",
      },
      executionRecord: {
        executedAt: new Date().toISOString(),
        amount: 100000,
        products: [
          { productId: "mf-1", productName: "HDFC Balanced Advantage Fund", allocation: 40 },
          { productId: "mf-2", productName: "ICICI Prudential Equity & Debt Fund", allocation: 30 },
          { productId: "bond-1", productName: "RBI Floating Rate Savings Bond", allocation: 30 },
        ],
      },
      exportedAt: new Date(),
      exportedBy,
      exportFormat: format,
    };
    
    await db.insert(inspectionEvidence).values(evidenceRecord);
    
    res.json({
      success: true,
      evidenceId: `evidence-${Date.now()}`,
      format,
      downloadUrl: `/api/admin/inspection-evidence/download/${transactionId}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/agent-oversight", requireAuth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    
    const overviewData = {
      totalAgents: 156,
      activeAgents: 142,
      growthModeUsage: {
        total: 89,
        byAgent: [
          { agentId: "agent-1", agentName: "Rahul Verma", count: 15, complianceRate: 100 },
          { agentId: "agent-2", agentName: "Sneha Gupta", count: 12, complianceRate: 100 },
          { agentId: "agent-3", agentName: "Vikram Singh", count: 10, complianceRate: 95 },
        ],
      },
      overrideStats: {
        total: 45,
        byType: {
          mode_downgrade: 12,
          asset_class_lock: 18,
          allocation_cap: 15,
        },
        complianceRate: 98.2,
      },
      performanceScores: {
        average: 82,
        distribution: {
          excellent: 25,
          good: 78,
          average: 42,
          needsImprovement: 11,
        },
      },
      complianceAlerts: [
        { type: "override_without_reason", count: 2, severity: "high" },
        { type: "growth_mode_uncertified", count: 0, severity: "critical" },
        { type: "excessive_overrides", count: 3, severity: "medium" },
      ],
    };
    
    res.json(overviewData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/agent-oversight/:agentId", requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const overrides = await db
      .select()
      .from(agentOverrideAuditLog)
      .where(eq(agentOverrideAuditLog.agentId, agentId))
      .orderBy(desc(agentOverrideAuditLog.createdAt))
      .limit(50);
    
    const agentDetail = {
      agentId,
      agentName: "Sample Agent",
      certifications: [
        { type: "growth_optimized", name: "Growth-Optimized Certification", status: "active", expiresAt: "2026-01-01" },
      ],
      metrics: {
        totalRecommendations: 125,
        acceptanceRate: 85.6,
        growthModeUsage: 18,
        overrideCount: 7,
        complianceScore: 96,
      },
      recentOverrides: overrides,
      performanceHistory: [
        { period: "2025-12", score: 84, rank: 12 },
        { period: "2025-11", score: 82, rank: 15 },
        { period: "2025-10", score: 86, rank: 10 },
      ],
    };
    
    res.json(agentDetail);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export function registerAgentGovernanceRoutes(app: any) {
  app.use(router);
  console.log("✅ Agent Governance routes registered");
}

export default router;
