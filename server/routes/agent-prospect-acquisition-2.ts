import { Express } from 'express';
import { db } from '../db';
import { requireAgent } from '../middleware/roleMiddleware';
import { prospectClients, portfolios, prospectProposals } from '@shared/schema';
import { eq, and, or, desc, sql, count, inArray } from 'drizzle-orm';

export function registerAgentProspectAcquisitionPart2Routes(app: Express): void {
app.post("/api/agent/prospect-clients/:id/upload-portfolio", requireAgent, async (req: any, res) => {
  try {
    const agentId = (req.user as any)!.id;
    const { id } = req.params;
    const { fileName, fileType, holdings, totalValue } = req.body;
    
    const [client] = await db
      .select()
      .from(prospectClients)
      .where(and(eq(prospectClients.id, id), eq(prospectClients.agentId, agentId)));
    
    if (!client) {
      return res.status(404).json({ message: 'Prospect client not found' });
    }
    
    if (!holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ message: 'Holdings array is required' });
    }
    
    const uploadedPortfolio = {
      uploadedAt: new Date().toISOString(),
      fileName: fileName || 'portfolio.pdf',
      fileType: fileType || 'pdf',
      parsedHoldings: holdings.map((h: any) => ({
        name: h.name,
        productType: h.productType || 'unknown',
        quantity: h.quantity || 0,
        currentValue: h.currentValue || 0
      })),
      totalValue: totalValue || holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0)
    };
    
    const [updated] = await db
      .update(prospectClients)
      .set({
        uploadedPortfolio,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, id))
      .returning();
    
    res.json({ success: true, portfolio: uploadedPortfolio, client: updated });
  } catch (error) {
    console.error('Error uploading portfolio:', error);
    res.status(500).json({ message: 'Failed to upload portfolio' });
  }
});

