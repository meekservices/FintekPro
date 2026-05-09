import { Express } from 'express';
import { storage } from '../storage';
import { requireAdmin, requireAgent } from '../middleware/roleMiddleware';
import { requireLevel2 } from '../middleware/kyc-level-gate';
import { comprehensiveAIFPMSAPI } from '../comprehensive-aif-pms-api';
import { kfintechApi } from '../kfintech-api';
import { errorMonitor, errorMonitoringMiddleware, globalErrorHandler } from '../error-monitor';
import { and, or, count } from 'drizzle-orm';
import * as geminiService from '../gemini-service';

const authenticateUser = async (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Authentication required" });
  return res.status(401).json({ error: "Please sign in to access this resource" });
};

const hasRole = (user: any, requiredRoles: string[]): boolean => {
  if (!user) return false;
  const userRoles = user.roles || (user.role ? [user.role] : []);
  return requiredRoles.some(role => userRoles.includes(role));
};

export function registerAIFPMSSystemPart2Routes(app: Express): void {
app.get('/api/system/auto-heal', async (req, res) => {
  try {
    const healingActions = await errorMonitor.autoHeal();
    
    res.json({
      status: 'success',
      healingActions: healingActions,
      applied: healingActions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Auto-heal failed:', error);
    res.status(500).json({ error: 'Auto-heal failed' });
  }
});

app.post('/api/system/analyze-logs', async (req, res) => {
  try {
    const { logs, logType } = req.body;
    let analysis;
    
    switch (logType) {
      case 'system':
        analysis = await geminiService.analyzeSystemErrors(JSON.stringify(logs));
        break;
      case 'performance':
        analysis = await geminiService.analyzeApiPerformance(JSON.stringify(logs));
        break;
      case 'security':
        analysis = await geminiService.analyzeSecurityVulnerabilities(JSON.stringify(logs));
        break;
      default:
        analysis = await geminiService.analyzeSystemErrors(JSON.stringify(logs));
    }
    
    res.json({
      status: 'success',
      logType: logType,
      analysis: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Log analysis failed:', error);
    res.status(500).json({ error: 'Log analysis failed' });
  }
});

app.get('/api/system/performance/metrics', async (req, res) => {
  try {
    const health = errorMonitor.getSystemHealth();
    const metrics = {
      responseTime: health.performance.avgResponseTime,
      errorRate: health.performance.errorRate,
      uptime: health.performance.uptime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      systemLoad: {
        apis: health.apis,
        database: health.database,
        overall: health.overall
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      status: 'success',
      metrics: metrics
    });
  } catch (error) {
    console.error('Performance metrics failed:', error);
    res.status(500).json({ error: 'Performance metrics failed' });
  }
});

app.get('/api/system/diagnostics/comprehensive', async (req, res) => {
  try {
    // Get comprehensive system diagnostics
    const health = errorMonitor.getSystemHealth();
    const analysis = await errorMonitor.generateErrorAnalysis();
    const agentInstructions = await errorMonitor.generateReplitAgentInstructions();
    const healingActions = await errorMonitor.autoHeal();
    
    res.json({
      status: 'success',
      diagnostics: {
        systemHealth: health,
        aiAnalysis: analysis,
        replitAgentInstructions: agentInstructions,
        autoHealRecommendations: healingActions,
        summary: {
          overallHealth: health.overall,
          criticalIssues: health.errors.filter(e => e.severity === 'critical').length,
          totalRecommendations: (analysis.recommendations || []).length,
          agentTasksGenerated: (agentInstructions.instructions || []).length,
          healingActionsAvailable: healingActions.length
        }
      },
      timestamp: new Date().toISOString(),
      message: 'Comprehensive system diagnostics powered by Gemini AI'
    });
  } catch (error) {
    console.error('Comprehensive diagnostics failed:', error);
    res.status(500).json({ error: 'Comprehensive diagnostics failed' });
  }
});

// KFintech API Integration endpoints

// Validate investor through KFintech
app.get('/api/kfintech/investor/validate/:pan', async (req, res) => {
  try {
    const { pan } = req.params;
    const result = await kfintechApi.validateInvestor(pan);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech investor validation error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get portfolio from KFintech
app.get('/api/kfintech/portfolio/:pan', async (req, res) => {
  try {
    const { pan } = req.params;
    const result = await kfintechApi.getInvestorPortfolio(pan);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech portfolio error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get transaction history from KFintech
app.get('/api/kfintech/transactions/:pan', async (req, res) => {
  try {
    const { pan } = req.params;
    const { fromDate, toDate, folioNumber } = req.query;
    
    const result = await kfintechApi.getTransactionHistory(
      pan,
      fromDate as string || '2024-01-01',
      toDate as string || new Date().toISOString().split('T')[0],
      folioNumber as string
    );
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech transactions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get SIP details from KFintech
app.get('/api/kfintech/sip/:pan', async (req, res) => {
  try {
    const { pan } = req.params;
    const { folioNumber } = req.query;
    
    const result = await kfintechApi.getSIPDetails(pan, folioNumber as string);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech SIP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create purchase transaction through KFintech
app.post('/api/kfintech/transactions/purchase', async (req, res) => {
  try {
    const purchaseRequest = req.body;
    const result = await kfintechApi.createPurchaseTransaction(purchaseRequest);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech purchase error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Setup SIP through KFintech
app.post('/api/kfintech/sip/setup', async (req, res) => {
  try {
    const sipRequest = req.body;
    const result = await kfintechApi.setupSIP(sipRequest);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech SIP setup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Cancel SIP through KFintech
app.post('/api/kfintech/sip/cancel', async (req, res) => {
  try {
    const { pan, sipId } = req.body;
    const result = await kfintechApi.cancelSIP(pan, sipId);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech SIP cancel error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get scheme details from KFintech
app.get('/api/kfintech/schemes/:schemeCode', async (req, res) => {
  try {
    const { schemeCode } = req.params;
    const result = await kfintechApi.getSchemeDetails(schemeCode);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('KFintech scheme details error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Investment Proposal API Routes for Portfolio Improvement System

// Get investment proposals (for agents and clients)
app.get("/api/proposals", authenticateUser, async (req, res) => {
  try {
    const { clientId, agentId, status } = req.query as any;
    
    // If user is not admin, restrict to their own proposals
    let filteredOptions: any = {};
    if (!hasRole(req.user, ['admin'])) {
      if (hasRole(req.user, ['agent'])) {
        filteredOptions.agentId = req.user.id;
      } else {
        filteredOptions.clientId = req.user.id;
      }
    } else {
      // Admin can filter by any client or agent
      if (clientId) filteredOptions.clientId = clientId;
      if (agentId) filteredOptions.agentId = agentId;
    }
    
    if (status) filteredOptions.status = status;
    
    const proposals = await storage.getInvestmentProposals(filteredOptions);
    res.json(proposals);
  } catch (error) {
    console.error("Error fetching investment proposals:", error);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

// Get specific proposal details
app.get("/api/proposals/:proposalId", authenticateUser, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await storage.getInvestmentProposal(proposalId);
    
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    
    // Check if user has access to this proposal
    if (!hasRole(req.user, ['admin']) && 
        proposal.clientId !== req.user.id && 
        proposal.agentId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Get proposal items
    const items = await storage.getProposalItems(proposalId);
    
    res.json({ ...proposal, items });
  } catch (error) {
    console.error("Error fetching proposal details:", error);
    res.status(500).json({ error: "Failed to fetch proposal details" });
  }
});

// Create new investment proposal (agents only)
app.post("/api/proposals", authenticateUser, async (req, res) => {
  try {
    // Only agents can create proposals
    if (!hasRole(req.user, ['agent', 'admin'])) {
      return res.status(403).json({ error: "Only agents can create investment proposals" });
    }
    
    const proposalData = {
      ...req.body,
      agentId: req.user.id, // Always use authenticated agent's ID
    };
    
    const proposal = await storage.createInvestmentProposal(proposalData);
    res.status(201).json(proposal);
  } catch (error) {
    console.error("Error creating investment proposal:", error);
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

// Update investment proposal
app.patch("/api/proposals/:proposalId", authenticateUser, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await storage.getInvestmentProposal(proposalId);
    
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    
    // Only the agent who created it or admin can update
    if (!hasRole(req.user, ['admin']) && proposal.agentId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Prevent updating if already approved or executed
    if (proposal.status === 'approved' || proposal.status === 'executed') {
      return res.status(400).json({ error: "Cannot update approved or executed proposals" });
    }
    
    const updated = await storage.updateInvestmentProposal(proposalId, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating investment proposal:", error);
    res.status(500).json({ error: "Failed to update proposal" });
  }
});

// Client approval actions
  app.post('/api/proposals/:id/approve', authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { clientResponse } = req.body;
      const userId = (req as any).user.id;

      const proposal = await storage.getInvestmentProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Security check: Only the assigned client can approve
      if (proposal.clientId !== userId) {
        return res.status(403).json({ error: "You are not authorized to approve this proposal" });
      }

      if (proposal.status !== 'waiting_client_approval' && proposal.status !== 'pending') {
        return res.status(400).json({ error: `Cannot approve proposal with status ${proposal.status}` });
      }

      const updated = await storage.approveProposal(id, clientResponse);
      res.json({
        success: true,
        proposal: updated,
        message: "Proposal approved successfully"
      });
    } catch (error: any) {
      console.error("Error approving proposal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Client rejection endpoint
  app.post('/api/proposals/:id/reject', authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { clientResponse } = req.body;
      const userId = (req as any).user.id;

      if (!clientResponse) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const proposal = await storage.getInvestmentProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Security check: Only the assigned client can reject
      if (proposal.clientId !== userId) {
        return res.status(403).json({ error: "You are not authorized to reject this proposal" });
      }

      const updated = await storage.rejectProposal(id, clientResponse);
      res.json({
        success: true,
        proposal: updated,
        message: "Proposal rejected"
      });
    } catch (error: any) {
      console.error("Error rejecting proposal:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
