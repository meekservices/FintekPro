import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { verifyBankAccountPennyDrop, validateIFSC, validateAccountNumber, isNameMatchAcceptable } from "../penny-drop-service";

const router = Router();

// ── Boot-time table creation ─────────────────────────────────────────────────
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_empanelments (
        id                          SERIAL PRIMARY KEY,
        agent_id                    VARCHAR(255) NOT NULL UNIQUE,
        status                      TEXT NOT NULL DEFAULT 'draft',
        current_step                INTEGER NOT NULL DEFAULT 1,

        -- Step 1: Identity
        pan_verified                BOOLEAN DEFAULT FALSE,
        pan_number                  TEXT,
        pan_name                    TEXT,
        aadhaar_verified            BOOLEAN DEFAULT FALSE,
        aadhaar_last4               TEXT,

        -- Step 2: Services
        services_offered            TEXT[],

        -- Step 3: Credentials
        arn_code                    TEXT,
        arn_expiry_date             TEXT,
        euin_number                 TEXT,
        nism_certificate_number     TEXT,
        nism_certificate_type       TEXT,
        nism_expiry_date            TEXT,
        ria_number                  TEXT,
        posp_number                 TEXT,
        posp_insurer                TEXT,
        dsa_code                    TEXT,

        -- Step 4: Bank
        bank_account_number         TEXT,
        bank_ifsc                   TEXT,
        bank_account_holder_name    TEXT,
        bank_name                   TEXT,
        bank_branch                 TEXT,
        bank_verified               BOOLEAN DEFAULT FALSE,
        bank_verified_at            TIMESTAMPTZ,
        bank_penny_drop_ref         TEXT,
        bank_name_match_score       NUMERIC,

        -- Step 5: Documents
        doc_nism_certificate        TEXT,
        doc_graduation_certificate  TEXT,
        doc_pan_card                TEXT,
        doc_cancelled_cheque        TEXT,
        doc_photo                   TEXT,

        -- Step 6: Declarations
        pmla_declaration_signed     BOOLEAN DEFAULT FALSE,
        pmla_signed_at              TIMESTAMPTZ,
        criminal_record_declaration BOOLEAN DEFAULT FALSE,
        fatca_declaration_signed    BOOLEAN DEFAULT FALSE,
        code_of_conduct_accepted    BOOLEAN DEFAULT FALSE,
        anti_mis_selling_accepted   BOOLEAN DEFAULT FALSE,

        -- Submission & Review
        submitted_at                TIMESTAMPTZ,
        reviewed_by                 TEXT,
        reviewed_at                 TIMESTAMPTZ,
        rejection_reason            TEXT,
        approval_notes              TEXT,

        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Add CA qualification columns if they don't exist yet (idempotent)
    await db.execute(sql`ALTER TABLE agent_empanelments ADD COLUMN IF NOT EXISTS is_ca_qualified BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE agent_empanelments ADD COLUMN IF NOT EXISTS ca_membership_number TEXT`);
    await db.execute(sql`ALTER TABLE agent_empanelments ADD COLUMN IF NOT EXISTS ca_verification_status TEXT DEFAULT 'unverified'`);
    await db.execute(sql`ALTER TABLE agent_empanelments ADD COLUMN IF NOT EXISTS ca_verified_at TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE agent_empanelments ADD COLUMN IF NOT EXISTS ca_verified_by TEXT`);
    console.log("✅ [AgentEmpanelment] Table ready");
  } catch (err: any) {
    console.error("[AgentEmpanelment] Table init error:", err.message);
  }
}
ensureTable();

// Helper: get or create draft empanelment for agent
async function getOrCreateEmpanelment(agentId: string) {
  const rows = await db.execute(sql`
    SELECT * FROM agent_empanelments WHERE agent_id = ${agentId}
  `);
  if (rows.rows.length > 0) return rows.rows[0];
  await db.execute(sql`
    INSERT INTO agent_empanelments (agent_id, status, current_step)
    VALUES (${agentId}, 'draft', 1)
  `);
  const created = await db.execute(sql`
    SELECT * FROM agent_empanelments WHERE agent_id = ${agentId}
  `);
  return created.rows[0];
}

