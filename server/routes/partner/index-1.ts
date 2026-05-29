import { Express, Response } from 'express';
import { partnerService } from '../../partner-service';
import { db } from '../../db';
import { getAppBaseUrl } from '../../utils/app-url';
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

export function registerPartnerPortalPart1Routes(app: Express): void {
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
        (req as any).partner = {
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
      (req as any).partner = {
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

      (req as any).partner = partner;
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
      const partnerId = (req as any).partner.id;
      const stats = await partnerService.getPartnerStats(partnerId);
      
      res.json({
        partner: {
          id: (req as any).partner.id,
          companyName: (req as any).partner.companyName,
          partnerType: (req as any).partner.partnerType
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
      const partnerId = (req as any).partner.id;
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
      
      if (!product || product.partnerId !== (req as any).partner.id) {
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
        partnerId: (req as any).partner.id
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
      
      if (!product || product.partnerId !== (req as any).partner.id) {
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
      
      if (!product || product.partnerId !== (req as any).partner.id) {
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
      const partnerId = (req as any).partner.id;
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
      
      if (!ticket || ticket.assignedTo !== (req as any).partner.id) {
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
      
      if (!ticket || ticket.assignedTo !== (req as any).partner.id) {
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
      
      if (!ticket || ticket.assignedTo !== (req as any).partner.id) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const messageData = {
        ticketId: req.params.id,
        senderId: (req as any).partner.id,
        senderType: 'partner' as const,
        senderName: (req as any).partner.companyName,
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
}
