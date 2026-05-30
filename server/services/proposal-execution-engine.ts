/**
 * Phase 7: Proposal → Cart → Execution Engine
 * 
 * Comprehensive workflow engine for investment proposals:
 * 1. Proposal Creation & Management (AI, Agent, or Client-initiated)
 * 2. Cart Operations (Add, Remove, Modify)
 * 3. Execution Workflow with Maker-Checker Approval
 * 4. Order Tracking & Settlement
 */

import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Proposal Types
export type ProposalSource = 'ai' | 'agent' | 'client' | 'hybrid';
export type ProposalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'in_cart' | 'submitted' | 'executed' | 'cancelled' | 'expired';
export type InvestmentType = 'lumpsum' | 'sip' | 'swp' | 'stp';
export type ProductType = 'mutual_fund' | 'etf' | 'bond' | 'equity' | 'ulip' | 'nps' | 'ppf' | 'fd' | 'gold';

// Maker-Checker Types
export type ApprovalRole = 'maker' | 'checker' | 'authorizer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type ExecutionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partially_filled' | 'cancelled';

// Execution Order Types
export type OrderType = 'buy' | 'sell' | 'switch' | 'redeem';
export type PaymentMethod = 'upi' | 'netbanking' | 'mandate' | 'neft' | 'rtgs';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProposalItem {
  id: string;
  productType: ProductType;
  productCode: string;
  productName: string;
  amc?: string;
  category?: string;
  investmentType: InvestmentType;
  amount: number;
  sipAmount?: number;
  sipFrequency?: 'monthly' | 'quarterly' | 'weekly';
  sipDuration?: number; // months
  allocationPercent: number;
  expectedReturn: number;
  riskRating: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  selectionReason: string;
  suitabilityScore: number; // 1-10
  nav?: number;
  exitLoad?: number;
}

export interface Proposal {
  id: string;
  clientId: string;
  agentId?: string;
  source: ProposalSource;
  status: ProposalStatus;
  title: string;
  description: string;
  rationale: string;
  items: ProposalItem[];
  totalAmount: number;
  riskProfile: string;
  timeHorizon: string;
  expectedReturns: number;
  goalId?: string; // Link to financial goal
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  proposalId?: string;
  proposalItemId?: string;
  productType: ProductType;
  productCode: string;
  productName: string;
  investmentType: InvestmentType;
  amount: number;
  sipAmount?: number;
  sipFrequency?: string;
  sipDuration?: number;
  metadata: Record<string, any>;
  addedAt: Date;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  sipTotal: number;
  lumpsumTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalStep {
  stepNumber: number;
  role: ApprovalRole;
  userId?: string;
  userName?: string;
  status: ApprovalStatus;
  comments?: string;
  timestamp?: Date;
  ipAddress?: string;
}

export interface ExecutionOrder {
  id: string;
  cartId?: string;
  clientId: string;
  orderType: OrderType;
  items: ExecutionOrderItem[];
  totalAmount: number;
  
  // Maker-Checker Workflow
  makerCheckerEnabled: boolean;
  approvalSteps: ApprovalStep[];
  currentApprovalStep: number;
  approvalStatus: ApprovalStatus;
  
  // Payment
  paymentMethod?: PaymentMethod;
  paymentStatus: 'pending' | 'initiated' | 'completed' | 'failed';
  paymentReference?: string;
  
