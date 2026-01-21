import { Express, Request, Response, Router } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { 
  requireAuth, 
  injectRoleInfo, 
  getRoleInfo,
  requireRole 
} from "./middleware/roleMiddleware";
import { RoleId } from "@shared/roles";

// Form 15 allowed roles
const FORM15_ALLOWED_ROLES: RoleId[] = ['superadmin', 'master_agent', 'admin', 'compliance_officer', 'agent', 'sub_agent', 'client', 'user'];

// Get user role from roleMiddleware's injected roleInfo (supports multi-role hierarchy)
function getUserRole(req: Request): string {
  const roleInfo = getRoleInfo(req);
  if (roleInfo?.highestRole) {
    // Map roleMiddleware roles to Form 15 legacy roles
    const role = roleInfo.highestRole;
    if (['superadmin', 'master_agent', 'admin', 'compliance_officer'].includes(role)) return 'admin';
    if (['agent', 'sub_agent'].includes(role)) return 'ca_subordinate_agent';
    if (role === 'partner') return 'ca'; // Partners can act as CAs
    return 'client';
  }
  // Fallback to session for backward compatibility
  return (req as any).session?.user?.role || 'client';
}

function getSessionUser(req: Request): { id: string; email: string; role?: string; roles?: string[] } | undefined {
  const roleInfo = getRoleInfo(req);
  // Check both req.user (passport) and req.session?.user (legacy) for compatibility
  const sessionUser = (req as any).user || (req as any).session?.user;
  if (sessionUser && roleInfo) {
    return { ...sessionUser, roles: roleInfo.roles };
  }
  return sessionUser;
}

function canCreateCase(role: string): boolean {
  return ['client', 'ca_subordinate_agent', 'ca', 'admin'].includes(role);
}

// Authorization helper - checks if user can access a specific case
async function isUserAuthorizedForCase(userId: string, userRole: string, caseId: string): Promise<{ authorized: boolean; caseData: any }> {
  const result = await db.execute(sql`SELECT * FROM form_15_cases WHERE id = ${caseId}`);
  if (!result.rows || result.rows.length === 0) {
    return { authorized: false, caseData: null };
  }
  
  const caseData = result.rows[0] as any;
  const isAuthorized = 
    userRole === 'admin' ||
    caseData.client_id === userId ||
    caseData.ca_id === userId ||
    caseData.agent_id === userId;
  
  return { authorized: isAuthorized, caseData };
}

function canEditCase(role: string, caseStatus: string): boolean {
  if (role === 'ca' || role === 'admin') return true;
  if (role === 'ca_subordinate_agent' && ['draft', 'pending_documents', 'sent_back_to_agent'].includes(caseStatus)) return true;
  if (role === 'client' && caseStatus === 'draft') return true;
  return false;
}

function canSignForm15CB(role: string): boolean {
  return role === 'ca';
}

// Audit log helper
async function logAudit(
  caseId: string,
  userId: string,
  userRole: string,
  userEmail: string,
  actionType: string,
  actionDescription: string,
  options: {
    fieldChanged?: string;
    previousValue?: string;
    newValue?: string;
    ipAddress?: string;
    userAgent?: string;
    dscSerialNumber?: string;
    icaiMembershipNumber?: string;
    metadata?: any;
  } = {}
) {
  await db.execute(sql`
    INSERT INTO form_15_audit_log (
      case_id, user_id, user_role, user_email, action_type, action_description,
      field_changed, previous_value, new_value, ip_address, user_agent,
      dsc_serial_number, icai_membership_number, metadata
    ) VALUES (
      ${caseId}, ${userId}, ${userRole}, ${userEmail}, ${actionType}, ${actionDescription},
      ${options.fieldChanged || null}, ${options.previousValue || null}, ${options.newValue || null},
      ${options.ipAddress || null}, ${options.userAgent || null},
      ${options.dscSerialNumber || null}, ${options.icaiMembershipNumber || null},
      ${options.metadata ? JSON.stringify(options.metadata) : null}::jsonb
    )
  `);
}

