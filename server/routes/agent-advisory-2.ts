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



export function registerAgentAdvisoryPart2Routes(app: Express) {
  app.get("/api/agent/proposals", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      // Fetch from investment_proposals table using raw SQL
      const rawProposalsResult = await db.execute(sql`
        SELECT id, client_id, agent_id, title, description, is_demo, status,
               total_investment_amount, created_at, updated_at, valid_until
        FROM investment_proposals
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
        LIMIT 100
      `);

      const proposals = (rawProposalsResult.rows || []).map((p: any) => ({
        id: p.id,
        clientId: p.client_id,
        title: p.title,
        description: p.description,
        isDemo: p.is_demo,
        status: p.status,
        investmentAmount: p.total_investment_amount,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        expiresAt: p.valid_until,
        source: 'proposal_builder'
      }));
      
      // Also fetch from prospect_proposals table (wizard proposals) using raw SQL
      const wizardProposalsResult = await db.execute(sql`
        SELECT id, agent_id, prospect_name, prospect_email, prospect_mobile,
               proposal_title, executive_summary, status, investment_amount,
               total_investment_amount, created_at, updated_at, valid_until,
               expires_at, share_token, shared_at, viewed_at, view_count
        FROM prospect_proposals
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
        LIMIT 100
      `);
      
      const formattedWizardProposals = (wizardProposalsResult.rows || []).map((p: any) => ({
        id: p.id,
        clientId: null,
        title: p.proposal_title || `Investment Proposal for ${p.prospect_name}`,
        description: p.executive_summary,
        isDemo: false,
        status: p.status === 'shared' ? 'shared' : p.status === 'viewed' ? 'client_viewed' : p.status === 'converted' ? 'executed' : 'draft',
        investmentAmount: p.total_investment_amount || p.investment_amount || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        expiresAt: p.valid_until || p.expires_at,
        clientName: p.prospect_name,
        prospectEmail: p.prospect_email,
        prospectMobile: p.prospect_mobile,
        shareToken: p.share_token,
        sharedAt: p.shared_at,
        viewedAt: p.viewed_at,
        viewCount: p.view_count || 0,
        source: 'wizard'
      }));

      const proposalsWithDetails = await Promise.all(
        proposals.map(async (proposal: any) => {
          let clientName = 'Unknown';
          
          // Try to get client from users table using raw SQL
          if (proposal.clientId) {
            const clientResult = await db.execute(sql`
              SELECT first_name, last_name FROM users WHERE id = ${proposal.clientId} LIMIT 1
            `);
            const client = clientResult.rows?.[0];
            
            if (client) {
              clientName = `${(client as any).first_name || ''} ${(client as any).last_name || ''}`.trim() || 'Unknown';
            }
          }
          
          // Fallback: Extract name from title patterns like "Investment Proposal - Name" or "Investment Proposal for Name"
          if (clientName === 'Unknown' && proposal.title) {
            // Try pattern: "... - Name" or "... – Name" (em-dash or hyphen)
            const dashMatch = proposal.title.match(/[-–—]\s*(.+?)$/);
            if (dashMatch && dashMatch[1] && dashMatch[1].trim().length > 0) {
              clientName = dashMatch[1].trim();
            } else {
              // Try pattern: "... for Name"
              const forMatch = proposal.title.match(/for\s+(.+?)(?:\s*-|\s*$)/i);
              if (forMatch && forMatch[1]) {
                clientName = forMatch[1].trim();
              } else if (proposal.isDemo) {
                clientName = 'Demo Proposal';
              }
            }
          }

          // Get session info using raw SQL
          const sessionResult = await db.execute(sql`
            SELECT session_purpose, workflow_state FROM advisory_sessions WHERE proposal_id = ${proposal.id} LIMIT 1
          `);
          const session = sessionResult.rows?.[0] as any;

          // Get share info using raw SQL
          const shareResult = await db.execute(sql`
            SELECT created_at, client_action FROM proposal_shares WHERE proposal_id = ${proposal.id} ORDER BY created_at DESC LIMIT 1
          `);
          const share = shareResult.rows?.[0] as any;

          return {
            ...proposal,
            clientName,
            sessionPurpose: session?.session_purpose,
            workflowState: session?.workflow_state || 'draft',
            suitabilityPassed: true,
            sharedAt: share?.created_at
          };
        })
      );
      
      // Combine both sources and sort by createdAt
      const allProposals = [...proposalsWithDetails, ...formattedWizardProposals];
      allProposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(allProposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  app.get("/api/agent/proposals/:proposalId/items", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      
      const items = await db
        .select()
        .from(investmentProposalItems)
        .where(eq(investmentProposalItems.proposalId, proposalId))
        .orderBy(investmentProposalItems.allocationPercentage);

      res.json(items);
    } catch (error) {
      console.error("Error fetching proposal items:", error);
      res.status(500).json({ error: "Failed to fetch proposal items" });
    }
  });

  app.post("/api/agent/proposals/:proposalId/notes", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { proposalId } = req.params;
      const { noteType, content, goalId, notePosition } = req.body;

      if (!noteType || !content) {
        return res.status(400).json({ error: "Note type and content are required" });
      }

      const validNoteTypes = ['introduction', 'explanation', 'goal_context', 'market_outlook', 'disclaimer_addition'];
      if (!validNoteTypes.includes(noteType)) {
        return res.status(400).json({ error: "Invalid note type" });
      }

      const [proposal] = await db
        .select()
        .from(investmentProposals)
        .where(and(
          eq(investmentProposals.id, proposalId),
          eq(investmentProposals.agentId, agentId)
        ))
        .limit(1);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const noteId = nanoid();

      const [note] = await db.insert(proposalNotes).values({
        id: noteId,
        proposalId,
        agentId,
        noteType,
        notePosition: notePosition || 'general',
        content,
        goalId,
        version: 1,
        isApproved: true
      }).returning();

      await logAgentAction({
        agentId,
        clientId: proposal.clientId,
        proposalId,
        actionCategory: 'proposal',
        actionType: 'note_added',
        actionDescription: `Added ${noteType} note to proposal`,
        newState: { noteType, noteId: note.id },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json(note);
    } catch (error) {
      console.error("Error adding proposal note:", error);
      res.status(500).json({ error: "Failed to add proposal note" });
    }
  });

  app.post("/api/agent/proposals/:proposalId/share", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { proposalId } = req.params;
      const { shareMethod } = req.body;

      if (!shareMethod) {
        return res.status(400).json({ error: "Share method is required" });
      }

      const validShareMethods = ['secure_link', 'pdf', 'email', 'whatsapp'];
      if (!validShareMethods.includes(shareMethod)) {
        return res.status(400).json({ error: "Invalid share method" });
      }

      const [proposal] = await db
        .select()
        .from(investmentProposals)
        .where(and(
          eq(investmentProposals.id, proposalId),
          eq(investmentProposals.agentId, agentId)
        ))
        .limit(1);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const shareToken = crypto.randomBytes(32).toString('hex');
      const shareTokenExpiresAt = new Date();
      shareTokenExpiresAt.setDate(shareTokenExpiresAt.getDate() + 7);

      const shareId = nanoid();

      const [share] = await db.insert(proposalShares).values({
        id: shareId,
        proposalId,
        agentId,
        clientId: proposal.clientId,
        shareMethod,
        shareToken,
        shareTokenExpiresAt,
        shareUrl: `/proposal/view/${shareToken}`,
        viewCount: 0
      }).returning();

      await db
        .update(investmentProposals)
        .set({ 
          status: 'pending_review',
          updatedAt: new Date()
        })
        .where(eq(investmentProposals.id, proposalId));

      await logAgentAction({
        agentId,
        clientId: proposal.clientId,
        proposalId,
        actionCategory: 'proposal',
        actionType: 'share',
        actionDescription: `Shared proposal via ${shareMethod}`,
        newState: { shareMethod, shareId: share.id },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({
        ...share,
        message: `Proposal shared successfully via ${shareMethod}`
      });
    } catch (error) {
      console.error("Error sharing proposal:", error);
      res.status(500).json({ error: "Failed to share proposal" });
    }
  });

  // Delete a proposal (supports both investment_proposals and prospect_proposals)
  app.delete("/api/agent/proposals/:proposalId", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { proposalId } = req.params;

      // First try to find in investment_proposals
      const [investmentProposal] = await db
        .select()
        .from(investmentProposals)
        .where(and(
          eq(investmentProposals.id, proposalId),
          eq(investmentProposals.agentId, agentId)
        ))
        .limit(1);

      if (investmentProposal) {
        // Delete related items first
        await db.delete(investmentProposalItems)
          .where(eq(investmentProposalItems.proposalId, proposalId));
        
        // Delete proposal shares
        await db.delete(proposalShares)
          .where(eq(proposalShares.proposalId, proposalId));
        
        // Delete the proposal
        await db.delete(investmentProposals)
          .where(eq(investmentProposals.id, proposalId));

        await logAgentAction({
          agentId,
          clientId: investmentProposal.clientId,
          proposalId,
          actionCategory: 'proposal',
          actionType: 'delete',
          actionDescription: `Deleted investment proposal`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.json({ success: true, message: "Proposal deleted successfully" });
      }

      // Try prospect_proposals table
      const prospectProposalResult = await db.execute(sql`
        SELECT id, agent_id FROM prospect_proposals 
        WHERE id = ${proposalId} AND agent_id = ${agentId}
        LIMIT 1
      `);

      if (prospectProposalResult.rows && prospectProposalResult.rows.length > 0) {
        // Delete prospect proposal events first
        await db.execute(sql`
          DELETE FROM prospect_proposal_events WHERE proposal_id = ${proposalId}
        `);
        
        // Delete the prospect proposal
        await db.execute(sql`
          DELETE FROM prospect_proposals WHERE id = ${proposalId} AND agent_id = ${agentId}
        `);

        return res.json({ success: true, message: "Proposal deleted successfully" });
      }

      return res.status(404).json({ error: "Proposal not found" });
    } catch (error) {
      console.error("Error deleting proposal:", error);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  });

  app.post("/api/proposal/view/:shareToken/action", async (req: Request, res: Response) => {
    try {
      const { shareToken } = req.params;
      const { action, clarificationNote } = req.body;

      if (!action) {
        return res.status(400).json({ error: "Action is required" });
      }

      const validActions = ['approve', 'reject', 'request_clarification'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      const [share] = await db
        .select()
        .from(proposalShares)
        .where(eq(proposalShares.shareToken, shareToken))
        .limit(1);

      if (!share) {
        return res.status(404).json({ error: "Proposal not found or link expired" });
      }

      if (share.shareTokenExpiresAt && new Date(share.shareTokenExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Share link has expired" });
      }

      if (share.clientAction) {
        return res.status(400).json({ error: "Action already taken on this proposal" });
      }

      const result = await ProposalOrchestrator.processClientAction(
        share.proposalId,
        action as 'approve' | 'reject' | 'request_clarification',
        clarificationNote
      );

      await db
        .update(proposalShares)
        .set({
          clientAction: action,
          clientActionTimestamp: new Date(),
          clientFeedback: action === 'request_clarification' ? clarificationNote : null
        })
        .where(eq(proposalShares.id, share.id));

      return res.json({
        success: result.success,
        action,
        newState: result.newState,
        message: result.message
      });
    } catch (error: any) {
      console.error("Error processing client action:", error);
      return res.status(400).json({ error: error.message || "Failed to process action" });
    }
  });

  app.get("/api/proposal/view/:shareToken", async (req: Request, res: Response) => {
    try {
      const { shareToken } = req.params;

      const [share] = await db
        .select()
        .from(proposalShares)
        .where(eq(proposalShares.shareToken, shareToken))
        .limit(1);

      if (!share) {
        return res.status(404).json({ error: "Proposal not found or link expired" });
      }

      if (share.shareTokenExpiresAt && new Date(share.shareTokenExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Share link has expired" });
      }

      const [proposal] = await db
        .select()
        .from(investmentProposals)
        .where(eq(investmentProposals.id, share.proposalId))
        .limit(1);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const proposalItems = await db
        .select()
        .from(investmentProposalItems)
        .where(eq(investmentProposalItems.proposalId, share.proposalId));

      await db
        .update(proposalShares)
        .set({ viewedAt: new Date() } as any)
        .where(and(
          eq(proposalShares.id, share.id),
          isNull(proposalShares.viewedAt)
        ));

      res.json({
        proposal: {
          id: proposal.id,
          title: proposal.title,
          description: proposal.description,
          totalInvestmentAmount: proposal.totalInvestmentAmount,
          riskProfile: proposal.riskProfile,
          timeHorizon: proposal.timeHorizon,
          expectedReturns: proposal.expectedReturns,
          status: proposal.status,
          createdAt: proposal.createdAt
        },
        items: proposalItems.map(item => ({
          productName: item.productName,
          productType: item.productType,
          category: item.category,
          allocationPercentage: item.allocationPercentage,
          recommendedAmount: item.recommendedAmount,
          rationale: item.rationale,
          riskRating: item.riskRating
        })),
        share: {
          sharedAt: share.createdAt,
          expiresAt: share.shareTokenExpiresAt,
          clientAction: share.clientAction
        }
      });
    } catch (error) {
      console.error("Error fetching proposal for client:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  app.get("/api/agent/compliance-audit", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { startDate, endDate, actionCategory, limit = 100 } = req.query;

      let conditions = [eq(agentComplianceAuditLogs.agentId, agentId)];
      
      if (actionCategory) {
        conditions.push(eq(agentComplianceAuditLogs.actionCategory, actionCategory as string));
      }

      const logs = await db
        .select()
        .from(agentComplianceAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(agentComplianceAuditLogs.timestamp))
        .limit(Number(limit));

      res.json(logs);
    } catch (error) {
      console.error("Error fetching compliance audit logs:", error);
      res.status(500).json({ error: "Failed to fetch compliance audit logs" });
    }
  });

  app.post("/api/agent/advisory-sessions/:sessionId/suitability-check", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { sessionId } = req.params;

      const result = await ProposalOrchestrator.runSuitabilityCheck(sessionId, agentId);

      await logAgentAction({
        agentId,
        sessionId,
        actionCategory: 'compliance',
        actionType: 'suitability_check',
        actionDescription: `Suitability check ${result.passed ? 'passed' : 'failed'} with score ${result.score}`,
        newState: { passed: result.passed, score: result.score },
        suitabilityPassed: result.passed,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error running suitability check:", error);
      res.status(500).json({ error: error.message || "Failed to run suitability check" });
    }
  });

  app.post("/api/agent/advisory-sessions/:sessionId/optimize", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { sessionId } = req.params;

      const result = await ProposalOrchestrator.runOptimization(sessionId, agentId);

      await logAgentAction({
        agentId,
        sessionId,
        actionCategory: 'proposal',
        actionType: 'optimization',
        actionDescription: `Generated optimized allocation with expected return ${result.expectedReturn}%`,
        newState: { allocationsCount: result.allocations.length, totalAmount: result.totalAmount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error running optimization:", error);
      res.status(500).json({ error: error.message || "Failed to run optimization" });
    }
  });

  app.get("/api/agent/advisory-sessions/:sessionId/status", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const status = await ProposalOrchestrator.getWorkflowStatus(sessionId);

      if (!status) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json(status);
    } catch (error) {
      console.error("Error getting workflow status:", error);
      res.status(500).json({ error: "Failed to get workflow status" });
    }
  });

}
