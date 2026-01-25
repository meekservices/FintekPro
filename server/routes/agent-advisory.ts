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
  partners,
  agentPartnerMappings,
  prospectClients,
  prospectLeads,
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
  
  // Agent Profile endpoint
  app.get("/api/agent/profile", requireAgent, async (req: Request, res: Response) => {
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
  app.get("/api/agent/stats", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      // Get client count
      const clientCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(clientAgentRelationships)
        .where(and(
          eq(clientAgentRelationships.agentId, agentId),
          eq(clientAgentRelationships.status, 'active')
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
  app.get("/api/agent/partners", requireAgent, async (req: Request, res: Response) => {
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
  app.post("/api/agent/partners", requireAgent, async (req: Request, res: Response) => {
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

  app.get("/api/agent/clients", requireAgent, async (req: Request, res: Response) => {
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
          riskProfile: sql<string>`COALESCE(${users.riskCategory}, 'moderate')`,
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
            contactName: prospectLeads.contactName,
            contactEmail: prospectLeads.contactEmail,
            contactPhone: prospectLeads.contactPhone,
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

  // Delete a proposal (supports both investment_proposals and prospect_proposals)
  app.delete("/api/agent/proposals/:proposalId", requireAgent, async (req: Request, res: Response) => {
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

  app.get("/api/agent/treasury/eligible-clients", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      
      const eligibleClients = await db.execute(sql`
        SELECT 
          u.id,
          CONCAT(u.first_name, ' ', u.last_name) as name,
          u.email,
          u.mobile,
          u.kyc_status as "kycStatus",
          u.kyc_tier as "kycTier",
          CASE 
            WHEN tm.id IS NOT NULL THEN true 
            ELSE false 
          END as "hasTreasuryMandate"
        FROM client_agent_relationships car
        INNER JOIN users u ON u.id = car.client_id
        LEFT JOIN treasury_mandates tm ON tm.user_id = u.id AND tm.status = 'active'
        WHERE car.agent_id = ${agentId}
          AND car.status = 'active'
        ORDER BY u.first_name, u.last_name
      `);

      res.json(eligibleClients.rows || []);
    } catch (error) {
      console.error("Error fetching eligible clients:", error);
      res.status(500).json({ error: "Failed to fetch eligible clients" });
    }
  });

  app.post("/api/agent/treasury/mandates", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const {
        clientId,
        entityName,
        cin,
        gstNumber,
        totalCashAvailable,
        capitalProtection,
        liquidityManagement,
        yieldEnhancement,
        liabilityMatching,
        maxCreditRisk,
        maxDurationDays,
        maxSingleCounterparty,
        makerCheckerEnabled
      } = req.body;

      if (!clientId || !entityName || !totalCashAvailable) {
        return res.status(400).json({ 
          error: "Client ID, entity name, and total cash available are required" 
        });
      }

      const [relationship] = await db.execute(sql`
        SELECT id FROM client_agent_relationships 
        WHERE agent_id = ${agentId} 
          AND client_id = ${clientId}
          AND status = 'active'
      `).then(r => r.rows as any[]);

      if (!relationship) {
        return res.status(403).json({ error: "Client is not assigned to you" });
      }

      const [client] = await db.execute(sql`
        SELECT id, kyc_status, kyc_tier FROM users WHERE id = ${clientId}
      `).then(r => r.rows as any[]);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const eligibleTiers = ['enhanced', 'accredited'];
      if (!eligibleTiers.includes(client.kyc_tier?.toLowerCase())) {
        return res.status(400).json({ 
          error: "Client requires Enhanced or Accredited KYC tier for treasury services",
          currentTier: client.kyc_tier
        });
      }

      const [existingMandate] = await db.execute(sql`
        SELECT id FROM treasury_mandates 
        WHERE user_id = ${clientId} AND status = 'active'
      `).then(r => r.rows as any[]);

      if (existingMandate) {
        return res.status(400).json({ 
          error: "Client already has an active treasury mandate",
          existingMandateId: existingMandate.id
        });
      }

      if (cin && !/^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(cin)) {
        return res.status(400).json({ error: "Invalid CIN format" });
      }

      if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber)) {
        return res.status(400).json({ error: "Invalid GST number format" });
      }

      const mandateId = nanoid();

      await db.execute(sql`
        INSERT INTO treasury_mandates (
          id, user_id, entity_name, cin, gst_number, total_cash_available,
          capital_protection, liquidity_management, yield_enhancement, liability_matching,
          max_credit_risk, max_duration_days, max_single_counterparty,
          maker_checker_enabled, status, created_at, updated_at
        ) VALUES (
          ${mandateId}, ${clientId}, ${entityName}, ${cin || null}, ${gstNumber || null}, 
          ${totalCashAvailable},
          ${capitalProtection !== false}, ${liquidityManagement || false}, 
          ${yieldEnhancement || false}, ${liabilityMatching || false},
          ${maxCreditRisk || 'AAA'}, ${maxDurationDays || 365}, 
          ${maxSingleCounterparty || 10},
          ${makerCheckerEnabled !== false}, 'active', NOW(), NOW()
        )
      `);

      await logAgentAction({
        agentId,
        clientId,
        actionCategory: 'treasury',
        actionType: 'mandate_created',
        actionDescription: `Created treasury mandate for ${entityName} with corpus ₹${totalCashAvailable}`,
        newState: { 
          mandateId, 
          entityName, 
          totalCashAvailable,
          makerCheckerEnabled: makerCheckerEnabled !== false 
        }
      });

      res.status(201).json({
        success: true,
        mandateId,
        message: `Treasury mandate created for ${entityName}`
      });
    } catch (error) {
      console.error("Error creating treasury mandate:", error);
      res.status(500).json({ error: "Failed to create treasury mandate" });
    }
  });

  app.patch("/api/agent/treasury/mandates/:mandateId", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { mandateId } = req.params;
      const {
        totalCashAvailable,
        maxCreditRisk,
        maxDurationDays,
        maxSingleCounterparty,
        capitalProtection,
        liquidityManagement,
        yieldEnhancement,
        liabilityMatching,
        makerCheckerEnabled
      } = req.body;

      const [mandate] = await db.execute(sql`
        SELECT tm.*, car.agent_id
        FROM treasury_mandates tm
        INNER JOIN client_agent_relationships car ON car.client_id = tm.user_id
        WHERE tm.id = ${mandateId}
          AND car.agent_id = ${agentId}
          AND car.status = 'active'
      `).then(r => r.rows as any[]);

      if (!mandate) {
        return res.status(404).json({ error: "Mandate not found or not accessible" });
      }

      const updates: string[] = [];
      if (totalCashAvailable !== undefined) updates.push(`total_cash_available = ${totalCashAvailable}`);
      if (maxCreditRisk !== undefined) updates.push(`max_credit_risk = '${maxCreditRisk}'`);
      if (maxDurationDays !== undefined) updates.push(`max_duration_days = ${maxDurationDays}`);
      if (maxSingleCounterparty !== undefined) updates.push(`max_single_counterparty = ${maxSingleCounterparty}`);
      if (capitalProtection !== undefined) updates.push(`capital_protection = ${capitalProtection}`);
      if (liquidityManagement !== undefined) updates.push(`liquidity_management = ${liquidityManagement}`);
      if (yieldEnhancement !== undefined) updates.push(`yield_enhancement = ${yieldEnhancement}`);
      if (liabilityMatching !== undefined) updates.push(`liability_matching = ${liabilityMatching}`);
      if (makerCheckerEnabled !== undefined) updates.push(`maker_checker_enabled = ${makerCheckerEnabled}`);

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      await db.execute(sql`
        UPDATE treasury_mandates 
        SET ${sql.raw(updates.join(', '))}, updated_at = NOW()
        WHERE id = ${mandateId}
      `);

      await logAgentAction({
        agentId,
        clientId: mandate.user_id,
        actionCategory: 'treasury',
        actionType: 'mandate_updated',
        actionDescription: `Updated treasury mandate for ${mandate.entity_name}`,
        previousState: { mandate },
        newState: req.body
      });

      res.json({
        success: true,
        message: "Treasury mandate updated successfully"
      });
    } catch (error) {
      console.error("Error updating treasury mandate:", error);
      res.status(500).json({ error: "Failed to update treasury mandate" });
    }
  });

  app.post("/api/agent/treasury/mandates/:mandateId/deactivate", requireAgent, async (req: Request, res: Response) => {
    try {
      const agentId = (req.user as any).id;
      const { mandateId } = req.params;
      const { reason } = req.body;

      const [mandate] = await db.execute(sql`
        SELECT tm.*, car.agent_id
        FROM treasury_mandates tm
        INNER JOIN client_agent_relationships car ON car.client_id = tm.user_id
        WHERE tm.id = ${mandateId}
          AND car.agent_id = ${agentId}
          AND car.status = 'active'
          AND tm.status = 'active'
      `).then(r => r.rows as any[]);

      if (!mandate) {
        return res.status(404).json({ error: "Active mandate not found or not accessible" });
      }

      const [pendingProposals] = await db.execute(sql`
        SELECT COUNT(*) as count FROM treasury_proposals 
        WHERE mandate_id = ${mandateId} 
          AND status IN ('pending_maker', 'pending_checker', 'pending_approval')
      `).then(r => r.rows as any[]);

      if (parseInt(pendingProposals.count) > 0) {
        return res.status(400).json({ 
          error: "Cannot deactivate mandate with pending proposals. Please resolve pending proposals first."
        });
      }

      await db.execute(sql`
        UPDATE treasury_mandates 
        SET status = 'inactive', updated_at = NOW()
        WHERE id = ${mandateId}
      `);

      await logAgentAction({
        agentId,
        clientId: mandate.user_id,
        actionCategory: 'treasury',
        actionType: 'mandate_deactivated',
        actionDescription: `Deactivated treasury mandate for ${mandate.entity_name}${reason ? `: ${reason}` : ''}`,
        previousState: { status: 'active' },
        newState: { status: 'inactive', reason }
      });

      res.json({
        success: true,
        message: "Treasury mandate deactivated successfully"
      });
    } catch (error) {
      console.error("Error deactivating treasury mandate:", error);
      res.status(500).json({ error: "Failed to deactivate treasury mandate" });
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
          tp.recommended_allocation as "recommendedAllocation",
          COALESCE(tm.maker_checker_enabled, true) as "makerCheckerEnabled"
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

  // Agent-initiated auto-fetch portfolio with AI analysis
  app.post("/api/agent/client/:clientId/auto-fetch-portfolio", requireAgent, async (req: Request, res: Response) => {
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
          eq(clientAgentRelationships.status, 'active')
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
              aiService.generatePortfolioRebalancingRecommendations(portfolioData, userProfile),
              aiService.generateInvestmentProposal(portfolioData, userProfile, 100000, clientId)
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
  app.get("/api/agent/client/:clientId/portfolio-analysis", requireAgent, async (req: Request, res: Response) => {
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
          eq(clientAgentRelationships.status, 'active')
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
        aiService.generatePortfolioRebalancingRecommendations(portfolioData, userProfile),
        aiService.generateInvestmentProposal(portfolioData, userProfile, 100000, clientId)
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

  console.log("✅ Agent Advisory routes registered");
}

// Helper functions for agent portfolio routes
function calculateAssetAllocation(holdings: any[]): { assetType: string; percentage: number; currentValue: number; }[] {
  const allocation: Record<string, number> = {};
  let total = 0;

  for (const h of holdings) {
    const value = parseFloat(h.marketValue || '0');
    const type = h.assetType || 'other';
    allocation[type] = (allocation[type] || 0) + value;
    total += value;
  }

  return Object.entries(allocation).map(([assetType, currentValue]) => ({
    assetType,
    currentValue,
    percentage: total > 0 ? (currentValue / total) * 100 : 0
  }));
}

function calculateAge(dateOfBirth: Date | string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
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
