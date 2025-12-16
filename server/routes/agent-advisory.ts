import { Express, Request, Response, NextFunction } from 'express';
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

const requireAgent = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const userRoles = (req.user as any).roles || [];
  if (!userRoles.includes('agent') && !userRoles.includes('admin') && !userRoles.includes('superadmin')) {
    return res.status(403).json({ error: "Agent access required" });
  }
  next();
};

export function registerAgentAdvisoryRoutes(app: Express) {
  
  app.get("/api/agent/clients", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      const clients = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          mobile: users.mobile,
          kycStatus: sql<string>`COALESCE(${users.kycStatus}, 'pending')`,
          riskProfile: sql<string>`COALESCE(${users.riskCategory}, 'moderate')`,
          createdAt: users.createdAt,
          relationshipType: clientAgentRelationships.relationshipType,
          relationshipStatus: clientAgentRelationships.status
        })
        .from(clientAgentRelationships)
        .innerJoin(users, eq(users.id, clientAgentRelationships.clientId))
        .where(and(
          eq(clientAgentRelationships.agentId, agentId),
          eq(clientAgentRelationships.status, 'active')
        ))
        .orderBy(desc(users.createdAt))
        .limit(100);

      await logAgentAction({
        agentId,
        actionCategory: 'view',
        actionType: 'client_list',
        actionDescription: `Viewed ${clients.length} assigned clients`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json(clients);
    } catch (error) {
      console.error("Error fetching agent clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/agent/portfolio-uploads/pending", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      const pendingUploads = await db
        .select({
          id: portfolioUploads.id,
          clientId: portfolioUploads.clientId,
          clientName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          uploadType: portfolioUploads.uploadType,
          sourceFormat: portfolioUploads.sourceFormat,
          uploadStatus: portfolioUploads.uploadStatus,
          clientConfirmed: portfolioUploads.clientConfirmed,
          otpSentAt: portfolioUploads.otpSentAt,
          createdAt: portfolioUploads.createdAt
        })
        .from(portfolioUploads)
        .innerJoin(users, eq(users.id, portfolioUploads.clientId))
        .where(and(
          eq(portfolioUploads.agentId, agentId),
          or(
            eq(portfolioUploads.uploadStatus, 'pending_confirmation'),
            eq(portfolioUploads.uploadStatus, 'pending_otp')
          )
        ))
        .orderBy(desc(portfolioUploads.createdAt))
        .limit(50);

      res.json(pendingUploads);
    } catch (error) {
      console.error("Error fetching pending portfolio uploads:", error);
      res.status(500).json({ error: "Failed to fetch pending uploads" });
    }
  });

  app.post("/api/agent/portfolio-upload", requireAgent, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const clientId = req.body.clientId;
      const uploadType = req.body.uploadType;
      const sourceFormat = req.body.sourceFormat;
      const file = req.file;

      if (!clientId || !uploadType) {
        return res.status(400).json({ error: "Client ID and upload type are required" });
      }

      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, clientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      const uploadId = nanoid();
      const [uploadRecord] = await db.insert(portfolioUploads).values({
        id: uploadId,
        agentId,
        clientId,
        uploadType,
        sourceFormat: sourceFormat || (file ? file.mimetype : 'manual'),
        fileName: file?.originalname || 'manual_entry',
        fileSize: file?.size?.toString(),
        rawData: file ? { hasFile: true, fileName: file.originalname, size: file.size } : {},
        uploadStatus: 'pending_otp',
        clientConfirmed: false,
        otpCode: otp,
        otpExpiry,
        otpSentAt: new Date()
      }).returning();

      console.log(`[Portfolio Upload] OTP for client ${clientId}: ${otp} (expires: ${otpExpiry})`);

      await logAgentAction({
        agentId,
        clientId,
        actionCategory: 'portfolio',
        actionType: 'upload_initiated',
        actionDescription: `Initiated portfolio upload (${uploadType}${file ? `, file: ${file.originalname}` : ''}) - awaiting client OTP confirmation`,
        newState: { uploadId, uploadType, status: 'pending_otp', hasFile: !!file },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({
        id: uploadRecord.id,
        status: 'pending_otp',
        message: 'OTP sent to client for confirmation'
      });
    } catch (error) {
      console.error("Error creating portfolio upload:", error);
      res.status(500).json({ error: "Failed to create portfolio upload" });
    }
  });

  app.post("/api/agent/portfolio-upload/:uploadId/confirm-otp", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { uploadId } = req.params;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ error: "OTP is required" });
      }

      const [upload] = await db
        .select()
        .from(portfolioUploads)
        .where(and(
          eq(portfolioUploads.id, uploadId),
          eq(portfolioUploads.agentId, agentId)
        ))
        .limit(1);

      if (!upload) {
        return res.status(404).json({ error: "Upload not found" });
      }

      if (upload.clientConfirmed) {
        return res.status(400).json({ error: "Upload already confirmed" });
      }

      if (upload.otpCode !== otp) {
        await logAgentAction({
          agentId,
          clientId: upload.clientId,
          actionCategory: 'portfolio',
          actionType: 'otp_failed',
          actionDescription: `OTP verification failed for upload ${uploadId}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
        return res.status(400).json({ error: "Invalid OTP" });
      }

      if (upload.otpExpiry && new Date(upload.otpExpiry) < new Date()) {
        return res.status(400).json({ error: "OTP expired" });
      }

      const [updatedUpload] = await db
        .update(portfolioUploads)
        .set({
          clientConfirmed: true,
          clientConfirmedAt: new Date(),
          uploadStatus: 'confirmed',
          updatedAt: new Date()
        })
        .where(eq(portfolioUploads.id, uploadId))
        .returning();

      await logAgentAction({
        agentId,
        clientId: upload.clientId,
        actionCategory: 'portfolio',
        actionType: 'otp_confirmed',
        actionDescription: `Client confirmed portfolio upload via OTP`,
        previousState: { status: 'pending_otp' },
        newState: { status: 'confirmed', confirmedAt: updatedUpload.clientConfirmedAt },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        id: updatedUpload.id,
        status: 'confirmed',
        message: 'Portfolio upload confirmed by client'
      });
    } catch (error) {
      console.error("Error confirming portfolio upload:", error);
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });

  app.get("/api/agent/advisory-sessions", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const clientId = req.query.clientId as string | undefined;
      
      let conditions = [eq(advisorySessions.agentId, agentId)];
      if (clientId) {
        conditions.push(eq(advisorySessions.clientId, clientId));
      }

      const sessions = await db
        .select()
        .from(advisorySessions)
        .where(and(...conditions))
        .orderBy(desc(advisorySessions.createdAt))
        .limit(50);

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching advisory sessions:", error);
      res.status(500).json({ error: "Failed to fetch advisory sessions" });
    }
  });

  app.post("/api/agent/advisory-sessions", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { clientId, sessionPurpose, investmentAmount } = req.body;

      if (!clientId || !sessionPurpose) {
        return res.status(400).json({ error: "Client ID and session purpose are required" });
      }

      const validPurposes = ['fresh_investment', 'rebalancing', 'goal_review', 'retirement_review', 'corporate_treasury'];
      if (!validPurposes.includes(sessionPurpose)) {
        return res.status(400).json({ error: "Invalid session purpose" });
      }

      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, clientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const sessionId = nanoid();
      
      const [session] = await db.insert(advisorySessions).values({
        id: sessionId,
        agentId,
        clientId,
        sessionPurpose,
        sessionType: 'advisory',
        workflowState: 'purpose_selection',
        investmentAmount: investmentAmount ? String(investmentAmount) : null,
        agentDeclarationAcknowledged: false,
        isActive: true
      }).returning();

      await logAgentAction({
        agentId,
        clientId,
        sessionId: session.id,
        actionCategory: 'session',
        actionType: 'create',
        actionDescription: `Started advisory session: ${sessionPurpose}`,
        newState: { sessionPurpose, workflowState: 'purpose_selection' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating advisory session:", error);
      res.status(500).json({ error: "Failed to create advisory session" });
    }
  });

  app.patch("/api/agent/advisory-sessions/:sessionId/workflow", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { sessionId } = req.params;
      const { workflowState, agentDeclarationAcknowledged } = req.body;

      const [existingSession] = await db
        .select()
        .from(advisorySessions)
        .where(and(
          eq(advisorySessions.id, sessionId),
          eq(advisorySessions.agentId, agentId)
        ))
        .limit(1);

      if (!existingSession) {
        return res.status(404).json({ error: "Session not found" });
      }

      const systemOnlyTransitions = ['optimization', 'draft_review', 'execution', 'completed'];
      if (systemOnlyTransitions.includes(workflowState)) {
        return res.status(403).json({ 
          error: `Transition to '${workflowState}' is system-controlled. Use the orchestrator API endpoints.`,
          hint: workflowState === 'optimization' 
            ? 'Use POST /api/agent/advisory-sessions/:sessionId/suitability-check'
            : workflowState === 'draft_review'
            ? 'Use POST /api/agent/advisory-sessions/:sessionId/optimize'
            : 'Client must approve the proposal first'
        });
      }

      const allowedAgentTransitions: Record<string, string[]> = {
        'purpose_selection': ['suitability_check', 'cancelled'],
        'suitability_check': ['cancelled'],
        'optimization': ['cancelled'],
        'draft_review': ['client_sharing', 'cancelled'],
        'client_sharing': ['cancelled'],
        'client_action': ['cancelled'],
        'execution': [],
        'completed': [],
        'cancelled': []
      };

      const currentState = existingSession.workflowState;
      const allowedStates = allowedAgentTransitions[currentState] || [];
      
      if (!allowedStates.includes(workflowState)) {
        return res.status(400).json({ 
          error: `Cannot transition from '${currentState}' to '${workflowState}'`,
          allowedTransitions: allowedStates
        });
      }

      if (workflowState === 'suitability_check' && !agentDeclarationAcknowledged && !existingSession.agentDeclarationAcknowledged) {
        return res.status(400).json({ error: "Agent must acknowledge declaration before proceeding to suitability check" });
      }

      if (workflowState === 'client_sharing' && !existingSession.optimizationCompleted) {
        return res.status(400).json({ error: "Optimization must be completed before sharing with client" });
      }

      const updateData: any = {
        workflowState,
        workflowStateUpdatedAt: new Date(),
        updatedAt: new Date()
      };

      if (agentDeclarationAcknowledged !== undefined) {
        updateData.agentDeclarationAcknowledged = agentDeclarationAcknowledged;
        if (agentDeclarationAcknowledged) {
          updateData.agentDeclarationTimestamp = new Date();
        }
      }

      if (workflowState === 'cancelled') {
        updateData.cancelledAt = new Date();
        updateData.isActive = false;
      }

      const [updatedSession] = await db
        .update(advisorySessions)
        .set(updateData)
        .where(eq(advisorySessions.id, sessionId))
        .returning();

      await logAgentAction({
        agentId,
        clientId: existingSession.clientId,
        sessionId,
        actionCategory: 'session',
        actionType: 'workflow_transition',
        actionDescription: `Workflow transition: ${currentState} → ${workflowState}`,
        previousState: { workflowState: currentState },
        newState: { workflowState },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating advisory session:", error);
      res.status(500).json({ error: "Failed to update advisory session" });
    }
  });

  app.get("/api/agent/proposals", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      const proposals = await db
        .select({
          id: investmentProposals.id,
          clientId: investmentProposals.clientId,
          status: investmentProposals.status,
          investmentAmount: investmentProposals.totalInvestmentAmount,
          createdAt: investmentProposals.createdAt,
          updatedAt: investmentProposals.updatedAt,
          expiresAt: investmentProposals.validUntil
        })
        .from(investmentProposals)
        .where(eq(investmentProposals.agentId, agentId))
        .orderBy(desc(investmentProposals.createdAt))
        .limit(100);

      const proposalsWithDetails = await Promise.all(
        proposals.map(async (proposal: any) => {
          const [client] = await db
            .select({ firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, proposal.clientId))
            .limit(1);

          const [session] = await db
            .select({ sessionPurpose: advisorySessions.sessionPurpose, workflowState: advisorySessions.workflowState })
            .from(advisorySessions)
            .where(eq(advisorySessions.proposalId, proposal.id))
            .limit(1);

          const [share] = await db
            .select({ sharedAt: proposalShares.createdAt, clientAction: proposalShares.clientAction })
            .from(proposalShares)
            .where(eq(proposalShares.proposalId, proposal.id))
            .orderBy(desc(proposalShares.createdAt))
            .limit(1);

          return {
            ...proposal,
            clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown',
            sessionPurpose: session?.sessionPurpose,
            workflowState: session?.workflowState || 'draft',
            suitabilityPassed: true,
            sharedAt: share?.sharedAt
          };
        })
      );

      res.json(proposalsWithDetails);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  app.get("/api/agent/proposals/:proposalId/items", requireAgent, async (req: Request, res: Response) => {
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

  app.post("/api/agent/proposals/:proposalId/notes", requireAgent, async (req: Request, res: Response) => {
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

  app.post("/api/agent/proposals/:proposalId/share", requireAgent, async (req: Request, res: Response) => {
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
          clientActionAt: new Date(),
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
        .set({ viewedAt: new Date() })
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

  app.get("/api/agent/compliance-audit", requireAgent, async (req: Request, res: Response) => {
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

  app.post("/api/agent/advisory-sessions/:sessionId/suitability-check", requireAgent, async (req: Request, res: Response) => {
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

  app.post("/api/agent/advisory-sessions/:sessionId/optimize", requireAgent, async (req: Request, res: Response) => {
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

  app.get("/api/agent/advisory-sessions/:sessionId/status", requireAgent, async (req: Request, res: Response) => {
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

  app.post("/api/agent/advisory-sessions/:sessionId/validate-transition", requireAgent, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { targetState } = req.body;

      if (!targetState) {
        return res.status(400).json({ error: "Target state is required" });
      }

      const validation = await ProposalOrchestrator.validateWorkflowTransition(sessionId, targetState);

      res.json(validation);
    } catch (error) {
      console.error("Error validating transition:", error);
      res.status(500).json({ error: "Failed to validate transition" });
    }
  });

  app.get("/api/agent/treasury/clients", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      const treasuryClients = await db.execute(sql`
        SELECT 
          u.id,
          CONCAT(u.first_name, ' ', u.last_name) as name,
          tm.entity_name as "entityName",
          tm.total_cash_available as "totalCorpus",
          tm.cash_deployed as "cashDeployed",
          tm.status,
          tm.maker_checker_enabled as "makerCheckerEnabled",
          tm.id as "mandateId"
        FROM client_agent_relationships car
        INNER JOIN users u ON u.id = car.client_id
        INNER JOIN treasury_mandates tm ON tm.user_id = u.id
        WHERE car.agent_id = ${agentId}
          AND car.status = 'active'
          AND tm.status = 'active'
        ORDER BY tm.created_at DESC
      `);

      res.json(treasuryClients.rows || []);
    } catch (error) {
      console.error("Error fetching treasury clients:", error);
      res.status(500).json({ error: "Failed to fetch treasury clients" });
    }
  });

  app.get("/api/agent/treasury/proposals", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      const proposals = await db.execute(sql`
        SELECT 
          tp.id,
          tp.proposal_number as "proposalNumber",
          tp.proposal_type as "proposalType",
          tm.entity_name as "entityName",
          tp.current_idle_cash as "currentIdleCash",
          tp.expected_total_yield as "expectedTotalYield",
          tp.status,
          tp.maker_user_id as "makerUserId",
          tp.checker_user_id as "checkerUserId",
          tp.maker_approved_at as "makerApprovedAt",
          tp.checker_approved_at as "checkerApprovedAt",
          tp.created_at as "createdAt",
          tp.valid_until as "validUntil",
          tp.recommended_allocation as "recommendedAllocation"
        FROM treasury_proposals tp
        INNER JOIN treasury_mandates tm ON tm.id = tp.mandate_id
        INNER JOIN client_agent_relationships car ON car.client_id = tm.user_id
        WHERE car.agent_id = ${agentId}
          AND car.status = 'active'
        ORDER BY tp.created_at DESC
      `);

      res.json(proposals.rows || []);
    } catch (error) {
      console.error("Error fetching treasury proposals:", error);
      res.status(500).json({ error: "Failed to fetch treasury proposals" });
    }
  });

  app.post("/api/agent/treasury/proposals/generate", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { mandateId, proposalType } = req.body;

      if (!mandateId) {
        return res.status(400).json({ error: "Mandate ID is required" });
      }

      const proposalId = nanoid();
      const proposalNumber = `TP-${Date.now().toString(36).toUpperCase()}`;

      const [mandate] = await db.execute(sql`
        SELECT * FROM treasury_mandates WHERE id = ${mandateId}
      `).then(r => r.rows as any[]);

      if (!mandate) {
        return res.status(404).json({ error: "Treasury mandate not found" });
      }

      const totalCash = parseFloat(mandate.total_cash_available) || 0;
      const maxDuration = mandate.max_duration_days || 365;
      const maxCredit = mandate.max_credit_risk || 'AAA';
      const makerCheckerEnabled = mandate.maker_checker_enabled !== false;

      const recommendedAllocation = [
        {
          bucket: "operating_cash",
          instrument: "overnight_fund",
          instrumentName: "Overnight Liquid Fund",
          amount: Math.round(totalCash * 0.15),
          expectedYield: 4.5,
          maturityDays: 1,
          creditRating: "AAA"
        },
        {
          bucket: "liquidity_buffer",
          instrument: "liquid_fund",
          instrumentName: "Liquid Debt Fund",
          amount: Math.round(totalCash * 0.25),
          expectedYield: 5.2,
          maturityDays: 7,
          creditRating: "AAA"
        },
        {
          bucket: "short_term_parking",
          instrument: "ultra_short_term_fund",
          instrumentName: "Ultra Short Term Bond Fund",
          amount: Math.round(totalCash * 0.35),
          expectedYield: 6.1,
          maturityDays: Math.min(90, maxDuration),
          creditRating: "AA+"
        },
        {
          bucket: "yield_accrual",
          instrument: "corporate_bond_fund",
          instrumentName: "Corporate Bond Fund",
          amount: Math.round(totalCash * 0.25),
          expectedYield: 7.5,
          maturityDays: Math.min(365, maxDuration),
          creditRating: maxCredit === 'AAA' ? 'AAA' : 'AA'
        }
      ];

      const expectedTotalYield = recommendedAllocation.reduce((sum, a) => 
        sum + (a.expectedYield * a.amount / totalCash), 0
      ).toFixed(2);

      const initialStatus = makerCheckerEnabled ? 'pending_maker' : 'pending_approval';

      await db.execute(sql`
        INSERT INTO treasury_proposals (
          id, mandate_id, proposal_number, proposal_type,
          current_idle_cash, recommended_allocation, expected_total_yield,
          status, maker_user_id, valid_until, created_at, updated_at
        ) VALUES (
          ${proposalId}, ${mandateId}, ${proposalNumber}, ${proposalType || 'initial_deployment'},
          ${totalCash.toString()}, ${JSON.stringify(recommendedAllocation)}::jsonb, ${expectedTotalYield},
          ${initialStatus}, ${agentId}, ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}, NOW(), NOW()
        )
      `);

      await logAgentAction({
        agentId,
        clientId: mandate.user_id,
        actionCategory: 'treasury',
        actionType: 'proposal_generated',
        actionDescription: `Generated treasury proposal ${proposalNumber} for ${mandate.entity_name}`,
        newState: { proposalId, proposalNumber, totalCash, expectedTotalYield, makerCheckerEnabled }
      });

      res.json({
        success: true,
        proposalId,
        proposalNumber,
        makerCheckerEnabled,
        message: makerCheckerEnabled 
          ? "Treasury proposal generated and awaiting maker approval"
          : "Treasury proposal generated and awaiting approval"
      });
    } catch (error) {
      console.error("Error generating treasury proposal:", error);
      res.status(500).json({ error: "Failed to generate treasury proposal" });
    }
  });

  app.post("/api/agent/treasury/proposals/:proposalId/maker-action", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { proposalId } = req.params;
      const { action, reason } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Valid action (approve/reject) is required" });
      }

      const [proposal] = await db.execute(sql`
        SELECT * FROM treasury_proposals WHERE id = ${proposalId}
      `).then(r => r.rows as any[]);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      if (proposal.status !== 'pending_maker') {
        return res.status(400).json({ error: "Proposal is not pending maker approval" });
      }

      if (action === 'approve') {
        await db.execute(sql`
          UPDATE treasury_proposals 
          SET status = 'pending_checker',
              maker_user_id = ${agentId},
              maker_approved_at = NOW(),
              updated_at = NOW()
          WHERE id = ${proposalId}
        `);
      } else {
        await db.execute(sql`
          UPDATE treasury_proposals 
          SET status = 'rejected',
              rejection_reason = ${reason || 'Rejected by maker'},
              updated_at = NOW()
          WHERE id = ${proposalId}
        `);
      }

      await logAgentAction({
        agentId,
        actionCategory: 'treasury',
        actionType: `maker_${action}`,
        actionDescription: `Maker ${action}ed proposal ${proposal.proposal_number}${reason ? `: ${reason}` : ''}`,
        previousState: { status: proposal.status },
        newState: { status: action === 'approve' ? 'pending_checker' : 'rejected' }
      });

      res.json({
        success: true,
        message: action === 'approve' 
          ? "Proposal approved by maker. Awaiting checker approval."
          : "Proposal rejected by maker."
      });
    } catch (error) {
      console.error("Error processing maker action:", error);
      res.status(500).json({ error: "Failed to process maker action" });
    }
  });

  app.post("/api/agent/treasury/proposals/:proposalId/single-approval", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { proposalId } = req.params;
      const { action, reason } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Valid action (approve/reject) is required" });
      }

      const [proposal] = await db.execute(sql`
        SELECT tp.*, tm.entity_name, tm.user_id as client_id, tm.maker_checker_enabled
        FROM treasury_proposals tp
        INNER JOIN treasury_mandates tm ON tm.id = tp.mandate_id
        WHERE tp.id = ${proposalId}
      `).then(r => r.rows as any[]);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const makerCheckerDisabled = proposal.maker_checker_enabled === false;
      if (!makerCheckerDisabled) {
        await logAgentAction({
          agentId,
          actionCategory: 'treasury',
          actionType: 'single_approval_blocked',
          actionDescription: `Blocked single approval attempt for ${proposal.proposal_number} - mandate requires maker-checker`,
          previousState: { makerCheckerEnabled: proposal.maker_checker_enabled },
          newState: { blocked: true, reason: 'maker_checker_required' }
        });
        return res.status(400).json({ 
          error: "This mandate requires maker-checker approval. Use maker/checker endpoints.",
          requiresMakerChecker: true
        });
      }

      if (proposal.status !== 'pending_approval') {
        return res.status(400).json({ error: "Proposal is not pending approval" });
      }

      if (action === 'approve') {
        await db.execute(sql`
          UPDATE treasury_proposals 
          SET status = 'approved',
              maker_user_id = ${agentId},
              maker_approved_at = NOW(),
              executed_at = NOW(),
              execution_details = ${JSON.stringify({ executedBy: agentId, executedAt: new Date().toISOString(), singleApproval: true })}::jsonb,
              updated_at = NOW()
          WHERE id = ${proposalId}
        `);

        await db.execute(sql`
          UPDATE treasury_mandates 
          SET cash_deployed = total_cash_available,
              updated_at = NOW()
          WHERE id = ${proposal.mandate_id}
        `);
      } else {
        await db.execute(sql`
          UPDATE treasury_proposals 
          SET status = 'rejected',
              rejection_reason = ${reason || 'Rejected'},
              updated_at = NOW()
          WHERE id = ${proposalId}
        `);
      }

      await logAgentAction({
        agentId,
        clientId: proposal.client_id,
        actionCategory: 'treasury',
        actionType: `single_approval_${action}`,
        actionDescription: `Single approval ${action}ed proposal ${proposal.proposal_number} for ${proposal.entity_name}${reason ? `: ${reason}` : ''}`,
        previousState: { status: proposal.status },
        newState: { 
          status: action === 'approve' ? 'approved' : 'rejected',
          executed: action === 'approve'
        }
      });

      res.json({
        success: true,
        message: action === 'approve' 
          ? "Proposal approved and executed. Treasury allocation is now active."
          : "Proposal rejected."
      });
    } catch (error) {
      console.error("Error processing single approval:", error);
      res.status(500).json({ error: "Failed to process approval" });
    }
  });

  app.post("/api/agent/treasury/proposals/:proposalId/checker-action", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { proposalId } = req.params;
      const { action, reason } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Valid action (approve/reject) is required" });
      }

      const [proposal] = await db.execute(sql`
        SELECT tp.*, tm.entity_name, tm.user_id as client_id
        FROM treasury_proposals tp
        INNER JOIN treasury_mandates tm ON tm.id = tp.mandate_id
        WHERE tp.id = ${proposalId}
      `).then(r => r.rows as any[]);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      if (proposal.status !== 'pending_checker') {
        return res.status(400).json({ error: "Proposal is not pending checker approval" });
      }

      if (proposal.maker_user_id === agentId) {
        return res.status(400).json({ error: "Checker cannot be the same as maker for maker-checker workflow" });
      }

      if (action === 'approve') {
        await db.execute(sql`
          UPDATE treasury_proposals 
          SET status = 'approved',
              checker_user_id = ${agentId},
              checker_approved_at = NOW(),
              executed_at = NOW(),
              execution_details = ${JSON.stringify({ executedBy: agentId, executedAt: new Date().toISOString() })}::jsonb,
              updated_at = NOW()
          WHERE id = ${proposalId}
        `);

        await db.execute(sql`
          UPDATE treasury_mandates 
          SET cash_deployed = total_cash_available,
              updated_at = NOW()
          WHERE id = ${proposal.mandate_id}
        `);
      } else {
        await db.execute(sql`
          UPDATE treasury_proposals 
          SET status = 'rejected',
              checker_user_id = ${agentId},
              rejection_reason = ${reason || 'Rejected by checker'},
              updated_at = NOW()
          WHERE id = ${proposalId}
        `);
      }

      await logAgentAction({
        agentId,
        clientId: proposal.client_id,
        actionCategory: 'treasury',
        actionType: `checker_${action}`,
        actionDescription: `Checker ${action}ed proposal ${proposal.proposal_number} for ${proposal.entity_name}${reason ? `: ${reason}` : ''}`,
        previousState: { status: proposal.status },
        newState: { 
          status: action === 'approve' ? 'approved' : 'rejected',
          executed: action === 'approve'
        }
      });

      res.json({
        success: true,
        message: action === 'approve' 
          ? "Proposal approved and executed. Treasury allocation is now active."
          : "Proposal rejected by checker."
      });
    } catch (error) {
      console.error("Error processing checker action:", error);
      res.status(500).json({ error: "Failed to process checker action" });
    }
  });

  console.log("✅ Agent Advisory routes registered");
}

async function logAgentAction(data: {
  agentId: string;
  clientId?: string | null;
  sessionId?: string | null;
  proposalId?: string | null;
  actionCategory: string;
  actionType: string;
  actionDescription: string;
  previousState?: any;
  newState?: any;
  suitabilityCheckId?: string;
  suitabilityPassed?: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const retentionEndDate = new Date();
    retentionEndDate.setFullYear(retentionEndDate.getFullYear() + 8);

    await db.insert(agentComplianceAuditLogs).values({
      id: nanoid(),
      agentId: data.agentId,
      clientId: data.clientId,
      sessionId: data.sessionId,
      proposalId: data.proposalId,
      actionCategory: data.actionCategory,
      actionType: data.actionType,
      actionDescription: data.actionDescription,
      previousState: data.previousState,
      newState: data.newState,
      suitabilityCheckId: data.suitabilityCheckId,
      suitabilityPassed: data.suitabilityPassed,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      retentionEndDate,
      isArchived: false
    });
  } catch (error) {
    console.error("Error logging agent action:", error);
  }
}