// Rule 37BB Decision Engine
function determineRule37BB(remittanceAmount: number, natureOfPayment: string, dtaaApplicable: boolean, trcAvailable: boolean) {
  let form15caRequired = true;
  let form15cbRequired = false;
  let form15caPart = 'A';
  let justification = '';

  // Rule 37BB logic based on payment nature and amount
  const exemptPayments = ['gift_to_relative', 'educational_expense', 'medical_treatment'];
  
  if (exemptPayments.includes(natureOfPayment) && remittanceAmount <= 700000) {
    form15caRequired = true;
    form15caPart = 'A';
    form15cbRequired = false;
    justification = 'Payment exempt under Section 195 - no tax deductible at source';
  } else if (remittanceAmount <= 500000 && !dtaaApplicable) {
    form15caRequired = true;
    form15caPart = 'B';
    form15cbRequired = false;
    justification = 'Remittance amount <= 5 lakh without DTAA benefit - Part B applicable';
  } else if (dtaaApplicable && trcAvailable) {
    form15caRequired = true;
    form15caPart = 'C';
    form15cbRequired = true;
    justification = 'DTAA benefit claimed with TRC - Form 15CB required, Part C applicable';
  } else {
    form15caRequired = true;
    form15caPart = 'D';
    form15cbRequired = true;
    justification = 'Tax deductible at source - Form 15CB required, Part D applicable';
  }

  return { form15caRequired, form15cbRequired, form15caPart, justification };
}

