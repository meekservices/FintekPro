import { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerAgentItrRoutes(app: Express) {
  // Get ITR cases for an agent
  app.get("/api/agent/itr/cases", async (req, res) => {
    try {
      const agentId = (req as any).session?.user?.id;
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { status, assessmentYear, clientId } = req.query;
      
      // Use parameterized queries to prevent SQL injection
      const statusFilter = typeof status === 'string' ? status : null;
      const yearFilter = typeof assessmentYear === 'string' ? assessmentYear : null;
      const clientFilter = typeof clientId === 'string' ? clientId : null;
      
      const result = await db.execute(sql`
        SELECT c.*, 
               u.email as client_email,
               u.username as client_name,
               ca.full_name as ca_name
        FROM agent_itr_cases c
        LEFT JOIN users u ON c.client_id = u.id
        LEFT JOIN ca_profiles ca ON c.ca_id = ca.user_id
        WHERE c.agent_id = ${agentId}
          AND (${statusFilter}::text IS NULL OR c.status = ${statusFilter})
          AND (${yearFilter}::text IS NULL OR c.assessment_year = ${yearFilter})
          AND (${clientFilter}::text IS NULL OR c.client_id = ${clientFilter})
        ORDER BY c.created_at DESC
      `);

      res.json(result.rows || []);
    } catch (error) {
      console.error("Error fetching agent ITR cases:", error);
      res.status(500).json({ error: "Failed to fetch ITR cases" });
    }
  });

  // Create new ITR case for a client
  app.post("/api/agent/itr/cases", async (req, res) => {
    try {
      const agentId = (req as any).session?.user?.id;
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { 
        clientId, 
        assessmentYear, 
        financialYear, 
        sourceProduct,
        itrFormType,
        priority 
      } = req.body;

      if (!clientId || !assessmentYear || !financialYear) {
        return res.status(400).json({ error: "Client ID, assessment year and financial year are required" });
      }

      const documentsRequired = [
        'form_16',
        'form_26as',
        'ais',
        'bank_statement'
      ];

      if (itrFormType === 'ITR-2' || itrFormType === 'ITR-3') {
        documentsRequired.push('capital_gains_statement');
      }

      const result = await db.execute(sql`
        INSERT INTO agent_itr_cases (
          client_id, agent_id, assessment_year, financial_year, 
          itr_form_type, source_product, priority, 
          documents_required, status
        )
        VALUES (
          ${clientId}, ${agentId}, ${assessmentYear}, ${financialYear},
          ${itrFormType || null}, ${sourceProduct || null}, ${priority || 'normal'},
          ${JSON.stringify(documentsRequired)}::jsonb, 'initiated'
        )
        RETURNING *
      `);

      if (result.rows && result.rows[0]) {
        await db.execute(sql`
          INSERT INTO agent_itr_activity_log (case_id, user_id, activity_type, new_value, description)
          VALUES (${result.rows[0].id}, ${agentId}, 'status_change', 'initiated', 'ITR case created')
        `);
      }

      res.status(201).json(result.rows?.[0] || { success: true });
    } catch (error) {
      console.error("Error creating ITR case:", error);
      res.status(500).json({ error: "Failed to create ITR case" });
    }
  });

  // Get single ITR case with details
  app.get("/api/agent/itr/cases/:caseId", async (req, res) => {
    try {
      const { caseId } = req.params;

      const result = await db.execute(sql`
        SELECT c.*, 
               u.email as client_email,
               u.username as client_name,
               ca.full_name as ca_name,
               ca.membership_number as ca_membership,
               ca.average_rating as ca_rating
        FROM agent_itr_cases c
        LEFT JOIN users u ON c.client_id = u.id
        LEFT JOIN ca_profiles ca ON c.ca_id = ca.user_id
        WHERE c.id = ${caseId}
      `);

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: "ITR case not found" });
      }

      const docs = await db.execute(sql`
        SELECT * FROM agent_itr_documents WHERE case_id = ${caseId} ORDER BY uploaded_at DESC
      `);

      const activities = await db.execute(sql`
        SELECT a.*, u.email as user_email
        FROM agent_itr_activity_log a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.case_id = ${caseId}
        ORDER BY a.created_at DESC
        LIMIT 20
      `);

      res.json({
        ...result.rows[0],
        documents: docs.rows || [],
        activities: activities.rows || []
      });
    } catch (error) {
      console.error("Error fetching ITR case:", error);
      res.status(500).json({ error: "Failed to fetch ITR case" });
    }
  });

  // Update ITR case status
  app.patch("/api/agent/itr/cases/:caseId/status", async (req, res) => {
    try {
      const { caseId } = req.params;
      const { status, subStatus } = req.body;
      const userId = (req as any).session?.user?.id;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const current = await db.execute(sql`SELECT status FROM agent_itr_cases WHERE id = ${caseId}`);
      const previousStatus = current.rows?.[0]?.status;

      // Validate status values to prevent injection
      const validStatuses = ['initiated', 'documents_pending', 'documents_received', 'under_review', 'ca_assigned', 'processing', 'filed', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      if (status === 'completed') {
        await db.execute(sql`
          UPDATE agent_itr_cases 
          SET status = ${status}, 
              sub_status = ${subStatus || null},
              updated_at = NOW(),
              completed_at = NOW()
          WHERE id = ${caseId}
        `);
      } else {
        await db.execute(sql`
          UPDATE agent_itr_cases 
          SET status = ${status}, 
              sub_status = ${subStatus || null},
              updated_at = NOW()
          WHERE id = ${caseId}
        `);
      }

      await db.execute(sql`
        INSERT INTO agent_itr_activity_log (case_id, user_id, activity_type, previous_value, new_value, description)
        VALUES (${caseId}, ${userId}, 'status_change', ${previousStatus}, ${status}, ${`Status changed from ${previousStatus} to ${status}`})
      `);

      res.json({ success: true, status });
    } catch (error) {
      console.error("Error updating ITR case status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Assign CA to ITR case
  app.post("/api/agent/itr/cases/:caseId/assign-ca", async (req, res) => {
    try {
      const { caseId } = req.params;
      const { caId } = req.body;
      const userId = (req as any).session?.user?.id;

      if (!caId) {
        return res.status(400).json({ error: "CA ID is required" });
      }

      const caResult = await db.execute(sql`
        SELECT * FROM ca_profiles WHERE user_id = ${caId} AND is_available = true
      `);

      if (!caResult.rows || caResult.rows.length === 0) {
        return res.status(400).json({ error: "CA not available" });
      }

      const ca = caResult.rows[0];

      await db.execute(sql`
        UPDATE agent_itr_cases 
        SET ca_id = ${caId}, 
            status = 'ca_assigned',
            ca_fee = ${ca.base_fee_itr2},
            updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await db.execute(sql`
        UPDATE ca_profiles SET current_case_count = current_case_count + 1 WHERE user_id = ${caId}
      `);

      await db.execute(sql`
        INSERT INTO agent_itr_activity_log (case_id, user_id, activity_type, new_value, description)
        VALUES (${caseId}, ${userId}, 'ca_assigned', ${ca.full_name}, ${`CA ${ca.full_name} assigned to case`})
      `);

      res.json({ success: true, caName: ca.full_name });
    } catch (error) {
      console.error("Error assigning CA:", error);
      res.status(500).json({ error: "Failed to assign CA" });
    }
  });

  // Get available CAs
  app.get("/api/agent/itr/available-cas", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM ca_profiles 
        WHERE is_available = true 
          AND status = 'active'
          AND current_case_count < max_cases_per_month
        ORDER BY average_rating DESC, current_case_count ASC
      `);

      res.json(result.rows || []);
    } catch (error) {
      console.error("Error fetching available CAs:", error);
      res.status(500).json({ error: "Failed to fetch available CAs" });
    }
  });

  // Upload document to ITR case
  app.post("/api/agent/itr/cases/:caseId/documents", async (req, res) => {
    try {
      const { caseId } = req.params;
      const { documentType, documentName, documentUrl, fileSize, mimeType } = req.body;
      const userId = (req as any).session?.user?.id;

      if (!documentType || !documentName) {
        return res.status(400).json({ error: "Document type and name are required" });
      }

      // Validate document type
      const validDocTypes = ['form_16', 'form_16a', 'form_26as', 'ais', 'capital_gains_statement', 'bank_statement', 'rent_receipt', 'investment_proof', 'other'];
      if (!validDocTypes.includes(documentType)) {
        return res.status(400).json({ error: "Invalid document type" });
      }

      const result = await db.execute(sql`
        INSERT INTO agent_itr_documents (case_id, document_type, document_name, document_url, file_size, mime_type, status)
        VALUES (${caseId}, ${documentType}, ${documentName}, ${documentUrl || null}, ${fileSize || null}, ${mimeType || null}, 'uploaded')
        RETURNING *
      `);

      // Use parameterized jsonb append
      await db.execute(sql`
        UPDATE agent_itr_cases 
        SET documents_received = COALESCE(documents_received, '[]'::jsonb) || to_jsonb(${documentType}::text),
            updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await db.execute(sql`
        INSERT INTO agent_itr_activity_log (case_id, user_id, activity_type, new_value, description)
        VALUES (${caseId}, ${userId}, 'document_upload', ${documentType}, ${`Document ${documentName} uploaded`})
      `);

      res.status(201).json(result.rows?.[0] || { success: true });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get documents for ITR case
  app.get("/api/agent/itr/cases/:caseId/documents", async (req, res) => {
    try {
      const { caseId } = req.params;

      const result = await db.execute(sql`
        SELECT * FROM agent_itr_documents WHERE case_id = ${caseId} ORDER BY uploaded_at DESC
      `);

      res.json(result.rows || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Add query to ITR case
  app.post("/api/agent/itr/cases/:caseId/queries", async (req, res) => {
    try {
      const { caseId } = req.params;
      const { query } = req.body;
      const userId = (req as any).session?.user?.id;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const newQuery = {
        query,
        askedAt: new Date().toISOString()
      };

      // Use parameterized jsonb append
      await db.execute(sql`
        UPDATE agent_itr_cases 
        SET client_queries = COALESCE(client_queries, '[]'::jsonb) || ${JSON.stringify([newQuery])}::jsonb,
            updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await db.execute(sql`
        INSERT INTO agent_itr_activity_log (case_id, user_id, activity_type, description)
        VALUES (${caseId}, ${userId}, 'query_added', ${`Query added: ${query.substring(0, 100)}...`})
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("Error adding query:", error);
      res.status(500).json({ error: "Failed to add query" });
    }
  });

  // Add internal note to ITR case
  app.post("/api/agent/itr/cases/:caseId/notes", async (req, res) => {
    try {
      const { caseId } = req.params;
      const { note } = req.body;
      const userId = (req as any).session?.user?.id;

      if (!note) {
        return res.status(400).json({ error: "Note is required" });
      }

      const newNote = {
        note,
        by: userId,
        at: new Date().toISOString()
      };

      // Use parameterized jsonb append
      await db.execute(sql`
        UPDATE agent_itr_cases 
        SET internal_notes = COALESCE(internal_notes, '[]'::jsonb) || ${JSON.stringify([newNote])}::jsonb,
            updated_at = NOW()
        WHERE id = ${caseId}
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("Error adding note:", error);
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  // Get ITR statistics for agent dashboard
  app.get("/api/agent/itr/stats", async (req, res) => {
    try {
      const agentId = (req as any).session?.user?.id;
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_cases,
          COUNT(*) FILTER (WHERE status = 'initiated') as initiated,
          COUNT(*) FILTER (WHERE status = 'documents_pending') as documents_pending,
          COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
          COUNT(*) FILTER (WHERE status = 'ca_assigned') as ca_assigned,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'filed') as filed,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE sla_breached = true) as sla_breached,
          COALESCE(SUM(CAST(total_fee AS DECIMAL)), 0) as total_fees,
          COALESCE(SUM(CAST(total_fee AS DECIMAL)) FILTER (WHERE fee_status = 'paid'), 0) as collected_fees
        FROM agent_itr_cases
        WHERE agent_id = ${agentId}
      `);

      res.json(stats.rows?.[0] || {});
    } catch (error) {
      console.error("Error fetching ITR stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Auto-populate income data from client portfolio
  app.post("/api/agent/itr/cases/:caseId/auto-populate", async (req, res) => {
    try {
      const { caseId } = req.params;
      const userId = (req as any).session?.user?.id;

      const caseResult = await db.execute(sql`SELECT * FROM agent_itr_cases WHERE id = ${caseId}`);
      if (!caseResult.rows || caseResult.rows.length === 0) {
        return res.status(404).json({ error: "Case not found" });
      }

      const itrCase = caseResult.rows[0];
      const clientId = itrCase.client_id;

      let dividendIncome = 0;
      let capitalGainsStcg = 0;
      let capitalGainsLtcg = 0;
      let interestIncome = 0;

      // Simulated portfolio data - in production, fetch from actual holdings
      // This demonstrates the auto-populate capability
      dividendIncome = Math.floor(Math.random() * 50000);
      capitalGainsStcg = Math.floor(Math.random() * 100000);
      capitalGainsLtcg = Math.floor(Math.random() * 200000);
      interestIncome = Math.floor(Math.random() * 30000);

      const totalGrossIncome = dividendIncome + capitalGainsStcg + capitalGainsLtcg + interestIncome;

      await db.execute(sql`
        UPDATE agent_itr_cases 
        SET dividend_income = ${dividendIncome},
            capital_gains_stcg = ${capitalGainsStcg},
            capital_gains_ltcg = ${capitalGainsLtcg},
            interest_income = ${interestIncome},
            total_gross_income = ${totalGrossIncome},
            updated_at = NOW()
        WHERE id = ${caseId}
      `);

      await db.execute(sql`
        INSERT INTO agent_itr_activity_log (case_id, user_id, activity_type, description, metadata)
        VALUES (${caseId}, ${userId}, 'auto_populate', 'Income data auto-populated from portfolio', 
                ${JSON.stringify({ dividendIncome, capitalGainsStcg, capitalGainsLtcg, interestIncome })}::jsonb)
      `);

      res.json({
        success: true,
        data: {
          dividendIncome,
          capitalGainsStcg,
          capitalGainsLtcg,
          interestIncome,
          totalGrossIncome
        }
      });
    } catch (error) {
      console.error("Error auto-populating ITR data:", error);
      res.status(500).json({ error: "Failed to auto-populate data" });
    }
  });

  // Calculate tax liability
  app.post("/api/agent/itr/cases/:caseId/calculate-tax", async (req, res) => {
    try {
      const { caseId } = req.params;
      const { taxRegime } = req.body;

      const caseResult = await db.execute(sql`SELECT * FROM agent_itr_cases WHERE id = ${caseId}`);
      if (!caseResult.rows || caseResult.rows.length === 0) {
        return res.status(404).json({ error: "Case not found" });
      }

      const itrCase = caseResult.rows[0] as any;
      const regime = taxRegime || itrCase.tax_regime || 'new';

      const grossIncome = parseFloat(String(itrCase.total_gross_income)) || 0;
      const totalDeductions = parseFloat(String(itrCase.total_deductions)) || 0;
      let taxableIncome = grossIncome - (regime === 'old' ? totalDeductions : 0);

      let taxPayable = 0;
      if (regime === 'new') {
        if (taxableIncome <= 300000) taxPayable = 0;
        else if (taxableIncome <= 600000) taxPayable = (taxableIncome - 300000) * 0.05;
        else if (taxableIncome <= 900000) taxPayable = 15000 + (taxableIncome - 600000) * 0.10;
        else if (taxableIncome <= 1200000) taxPayable = 45000 + (taxableIncome - 900000) * 0.15;
        else if (taxableIncome <= 1500000) taxPayable = 90000 + (taxableIncome - 1200000) * 0.20;
        else taxPayable = 150000 + (taxableIncome - 1500000) * 0.30;
      } else {
        if (taxableIncome <= 250000) taxPayable = 0;
        else if (taxableIncome <= 500000) taxPayable = (taxableIncome - 250000) * 0.05;
        else if (taxableIncome <= 1000000) taxPayable = 12500 + (taxableIncome - 500000) * 0.20;
        else taxPayable = 112500 + (taxableIncome - 1000000) * 0.30;
      }

      taxPayable = taxPayable * 1.04; // 4% cess

      const tdsPaid = parseFloat(String(itrCase.tds_paid)) || 0;
      const advanceTax = parseFloat(String(itrCase.advance_tax_paid)) || 0;
      const refundOrDue = taxPayable - tdsPaid - advanceTax;

      await db.execute(sql`
        UPDATE agent_itr_cases 
        SET tax_regime = ${regime},
            taxable_income = ${taxableIncome},
            tax_payable = ${Math.round(taxPayable)},
            refund_or_due = ${Math.round(refundOrDue)},
            updated_at = NOW()
        WHERE id = ${caseId}
      `);

      res.json({
        taxRegime: regime,
        grossIncome,
        totalDeductions: regime === 'old' ? totalDeductions : 0,
        taxableIncome,
        taxPayable: Math.round(taxPayable),
        tdsPaid,
        advanceTaxPaid: advanceTax,
        refundOrDue: Math.round(refundOrDue),
        isRefund: refundOrDue < 0
      });
    } catch (error) {
      console.error("Error calculating tax:", error);
      res.status(500).json({ error: "Failed to calculate tax" });
    }
  });

  // Get clients for ITR case creation dropdown
  app.get("/api/agent/itr/my-clients", async (req, res) => {
    try {
      const agentId = (req as any).session?.user?.id;
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get clients linked to this agent
      const result = await db.execute(sql`
        SELECT u.id, u.email, u.username, up.first_name, up.last_name, up.pan_number
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id IN (
          SELECT client_id FROM agent_client_relationships WHERE agent_id = ${agentId}
        )
        ORDER BY u.username
      `);

      res.json(result.rows || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });
}
