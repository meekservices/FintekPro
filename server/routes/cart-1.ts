import { Express, Request, Response } from 'express';
import { requireAuth, requireAdmin, requireClientOrHigher } from '../middleware/auth';
import { validateKYC } from '../kyc-middleware';
import { storage } from '../storage';
import { db } from '../db';
import { userCart, userCartItems, products, investmentProposals, userInvestments, storeProducts, storeCategories } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export function registerCarPart1Routes(app: Express) {
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
}
