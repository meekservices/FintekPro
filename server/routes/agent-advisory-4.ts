import { Express, Request, Response, NextFunction } from 'express';
import { requireAgentPortal } from '../middleware/roleMiddleware';
import multer from 'multer';
import { db } from '../db';
import { ProposalOrchestrator } from '../services/proposal-orchestrator';
import { 
  advisorySessions, 
  suitabilityChecks, 
  proposalNotes, 
  proposalShares, 
  portfolioUploads,
  agentComplianceAuditLogs,
  users,
  clientAgentRelationships,
  investmentProposals,
  investmentProposalItems,
  portfolios,
  partners,
  agentPartnerMappings,
  prospectClients,
  prospectLeads,
  treasuryMandates,
  insertAdvisorySessionSchema,
  insertSuitabilityCheckSchema,
  insertProposalNoteSchema,
  insertProposalShareSchema,
  insertPortfolioUploadSchema,
  insertAgentComplianceAuditLogSchema
} from '@shared/schema';
import { eq, and, desc, sql, or, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
const logAgentAction = async (..._args: any[]) => {};
const calculateAge = (_dob: any) => 30;
const calculateAssetAllocation = (..._args: any[]) => ({});


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Excel, CSV'));
    }
  }
});



export function registerAgentAdvisoryPart4Routes(app: Express) {
  app.post("/api/agent/client/:clientId/auto-fetch-portfolio", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { clientId } = req.params;
      const { includeAIAnalysis = true } = req.body;

      // Verify agent-client relationship
      const relationship = await db
        .select()
        .from(clientAgentRelationships)
        .where(and(
          eq(clientAgentRelationships.agentId, agentId),
          eq(clientAgentRelationships.clientId, clientId),
          eq(clientAgentRelationships.isActive, true)
        ))
        .limit(1);

      if (relationship.length === 0) {
        return res.status(403).json({ 
          error: "You don't have permission to access this client's data",
          code: "NO_CLIENT_RELATIONSHIP"
        });
      }

      // Import services
      const { autoPopulationOrchestrator } = await import('../services/auto-population-orchestrator');
      const { AIPortfolioService } = await import('../ai-portfolio-service');
      const { DatabaseStorage } = await import('../storage');

      // Log action
      await logAgentAction({
        agentId,
        clientId,
        actionCategory: 'portfolio',
        actionType: 'auto_fetch_initiated',
        actionDescription: `Agent initiated auto-fetch portfolio for client ${clientId}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      // Trigger auto-population workflow
      console.log(`🚀 Agent ${agentId} initiating auto-fetch for client ${clientId}`);
      const populationResult = await autoPopulationOrchestrator.initiateFromKYC(clientId, 'manual_refresh');

      let aiAnalysis = null;
      
      if (includeAIAnalysis && populationResult.status !== 'failed') {
        try {
          // Get client's holdings for AI analysis
          const { comprehensiveHoldings } = await import('@shared/schema');
          const holdings = await db
            .select()
            .from(comprehensiveHoldings)
            .where(eq(comprehensiveHoldings.userId, clientId));

          if (holdings.length > 0) {
            // Get client profile for risk assessment
            const clientProfile = await db
              .select()
              .from(users)
              .where(eq(users.id, clientId))
              .limit(1);

            const client = clientProfile[0];
            
            // Build portfolio data for AI service
            const portfolioData = {
              id: clientId,
              totalValue: populationResult.totalHoldingsValue || 0,
              holdings: holdings.map(h => ({
                symbol: h.symbol || h.assetName || 'Unknown',
                quantity: parseFloat(h.quantity || '0'),
                currentPrice: parseFloat(h.currentPrice || '0'),
                currentValue: parseFloat(h.marketValue || '0'),
                investedValue: parseFloat(h.investedValue || '0'),
                gainLoss: parseFloat(h.gainLoss || '0'),
                gainLossPercent: parseFloat(h.gainLossPercent || '0'),
                assetType: h.assetType || 'equity',
                sector: (h.metadata as any)?.sector,
                exchange: (h.metadata as any)?.exchange || 'NSE'
              })),
              assetAllocation: calculateAssetAllocation(holdings),
              performance: {
                totalGainLoss: holdings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0),
                totalGainLossPercent: 0,
                dayChange: 0,
                dayChangePercent: 0
              }
            };

            // Build user profile
            const userProfile = {
              age: client?.dateOfBirth ? calculateAge(client.dateOfBirth) : 35,
              riskTolerance: ((client as any)?.riskProfile || 'moderate') as 'conservative' | 'moderate' | 'aggressive',
              investmentGoals: ['wealth_creation', 'retirement'],
              timeHorizon: 10
            };

            // Generate AI analysis
            const storage = new DatabaseStorage();
            const aiService = new AIPortfolioService(storage);
            
            const [recommendations, proposal] = await Promise.all([
              aiService.generatePortfolioRebalancingRecommendations(portfolioData as any, userProfile),
              aiService.generateInvestmentProposal(portfolioData as any, userProfile, 100000, clientId)
            ]);

            aiAnalysis = {
              recommendations,
              proposal,
              generatedAt: new Date().toISOString()
            };
          }
        } catch (aiError: any) {
          console.error("AI analysis error:", aiError.message);
          aiAnalysis = {
            error: "AI analysis could not be generated",
            recommendations: [],
            proposal: null
          };
        }
      }

      // Log completion
      await logAgentAction({
        agentId,
        clientId,
        actionCategory: 'portfolio',
        actionType: 'auto_fetch_completed',
        actionDescription: `Auto-fetch completed: ${populationResult.successfulSources}/${populationResult.totalDataSources} sources, ${populationResult.totalRecordsFetched} records fetched`,
        newState: { 
          status: populationResult.status,
          recordsFetched: populationResult.totalRecordsFetched,
          hasAIAnalysis: !!aiAnalysis
        }
      });

      res.json({
        success: true,
        workflowId: populationResult.workflowId,
        status: populationResult.status,
        summary: {
          totalDataSources: populationResult.totalDataSources,
          successfulSources: populationResult.successfulSources,
          failedSources: populationResult.failedSources,
          totalRecordsFetched: populationResult.totalRecordsFetched,
          totalHoldingsValue: populationResult.totalHoldingsValue,
          durationMs: populationResult.durationMs
        },
        sourceResults: populationResult.sourceResults,
        aiAnalysis
      });
    } catch (error: any) {
      console.error("Error in agent auto-fetch portfolio:", error);
      res.status(500).json({ error: "Failed to auto-fetch portfolio", details: error.message });
    }
  });

  // Get client portfolio with AI analysis (without re-fetching)
  app.get("/api/agent/client/:clientId/portfolio-analysis", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { clientId } = req.params;

      // Verify agent-client relationship
      const relationship = await db
        .select()
        .from(clientAgentRelationships)
        .where(and(
          eq(clientAgentRelationships.agentId, agentId),
          eq(clientAgentRelationships.clientId, clientId),
          eq(clientAgentRelationships.isActive, true)
        ))
        .limit(1);

      if (relationship.length === 0) {
        return res.status(403).json({ 
          error: "You don't have permission to access this client's data"
        });
      }

      // Get existing holdings
      const { comprehensiveHoldings } = await import('@shared/schema');
      const holdings = await db
        .select()
        .from(comprehensiveHoldings)
        .where(eq(comprehensiveHoldings.userId, clientId));

      if (holdings.length === 0) {
        return res.json({
          success: true,
          hasHoldings: false,
          message: "No holdings found. Use auto-fetch to populate portfolio data.",
          holdings: [],
          aiAnalysis: null
        });
      }

      // Get client profile
      const clientProfile = await db
        .select()
        .from(users)
        .where(eq(users.id, clientId))
        .limit(1);

      const client = clientProfile[0];
      const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.marketValue || '0'), 0);

      // Build portfolio data
      const portfolioData = {
        id: clientId,
        totalValue,
        holdings: holdings.map(h => ({
          symbol: h.symbol || h.assetName || 'Unknown',
          quantity: parseFloat(h.quantity || '0'),
          currentPrice: parseFloat(h.currentPrice || '0'),
          currentValue: parseFloat(h.marketValue || '0'),
          investedValue: parseFloat(h.investedValue || '0'),
          gainLoss: parseFloat(h.gainLoss || '0'),
          gainLossPercent: parseFloat(h.gainLossPercent || '0'),
          assetType: h.assetType || 'equity',
          sector: (h.metadata as any)?.sector,
          exchange: (h.metadata as any)?.exchange || 'NSE'
        })),
        assetAllocation: calculateAssetAllocation(holdings),
        performance: {
          totalGainLoss: holdings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0),
          totalGainLossPercent: totalValue > 0 
            ? (holdings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0) / totalValue) * 100 
            : 0,
          dayChange: 0,
          dayChangePercent: 0
        }
      };

      // Build user profile
      const userProfile = {
        age: client?.dateOfBirth ? calculateAge(client.dateOfBirth) : 35,
        riskTolerance: ((client as any)?.riskProfile || 'moderate') as 'conservative' | 'moderate' | 'aggressive',
        investmentGoals: ['wealth_creation', 'retirement'],
        timeHorizon: 10
      };

      // Generate AI analysis
      const { AIPortfolioService } = await import('../ai-portfolio-service');
      const { DatabaseStorage } = await import('../storage');
      const storage = new DatabaseStorage();
      const aiService = new AIPortfolioService(storage);

      const [recommendations, proposal] = await Promise.all([
        aiService.generatePortfolioRebalancingRecommendations(portfolioData as any, userProfile),
        aiService.generateInvestmentProposal(portfolioData as any, userProfile, 100000, clientId)
      ]);

      res.json({
        success: true,
        hasHoldings: true,
        portfolioSummary: {
          totalValue,
          totalHoldings: holdings.length,
          assetAllocation: portfolioData.assetAllocation,
          performance: portfolioData.performance
        },
        holdings: portfolioData.holdings,
        aiAnalysis: {
          recommendations,
          proposal,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error("Error getting portfolio analysis:", error);
      res.status(500).json({ error: "Failed to get portfolio analysis", details: error.message });
    }
  });

  // ============================================================================
  // PROPOSAL BUILDER UPGRADE - Allocation, Strategy, Backtest APIs
  // ============================================================================

  app.post('/api/proposals/:proposalId/allocation-mode', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { mode, agentId } = req.body;
      if (!mode || !['AI_DRIVEN', 'MANUAL'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be AI_DRIVEN or MANUAL' });
      }
      const result = await ProposalOrchestrator.selectAllocationMode(proposalId, mode, agentId || 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/proposals/:proposalId/ai-allocation', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const result = await ProposalOrchestrator.suggestAiAllocation(proposalId, 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/proposals/:proposalId/lock-strategy', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { allocationMode, allocation, agentId } = req.body;
      if (!allocationMode || !allocation || !Array.isArray(allocation)) {
        return res.status(400).json({ error: 'allocationMode and allocation array required' });
      }
      const validation = ProposalOrchestrator.validateAllocation(allocation);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Allocation validation failed', errors: validation.errors });
      }
      const result = await ProposalOrchestrator.lockStrategySnapshot(proposalId, allocationMode, allocation, agentId || 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/proposals/:proposalId/locked-strategy', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const result = await ProposalOrchestrator.getLockedStrategy(proposalId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/proposals/:proposalId/select-instruments', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { agentId } = req.body;
      const result = await ProposalOrchestrator.selectInstrumentsWithinStrategy(proposalId, agentId || 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/proposals/:proposalId/fair-backtest', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { oldHoldings, agentId } = req.body;
      if (!oldHoldings || !Array.isArray(oldHoldings)) {
        return res.status(400).json({ error: 'oldHoldings array required' });
      }
      const result = await ProposalOrchestrator.runFairBacktest(proposalId, oldHoldings, agentId || 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/proposals/:proposalId/portfolio-difference', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { oldAllocation, agentId } = req.body;
      if (!oldAllocation || !Array.isArray(oldAllocation)) {
        return res.status(400).json({ error: 'oldAllocation array required' });
      }
      const result = await ProposalOrchestrator.generatePortfolioDifferenceSummary(proposalId, oldAllocation, agentId || 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/proposals/:proposalId/validate-override', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { proposedAllocation, agentId } = req.body;
      const { ProposalVerdictNormalizer } = await import('../services/proposal-verdict-normalizer');
      const result = await ProposalVerdictNormalizer.validateAllocationOverride(proposalId, proposedAllocation, agentId || 'system');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/proposals/:proposalId/strategy-integrity', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { ProposalFlowGatekeeper } = await import('../services/proposal-flow-gatekeeper');
      const result = await ProposalFlowGatekeeper.validateStrategyIntegrity(proposalId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/proposals/:proposalId/new-version', requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { newAllocation, allocationMode, agentId, changeReason } = req.body;
      if (!newAllocation || !Array.isArray(newAllocation) || !allocationMode) {
        return res.status(400).json({ error: 'newAllocation array and allocationMode required' });
      }
      const result = await ProposalOrchestrator.forceNewVersionOnAllocationChange(
        proposalId, newAllocation, allocationMode, agentId || 'system', changeReason || 'Allocation modified'
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log("✅ Agent Advisory routes registered (including Proposal Builder Upgrade APIs)");
}
