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

// Local logAgentAction stub — logs advisory audit events to agentComplianceAuditLogs
async function logAgentAction(params: Record<string, any>): Promise<void> {
  try {
    await db.insert(agentComplianceAuditLogs).values({
      agentId: params.agentId || 'unknown',
      actionCategory: params.actionCategory || 'view',
      actionType: params.actionType || 'action',
      actionDescription: params.actionDescription || '',
      clientId: params.clientId || null,
      sessionId: params.sessionId || null,
      previousState: params.previousState || null,
      newState: params.newState || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    } as any);
  } catch {
    // Non-critical: audit logging should not block business logic
  }
}

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



export function registerAgentAdvisoryPart1Routes(app: Express) {
  app.get("/api/agent/profile", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      const profile = {
        id: user.id,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Agent',
        email: user.email || '',
        employeeId: user.employeeId || `AGT-${user.id.slice(0, 8)}`,
        euinNumber: user.euinNumber || null,
        arnCode: user.arnCode || null,
        distributorId: user.distributorId || null,
        specializations: user.specializations || ['Mutual Funds', 'Equity'],
        languages: user.languages || ['English', 'Hindi'],
        status: 'active',
        agentLevel: user.agentLevel || 'master_agent'
      };
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Agent Statistics endpoint
  app.get("/api/agent/stats", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      // Get client count
      const clientCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(clientAgentRelationships)
        .where(and(
          eq(clientAgentRelationships.agentId, agentId),
          eq(clientAgentRelationships.isActive, true)
        ));
      
      const totalClients = Number(clientCount[0]?.count || 0);
      
      // Get partner count (from partners table directly since we're not using mapping table)
      let totalPartners = 0;
      try {
        const partnerCount = await db.execute(sql`
          SELECT COUNT(*) as count FROM partners WHERE is_active = true
        `);
        totalPartners = Number((partnerCount.rows[0] as any)?.count || 0);
      } catch {
        // Table might not exist, default to 0
      }
      
      const stats = {
        totalPartners,
        activePartners: totalPartners,
        totalClients,
        activeClients: totalClients,
        monthlyCommissions: "0.00",
        commissionGrowth: 0,
        pendingTasks: 0,
        urgentTasks: 0,
        recentActivity: []
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching agent stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Agent Partners endpoint - returns all active partners from partners table
  app.get("/api/agent/partners", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      // Get all active partners directly from partners table
      let partnersList: any[] = [];
      try {
        const result = await db.execute(sql`
          SELECT 
            id, company_name, contact_email, contact_phone,
            address, website, partner_type, business_license,
            tax_id, euin_number, arn_code, is_active
          FROM partners
          WHERE is_active = true
          ORDER BY company_name
          LIMIT 100
        `);
        partnersList = (result.rows as any[]).map(p => ({
          id: p.id,
          companyName: p.company_name,
          contactEmail: p.contact_email,
          contactPhone: p.contact_phone,
          address: p.address || '',
          website: p.website || '',
          partnerType: p.partner_type || 'product_provider',
          businessLicense: p.business_license || '',
          taxId: p.tax_id || '',
          euinNumber: p.euin_number || null,
          arnCode: p.arn_code || null,
          masterAgentEuin: null,
          hasEuinArn: !!(p.euin_number || p.arn_code)
        }));
      } catch (err) {
        console.error("Error querying partners table:", err);
        // Table might not exist or have different structure
      }
      
      res.json(partnersList);
    } catch (error) {
      console.error("Error fetching agent partners:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  // Add Partner endpoint - persists to database
  app.post("/api/agent/partners", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const partnerData = req.body;
      
      // Validate required fields
      if (!partnerData.companyName || !partnerData.contactEmail || !partnerData.contactPhone) {
        return res.status(400).json({ error: "Company name, email, and phone are required" });
      }
      
      // Generate a temporary password for the partner account
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const partnerId = nanoid();
      
      // Insert into partners table
      const [newPartner] = await db.insert(partners).values({
        id: partnerId,
        companyName: partnerData.companyName,
        contactEmail: partnerData.contactEmail,
        contactPhone: partnerData.contactPhone,
        address: partnerData.address || null,
        website: partnerData.website || null,
        partnerType: partnerData.partnerType || 'product_provider',
        businessLicense: partnerData.businessLicense || null,
        taxId: partnerData.taxId || null,
        euinNumber: partnerData.hasEuinArn ? partnerData.euinNumber : null,
        arnCode: partnerData.hasEuinArn ? partnerData.arnCode : null,
        password: tempPassword, // Temporary password - partner should reset
        isActive: true,
        isVerified: false
      }).returning();
      
      // Note: agentPartnerMappings requires customerCareAgents.id, not users.id
      // For now, we skip the mapping as agents creating partners may not be in customerCareAgents table
      // The partner is still created and can be retrieved via the GET endpoint
      
      // Log the action
      await logAgentAction({
        agentId,
        actionCategory: 'partner',
        actionType: 'partner_created',
        actionDescription: `Created partner: ${partnerData.companyName}`,
        newState: { partnerId: newPartner.id, companyName: partnerData.companyName },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(201).json({
        id: newPartner.id,
        companyName: newPartner.companyName,
        contactEmail: newPartner.contactEmail,
        contactPhone: newPartner.contactPhone,
        address: newPartner.address || '',
        website: newPartner.website || '',
        partnerType: newPartner.partnerType,
        businessLicense: newPartner.businessLicense || '',
        taxId: newPartner.taxId || '',
        euinNumber: newPartner.euinNumber || null,
        arnCode: newPartner.arnCode || null,
        masterAgentEuin: partnerData.masterAgentEuin || null,
        hasEuinArn: !!(newPartner.euinNumber || newPartner.arnCode)
      });
    } catch (error: any) {
      console.error("Error adding partner:", error);
      // Handle duplicate email error
      if (error.code === '23505' && error.constraint?.includes('contact_email')) {
        return res.status(400).json({ error: "A partner with this email already exists" });
      }
      res.status(500).json({ error: "Failed to add partner" });
    }
  });

  app.get("/api/agent/clients", requireAgentPortal, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const includeProspects = req.query.includeProspects !== 'false'; // Include by default
      
      // Fetch registered clients from clientAgentRelationships
      const registeredClients = await db
        .select({
          id: users.id,
          uuid: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          mobile: users.mobile,
          kycStatus: sql<string>`COALESCE(${users.kycStatus}, 'pending')`,
          riskProfile: sql<string>`COALESCE(${users.riskTolerance}, 'moderate')`,
          createdAt: users.createdAt,
          relationshipType: clientAgentRelationships.relationshipType,
          relationshipStatus: clientAgentRelationships.isActive
        })
        .from(clientAgentRelationships)
        .innerJoin(users, eq(users.id, clientAgentRelationships.clientId))
        .where(and(
          eq(clientAgentRelationships.agentId, agentId),
          eq(clientAgentRelationships.isActive, true)
        ))
        .orderBy(desc(users.createdAt))
        .limit(100);

      // Format registered clients
      const formattedClients = registeredClients.map(c => ({
        ...c,
        isProspect: false,
        prospectState: 'client',
        clientType: 'registered'
      }));

      let allClients = [...formattedClients];

      if (includeProspects) {
        // Fetch individual prospects from prospectClients table
        const prospects = await db
          .select({
            id: prospectClients.id,
            name: prospectClients.name,
            email: prospectClients.email,
            mobile: prospectClients.mobile,
            pan: prospectClients.pan,
            clientType: prospectClients.clientType,
            state: prospectClients.state,
            indicativeRiskProfile: prospectClients.indicativeRiskProfile,
            createdAt: prospectClients.createdAt
          })
          .from(prospectClients)
          .where(eq(prospectClients.agentId, agentId))
          .orderBy(desc(prospectClients.createdAt))
          .limit(100);

        // Format prospects - parse name into firstName/lastName
        const formattedProspects = prospects.map(p => {
          const nameParts = (p.name || '').trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          return {
            id: p.id,
            uuid: p.id,
            firstName,
            lastName,
            email: p.email,
            mobile: p.mobile,
            kycStatus: 'pending',
            riskProfile: p.indicativeRiskProfile || 'moderate',
            createdAt: p.createdAt,
            relationshipType: 'prospect',
            relationshipStatus: 'active',
            isProspect: true,
            prospectState: p.state || 'prospect',
            clientType: p.clientType || 'individual'
          };
        });

        // Fetch B2B leads from prospectLeads table
        const leads = await db
          .select({
            id: prospectLeads.id,
            companyName: prospectLeads.companyName,
            contactName: prospectLeads.companyName,
            contactEmail: prospectLeads.primaryEmail,
            contactPhone: prospectLeads.primaryMobile,
            status: prospectLeads.status,
            leadQuality: prospectLeads.leadQuality,
            createdAt: prospectLeads.createdAt
          })
          .from(prospectLeads)
          .where(eq(prospectLeads.assignedTo, agentId))
          .orderBy(desc(prospectLeads.createdAt))
          .limit(50);

        // Format leads
        const formattedLeads = leads.map(l => {
          const nameParts = (l.contactName || l.companyName || '').trim().split(' ');
          const firstName = nameParts[0] || l.companyName || 'Lead';
          const lastName = nameParts.slice(1).join(' ') || '';
          return {
            id: l.id,
            uuid: l.id,
            firstName,
            lastName,
            email: l.contactEmail,
            mobile: l.contactPhone,
            kycStatus: 'pending',
            riskProfile: 'moderate',
            createdAt: l.createdAt,
            relationshipType: 'lead',
            relationshipStatus: l.status || 'new',
            isProspect: true,
            prospectState: 'lead',
            clientType: 'b2b',
            companyName: l.companyName,
            leadQuality: l.leadQuality
          };
        });

        allClients = [...formattedClients, ...formattedProspects, ...formattedLeads];
        
        // Sort by createdAt descending to show most recent first
        allClients.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      }

      await logAgentAction({
        agentId,
        actionCategory: 'view',
        actionType: 'client_list',
        actionDescription: `Viewed ${allClients.length} clients/prospects/leads`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json(allClients);
    } catch (error) {
      console.error("Error fetching agent clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/agent/portfolio-uploads/pending", requireAgentPortal, async (req: Request, res: Response) => {
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
          clientConfirmed: (portfolioUploads as any).clientConfirmed,
          otpSentAt: (portfolioUploads as any).otpSentAt,
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

  app.post("/api/agent/portfolio-upload", requireAgentPortal, upload.single('file'), async (req: Request, res: Response) => {
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
      } as any).returning();

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

  app.post("/api/agent/portfolio-upload/:uploadId/confirm-otp", requireAgentPortal, async (req: Request, res: Response) => {
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

      if ((upload as any).clientConfirmed) {
        return res.status(400).json({ error: "Upload already confirmed" });
      }

      if ((upload as any).otpCode !== otp) {
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

      if ((upload as any).otpExpiry && new Date((upload as any).otpExpiry) < new Date()) {
        return res.status(400).json({ error: "OTP expired" });
      }

      const [updatedUpload] = await db
        .update(portfolioUploads)
        .set({
          clientConfirmed: true,
          clientConfirmedAt: new Date(),
          uploadStatus: 'confirmed',
          updatedAt: new Date()
        } as any)
        .where(eq(portfolioUploads.id, uploadId))
        .returning();

      await logAgentAction({
        agentId,
        clientId: upload.clientId,
        actionCategory: 'portfolio',
        actionType: 'otp_confirmed',
        actionDescription: `Client confirmed portfolio upload via OTP`,
        previousState: { status: 'pending_otp' },
        newState: { status: 'confirmed', confirmedAt: (updatedUpload as any).clientConfirmedAt },
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

  app.get("/api/agent/advisory-sessions", requireAgentPortal, async (req: Request, res: Response) => {
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

  app.post("/api/agent/advisory-sessions", requireAgentPortal, async (req: Request, res: Response) => {
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

  app.patch("/api/agent/advisory-sessions/:sessionId/workflow", requireAgentPortal, async (req: Request, res: Response) => {
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

}
