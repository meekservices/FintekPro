import { Express, Request, Response } from "express";
import { profitOptimizedScoringEngine } from "../services/profit-optimized-scoring-engine";
import { aiInvestmentOrchestrator } from "../services/ai-investment-orchestrator-service";
import { abTestingService } from "../services/ab-testing-service";
import { optimisticExplanationTemplates } from "../services/optimistic-explanation-templates";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { 
  RecommendationMode,
  RECOMMENDATION_MODE,
  AgentOverride,
  SUITABILITY_THRESHOLD,
  RISK_DISCLOSURE_FOOTER,
  GROWTH_OPTIMIZED_BANNER,
  ScoredProduct,
} from "@shared/profit-optimized-scoring";
import { 
  ClientProfile,
  UnifiedProductType,
  RiskLevel,
} from "@shared/unified-investment-product";

export function registerProfitOptimizedRoutes(app: Express) {
  app.post("/api/recommendations/scored-basket", async (req: Request, res: Response) => {
    try {
      const { 
        clientProfile, 
        investmentAmount, 
        mode = RECOMMENDATION_MODE.BALANCED,
        productTypes,
      } = req.body;

      if (!clientProfile || !investmentAmount) {
        return res.status(400).json({ 
          error: "clientProfile and investmentAmount are required" 
        });
      }

      const validModes = Object.values(RECOMMENDATION_MODE);
      if (!validModes.includes(mode)) {
        return res.status(400).json({ 
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
        });
      }

      const basket = await aiInvestmentOrchestrator.generateRecommendationBasket(
        clientProfile,
        investmentAmount,
        productTypes
      );

      const allProducts = basket.products.map(item => item.product);
      const scoredProducts = profitOptimizedScoringEngine.scoreProducts(
        allProducts,
        clientProfile,
        mode as RecommendationMode
      );

      const balancedProducts = mode !== RECOMMENDATION_MODE.BALANCED 
        ? profitOptimizedScoringEngine.scoreProducts(allProducts, clientProfile, RECOMMENDATION_MODE.BALANCED)
        : scoredProducts;

      let comparison;
      if (mode === RECOMMENDATION_MODE.GROWTH_OPTIMIZED) {
        comparison = profitOptimizedScoringEngine.compareWithBalanced(scoredProducts, balancedProducts);
      }

      const agentId = (req.user as any)?.id || 'system';
      profitOptimizedScoringEngine.createAuditLog({
        clientId: clientProfile.client_id,
        agentId,
        mode: mode as RecommendationMode,
        productsEvaluated: allProducts.length,
        productsRecommended: scoredProducts.length,
        overrides: [],
        balancedComparison: comparison,
      });

      const response = {
        success: true,
        mode,
        killSwitchStatus: profitOptimizedScoringEngine.getKillSwitchStatus(),
        disclosures: mode === RECOMMENDATION_MODE.GROWTH_OPTIMIZED ? {
          banner: GROWTH_OPTIMIZED_BANNER,
          footer: RISK_DISCLOSURE_FOOTER,
        } : undefined,
        scoring: {
          threshold: SUITABILITY_THRESHOLD,
          productsEvaluated: allProducts.length,
          productsEligible: scoredProducts.length,
          productsExcluded: allProducts.length - scoredProducts.length,
        },
        products: scoredProducts.slice(0, 20),
        comparison,
        portfolio_summary: basket.portfolio_summary,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Scored basket error:", error);
      res.status(500).json({ error: "Failed to generate scored basket" });
    }
  });

  app.get("/api/recommendations/modes", async (req: Request, res: Response) => {
    try {
      const killSwitchStatus = profitOptimizedScoringEngine.getKillSwitchStatus();
      
      const modes = [
        {
          id: RECOMMENDATION_MODE.CONSERVATIVE,
          name: "Conservative",
          description: "Emphasizes capital preservation with minimal risk exposure",
          weightings: { suitability: 0.85, upside: 0.15 },
          available: true,
        },
        {
          id: RECOMMENDATION_MODE.BALANCED,
          name: "Balanced",
          description: "Balances suitability with growth potential for steady returns",
          weightings: { suitability: 0.70, upside: 0.30 },
          available: true,
          isDefault: true,
        },
        {
          id: RECOMMENDATION_MODE.GROWTH_OPTIMIZED,
          name: "Growth-Optimized",
          description: "Emphasizes growth opportunities within your risk profile",
          weightings: { suitability: 0.55, upside: 0.45 },
          available: !killSwitchStatus.active,
          disabledReason: killSwitchStatus.active ? killSwitchStatus.reason : undefined,
          requiresDisclosure: true,
        },
      ];

      res.json({
        success: true,
        modes,
        killSwitchStatus,
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Get modes error:", error);
      res.status(500).json({ error: "Failed to get recommendation modes" });
    }
  });

  app.post("/api/recommendations/override", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientId, overrideType, value, reason } = req.body;
      const agentId = (req.user as any)?.id;

      if (!clientId || !overrideType || !reason) {
        return res.status(400).json({ 
          error: "clientId, overrideType, and reason are required" 
        });
      }

      if (reason.length < 10) {
        return res.status(400).json({ 
          error: "Override reason must be at least 10 characters" 
        });
      }

      const validTypes = ['mode_downgrade', 'asset_class_lock', 'allocation_cap'];
      if (!validTypes.includes(overrideType)) {
        return res.status(400).json({ 
          error: `Invalid overrideType. Must be one of: ${validTypes.join(', ')}` 
        });
      }

      const override = profitOptimizedScoringEngine.registerOverride({
        agentId,
        clientId,
        overrideType,
        value,
        reason,
      });

      res.json({
        success: true,
        override,
        message: "Override registered successfully",
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Override error:", error);
      res.status(500).json({ error: "Failed to register override" });
    }
  });

  app.get("/api/recommendations/overrides/:clientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const overrides = profitOptimizedScoringEngine.getOverridesForClient(clientId);

      res.json({
        success: true,
        clientId,
        overrides,
        count: overrides.length,
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Get overrides error:", error);
      res.status(500).json({ error: "Failed to get overrides" });
    }
  });

  app.get("/api/admin/recommendations/audit-logs", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { clientId, agentId, startDate, endDate } = req.query;

      const filters: any = {};
      if (clientId) filters.clientId = clientId as string;
      if (agentId) filters.agentId = agentId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const logs = profitOptimizedScoringEngine.getAuditLogs(Object.keys(filters).length > 0 ? filters : undefined);

      const stats = {
        totalLogs: logs.length,
        byMode: {
          conservative: logs.filter(l => l.mode === 'conservative').length,
          balanced: logs.filter(l => l.mode === 'balanced').length,
          growth_optimized: logs.filter(l => l.mode === 'growth_optimized').length,
        },
        avgProductsRecommended: logs.length > 0 
          ? logs.reduce((sum, l) => sum + l.productsRecommended, 0) / logs.length 
          : 0,
        overridesUsed: logs.filter(l => l.overrides.length > 0).length,
      };

      res.json({
        success: true,
        logs: logs.slice(-100),
        stats,
        filters,
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Audit logs error:", error);
      res.status(500).json({ error: "Failed to get audit logs" });
    }
  });

  app.post("/api/admin/recommendations/kill-switch", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { action, reason } = req.body;

      if (action === 'activate') {
        if (!reason) {
          return res.status(400).json({ error: "Reason is required to activate kill switch" });
        }
        profitOptimizedScoringEngine.activateKillSwitch(reason);
        res.json({
          success: true,
          message: "Kill switch activated",
          status: profitOptimizedScoringEngine.getKillSwitchStatus(),
        });
      } else if (action === 'deactivate') {
        profitOptimizedScoringEngine.deactivateKillSwitch();
        res.json({
          success: true,
          message: "Kill switch deactivated",
          status: profitOptimizedScoringEngine.getKillSwitchStatus(),
        });
      } else {
        return res.status(400).json({ error: "Action must be 'activate' or 'deactivate'" });
      }
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Kill switch error:", error);
      res.status(500).json({ error: "Failed to update kill switch" });
    }
  });

  app.get("/api/admin/recommendations/kill-switch", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        status: profitOptimizedScoringEngine.getKillSwitchStatus(),
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Get kill switch status error:", error);
      res.status(500).json({ error: "Failed to get kill switch status" });
    }
  });

  app.get("/api/recommendations/score-breakdown/:productType", async (req: Request, res: Response) => {
    try {
      const { productType } = req.params;
      
      const methodologies: Record<string, { description: string; factors: { name: string; weight: number }[] }> = {
        STOCK: {
          description: "Stocks are scored based on return potential, price momentum, valuation metrics, and sector outlook",
          factors: [
            { name: "Return Potential", weight: 0.30 },
            { name: "Momentum Score", weight: 0.25 },
            { name: "Valuation Score", weight: 0.25 },
            { name: "Sector Score", weight: 0.20 },
          ],
        },
        MF: {
          description: "Mutual funds are scored based on return potential, alpha generation, consistency, and ratings",
          factors: [
            { name: "Return Potential", weight: 0.35 },
            { name: "Alpha Score", weight: 0.25 },
            { name: "Consistency Score", weight: 0.25 },
            { name: "Rating Score", weight: 0.15 },
          ],
        },
        BOND: {
          description: "Bonds are scored based on yield, credit quality, duration risk, and spread opportunities",
          factors: [
            { name: "Yield Score", weight: 0.40 },
            { name: "Credit Score", weight: 0.25 },
            { name: "Duration Score", weight: 0.20 },
            { name: "Spread Score", weight: 0.15 },
          ],
        },
        REIT: {
          description: "REITs/InvITs are scored based on dividend yield, NAV discount, occupancy, and distribution growth",
          factors: [
            { name: "Yield Score", weight: 0.35 },
            { name: "NAV Score", weight: 0.25 },
            { name: "Occupancy Score", weight: 0.20 },
            { name: "Growth Score", weight: 0.20 },
          ],
        },
        INVIT: {
          description: "REITs/InvITs are scored based on dividend yield, NAV discount, occupancy, and distribution growth",
          factors: [
            { name: "Yield Score", weight: 0.35 },
            { name: "NAV Score", weight: 0.25 },
            { name: "Occupancy Score", weight: 0.20 },
            { name: "Growth Score", weight: 0.20 },
          ],
        },
        IPO: {
          description: "IPOs are scored based on subscription levels, valuation, sector momentum, and issuer quality",
          factors: [
            { name: "Subscription Score", weight: 0.30 },
            { name: "Valuation Score", weight: 0.30 },
            { name: "Sector Score", weight: 0.20 },
            { name: "Issuer Quality", weight: 0.20 },
          ],
        },
        UNLISTED: {
          description: "Unlisted equities are scored based on IPO proximity, company growth, valuation, and liquidity premium",
          factors: [
            { name: "IPO Proximity", weight: 0.30 },
            { name: "Growth Score", weight: 0.30 },
            { name: "Valuation Score", weight: 0.25 },
            { name: "Liquidity Premium", weight: 0.15 },
          ],
        },
        AIF: {
          description: "AIF/PMS are scored based on track record, strategy, alpha generation, and risk-adjusted returns",
          factors: [
            { name: "Track Record", weight: 0.30 },
            { name: "Strategy Score", weight: 0.25 },
            { name: "Alpha Score", weight: 0.25 },
            { name: "Risk-Adjusted Return", weight: 0.20 },
          ],
        },
        PMS: {
          description: "AIF/PMS are scored based on track record, strategy, alpha generation, and risk-adjusted returns",
          factors: [
            { name: "Track Record", weight: 0.30 },
            { name: "Strategy Score", weight: 0.25 },
            { name: "Alpha Score", weight: 0.25 },
            { name: "Risk-Adjusted Return", weight: 0.20 },
          ],
        },
        MLD: {
          description: "MLDs are scored similar to bonds based on yield, credit quality, duration, and spread",
          factors: [
            { name: "Yield Score", weight: 0.40 },
            { name: "Credit Score", weight: 0.25 },
            { name: "Duration Score", weight: 0.20 },
            { name: "Spread Score", weight: 0.15 },
          ],
        },
      };

      const methodology = methodologies[productType.toUpperCase()];
      
      if (!methodology) {
        return res.status(404).json({ 
          error: `Unknown product type: ${productType}`,
          availableTypes: Object.keys(methodologies),
        });
      }

      res.json({
        success: true,
        productType: productType.toUpperCase(),
        suitabilityWeights: {
          riskMatch: 0.35,
          timeHorizonMatch: 0.25,
          liquidityMatch: 0.20,
          regulatoryEligibility: 0.20,
        },
        upsideMethodology: methodology,
        modeWeightings: {
          conservative: { suitability: 0.85, upside: 0.15 },
          balanced: { suitability: 0.70, upside: 0.30 },
          growth_optimized: { suitability: 0.55, upside: 0.45 },
        },
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Score breakdown error:", error);
      res.status(500).json({ error: "Failed to get score breakdown" });
    }
  });

  app.post("/api/recommendations/explanations", async (req: Request, res: Response) => {
    try {
      const { products, mode = RECOMMENDATION_MODE.BALANCED } = req.body;

      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "products array is required" });
      }

      const explanations: Record<string, any> = {};
      
      for (const product of products as ScoredProduct[]) {
        const explanation = optimisticExplanationTemplates.generateExplanation(product, mode);
        explanations[product.product_id] = explanation;
      }

      res.json({
        success: true,
        mode,
        explanations,
        count: Object.keys(explanations).length,
      });
    } catch (error: any) {
      console.error("[PROFIT-OPTIMIZED] Explanations error:", error);
      res.status(500).json({ error: "Failed to generate explanations" });
    }
  });

  app.post("/api/ab-testing/assign", async (req: Request, res: Response) => {
    try {
      const { clientId, clientProfile } = req.body;

      if (!clientId || !clientProfile) {
        return res.status(400).json({ error: "clientId and clientProfile are required" });
      }

      const assignment = abTestingService.assignClient(clientId, clientProfile);

      res.json({
        success: true,
        assignment,
        message: assignment ? `Client assigned to Group ${assignment.group}` : "Client not eligible for experiment",
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Assignment error:", error);
      res.status(500).json({ error: "Failed to assign client" });
    }
  });

  app.get("/api/ab-testing/assignment/:clientId", async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const assignment = abTestingService.getAssignment(clientId);

      res.json({
        success: true,
        clientId,
        assignment,
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Get assignment error:", error);
      res.status(500).json({ error: "Failed to get assignment" });
    }
  });

  app.post("/api/ab-testing/record-metric", async (req: Request, res: Response) => {
    try {
      const { clientId, metricType, value } = req.body;

      if (!clientId || !metricType || value === undefined) {
        return res.status(400).json({ error: "clientId, metricType, and value are required" });
      }

      const validTypes = ['acceptance', 'allocation', 'time_to_decision', 'engagement'];
      if (!validTypes.includes(metricType)) {
        return res.status(400).json({ 
          error: `Invalid metricType. Must be one of: ${validTypes.join(', ')}` 
        });
      }

      abTestingService.recordMetric(clientId, metricType, value);

      res.json({
        success: true,
        message: "Metric recorded successfully",
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Record metric error:", error);
      res.status(500).json({ error: "Failed to record metric" });
    }
  });

  app.get("/api/admin/ab-testing/metrics", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { experimentId } = req.query;
      const metrics = abTestingService.getExperimentMetrics(experimentId as string);

      res.json({
        success: true,
        metrics,
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Get metrics error:", error);
      res.status(500).json({ error: "Failed to get experiment metrics" });
    }
  });

  app.get("/api/admin/ab-testing/summary", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const summary = abTestingService.getExperimentSummary();

      res.json({
        success: true,
        summary,
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Get summary error:", error);
      res.status(500).json({ error: "Failed to get experiment summary" });
    }
  });

  app.post("/api/admin/ab-testing/safety-thresholds", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { maxDrawdown, maxComplaintRate, maxRestrictedAssetExposure } = req.body;

      const thresholds: any = {};
      if (maxDrawdown !== undefined) thresholds.maxDrawdown = maxDrawdown;
      if (maxComplaintRate !== undefined) thresholds.maxComplaintRate = maxComplaintRate;
      if (maxRestrictedAssetExposure !== undefined) thresholds.maxRestrictedAssetExposure = maxRestrictedAssetExposure;

      abTestingService.updateSafetyThresholds(thresholds);

      res.json({
        success: true,
        thresholds: abTestingService.getSafetyThresholds(),
        message: "Safety thresholds updated",
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Update thresholds error:", error);
      res.status(500).json({ error: "Failed to update safety thresholds" });
    }
  });

  app.get("/api/admin/ab-testing/safety-thresholds", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        thresholds: abTestingService.getSafetyThresholds(),
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Get thresholds error:", error);
      res.status(500).json({ error: "Failed to get safety thresholds" });
    }
  });

  app.post("/api/admin/ab-testing/check-safety", requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { drawdown, complaintRate, restrictedAssetExposure } = req.body;

      const result = abTestingService.checkSafetyThresholds({
        drawdown,
        complaintRate,
        restrictedAssetExposure,
      });

      if (!result.safe) {
        profitOptimizedScoringEngine.activateKillSwitch(
          `Safety violation: ${result.violations.join('; ')}`
        );
      }

      res.json({
        success: true,
        safetyCheck: result,
        killSwitchActivated: !result.safe,
      });
    } catch (error: any) {
      console.error("[A/B TESTING] Check safety error:", error);
      res.status(500).json({ error: "Failed to check safety" });
    }
  });

  console.log("✅ Profit-Optimized Recommendation routes registered");
  console.log("✅ A/B Testing routes registered");
}