// GET /api/agent/empanelment — fetch current empanelment record
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });
    const record = await getOrCreateEmpanelment(agentId);
    res.json({ success: true, empanelment: record });
  } catch (err: any) {
    console.error("[AgentEmpanelment] GET error:", err);
    res.status(500).json({ error: "Failed to load empanelment" });
  }
});

// POST /api/agent/empanelment/step/1 — save personal identity
router.post("/step/1", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { panVerified, panNumber, panName, aadhaarVerified, aadhaarLast4 } = req.body;
    await getOrCreateEmpanelment(agentId);

    await db.execute(sql`
      UPDATE agent_empanelments
      SET pan_verified = ${panVerified ?? false},
          pan_number   = ${panNumber ?? null},
          pan_name     = ${panName ?? null},
          aadhaar_verified = ${aadhaarVerified ?? false},
          aadhaar_last4    = ${aadhaarLast4 ?? null},
          current_step = GREATEST(current_step, 2),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);

    // Mirror PAN to users table
    if (panNumber) {
      await db.execute(sql`
        UPDATE users SET pan_number = ${panNumber} WHERE id = ${agentId}
      `);
    }

    res.json({ success: true, step: 1 });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Step 1 error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/step/2 — save role & services
router.post("/step/2", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { servicesOffered } = req.body;
    if (!Array.isArray(servicesOffered) || servicesOffered.length === 0) {
      return res.status(400).json({ error: "Select at least one service" });
    }

    await getOrCreateEmpanelment(agentId);
    await db.execute(sql`
      UPDATE agent_empanelments
      SET services_offered = ${servicesOffered},
          current_step = GREATEST(current_step, 3),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);

    try {
      await db.execute(sql`
        UPDATE users SET agent_services = ${servicesOffered} WHERE id = ${agentId}
      `);
    } catch (mirrorErr: any) {
      console.warn('[AgentEmpanelment] Step 2 users mirror skipped:', mirrorErr?.message);
    }

    res.json({ success: true, step: 2 });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Step 2 error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/step/3 — save professional credentials
router.post("/step/3", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const {
      arnCode, arnExpiryDate, euinNumber,
      nismCertificateNumber, nismCertificateType, nismExpiryDate,
      riaNumber, pospNumber, pospInsurer, dsaCode
    } = req.body;

    // Validate ARN format if provided (ARN-NNNNN or ARNXXXXXX)
    if (arnCode && !/^ARN[-\s]?\d{4,10}$/i.test(arnCode.trim())) {
      return res.status(400).json({ error: "Invalid ARN format. Expected: ARN-XXXXX" });
    }

    await getOrCreateEmpanelment(agentId);
    await db.execute(sql`
      UPDATE agent_empanelments
      SET arn_code              = ${arnCode ?? null},
          arn_expiry_date       = ${arnExpiryDate ?? null},
          euin_number           = ${euinNumber ?? null},
          nism_certificate_number = ${nismCertificateNumber ?? null},
          nism_certificate_type   = ${nismCertificateType ?? null},
          nism_expiry_date        = ${nismExpiryDate ?? null},
          ria_number            = ${riaNumber ?? null},
          posp_number           = ${pospNumber ?? null},
          posp_insurer          = ${pospInsurer ?? null},
          dsa_code              = ${dsaCode ?? null},
          current_step = GREATEST(current_step, 4),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);

    // Mirror back to users table
    await db.execute(sql`
      UPDATE users
      SET arn_code            = COALESCE(${arnCode ?? null}, arn_code),
          arn_expiry_date     = COALESCE(${arnExpiryDate ?? null}, arn_expiry_date),
          euin_number         = COALESCE(${euinNumber ?? null}, euin_number),
          nism_certificate_number = COALESCE(${nismCertificateNumber ?? null}, nism_certificate_number),
          nism_certificate_type   = COALESCE(${nismCertificateType ?? null}, nism_certificate_type),
          nism_expiry_date        = COALESCE(${nismExpiryDate ?? null}, nism_expiry_date),
          ria_number          = COALESCE(${riaNumber ?? null}, ria_number),
          posp_number         = COALESCE(${pospNumber ?? null}, posp_number),
          dsa_code            = COALESCE(${dsaCode ?? null}, dsa_code)
      WHERE id = ${agentId}
    `);

    res.json({ success: true, step: 3 });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Step 3 error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/step/4/verify-bank — penny drop bank verification
router.post("/step/4/verify-bank", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { accountNumber, ifscCode, accountHolderName } = req.body;
    if (!accountNumber || !ifscCode || !accountHolderName) {
      return res.status(400).json({ error: "Account number, IFSC, and account holder name are required" });
    }

    if (!validateAccountNumber(accountNumber)) {
      return res.status(400).json({ error: "Invalid account number. Must be 9–18 digits." });
    }
    if (!validateIFSC(ifscCode)) {
      return res.status(400).json({ error: "Invalid IFSC code. Format: AAAA0NNNNNN (e.g. HDFC0001234)" });
    }

    // IFSC lookup for branch info
    let bankName = "";
    let bankBranch = "";
    try {
      const { lookupIFSC } = await import("../ifsc-lookup-service");
      const ifscResult = await lookupIFSC(ifscCode);
      if (ifscResult.success && ifscResult.data) {
        bankName = ifscResult.data.bank;
        bankBranch = ifscResult.data.branch;
      }
    } catch { /* non-fatal */ }


    console.log(`[AgentEmpanelment] Bank verify: acct=****${accountNumber.slice(-4)} ifsc=${ifscCode.toUpperCase()} name="${accountHolderName}"`);
    const result = await verifyBankAccountPennyDrop(accountNumber, ifscCode.toUpperCase(), accountHolderName);
    if (!result.success) {
      console.warn(`[AgentEmpanelment] Bank verify FAILED: ${result.errorMessage}`, result.providerResponse);
    }

    const nameMatch = result.nameMatchScore ? isNameMatchAcceptable(result.nameMatchScore) : false;
    const verified = result.success && nameMatch;

    await getOrCreateEmpanelment(agentId);
    await db.execute(sql`
      UPDATE agent_empanelments
      SET bank_account_number    = ${accountNumber},
          bank_ifsc              = ${ifscCode.toUpperCase()},
          bank_account_holder_name = ${accountHolderName},
          bank_name              = ${bankName},
          bank_branch            = ${bankBranch},
          bank_verified          = ${verified},
          bank_verified_at       = ${verified ? new Date().toISOString() : null},
          bank_penny_drop_ref    = ${result.transactionId ?? null},
          bank_name_match_score  = ${result.nameMatchScore ?? null},
          current_step = GREATEST(current_step, ${verified ? 5 : 4}),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);

    if (verified) {
      await db.execute(sql`
        UPDATE users
        SET bank_account_number    = ${accountNumber},
            ifsc_code              = ${ifscCode.toUpperCase()},
            bank_account_holder_name = ${accountHolderName},
            bank_verified          = true
        WHERE id = ${agentId}
      `);
    }

    res.json({
      success: result.success,
      verified,
      bankName,
      bankBranch,
      nameMatchScore: result.nameMatchScore,
      message: verified
        ? `Bank account verified ✓ (${bankName}${bankBranch ? " – " + bankBranch : ""})`
        : result.success && !nameMatch
          ? "Bank account found but name doesn't match sufficiently. Please check the name on the account."
          : (result.errorMessage || "Bank verification failed. Please check account details.")
    });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Bank verify error:", err);
    res.status(500).json({ success: false, verified: false, error: err.message });
  }
});

