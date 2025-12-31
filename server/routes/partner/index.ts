import { Express, Response } from 'express';
import { partnerService } from '../../partner-service';

const requirePartner = async (req: any, res: Response, next: any) => {
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
    // For demo purposes, authenticate with email/password from headers
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
    // For now, add a basic check. In a real app, this would verify JWT tokens or sessions
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Mock user for demo purposes - in production, verify the token
    req.user = {
      id: "demo-user-1",
      role: "client",
      email: "demo@fintekpro.com"
    };
    next();
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

  console.log("✅ Partner Portal routes registered");
}
