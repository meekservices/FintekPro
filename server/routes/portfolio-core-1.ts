import { Express } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { and, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/roleMiddleware';

export function buildRequireOwnPortfolio(storageRef: typeof storage) {
  return async (req: any, res: any, next: any) => {
    try {
      const { portfolioId } = req.params;
      let userId = req.user?.id;
      if (!userId) {
        const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.REPL_ID;
        if (isDevelopment) {
          userId = 'central-test-user';
          req.user = { id: userId };
        } else {
          return res.status(401).json({ error: 'Authentication required' });
        }
      }
      const portfolio = await storageRef.getPortfolio(portfolioId);
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }
      if (portfolio.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    } catch (error) {
      console.error('Error checking portfolio ownership:', error);
      res.status(500).json({ error: 'Failed to verify portfolio access' });
    }
  };
}

export function registerPortfolioCorPart1Routes(app: Express): void {
app.get("/api/portfolios", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const portfolios = await storage.getPortfoliosByUserId(userId);
    res.json(portfolios);
  } catch (error) {
    console.error("Error fetching portfolios:", error);
    res.status(500).json({ error: "Failed to fetch portfolios" });
  }
});

// PAN-based portfolio access - Client can only see portfolios linked to their PAN
app.get("/api/portfolios/by-pan", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (!user.panNumber) {
      return res.json([]);
    }
    
    // Get portfolios linked to user's PAN card
    const portfolios = await storage.getPortfoliosByUserPan(user.panNumber);
    res.json(Array.isArray(portfolios) ? portfolios : []);
  } catch (error) {
    console.error("Error fetching portfolios by PAN:", error);
    res.status(500).json({ error: "Failed to fetch portfolios" });
  }
});

// Wealth Management Financial Analysis endpoint
app.get("/api/wealth-management/analysis", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    
    const analysis = await storage.getUserFinancialAnalysis(userId);
    
    if (!analysis) {
      return res.status(404).json({ 
        error: "Financial data not found",
        message: "Please complete your profile and KYC to access wealth management features"
      });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error("Error fetching financial analysis:", error);
    res.status(500).json({ error: "Failed to fetch financial analysis" });
  }
});

// Financial Obligations endpoints (EMIs, loans, credit obligations)
app.get("/api/financial-obligations", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const obligations = await storage.getFinancialObligations(userId);
    res.json(obligations);
  } catch (error) {
    console.error("Error fetching financial obligations:", error);
    res.status(500).json({ error: "Failed to fetch financial obligations" });
  }
});

app.post("/api/financial-obligations", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const obligation = await storage.createFinancialObligation({
      ...req.body,
      userId
    });
    res.json(obligation);
  } catch (error) {
    console.error("Error creating financial obligation:", error);
    res.status(500).json({ error: "Failed to create financial obligation" });
  }
});

app.patch("/api/financial-obligations/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    // Verify ownership
    const existing = await storage.getFinancialObligationById(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Obligation not found" });
    }
    
    const updated = await storage.updateFinancialObligation(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating financial obligation:", error);
    res.status(500).json({ error: "Failed to update financial obligation" });
  }
});

app.delete("/api/financial-obligations/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    // Verify ownership
    const existing = await storage.getFinancialObligationById(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Obligation not found" });
    }
    
    await storage.deleteFinancialObligation(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting financial obligation:", error);
    res.status(500).json({ error: "Failed to delete financial obligation" });
  }
});

// Government Scheme Holdings endpoints
app.get("/api/government-schemes/epf", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const epfHoldings = await storage.getEpfHoldings(userId);
    res.json(epfHoldings);
  } catch (error) {
    console.error("Error fetching EPF holdings:", error);
    res.status(500).json({ error: "Failed to fetch EPF holdings" });
  }
});

app.get("/api/government-schemes/ppf", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const ppfHoldings = await storage.getPpfHoldings(userId);
    res.json(ppfHoldings);
  } catch (error) {
    console.error("Error fetching PPF holdings:", error);
    res.status(500).json({ error: "Failed to fetch PPF holdings" });
  }
});

app.get("/api/government-schemes/eps", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const epsHoldings = await storage.getEpsHoldings(userId);
    res.json(epsHoldings);
  } catch (error) {
    console.error("Error fetching EPS holdings:", error);
    res.status(500).json({ error: "Failed to fetch EPS holdings" });
  }
});

