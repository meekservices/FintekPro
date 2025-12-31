import { Express, Request, Response } from 'express';
import { requireAuth, requireAdmin, requireClientOrHigher } from '../middleware/auth';
import { validateKYC } from '../kyc-middleware';
import { storage } from '../storage';
import { db } from '../db';
import { userCart, userCartItems, products, investmentProposals, userInvestments, storeProducts, storeCategories } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export function registerCartRoutes(app: Express) {
  // ============ CART SYSTEM ROUTES ============

  // Get user's cart
  app.get("/api/cart", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get or create user's cart
      let [cart] = await db
        .select()
        .from(userCart)
        .where(eq(userCart.userId, userId));

      if (!cart) {
        [cart] = await db
          .insert(userCart)
          .values({ userId })
          .returning();
      }

      // Get cart items with product details (leftJoin to include investment items)
      const cartItems = await db
        .select({
          id: userCartItems.id,
          itemType: userCartItems.itemType,
          productId: userCartItems.productId,
          proposalId: userCartItems.proposalId,
          investmentId: userCartItems.investmentId,
          quantity: userCartItems.quantity,
          investmentAmount: userCartItems.investmentAmount,
          metadata: userCartItems.metadata,
          addedAt: userCartItems.addedAt,
          product: {
            id: storeProducts.id,
            name: storeProducts.name,
            shortDescription: storeProducts.shortDescription,
            category: storeCategories.name,
            productType: storeProducts.productType,
            price: storeProducts.price,
            minimumInvestment: storeProducts.minimumInvestment,
            riskLevel: storeProducts.riskLevel,
            expectedReturns: storeProducts.expectedReturns,
            provider: storeProducts.provider,
            features: storeProducts.features,
          }
        })
        .from(userCartItems)
        .leftJoin(storeProducts, eq(userCartItems.productId, storeProducts.id))
        .leftJoin(storeCategories, eq(storeProducts.categoryId, storeCategories.id))
        .where(eq(userCartItems.cartId, cart.id));

      // Calculate total value using investmentAmount when available
      const totalValue = cartItems.reduce((sum, item) => {
        const amount = parseFloat(item.investmentAmount || '0');
        if (amount > 0) return sum + amount;
        if (item.product?.minimumInvestment) {
          return sum + parseFloat(item.product.minimumInvestment);
        }
        return sum;
      }, 0);

      res.json({
        cart: cart,
        items: cartItems,
        totalItems: cartItems.length,
        totalValue
      });
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Failed to fetch cart" });
    }
  });

  // Add item to cart (products, proposals, or investments)
  app.post("/api/cart/items", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { 
        productId, 
        proposalId, 
        investmentId, 
        itemType = "product", 
        quantity = 1, 
        investmentAmount, 
        metadata 
      } = req.body;

      // Validate that exactly one ID is provided
      const hasProduct = !!productId;
      const hasProposal = !!proposalId;
      const hasInvestment = !!investmentId;
      const count = [hasProduct, hasProposal, hasInvestment].filter(Boolean).length;

      if (count !== 1) {
        return res.status(400).json({ 
          error: "Exactly one of productId, proposalId, or investmentId must be provided" 
        });
      }

      // Type-specific validation
      if (itemType === "product" && !productId) {
        return res.status(400).json({ error: "productId is required for product items" });
      }
      if (itemType === "proposal" && !proposalId) {
        return res.status(400).json({ error: "proposalId is required for proposal items" });
      }
      if (itemType === "investment" && !investmentId) {
        return res.status(400).json({ error: "investmentId is required for investment items" });
      }

      // For products, verify the product exists
      if (productId) {
        const [product] = await db
          .select()
          .from(storeProducts)
          .where(eq(storeProducts.id, productId));

        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }
      }

      // Get or create user's cart
      let [cart] = await db
        .select()
        .from(userCart)
        .where(eq(userCart.userId, userId));

      if (!cart) {
        [cart] = await db
          .insert(userCart)
          .values({ userId })
          .returning();
      }

      // Check if item already exists in cart
      const whereConditions = [eq(userCartItems.cartId, cart.id)];
      if (productId) whereConditions.push(eq(userCartItems.productId, productId));
      if (proposalId) whereConditions.push(eq(userCartItems.proposalId, proposalId));
      if (investmentId) whereConditions.push(eq(userCartItems.investmentId, investmentId));

      const [existingItem] = await db
        .select()
        .from(userCartItems)
        .where(and(...whereConditions));

      if (existingItem) {
        // Update existing item
        const [updatedItem] = await db
          .update(userCartItems)
          .set({
            quantity: existingItem.quantity + quantity,
            investmentAmount: investmentAmount || existingItem.investmentAmount,
            metadata: metadata || existingItem.metadata
          })
          .where(eq(userCartItems.id, existingItem.id))
          .returning();

        res.json(updatedItem);
      } else {
        // Add new item
        const [newItem] = await db
          .insert(userCartItems)
          .values({
            cartId: cart.id,
            productId: productId || null,
            proposalId: proposalId || null,
            investmentId: investmentId || null,
            itemType,
            quantity,
            investmentAmount: investmentAmount?.toString() || null,
            metadata: metadata || {}
          })
          .returning();

        res.json(newItem);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  // Update cart item
  app.put("/api/cart/items/:itemId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { itemId } = req.params;
      const { quantity, investmentAmount } = req.body;

      // Verify user owns this cart item
      const [cartItem] = await db
        .select({
          id: userCartItems.id,
          cartId: userCartItems.cartId
        })
        .from(userCartItems)
        .innerJoin(userCart, eq(userCartItems.cartId, userCart.id))
        .where(and(
          eq(userCartItems.id, itemId),
          eq(userCart.userId, userId)
        ));

      if (!cartItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      const updates: any = {};
      if (quantity !== undefined) updates.quantity = quantity;
      if (investmentAmount !== undefined) updates.investmentAmount = investmentAmount;

      const [updatedItem] = await db
        .update(userCartItems)
        .set(updates)
        .where(eq(userCartItems.id, itemId))
        .returning();

      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ error: "Failed to update cart item" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/items/:itemId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { itemId } = req.params;

      // Verify user owns this cart item
      const [cartItem] = await db
        .select({
          id: userCartItems.id
        })
        .from(userCartItems)
        .innerJoin(userCart, eq(userCartItems.cartId, userCart.id))
        .where(and(
          eq(userCartItems.id, itemId),
          eq(userCart.userId, userId)
        ));

      if (!cartItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      await db
        .delete(userCartItems)
        .where(eq(userCartItems.id, itemId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ error: "Failed to remove item from cart" });
    }
  });

  // Clear cart
  app.delete("/api/cart", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;

      const [cart] = await db
        .select()
        .from(userCart)
        .where(eq(userCart.userId, userId));

      if (cart) {
        await db
          .delete(userCartItems)
          .where(eq(userCartItems.cartId, cart.id));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  // === ADMIN PROPOSAL MANAGEMENT APIs ===
  
  // Admin: Get all proposals
  app.get('/api/admin/proposals', requireAdmin, async (req: any, res: any) => {
    try {
      const proposals = await storage.getAllProposals();
      res.json(proposals);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
      res.status(500).json({ error: 'Failed to fetch proposals' });
    }
  });

  // Admin: Get all clients for proposal creation
  app.get('/api/admin/clients', requireAdmin, async (req: any, res: any) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  // Admin: Create new proposal
  app.post('/api/admin/proposals', requireAdmin, async (req: any, res: any) => {
    try {
      const proposalData = {
        ...req.body,
        createdBy: req.user.id,
        status: 'draft',
        totalAmount: 0,
        items: []
      };
      const proposal = await storage.createProposal(proposalData);
      res.json(proposal);
    } catch (error) {
      console.error('Failed to create proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  });

  // Admin: Update proposal status
  app.put('/api/admin/proposals/:proposalId/status', requireAdmin, async (req: any, res: any) => {
    try {
      const { proposalId } = req.params;
      const { status } = req.body;
      const proposal = await storage.updateProposalStatus(proposalId, status);
      res.json(proposal);
    } catch (error) {
      console.error('Failed to update proposal status:', error);
      res.status(500).json({ error: 'Failed to update proposal status' });
    }
  });

  // Admin: Delete proposal
  app.delete('/api/admin/proposals/:proposalId', requireAdmin, async (req: any, res: any) => {
    try {
      const { proposalId } = req.params;
      await storage.deleteProposal(proposalId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete proposal:', error);
      res.status(500).json({ error: 'Failed to delete proposal' });
    }
  });

  // === CLIENT PROPOSAL APIs ===

  // Client: Get their proposals
  app.get('/api/proposals', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const proposals = await storage.getProposalsByClientId(req.user.id);
      res.json(proposals);
    } catch (error) {
      console.error('Failed to fetch user proposals:', error);
      res.status(500).json({ error: 'Failed to fetch proposals' });
    }
  });

  // Create new investment proposal (AI, Agent, or Client-generated)
  app.post('/api/proposals', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const proposalData = req.body;
      const userId = req.user!.id;
      const userRole = req.user.role || 'client';
      
      // Determine proposal source based on who creates it
      let proposalSource: 'ai' | 'agent' | 'client' = 'client';
      if (hasRole(req.user, ['agent'])) {
        proposalSource = 'agent';
      } else if (proposalData.proposalSource === 'ai') {
        proposalSource = 'ai';
      }
      
      // Generate custom ID based on source
      const proposalId = generateProposalId(proposalSource);
      
      // Prepare proposal object
      const proposal = {
        id: proposalId,
        clientId: proposalData.clientId || userId,
        agentId: proposalSource === 'agent' ? userId : proposalData.agentId,
        portfolioId: proposalData.portfolioId,
        proposalSource,
        title: proposalData.title,
        description: proposalData.description,
        analysisRationale: proposalData.analysisRationale,
        recommendations: proposalData.recommendations,
        totalInvestmentAmount: proposalData.totalInvestmentAmount,
        riskProfile: proposalData.riskProfile,
        timeHorizon: proposalData.timeHorizon,
        expectedReturns: proposalData.expectedReturns,
        expectedRisk: proposalData.expectedRisk,
        projectedValue: proposalData.projectedValue,
        priority: proposalData.priority || 'medium',
        status: 'pending',
        validUntil: proposalData.validUntil,
        aiModelVersion: proposalData.aiModelVersion,
        aiConfidenceScore: proposalData.aiConfidenceScore,
        currentAllocation: proposalData.currentAllocation,
        targetAllocation: proposalData.targetAllocation
      };
      
      // Create proposal in database
      const createdProposal = await storage.createInvestmentProposal(proposal);
      
      // Log compliance event
      complianceMonitor.logEvent({
        userId,
        eventType: 'proposal_created',
        action: `${proposalSource} proposal created`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        outcome: 'success',
        riskLevel: 'low',
        details: { proposalId, proposalSource, title: proposal.title }
      });
      
      res.status(201).json(createdProposal);
    } catch (error) {
      console.error('Failed to create proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  });

  // Client: Accept proposal
  app.put('/api/proposals/:proposalId/accept', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const { proposalId } = req.params;
      const proposal = await storage.acceptProposal(proposalId, req.user.id);
      res.json(proposal);
    } catch (error) {
      console.error('Failed to accept proposal:', error);
      res.status(500).json({ error: 'Failed to accept proposal' });
    }
  });

  // Client: Reject proposal
  app.put('/api/proposals/:proposalId/reject', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const { proposalId } = req.params;
      const proposal = await storage.rejectProposal(proposalId, req.user.id);
      res.json(proposal);
    } catch (error) {
      console.error('Failed to reject proposal:', error);
      res.status(500).json({ error: 'Failed to reject proposal' });
    }
  });

  // Client: Mark proposal as viewed
  app.put('/api/proposals/:proposalId/mark-viewed', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const { proposalId } = req.params;
      const proposal = await storage.markProposalAsViewed(proposalId, req.user.id);
      res.json(proposal);
    } catch (error) {
      console.error('Failed to mark proposal as viewed:', error);
      res.status(500).json({ error: 'Failed to mark proposal as viewed' });
    }
  });

  // Client: Add accepted proposal to cart (alternative to load-to-cart)
  app.post('/api/proposals/:proposalId/add-to-cart', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const { proposalId } = req.params;
      const result = await storage.addProposalToCart(proposalId, req.user.id);
      res.json(result);
    } catch (error) {
      console.error('Failed to add proposal to cart:', error);
      res.status(500).json({ error: 'Failed to add proposal to cart' });
    }
  });

  // Client: Complete order through BSE Star API (with KYC validation)
  app.post(
    '/api/proposals/:proposalId/complete-order', 
    requireClientOrHigher,
    async (req: any, res: any, next: any) => {
      try {
        const { proposalId } = req.params;
        
        // Get proposal and items FIRST to calculate total amount
        const proposal = await storage.getInvestmentProposal(proposalId);
        if (!proposal) {
          return res.status(404).json({ error: 'Proposal not found' });
        }
        
        const proposalItems = await storage.getInvestmentProposalItems(proposalId);
        if (!proposalItems || proposalItems.length === 0) {
          return res.status(400).json({ error: 'No items found in proposal' });
        }
        
        // Calculate total transaction amount from proposal items
        const totalAmount = proposalItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
        
        // Inject totalAmount into request body for KYC validation
        req.body.totalAmount = totalAmount;
        
        // Continue to KYC validation
        next();
      } catch (error) {
        console.error('Failed to prepare order:', error);
        res.status(500).json({ error: 'Failed to prepare order' });
      }
    },
    validateKYC('mutual_fund', { amountField: 'totalAmount', skipForDemo: true }),
    async (req: any, res: any) => {
      try {
        const { proposalId } = req.params;
        const { orderType = 'LUMPSUM' } = req.body;
        const userId = req.user!.id;
        
        // Get proposal again (already validated above)
        const proposal = await storage.getInvestmentProposal(proposalId);
        if (!proposal) {
          return res.status(404).json({ error: 'Proposal not found' });
        }

        // Verify proposal belongs to user
        if (proposal.clientId !== userId) {
          return res.status(403).json({ error: 'Not authorized to complete this proposal' });
        }

        // Check if proposal is accepted
        if (proposal.status !== 'accepted') {
          return res.status(400).json({ error: 'Proposal must be accepted before completion' });
        }

        // Get proposal items (already validated above)
        const proposalItems = await storage.getInvestmentProposalItems(proposalId);
        if (!proposalItems || proposalItems.length === 0) {
          return res.status(400).json({ error: 'No items found in proposal' });
        }

      // Prepare BSE order request
      const bseOrderRequest = {
        proposalId,
        clientCode: userId, // Using user ID as client code for demo
        orderType: orderType as 'LUMPSUM' | 'SIP',
        items: proposalItems.map(item => ({
          schemeCode: item.schemeCode,
          amount: item.amount,
          transactionType: 'P' as const, // Purchase
          folioNo: item.folioNo || undefined,
          sipFreq: item.sipFreq || 'MONTHLY',
          sipStartDate: item.sipStartDate,
          sipEndDate: item.sipEndDate
        }))
      };

      // Import BSE API service
      const { bseStarApi } = await import('./bseStarApi');
      
      // Complete order through BSE Star API
      const orderResult = await bseStarApi.completeOrder(bseOrderRequest);
      
      if (orderResult.success) {
        // Update proposal status to completed
        await storage.updateProposalStatus(proposalId, 'completed');
        
        res.json({
          success: true,
          message: 'Order completed successfully',
          orderId: orderResult.orderId,
          transNo: orderResult.transNo,
          paymentUrl: orderResult.paymentUrl,
          bseReference: orderResult.bseReference
        });
      } else {
        res.status(400).json({
          success: false,
          error: orderResult.message
        });
      }

    } catch (error) {
      console.error('Failed to complete order:', error);
      res.status(500).json({ error: 'Failed to complete order' });
    }
  });

  // Client: Check order status
  app.get('/api/orders/:transNo/status', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const { transNo } = req.params;
      
      // Import BSE API service
      const { bseStarApi } = await import('./bseStarApi');
      
      // Get order status from BSE
      const orderStatus = await bseStarApi.getOrderStatus(transNo);
      
      res.json(orderStatus);
    } catch (error) {
      console.error('Failed to check order status:', error);
      res.status(500).json({ error: 'Failed to check order status' });
    }
  });

  // Client: Check payment status
  app.get('/api/payments/:transNo/status', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const { transNo } = req.params;
      const userId = req.user!.id;
      
      // Import BSE API service
      const { bseStarApi } = await import('./bseStarApi');
      
      // Check payment status from BSE
      const paymentStatus = await bseStarApi.checkPaymentStatus(userId, transNo);
      
      res.json(paymentStatus);
    } catch (error) {
      console.error('Failed to check payment status:', error);
      res.status(500).json({ error: 'Failed to check payment status' });
    }
  });

  // Get user's unified orders (FintekPro transactions)
  app.get('/api/unified-orders', requireClientOrHigher, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      
      // Get all orders for this user from unified_orders table
      const orders = await storage.getUnifiedOrdersByUser(userId);
      
      res.json(orders);
    } catch (error) {
      console.error('Failed to fetch unified orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });


  // Load proposal items to cart
  app.post("/api/proposals/:proposalId/load-to-cart", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { proposalId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the proposal and verify access
      const proposal = await storage.getInvestmentProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Check if user is client or agent for this proposal
      const isAuthorized = proposal.clientId === userId || 
                          proposal.agentId === userId || 
                          (req as any).user.role === 'admin';
      
      if (!isAuthorized) {
        return res.status(403).json({ error: "Not authorized to access this proposal" });
      }

      // Get proposal items
      const proposalItems = await storage.getInvestmentProposalItems(proposalId);
      if (!proposalItems || proposalItems.length === 0) {
        return res.status(400).json({ error: "No items found in proposal" });
      }

      // Get or create user's cart
      let [cart] = await db
        .select()
        .from(userCart)
        .where(eq(userCart.userId, userId));

      if (!cart) {
        [cart] = await db
          .insert(userCart)
          .values({ userId })
          .returning();
      }

      const addedItems = [];
      const skippedItems = [];

      // Process each proposal item
      for (const item of proposalItems) {
        try {
          // Try to find matching store product by name, category or code
          const [storeProduct] = await db
            .select()
            .from(storeProducts)
            .where(
              or(
                eq(storeProducts.name, item.productName),
                and(
                  eq(storeProducts.productType, item.productType),
                  like(storeProducts.name, `%${item.productCode}%`)
                )
              )
            )
            .limit(1);

          if (!storeProduct) {
            skippedItems.push({
              productName: item.productName,
              reason: "Product not available in store"
            });
            continue;
          }

          // Check if item already exists in cart
          const [existingItem] = await db
            .select()
            .from(userCartItems)
            .where(and(
              eq(userCartItems.cartId, cart.id),
              eq(userCartItems.productId, storeProduct.id)
            ));

          const investmentAmount = item.recommendedAmount?.toString() || storeProduct.minimumInvestment?.toString();
          const quantity = 1; // Default quantity for financial products

          if (existingItem) {
            // Update existing item with proposal recommended amount
            const [updatedItem] = await db
              .update(userCartItems)
              .set({
                quantity: existingItem.quantity + quantity,
                investmentAmount: investmentAmount || existingItem.investmentAmount
              })
              .where(eq(userCartItems.id, existingItem.id))
              .returning();

            addedItems.push({
              productName: item.productName,
              action: "updated",
              investmentAmount,
              cartItemId: updatedItem.id
            });
          } else {
            // Add new item to cart
            const [newItem] = await db
              .insert(userCartItems)
              .values({
                cartId: cart.id,
                productId: storeProduct.id,
                quantity,
                investmentAmount
              })
              .returning();

            addedItems.push({
              productName: item.productName,
              action: "added",
              investmentAmount,
              cartItemId: newItem.id
            });
          }
        } catch (itemError) {
          console.error(`Error processing proposal item ${item.productName}:`, itemError);
          skippedItems.push({
            productName: item.productName,
            reason: "Error processing item"
          });
        }
      }

      res.json({
        success: true,
        proposalId,
        addedItems,
        skippedItems,
        summary: {
          totalProcessed: proposalItems.length,
          successful: addedItems.length,
          skipped: skippedItems.length
        }
      });

    } catch (error) {
      console.error("Error loading proposal to cart:", error);
      res.status(500).json({ error: "Failed to load proposal items to cart" });
    }
  });


  console.log('✅ Cart System routes registered');
}