// POST /api/agent/empanelment/step/4/save — save bank details without re-verifying
router.post("/step/4/save", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });
    const { accountNumber, ifscCode, accountHolderName, bankName, bankBranch } = req.body;

    await getOrCreateEmpanelment(agentId);
    await db.execute(sql`
      UPDATE agent_empanelments
      SET bank_account_number    = ${accountNumber ?? null},
          bank_ifsc              = ${ifscCode ?? null},
          bank_account_holder_name = ${accountHolderName ?? null},
          bank_name              = ${bankName ?? null},
          bank_branch            = ${bankBranch ?? null},
          current_step = GREATEST(current_step, 4),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/step/5 — save document references
router.post("/step/5", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { docNismCertificate, docGraduationCertificate, docPanCard, docCancelledCheque, docPhoto } = req.body;

    await getOrCreateEmpanelment(agentId);
    await db.execute(sql`
      UPDATE agent_empanelments
      SET doc_nism_certificate       = ${docNismCertificate ?? null},
          doc_graduation_certificate = ${docGraduationCertificate ?? null},
          doc_pan_card               = ${docPanCard ?? null},
          doc_cancelled_cheque       = ${docCancelledCheque ?? null},
          doc_photo                  = ${docPhoto ?? null},
          current_step = GREATEST(current_step, 6),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);
    res.json({ success: true, step: 5 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/step/6 — save declarations
router.post("/step/6", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { pmlaDeclarationSigned, criminalRecordDeclaration, fatcaDeclarationSigned, codeOfConductAccepted, antiMisSellingAccepted } = req.body;

    if (!pmlaDeclarationSigned || !fatcaDeclarationSigned || !codeOfConductAccepted || !antiMisSellingAccepted) {
      return res.status(400).json({ error: "All compliance declarations are mandatory" });
    }

    await getOrCreateEmpanelment(agentId);
    await db.execute(sql`
      UPDATE agent_empanelments
      SET pmla_declaration_signed  = ${pmlaDeclarationSigned},
          pmla_signed_at           = ${pmlaDeclarationSigned ? new Date().toISOString() : null},
          criminal_record_declaration = ${criminalRecordDeclaration ?? false},
          fatca_declaration_signed    = ${fatcaDeclarationSigned},
          code_of_conduct_accepted    = ${codeOfConductAccepted},
          anti_mis_selling_accepted   = ${antiMisSellingAccepted},
          current_step = GREATEST(current_step, 7),
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);
    res.json({ success: true, step: 6 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/aadhaar/send-otp — send real OTP to agent's own Aadhaar-linked mobile
router.post("/aadhaar/send-otp", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { aadhaarNumber } = req.body;
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ success: false, message: "Valid 12-digit Aadhaar number is required" });
    }

    const { kycEnvironmentService } = await import('../services/kyc-environment-service');
    const isDemoMode = kycEnvironmentService.isSandbox();

    if (isDemoMode) {
      return res.json({
        success: true,
        referenceId: `demo_ref_${Date.now()}`,
        message: "Sandbox mode: Use OTP 123456 to verify",
        environment: 'sandbox',
        testOtp: '123456',
      });
    }

    const { sandboxKYCService } = await import('../services/sandbox-kyc-service');
    const result = await sandboxKYCService.generateAadhaarOTP(
      aadhaarNumber,
      'Agent identity verification for empanelment'
    );

    const isMockFallback = result.referenceId.startsWith('mock_ref');
    console.log(`[AgentEmpanelment] Aadhaar OTP ${isMockFallback ? 'MOCK (SANDBOX_BASE_URL not set)' : 'sent'} for agent ${agentId}, ref: ${result.referenceId}`);

    return res.json({
      success: true,
      referenceId: result.referenceId,
      message: isMockFallback
        ? "Sandbox mode (SANDBOX_BASE_URL not configured): Use OTP 123456"
        : result.message || "OTP sent to your Aadhaar-linked mobile number",
      validFor: result.validFor,
      environment: isMockFallback ? 'sandbox' : 'production',
      ...(isMockFallback ? { testOtp: '123456' } : {}),
    });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Aadhaar OTP send error:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Failed to send OTP" });
  }
});

// POST /api/agent/empanelment/aadhaar/verify-otp — verify OTP
router.post("/aadhaar/verify-otp", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const { referenceId, otp, aadhaarNumber } = req.body;
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "Valid 6-digit OTP is required" });
    }

    const { kycEnvironmentService } = await import('../services/kyc-environment-service');
    const isDemoMode = kycEnvironmentService.isSandbox();

    let verified = false;
    if (isDemoMode) {
      verified = otp === '123456';
    } else {
      if (!referenceId) return res.status(400).json({ success: false, message: "Reference ID is required" });
      const { sandboxKYCService } = await import('../services/sandbox-kyc-service');
      const result = await sandboxKYCService.verifyAadhaarOTP(referenceId, otp);
      verified = result.verified;
    }

    if (!verified) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    const last4 = aadhaarNumber ? String(aadhaarNumber).slice(-4) : '****';
    console.log(`[AgentEmpanelment] Aadhaar verified for agent ${agentId} (****${last4})`);

    return res.json({ success: true, verified: true, last4, message: "Aadhaar verified successfully" });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Aadhaar OTP verify error:", err.message);
    return res.status(400).json({ success: false, message: err.message || "OTP verification failed" });
  }
});

// POST /api/agent/empanelment/submit — final submission
router.post("/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ error: "Unauthenticated" });

    const rows = await db.execute(sql`SELECT * FROM agent_empanelments WHERE agent_id = ${agentId}`);
    if (rows.rows.length === 0) return res.status(404).json({ error: "Empanelment not found" });
    const rec = rows.rows[0] as any;

    // Readiness checks
    if (!rec.pan_verified) return res.status(400).json({ error: "PAN verification is required before submission" });
    if (!rec.bank_verified) return res.status(400).json({ error: "Bank account must be verified via penny drop before submission" });
    if (!rec.pmla_declaration_signed || !rec.code_of_conduct_accepted || !rec.fatca_declaration_signed) {
      return res.status(400).json({ error: "All compliance declarations must be signed" });
    }
    if (rec.status === 'submitted' || rec.status === 'under_review') {
      return res.status(400).json({ error: "Application already submitted and under review" });
    }
    if (rec.status === 'approved') {
      return res.status(400).json({ error: "Your empanelment is already approved" });
    }

    await db.execute(sql`
      UPDATE agent_empanelments
      SET status       = 'submitted',
          submitted_at = NOW(),
          current_step = 7,
          updated_at   = NOW()
      WHERE agent_id = ${agentId}
    `);

    await db.execute(sql`
      UPDATE users
      SET agent_empanelment_status = 'submitted'
      WHERE id = ${agentId}
    `);

    res.json({ success: true, message: "Empanelment application submitted. Admin will review within 2–3 business days." });
  } catch (err: any) {
    console.error("[AgentEmpanelment] Submit error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /api/agent/empanelment/admin/list — list all submissions for review
router.get("/admin/list", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'admin') return res.status(403).json({ error: "Admin only" });

    const { status } = req.query;
    const rows = await db.execute(sql`
      SELECT e.*,
             u.first_name, u.last_name, u.email, u.mobile, u.profile_image_url
      FROM agent_empanelments e
      JOIN users u ON u.id = e.agent_id
      ${status ? sql`WHERE e.status = ${status as string}` : sql`WHERE e.status IN ('submitted','under_review','approved','rejected')`}
      ORDER BY e.submitted_at DESC NULLS LAST
    `);
    res.json({ success: true, empanelments: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/empanelment/admin/review/:agentId — approve or reject
router.post("/admin/review/:agentId", async (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || adminUser.role !== 'admin') return res.status(403).json({ error: "Admin only" });

    const { agentId } = req.params;
    const { action, notes } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.execute(sql`
      UPDATE agent_empanelments
      SET status          = ${newStatus},
          reviewed_by     = ${adminUser.id},
          reviewed_at     = NOW(),
          rejection_reason = ${action === 'reject' ? (notes ?? null) : null},
          approval_notes  = ${action === 'approve' ? (notes ?? null) : null},
          updated_at      = NOW()
      WHERE agent_id = ${agentId}
    `);

    await db.execute(sql`
      UPDATE users
      SET agent_empanelment_status = ${newStatus},
          is_agent = ${action === 'approve' ? true : false}
      WHERE id = ${agentId}
    `);

    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