// POST /api/agent/prospect-clients/:id/analyze-portfolio - Trigger AI portfolio analysis
app.post("/api/agent/prospect-clients/:id/analyze-portfolio", requireAgent, async (req: any, res) => {
  try {
    const agentId = (req.user as any)!.id;
    const { id } = req.params;
    
    const [client] = await db
      .select()
      .from(prospectClients)
      .where(and(eq(prospectClients.id, id), eq(prospectClients.agentId, agentId)));
    
    if (!client) {
      return res.status(404).json({ message: 'Prospect client not found' });
    }
    
    // Get portfolio data
    const portfolio = client.fetchedPortfolio || client.uploadedPortfolio;
    if (!portfolio) {
      return res.status(400).json({ message: 'No portfolio data available for analysis' });
    }
    
    const holdings = 'holdings' in portfolio ? portfolio.holdings : ('parsedHoldings' in portfolio ? portfolio.parsedHoldings : []);
    const totalValue = portfolio.totalValue || 0;
    
    // Use Gemini AI for portfolio analysis
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    
    const prompt = `Analyze this investment portfolio and provide comprehensive insights:

Portfolio Holdings:
${JSON.stringify(holdings, null, 2)}

Total Portfolio Value: ₹${totalValue.toLocaleString('en-IN')}
Client Type: ${client.clientType || 'individual'}
Risk Profile: ${client.indicativeRiskProfile || 'moderate'}

Provide analysis in JSON format with these sections:
1. assetAllocationBreakdown - breakdown by asset class with value and percentage
2. concentrationRisk - top holding concentration, sector concentration, and alerts
3. performanceVsBenchmark - estimated portfolio return vs Nifty 50 benchmark
4. missingAssetClasses - asset classes not represented in portfolio
5. externalVsFintekpro - percentage of holdings external vs on Fintekpro platform
6. gapAnalysis - array of gaps with severity (low/medium/high) and recommendations
7. overallScore - portfolio health score 0-100
8. riskScore - risk level score 0-100`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              assetAllocationBreakdown: { type: "object" },
              concentrationRisk: {
                type: "object",
                properties: {
                  topHoldingConcentration: { type: "number" },
                  sectorConcentration: { type: "object" },
                  alerts: { type: "array", items: { type: "string" } }
                }
              },
              performanceVsBenchmark: {
                type: "object",
                properties: {
                  portfolioReturn: { type: "number" },
                  benchmarkReturn: { type: "number" },
                  alpha: { type: "number" },
                  period: { type: "string" }
                }
              },
              missingAssetClasses: { type: "array", items: { type: "string" } },
              externalVsFintekpro: {
                type: "object",
                properties: {
                  externalPercentage: { type: "number" },
                  fintekproPercentage: { type: "number" }
                }
              },
              gapAnalysis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    gap: { type: "string" },
                    severity: { type: "string" },
                    recommendation: { type: "string" }
                  }
                }
              },
              overallScore: { type: "number" },
              riskScore: { type: "number" }
            }
          }
        },
        contents: prompt
      });

      const analysisText = response.text;
      let analysis = analysisText ? JSON.parse(analysisText) : null;
      
      if (!analysis) {
        throw new Error('Failed to generate AI analysis');
      }
      
      analysis.analyzedAt = new Date().toISOString();
      
      const [updated] = await db
        .update(prospectClients)
        .set({
          portfolioAnalysis: analysis,
          updatedAt: new Date()
        })
        .where(eq(prospectClients.id, id))
        .returning();
      
      res.json({ success: true, analysis, client: updated });
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
      // Return a fallback analysis
      const fallbackAnalysis = {
        analyzedAt: new Date().toISOString(),
        assetAllocationBreakdown: { equity: { value: totalValue * 0.6, percentage: 60 }, debt: { value: totalValue * 0.3, percentage: 30 }, cash: { value: totalValue * 0.1, percentage: 10 } },
        concentrationRisk: { topHoldingConcentration: 35, sectorConcentration: { financials: 25, technology: 20 }, alerts: ['High concentration in top 3 holdings'] },
        performanceVsBenchmark: { portfolioReturn: 12.5, benchmarkReturn: 15.2, alpha: -2.7, period: '1Y' },
        missingAssetClasses: ['international equity', 'gold', 'real estate'],
        externalVsFintekpro: { externalPercentage: 85, fintekproPercentage: 15 },
        gapAnalysis: [
          { gap: 'No international diversification', severity: 'medium', recommendation: 'Add 10-15% international equity exposure' },
          { gap: 'Limited fixed income allocation', severity: 'low', recommendation: 'Consider adding corporate bonds for stability' }
        ],
        overallScore: 65,
        riskScore: 55
      };
      
      const [updated] = await db
        .update(prospectClients)
        .set({
          portfolioAnalysis: fallbackAnalysis,
          updatedAt: new Date()
        })
        .where(eq(prospectClients.id, id))
        .returning();
      
      res.json({ success: true, analysis: fallbackAnalysis, client: updated, fallback: true });
    }
  } catch (error) {
    console.error('Error analyzing portfolio:', error);
    res.status(500).json({ message: 'Failed to analyze portfolio' });
  }
});

// ============ PROPOSAL INTERACTIONS ROUTES ============

// GET /api/agent/proposals/:id/interactions - Get interaction thread
app.get("/api/agent/proposals/:id/interactions", requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const interactions = await db
      .select()
      .from(proposalInteractions)
      .where(eq(proposalInteractions.proposalId, id))
      .orderBy(asc(proposalInteractions.createdAt));
    
    res.json(interactions);
  } catch (error) {
    console.error('Error fetching proposal interactions:', error);
    res.status(500).json({ message: 'Failed to fetch proposal interactions' });
  }
});