  // Execution
  executionStatus: ExecutionStatus;
  executionStartedAt?: Date;
  executionCompletedAt?: Date;
  executionDetails?: Record<string, any>;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionOrderItem {
  id: string;
  orderId: string;
  cartItemId?: string;
  productType: ProductType;
  productCode: string;
  productName: string;
  orderType: OrderType;
  investmentType: InvestmentType;
  amount: number;
  units?: number;
  nav?: number;
  status: ExecutionStatus;
  transactionId?: string;
  folioNumber?: string;
  errorMessage?: string;
  executedAt?: Date;
}

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const createProposalInputSchema = z.object({
  clientId: z.string(),
  agentId: z.string().optional(),
  source: z.enum(['ai', 'agent', 'client', 'hybrid']).default('agent'),
  title: z.string().min(5),
  description: z.string().min(10),
  rationale: z.string().optional(),
  items: z.array(z.object({
    productType: z.enum(['mutual_fund', 'etf', 'bond', 'equity', 'ulip', 'nps', 'ppf', 'fd', 'gold']),
    productCode: z.string(),
    productName: z.string(),
    amc: z.string().optional(),
    category: z.string().optional(),
    investmentType: z.enum(['lumpsum', 'sip', 'swp', 'stp']),
    amount: z.number().positive(),
    sipAmount: z.number().optional(),
    sipFrequency: z.enum(['monthly', 'quarterly', 'weekly']).optional(),
    sipDuration: z.number().optional(),
    allocationPercent: z.number().min(0).max(100),
    expectedReturn: z.number(),
    riskRating: z.enum(['very_low', 'low', 'moderate', 'high', 'very_high']),
    selectionReason: z.string(),
    suitabilityScore: z.number().min(1).max(10)
  })).min(1),
  riskProfile: z.string(),
  timeHorizon: z.string(),
  goalId: z.string().optional(),
  validDays: z.number().default(30)
});

export const addToCartInputSchema = z.object({
  userId: z.string(),
  proposalId: z.string().optional(),
  items: z.array(z.object({
    proposalItemId: z.string().optional(),
    productType: z.enum(['mutual_fund', 'etf', 'bond', 'equity', 'ulip', 'nps', 'ppf', 'fd', 'gold']),
    productCode: z.string(),
    productName: z.string(),
    investmentType: z.enum(['lumpsum', 'sip', 'swp', 'stp']),
    amount: z.number().positive(),
    sipAmount: z.number().optional(),
    sipFrequency: z.string().optional(),
    sipDuration: z.number().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })).min(1)
});

export const checkoutInputSchema = z.object({
  userId: z.string(),
  cartId: z.string(),
  paymentMethod: z.enum(['upi', 'netbanking', 'mandate', 'neft', 'rtgs']),
  makerCheckerEnabled: z.boolean().default(true),
  approvalConfig: z.object({
    requireChecker: z.boolean().default(true),
    requireAuthorizer: z.boolean().default(false),
    thresholdAmount: z.number().default(100000) // Amounts above this require maker-checker
  }).optional()
});

export const approvalActionInputSchema = z.object({
  orderId: z.string(),
  approverId: z.string(),
  action: z.enum(['approve', 'reject', 'escalate']),
  comments: z.string().optional(),
  ipAddress: z.string().optional()
});

// ============================================================================
// PROPOSAL-EXECUTION ENGINE
// ============================================================================

export class ProposalExecutionEngine {
  // In-memory storage for demo
  private proposals: Map<string, Proposal> = new Map();
  private carts: Map<string, Cart> = new Map();
  private orders: Map<string, ExecutionOrder> = new Map();
  private orderCounter = 1000;
  private proposalCounter = 1;

  // ============================================================================
  // PROPOSAL MANAGEMENT
  // ============================================================================

  /**
   * Create a new investment proposal
   */
  createProposal(input: z.infer<typeof createProposalInputSchema>): Proposal {
    const now = new Date();
    const prefix = input.source === 'ai' ? 'AI' : input.source === 'agent' ? 'AGENT' : 'CLIENT';
    const id = `${prefix}-${String(this.proposalCounter++).padStart(6, '0')}`;
    
    // Calculate totals
    const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);
    const weightedReturn = input.items.reduce((sum, item) => 
      sum + (item.expectedReturn * item.allocationPercent / 100), 0
    );
    