export function registerForm15Routes(app: Express) {
  // Create a router for Form 15 routes with centralized auth middleware
  const router = Router();
  
  // Apply authentication and role injection middleware to ALL Form 15 routes
  router.use(requireAuth);
  router.use(injectRoleInfo);

  // ========================================
  // CASE MANAGEMENT ROUTES
  // ========================================

  // Get all cases for user
  router.get("/cases", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUser(req)?.id;
      const userRole = getUserRole(req);
      
      // userId guaranteed by requireAuth middleware
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { status, clientId } = req.query;
      const statusFilter = typeof status === 'string' ? status : null;
      const clientFilter = typeof clientId === 'string' ? clientId : null;

      let result;
      if (userRole === 'admin') {
        result = await db.execute(sql`
          SELECT c.*, u.email as client_email, ca.email as ca_email, ag.email as agent_email
          FROM form_15_cases c
          LEFT JOIN users u ON c.client_id = u.id
          LEFT JOIN users ca ON c.ca_id = ca.id
          LEFT JOIN users ag ON c.agent_id = ag.id
          WHERE (${statusFilter}::text IS NULL OR c.status = ${statusFilter})
            AND (${clientFilter}::text IS NULL OR c.client_id = ${clientFilter})
          ORDER BY c.created_at DESC
        `);
      } else if (userRole === 'ca') {
        result = await db.execute(sql`
          SELECT c.*, u.email as client_email, ag.email as agent_email
          FROM form_15_cases c
          LEFT JOIN users u ON c.client_id = u.id
          LEFT JOIN users ag ON c.agent_id = ag.id
          WHERE c.ca_id = ${userId}
            AND (${statusFilter}::text IS NULL OR c.status = ${statusFilter})
          ORDER BY c.created_at DESC
        `);
      } else if (userRole === 'ca_subordinate_agent') {
        result = await db.execute(sql`
          SELECT c.*, u.email as client_email
          FROM form_15_cases c
          LEFT JOIN users u ON c.client_id = u.id
          WHERE c.agent_id = ${userId}
            AND (${statusFilter}::text IS NULL OR c.status = ${statusFilter})
          ORDER BY c.created_at DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT c.*
          FROM form_15_cases c
          WHERE c.client_id = ${userId}
            AND (${statusFilter}::text IS NULL OR c.status = ${statusFilter})
          ORDER BY c.created_at DESC
        `);
      }

      res.json(result.rows || []);
    } catch (error) {
      console.error("Error fetching Form 15 cases:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  // Create new case
  router.post("/cases", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!canCreateCase(userRole)) {
        return res.status(403).json({ error: "Not authorized to create cases" });
      }

      const {
        clientId,
        clientPan,
        clientName,
        clientResidentialStatus,
        clientAddress,
        clientEmail,
        clientPhone,
        remittanceAmount,
        remittanceCurrency,
        beneficiaryName,
        beneficiaryCountry,
        beneficiaryAddress,
        rbiPurposeCode,
        rbiPurposeDescription,
        natureOfPayment,
        dtaaApplicable,
        dtaaCountry,
        trcAvailable,
      } = req.body;

      // Validation
      if (!clientPan || !clientName || !remittanceAmount || !beneficiaryName || !beneficiaryCountry || !rbiPurposeCode || !natureOfPayment) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Generate case number
      const caseNumber = `F15-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

      // Determine Form 15CA/15CB requirements
      const rule37bb = determineRule37BB(
        parseFloat(remittanceAmount),
        natureOfPayment,
        dtaaApplicable === true,
        trcAvailable === true
      );

      // Determine actual client ID based on role
      const actualClientId = userRole === 'client' ? userId : (clientId || userId);

      const result = await db.execute(sql`
        INSERT INTO form_15_cases (
          case_number, client_id, created_by, created_by_role,
          client_pan, client_name, client_residential_status, client_address, client_email, client_phone,
          remittance_amount, remittance_currency, beneficiary_name, beneficiary_country, beneficiary_address,
          rbi_purpose_code, rbi_purpose_description, nature_of_payment,
          dtaa_applicable, dtaa_country, trc_available,
          form_15ca_required, form_15ca_part, form_15cb_required, rule_37bb_justification,
          status
        ) VALUES (
          ${caseNumber}, ${actualClientId}, ${userId}, ${userRole},
          ${clientPan}, ${clientName}, ${clientResidentialStatus || 'resident'}, ${clientAddress || null}, ${clientEmail || null}, ${clientPhone || null},
          ${remittanceAmount}, ${remittanceCurrency || 'USD'}, ${beneficiaryName}, ${beneficiaryCountry}, ${beneficiaryAddress || null},
          ${rbiPurposeCode}, ${rbiPurposeDescription || null}, ${natureOfPayment},
          ${dtaaApplicable || false}, ${dtaaCountry || null}, ${trcAvailable || false},
          ${rule37bb.form15caRequired}, ${rule37bb.form15caPart}, ${rule37bb.form15cbRequired}, ${rule37bb.justification},
          'draft'
        )
        RETURNING *
      `);

      const newCase = result.rows?.[0];

      if (newCase) {
        await logAudit(newCase.id as string, userId, userRole, userEmail, 'created', 'Case created', {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { caseNumber }
        });
      }

      res.status(201).json(newCase);
    } catch (error) {
      console.error("Error creating Form 15 case:", error);
      res.status(500).json({ error: "Failed to create case" });
    }
  });

  // Get single case with details
  router.get("/cases/:caseId", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await db.execute(sql`
        SELECT c.*, 
               u.email as client_email_lookup,
               ca.email as ca_email_lookup,
               ag.email as agent_email_lookup
        FROM form_15_cases c
        LEFT JOIN users u ON c.client_id = u.id
        LEFT JOIN users ca ON c.ca_id = ca.id
        LEFT JOIN users ag ON c.agent_id = ag.id
        WHERE c.id = ${caseId}
      `);

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: "Case not found" });
      }

      const caseData = result.rows[0] as any;
      
      // Authorization check: only admin, assigned CA, subordinate agent, or client can view
      const isAuthorized = 
        userRole === 'admin' ||
        caseData.client_id === userId ||
        caseData.ca_id === userId ||
        caseData.agent_id === userId;
      
      if (!isAuthorized) {
        return res.status(403).json({ error: "Not authorized to view this case" });
      }

      const documents = await db.execute(sql`
        SELECT * FROM form_15_documents WHERE case_id = ${caseId} ORDER BY uploaded_at DESC
      `);

      const auditLog = await db.execute(sql`
        SELECT * FROM form_15_audit_log WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 50
      `);

      res.json({
        ...result.rows[0],
        documents: documents.rows || [],
        auditLog: auditLog.rows || []
      });
    } catch (error) {
      console.error("Error fetching Form 15 case:", error);
      res.status(500).json({ error: "Failed to fetch case" });
    }
  });

  // Update case (role-based)
  router.patch("/cases/:caseId", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get current case
      const current = await db.execute(sql`SELECT * FROM form_15_cases WHERE id = ${caseId}`);
      if (!current.rows || current.rows.length === 0) {
        return res.status(404).json({ error: "Case not found" });
      }

      const currentCase = current.rows[0] as any;

      // Authorization check: only admin, assigned CA, subordinate agent, or client can edit
      const isAuthorized = 
        userRole === 'admin' ||
        currentCase.client_id === userId ||
        currentCase.ca_id === userId ||
        currentCase.agent_id === userId;
      
      if (!isAuthorized) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      if (!canEditCase(userRole, currentCase.status as string)) {
        return res.status(403).json({ error: "Not authorized to edit this case in current status" });
      }

      const {
        clientPan, clientName, clientResidentialStatus, clientAddress, clientEmail, clientPhone,
        remittanceAmount, remittanceCurrency, remittanceAmountInr, exchangeRate,
        beneficiaryName, beneficiaryCountry, beneficiaryAddress, beneficiaryBankName, beneficiaryAccountNumber, beneficiarySwiftCode,
        rbiPurposeCode, rbiPurposeDescription, natureOfPayment, sectionUnderWhichTaxDeducted,
        dtaaApplicable, dtaaCountry, dtaaArticle, dtaaRate, dtaaAnalysis,
        trcAvailable, form10fAvailable, noPeDeclaration,
        grossAmount, taxableAmount, tdsRate, tdsAmount, surcharge, cess, totalTaxDeducted, netRemittance,
        agentRemarks
      } = req.body;

      // If remittance amount or DTAA changed, recalculate Rule 37BB
      let rule37bb = null;
      if (remittanceAmount !== undefined || dtaaApplicable !== undefined || trcAvailable !== undefined || natureOfPayment !== undefined) {
        rule37bb = determineRule37BB(
          parseFloat(remittanceAmount || currentCase.remittance_amount),
          natureOfPayment || currentCase.nature_of_payment,
          (dtaaApplicable !== undefined ? dtaaApplicable : currentCase.dtaa_applicable) === true,
          (trcAvailable !== undefined ? trcAvailable : currentCase.trc_available) === true
        );
      }

      await db.execute(sql`
        UPDATE form_15_cases SET
          client_pan = COALESCE(${clientPan || null}, client_pan),
          client_name = COALESCE(${clientName || null}, client_name),
          client_residential_status = COALESCE(${clientResidentialStatus || null}, client_residential_status),
          client_address = COALESCE(${clientAddress || null}, client_address),
          client_email = COALESCE(${clientEmail || null}, client_email),
          client_phone = COALESCE(${clientPhone || null}, client_phone),
          remittance_amount = COALESCE(${remittanceAmount || null}, remittance_amount),
          remittance_currency = COALESCE(${remittanceCurrency || null}, remittance_currency),
          remittance_amount_inr = COALESCE(${remittanceAmountInr || null}, remittance_amount_inr),
          exchange_rate = COALESCE(${exchangeRate || null}, exchange_rate),
          beneficiary_name = COALESCE(${beneficiaryName || null}, beneficiary_name),
          beneficiary_country = COALESCE(${beneficiaryCountry || null}, beneficiary_country),
          beneficiary_address = COALESCE(${beneficiaryAddress || null}, beneficiary_address),
          beneficiary_bank_name = COALESCE(${beneficiaryBankName || null}, beneficiary_bank_name),
          beneficiary_account_number = COALESCE(${beneficiaryAccountNumber || null}, beneficiary_account_number),
          beneficiary_swift_code = COALESCE(${beneficiarySwiftCode || null}, beneficiary_swift_code),
          rbi_purpose_code = COALESCE(${rbiPurposeCode || null}, rbi_purpose_code),
          rbi_purpose_description = COALESCE(${rbiPurposeDescription || null}, rbi_purpose_description),
          nature_of_payment = COALESCE(${natureOfPayment || null}, nature_of_payment),
          section_under_which_tax_deducted = COALESCE(${sectionUnderWhichTaxDeducted || null}, section_under_which_tax_deducted),
          dtaa_applicable = COALESCE(${dtaaApplicable !== undefined ? dtaaApplicable : null}, dtaa_applicable),
          dtaa_country = COALESCE(${dtaaCountry || null}, dtaa_country),
          dtaa_article = COALESCE(${dtaaArticle || null}, dtaa_article),
          dtaa_rate = COALESCE(${dtaaRate || null}, dtaa_rate),
          dtaa_analysis = COALESCE(${dtaaAnalysis || null}, dtaa_analysis),
          trc_available = COALESCE(${trcAvailable !== undefined ? trcAvailable : null}, trc_available),
          form_10f_available = COALESCE(${form10fAvailable !== undefined ? form10fAvailable : null}, form_10f_available),
          no_pe_declaration = COALESCE(${noPeDeclaration !== undefined ? noPeDeclaration : null}, no_pe_declaration),
          form_15ca_required = COALESCE(${rule37bb?.form15caRequired ?? null}, form_15ca_required),
          form_15ca_part = COALESCE(${rule37bb?.form15caPart ?? null}, form_15ca_part),
          form_15cb_required = COALESCE(${rule37bb?.form15cbRequired ?? null}, form_15cb_required),
          rule_37bb_justification = COALESCE(${rule37bb?.justification ?? null}, rule_37bb_justification),
          gross_amount = COALESCE(${grossAmount || null}, gross_amount),
          taxable_amount = COALESCE(${taxableAmount || null}, taxable_amount),
          tds_rate = COALESCE(${tdsRate || null}, tds_rate),
          tds_amount = COALESCE(${tdsAmount || null}, tds_amount),
          surcharge = COALESCE(${surcharge || null}, surcharge),
          cess = COALESCE(${cess || null}, cess),
          total_tax_deducted = COALESCE(${totalTaxDeducted || null}, total_tax_deducted),
          net_remittance = COALESCE(${netRemittance || null}, net_remittance),
          agent_remarks = COALESCE(${agentRemarks || null}, agent_remarks),
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'updated', 'Case details updated', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating Form 15 case:", error);
      res.status(500).json({ error: "Failed to update case" });
    }
  });

  // ========================================
  // SUBORDINATE AGENT WORKFLOW
  // ========================================

  // Submit for CA review (agent only)
  router.post("/cases/:caseId/submit-for-review", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Authorization check
      const { authorized, caseData: currentCase } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !currentCase) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      if (userRole !== 'ca_subordinate_agent' && userRole !== 'client') {
        return res.status(403).json({ error: "Only subordinate agents or clients can submit for review" });
      }

      if (!['draft', 'pending_documents', 'sent_back_to_agent'].includes(currentCase.status as string)) {
        return res.status(400).json({ error: "Case cannot be submitted in current status" });
      }

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = 'pending_ca_review',
          agent_submitted_for_review = true,
          agent_submitted_at = NOW(),
          agent_prepared_at = NOW(),
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'status_change', 'Submitted for CA review', {
        previousValue: currentCase.status as string,
        newValue: 'pending_ca_review',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true, status: 'pending_ca_review' });
    } catch (error) {
      console.error("Error submitting case for review:", error);
      res.status(500).json({ error: "Failed to submit for review" });
    }
  });

  // ========================================
  // CA REVIEW WORKFLOW
  // ========================================

  // Start CA review
  router.post("/cases/:caseId/start-review", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId || (userRole !== 'ca' && userRole !== 'admin')) {
        return res.status(403).json({ error: "Only CA can start review" });
      }

      // Authorization: Check case exists and validate review eligibility
      const caseCheck = await db.execute(sql`SELECT * FROM form_15_cases WHERE id = ${caseId}`);
      if (!caseCheck.rows || caseCheck.rows.length === 0) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      const caseData = caseCheck.rows[0] as any;
      
      if (caseData.status !== 'pending_ca_review') {
        return res.status(400).json({ error: "Case is not pending CA review" });
      }
      
      // Security: If case already has a CA assigned and it's not this user, deny access (unless admin)
      if (caseData.ca_id && caseData.ca_id !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: "Case already assigned to another CA" });
      }
      
      // Audit: Log case pickup attempt for compliance
      await logAudit(caseId, userId, userRole, userEmail, 'review_pickup_attempt', 'CA attempting to pick up case for review', {
        ipAddress: req.ip,
        metadata: { previousCaId: caseData.ca_id || null }
      });

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = 'ca_reviewing',
          ca_id = ${userId},
          ca_review_started_at = NOW(),
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'ca_review_started', 'CA started reviewing case', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error starting CA review:", error);
      res.status(500).json({ error: "Failed to start review" });
    }
  });

  // Send back to agent
  router.post("/cases/:caseId/send-back", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { reason } = req.body;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId || (userRole !== 'ca' && userRole !== 'admin')) {
        return res.status(403).json({ error: "Only CA can send back to agent" });
      }

      // Authorization check - only assigned CA or admin can send back
      const { authorized, caseData } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !caseData) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      if (!reason) {
        return res.status(400).json({ error: "Reason is required" });
      }

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = 'sent_back_to_agent',
          ca_sent_back_to_agent = true,
          ca_sent_back_reason = ${reason},
          ca_remarks = ${reason},
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'ca_sent_back', `Case sent back to agent: ${reason}`, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending case back:", error);
      res.status(500).json({ error: "Failed to send back" });
    }
  });

  // CA Approval with mandatory checklist
  router.post("/cases/:caseId/approve", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { documentsReviewed, dtaaVerified, taxComputationConfirmed, legalResponsibilityAccepted, remarks } = req.body;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId || (userRole !== 'ca' && userRole !== 'admin')) {
        return res.status(403).json({ error: "Only CA can approve" });
      }

      // Authorization check - only assigned CA or admin can approve
      const { authorized, caseData } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !caseData) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      // Validate mandatory checklist
      if (!documentsReviewed || !dtaaVerified || !taxComputationConfirmed || !legalResponsibilityAccepted) {
        return res.status(400).json({ 
          error: "All approval checklist items must be confirmed",
          requiredItems: ['documentsReviewed', 'dtaaVerified', 'taxComputationConfirmed', 'legalResponsibilityAccepted']
        });
      }

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = 'approved',
          ca_documents_reviewed = true,
          ca_dtaa_verified = true,
          ca_tax_computation_confirmed = true,
          ca_legal_responsibility_accepted = true,
          ca_approval_timestamp = NOW(),
          ca_review_completed_at = NOW(),
          ca_remarks = ${remarks || null},
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'ca_approved', 'CA approved case with full checklist confirmation', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { documentsReviewed, dtaaVerified, taxComputationConfirmed, legalResponsibilityAccepted }
      });

      res.json({ success: true, status: 'approved' });
    } catch (error) {
      console.error("Error approving case:", error);
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  // ========================================
  // FORM 15CB SIGNING (CA ONLY)
  // ========================================

  // Sign Form 15CB
  router.post("/cases/:caseId/sign-15cb", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { dscSerialNumber, icaiMembershipNumber } = req.body;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId || !canSignForm15CB(userRole)) {
        return res.status(403).json({ error: "Only verified CA can sign Form 15CB" });
      }

      // Authorization check - only assigned CA can sign
      const { authorized, caseData: currentCase } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !currentCase) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      if (!dscSerialNumber || !icaiMembershipNumber) {
        return res.status(400).json({ error: "DSC serial number and ICAI membership number are required" });
      }

      // Verify CA is approved for signing
      const caVerification = await db.execute(sql`
        SELECT * FROM ca_verification_status 
        WHERE user_id = ${userId} AND can_sign_form_15cb = true
      `);

      if (!caVerification.rows || caVerification.rows.length === 0) {
        return res.status(403).json({ error: "CA is not verified for Form 15CB signing" });
      }
      if (currentCase.status as string !== 'approved') {
        return res.status(400).json({ error: "Case must be approved before signing Form 15CB" });
      }

      if (!currentCase.form_15cb_required) {
        return res.status(400).json({ error: "Form 15CB is not required for this case" });
      }

      // Generate Form 15CB number
      const form15cbNumber = `15CB-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = '15cb_signed',
          form_15cb_number = ${form15cbNumber},
          form_15cb_date = NOW(),
          form_15cb_dsc_serial_number = ${dscSerialNumber},
          form_15cb_signed_at = NOW(),
          form_15cb_signed_by_icai = ${icaiMembershipNumber},
          form_15cb_locked = true,
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      // Lock all documents
      await db.execute(sql`
        UPDATE form_15_documents SET
          is_locked_after_signing = true,
          locked_at = NOW()
        WHERE case_id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, '15cb_signed', `Form 15CB signed with certificate ${form15cbNumber}`, {
        dscSerialNumber,
        icaiMembershipNumber,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true, form15cbNumber, status: '15cb_signed' });
    } catch (error) {
      console.error("Error signing Form 15CB:", error);
      res.status(500).json({ error: "Failed to sign Form 15CB" });
    }
  });

  // ========================================
  // FORM 15CA FILING
  // ========================================

  // File Form 15CA
  router.post("/cases/:caseId/file-15ca", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId || (userRole !== 'ca' && userRole !== 'admin')) {
        return res.status(403).json({ error: "Only CA can file Form 15CA" });
      }

      // Authorization check - only assigned CA or admin can file
      const { authorized, caseData: currentCase } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !currentCase) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }
      
      // Validate status - must be 15cb_signed if 15CB was required, or approved if not
      if (currentCase.form_15cb_required && currentCase.status as string !== '15cb_signed') {
        return res.status(400).json({ error: "Form 15CB must be signed before filing Form 15CA" });
      }
      if (!currentCase.form_15cb_required && currentCase.status as string !== 'approved') {
        return res.status(400).json({ error: "Case must be approved before filing Form 15CA" });
      }

      // Generate acknowledgement number (simulated)
      const acknowledgementNumber = `ACK-15CA-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${nanoid(8).toUpperCase()}`;

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = '15ca_filed',
          form_15ca_acknowledgement_number = ${acknowledgementNumber},
          form_15ca_filed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, '15ca_filed', `Form 15CA filed with acknowledgement ${acknowledgementNumber}`, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true, acknowledgementNumber, status: '15ca_filed' });
    } catch (error) {
      console.error("Error filing Form 15CA:", error);
      res.status(500).json({ error: "Failed to file Form 15CA" });
    }
  });

  // E-verify Form 15CA (Client)
  router.post("/cases/:caseId/everify", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Authorization check - only client/admin who owns this case can e-verify
      const { authorized, caseData } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !caseData) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      // Only client or admin can e-verify
      if (caseData.client_id !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: "Only case owner or admin can e-verify" });
      }

      await db.execute(sql`
        UPDATE form_15_cases SET
          status = 'everified',
          form_15ca_everified = true,
          form_15ca_everified_at = NOW(),
          form_15ca_everified_by = ${userId},
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, 'client', userEmail, 'everified', 'Form 15CA e-verified by client', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true, status: 'everified' });
    } catch (error) {
      console.error("Error e-verifying Form 15CA:", error);
      res.status(500).json({ error: "Failed to e-verify" });
    }
  });

  // ========================================
  // BANK COMPLIANCE PACK
  // ========================================

  // Generate bank compliance pack
  router.post("/cases/:caseId/generate-compliance-pack", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Authorization check
      const { authorized, caseData: currentCase } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !currentCase) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }
      if (!['15ca_filed', 'everified', 'completed'].includes(currentCase.status as string)) {
        return res.status(400).json({ error: "Form 15CA must be filed before generating compliance pack" });
      }

      // Generate share link
      const shareLink = `SHARE-${nanoid(12)}`;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

      await db.execute(sql`
        UPDATE form_15_cases SET
          compliance_pack_generated = true,
          compliance_pack_generated_at = NOW(),
          compliance_pack_shared_link = ${shareLink},
          compliance_pack_shared_link_expiry = ${expiryDate.toISOString()},
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'compliance_pack_generated', 'Bank compliance pack generated', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ 
        success: true, 
        shareLink,
        expiryDate: expiryDate.toISOString(),
        status: 'completed' 
      });
    } catch (error) {
      console.error("Error generating compliance pack:", error);
      res.status(500).json({ error: "Failed to generate compliance pack" });
    }
  });

  // ========================================
  // DOCUMENT MANAGEMENT
  // ========================================

  // Upload document
  router.post("/cases/:caseId/documents", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { documentType, documentName, documentUrl, fileSize, mimeType, isMandatory } = req.body;
      const userId = getSessionUser(req)?.id;
      const userEmail = getSessionUser(req)?.email || '';
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Authorization check
      const { authorized, caseData } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized || !caseData) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      if (caseData.form_15cb_locked) {
        return res.status(400).json({ error: "Cannot upload documents after Form 15CB is signed" });
      }

      // Validate document type
      const validDocTypes = ['invoice', 'agreement', 'trc', 'form_10f', 'no_pe_declaration', 'bank_advice', 'pan_card', 'passport', 'other'];
      if (!validDocTypes.includes(documentType)) {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const result = await db.execute(sql`
        INSERT INTO form_15_documents (
          case_id, document_type, document_name, document_url, file_size, mime_type, is_mandatory, uploaded_by
        ) VALUES (
          ${caseId}, ${documentType}, ${documentName}, ${documentUrl || null}, ${fileSize || null}, ${mimeType || null}, ${isMandatory || false}, ${userId}
        )
        RETURNING *
      `);

      await logAudit(caseId, userId, userRole, userEmail, 'document_upload', `Document uploaded: ${documentName}`, {
        metadata: { documentType, documentName }
      });

      res.status(201).json(result.rows?.[0]);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get documents for case
  router.get("/cases/:caseId/documents", async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = getSessionUser(req)?.id;
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Authorization check
      const { authorized } = await isUserAuthorizedForCase(userId, userRole, caseId);
      if (!authorized) {
        return res.status(403).json({ error: "Not authorized to access this case" });
      }

      const result = await db.execute(sql`
        SELECT d.*, u.email as uploaded_by_email
        FROM form_15_documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.case_id = ${caseId}
        ORDER BY d.uploaded_at DESC
      `);

      res.json(result.rows || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // ========================================
  // CA VERIFICATION STATUS
  // ========================================

  // Get CA verification status
  router.get("/ca-verification", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUser(req)?.id;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await db.execute(sql`
        SELECT * FROM ca_verification_status WHERE user_id = ${userId}
      `);

      if (!result.rows || result.rows.length === 0) {
        return res.json({ verified: false, status: 'not_registered' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching CA verification status:", error);
      res.status(500).json({ error: "Failed to fetch verification status" });
    }
  });

  // Submit CA verification (Admin approves later)
  router.post("/ca-verification", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUser(req)?.id;
      const { icaiMembershipNumber, copNumber, copValidFrom, copValidTo, panNumber, dscSerialNumber, dscValidFrom, dscValidTo } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!icaiMembershipNumber || !panNumber) {
        return res.status(400).json({ error: "ICAI membership number and PAN are required" });
      }

      const result = await db.execute(sql`
        INSERT INTO ca_verification_status (
          user_id, icai_membership_number, cop_number, cop_valid_from, cop_valid_to,
          pan_number, dsc_serial_number, dsc_valid_from, dsc_valid_to, dsc_available,
          overall_status
        ) VALUES (
          ${userId}, ${icaiMembershipNumber}, ${copNumber || null}, ${copValidFrom || null}, ${copValidTo || null},
          ${panNumber}, ${dscSerialNumber || null}, ${dscValidFrom || null}, ${dscValidTo || null}, ${!!dscSerialNumber},
          'pending'
        )
        ON CONFLICT (user_id) DO UPDATE SET
          icai_membership_number = ${icaiMembershipNumber},
          cop_number = ${copNumber || null},
          cop_valid_from = ${copValidFrom || null},
          cop_valid_to = ${copValidTo || null},
          pan_number = ${panNumber},
          dsc_serial_number = ${dscSerialNumber || null},
          dsc_valid_from = ${dscValidFrom || null},
          dsc_valid_to = ${dscValidTo || null},
          dsc_available = ${!!dscSerialNumber},
          updated_at = NOW()
        RETURNING *
      `);

      res.json(result.rows?.[0]);
    } catch (error) {
      console.error("Error submitting CA verification:", error);
      res.status(500).json({ error: "Failed to submit verification" });
    }
  });

  // ========================================
  // STATISTICS
  // ========================================

  router.get("/stats", async (req: Request, res: Response) => {
    try {
      const userId = getSessionUser(req)?.id;
      const userRole = getUserRole(req);

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      let whereClause = sql`WHERE 1=1`;
      if (userRole === 'ca') {
        whereClause = sql`WHERE ca_id = ${userId}`;
      } else if (userRole === 'ca_subordinate_agent') {
        whereClause = sql`WHERE agent_id = ${userId}`;
      } else if (userRole === 'client') {
        whereClause = sql`WHERE client_id = ${userId}`;
      }

      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_cases,
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'pending_ca_review') as pending_review,
          COUNT(*) FILTER (WHERE status = 'ca_reviewing') as under_review,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = '15cb_signed') as cb_signed,
          COUNT(*) FILTER (WHERE status = '15ca_filed') as ca_filed,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COALESCE(SUM(CAST(remittance_amount AS DECIMAL)), 0) as total_remittance
        FROM form_15_cases
        ${whereClause}
      `);

      res.json(stats.rows?.[0] || {});
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Mount the router at the Form 15 API path
  app.use("/api/tax-compliance/form15", router);

  console.log("✅ Form 15CA/15CB routes registered with roleMiddleware");
}
