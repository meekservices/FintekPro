/**
 * Phase 7: Proposal → Cart → Execution API Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  proposalExecutionEngine,
  createProposalInputSchema,
  addToCartInputSchema,
  checkoutInputSchema,
  approvalActionInputSchema
} from '../services/proposal-execution-engine';
import { requireClientOrHigher } from '../middleware/auth';

const router = Router();

router.use(requireClientOrHigher);

// ============================================================================
// PROPOSAL ROUTES
// ============================================================================

/**
 * POST /proposal/create - Create a new investment proposal
 */
router.post('/proposal/create', async (req: Request, res: Response) => {
  try {
    const input = createProposalInputSchema.parse(req.body);
    const proposal = proposalExecutionEngine.createProposal(input);
    res.json({ success: true, data: proposal });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * GET /proposal/:id - Get proposal by ID
 */
router.get('/proposal/:id', async (req: Request, res: Response) => {
  try {
    const proposal = proposalExecutionEngine.getProposal(req.params.id);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }
    res.json({ success: true, data: proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /proposals/client/:clientId - Get proposals for a client
 */
router.get('/proposals/client/:clientId', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const proposals = proposalExecutionEngine.getClientProposals(
      req.params.clientId,
      status as any
    );
    res.json({ success: true, data: proposals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /proposal/:id/status - Update proposal status
 */
router.patch('/proposal/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, response } = req.body;
    const proposal = proposalExecutionEngine.updateProposalStatus(
      req.params.id,
      status,
      response
    );
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Proposal not found' });
      return;
    }
    res.json({ success: true, data: proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CART ROUTES
// ============================================================================

/**
 * GET /cart/:userId - Get cart for user
 */
router.get('/cart/:userId', async (req: Request, res: Response) => {
  try {
    const cart = proposalExecutionEngine.getOrCreateCart(req.params.userId);
    res.json({ success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /cart/add - Add items to cart
 */
router.post('/cart/add', async (req: Request, res: Response) => {
  try {
    const input = addToCartInputSchema.parse(req.body);
    const cart = proposalExecutionEngine.addToCart(input);
    res.json({ success: true, data: cart });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * DELETE /cart/:userId/item/:itemId - Remove item from cart
 */
router.delete('/cart/:userId/item/:itemId', async (req: Request, res: Response) => {
  try {
    const cart = proposalExecutionEngine.removeFromCart(
      req.params.userId,
      req.params.itemId
    );
    res.json({ success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /cart/:userId/item/:itemId - Update cart item amount
 */
router.patch('/cart/:userId/item/:itemId', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      return;
    }
    const cart = proposalExecutionEngine.updateCartItem(
      req.params.userId,
      req.params.itemId,
      amount
    );
    res.json({ success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /cart/:userId/clear - Clear cart
 */
router.delete('/cart/:userId/clear', async (req: Request, res: Response) => {
  try {
    const cart = proposalExecutionEngine.clearCart(req.params.userId);
    res.json({ success: true, data: cart });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CHECKOUT & EXECUTION ROUTES
// ============================================================================

/**
 * POST /checkout - Checkout cart and create execution order
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const input = checkoutInputSchema.parse(req.body);
    const order = proposalExecutionEngine.checkout(input);
    res.json({ success: true, data: order });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

/**
 * POST /order/approve - Process approval action (checker/authorizer)
 */
router.post('/order/approve', async (req: Request, res: Response) => {
  try {
    const input = approvalActionInputSchema.parse(req.body);
    const order = proposalExecutionEngine.processApproval(input);
    res.json({ success: true, data: order });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

/**
 * GET /order/:id - Get order by ID
 */
router.get('/order/:id', async (req: Request, res: Response) => {
  try {
    const order = proposalExecutionEngine.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /orders/client/:clientId - Get orders for a client
 */
router.get('/orders/client/:clientId', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const orders = proposalExecutionEngine.getClientOrders(
      req.params.clientId,
      status as any
    );
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /orders/pending-approval - Get orders pending approval
 */
router.get('/orders/pending-approval', async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string | undefined;
    const orders = proposalExecutionEngine.getPendingApprovalOrders(role as any);
    res.json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /order/:id/maker-checker-status - Get maker-checker workflow status
 */
router.get('/order/:id/maker-checker-status', async (req: Request, res: Response) => {
  try {
    const status = proposalExecutionEngine.getMakerCheckerStatus(req.params.id);
    if (!status) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /order/:id/audit-trail - Get order audit trail
 */
router.get('/order/:id/audit-trail', async (req: Request, res: Response) => {
  try {
    const trail = proposalExecutionEngine.getOrderAuditTrail(req.params.id);
    if (!trail) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: trail });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ANALYTICS & SUMMARY ROUTES
// ============================================================================

/**
 * GET /workflow/summary - Get workflow summary stats
 */
router.get('/workflow/summary', async (req: Request, res: Response) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const summary = proposalExecutionEngine.getWorkflowSummary(clientId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /workflow/approval-thresholds - Get approval threshold configuration
 */
router.get('/workflow/approval-thresholds', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      thresholds: [
        { tier: 'standard', minAmount: 0, maxAmount: 100000, requiresChecker: false, requiresAuthorizer: false, description: 'Orders up to ₹1 Lakh - No approval required' },
        { tier: 'elevated', minAmount: 100001, maxAmount: 500000, requiresChecker: true, requiresAuthorizer: false, description: 'Orders ₹1L-5L - Checker approval required' },
        { tier: 'high_value', minAmount: 500001, maxAmount: 1000000, requiresChecker: true, requiresAuthorizer: false, description: 'Orders ₹5L-10L - Checker approval required' },
        { tier: 'premium', minAmount: 1000001, maxAmount: -1, requiresChecker: true, requiresAuthorizer: true, description: 'Orders above ₹10L - Checker + Authorizer required (-1 indicates no upper limit)' }
      ],
      description: 'Maker-Checker approval workflow based on order value. Premium tier (>₹10L) requires both checker and authorizer approval.',
      notes: 'maxAmount of -1 indicates unlimited/no upper bound'
    }
  });
});

/**
 * GET /workflow/order-types - Get supported order types
 */
router.get('/workflow/order-types', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { type: 'buy', description: 'Purchase new investment' },
      { type: 'sell', description: 'Redeem existing investment' },
      { type: 'switch', description: 'Switch between funds/products' },
      { type: 'redeem', description: 'Full redemption of investment' }
    ]
  });
});

/**
 * GET /workflow/payment-methods - Get supported payment methods
 */
router.get('/workflow/payment-methods', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { method: 'upi', name: 'UPI', description: 'Unified Payments Interface', instant: true },
      { method: 'netbanking', name: 'Net Banking', description: 'Online bank transfer', instant: true },
      { method: 'mandate', name: 'E-Mandate', description: 'Auto-debit mandate for SIP', instant: false },
      { method: 'neft', name: 'NEFT', description: 'National Electronic Funds Transfer', instant: false },
      { method: 'rtgs', name: 'RTGS', description: 'Real Time Gross Settlement', instant: true }
    ]
  });
});

export default router;
