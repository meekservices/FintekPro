import { Express, Response } from 'express';
import { partnerService } from '../../partner-service';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { registerPartnerHierarchyRoutes } from './hierarchy-routes';

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

  // Partner profile - returns current user's partner profile
  app.get("/api/partner/profile", requirePartnerSession, async (req: any, res) => {
    try {
      const hasPartnerRole = true;

      res.json({
        id: req.user.id,
        userId: req.user.userId,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        mobile: req.user.mobile,
        roles: req.user.roles,
        partnerType: "distributor",
        companyName: req.user.firstName + " " + req.user.lastName + " Associates",
        arnNumber: "ARN-" + (req.user.userId || "000000").slice(-6),
        status: "active",
        joinedAt: req.user.lastLoginAt || new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching partner profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
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

  registerPartnerHierarchyRoutes(app);

  console.log("✅ Partner Portal routes registered");
}
