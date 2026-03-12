import { Express, Response } from 'express';
import { partnerService } from '../../partner-service';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { registerPartnerHierarchyRoutes } from './hierarchy-routes';

async function ensurePartnerTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partner_team_members (
        id            SERIAL PRIMARY KEY,
        partner_user_id  VARCHAR(255) NOT NULL,
        agent_user_id    VARCHAR(255) NOT NULL,
        role             TEXT NOT NULL DEFAULT 'agent',
        commission_split_pct NUMERIC(5,2) DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'active',
        joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (partner_user_id, agent_user_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partner_agent_invitations (
        id                   SERIAL PRIMARY KEY,
        partner_user_id      VARCHAR(255) NOT NULL,
        invite_code          VARCHAR(50) NOT NULL UNIQUE,
        invitee_name         TEXT,
        invitee_email        TEXT,
        invitee_mobile       TEXT,
        status               TEXT NOT NULL DEFAULT 'pending',
        accepted_by_user_id  VARCHAR(255),
        accepted_at          TIMESTAMPTZ,
        expires_at           TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ [PartnerTables] partner_team_members + partner_agent_invitations ready");
  } catch (err: any) {
    console.error("[PartnerTables] Table init error:", err.message);
  }
}
ensurePartnerTables();

export function registerPartnerPortalRoutes(app: Express): void {
  // Partner Authentication
  app.post("/api/partner/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const partner = await partnerService.authenticatePartner(email, password);
      
      if (!partner) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Store partner in session
      (req as any).partner = partner;
      res.json({ 
        id: partner.id, 
        companyName: partner.companyName,
        contactEmail: partner.contactEmail,
        partnerType: partner.partnerType,
        permissions: partner.permissions
      });
    } catch (error) {
      console.error("Partner login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Partner middleware to check authentication
  const requirePartner = async (req: any, res: any, next: any) => {
    // Check session-based auth first (user logged in via normal login flow with partner role)
    if (req.isAuthenticated?.() && req.user) {
      const userRoles = req.user.roles || [];
      if (userRoles.includes('partner') || userRoles.includes('admin') || userRoles.includes('superadmin')) {
        req.partner = {
          id: req.user.id,
          companyName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Partner',
          contactEmail: req.user.email,
          partnerType: 'distributor',
          permissions: ['read', 'write'],
        };
        return next();
      }
    }

    // Dev mode fallback
    if (process.env.NODE_ENV === 'development' && !req.headers.authorization) {
      req.partner = {
        id: 'central-test-user',
        companyName: 'Test SuperUser',
        contactEmail: 'test@fintekpro.com',
        partnerType: 'distributor',
        permissions: ['read', 'write'],
      };
      return next();
    }

    // Fallback: Basic auth via Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Partner authentication required" });
    }

    try {
      const [email, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
      const partner = await partnerService.authenticatePartner(email, password);
      
      if (!partner) {
        return res.status(401).json({ message: "Invalid partner credentials" });
      }

      req.partner = partner;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid authentication format" });
    }
  };

  // Basic user authentication middleware for investment proposals
  const authenticateUser = async (req: any, res: any, next: any) => {
    // First check if user is authenticated via passport session
    if (req.isAuthenticated?.() && req.user) {
      return next();
    }
    
    // Fallback: Check authorization header for basic auth or token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      // Try basic auth format (email:password base64 encoded)
      if (authHeader.startsWith('Basic ')) {
        const [email, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const { storage } = await import("../../storage");
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        
        // Verify password
        const bcrypt = await import("bcryptjs");
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        
        req.user = {
          id: user.id,
          role: user.roles?.[0] || "client",
          email: user.email
        };
        return next();
      }
      
      return res.status(401).json({ error: "Invalid authentication format" });
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(401).json({ error: "Authentication failed" });
    }
  };

  // Partner Dashboard
  app.get("/api/partner/dashboard", requirePartner, async (req, res) => {
    try {
      const partnerId = req.partner.id;
      const stats = await partnerService.getPartnerStats(partnerId);
      
      res.json({
        partner: {
          id: req.partner.id,
          companyName: req.partner.companyName,
          partnerType: req.partner.partnerType
        },
        stats
      });
    } catch (error) {
      console.error("Error fetching partner dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // ============ PRODUCT MANAGEMENT ROUTES ============

  // Get all products for partner
  app.get("/api/partner/products", requirePartner, async (req, res) => {
    try {
      const partnerId = req.partner.id;
      const products = await partnerService.getProductsByPartner(partnerId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get single product
  app.get("/api/partner/products/:id", requirePartner, async (req, res) => {
    try {
      const product = await partnerService.getProduct(req.params.id);
      
      if (!product || product.partnerId !== req.partner.id) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Get product metrics
      const metrics = await partnerService.getProductMetrics(product.id);
      
      res.json({ product, metrics });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Create new product
  app.post("/api/partner/products", requirePartner, async (req, res) => {
    try {
      const productData = {
        ...req.body,
        partnerId: req.partner.id
      };

      // Generate slug from name if not provided
      if (!productData.slug && productData.name) {
        productData.slug = productData.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      const product = await partnerService.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // Update product
  app.put("/api/partner/products/:id", requirePartner, async (req, res) => {
    try {
      const product = await partnerService.getProduct(req.params.id);
      
      if (!product || product.partnerId !== req.partner.id) {
        return res.status(404).json({ error: "Product not found" });
      }

      const updates = { ...req.body };
      delete updates.partnerId; // Prevent changing partner
      delete updates.id; // Prevent changing ID
      
      const updatedProduct = await partnerService.updateProduct(req.params.id, updates);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Delete product
  app.delete("/api/partner/products/:id", requirePartner, async (req, res) => {
    try {
      const product = await partnerService.getProduct(req.params.id);
      
      if (!product || product.partnerId !== req.partner.id) {
        return res.status(404).json({ error: "Product not found" });
      }

      const success = await partnerService.deleteProduct(req.params.id);
      
      if (success) {
        res.json({ message: "Product deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete product" });
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // ============ SUPPORT TICKET ROUTES ============

  // Get support tickets assigned to partner
  app.get("/api/partner/support/tickets", requirePartner, async (req, res) => {
    try {
      const partnerId = req.partner.id;
      const tickets = await partnerService.getTicketsByPartner(partnerId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      res.status(500).json({ error: "Failed to fetch support tickets" });
    }
  });

  // Get single support ticket with messages
  app.get("/api/partner/support/tickets/:id", requirePartner, async (req, res) => {
    try {
      const ticket = await partnerService.getTicket(req.params.id);
      
      if (!ticket || ticket.assignedTo !== req.partner.id) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const messages = await partnerService.getTicketMessages(ticket.id);
      
      res.json({ ticket, messages });
    } catch (error) {
      console.error("Error fetching support ticket:", error);
      res.status(500).json({ error: "Failed to fetch support ticket" });
    }
  });

  // Update support ticket status
  app.put("/api/partner/support/tickets/:id", requirePartner, async (req, res) => {
    try {
      const ticket = await partnerService.getTicket(req.params.id);
      
      if (!ticket || ticket.assignedTo !== req.partner.id) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const { status, resolution } = req.body;
      const updates: any = { status };
      
      if (status === 'resolved' && resolution) {
        updates.resolution = resolution;
        updates.resolvedAt = new Date();
      }

      const updatedTicket = await partnerService.updateTicket(req.params.id, updates);
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating support ticket:", error);
      res.status(500).json({ error: "Failed to update support ticket" });
    }
  });

  // Add message to support ticket
  app.post("/api/partner/support/tickets/:id/messages", requirePartner, async (req, res) => {
    try {
      const ticket = await partnerService.getTicket(req.params.id);
      
      if (!ticket || ticket.assignedTo !== req.partner.id) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const messageData = {
        ticketId: req.params.id,
        senderId: req.partner.id,
        senderType: 'partner' as const,
        senderName: req.partner.companyName,
        message: req.body.message,
        messageType: req.body.messageType || 'text',
        isInternal: req.body.isInternal || false,
        attachments: req.body.attachments || []
      };

      const message = await partnerService.addTicketMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error adding ticket message:", error);
      res.status(500).json({ error: "Failed to add message" });
    }
  });

  // Create new support ticket (for clients)
  app.post("/api/support/tickets", async (req, res) => {
    try {
      const ticketData = {
        ...req.body,
        assignedTo: null // Will be assigned later by admin or auto-assigned
      };

      const ticket = await partnerService.createSupportTicket(ticketData);
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating support ticket:", error);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });


  // Get support tickets for current user (by email)
  app.get("/api/support/my-tickets", async (req, res) => {
    try {
      // Get email from query param or from authenticated user
      const email = req.query.email as string || (req.user as any)?.email;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const tickets = await db
        .select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.clientEmail, email))
        .orderBy(desc(schema.supportTickets.createdAt));
      
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching user tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });
  // Handle contact form submissions
  app.post("/api/contact/submit", async (req, res) => {
    try {
      const { fullName, email, phone, company, inquiryType, subject, message } = req.body;
      
      // Validate required fields
      if (!fullName || !email || !phone || !inquiryType || !subject || !message) {
        return res.status(400).json({ error: "All required fields must be provided" });
      }

      // Create a support ticket from the contact form
      const contactTicketData = {
        clientName: fullName,
        clientEmail: email,
        clientPhone: phone,
        subject: `Contact Form: ${subject}`,
        description: `Company: ${company || 'Not specified'}\nInquiry Type: ${inquiryType}\n\nMessage:\n${message}`,
        category: inquiryType,
        priority: 'medium',
        assignedTo: null
      };

      const ticket = await partnerService.createSupportTicket(contactTicketData);
      
      // Log the contact form submission for analytics
      console.log(`[CONTACT] New contact form submission: ${inquiryType} from ${email}`);
      
      res.status(201).json({ 
        success: true, 
        message: "Contact form submitted successfully",
        ticketId: ticket.id 
      });
    } catch (error) {
      console.error("Error processing contact form:", error);
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  });

  // ============ PUBLIC PRODUCT CATALOG ROUTES ============

  // Get all public products
  app.get("/api/products", async (req, res) => {
    try {
      const { category, search } = req.query as any;
      
      let products;
      if (search) {
        products = await partnerService.searchProducts(search);
      } else if (category) {
        products = await partnerService.getProductsByCategory(category);
      } else {
        products = await partnerService.getPublicProducts();
      }
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching public products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get single public product
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await partnerService.getProduct(req.params.id);
      
      if (!product || !product.isPublic || product.status !== 'active') {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // ============ PARTNER SELF-REGISTRATION (public — no auth required) ============

  app.post("/api/partner/register", async (req: any, res) => {
    try {
      const { firstName, lastName, email, mobile, companyName, partnerType,
              arnCode, city, state, isCA, caMembershipNumber } = req.body;

      // Basic validation
      if (!firstName || !lastName || !email || !mobile || !companyName || !partnerType) {
        return res.status(400).json({ error: "Required fields missing" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return res.status(400).json({ error: "Invalid Indian mobile number" });
      }

      // Check duplicate email
      const existing = await db.execute(sql`
        SELECT id FROM users WHERE email = ${email} LIMIT 1
      `);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
      }

      // Check duplicate mobile
      const existingMobile = await db.execute(sql`
        SELECT id FROM users WHERE mobile = ${mobile} LIMIT 1
      `);
      if (existingMobile.rows.length > 0) {
        return res.status(409).json({ error: "An account with this mobile number already exists." });
      }

      // Create user account (PENDING partner role)
      const userIdCode = "PRT" + Math.floor(100000 + Math.random() * 900000);
      const userRows = await db.execute(sql`
        INSERT INTO users (
          id, user_id, first_name, last_name, email, mobile,
          roles, is_email_verified, is_mobile_verified, is_active,
          password, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${userIdCode}, ${firstName}, ${lastName},
          ${email}, ${mobile},
          ARRAY['partner']::text[], false, false, false,
          'PENDING_ACTIVATION', NOW(), NOW()
        )
        RETURNING id
      `);
      const userId = (userRows.rows[0] as any)?.id;

      // Create partners record (PENDING approval)
      await db.execute(sql`
        INSERT INTO partners (
          id, company_name, contact_email, contact_phone, partner_type,
          arn_code, hierarchy_partner_type, hierarchy_status, partner_level,
          approval_status, kyc_status, is_active, is_verified,
          ca_city, ca_state, password, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${companyName}, ${email}, ${"91" + mobile},
          ${partnerType}, ${arnCode || null}, ${partnerType.toUpperCase()},
          'PENDING_APPROVAL', 'L1', 'PENDING', 'PENDING',
          false, false,
          ${city || null}, ${state || null},
          'PENDING_ACTIVATION', NOW(), NOW()
        )
      `);

      // If CA, create empanelment record with CA flag
      if (isCA && userId) {
        await db.execute(sql`
          INSERT INTO agent_empanelments (agent_id, status, is_ca_qualified, ca_membership_number, created_at, updated_at)
          VALUES (${userId}, 'draft', ${true}, ${caMembershipNumber || null}, NOW(), NOW())
          ON CONFLICT (agent_id) DO UPDATE
          SET is_ca_qualified = true, ca_membership_number = COALESCE(${caMembershipNumber || null}, agent_empanelments.ca_membership_number)
        `);
      }

      console.log(`[PartnerRegister] New partner application: ${email} (${partnerType}) — user ${userId}`);
      res.json({ success: true, message: "Partner application submitted. Pending admin review." });
    } catch (error: any) {
      console.error("[PartnerRegister] Error:", error.message);
      if (error.code === "23505") {
        return res.status(409).json({ error: "An account with this email or mobile already exists." });
      }
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // ============ PARTNER DASHBOARD DATA ROUTES (for user-session based auth) ============

  const requirePartnerSession = (req: any, res: any, next: any) => {
    if (!req.user) {
      const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.REPL_ID;
      if (isDevelopment) {
        req.user = { id: 'central-test-user', roles: ['superadmin', 'admin', 'partner', 'agent', 'client', 'user', 'tester'], firstName: 'Test', lastName: 'SuperUser', email: 'test@fintekpro.com', userId: 'central-test-user' };
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }
    }
    const hasPartnerRole = req.user.roles?.includes('partner') || 
                           req.user.roles?.includes('admin') || 
                           req.user.roles?.includes('superadmin');
    if (!hasPartnerRole) {
      return res.status(403).json({ error: "Partner access required" });
    }
    next();
  };

  // Partner profile - returns current user's full partner profile
  app.get("/api/partner/profile", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Fetch from users table
      const userRows = await db.execute(sql`
        SELECT first_name, last_name, email, mobile, created_at, profile_image_url, roles
        FROM users WHERE id = ${userId} LIMIT 1
      `);
      const u = userRows.rows[0] as any || {};

      // Fetch from partners table (may not exist for all partners)
      let partner: any = {};
      try {
        const partnerRows = await db.execute(sql`
          SELECT company_name, partner_level, hierarchy_partner_type, hierarchy_status,
                 kyc_status, approval_status, arn_code, contact_phone,
                 pan_number, created_at as partner_created_at
          FROM partners WHERE contact_email = ${req.user.email} LIMIT 1
        `);
        if (partnerRows.rows.length > 0) partner = partnerRows.rows[0] as any;
      } catch { /* partners table may not exist */ }

      // Fetch from agent_empanelments table
      let emp: any = {};
      try {
        const empRows = await db.execute(sql`
          SELECT arn_code, pan_number, pan_verified, pan_name, aadhaar_verified,
                 euin_number, nism_certificate_number, nism_certificate_type, nism_expiry_date,
                 ria_number, posp_number, services_offered,
                 bank_account_number, bank_ifsc, bank_name, bank_branch, bank_verified,
                 bank_account_holder_name, status as emp_status
          FROM agent_empanelments WHERE agent_id = ${userId} LIMIT 1
        `);
        if (empRows.rows.length > 0) emp = empRows.rows[0] as any;
      } catch { /* may not exist */ }

      res.json({
        id: userId,
        firstName: u.first_name || req.user.firstName || "",
        lastName: u.last_name || req.user.lastName || "",
        email: u.email || req.user.email || "",
        mobile: u.mobile || partner.contact_phone || req.user.mobile || "",
        roles: u.roles || req.user.roles || [],
        profileImageUrl: u.profile_image_url || null,
        joinedAt: u.created_at || partner.partner_created_at || req.user.lastLoginAt,
        empanelmentStatus: emp.emp_status || null,
        // Partner record fields
        companyName: partner.company_name || null,
        partnerLevel: partner.partner_level || "L1",
        partnerType: partner.hierarchy_partner_type || "distributor",
        hierarchyStatus: partner.hierarchy_status || "ACTIVE",
        kycStatus: partner.kyc_status || (emp.pan_verified ? "VERIFIED" : "PENDING"),
        approvalStatus: partner.approval_status || "PENDING",
        // Credentials
        arnCode: emp.arn_code || partner.arn_code || null,
        panNumber: emp.pan_number || partner.pan_number || null,
        panVerified: emp.pan_verified || false,
        panName: emp.pan_name || null,
        aadhaarVerified: emp.aadhaar_verified || false,
        euinNumber: emp.euin_number || null,
        nismCertificateNumber: emp.nism_certificate_number || null,
        nismCertificateType: emp.nism_certificate_type || null,
        nismExpiryDate: emp.nism_expiry_date || null,
        riaNumber: emp.ria_number || null,
        pospNumber: emp.posp_number || null,
        servicesOffered: emp.services_offered || [],
        // Bank
        bankAccountNumber: emp.bank_account_number || null,
        bankIfsc: emp.bank_ifsc || null,
        bankName: emp.bank_name || null,
        bankBranch: emp.bank_branch || null,
        bankVerified: emp.bank_verified || false,
        bankAccountHolderName: emp.bank_account_holder_name || null,
        // CA qualification
        isCaQualified: emp.is_ca_qualified || false,
        caMembershipNumber: emp.ca_membership_number || null,
        caVerificationStatus: emp.ca_verification_status || "unverified",
        caVerifiedAt: emp.ca_verified_at || null,
      });
    } catch (error) {
      console.error("Error fetching partner profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // GET /api/partner/ca-status — lightweight CA qualification check for sidebar
  app.get("/api/partner/ca-status", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT is_ca_qualified, ca_membership_number
        FROM agent_empanelments WHERE agent_id = ${userId} LIMIT 1
      `);
      const emp: any = rows.rows?.[0] || {};
      res.json({ isCaQualified: emp.is_ca_qualified || false, caMembershipNumber: emp.ca_membership_number || null });
    } catch {
      res.json({ isCaQualified: false, caMembershipNumber: null });
    }
  });

  // POST /api/partner/verify-ca-membership — verify ICAI membership number
  app.post("/api/partner/verify-ca-membership", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { membershipNumber } = req.body;

      if (!membershipNumber) {
        return res.status(400).json({ error: "ICAI membership number is required" });
      }

      // Format validation: ICAI membership numbers are 6 digits (ACA/FCA)
      const cleaned = String(membershipNumber).trim().replace(/^M-?/i, ""); // strip M- prefix for life members
      if (!/^\d{6}$/.test(cleaned)) {
        return res.status(422).json({
          status: "invalid_format",
          error: "ICAI membership numbers must be exactly 6 digits (e.g. 123456). Please check and try again."
        });
      }

      // Check if another partner already claimed this ICAI number
      const dupCheck = await db.execute(sql`
        SELECT ae.agent_id FROM agent_empanelments ae
        WHERE ae.ca_membership_number = ${cleaned}
          AND ae.agent_id != ${userId}
          AND ae.is_ca_qualified = true
        LIMIT 1
      `);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          status: "duplicate",
          error: "This ICAI membership number is already registered with another partner account. Contact support if you believe this is an error."
        });
      }

      // --- Karza API integration (real-time ICAI verification) ---
      const karzaKey = process.env.KARZA_API_KEY;
      if (karzaKey) {
        try {
          const karzaRes = await fetch("https://api.karza.in/v3/sync/icai-member-check", {
            method: "POST",
            headers: {
              "x-karza-key": karzaKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ membershipNo: cleaned }),
            signal: AbortSignal.timeout(8000),
          });
          const karzaData: any = await karzaRes.json();
          console.log(`[CAVerify] Karza response for ${cleaned}:`, JSON.stringify(karzaData).slice(0, 200));

          const isVerified = karzaData?.statusCode === 101 || karzaData?.result?.memberStatus === "Active";
          const memberName = karzaData?.result?.memberName || karzaData?.result?.name || null;
          const memberType = karzaData?.result?.membershipType || null; // ACA / FCA

          if (isVerified) {
            await db.execute(sql`
              UPDATE agent_empanelments
              SET ca_verification_status = 'verified',
                  ca_membership_number = ${cleaned},
                  ca_verified_at = NOW(),
                  ca_verified_by = 'karza',
                  updated_at = NOW()
              WHERE agent_id = ${userId}
            `);
            return res.json({
              status: "verified",
              membershipNumber: cleaned,
              memberName,
              memberType,
              message: `ICAI membership ${cleaned} verified successfully via ICAI registry.`,
            });
          } else {
            await db.execute(sql`
              UPDATE agent_empanelments
              SET ca_verification_status = 'failed', updated_at = NOW()
              WHERE agent_id = ${userId}
            `);
            return res.status(422).json({
              status: "not_found",
              error: `Membership number ${cleaned} was not found in the ICAI registry, or the membership is inactive. Please verify the number and retry.`,
            });
          }
        } catch (karzaErr: any) {
          console.warn("[CAVerify] Karza API error, falling back:", karzaErr.message);
          // Fall through to format-valid fallback
        }
      }

      // --- Fallback: format is valid, update to 'pending_review' (admin will manually verify) ---
      await db.execute(sql`
        UPDATE agent_empanelments
        SET ca_verification_status = 'pending_review',
            ca_membership_number = ${cleaned},
            updated_at = NOW()
        WHERE agent_id = ${userId}
      `);

      res.json({
        status: "pending_review",
        membershipNumber: cleaned,
        message: "Format is valid. Your ICAI membership number has been submitted for manual admin verification. You will be notified once verified.",
      });
    } catch (error: any) {
      console.error("[CAVerify] Error:", error.message);
      res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });

  // PATCH /api/partner/profile — update personal info + CA qualification
  app.patch("/api/partner/profile", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, mobile, companyName, isCaQualified, caMembershipNumber } = req.body;
      await db.execute(sql`
        UPDATE users
        SET first_name = COALESCE(${firstName ?? null}, first_name),
            last_name  = COALESCE(${lastName ?? null}, last_name),
            mobile     = COALESCE(${mobile ?? null}, mobile),
            updated_at = NOW()
        WHERE id = ${userId}
      `);
      if (companyName) {
        try {
          await db.execute(sql`
            UPDATE partners SET company_name = ${companyName}, updated_at = NOW()
            WHERE contact_email = ${req.user.email}
          `);
        } catch { /* OK if no partners row */ }
      }
      // Update CA qualification in agent_empanelments (upsert)
      if (isCaQualified !== undefined) {
        try {
          // Ensure row exists first
          await db.execute(sql`
            INSERT INTO agent_empanelments (agent_id, emp_status)
            VALUES (${userId}, 'draft')
            ON CONFLICT (agent_id) DO NOTHING
          `);
          await db.execute(sql`
            UPDATE agent_empanelments
            SET is_ca_qualified    = ${isCaQualified},
                ca_membership_number = COALESCE(${caMembershipNumber ?? null}, ca_membership_number),
                updated_at         = NOW()
            WHERE agent_id = ${userId}
          `);
        } catch (e) { /* OK */ }
      }
      res.json({ success: true, message: "Profile updated" });
    } catch (error) {
      console.error("Error updating partner profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Partner clients list
  app.get("/api/partner/clients", requirePartnerSession, async (req: any, res) => {
    try {

      // Return mock client data for now
      res.json([
        {
          id: "client-1",
          name: "Rahul Sharma",
          email: "rahul.sharma@example.com",
          mobile: "9876543210",
          aum: 2500000,
          status: "active",
          lastActivity: new Date().toISOString()
        },
        {
          id: "client-2", 
          name: "Priya Patel",
          email: "priya.patel@example.com",
          mobile: "9876543211",
          aum: 1800000,
          status: "active",
          lastActivity: new Date().toISOString()
        },
        {
          id: "client-3",
          name: "Amit Kumar",
          email: "amit.kumar@example.com", 
          mobile: "9876543212",
          aum: 3200000,
          status: "active",
          lastActivity: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error("Error fetching partner clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Partner activity feed
  app.get("/api/partner/activity", requirePartnerSession, async (req: any, res) => {
    try {

      res.json([
        {
          id: "act-1",
          type: "client_onboarded",
          message: "New client Rahul Sharma onboarded",
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "act-2",
          type: "investment",
          message: "Investment of ₹50,000 completed for Priya Patel",
          timestamp: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: "act-3",
          type: "commission",
          message: "Commission of ₹2,500 credited",
          timestamp: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: "act-4",
          type: "kyc_approved",
          message: "KYC approved for Amit Kumar",
          timestamp: new Date(Date.now() - 172800000).toISOString()
        }
      ]);
    } catch (error) {
      console.error("Error fetching partner activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Top performing agents under partner
  app.get("/api/partner/top-agents", requirePartnerSession, async (req: any, res) => {
    try {

      res.json([
        {
          id: "agent-1",
          name: "Vikram Singh",
          email: "vikram.singh@example.com",
          clientsCount: 45,
          totalAum: 12500000,
          monthlyTarget: 5000000,
          monthlyAchieved: 4200000,
          performance: 84
        },
        {
          id: "agent-2",
          name: "Meera Reddy", 
          email: "meera.reddy@example.com",
          clientsCount: 38,
          totalAum: 9800000,
          monthlyTarget: 4000000,
          monthlyAchieved: 3600000,
          performance: 90
        },
        {
          id: "agent-3",
          name: "Arjun Verma",
          email: "arjun.verma@example.com",
          clientsCount: 32,
          totalAum: 7500000,
          monthlyTarget: 3500000,
          monthlyAchieved: 2800000,
          performance: 80
        }
      ]);
    } catch (error) {
      console.error("Error fetching top agents:", error);
      res.status(500).json({ error: "Failed to fetch top agents" });
    }
  });

  // ── My Team ──────────────────────────────────────────────────────────────
  app.get("/api/partner/my-team", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT ptm.*, 
               u.first_name, u.last_name, u.email, u.mobile, u.roles,
               u.created_at as agent_joined_platform_at,
               ae.status as empanelment_status, ae.arn_code, ae.pan_number
        FROM partner_team_members ptm
        JOIN users u ON u.id = ptm.agent_user_id
        LEFT JOIN agent_empanelments ae ON ae.agent_id = ptm.agent_user_id
        WHERE ptm.partner_user_id = ${userId}
        ORDER BY ptm.joined_at DESC
      `);
      res.json(rows.rows);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // ── Invite Agent ─────────────────────────────────────────────────────────
  app.post("/api/partner/invite-agent", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { inviteeName, inviteeEmail, inviteeMobile } = req.body;
      const code = 'PAG-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      await db.execute(sql`
        INSERT INTO partner_agent_invitations 
          (partner_user_id, invite_code, invitee_name, invitee_email, invitee_mobile)
        VALUES (${userId}, ${code}, ${inviteeName || null}, ${inviteeEmail || null}, ${inviteeMobile || null})
      `);
      const appUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      res.json({ success: true, inviteCode: code, inviteLink: `${appUrl}/agent/register?ref=${code}` });
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.get("/api/partner/invitations", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT pai.*, u.first_name, u.last_name, u.email as accepted_user_email
        FROM partner_agent_invitations pai
        LEFT JOIN users u ON u.id = pai.accepted_by_user_id
        WHERE pai.partner_user_id = ${userId}
        ORDER BY pai.created_at DESC
      `);
      res.json(rows.rows);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  app.delete("/api/partner/invitations/:id", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await db.execute(sql`
        UPDATE partner_agent_invitations SET status = 'cancelled'
        WHERE id = ${req.params.id} AND partner_user_id = ${userId}
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  });

  // ── Bank Account ──────────────────────────────────────────────────────────
  app.get("/api/partner/bank", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT bank_account_number, ifsc_code, bank_account_holder_name, upi_id,
               cashfree_bank_verified, pan_number
        FROM partners WHERE contact_email = ${req.user.email}
        LIMIT 1
      `);
      if (rows.rows.length > 0) return res.json(rows.rows[0]);
      // Fallback: user-level bank accounts
      const ubRows = await db.execute(sql`
        SELECT account_number as bank_account_number, ifsc_code,
               account_holder_name as bank_account_holder_name, upi_id,
               is_verified as cashfree_bank_verified
        FROM user_bank_accounts WHERE user_id = ${userId} AND is_primary = true LIMIT 1
      `);
      res.json(ubRows.rows[0] || {});
    } catch (error) {
      console.error("Error fetching bank:", error);
      res.status(500).json({ error: "Failed to fetch bank details" });
    }
  });

  app.put("/api/partner/bank", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { bankAccountNumber, ifscCode, bankAccountHolderName, upiId } = req.body;
      // Try to update partner record first
      const updated = await db.execute(sql`
        UPDATE partners SET 
          bank_account_number = ${bankAccountNumber},
          ifsc_code = ${ifscCode},
          bank_account_holder_name = ${bankAccountHolderName},
          upi_id = ${upiId || null},
          updated_at = NOW()
        WHERE contact_email = ${req.user.email}
        RETURNING id
      `);
      if (updated.rows.length === 0) {
        // No partners record — upsert into user_bank_accounts
        await db.execute(sql`
          INSERT INTO user_bank_accounts (user_id, account_number, ifsc_code, account_holder_name, upi_id, is_primary, bank_name)
          VALUES (${userId}, ${bankAccountNumber}, ${ifscCode}, ${bankAccountHolderName}, ${upiId || null}, true, 'Partner Bank')
          ON CONFLICT (user_id, account_number) DO UPDATE SET
            ifsc_code = EXCLUDED.ifsc_code,
            account_holder_name = EXCLUDED.account_holder_name,
            upi_id = EXCLUDED.upi_id,
            updated_at = NOW()
        `);
      }
      res.json({ success: true, message: "Bank details saved" });
    } catch (error) {
      console.error("Error updating bank:", error);
      res.status(500).json({ error: "Failed to save bank details" });
    }
  });

  // ── Commission Splits ─────────────────────────────────────────────────────
  app.get("/api/partner/commission-splits", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rows = await db.execute(sql`
        SELECT ptm.agent_user_id, ptm.commission_split_pct,
               u.first_name, u.last_name, u.email
        FROM partner_team_members ptm
        JOIN users u ON u.id = ptm.agent_user_id
        WHERE ptm.partner_user_id = ${userId} AND ptm.status = 'active'
        ORDER BY u.first_name
      `);
      res.json(rows.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch commission splits" });
    }
  });

  app.put("/api/partner/commission-splits/:agentUserId", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { commissionSplitPct } = req.body;
      const pct = Math.min(100, Math.max(0, Number(commissionSplitPct)));
      await db.execute(sql`
        UPDATE partner_team_members SET commission_split_pct = ${pct}, updated_at = NOW()
        WHERE partner_user_id = ${userId} AND agent_user_id = ${req.params.agentUserId}
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update commission split" });
    }
  });

  // ── SM / RM Assignment ────────────────────────────────────────────────────
  app.put("/api/partner/agents/:agentUserId/sm-rm", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { smName, smEmail, rmName, rmEmail } = req.body;
      await db.execute(sql`
        UPDATE partner_team_members SET 
          sm_name = ${smName || null}, sm_email = ${smEmail || null},
          rm_name = ${rmName || null}, rm_email = ${rmEmail || null},
          updated_at = NOW()
        WHERE partner_user_id = ${userId} AND agent_user_id = ${req.params.agentUserId}
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to assign SM/RM" });
    }
  });

  // ── Auto-promote: accept invite (called after agent registers with invite code) ──
  app.post("/api/partner/accept-invite", async (req: any, res) => {
    try {
      const { inviteCode, agentUserId } = req.body;
      if (!inviteCode || !agentUserId) return res.status(400).json({ error: "Missing params" });

      const inv = await db.execute(sql`
        SELECT * FROM partner_agent_invitations WHERE invite_code = ${inviteCode} AND status = 'pending'
      `);
      if (inv.rows.length === 0) return res.status(404).json({ error: "Invitation not found or expired" });
      const invitation = inv.rows[0] as any;

      // Link agent to partner
      await db.execute(sql`
        INSERT INTO partner_team_members (partner_user_id, agent_user_id, invite_code, status)
        VALUES (${invitation.partner_user_id}, ${agentUserId}, ${inviteCode}, 'active')
        ON CONFLICT (partner_user_id, agent_user_id) DO NOTHING
      `);

      // Mark invitation as accepted
      await db.execute(sql`
        UPDATE partner_agent_invitations SET status = 'accepted', accepted_by_user_id = ${agentUserId}, accepted_at = NOW()
        WHERE id = ${invitation.id}
      `);

      // Auto-promote partner: add 'partner' role if not already present (keep 'agent' too)
      const partnerUser = await db.execute(sql`SELECT roles FROM users WHERE id = ${invitation.partner_user_id}`);
      if (partnerUser.rows.length > 0) {
        const currentRoles: string[] = (partnerUser.rows[0] as any).roles || ['user'];
        if (!currentRoles.includes('partner')) {
          const newRoles = [...currentRoles, 'partner'];
          await db.execute(sql`UPDATE users SET roles = ${newRoles} WHERE id = ${invitation.partner_user_id}`);
        }
      }

      res.json({ success: true, partnerId: invitation.partner_user_id });
    } catch (error) {
      console.error("Accept invite error:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // ── Remove agent from team ────────────────────────────────────────────────
  app.delete("/api/partner/my-team/:agentUserId", requirePartnerSession, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await db.execute(sql`
        UPDATE partner_team_members SET status = 'removed', updated_at = NOW()
        WHERE partner_user_id = ${userId} AND agent_user_id = ${req.params.agentUserId}
      `);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove agent" });
    }
  });

  registerPartnerHierarchyRoutes(app);

  console.log("✅ Partner Portal routes registered");
}