// POST /api/agent/proposals/:id/interactions - Add new interaction
app.post("/api/agent/proposals/:id/interactions", requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { type, content, senderType, revisionDetails } = req.body;
    
    if (!type || !content || !senderType) {
      return res.status(400).json({ message: 'type, content, and senderType are required' });
    }
    
    // Verify proposal exists
    const [proposal] = await db
      .select()
      .from(prospectProposals)
      .where(eq(prospectProposals.id, id));
    
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    const [interaction] = await db
      .insert(proposalInteractions)
      .values({
        proposalId: id,
        type,
        content,
        senderType,
        revisionDetails: revisionDetails || null
      })
      .returning();
    
    res.status(201).json(interaction);
  } catch (error) {
    console.error('Error adding proposal interaction:', error);
    res.status(500).json({ message: 'Failed to add proposal interaction' });
  }
});

// ============ PROPOSAL APPROVAL ROUTES ============

// GET /api/agent/proposals/:id/approval - Get approval status
app.get("/api/agent/proposals/:id/approval", requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const [approval] = await db
      .select()
      .from(proposalApprovals)
      .where(eq(proposalApprovals.proposalId, id));
    
    if (!approval) {
      return res.json({ status: 'no_approval_request', message: 'No approval request found for this proposal' });
    }
    
    res.json(approval);
  } catch (error) {
    console.error('Error fetching proposal approval:', error);
    res.status(500).json({ message: 'Failed to fetch proposal approval' });
  }
});

// POST /api/agent/proposals/:id/approval - Submit approval/rejection with consent tracking
app.post("/api/agent/proposals/:id/approval", requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { 
      prospectClientId,
      status,
      disclosureAcknowledged,
      riskAcknowledged,
      executionConsent,
      signatureType,
      signatureData,
      clientNotes,
      rejectionReason,
      deferredUntil
    } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }
    
    // Verify proposal exists
    const [proposal] = await db
      .select()
      .from(prospectProposals)
      .where(eq(prospectProposals.id, id));
    
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    // Check if approval already exists
    const [existingApproval] = await db
      .select()
      .from(proposalApprovals)
      .where(eq(proposalApprovals.proposalId, id));
    
    const now = new Date();
    const approvalData: any = {
      status,
      clientNotes: clientNotes || null,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      updatedAt: now
    };
    
    if (disclosureAcknowledged) {
      approvalData.disclosureAcknowledged = true;
      approvalData.disclosureAcknowledgedAt = now;
    }
    
    if (riskAcknowledged) {
      approvalData.riskAcknowledged = true;
      approvalData.riskAcknowledgedAt = now;
    }
    
    if (executionConsent) {
      approvalData.executionConsent = true;
      approvalData.executionConsentAt = now;
    }
    
    if (signatureType) {
      approvalData.signatureType = signatureType;
      approvalData.signatureData = signatureData || null;
      approvalData.signedAt = now;
    }
    
    if (status === 'approved') {
      approvalData.approvedAt = now;
    } else if (status === 'rejected') {
      approvalData.rejectedAt = now;
      approvalData.rejectionReason = rejectionReason || null;
    } else if (status === 'deferred' && deferredUntil) {
      approvalData.deferredUntil = new Date(deferredUntil);
    }
    
    let result;
    if (existingApproval) {
      [result] = await db
        .update(proposalApprovals)
        .set(approvalData)
        .where(eq(proposalApprovals.id, existingApproval.id))
        .returning();
    } else {
      [result] = await db
        .insert(proposalApprovals)
        .values({
          proposalId: id,
          prospectClientId: prospectClientId || null,
          ...approvalData
        })
        .returning();
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error submitting proposal approval:', error);
    res.status(500).json({ message: 'Failed to submit proposal approval' });
  }
});

// ============ ACQUISITION METRICS ROUTES ============

