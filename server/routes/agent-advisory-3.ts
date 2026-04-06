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

export function registerAgentAdvisoryPart3Routes(app: Express) {
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

      const updateFields: Record<string, unknown> = {};
      if (totalCashAvailable !== undefined) updateFields.totalCashAvailable = String(totalCashAvailable);
      if (maxCreditRisk !== undefined) updateFields.maxCreditRisk = String(maxCreditRisk);
      if (maxDurationDays !== undefined) updateFields.maxDurationDays = Number(maxDurationDays);
      if (maxSingleCounterparty !== undefined) updateFields.maxSingleCounterparty = String(maxSingleCounterparty);
      if (capitalProtection !== undefined) updateFields.capitalProtection = Boolean(capitalProtection);
      if (liquidityManagement !== undefined) updateFields.liquidityManagement = Boolean(liquidityManagement);
      if (yieldEnhancement !== undefined) updateFields.yieldEnhancement = Boolean(yieldEnhancement);
      if (liabilityMatching !== undefined) updateFields.liabilityMatching = Boolean(liabilityMatching);
      if (makerCheckerEnabled !== undefined) updateFields.makerCheckerEnabled = Boolean(makerCheckerEnabled);

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      await db.update(treasuryMandates)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(treasuryMandates.id, mandateId));

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
}
