import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { insertUnifiedCartItemSchema, ProductCategoryEnum, CartItemSourceEnum } from "@shared/schema";
import { z } from "zod";

const router = Router();

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role?: string;
      roles?: string[];
    };
  }
}

const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

const requireAgentOrAdmin = (req: Request, res: Response, next: Function) => {
  const userRole = req.user?.role || '';
  const userRoles = req.user?.roles || [];
  const isAgentOrAdmin = userRole === 'agent' || userRole === 'admin' || 
    userRoles.includes('agent') || userRoles.includes('admin');
  
  if (!isAgentOrAdmin) {
    return res.status(403).json({ error: "Agent or Admin access required" });
  }
  next();
};

const requireAdmin = (req: Request, res: Response, next: Function) => {
  const userRole = req.user?.role || '';
  const userRoles = req.user?.roles || [];
  const isAdmin = userRole === 'admin' || userRoles.includes('admin');
  
  if (!isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await storage.getUnifiedCartItems(userId);
    
    const groupedItems = items.reduce((acc, item) => {
      const category = item.productCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, typeof items>);
    
    res.json({ 
      items, 
      groupedItems,
      totalCount: items.length 
    });
  } catch (error) {
    console.error("Error fetching unified cart:", error);
    res.status(500).json({ error: "Failed to fetch cart items" });
  }
});

router.get("/count", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await storage.getUnifiedCartCount(userId);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching cart count:", error);
    res.status(500).json({ error: "Failed to fetch cart count" });
  }
});

router.get("/category/:category", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { category } = req.params;
    
    const validCategory = ProductCategoryEnum.safeParse(category);
    if (!validCategory.success) {
      return res.status(400).json({ error: "Invalid product category" });
    }
    
    const items = await storage.getUnifiedCartByCategory(userId, category);
    res.json({ items });
  } catch (error) {
    console.error("Error fetching cart by category:", error);
    res.status(500).json({ error: "Failed to fetch cart items by category" });
  }
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await storage.getUnifiedCartItem(id);
    
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    if (item.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(item);
  } catch (error) {
    console.error("Error fetching cart item:", error);
    res.status(500).json({ error: "Failed to fetch cart item" });
  }
});

const addCartItemSchema = insertUnifiedCartItemSchema.extend({
  productCategory: ProductCategoryEnum,
  source: CartItemSourceEnum.optional().default('client'),
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user?.role || '';
    const userRoles = req.user?.roles || [];
    
    const validation = addCartItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: validation.error.errors 
      });
    }
    
    const data = validation.data;
    
    if (data.source === 'agent') {
      const isAgent = userRole === 'agent' || userRoles.includes('agent');
      if (!isAgent) {
        return res.status(403).json({ error: "Only agents can add items with 'agent' source" });
      }
      data.sourceUserId = userId;
      data.clientApproved = false;
    } else if (data.source === 'ai') {
      data.sourceUserId = userId;
      data.clientApproved = false;
    } else {
      data.clientApproved = true;
    }
    
    const targetUserId = data.source !== 'client' && req.body.targetUserId 
      ? req.body.targetUserId 
      : userId;
    
    const newItem = await storage.createUnifiedCartItem({
      ...data,
      userId: targetUserId,
    });
    
    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error adding cart item:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

router.post("/agent-proposal", requireAuth, requireAgentOrAdmin, async (req: Request, res: Response) => {
  try {
    const agentId = req.user!.id;
    const { clientUserId, items } = req.body;
    
    if (!clientUserId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "clientUserId and items array are required" });
    }
    
    const createdItems = [];
    for (const item of items) {
      const validation = addCartItemSchema.safeParse({
        ...item,
        source: 'agent',
      });
      
      if (!validation.success) {
        continue;
      }
      
      const newItem = await storage.createUnifiedCartItem({
        ...validation.data,
        userId: clientUserId,
        source: 'agent',
        sourceUserId: agentId,
        clientApproved: false,
        status: 'pending_approval',
      });
      createdItems.push(newItem);
    }
    
    res.status(201).json({ 
      message: "Agent proposal items added to client cart",
      items: createdItems,
      count: createdItems.length
    });
  } catch (error) {
    console.error("Error creating agent proposal:", error);
    res.status(500).json({ error: "Failed to create agent proposal" });
  }
});

router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const item = await storage.getUnifiedCartItem(id);
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    if (item.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const updates: Record<string, any> = {};
    if (req.body.quantity !== undefined) updates.quantity = req.body.quantity;
    if (req.body.amount !== undefined) updates.amount = req.body.amount;
    if (req.body.targetPrice !== undefined) updates.targetPrice = req.body.targetPrice;
    if (req.body.metadata !== undefined) updates.metadata = req.body.metadata;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    const updatedItem = await storage.updateUnifiedCartItem(id, updates);
    res.json(updatedItem);
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

router.post("/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const item = await storage.getUnifiedCartItem(id);
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    if (item.userId !== userId) {
      return res.status(403).json({ error: "Only the client can approve this item" });
    }
    
    if (item.source === 'client') {
      return res.status(400).json({ error: "Client-added items don't need approval" });
    }
    
    const approvedItem = await storage.approveCartItem(id);
    res.json({ message: "Item approved", item: approvedItem });
  } catch (error) {
    console.error("Error approving cart item:", error);
    res.status(500).json({ error: "Failed to approve cart item" });
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const item = await storage.getUnifiedCartItem(id);
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    if (item.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await storage.deleteUnifiedCartItem(id);
    res.json({ message: "Item removed from cart" });
  } catch (error) {
    console.error("Error removing cart item:", error);
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
});

router.delete("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await storage.clearUnifiedCart(userId);
    res.json({ message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

router.get("/admin/all", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, category, source, status, page = '1', limit = '50' } = req.query;
    
    const filters: { userId?: string; category?: string; source?: string; status?: string } = {};
    if (userId && typeof userId === 'string') filters.userId = userId;
    if (category && typeof category === 'string') filters.category = category;
    if (source && typeof source === 'string') filters.source = source;
    if (status && typeof status === 'string') filters.status = status;
    
    const items = await storage.getAllUnifiedCartItemsForAdmin(filters);
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedItems = items.slice(startIdx, startIdx + limitNum);
    
    res.json({
      items: paginatedItems,
      total: items.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(items.length / limitNum)
    });
  } catch (error) {
    console.error("Error fetching admin cart data:", error);
    res.status(500).json({ error: "Failed to fetch cart data" });
  }
});

router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { cartItemIds } = req.body;
    
    if (!cartItemIds || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      return res.status(400).json({ error: "cartItemIds array is required" });
    }
    
    const orders = await storage.checkoutCartItems(userId, cartItemIds);
    
    if (orders.length === 0) {
      return res.status(400).json({ error: "No valid cart items to checkout" });
    }
    
    res.status(201).json({
      message: "Checkout successful",
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error("Error during checkout:", error);
    res.status(500).json({ error: "Failed to process checkout" });
  }
});

export default router;