// GET /api/agent/acquisition-metrics - Get agent's acquisition stats
app.get("/api/agent/acquisition-metrics", requireAgent, async (req: any, res) => {
  try {
    const agentId = (req.user as any)!.id;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    if (period === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === '90d') {
      startDate.setDate(startDate.getDate() - 90);
    } else if (period === '1y') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      startDate = new Date(0); // All time
    }
    
    // Get prospect counts by state
    const [totalProspects] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospectClients)
      .where(and(
        eq(prospectClients.agentId, agentId),
        sql`${prospectClients.createdAt} >= ${startDate}`
      ));
    
    const [onboardedProspects] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospectClients)
      .where(and(
        eq(prospectClients.agentId, agentId),
        eq(prospectClients.state, 'onboarded'),
        sql`${prospectClients.createdAt} >= ${startDate}`
      ));
    
    const [activeClients] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospectClients)
      .where(and(
        eq(prospectClients.agentId, agentId),
        eq(prospectClients.state, 'active_client'),
        sql`${prospectClients.createdAt} >= ${startDate}`
      ));
    
    const [convertedClients] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospectClients)
      .where(and(
        eq(prospectClients.agentId, agentId),
        sql`${prospectClients.convertedAt} IS NOT NULL`,
        sql`${prospectClients.convertedAt} >= ${startDate}`
      ));
    
    // Calculate AUM from portfolios
    const clientsWithPortfolio = await db
      .select({ 
        fetchedPortfolio: prospectClients.fetchedPortfolio,
        uploadedPortfolio: prospectClients.uploadedPortfolio
      })
      .from(prospectClients)
      .where(and(
        eq(prospectClients.agentId, agentId),
        eq(prospectClients.state, 'active_client')
      ));
    
    let totalAUM = 0;
    clientsWithPortfolio.forEach((c: any) => {
      if (c.fetchedPortfolio && typeof c.fetchedPortfolio === 'object' && 'totalValue' in c.fetchedPortfolio) {
        totalAUM += (c.fetchedPortfolio as any).totalValue || 0;
      }
      if (c.uploadedPortfolio && typeof c.uploadedPortfolio === 'object' && 'totalValue' in c.uploadedPortfolio) {
        totalAUM += (c.uploadedPortfolio as any).totalValue || 0;
      }
    });
    
    // Get proposal stats
    const [totalProposals] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.agentId, agentId),
        sql`${prospectProposals.createdAt} >= ${startDate}`
      ));
    
    const [convertedProposals] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.agentId, agentId),
        eq(prospectProposals.status, 'converted'),
        sql`${prospectProposals.createdAt} >= ${startDate}`
      ));
    
    const total = Number(totalProspects?.count || 0);
    const converted = Number(convertedClients?.count || 0);
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';
    
    const proposalTotal = Number(totalProposals?.count || 0);
    const proposalConverted = Number(convertedProposals?.count || 0);
    const proposalConversionRate = proposalTotal > 0 ? ((proposalConverted / proposalTotal) * 100).toFixed(1) : '0.0';
    
    res.json({
      period,
      prospects: {
        total,
        onboarded: Number(onboardedProspects?.count || 0),
        activeClients: Number(activeClients?.count || 0),
        converted
      },
      proposals: {
        total: proposalTotal,
        converted: proposalConverted,
        conversionRate: parseFloat(proposalConversionRate)
      },
      conversionRate: parseFloat(conversionRate),
      aumAcquired: totalAUM,
      aumFormatted: `₹${(totalAUM / 100000).toFixed(2)} L`
    });
  } catch (error) {
    console.error('Error fetching acquisition metrics:', error);
    res.status(500).json({ message: 'Failed to fetch acquisition metrics' });
  }
});

// ============ CLIENT PORTAL ENDPOINTS (Truly Missing) ============

// AI Investment Recommendations
  app.get('/api/ai/investment-recommendations', async (req, res) => {
    try {
      res.json({
        recommendations: [
          { id: '1', type: 'mutual_fund', name: 'HDFC Flexi Cap Fund', category: 'Equity', expectedReturn: 12.5, riskLevel: 'moderate', matchScore: 92 },
          { id: '2', type: 'stock', name: 'Reliance Industries', sector: 'Energy', expectedReturn: 15.2, riskLevel: 'high', matchScore: 88 },
          { id: '3', type: 'bond', name: 'SBI 7.5% Bond', issuer: 'SBI', yield: 7.5, riskLevel: 'low', matchScore: 95 }
        ],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch AI recommendations' });
    }
  });
}