app.get("/api/government-schemes/nps", requireAuth, async (req: any, res) => {
  try {
    res.json({
      holdings: [],
      totalValue: 0,
      lastUpdated: null,
      message: "NPS integration coming soon"
    });
  } catch (error) {
    console.error("Error fetching NPS holdings:", error);
    res.status(500).json({ error: "Failed to fetch NPS holdings" });
  }
});

app.get("/api/government-schemes/apy", requireAuth, async (req: any, res) => {
  try {
    res.json({
      holdings: [],
      totalValue: 0,
      lastUpdated: null,
      message: "APY integration coming soon"
    });
  } catch (error) {
    console.error("Error fetching APY holdings:", error);
    res.status(500).json({ error: "Failed to fetch APY holdings" });
  }
});

// Government Scheme Consent Management endpoints
app.get("/api/government-schemes/consent/:panNumber/:schemeType", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { panNumber, schemeType } = req.params;
    const hasConsent = await storage.checkGovernmentSchemeConsent(userId, panNumber, schemeType);
    res.json({ hasConsent, panNumber, schemeType });
  } catch (error) {
    console.error("Error checking consent:", error);
    res.status(500).json({ error: "Failed to check consent status" });
  }
});

app.post("/api/government-schemes/consent", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { panNumber, schemeType, purpose } = req.body;
    
    const consentData = {
      userId,
      panNumber,
      schemeType,
      purpose: purpose || "Access government scheme holdings data for portfolio management",
      consentGranted: true,
      consentDate: new Date(),
      consentExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      isActive: true
    };
    
    const consent = await storage.createGovernmentSchemeConsent(consentData);
    res.json(consent);
  } catch (error) {
    console.error("Error creating consent:", error);
    res.status(500).json({ error: "Failed to create consent" });
  }
});

app.get("/api/government-schemes/consents", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { panNumber } = req.query;
    const consents = await storage.getGovernmentSchemeConsents(userId, panNumber as string);
    res.json(consents);
  } catch (error) {
    console.error("Error fetching consents:", error);
    res.status(500).json({ error: "Failed to fetch consents" });
  }
});

app.delete("/api/government-schemes/consent/:panNumber/:schemeType", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { panNumber, schemeType } = req.params;
    const revoked = await storage.revokeGovernmentSchemeConsent(userId, panNumber, schemeType);
    res.json({ revoked, panNumber, schemeType });
  } catch (error) {
    console.error("Error revoking consent:", error);
    res.status(500).json({ error: "Failed to revoke consent" });
  }
});


// Client Tasks API endpoints for user action items
app.get("/api/tasks/user", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const tasks = await storage.getClientTasks(userId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching client tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks/user", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    // Validate and sanitize - only allow specific fields
    const { title, description, type, priority, dueDate, actionLabel, actionRoute, metadata } = req.body;
    if (!title || !type || !dueDate) {
      return res.status(400).json({ error: "Missing required fields: title, type, dueDate" });
    }
    const taskData = {
      userId,
      title: String(title),
      description: description ? String(description) : undefined,
      type: String(type),
      priority: priority || 'medium',
      dueDate: String(dueDate),
      actionLabel: actionLabel ? String(actionLabel) : undefined,
      actionRoute: actionRoute ? String(actionRoute) : undefined,
      metadata: metadata || undefined
    };
    const task = await storage.createClientTask(taskData);
    res.json(task);
  } catch (error) {
    console.error("Error creating client task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.patch("/api/tasks/user/:taskId", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    // Whitelist only mutable fields - prevent userId/id modification
    const { title, description, priority, status, dueDate, actionLabel, actionRoute, completedAt } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = String(title);
    if (description !== undefined) updates.description = String(description);
    if (priority !== undefined) updates.priority = String(priority);
    if (status !== undefined) updates.status = String(status);
    if (dueDate !== undefined) updates.dueDate = String(dueDate);
    if (actionLabel !== undefined) updates.actionLabel = String(actionLabel);
    if (actionRoute !== undefined) updates.actionRoute = String(actionRoute);
    if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;
    
    const task = await storage.updateClientTask(taskId, userId, updates);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  } catch (error) {
    console.error("Error updating client task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/user/:taskId", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    const deleted = await storage.deleteClientTask(taskId, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting client task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Loan Applications API endpoints
app.get("/api/loans/applications", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const applications = await storage.getLoanApplications(userId);
    res.json(applications);
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    res.status(500).json({ error: "Failed to fetch loan applications" });
  }
});

}