    const proposal: Proposal = {
      id,
      clientId: input.clientId,
      agentId: input.agentId,
      source: input.source,
      status: 'pending_review',
      title: input.title,
      description: input.description,
      rationale: input.rationale || '',
      items: input.items.map((item, index) => ({
        id: `${id}-ITEM-${index + 1}`,
        ...item
      })),
      totalAmount,
      riskProfile: input.riskProfile,
      timeHorizon: input.timeHorizon,
      expectedReturns: weightedReturn,
      goalId: input.goalId,
      validUntil: new Date(now.getTime() + input.validDays * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * Get proposals for a client
   */
  getClientProposals(clientId: string, status?: ProposalStatus): Proposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.clientId === clientId && (!status || p.status === status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Update proposal status
   */
  updateProposalStatus(proposalId: string, status: ProposalStatus, response?: string): Proposal | undefined {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return undefined;
    
    proposal.status = status;
    proposal.updatedAt = new Date();
    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  // ============================================================================
  // CART OPERATIONS
  // ============================================================================

  /**
   * Get or create cart for user
   */
  getOrCreateCart(userId: string): Cart {
    // Find existing cart
    const existingCarts = Array.from(this.carts.values());
    for (const cart of existingCarts) {
      if (cart.userId === userId) {
        return cart;
      }
    }
    
    // Create new cart
    const cart: Cart = {
      id: `CART-${userId.substring(0, 8)}-${Date.now()}`,
      userId,
      items: [],
      totalAmount: 0,
      sipTotal: 0,
      lumpsumTotal: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.carts.set(cart.id, cart);
    return cart;
  }

  /**
   * Add items to cart
   */
  addToCart(input: z.infer<typeof addToCartInputSchema>): Cart {
    const cart = this.getOrCreateCart(input.userId);
    
    // If adding from proposal, update proposal status
    if (input.proposalId) {
      this.updateProposalStatus(input.proposalId, 'in_cart');
    }
    
    const now = new Date();
    
    for (const item of input.items) {
      const cartItem: CartItem = {
        id: `CART-ITEM-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        proposalId: input.proposalId,
        proposalItemId: item.proposalItemId,
        productType: item.productType,
        productCode: item.productCode,
        productName: item.productName,
        investmentType: item.investmentType,
        amount: item.amount,
        sipAmount: item.sipAmount,
        sipFrequency: item.sipFrequency,
        sipDuration: item.sipDuration,
        metadata: item.metadata || {},
        addedAt: now
      };
      
      cart.items.push(cartItem);
    }
    
    // Recalculate totals
    this.recalculateCartTotals(cart);
    cart.updatedAt = now;
    this.carts.set(cart.id, cart);
    
    return cart;
  }

  /**
   * Remove item from cart
   */
  removeFromCart(userId: string, cartItemId: string): Cart {
    const cart = this.getOrCreateCart(userId);
    cart.items = cart.items.filter(item => item.id !== cartItemId);
    this.recalculateCartTotals(cart);
    cart.updatedAt = new Date();
    this.carts.set(cart.id, cart);
    return cart;
  }

  /**
   * Update cart item quantity/amount
   */
  updateCartItem(userId: string, cartItemId: string, amount: number): Cart {
    const cart = this.getOrCreateCart(userId);
    const item = cart.items.find(i => i.id === cartItemId);
    if (item) {
      item.amount = amount;
      if (item.investmentType === 'sip') {
        item.sipAmount = amount;
      }
    }
    this.recalculateCartTotals(cart);
    cart.updatedAt = new Date();
    this.carts.set(cart.id, cart);
    return cart;
  }

  /**
   * Clear cart
   */
  clearCart(userId: string): Cart {
    const cart = this.getOrCreateCart(userId);
    cart.items = [];
    cart.totalAmount = 0;
    cart.sipTotal = 0;
    cart.lumpsumTotal = 0;
    cart.updatedAt = new Date();
    this.carts.set(cart.id, cart);
    return cart;
  }

  private recalculateCartTotals(cart: Cart): void {
    cart.sipTotal = cart.items
      .filter(i => i.investmentType === 'sip')
      .reduce((sum, i) => sum + (i.sipAmount || i.amount), 0);
    
    cart.lumpsumTotal = cart.items
      .filter(i => i.investmentType === 'lumpsum')
      .reduce((sum, i) => sum + i.amount, 0);
    
    cart.totalAmount = cart.sipTotal + cart.lumpsumTotal;
  }

  // ============================================================================
  // CHECKOUT & EXECUTION
  // ============================================================================

  /**
   * Checkout cart - Create execution order with maker-checker workflow
   */
  checkout(input: z.infer<typeof checkoutInputSchema>): ExecutionOrder {
    const cart = this.getOrCreateCart(input.userId);
    
    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
    
    const now = new Date();
    const orderId = `ORD-${String(this.orderCounter++).padStart(8, '0')}`;
    const approvalConfig = input.approvalConfig || { requireChecker: true, requireAuthorizer: false, thresholdAmount: 100000 };
    
    // Determine if maker-checker is required
    const requiresMakerChecker = input.makerCheckerEnabled && cart.totalAmount >= approvalConfig.thresholdAmount;
    
    // Build approval steps
    const approvalSteps: ApprovalStep[] = [];
    
    if (requiresMakerChecker) {
      // Step 1: Maker (order creator)
      approvalSteps.push({
        stepNumber: 1,
        role: 'maker',
        userId: input.userId,
        status: 'approved', // Maker auto-approves by submitting
        timestamp: now
      });
      
      // Step 2: Checker
      if (approvalConfig.requireChecker) {
        approvalSteps.push({
          stepNumber: 2,
          role: 'checker',
          status: 'pending'
        });
      }
      
      // Step 3: Authorizer (for high-value orders)
      if (approvalConfig.requireAuthorizer || cart.totalAmount >= 1000000) {
        approvalSteps.push({
          stepNumber: 3,
          role: 'authorizer',
          status: 'pending'
        });
      }
    }
    
    // Create order items
    const orderItems: ExecutionOrderItem[] = cart.items.map((item, index) => ({
      id: `${orderId}-ITEM-${index + 1}`,
      orderId,
      cartItemId: item.id,
      productType: item.productType,
      productCode: item.productCode,
      productName: item.productName,
      orderType: 'buy' as OrderType,
      investmentType: item.investmentType,
      amount: item.amount,
      status: 'pending' as ExecutionStatus
    }));
    
    const order: ExecutionOrder = {
      id: orderId,
      cartId: cart.id,
      clientId: input.userId,
      orderType: 'buy',
      items: orderItems,
      totalAmount: cart.totalAmount,
      
      makerCheckerEnabled: requiresMakerChecker,
      approvalSteps,
      currentApprovalStep: requiresMakerChecker ? 2 : 0, // Skip to checker if maker-checker enabled
      approvalStatus: requiresMakerChecker ? 'pending' : 'approved',
      
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      
      executionStatus: requiresMakerChecker ? 'pending' : 'pending',
      
      createdBy: input.userId,
      createdAt: now,
      updatedAt: now
    };
    
    this.orders.set(orderId, order);
    
    // Clear cart after checkout
    this.clearCart(input.userId);
    
    // If no maker-checker required, auto-proceed to execution
    if (!requiresMakerChecker) {
      this.initiateExecution(orderId);
    }
    
    return order;
  }

  /**
   * Process approval action (checker/authorizer)
   */
  processApproval(input: z.infer<typeof approvalActionInputSchema>): ExecutionOrder {
    const order = this.orders.get(input.orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.approvalStatus !== 'pending') {
      throw new Error(`Order is not pending approval. Current status: ${order.approvalStatus}`);
    }
    
    // Find current pending step
    const currentStep = order.approvalSteps.find(s => s.status === 'pending');
    if (!currentStep) {
      throw new Error('No pending approval step found');
    }
    
    const now = new Date();
    
    // Update step
    currentStep.userId = input.approverId;
    currentStep.status = input.action === 'approve' ? 'approved' : 
                         input.action === 'reject' ? 'rejected' : 'escalated';
    currentStep.comments = input.comments;
    currentStep.timestamp = now;
    currentStep.ipAddress = input.ipAddress;
    
    order.updatedAt = now;
    
    if (input.action === 'reject') {
      order.approvalStatus = 'rejected';
      order.executionStatus = 'cancelled';
      this.orders.set(order.id, order);
      return order;
    }
    
    if (input.action === 'escalate') {
      order.approvalStatus = 'escalated';
      // Add authorizer step if not present
      if (!order.approvalSteps.find(s => s.role === 'authorizer')) {
        order.approvalSteps.push({
          stepNumber: order.approvalSteps.length + 1,
          role: 'authorizer',
          status: 'pending'
        });
      }
      this.orders.set(order.id, order);
      return order;
    }
    
    // Check if all approvals complete
    const pendingSteps = order.approvalSteps.filter(s => s.status === 'pending');
    if (pendingSteps.length === 0) {
      order.approvalStatus = 'approved';
      order.currentApprovalStep = 0;
      
      // Initiate execution
      this.initiateExecution(order.id);
    } else {
      order.currentApprovalStep = pendingSteps[0].stepNumber;
    }
    
    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Initiate order execution
   */
  private initiateExecution(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) return;
    
    order.executionStatus = 'processing';
    order.executionStartedAt = new Date();
    
    // Simulate execution for each item
    for (const item of order.items) {
      item.status = 'processing';
      
      // Simulate successful execution (in real implementation, call BSE/NSE APIs)
      setTimeout(() => {
        item.status = 'completed';
        item.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        item.folioNumber = `FOLIO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        item.executedAt = new Date();
        item.nav = 100 + Math.random() * 50;
        item.units = item.amount / (item.nav || 100);
        
        // Check if all items completed
        const allCompleted = order.items.every(i => i.status === 'completed');
        if (allCompleted) {
          order.executionStatus = 'completed';
          order.executionCompletedAt = new Date();
          order.paymentStatus = 'completed';
        }
        
        this.orders.set(orderId, order);
      }, 1000 + Math.random() * 2000);
    }
    
    this.orders.set(orderId, order);
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): ExecutionOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get orders for a client
   */
  getClientOrders(clientId: string, status?: ExecutionStatus): ExecutionOrder[] {
    return Array.from(this.orders.values())
      .filter(o => o.clientId === clientId && (!status || o.executionStatus === status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get orders pending approval
   */
  getPendingApprovalOrders(approverRole?: ApprovalRole): ExecutionOrder[] {
    return Array.from(this.orders.values())
      .filter(o => {
        if (o.approvalStatus !== 'pending') return false;
        if (!approverRole) return true;
        const pendingStep = o.approvalSteps.find(s => s.status === 'pending');
        return pendingStep?.role === approverRole;
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // ============================================================================
  // ANALYTICS & REPORTING
  // ============================================================================

  /**
   * Get workflow summary
   */
  getWorkflowSummary(clientId?: string): {
    proposals: { total: number; byStatus: Record<string, number> };
    carts: { active: number; totalValue: number };
    orders: { total: number; byStatus: Record<string, number>; pendingApproval: number };
  } {
    const proposals = clientId 
      ? this.getClientProposals(clientId)
      : Array.from(this.proposals.values());
    
    const proposalsByStatus: Record<string, number> = {};
    for (const p of proposals) {
      proposalsByStatus[p.status] = (proposalsByStatus[p.status] || 0) + 1;
    }
    
    const carts = Array.from(this.carts.values())
      .filter(c => !clientId || c.userId === clientId);
    const activeCarts = carts.filter(c => c.items.length > 0);
    
    const orders = clientId
      ? this.getClientOrders(clientId)
      : Array.from(this.orders.values());
    
    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.executionStatus] = (ordersByStatus[o.executionStatus] || 0) + 1;
    }
    
    return {
      proposals: {
        total: proposals.length,
        byStatus: proposalsByStatus
      },
      carts: {
        active: activeCarts.length,
        totalValue: activeCarts.reduce((sum, c) => sum + c.totalAmount, 0)
      },
      orders: {
        total: orders.length,
        byStatus: ordersByStatus,
        pendingApproval: this.getPendingApprovalOrders().length
      }
    };
  }

  /**
   * Get maker-checker workflow status for an order
   */
  getMakerCheckerStatus(orderId: string): {
    orderId: string;
    enabled: boolean;
    currentStep: ApprovalStep | null;
    completedSteps: ApprovalStep[];
    pendingSteps: ApprovalStep[];
    overallStatus: ApprovalStatus;
    canProceedToExecution: boolean;
  } | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    const completedSteps = order.approvalSteps.filter(s => s.status === 'approved');
    const pendingSteps = order.approvalSteps.filter(s => s.status === 'pending');
    const currentStep = pendingSteps[0] || null;
    
    return {
      orderId: order.id,
      enabled: order.makerCheckerEnabled,
      currentStep,
      completedSteps,
      pendingSteps,
      overallStatus: order.approvalStatus,
      canProceedToExecution: order.approvalStatus === 'approved'
    };
  }

  /**
   * Get order audit trail
   */
  getOrderAuditTrail(orderId: string): {
    orderId: string;
    timeline: Array<{
      timestamp: Date;
      action: string;
      actor?: string;
      details: string;
    }>;
  } | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    const timeline: Array<{ timestamp: Date; action: string; actor?: string; details: string }> = [];
    
    // Order creation
    timeline.push({
      timestamp: order.createdAt,
      action: 'ORDER_CREATED',
      actor: order.createdBy,
      details: `Order created with ${order.items.length} items, total value ₹${order.totalAmount.toLocaleString()}`
    });
    
    // Approval steps
    for (const step of order.approvalSteps) {
      if (step.timestamp) {
        timeline.push({
          timestamp: step.timestamp,
          action: `${step.role.toUpperCase()}_${step.status.toUpperCase()}`,
          actor: step.userId,
          details: step.comments || `${step.role} ${step.status} the order`
        });
      }
    }
    
    // Execution
    if (order.executionStartedAt) {
      timeline.push({
        timestamp: order.executionStartedAt,
        action: 'EXECUTION_STARTED',
        details: 'Order execution initiated'
      });
    }
    
    if (order.executionCompletedAt) {
      timeline.push({
        timestamp: order.executionCompletedAt,
        action: 'EXECUTION_COMPLETED',
        details: 'All order items executed successfully'
      });
    }
    
    return {
      orderId: order.id,
      timeline: timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    };
  }
}

// Export singleton instance
export const proposalExecutionEngine = new ProposalExecutionEngine();
